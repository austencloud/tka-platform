<script lang="ts">
	import { onDestroy } from "svelte";
	import { getAnimationVisibilityManager } from "../../state/animation-visibility-state.svelte";

	const vm = getAnimationVisibilityManager();

	let gridVisible = $state(vm.isGridVisible());
	let tkaGlyph = $state(vm.getVisibility("tkaGlyph"));
	let stepNumbers = $state(vm.getVisibility("stepNumbers"));
	let props = $state(vm.getVisibility("props"));
	let wordHeader = $state(vm.getVisibility("wordHeader"));
	let progressBar = $state(vm.getVisibility("progressBar"));

	function handleVisibilityChange(): void {
		gridVisible = vm.isGridVisible();
		tkaGlyph = vm.getVisibility("tkaGlyph");
		stepNumbers = vm.getVisibility("stepNumbers");
		props = vm.getVisibility("props");
		wordHeader = vm.getVisibility("wordHeader");
		progressBar = vm.getVisibility("progressBar");
	}

	vm.registerObserver(handleVisibilityChange);
	onDestroy(() => vm.unregisterObserver(handleVisibilityChange));

	function toggleGrid(): void {
		vm.setGridMode(gridVisible ? "none" : "8point");
	}

	const toggles: { key: "tkaGlyph" | "stepNumbers" | "props" | "wordHeader" | "progressBar"; label: string }[] = [
		{ key: "tkaGlyph", label: "TKA Glyph" },
		{ key: "stepNumbers", label: "Step #" },
		{ key: "props", label: "Props" },
		{ key: "wordHeader", label: "Word" },
		{ key: "progressBar", label: "Progress" },
	];

	function getToggleValue(key: string): boolean {
		switch (key) {
			case "tkaGlyph": return tkaGlyph;
			case "stepNumbers": return stepNumbers;
			case "props": return props;
			case "wordHeader": return wordHeader;
			case "progressBar": return progressBar;
			default: return false;
		}
	}
</script>

<div class="display-chips">
	<button
		class="rt-chip"
		type="button"
		aria-pressed={gridVisible}
		onclick={toggleGrid}
	>Grid</button>

	{#each toggles as toggle}
		<button
			class="rt-chip"
			type="button"
			aria-pressed={getToggleValue(toggle.key)}
			onclick={() => vm.toggleVisibility(toggle.key)}
		>{toggle.label}</button>
	{/each}
</div>

<style>
	.display-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
</style>
