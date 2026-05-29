<script lang="ts">
	import { getEffectsConfigContext } from "$lib/shared/effects/state/effects-config-context";
	import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";

	const effectsConfig = getEffectsConfigContext();

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
		effectsConfig?.updateEffect("fire", DEFAULT_EFFECTS_CONFIG.fire);
	}

	const isDefault = $derived(
		effectsConfig != null &&
		Math.abs(effectsConfig.fire.intensity - DEFAULT_EFFECTS_CONFIG.fire.intensity) < 0.03 &&
		Math.abs(effectsConfig.fire.colorBlend - DEFAULT_EFFECTS_CONFIG.fire.colorBlend) < 0.03 &&
		Math.abs(effectsConfig.fire.turbulence - DEFAULT_EFFECTS_CONFIG.fire.turbulence) < 0.03
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
			value={effectsConfig?.fire.intensity ?? DEFAULT_EFFECTS_CONFIG.fire.intensity}
			oninput={(e) => effectsConfig?.updateEffect("fire", { intensity: Number((e.target as HTMLInputElement).value) })}
		/>
		<span class="slider-value">{formatIntensity(effectsConfig?.fire.intensity ?? DEFAULT_EFFECTS_CONFIG.fire.intensity)}</span>
	</div>

	<div class="slider-row">
		<label for="ctx-fire-color-blend">Color</label>
		<input
			id="ctx-fire-color-blend"
			type="range"
			min="0"
			max="1"
			step="0.05"
			value={effectsConfig?.fire.colorBlend ?? DEFAULT_EFFECTS_CONFIG.fire.colorBlend}
			oninput={(e) => effectsConfig?.updateEffect("fire", { colorBlend: Number((e.target as HTMLInputElement).value) })}
		/>
		<span class="slider-value">{formatColorBlend(effectsConfig?.fire.colorBlend ?? DEFAULT_EFFECTS_CONFIG.fire.colorBlend)}</span>
	</div>

	<div class="slider-row">
		<label for="ctx-fire-turbulence">Turbulence</label>
		<input
			id="ctx-fire-turbulence"
			type="range"
			min="0"
			max="1"
			step="0.05"
			value={effectsConfig?.fire.turbulence ?? DEFAULT_EFFECTS_CONFIG.fire.turbulence}
			oninput={(e) => effectsConfig?.updateEffect("fire", { turbulence: Number((e.target as HTMLInputElement).value) })}
		/>
		<span class="slider-value">{formatTurbulence(effectsConfig?.fire.turbulence ?? DEFAULT_EFFECTS_CONFIG.fire.turbulence)}</span>
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
