<script lang="ts">
	import { onDestroy } from "svelte";
	import { getAnimationVisibilityManager } from "../../../state/animation-visibility-state.svelte";

	const vm = getAnimationVisibilityManager();

	let gridVisible = $state(vm.isGridVisible());
	let tkaGlyph = $state(vm.getVisibility("tkaGlyph"));
	let stepNumbers = $state(vm.getVisibility("stepNumbers"));
	let beatPosition = $state(vm.getVisibility("beatPosition"));
	let props = $state(vm.getVisibility("props"));
	let wordHeader = $state(vm.getVisibility("wordHeader"));
	let progressBar = $state(vm.getVisibility("progressBar"));

	function handleVisibilityChange(): void {
		gridVisible = vm.isGridVisible();
		tkaGlyph = vm.getVisibility("tkaGlyph");
		stepNumbers = vm.getVisibility("stepNumbers");
		beatPosition = vm.getVisibility("beatPosition");
		props = vm.getVisibility("props");
		wordHeader = vm.getVisibility("wordHeader");
		progressBar = vm.getVisibility("progressBar");
	}

	vm.registerObserver(handleVisibilityChange);
	onDestroy(() => vm.unregisterObserver(handleVisibilityChange));

	function toggleGrid(): void {
		// Toggle between "none" and "diamond" (sequence's actual grid mode
		// is determined by the sequence data, not this setting)
		vm.setGridMode(gridVisible ? "none" : "diamond");
	}

	const toggles: { key: "tkaGlyph" | "stepNumbers" | "beatPosition" | "props" | "wordHeader" | "progressBar"; label: string }[] = [
		{ key: "tkaGlyph", label: "TKA Glyph" },
		{ key: "stepNumbers", label: "Step Numbers" },
		{ key: "beatPosition", label: "Beat Position" },
		{ key: "props", label: "Props" },
		{ key: "wordHeader", label: "Word Header" },
		{ key: "progressBar", label: "Progress Bar" },
	];

	function getToggleValue(key: string): boolean {
		switch (key) {
			case "tkaGlyph": return tkaGlyph;
			case "stepNumbers": return stepNumbers;
			case "beatPosition": return beatPosition;
			case "props": return props;
			case "wordHeader": return wordHeader;
			case "progressBar": return progressBar;
			default: return false;
		}
	}
</script>

<div class="display-category">
	<button
		class="toggle-row"
		type="button"
		aria-pressed={gridVisible}
		onclick={toggleGrid}
	>
		<span>Grid</span>
		<span class="toggle-indicator" class:active={gridVisible}></span>
	</button>

	{#each toggles as toggle}
		<button
			class="toggle-row"
			type="button"
			aria-pressed={getToggleValue(toggle.key)}
			onclick={() => vm.toggleVisibility(toggle.key)}
		>
			<span>{toggle.label}</span>
			<span class="toggle-indicator" class:active={getToggleValue(toggle.key)}></span>
		</button>
	{/each}
</div>

<style>
	.display-category {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.toggle-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		min-height: var(--min-touch-target, 44px);
		padding: 8px 12px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 8px;
		color: var(--theme-text, white);
		font-size: var(--font-size-min, 14px);
		cursor: pointer;
		transition: background var(--duration-fast, 100ms) ease;
	}

	.toggle-row:hover {
		background: color-mix(in srgb, var(--theme-text) 8%, transparent);
	}

	.toggle-indicator {
		width: 36px;
		height: 20px;
		border-radius: 10px;
		background: var(--theme-stroke, rgba(255, 255, 255, 0.15));
		position: relative;
		transition: background var(--duration-fast, 100ms) ease;
	}

	.toggle-indicator::after {
		content: "";
		position: absolute;
		top: 2px;
		left: 2px;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
		transition: transform var(--duration-fast, 100ms) ease,
			background var(--duration-fast, 100ms) ease;
	}

	.toggle-indicator.active {
		background: var(--theme-accent, #8b5cf6);
	}

	.toggle-indicator.active::after {
		transform: translateX(16px);
		background: white;
	}

	@media (prefers-reduced-motion: reduce) {
		.toggle-row,
		.toggle-indicator,
		.toggle-indicator::after {
			transition: none;
		}
	}
</style>
