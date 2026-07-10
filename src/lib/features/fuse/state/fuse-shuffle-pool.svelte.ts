/**
 * Fuse Shuffle Pool
 *
 * Owns one panel's shuffle deck: loads public sequences filtered by step
 * length, shuffles them into a random order, and steps through the pool.
 * Presentation-free so FusePanel can mount the card display wherever the
 * layout needs it (inline on desktop, inside a drawer on phones) without
 * the pool resetting.
 *
 * Factory + getter-accessor pattern; deps injected, never resolved here.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { PublicSequencesLoader } from "$lib/shared/browse/services/public-sequences-loader";

export interface FuseShufflePoolDeps {
	browseLoader: PublicSequencesLoader;
	/** Reactive getter for the desired step length; pool reloads when it changes. */
	getLength: () => number;
	onCurrentItemChange?: (seq: SequenceData | null) => void;
}

export function createFuseShufflePool(deps: FuseShufflePoolDeps) {
	const { browseLoader, getLength, onCurrentItemChange } = deps;

	let pool = $state<SequenceData[]>([]);
	let currentItem = $state<SequenceData | null>(null);
	let loading = $state(true);
	let poolIndex = $state(0);

	async function loadPool(length: number) {
		loading = true;
		try {
			const allSequences = await browseLoader.loadSequenceMetadata();

			let filtered = allSequences;
			if (length > 0) {
				filtered = allSequences.filter((s: SequenceData) => {
					const seqLen = s.sequenceLength ?? s.steps?.length ?? 0;
					return seqLen === length;
				});
				if (filtered.length === 0) filtered = allSequences;
			}

			// Fisher-Yates shuffle
			for (let i = filtered.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[filtered[i], filtered[j]] = [filtered[j]!, filtered[i]!];
			}

			pool = filtered;
			poolIndex = 0;
			currentItem = pool[0] ?? null;
			onCurrentItemChange?.(currentItem);

			// Pre-load full step data for the first item
			if (currentItem) {
				loadFullData(currentItem);
			}
		} catch (err) {
			console.error("Failed to load sequences for fuse shuffle:", err);
			pool = [];
			currentItem = null;
			onCurrentItemChange?.(null);
		} finally {
			loading = false;
		}
	}

	async function loadFullData(item: SequenceData) {
		if (item.steps && item.steps.length > 0) return;
		try {
			const full = await browseLoader.loadFullSequenceData(
				item.word || item.name,
				item.id
			);
			if (full) {
				const idx = pool.indexOf(item);
				if (idx >= 0) pool[idx] = full;
				if (currentItem === item) {
					currentItem = full;
					onCurrentItemChange?.(full);
				}
			}
		} catch {
			// Keep metadata-only version
		}
	}

	function shuffle() {
		if (pool.length === 0) return;
		poolIndex = (poolIndex + 1) % pool.length;
		currentItem = pool[poolIndex] ?? null;
		onCurrentItemChange?.(currentItem);
		if (currentItem) loadFullData(currentItem);
	}

	// Reload whenever the requested length changes (also runs on init)
	$effect(() => {
		const length = getLength();
		loadPool(length);
	});

	return {
		get currentItem() {
			return currentItem;
		},
		get loading() {
			return loading;
		},
		get poolSize() {
			return pool.length;
		},
		get poolIndex() {
			return poolIndex;
		},
		shuffle,
	};
}

export type FuseShufflePool = ReturnType<typeof createFuseShufflePool>;
