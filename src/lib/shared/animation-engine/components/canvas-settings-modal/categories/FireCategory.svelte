<script lang="ts">
	import { onDestroy } from "svelte";
	import { getAnimationVisibilityManager } from "../../../state/animation-visibility-state.svelte";
	import { CHARCOAL_SLIDER_GROUPS } from "../../../domain/types/CharcoalSparkTypes";
	import type { CharcoalSparkParams } from "../../../domain/types/CharcoalSparkTypes";

	const vm = getAnimationVisibilityManager();

	let intensity = $state(vm.getFireIntensity());
	let colorBlend = $state(vm.getFireColorBlend());
	let smokeLevel = $state(vm.getFireSmokeLevel());
	let useCharcoal = $state(vm.getFireUseCharcoal());
	let charcoalParams = $state(vm.getCharcoalParams());

	function handleVisibilityChange(): void {
		intensity = vm.getFireIntensity();
		colorBlend = vm.getFireColorBlend();
		smokeLevel = vm.getFireSmokeLevel();
		useCharcoal = vm.getFireUseCharcoal();
		charcoalParams = vm.getCharcoalParams();
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

	function formatCharcoalValue(v: number, def: { format?: (v: number) => string }): string {
		return def.format ? def.format(v) : String(v);
	}
</script>

<div class="fire-category">
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

	<button
		class="toggle-row"
		type="button"
		aria-pressed={useCharcoal}
		onclick={() => vm.setFireUseCharcoal(!useCharcoal)}
	>
		<span>Charcoal</span>
		<span class="toggle-indicator" class:active={useCharcoal}></span>
	</button>

	{#if useCharcoal}
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
					<span class="slider-value">{formatCharcoalValue(charcoalParams[slider.key] as number, slider)}</span>
				</div>
			{/each}
		{/each}
	{/if}
</div>

<style>
	.fire-category {
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

	.group-label {
		font-size: var(--font-size-compact, 12px);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
		margin-top: 4px;
	}

	@media (prefers-reduced-motion: reduce) {
		.toggle-row,
		.toggle-indicator,
		.toggle-indicator::after {
			transition: none;
		}
	}
</style>
