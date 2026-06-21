/**
 * createBrowseEngine — Headless Browse State Machine
 *
 * Replaces three separate state files with a single reactive engine:
 * - browse-state-factory.svelte.ts (filtering, sorting, sections, favorites, cache)
 * - grid-zoom-state.svelte.ts (column count, breakpoints)
 * - sequence-source-state.svelte.ts (community/my-library toggle, auth guard)
 *
 * Pure TypeScript + Svelte 5 runes. No DOM, no components.
 * Calls existing singleton services internally.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type {
	BrowseEngine,
	BrowseEngineConfig,
	ActiveFilter,
	SequenceSource,
	PersistedEngineState,
	SectionGroupBy,
} from "./types";

import { BrowseFilterType } from "$lib/shared/persistence/domain/enums/filtering-enums";
import type { BrowseFilterValue } from "$lib/shared/persistence/domain/types/filtering-types";
import { BrowseSortMethod } from "$lib/shared/browse/domain/enums/browse-enums";
import { DEFAULT_BROWSE_VIEW_MODE, type BrowseViewMode } from "$lib/shared/browse/domain/browse-view-mode";
import type { SectionConfig, SequenceSection } from "$lib/shared/browse/domain/models/browse-models";

import { LOOPComponent } from "$lib/shared/foundation/domain/models/generation/generate-models";
import type { LOOPType } from "$lib/shared/foundation/domain/models/generation/circular-models";
import { parseLoopComponents } from "$lib/shared/create/services/loop-type-utils";
import { detectRotationPeriod } from "$lib/shared/create/domain/detect-rotation-period";
import { getBrowseLoader } from "$lib/shared/browse/get-browse-loader";
import { applyFilter as applyBrowseFilter } from "$lib/shared/browse/services/browse-filter";
import {
	applyFilters as applyMultiFilters,
	getFilteredCount as getMultiFilteredCount,
} from "$lib/shared/browse/services/multi-filter";
import { sortSequences as browseSortSequences } from "$lib/shared/browse/services/browse-sorter";
import { organizeSections as organizeBrowseSections } from "$lib/shared/browse/services/browse-section-manager";
import { toggleFavorite as doToggleFavorite } from "$lib/shared/library/services/collection-manager";
import { getLibraryRepository } from "$lib/shared/library/get-library-repository";

import { authState } from "$lib/shared/auth/state/auth-state.svelte";
import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
import {
	onLibraryMutated,
	onLibrarySequenceAdded,
} from "$lib/shared/library/library-events";
import { toast } from "$lib/shared/toast/state/toast-state.svelte";
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_COLUMNS_DEFAULT = 2;

/** Per-breakpoint maximum columns. Prevents cards from becoming unreadably
 *  small on narrow screens while allowing more density on wider ones. */
function getMaxColumnsForWidth(width: number): number {
	if (width < 480) return 2;
	if (width < 800) return 3;
	if (width < 1200) return 4;
	if (width < 1800) return 5;
	if (width < 2600) return 6;
	return 7;
}

/** Default column count for a user who has never chosen a zoom level (e.g.
 *  signed-out guests). Fills the container to its readable density instead of
 *  defaulting to 2 — on a 4K monitor 2 columns left cards huge and the grid
 *  sparse. Mirrors the per-breakpoint max so wide screens open denser. */
function getDefaultColumnsForWidth(width: number): number {
	return getMaxColumnsForWidth(width);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deduplicateById(sequences: SequenceData[]): SequenceData[] {
	const seen = new Set<string>();
	return sequences.filter((seq) => {
		if (seen.has(seq.id)) return false;
		seen.add(seq.id);
		return true;
	});
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

function loadPersisted(key: string | null): PersistedEngineState | null {
	if (!key) return null;
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return null;
		return JSON.parse(raw) as PersistedEngineState;
	} catch {
		return null;
	}
}

function persist(key: string | null, state: PersistedEngineState): void {
	if (!key) return;
	try {
		localStorage.setItem(key, JSON.stringify(state));
	} catch {
		// Ignore storage errors (quota, SSR, etc.)
	}
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createBrowseEngine(config: BrowseEngineConfig): BrowseEngine {
	// --- Services (singleton factories) ---
	const loaderService = getBrowseLoader();

	// --- Resolve persisted state ---
	const persisted = loadPersisted(config.persistKey);
	const minColumns = config.minColumns ?? MIN_COLUMNS_DEFAULT;

	// --- Build locked filters from constraints ---
	const lockedFilters = new Map<string, ActiveFilter>();
	if (config.constraints) {
		for (const c of config.constraints) {
			lockedFilters.set(String(c.type), {
				type: c.type,
				value: c.value,
				label: c.label,
				chipColor: "var(--theme-accent)",
				locked: true,
			});
		}
	}

	// --- Merge persisted user filters with locked filters ---
	function buildInitialFilters(): Map<string, ActiveFilter> {
		const merged = new Map<string, ActiveFilter>(lockedFilters);
		if (persisted?.activeFilters) {
			for (const [key, filter] of persisted.activeFilters) {
				// Don't let persisted user filters overwrite locked constraints
				if (!merged.has(key)) {
					merged.set(key, { ...filter, locked: false });
				}
			}
		}
		return merged;
	}

	// --- Reactive state ---
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let source = $state<SequenceSource>(
		persisted?.source ?? config.initialSource ?? "community"
	);
	let allSequences = $state<SequenceData[]>([]);
	let sectionsReady = $state(false);

	let sortMethod = $state<BrowseSortMethod>(
		persisted?.sortMethod ?? config.initialSort ?? BrowseSortMethod.ALPHABETICAL
	);
	let sortDirection = $state<"asc" | "desc">(
		persisted?.sortDirection ?? config.initialSortDirection ?? "asc"
	);

	let activeFilters = $state<Map<string, ActiveFilter>>(buildInitialFilters());

	// View mode (compositional browsing)
	let _viewMode = $state<BrowseViewMode>(
		persisted?.viewMode ?? { ...DEFAULT_BROWSE_VIEW_MODE }
	);

	// Search state
	let _searchQuery = $state("");

	// Section state
	let _sectionsEnabled = $state(config.sections ?? false);
	// Manual section-grouping override. When null (the default), grouping follows
	// the active sort method so the left section index always reflects the chosen
	// sort. A non-null value pins grouping regardless of sort. `config.defaultSectionGroupBy`
	// seeds the override only when a host explicitly wants to pin a grouping.
	let _sectionGroupByOverride = $state<SectionGroupBy | null>(
		config.defaultSectionGroupBy ?? null
	);

	// Layout state.
	// Has the user (or a prior session / host config) explicitly picked a column
	// count? If not, the count auto-adapts to the measured container width so a
	// fresh guest on a 4K monitor opens dense instead of stuck at 2 columns.
	const hasExplicitColumns =
		persisted?.columns !== undefined ||
		config.initialColumns !== undefined ||
		settingsService.settings.gridZoomLevel !== undefined;
	let userHasChosenColumns = hasExplicitColumns;
	let columns = $state<number>(
		persisted?.columns ??
			config.initialColumns ??
			settingsService.settings.gridZoomLevel ??
			MIN_COLUMNS_DEFAULT
	);
	let containerWidth = $state(0);
	let isTransitioning = $state(false);
	let transitionTimeout: ReturnType<typeof setTimeout> | null = null;

	// Library cache (per-source, avoids Firestore round-trip on tab switch)
	let libraryCache: SequenceData[] | null = null;

	// --- Derived: filtering + sorting pipeline ---

	const filteredAndSorted = $derived.by(() => {
		let result = allSequences;

		// Apply filters
		if (activeFilters.size > 0) {
			// applyFilters is generic over `T extends ActiveFilter`, so the engine's
			// richer ActiveFilter (with `locked`) passes structurally — no cast needed.
			result = applyMultiFilters(result, activeFilters);
		}

		// Apply search
		if (_searchQuery.trim()) {
			result = applyBrowseFilter(result, BrowseFilterType.CONTAINS_LETTERS, _searchQuery);
		}

		// Apply sorting
		const sorted = browseSortSequences(result, sortMethod);
		if (sortDirection === "desc") {
			sorted.reverse();
		}
		return sorted;
	});

	// --- Derived: sections ---

	// Sort method → section grouping. Keeps the left section index in lockstep
	// with the toolbar sort: sorting by Level buckets into difficulty sections,
	// by Date into date sections, by Length into length sections, A–Z into letters.
	const SORT_TO_SECTION_GROUP: Record<BrowseSortMethod, SectionGroupBy> = {
		[BrowseSortMethod.ALPHABETICAL]: "letter",
		[BrowseSortMethod.DATE_ADDED]: "date",
		[BrowseSortMethod.DIFFICULTY_LEVEL]: "difficulty",
		[BrowseSortMethod.SEQUENCE_LENGTH]: "length",
		[BrowseSortMethod.AUTHOR]: "author",
		[BrowseSortMethod.POPULARITY]: "letter",
	};

	const effectiveSectionGroupBy = $derived.by((): SectionGroupBy => {
		if (_sectionGroupByOverride) return _sectionGroupByOverride;
		let groupBy = SORT_TO_SECTION_GROUP[sortMethod] ?? "letter";
		// Hands mode has no letter/difficulty semantics — fall back to length.
		if (_viewMode.subject === "hands" && (groupBy === "letter" || groupBy === "difficulty")) {
			groupBy = "length";
		}
		return groupBy;
	});

	const sections = $derived.by((): SequenceSection[] => {
		if (!_sectionsEnabled || !sectionsReady) return [];
		const sectionConfig: SectionConfig = {
			groupBy: effectiveSectionGroupBy,
			sortMethod,
			showEmptySections: false,
			expandedSections: new Set<string>(),
		};
		return organizeBrowseSections(filteredAndSorted, sectionConfig);
	});

	// --- Derived: filter metadata ---

	const userFilterCount = $derived.by(() => {
		let count = 0;
		for (const f of activeFilters.values()) {
			if (!f.locked) count++;
		}
		return count;
	});

	const hasActiveFilters = $derived(userFilterCount > 0);

	const allFilterChips = $derived.by(() => {
		return Array.from(activeFilters.values());
	});

	const availableLengths = $derived.by(() => {
		const lengths = new Set<number>();
		for (const seq of allSequences) {
			const len = seq.sequenceLength ?? seq.steps?.length ?? 0;
			if (len > 0) lengths.add(len);
		}
		return Array.from(lengths).sort((a, b) => a - b);
	});

	const loopTypeCounts = $derived.by(() => {
		const counts: Record<string, number> = {};
		let circularCount = 0;
		const total = allSequences.length;

		// Per-component counters
		let rotatedHalvedCount = 0;
		let rotatedQuarteredCount = 0;
		const componentCounts = new Map<LOOPComponent, number>();

		for (const seq of allSequences) {
			if (seq.isCircular) {
				circularCount++;
				if (seq.loopType) {
					counts[seq.loopType] = (counts[seq.loopType] ?? 0) + 1;
				}
			}

			const comps: readonly LOOPComponent[] = seq.components?.length
				? seq.components
				: seq.loopType
					? Array.from(parseLoopComponents(seq.loopType as LOOPType))
					: [];

			for (const comp of comps) {
				componentCounts.set(comp, (componentCounts.get(comp) ?? 0) + 1);
			}
			if (comps.includes(LOOPComponent.ROTATED)) {
				const period = seq.period ?? (seq.steps?.length ? detectRotationPeriod(seq.id, seq.steps) : 2);
				if (period === 4) {
					rotatedQuarteredCount++;
				} else {
					rotatedHalvedCount++;
				}
			}
		}

		counts["_total"] = total;
		counts["_circular"] = circularCount;
		counts["_non_circular"] = total - circularCount;

		// Component counts keyed as "component:<name>"
		counts["component:rotated_halved"] = rotatedHalvedCount;
		counts["component:rotated_quartered"] = rotatedQuarteredCount;
		for (const comp of [
			LOOPComponent.MIRRORED,
			LOOPComponent.FLIPPED,
			LOOPComponent.SWAPPED,
			LOOPComponent.INVERTED,
			LOOPComponent.REWOUND,
		]) {
			counts[`component:${comp}`] = componentCounts.get(comp) ?? 0;
		}

		return counts;
	});

	// --- Derived: layout ---

	const maxColumns = $derived(getMaxColumnsForWidth(containerWidth));

	// --- Persistence effect ---

	$effect(() => {
		// Read all reactive values to track them
		const _source = source;
		const _sortMethod = sortMethod;
		const _sortDirection = sortDirection;
		const _filters = activeFilters;
		const _columns = columns;
		const viewMode = _viewMode;

		if (!config.persistKey) return;

		// Serialize only non-locked filters
		const userFilters: Array<[string, ActiveFilter]> = [];
		for (const [key, filter] of _filters) {
			if (!filter.locked) {
				userFilters.push([key, filter]);
			}
		}

		persist(config.persistKey, {
			source: _source,
			sortMethod: _sortMethod,
			sortDirection: _sortDirection,
			activeFilters: userFilters,
			columns: _columns,
			viewMode,
		});
	});

	// --- Library mutation listeners ---

	const cleanupMutated = $effect.root(() => {
		$effect(() => {
			return onLibraryMutated((sequenceId) => {
				libraryCache = libraryCache?.filter((s) => s.id !== sequenceId) ?? null;
				loaderService.removeFromCache(sequenceId);
				allSequences = allSequences.filter((s) => s.id !== sequenceId);
			});
		});

		$effect(() => {
			return onLibrarySequenceAdded((sequence) => {
				if (source === "my-library") {
					if (libraryCache) {
						libraryCache = [sequence, ...libraryCache];
					}
					allSequences = deduplicateById([sequence, ...allSequences]);
				} else {
					// Invalidate cache so next switch fetches fresh data
					libraryCache = null;
				}
			});
		});

		// Return root cleanup
		return () => {};
	});

	// --- Internal: load sequences ---

	async function loadCommunitySequences(): Promise<void> {
		try {
			isLoading = true;
			sectionsReady = false;
			error = null;
			const sequences = await loaderService.loadSequenceMetadata();
			allSequences = deduplicateById(sequences);
			sectionsReady = true;
		} catch (err) {
			console.error("[BrowseEngine] Failed to load community sequences:", err);
			error = err instanceof Error ? err.message : "Failed to load sequences";
		} finally {
			isLoading = false;
		}
	}

	async function loadLibrarySequences(): Promise<void> {
		// Fast path: use cached data
		if (libraryCache) {
			allSequences = libraryCache;
			sectionsReady = true;
			return;
		}

		// Auth guard
		if (!authState.isAuthenticated) {
			error = "Please sign in to view your library";
			allSequences = [];
			sectionsReady = false;
			return;
		}

		const libRepo = getLibraryRepository();
		if (!libRepo) {
			error = "Library service unavailable";
			allSequences = [];
			sectionsReady = false;
			return;
		}

		try {
			isLoading = true;
			sectionsReady = false;
			error = null;
			const sequences = await libRepo.getSequences();
			const deduped = deduplicateById(sequences as SequenceData[]);
			allSequences = deduped;
			libraryCache = deduped;
			sectionsReady = true;
		} catch (err) {
			console.error("[BrowseEngine] Failed to load library sequences:", err);
			error = err instanceof Error ? err.message : "Failed to load library";
		} finally {
			isLoading = false;
		}
	}

	// --- Layout helpers ---

	function triggerTransition(): void {
		isTransitioning = true;
		if (transitionTimeout) clearTimeout(transitionTimeout);
		transitionTimeout = setTimeout(() => {
			isTransitioning = false;
			transitionTimeout = null;
		}, 200);
	}

	function persistColumns(cols: number): void {
		if (cols !== settingsService.settings.gridZoomLevel) {
			settingsService.updateSetting("gridZoomLevel", cols);
		}
	}

	// --- Public API ---

	const engine: BrowseEngine = {
		// Reactive getters
		get isLoading() {
			return isLoading;
		},
		get error() {
			return error;
		},
		get source() {
			return source;
		},
		get allSequences() {
			return allSequences;
		},
		get sequences() {
			return filteredAndSorted;
		},
		get resultCount() {
			return filteredAndSorted.length;
		},
		get sections() {
			return sections;
		},
		get sectionsReady() {
			return sectionsReady;
		},
		get searchQuery() {
			return _searchQuery;
		},
		get sortMethod() {
			return sortMethod;
		},
		get sortDirection() {
			return sortDirection;
		},
		get activeFilters() {
			return activeFilters;
		},
		get allFilterChips() {
			return allFilterChips;
		},
		get userFilterCount() {
			return userFilterCount;
		},
		get hasActiveFilters() {
			return hasActiveFilters;
		},

		// Layout (flat getters)
		get columnCount() {
			return Math.max(minColumns, Math.min(maxColumns, columns));
		},
		get canZoomIn() {
			return columns < maxColumns;
		},
		get canZoomOut() {
			return columns > minColumns;
		},
		get isTransitioning() {
			return isTransitioning;
		},

		// Source / section state
		get canSwitchSource() {
			return (config.allowSourceToggle !== false) && ((config.sources?.length ?? 2) > 1);
		},
		get sectionsEnabled() {
			return _sectionsEnabled;
		},
		get sectionGroupBy() {
			return effectiveSectionGroupBy;
		},

		get viewMode() {
			return _viewMode;
		},

		get availableLengths() {
			return availableLengths;
		},
		get loopTypeCounts() {
			return loopTypeCounts;
		},

		// --- Initialize / Refresh ---
		async initialize(): Promise<void> {
			if (source === "my-library") await loadLibrarySequences();
			else await loadCommunitySequences();
		},

		async refresh(): Promise<void> {
			libraryCache = null;
			if (source === "my-library") await loadLibrarySequences();
			else await loadCommunitySequences();
		},

		// --- Search ---
		setSearch(query: string): void {
			_searchQuery = query;
		},

		// --- Source ---
		async setSource(newSource: SequenceSource): Promise<void> {
			// Auth guard for library
			if (newSource === "my-library" && !authState.isAuthenticated) {
				return;
			}
			// Skip if already showing this source with data loaded
			if (newSource === source && sectionsReady) {
				return;
			}
			source = newSource;
			if (newSource === "my-library") {
				await loadLibrarySequences();
			} else {
				await loadCommunitySequences();
			}
		},

		// --- Sort ---
		setSort(method: BrowseSortMethod, direction: "asc" | "desc"): void {
			sortMethod = method;
			sortDirection = direction;
			// Pipeline recomputes via $derived automatically
		},

		// --- Filters ---
		addFilter(
			type: BrowseFilterType,
			value: BrowseFilterValue,
			label: string,
			chipColor: string
		): void {
			const key = String(type);
			// Don't overwrite locked constraints
			const existing = activeFilters.get(key);
			if (existing?.locked) return;

			const newMap = new Map(activeFilters);
			newMap.set(key, {
				type,
				value,
				label,
				chipColor,
				locked: false,
			});
			activeFilters = newMap;
		},

		removeFilter(typeKey: string): void {
			const existing = activeFilters.get(typeKey);
			if (!existing || existing.locked) return;

			const newMap = new Map(activeFilters);
			newMap.delete(typeKey);
			activeFilters = newMap;
		},

		clearUserFilters(): void {
			// Keep only locked filters
			const newMap = new Map<string, ActiveFilter>();
			for (const [key, filter] of activeFilters) {
				if (filter.locked) {
					newMap.set(key, filter);
				}
			}
			activeFilters = newMap;
		},

		getFilteredCount(
			candidateType: BrowseFilterType,
			candidateValue: BrowseFilterValue
		): number {
			return getMultiFilteredCount(
				allSequences,
				candidateType,
				candidateValue,
				activeFilters
			);
		},

		// --- Favorites ---
		async toggleFavorite(sequenceId: string): Promise<void> {
			try {
				const newStatus = await doToggleFavorite(sequenceId);
				const update = (seq: SequenceData) =>
					seq.id === sequenceId
						? { ...seq, isFavorite: newStatus }
						: seq;

				allSequences = allSequences.map(update);

				// Update library cache too
				if (libraryCache) {
					libraryCache = libraryCache.map(update);
				}
			} catch (err) {
				// No optimistic flip happens before this point — the local
				// state only updates after doToggleFavorite resolves — so there
				// is nothing to revert here, just surface the failure.
				console.error("[BrowseEngine] Failed to toggle favorite:", err);
				toast.error("Couldn't update favorite. Please try again.");
			}
		},

		// --- Layout ---
		setColumns(newColumns: number): void {
			// Any direct set is an explicit user choice — stop auto-adapting to width.
			userHasChosenColumns = true;
			const max = getMaxColumnsForWidth(containerWidth);
			const clamped = Math.max(minColumns, Math.min(max, newColumns));
			if (clamped !== columns) {
				columns = clamped;
				triggerTransition();
				persistColumns(clamped);
			}
		},

		updateContainerWidth(width: number): void {
			if (width <= 0 || width === containerWidth) return;
			containerWidth = width;

			// Guest / no explicit choice: adapt the count to the container width so
			// a 4K monitor opens dense instead of stuck at the minimum. Don't write
			// it to settings — leave gridZoomLevel unset so it keeps adapting.
			if (!userHasChosenColumns) {
				const target = Math.max(minColumns, getDefaultColumnsForWidth(width));
				if (target !== columns) {
					columns = target;
				}
				return;
			}

			const max = getMaxColumnsForWidth(width);
			if (columns > max) {
				columns = max;
				persistColumns(max);
			}
		},

		zoomIn(): void {
			engine.setColumns(columns + 1);
		},

		zoomOut(): void {
			engine.setColumns(columns - 1);
		},

		// --- Sections ---
		setSectionsEnabled(enabled: boolean): void {
			_sectionsEnabled = enabled;
		},

		setSectionGroupBy(groupBy: SectionGroupBy): void {
			// Pin grouping as an explicit override; pass "none" semantics via null is
			// not exposed here, so callers clear by re-selecting the sort-driven group.
			_sectionGroupByOverride = groupBy;
		},

		setViewMode(mode: BrowseViewMode): void {
			// Grouping follows sort + view subject via effectiveSectionGroupBy, so no
			// manual groupBy bookkeeping is needed here anymore.
			_viewMode = mode;
		},

		// --- Cache ---
		invalidateLibraryCache(): void {
			libraryCache = null;
		},

		// --- Cleanup ---
		destroy(): void {
			cleanupMutated();
			if (transitionTimeout) {
				clearTimeout(transitionTimeout);
				transitionTimeout = null;
			}
		},
	};

	return engine;
}
