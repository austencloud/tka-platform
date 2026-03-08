<script lang="ts">
	import { onDestroy } from "svelte";
	import {
		getAnimationVisibilityManager,
		type GridMode,
	} from "../../../state/animation-visibility-state.svelte";

	const vm = getAnimationVisibilityManager();

	let gridMode = $state(vm.getGridMode());
	let stepNumbers = $state(vm.getVisibility("stepNumbers"));
	let beatPosition = $state(vm.getVisibility("beatPosition"));
	let props = $state(vm.getVisibility("props"));
	let wordHeader = $state(vm.getVisibility("wordHeader"));
	let progressBar = $state(vm.getVisibility("progressBar"));

	function handleVisibilityChange() {
		gridMode = vm.getGridMode();
		stepNumbers = vm.getVisibility("stepNumbers");
		beatPosition = vm.getVisibility("beatPosition");
		props = vm.getVisibility("props");
		wordHeader = vm.getVisibility("wordHeader");
		progressBar = vm.getVisibility("progressBar");
	}

	vm.registerObserver(handleVisibilityChange);
	onDestroy(() => vm.unregisterObserver(handleVisibilityChange));

	const gridOptions: { mode: GridMode; label: string }[] = [
		{ mode: "none", label: "None" },
		{ mode: "diamond", label: "Diamond" },
		{ mode: "box", label: "Box" },
	];

	const toggleOptions: { key: "stepNumbers" | "beatPosition" | "props" | "wordHeader" | "progressBar"; label: string }[] = [
		{ key: "stepNumbers", label: "Step Numbers" },
		{ key: "beatPosition", label: "Beat Position" },
		{ key: "props", label: "Props" },
		{ key: "wordHeader", label: "Word Header" },
		{ key: "progressBar", label: "Progress Bar" },
	];

	function getToggleValue(key: string): boolean {
		switch (key) {
			case "stepNumbers": return stepNumbers;
			case "beatPosition": return beatPosition;
			case "props": return props;
			case "wordHeader": return wordHeader;
			case "progressBar": return progressBar;
			default: return false;
		}
	}
</script>

<div class="display-panel-content">
	<span class="group-label">Grid</span>
	<div class="preset-row">
		{#each gridOptions as opt}
			<button
				class="preset-btn"
				class:active={gridMode === opt.mode}
				aria-pressed={gridMode === opt.mode}
				onclick={() => vm.setGridMode(opt.mode)}
			>
				{opt.label}
			</button>
		{/each}
	</div>

	<span class="group-label">Overlays</span>
	{#each toggleOptions as opt}
		<button
			class="toggle-row"
			aria-pressed={getToggleValue(opt.key)}
			onclick={() => vm.toggleVisibility(opt.key)}
		>
			<span>{opt.label}</span>
			<span class="toggle-indicator" class:active={getToggleValue(opt.key)}></span>
		</button>
	{/each}
</div>

<style>
	.display-panel-content {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.group-label {
		font-size: var(--font-size-compact, 12px);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
		margin-top: 4px;
	}

	.preset-row {
		display: flex;
		gap: 6px;
	}

	.preset-btn {
		flex: 1;
		min-height: var(--min-touch-target, 44px);
		padding: 8px;
		border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 8px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
		font-size: var(--font-size-compact, 12px);
		font-weight: 500;
		cursor: pointer;
		transition: all var(--duration-fast, 100ms) ease;
	}

	.preset-btn:hover {
		background: color-mix(in srgb, var(--theme-text) 8%, transparent);
		border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
		color: var(--theme-text, white);
	}

	.preset-btn.active {
		background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
		border-color: var(--theme-accent, #8b5cf6);
		color: var(--theme-text, white);
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
		.toggle-indicator::after,
		.preset-btn {
			transition: none;
		}
	}
</style>
