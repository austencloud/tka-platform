<script lang="ts">
	import { onDestroy } from "svelte";
	import { getAnimationVisibilityManager } from "../../../state/animation-visibility-state.svelte";
	import {
		charcoalParamsToSemantic,
		semanticToCharcoalParams,
		DEFAULT_CHARCOAL_SEMANTIC,
	} from "../../../domain/types/CharcoalSparkTypes";

	const vm = getAnimationVisibilityManager();

	let intensity = $state(0);
	let spread = $state(0);
	let glow = $state(0);

	function syncFromParams(): void {
		const semantic = charcoalParamsToSemantic(vm.getCharcoalParams());
		intensity = semantic.intensity;
		spread = semantic.spread;
		glow = semantic.glow;
	}

	syncFromParams();
	vm.registerObserver(syncFromParams);
	onDestroy(() => vm.unregisterObserver(syncFromParams));

	function applySemanticChange(): void {
		vm.setCharcoalParams(semanticToCharcoalParams({ intensity, spread, glow }));
	}

	function resetDefaults(): void {
		vm.resetCharcoalDefaults();
	}

	const isDefault = $derived(
		Math.abs(intensity - DEFAULT_CHARCOAL_SEMANTIC.intensity) < 0.02 &&
		Math.abs(spread - DEFAULT_CHARCOAL_SEMANTIC.spread) < 0.02 &&
		Math.abs(glow - DEFAULT_CHARCOAL_SEMANTIC.glow) < 0.02
	);
</script>

<div class="charcoal-controls">
	<div class="slider-row">
		<label for="ctx-charcoal-intensity">Intensity</label>
		<input
			id="ctx-charcoal-intensity"
			type="range"
			min="0"
			max="1"
			step="0.02"
			value={intensity}
			oninput={(e) => { intensity = Number((e.target as HTMLInputElement).value); applySemanticChange(); }}
		/>
		<span class="slider-value">{Math.round(intensity * 100)}%</span>
	</div>

	<div class="slider-row">
		<label for="ctx-charcoal-spread">Spread</label>
		<input
			id="ctx-charcoal-spread"
			type="range"
			min="0"
			max="1"
			step="0.02"
			value={spread}
			oninput={(e) => { spread = Number((e.target as HTMLInputElement).value); applySemanticChange(); }}
		/>
		<span class="slider-value">{Math.round(spread * 100)}%</span>
	</div>

	<div class="slider-row">
		<label for="ctx-charcoal-glow">Glow</label>
		<input
			id="ctx-charcoal-glow"
			type="range"
			min="0"
			max="1"
			step="0.02"
			value={glow}
			oninput={(e) => { glow = Number((e.target as HTMLInputElement).value); applySemanticChange(); }}
		/>
		<span class="slider-value">{Math.round(glow * 100)}%</span>
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
	.charcoal-controls {
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
		min-width: 40px;
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
