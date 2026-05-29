<script lang="ts">
	import { onMount } from "svelte";
	import { getMandalaGeometryCalculator } from "$lib/shared/mandala/getMandalaGeometryCalculator";
	import { renderMandalaSVG } from "$lib/shared/mandala/services/mandala-renderer";
	import { loadCatalogs, loadCatalogSequences } from "$lib/features/choreo-card/services/catalog-loader";
	import type { Catalog } from "$lib/features/choreo-card/domain/models/Catalog";
	import type { MandalaRenderOptions, MandalaPalette, MandalaOverlapConfig, MandalaPaths } from "$lib/shared/mandala/domain/mandala-types";
	import { DEFAULT_OVERLAP_CONFIG } from "$lib/shared/mandala/domain/mandala-types";
	import {
		DARK_MOTION_BLUE_STROKE,
		DARK_MOTION_RED_STROKE,
		DARK_MOTION_BLUE_FILL,
		DARK_MOTION_RED_FILL,
		DARK_MOTION_PURPLE_STROKE,
		DARK_MOTION_PURPLE_FILL,
	} from "$lib/shared/mandala/domain/mandala-constants";
	import type { MandalaGeometryCalculator } from "$lib/shared/mandala/services/mandala-geometry-calculator";

	const PALETTE: MandalaPalette = {
		blueStroke: DARK_MOTION_BLUE_STROKE,
		blueFill: DARK_MOTION_BLUE_FILL,
		redStroke: DARK_MOTION_RED_STROKE,
		redFill: DARK_MOTION_RED_FILL,
		purpleStroke: DARK_MOTION_PURPLE_STROKE,
		purpleFill: DARK_MOTION_PURPLE_FILL,
	};

	type DeckTier = "starred" | "flagged" | "basic";
	type TierFilter = "all" | DeckTier | "unrated";
	const STORAGE_KEY = "pathMandalaLab.deckTiers";

	function loadTiers(): Record<string, DeckTier> {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			return raw ? JSON.parse(raw) : {};
		} catch {
			return {};
		}
	}

	function saveTiers(tiers: Record<string, DeckTier>) {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(tiers));
	}

	let calculator: MandalaGeometryCalculator | null = $state(null);
	let decks: Catalog[] = $state([]);
	let selectedDeckId: string = $state("");
	let sequences: any[] = $state([]);
	let loading: boolean = $state(false);
	let error: string = $state("");

	let renderStyle: "stroke" | "filled" = $state("stroke");
	let strokeWidth: number = $state(2.5);
	type ViewMode = "grid" | "spotlight";
	let viewMode: ViewMode = $state<ViewMode>("grid");
	let spotlightIndex: number = $state(0);
	let tierFilter: TierFilter = $state("all");
	let deckTiers: Record<string, DeckTier> = $state(loadTiers());

	let overlap: MandalaOverlapConfig = $state({ ...DEFAULT_OVERLAP_CONFIG });

	function setDeckTier(deckId: string, tier: DeckTier | null) {
		if (tier === null) {
			delete deckTiers[deckId];
		} else {
			deckTiers[deckId] = tier;
		}
		deckTiers = { ...deckTiers };
		saveTiers(deckTiers);
	}

	function getDeckTier(deckId: string): DeckTier | null {
		return deckTiers[deckId] ?? null;
	}

	function cycleTier(deckId: string) {
		const current = getDeckTier(deckId);
		const cycle: (DeckTier | null)[] = [null, "starred", "flagged", "basic"];
		const idx = cycle.indexOf(current);
		const next = cycle[(idx + 1) % cycle.length] ?? null;
		setDeckTier(deckId, next);
	}

	const mandalaSize = $derived(viewMode === "spotlight" ? 560 : 300);

	let dedupe = $state(true);
	let expandedShape: string | null = $state(null);

	const MONO_PALETTE: MandalaPalette = {
		blueStroke: "#b8b0e0",
		blueFill: "rgba(184, 176, 224, 0.12)",
		redStroke: "#b8b0e0",
		redFill: "rgba(184, 176, 224, 0.12)",
		purpleStroke: "#b8b0e0",
		purpleFill: "rgba(184, 176, 224, 0.12)",
	};

	interface MandalaEntry {
		id: string;
		word: string;
		paths: MandalaPaths;
	}

	interface ShapeGroup {
		fingerprint: string;
		entries: MandalaEntry[];
	}

	function shapeFingerprint(paths: MandalaPaths): string {
		return [...paths.blue.map((p) => p.d), ...paths.red.map((p) => p.d)].sort().join("\n");
	}

	const allEntries = $derived.by((): MandalaEntry[] => {
		if (!calculator || sequences.length === 0) return [];
		return sequences.map((seq) => ({
			id: seq.id,
			word: seq.word ?? seq.id,
			paths: calculator!.calculate(seq.steps, "staff", "staff"),
		}));
	});

	const shapeGroups = $derived.by((): ShapeGroup[] => {
		const map = new Map<string, ShapeGroup>();
		for (const entry of allEntries) {
			const fp = shapeFingerprint(entry.paths);
			const existing = map.get(fp);
			if (existing) {
				existing.entries.push(entry);
			} else {
				map.set(fp, { fingerprint: fp, entries: [entry] });
			}
		}
		return [...map.values()].sort((a, b) => b.entries.length - a.entries.length);
	});

	const shapeStats = $derived({
		total: allEntries.length,
		unique: shapeGroups.length,
	});

	interface DisplayItem {
		id: string;
		word: string;
		svg: string;
		count: number;
		fingerprint: string;
	}

	const displayItems = $derived.by((): DisplayItem[] => {
		const opts: MandalaRenderOptions = {
			size: mandalaSize,
			style: renderStyle,
			show: "both",
			strokeWidth,
			overlap,
		};
		if (!dedupe) {
			return allEntries.map((e) => ({
				id: e.id,
				word: e.word,
				svg: renderMandalaSVG(e.paths, { ...opts, palette: PALETTE }),
				count: 0,
				fingerprint: "",
			}));
		}
		if (expandedShape) {
			const fp = expandedShape;
			const group = shapeGroups.find((g) => g.fingerprint === fp);
			if (!group) return [];
			return group.entries.map((e) => ({
				id: e.id,
				word: e.word,
				svg: renderMandalaSVG(e.paths, { ...opts, palette: PALETTE }),
				count: 0,
				fingerprint: fp,
			}));
		}
		return shapeGroups.map((g) => {
			const rep = g.entries[0]!;
			return {
				id: rep.id,
				word: g.entries.length === 1 ? rep.word : `${g.entries.length} variants`,
				svg: renderMandalaSVG(rep.paths, { ...opts, palette: MONO_PALETTE }),
				count: g.entries.length,
				fingerprint: g.fingerprint,
			};
		});
	});

	const spotlightMandala = $derived(displayItems[spotlightIndex] ?? null);

	onMount(async () => {
		calculator = getMandalaGeometryCalculator();
		try {
			decks = await loadCatalogs();
			const first = decks[0];
			if (first) {
				selectedDeckId = first.id;
			}
		} catch (e: any) {
			error = e.message ?? "Failed to load decks";
		}
	});

	$effect(() => {
		if (!selectedDeckId) return;
		loading = true;
		error = "";
		expandedShape = null;
		loadCatalogSequences(selectedDeckId)
			.then((seqs) => {
				sequences = seqs;
				spotlightIndex = 0;
			})
			.catch((e: any) => {
				error = e.message ?? "Failed to load sequences";
			})
			.finally(() => {
				loading = false;
			});
	});

	interface DeckGroup {
		key: string;
		decks: Catalog[];
	}

	const filteredDecks = $derived.by((): Catalog[] => {
		if (tierFilter === "all") return decks;
		if (tierFilter === "unrated") return decks.filter((d) => !deckTiers[d.id]);
		return decks.filter((d) => deckTiers[d.id] === tierFilter);
	});

	const deckGroups = $derived.by((): DeckGroup[] => {
		const map = new Map<string, Catalog[]>();
		for (const d of filteredDecks) {
			const key = d.loopType || "other";
			const list = map.get(key) ?? [];
			list.push(d);
			map.set(key, list);
		}
		return [...map.entries()]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([key, group]) => ({ key, decks: group.sort((a, b) => a.level - b.level) }));
	});

	const tierCounts = $derived.by(() => {
		let starred = 0, flagged = 0, basic = 0, unrated = 0;
		for (const d of decks) {
			const t = deckTiers[d.id];
			if (t === "starred") starred++;
			else if (t === "flagged") flagged++;
			else if (t === "basic") basic++;
			else unrated++;
		}
		return { starred, flagged, basic, unrated, total: decks.length };
	});

	function setGroupTier(group: DeckGroup, tier: DeckTier | null) {
		for (const d of group.decks) {
			if (tier === null) {
				delete deckTiers[d.id];
			} else {
				deckTiers[d.id] = tier;
			}
		}
		deckTiers = { ...deckTiers };
		saveTiers(deckTiers);
	}

	function getGroupTier(group: DeckGroup): DeckTier | "mixed" | null {
		const tiers = new Set(group.decks.map((d) => deckTiers[d.id] ?? null));
		if (tiers.size === 1) return [...tiers][0] as DeckTier | null;
		return "mixed";
	}

	const selectedDeck = $derived(decks.find((d) => d.id === selectedDeckId) ?? null);

	function resetOverlap() {
		overlap = { ...DEFAULT_OVERLAP_CONFIG };
	}

	function handleCardClick(item: DisplayItem, index: number) {
		if (dedupe && !expandedShape && item.count > 1) {
			expandedShape = item.fingerprint;
			spotlightIndex = 0;
		} else {
			spotlightIndex = index;
			viewMode = "spotlight";
		}
	}

	function backToShapes() {
		expandedShape = null;
		spotlightIndex = 0;
		viewMode = "grid";
	}

	function nextSpotlight() {
		if (displayItems.length > 0) {
			spotlightIndex = (spotlightIndex + 1) % displayItems.length;
		}
	}

	function prevSpotlight() {
		if (displayItems.length > 0) {
			spotlightIndex = (spotlightIndex - 1 + displayItems.length) % displayItems.length;
		}
	}
</script>

<div class="lab-root">
	<!-- LEFT: Catalog triage (full height) -->
	<aside class="deck-panel">
		<div class="tier-filters">
			<button class="tier-btn" class:active={tierFilter === "all"} onclick={() => (tierFilter = "all")}>
				All <span class="tf-count">{tierCounts.total}</span>
			</button>
			<button class="tier-btn tier-starred" class:active={tierFilter === "starred"} onclick={() => (tierFilter = "starred")}>
				<i class="fas fa-star" aria-hidden="true"></i> <span class="tf-count">{tierCounts.starred}</span>
			</button>
			<button class="tier-btn tier-flagged" class:active={tierFilter === "flagged"} onclick={() => (tierFilter = "flagged")}>
				<i class="fas fa-flag" aria-hidden="true"></i> <span class="tf-count">{tierCounts.flagged}</span>
			</button>
			<button class="tier-btn tier-basic" class:active={tierFilter === "basic"} onclick={() => (tierFilter = "basic")}>
				<i class="fas fa-minus" aria-hidden="true"></i> <span class="tf-count">{tierCounts.basic}</span>
			</button>
			<button class="tier-btn" class:active={tierFilter === "unrated"} onclick={() => (tierFilter = "unrated")}>
				<i class="fas fa-circle-question" aria-hidden="true"></i> <span class="tf-count">{tierCounts.unrated}</span>
			</button>
		</div>

		<div class="deck-list">
			{#each deckGroups as group}
				<div class="group-section">
					<div class="group-row-header">
						<span class="group-key">{group.key}</span>
						<span class="group-count">{group.decks.length}</span>
						<div class="group-triage">
							<button
								class="gt-btn starred"
								class:active={getGroupTier(group) === "starred"}
								onclick={() => setGroupTier(group, getGroupTier(group) === "starred" ? null : "starred")}
								aria-label="Star all {group.key} decks"
							><i class="fas fa-star" aria-hidden="true"></i></button>
							<button
								class="gt-btn flagged"
								class:active={getGroupTier(group) === "flagged"}
								onclick={() => setGroupTier(group, getGroupTier(group) === "flagged" ? null : "flagged")}
								aria-label="Flag all {group.key} decks"
							><i class="fas fa-flag" aria-hidden="true"></i></button>
							<button
								class="gt-btn basic"
								class:active={getGroupTier(group) === "basic"}
								onclick={() => setGroupTier(group, getGroupTier(group) === "basic" ? null : "basic")}
								aria-label="Mark all {group.key} decks as basic"
							><i class="fas fa-minus" aria-hidden="true"></i></button>
						</div>
					</div>
					<div class="deck-chips">
						{#each group.decks as deck}
							<button
								class="deck-chip"
								class:active={deck.id === selectedDeckId}
								class:is-starred={deckTiers[deck.id] === "starred"}
								class:is-flagged={deckTiers[deck.id] === "flagged"}
								class:is-basic={deckTiers[deck.id] === "basic"}
								onclick={() => (selectedDeckId = deck.id)}
								title="{deck.name} — {deck.totalSequences} sequences"
							>
								{#if deckTiers[deck.id] === "starred"}
									<i class="fas fa-star chip-tier-icon" aria-hidden="true"></i>
								{:else if deckTiers[deck.id] === "flagged"}
									<i class="fas fa-flag chip-tier-icon" aria-hidden="true"></i>
								{:else if deckTiers[deck.id] === "basic"}
									<i class="fas fa-minus chip-tier-icon" aria-hidden="true"></i>
								{/if}
								<span class="chip-level">L{deck.level}</span>
								<span class="chip-name">{deck.gridMode}</span>
								<span class="chip-count">{deck.totalSequences}</span>
							</button>
						{/each}
					</div>
				</div>
			{/each}
			{#if filteredDecks.length === 0}
				<span class="no-decks">No decks in this tier</span>
			{/if}
		</div>

		{#if selectedDeck}
			<div class="deck-active-info">
				<div class="active-header">
					<span class="active-name">{selectedDeck.name}</span>
				</div>
				<span class="active-meta">{sequences.length} seq · {selectedDeck.gridMode} · {selectedDeck.sliceType}</span>
				<div class="triage-bar">
					<button
						class="triage-btn starred"
						class:active={getDeckTier(selectedDeckId) === "starred"}
						onclick={() => setDeckTier(selectedDeckId, getDeckTier(selectedDeckId) === "starred" ? null : "starred")}
						aria-label="Star deck"
					>
						<i class="fas fa-star" aria-hidden="true"></i>
					</button>
					<button
						class="triage-btn flagged"
						class:active={getDeckTier(selectedDeckId) === "flagged"}
						onclick={() => setDeckTier(selectedDeckId, getDeckTier(selectedDeckId) === "flagged" ? null : "flagged")}
						aria-label="Flag deck as problematic"
					>
						<i class="fas fa-flag" aria-hidden="true"></i>
					</button>
					<button
						class="triage-btn basic"
						class:active={getDeckTier(selectedDeckId) === "basic"}
						onclick={() => setDeckTier(selectedDeckId, getDeckTier(selectedDeckId) === "basic" ? null : "basic")}
						aria-label="Mark deck as basic"
					>
						<i class="fas fa-minus" aria-hidden="true"></i>
					</button>
				</div>
			</div>
		{/if}
	</aside>

	<!-- RIGHT: Toolbar + Gallery -->
	<div class="right-zone">
		<header class="toolbar">
			<div class="tb-section">
				<div class="segmented">
					<button class:active={viewMode === "grid"} onclick={() => (viewMode = "grid")}>
						<i class="fas fa-grip" aria-hidden="true"></i> Grid
					</button>
					<button class:active={viewMode === "spotlight"} onclick={() => (viewMode = "spotlight")}>
						<i class="fas fa-expand" aria-hidden="true"></i> Spotlight
					</button>
				</div>
				<div class="segmented">
					<button class:active={renderStyle === "stroke"} onclick={() => (renderStyle = "stroke")}>Stroke</button>
					<button class:active={renderStyle === "filled"} onclick={() => (renderStyle = "filled")}>Filled</button>
				</div>
				<button
					class="pill-toggle"
					class:active={dedupe}
					onclick={() => { dedupe = !dedupe; expandedShape = null; spotlightIndex = 0; }}
					aria-pressed={dedupe}
					aria-label="Toggle shape deduplication"
				>
					<span class="pill-thumb"></span>
				</button>
				<span class="dedupe-label">{dedupe ? "Shapes" : "All"}</span>
				{#if dedupe && !expandedShape}
					<span class="shape-stat">{shapeStats.unique} / {shapeStats.total}</span>
				{/if}
			</div>
			<div class="tb-section tb-sliders">
				<!-- svelte-ignore a11y_label_has_associated_control -->
				<label class="slider-row">
					<span class="row-label">Stroke</span>
					<input type="range" min="0.5" max="6" step="0.1" bind:value={strokeWidth} />
					<span class="val">{strokeWidth.toFixed(1)}</span>
				</label>
				<!-- svelte-ignore a11y_label_has_associated_control -->
				<label class="slider-row">
					<span class="row-label">Feather</span>
					<input type="range" min="0" max="3" step="0.05" bind:value={overlap.feather} />
					<span class="val">{overlap.feather.toFixed(2)}</span>
				</label>
				<!-- svelte-ignore a11y_label_has_associated_control -->
				<label class="slider-row">
					<span class="row-label">Bloom</span>
					<input type="range" min="0" max="15" step="0.5" bind:value={overlap.bloomBlur} />
					<span class="val">{overlap.bloomBlur.toFixed(1)}</span>
				</label>
				<!-- svelte-ignore a11y_label_has_associated_control -->
				<label class="slider-row">
					<span class="row-label">Glow</span>
					<input type="range" min="0" max="1" step="0.02" bind:value={overlap.bloomOpacity} />
					<span class="val">{overlap.bloomOpacity.toFixed(2)}</span>
				</label>
				<!-- svelte-ignore a11y_label_has_associated_control -->
				<label class="slider-row">
					<span class="row-label">Width</span>
					<input type="range" min="0.5" max="6" step="0.1" bind:value={overlap.bloomWidth} />
					<span class="val">{overlap.bloomWidth.toFixed(1)}</span>
				</label>
				<!-- svelte-ignore a11y_label_has_associated_control -->
				<label class="slider-row">
					<span class="row-label">Core</span>
					<input type="range" min="0" max="1" step="0.02" bind:value={overlap.coreOpacity} />
					<span class="val">{overlap.coreOpacity.toFixed(2)}</span>
				</label>
				<button class="reset-btn" onclick={resetOverlap} aria-label="Reset overlap settings">
					<i class="fas fa-rotate-left" aria-hidden="true"></i>
				</button>
			</div>
		</header>

	<main class="canvas-area">
		{#if expandedShape && dedupe}
			<div class="breadcrumb">
				<button class="back-btn" onclick={backToShapes}>
					<i class="fas fa-arrow-left" aria-hidden="true"></i> Shapes
				</button>
				<span class="breadcrumb-sep">/</span>
				<span class="breadcrumb-current">{displayItems.length} color variants</span>
			</div>
		{/if}
		{#if loading}
			<div class="loading-state">
				{#each Array(6) as _}
					<div class="skeleton-card">
						<div class="skeleton-pulse"></div>
					</div>
				{/each}
			</div>
		{:else if error}
			<div class="error-state">
				<i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
				<p>{error}</p>
			</div>
		{:else if viewMode === "spotlight" && spotlightMandala}
			<div class="spotlight">
				<div class="spotlight-card">
					<div class="spotlight-mandala">
						{@html spotlightMandala.svg}
					</div>
				</div>
				<div class="spotlight-nav">
					<button onclick={prevSpotlight} aria-label="Previous mandala">
						<i class="fas fa-chevron-left" aria-hidden="true"></i>
					</button>
					<span class="spotlight-label">{spotlightMandala.word}</span>
					<span class="spotlight-counter">{spotlightIndex + 1} / {displayItems.length}</span>
					<button onclick={nextSpotlight} aria-label="Next mandala">
						<i class="fas fa-chevron-right" aria-hidden="true"></i>
					</button>
				</div>
			</div>
		{:else if displayItems.length === 0}
			<div class="empty-state">
				<i class="fas fa-atom" aria-hidden="true"></i>
				<p>No sequences in this deck</p>
			</div>
		{:else}
			<div class="grid">
				{#each displayItems as m, i (m.id)}
					<button
						class="grid-card"
						class:selected={i === spotlightIndex}
						onclick={() => handleCardClick(m, i)}
					>
						<div class="grid-mandala">
							{@html m.svg}
						</div>
						<span class="grid-label">{m.word}</span>
						{#if m.count > 1}
							<span class="variant-badge">{m.count}</span>
						{/if}
					</button>
				{/each}
			</div>
		{/if}
	</main>
	</div>
</div>

<style>
	.lab-root {
		display: flex;
		height: 100%;
		overflow: hidden;
		color: var(--font-color, #e2e8f0);
		background: radial-gradient(ellipse at 30% 20%, rgba(99, 102, 241, 0.06) 0%, transparent 50%),
			radial-gradient(ellipse at 70% 80%, rgba(167, 139, 250, 0.04) 0%, transparent 50%);
	}

	/* --- Catalog Panel (left) --- */
	aside.deck-panel {
		flex-shrink: 0;
		width: 320px;
		display: flex;
		flex-direction: column;
		border-right: 1px solid rgba(255, 255, 255, 0.06);
		overflow: hidden;
		padding: 0.75rem;
		gap: 0.5rem;
	}

	/* --- Right zone (toolbar + gallery) --- */
	.right-zone {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	/* --- Toolbar (top of gallery area) --- */
	header.toolbar {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.6rem 1rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.05);
		background: rgba(255, 255, 255, 0.02);
		backdrop-filter: blur(12px);
	}

	.tb-section {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.tb-sliders {
		flex: 1;
		gap: 0.25rem;
		overflow-x: auto;
		scrollbar-width: none;
	}

	/* Tier filter bar */
	.tier-filters {
		display: flex;
		gap: 3px;
		margin-bottom: 0.6rem;
		padding: 3px;
		background: rgba(0, 0, 0, 0.15);
		border-radius: 8px;
	}

	.tier-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 3px;
		padding: 4px 2px;
		border: none;
		border-radius: 5px;
		background: transparent;
		color: inherit;
		font-size: 0.6rem;
		cursor: pointer;
		opacity: 0.4;
		transition: all 0.2s;
	}

	.tier-btn.active {
		opacity: 1;
		background: rgba(255, 255, 255, 0.06);
	}

	.tier-btn.tier-starred.active { color: #fbbf24; }
	.tier-btn.tier-flagged.active { color: #f87171; }
	.tier-btn.tier-basic.active { color: rgba(255, 255, 255, 0.4); }

	.tf-count {
		font-size: 0.55rem;
		font-variant-numeric: tabular-nums;
		opacity: 0.6;
	}

	/* Catalog list */
	.deck-list {
		flex: 1;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: rgba(167, 139, 250, 0.2) transparent;
	}

	.group-section {
		margin-bottom: 0.6rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.03);
	}

	.group-section:last-child {
		border-bottom: none;
		margin-bottom: 0;
	}

	.group-row-header {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-bottom: 0.35rem;
	}

	.group-key {
		font-size: 0.68rem;
		font-weight: 600;
		text-transform: capitalize;
		opacity: 0.6;
	}

	.group-count {
		font-size: 0.55rem;
		opacity: 0.3;
		font-variant-numeric: tabular-nums;
	}

	.group-triage {
		display: flex;
		gap: 2px;
		margin-left: auto;
	}

	.gt-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 18px;
		border-radius: 4px;
		border: none;
		background: transparent;
		color: inherit;
		font-size: 0.5rem;
		cursor: pointer;
		opacity: 0.2;
		transition: all 0.15s;
	}

	.gt-btn:hover {
		opacity: 0.6;
		background: rgba(255, 255, 255, 0.05);
	}

	.gt-btn.starred.active { opacity: 1; color: #fbbf24; }
	.gt-btn.flagged.active { opacity: 1; color: #f87171; }
	.gt-btn.basic.active { opacity: 1; color: rgba(255, 255, 255, 0.5); }

	.chip-level {
		font-size: 0.55rem;
		font-weight: 600;
		opacity: 0.4;
		font-variant-numeric: tabular-nums;
	}

	.deck-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.deck-chip {
		display: flex;
		align-items: center;
		gap: 3px;
		padding: 3px 8px;
		border-radius: 6px;
		border: 1px solid rgba(255, 255, 255, 0.06);
		background: rgba(0, 0, 0, 0.2);
		color: inherit;
		font-size: 0.65rem;
		cursor: pointer;
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		white-space: nowrap;
	}

	.deck-chip:hover {
		border-color: rgba(167, 139, 250, 0.25);
		background: rgba(167, 139, 250, 0.08);
	}

	.deck-chip.active {
		border-color: rgba(167, 139, 250, 0.5);
		background: rgba(167, 139, 250, 0.18);
		box-shadow: 0 0 8px rgba(167, 139, 250, 0.15);
	}

	.deck-chip.is-starred {
		border-color: rgba(251, 191, 36, 0.3);
	}
	.deck-chip.is-starred.active {
		border-color: rgba(251, 191, 36, 0.6);
		box-shadow: 0 0 8px rgba(251, 191, 36, 0.15);
	}

	.deck-chip.is-flagged {
		border-color: rgba(248, 113, 113, 0.25);
	}
	.deck-chip.is-flagged.active {
		border-color: rgba(248, 113, 113, 0.5);
		box-shadow: 0 0 8px rgba(248, 113, 113, 0.15);
	}

	.deck-chip.is-basic {
		opacity: 0.4;
	}

	.chip-tier-icon {
		font-size: 0.5rem;
	}

	.deck-chip.is-starred .chip-tier-icon { color: #fbbf24; }
	.deck-chip.is-flagged .chip-tier-icon { color: #f87171; }
	.deck-chip.is-basic .chip-tier-icon { opacity: 0.4; }

	.chip-name {
		opacity: 0.8;
		text-transform: capitalize;
	}

	.deck-chip.active .chip-name {
		opacity: 1;
	}

	.chip-count {
		font-size: 0.55rem;
		opacity: 0.35;
		font-variant-numeric: tabular-nums;
	}

	.no-decks {
		display: block;
		text-align: center;
		font-size: 0.65rem;
		opacity: 0.3;
		padding: 0.75rem 0;
	}

	/* Active deck info + triage */
	.deck-active-info {
		margin-top: 0.5rem;
		padding-top: 0.5rem;
		border-top: 1px solid rgba(255, 255, 255, 0.04);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.active-header {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.active-name {
		font-size: 0.72rem;
		font-weight: 500;
		opacity: 0.7;
	}

	.active-meta {
		font-size: 0.6rem;
		opacity: 0.35;
		font-variant-numeric: tabular-nums;
	}

	.triage-bar {
		display: flex;
		gap: 4px;
		margin-top: 0.3rem;
	}

	.triage-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 26px;
		border-radius: 6px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(0, 0, 0, 0.2);
		color: inherit;
		font-size: 0.7rem;
		cursor: pointer;
		opacity: 0.35;
		transition: all 0.2s;
	}

	.triage-btn:hover {
		opacity: 0.7;
	}

	.triage-btn.starred.active {
		opacity: 1;
		color: #fbbf24;
		border-color: rgba(251, 191, 36, 0.4);
		background: rgba(251, 191, 36, 0.1);
	}

	.triage-btn.flagged.active {
		opacity: 1;
		color: #f87171;
		border-color: rgba(248, 113, 113, 0.4);
		background: rgba(248, 113, 113, 0.1);
	}

	.triage-btn.basic.active {
		opacity: 1;
		color: rgba(255, 255, 255, 0.5);
		border-color: rgba(255, 255, 255, 0.15);
		background: rgba(255, 255, 255, 0.04);
	}

	/* --- Segmented Control --- */
	.segmented {
		display: flex;
		gap: 1px;
		background: rgba(255, 255, 255, 0.05);
		border-radius: 8px;
		padding: 3px;
		margin-bottom: 0.5rem;
	}

	.segmented button {
		flex: 1;
		padding: 0.35rem 0.5rem;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: inherit;
		font-size: 0.72rem;
		cursor: pointer;
		opacity: 0.5;
		transition: all 0.2s;
	}

	.segmented button.active {
		background: rgba(167, 139, 250, 0.2);
		opacity: 1;
		box-shadow: 0 1px 4px rgba(167, 139, 250, 0.15);
	}

	/* --- Toggle pill --- */
	.pill-toggle {
		position: relative;
		width: 36px;
		height: 20px;
		border-radius: 10px;
		border: 1px solid rgba(255, 255, 255, 0.12);
		background: rgba(0, 0, 0, 0.3);
		cursor: pointer;
		transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
		padding: 0;
	}

	.pill-toggle.active {
		background: rgba(167, 139, 250, 0.35);
		border-color: rgba(167, 139, 250, 0.5);
	}

	.pill-thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.7);
		transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.pill-toggle.active .pill-thumb {
		transform: translateX(16px);
		background: #c4b5fd;
	}

	/* --- Slider --- */
	.slider-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.25rem 0;
	}

	.row-label {
		flex-shrink: 0;
		width: 52px;
		font-size: 0.7rem;
		opacity: 0.55;
	}

	.slider-row input[type="range"] {
		flex: 1;
		height: 4px;
		-webkit-appearance: none;
		appearance: none;
		background: rgba(255, 255, 255, 0.08);
		border-radius: 2px;
		outline: none;
	}

	.slider-row input[type="range"]::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #a78bfa;
		border: 2px solid rgba(255, 255, 255, 0.2);
		box-shadow: 0 0 6px rgba(167, 139, 250, 0.4);
		cursor: pointer;
		transition: transform 0.15s, box-shadow 0.15s;
	}

	.slider-row input[type="range"]::-webkit-slider-thumb:hover {
		transform: scale(1.2);
		box-shadow: 0 0 10px rgba(167, 139, 250, 0.6);
	}

	.slider-row input[type="range"]::-moz-range-thumb {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #a78bfa;
		border: 2px solid rgba(255, 255, 255, 0.2);
		box-shadow: 0 0 6px rgba(167, 139, 250, 0.4);
		cursor: pointer;
	}

	.val {
		width: 32px;
		text-align: right;
		font-size: 0.65rem;
		font-variant-numeric: tabular-nums;
		opacity: 0.4;
		font-family: "JetBrains Mono", "SF Mono", monospace;
	}

	/* --- Reset --- */
	.reset-btn {
		width: 100%;
		margin-top: 0.5rem;
		padding: 0.4rem;
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 6px;
		background: rgba(0, 0, 0, 0.15);
		color: inherit;
		font-size: 0.7rem;
		cursor: pointer;
		opacity: 0.4;
		transition: all 0.2s;
	}

	.reset-btn:hover {
		opacity: 0.8;
		border-color: rgba(167, 139, 250, 0.2);
	}

	/* --- Canvas area --- */
	main.canvas-area {
		flex: 1;
		overflow-y: auto;
		padding: 1.25rem;
		scrollbar-width: thin;
		scrollbar-color: rgba(167, 139, 250, 0.2) transparent;
	}

	/* --- Grid view --- */
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1rem;
		align-content: start;
	}

	.grid-card {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem 0.75rem 0.75rem;
		border: 1px solid rgba(255, 255, 255, 0.04);
		border-radius: 14px;
		background: rgba(13, 13, 26, 0.6);
		cursor: pointer;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		overflow: hidden;
	}

	.grid-card::before {
		content: "";
		position: absolute;
		inset: 0;
		border-radius: 14px;
		background: radial-gradient(circle at 50% 30%, rgba(167, 139, 250, 0.04) 0%, transparent 70%);
		opacity: 0;
		transition: opacity 0.3s;
	}

	.grid-card:hover {
		border-color: rgba(167, 139, 250, 0.2);
		transform: translateY(-2px);
		box-shadow: 0 8px 32px rgba(167, 139, 250, 0.08), 0 2px 8px rgba(0, 0, 0, 0.3);
	}

	.grid-card:hover::before {
		opacity: 1;
	}

	.grid-mandala {
		width: 100%;
		aspect-ratio: 1;
	}

	.grid-mandala :global(svg) {
		width: 100%;
		height: 100%;
	}

	.grid-label {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		opacity: 0.45;
		transition: opacity 0.2s;
	}

	.grid-card:hover .grid-label {
		opacity: 0.8;
	}

	/* --- Spotlight view --- */
	.spotlight {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: 1.5rem;
	}

	.spotlight-card {
		position: relative;
		padding: 2rem;
		border-radius: 20px;
		background: rgba(13, 13, 26, 0.7);
		border: 1px solid rgba(167, 139, 250, 0.1);
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4), 0 0 40px rgba(167, 139, 250, 0.05);
	}

	.spotlight-mandala {
		width: 560px;
		height: 560px;
		max-width: 70vw;
		max-height: 70vh;
	}

	.spotlight-mandala :global(svg) {
		width: 100%;
		height: 100%;
	}

	.spotlight-nav {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.spotlight-nav button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		border: 1px solid rgba(255, 255, 255, 0.1);
		background: rgba(255, 255, 255, 0.04);
		color: inherit;
		cursor: pointer;
		transition: all 0.2s;
	}

	.spotlight-nav button:hover {
		border-color: rgba(167, 139, 250, 0.3);
		background: rgba(167, 139, 250, 0.1);
	}

	.spotlight-label {
		font-size: 0.9rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		opacity: 0.7;
	}

	.spotlight-counter {
		font-size: 0.7rem;
		opacity: 0.35;
		font-variant-numeric: tabular-nums;
	}

	/* --- Loading --- */
	.loading-state {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 1rem;
	}

	.skeleton-card {
		aspect-ratio: 1;
		border-radius: 14px;
		background: rgba(255, 255, 255, 0.02);
		border: 1px solid rgba(255, 255, 255, 0.04);
		overflow: hidden;
	}

	.skeleton-pulse {
		width: 100%;
		height: 100%;
		background: linear-gradient(
			110deg,
			transparent 25%,
			rgba(167, 139, 250, 0.04) 37%,
			transparent 50%
		);
		background-size: 200% 100%;
		animation: shimmer 1.8s ease-in-out infinite;
	}

	@keyframes shimmer {
		0% { background-position: 200% 0; }
		100% { background-position: -200% 0; }
	}

	/* --- Empty / Error --- */
	.empty-state,
	.error-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: 0.75rem;
		opacity: 0.4;
	}

	.empty-state i,
	.error-state i {
		font-size: 2rem;
	}

	.error-state {
		opacity: 1;
		color: #f87171;
	}

	.error-state p {
		font-size: 0.85rem;
	}

	/* --- Dedupe controls --- */
	.dedupe-label {
		font-size: 0.65rem;
		opacity: 0.5;
		white-space: nowrap;
	}

	.shape-stat {
		font-size: 0.6rem;
		font-variant-numeric: tabular-nums;
		font-family: "JetBrains Mono", "SF Mono", monospace;
		padding: 2px 6px;
		border-radius: 4px;
		background: rgba(167, 139, 250, 0.12);
		color: #c4b5fd;
		white-space: nowrap;
	}

	/* --- Breadcrumb --- */
	.breadcrumb {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0;
		margin-bottom: 0.5rem;
	}

	.back-btn {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 4px 10px;
		border: 1px solid rgba(167, 139, 250, 0.2);
		border-radius: 6px;
		background: rgba(167, 139, 250, 0.08);
		color: #c4b5fd;
		font-size: 0.7rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.back-btn:hover {
		background: rgba(167, 139, 250, 0.18);
		border-color: rgba(167, 139, 250, 0.4);
	}

	.breadcrumb-sep {
		opacity: 0.2;
		font-size: 0.7rem;
	}

	.breadcrumb-current {
		font-size: 0.7rem;
		opacity: 0.5;
	}

	/* --- Variant badge --- */
	.variant-badge {
		position: absolute;
		top: 8px;
		right: 8px;
		min-width: 22px;
		height: 22px;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 5px;
		border-radius: 11px;
		background: rgba(167, 139, 250, 0.35);
		color: #e0d8ff;
		font-size: 0.6rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		backdrop-filter: blur(4px);
		border: 1px solid rgba(167, 139, 250, 0.2);
	}
</style>
