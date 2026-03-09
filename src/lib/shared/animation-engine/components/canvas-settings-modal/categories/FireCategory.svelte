<script lang="ts">
	import { onDestroy } from "svelte";
	import { getAnimationVisibilityManager } from "../../../state/animation-visibility-state.svelte";

	const vm = getAnimationVisibilityManager();

	let intensity = $state(vm.getFireIntensity());
	let colorBlend = $state(vm.getFireColorBlend());
	let smokeLevel = $state(vm.getFireSmokeLevel());

	function handleVisibilityChange(): void {
		intensity = vm.getFireIntensity();
		colorBlend = vm.getFireColorBlend();
		smokeLevel = vm.getFireSmokeLevel();
	}

	vm.registerObserver(handleVisibilityChange);
	onDestroy(() => vm.unregisterObserver(handleVisibilityChange));

	function formatIntensity(v: number): string {
		return `${Math.round(v * 100)}%`;
	}

	function formatColorBlend(v: number): string {
		if (v < 0.1) return "Natural";
		if (v > 0.9) return "Colored";
		return `${Math.round(v * 100)}%`;
	}

	function formatSmoke(v: number): string {
		return `${Math.round(v * 100)}%`;
	}
</script>

<div class="fire-controls">
	<div class="slider-row">
		<label for="ctx-fire-intensity">Intensity</label>
		<input
			id="ctx-fire-intensity"
			type="range"
			min="0"
			max="1"
			step="0.05"
			value={intensity}
			oninput={(e) => vm.setFireIntensity(Number((e.target as HTMLInputElement).value))}
		/>
		<span class="slider-value">{formatIntensity(intensity)}</span>
	</div>

	<div class="slider-row">
		<label for="ctx-fire-color-blend">Color</label>
		<input
			id="ctx-fire-color-blend"
			type="range"
			min="0"
			max="1"
			step="0.05"
			value={colorBlend}
			oninput={(e) => vm.setFireColorBlend(Number((e.target as HTMLInputElement).value))}
		/>
		<span class="slider-value">{formatColorBlend(colorBlend)}</span>
	</div>

	<div class="slider-row">
		<label for="ctx-fire-smoke">Smoke</label>
		<input
			id="ctx-fire-smoke"
			type="range"
			min="0"
			max="1"
			step="0.05"
			value={smokeLevel}
			oninput={(e) => vm.setFireSmokeLevel(Number((e.target as HTMLInputElement).value))}
		/>
		<span class="slider-value">{formatSmoke(smokeLevel)}</span>
	</div>
</div>

<style>
	.fire-controls {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.slider-row {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: var(--min-touch-target, 44px);
	}

	.slider-row label {
		min-width: 70px;
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
	}

	.slider-row input[type="range"] {
		flex: 1;
		accent-color: var(--theme-accent, #8b5cf6);
	}

	.slider-value {
		min-width: 52px;
		text-align: right;
		font-family: var(--font-mono, monospace);
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text, white);
	}
</style>
