<script lang="ts">
	import { onDestroy } from "svelte";
	import { getAnimationVisibilityManager } from "../../../state/animation-visibility-state.svelte";

	const vm = getAnimationVisibilityManager();

	let tkaGlyph = $state(vm.getVisibility("tkaGlyph"));
	let reversalIndicators = $state(vm.getVisibility("reversalIndicators"));
	let blueMotion = $state(vm.getVisibility("blueMotion"));
	let redMotion = $state(vm.getVisibility("redMotion"));

	function handleVisibilityChange() {
		tkaGlyph = vm.getVisibility("tkaGlyph");
		reversalIndicators = vm.getVisibility("reversalIndicators");
		blueMotion = vm.getVisibility("blueMotion");
		redMotion = vm.getVisibility("redMotion");
	}

	vm.registerObserver(handleVisibilityChange);
	onDestroy(() => vm.unregisterObserver(handleVisibilityChange));

	const overlayOptions: { key: "tkaGlyph" | "reversalIndicators" | "blueMotion" | "redMotion"; label: string }[] = [
		{ key: "tkaGlyph", label: "TKA Glyph" },
		{ key: "reversalIndicators", label: "Reversal Indicators" },
		{ key: "blueMotion", label: "Blue Motion" },
		{ key: "redMotion", label: "Red Motion" },
	];

	function getToggleValue(key: string): boolean {
		switch (key) {
			case "tkaGlyph": return tkaGlyph;
			case "reversalIndicators": return reversalIndicators;
			case "blueMotion": return blueMotion;
			case "redMotion": return redMotion;
			default: return false;
		}
	}
</script>

<div class="overlay-panel-content">
	{#each overlayOptions as opt}
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
	.overlay-panel-content {
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
