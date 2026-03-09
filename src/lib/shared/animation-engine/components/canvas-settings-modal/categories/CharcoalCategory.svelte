<script lang="ts">
	import { onDestroy } from "svelte";
	import { getAnimationVisibilityManager } from "../../../state/animation-visibility-state.svelte";
	import { CHARCOAL_SLIDER_GROUPS } from "../../../domain/types/CharcoalSparkTypes";
	import type { CharcoalSparkParams } from "../../../domain/types/CharcoalSparkTypes";

	const vm = getAnimationVisibilityManager();

	let charcoalParams = $state(vm.getCharcoalParams());

	function handleVisibilityChange(): void {
		charcoalParams = vm.getCharcoalParams();
	}

	vm.registerObserver(handleVisibilityChange);
	onDestroy(() => vm.unregisterObserver(handleVisibilityChange));

	function formatValue(v: number, def: { format?: (v: number) => string }): string {
		return def.format ? def.format(v) : String(v);
	}
</script>

<div class="charcoal-controls">
	{#each CHARCOAL_SLIDER_GROUPS as group}
		<span class="group-label">{group.label}</span>
		{#each group.sliders as slider}
			<div class="slider-row">
				<label for="ctx-charcoal-{slider.key}">{slider.label}</label>
				<input
					id="ctx-charcoal-{slider.key}"
					type="range"
					min={slider.min}
					max={slider.max}
					step={slider.step}
					value={charcoalParams[slider.key] as number}
					oninput={(e) => vm.updateCharcoalParam(slider.key as keyof CharcoalSparkParams, Number((e.target as HTMLInputElement).value))}
				/>
				<span class="slider-value">{formatValue(charcoalParams[slider.key] as number, slider)}</span>
			</div>
		{/each}
	{/each}
</div>

<style>
	.charcoal-controls {
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
