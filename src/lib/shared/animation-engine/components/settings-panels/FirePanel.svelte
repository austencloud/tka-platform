<script lang="ts">
	import { onDestroy } from "svelte";
	import { getAnimationVisibilityManager } from "../../state/animation-visibility-state.svelte";

	const vm = getAnimationVisibilityManager();

	let intensity = $state(vm.getFireIntensity());
	let colorBlend = $state(vm.getFireColorBlend());
	let turbulence = $state(vm.getFireTurbulence());

	function handleVisibilityChange(): void {
		intensity = vm.getFireIntensity();
		colorBlend = vm.getFireColorBlend();
		turbulence = vm.getFireTurbulence();
	}

	vm.registerObserver(handleVisibilityChange);
	onDestroy(() => vm.unregisterObserver(handleVisibilityChange));

	function formatIntensity(v: number): string {
		const pct = Math.round(((v - 0.45) / (1 - 0.45)) * 100);
		return `${pct}%`;
	}

	function formatColorBlend(v: number): string {
		if (v < 0.1) return "Natural";
		if (v > 0.9) return "Colored";
		return `${Math.round(v * 100)}%`;
	}

	function formatTurbulence(v: number): string {
		if (v < 0.05) return "Off";
		if (v > 0.95) return "Max";
		return `${Math.round(v * 100)}%`;
	}

	function resetDefaults(): void {
		vm.resetFireDefaults();
	}

	const isDefault = $derived(
		Math.abs(intensity - 0.7) < 0.03 &&
		Math.abs(colorBlend - 0.5) < 0.03 &&
		Math.abs(turbulence - 0.5) < 0.03
	);
</script>

<div class="fire-controls">
	<div class="slider-row">
		<label for="ctx-fire-intensity">Intensity</label>
		<input
			id="ctx-fire-intensity"
			type="range"
			min="0.45"
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
		<label for="ctx-fire-turbulence">Turbulence</label>
		<input
			id="ctx-fire-turbulence"
			type="range"
			min="0"
			max="1"
			step="0.05"
			value={turbulence}
			oninput={(e) => vm.setFireTurbulence(Number((e.target as HTMLInputElement).value))}
		/>
		<span class="slider-value">{formatTurbulence(turbulence)}</span>
	</div>

	<button
		class="reset-btn"
		type="button"
		disabled={isDefault}
		onclick={resetDefaults}
	>
		Reset
	</button>
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

	.reset-btn {
		align-self: flex-end;
		padding: 4px 12px;
		min-height: 32px;
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 6px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
		font-size: var(--font-size-compact, 12px);
		cursor: pointer;
		transition: all var(--duration-fast, 100ms) ease;
	}

	.reset-btn:hover:not(:disabled) {
		background: color-mix(in srgb, var(--theme-text) 8%, transparent);
		color: var(--theme-text, white);
	}

	.reset-btn:disabled {
		opacity: 0.3;
		cursor: default;
	}

	.reset-btn:focus-visible {
		outline: 2px solid var(--theme-accent, #8b5cf6);
		outline-offset: 2px;
	}

	@media (prefers-reduced-motion: reduce) {
		.reset-btn {
			transition: none;
		}
	}
</style>
