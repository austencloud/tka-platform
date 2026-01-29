<!--
  MorphChipGroup.svelte - Container for morphing chip components

  Manages expansion state and provides context to child MorphChips.
  Uses spring animation for smooth morph transitions.
-->
<script lang="ts">
	import { spring } from "svelte/motion";
	import { setMorphChipContext } from "./morph-chip-context.svelte.ts";
	import type { MorphChipGroupProps, MorphChipContext } from "./types";

	let {
		expandedId = $bindable(null),
		gap = 8,
		expandedHeight = 132,
		springConfig = { stiffness: 0.3, damping: 0.8 },
		children,
	}: MorphChipGroupProps = $props();

	// Spring for morph animation progress
	const morphSpring = spring(0, springConfig);

	// Track registered chips and their order
	let chipRegistry = $state<Map<string, number>>(new Map());
	let nextIndex = $state(0);

	// Expose spring value as readonly
	let morphProgress = $derived($morphSpring);

	function expand(id: string) {
		expandedId = id;
		morphSpring.set(1);
	}

	function collapse() {
		expandedId = null;
		morphSpring.set(0);
	}

	function registerChip(id: string): number {
		if (chipRegistry.has(id)) {
			return chipRegistry.get(id)!;
		}
		const index = nextIndex;
		chipRegistry.set(id, index);
		nextIndex++;
		return index;
	}

	function unregisterChip(id: string) {
		chipRegistry.delete(id);
	}

	// Build context object
	const context: MorphChipContext = {
		get expandedId() {
			return expandedId;
		},
		get morphProgress() {
			return morphProgress;
		},
		get chipCount() {
			return chipRegistry.size;
		},
		get gap() {
			return gap;
		},
		get expandedHeight() {
			return expandedHeight;
		},
		expand,
		collapse,
		registerChip,
		unregisterChip,
	};

	setMorphChipContext(context);
</script>

<div
	class="morph-chip-group"
	style:--chip-gap="{gap}px"
	style:--expanded-height="{expandedHeight}px"
>
	{@render children()}
</div>

<style>
	.morph-chip-group {
		display: flex;
		gap: var(--chip-gap, 8px);
		position: relative;
		min-height: 56px;
	}
</style>
