<script lang="ts">
	import { onDestroy } from "svelte";
	import { getAnimationVisibilityManager } from "../../../state/animation-visibility-state.svelte";
	import { LED_PATTERNS } from "../../../domain/types/LedPatterns";

	const vm = getAnimationVisibilityManager();

	let brightness = $state(vm.getLedBrightness());
	let patternId = $state(vm.getLedPatternId());
	let primaryColor = $state(vm.getLedPrimaryColor());

	function handleVisibilityChange(): void {
		brightness = vm.getLedBrightness();
		patternId = vm.getLedPatternId();
		primaryColor = vm.getLedPrimaryColor();
	}

	vm.registerObserver(handleVisibilityChange);
	onDestroy(() => vm.unregisterObserver(handleVisibilityChange));
</script>

<div class="led-category">
	<span class="group-label">Brightness</span>
	<div class="preset-row">
		{#each [1, 2, 3, 4, 5] as level}
			<button
				class="preset-btn"
				class:active={brightness === level}
				type="button"
				aria-pressed={brightness === level}
				onclick={() => vm.setLedBrightness(level)}
			>
				{level}
			</button>
		{/each}
	</div>

	<span class="group-label">Pattern</span>
	<div class="preset-row">
		{#each LED_PATTERNS as pattern}
			<button
				class="preset-btn"
				class:active={patternId === pattern.id}
				type="button"
				aria-pressed={patternId === pattern.id}
				onclick={() => vm.setLedPatternId(pattern.id)}
			>
				{pattern.name}
			</button>
		{/each}
	</div>

	<span class="group-label">Color</span>
	<div class="color-row">
		<label for="ctx-led-color">Primary</label>
		<input
			id="ctx-led-color"
			type="color"
			value={primaryColor}
			oninput={(e) => vm.setLedPrimaryColor((e.target as HTMLInputElement).value)}
		/>
	</div>
</div>

<style>
	.led-category {
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

	.preset-btn:focus-visible {
		outline: 2px solid var(--theme-accent, #8b5cf6);
		outline-offset: 2px;
	}

	.color-row {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: var(--min-touch-target, 44px);
	}

	.color-row label {
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
	}

	.color-row input[type="color"] {
		width: 44px;
		height: 32px;
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 6px;
		background: transparent;
		cursor: pointer;
	}

	@media (prefers-reduced-motion: reduce) {
		.preset-btn {
			transition: none;
		}
	}
</style>
