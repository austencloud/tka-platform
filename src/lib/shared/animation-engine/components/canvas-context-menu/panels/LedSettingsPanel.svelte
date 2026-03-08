<script lang="ts">
	import { onDestroy } from "svelte";
	import { getAnimationVisibilityManager } from "../../../state/animation-visibility-state.svelte";
	import { LED_PATTERNS } from "../../../domain/types/LedPatterns";

	const vm = getAnimationVisibilityManager();

	let ledEnabled = $state(vm.isLedEffectEnabled());
	let brightness = $state(vm.getLedBrightness());
	let patternId = $state(vm.getLedPatternId());
	let primaryColor = $state(vm.getLedPrimaryColor());

	function handleVisibilityChange() {
		ledEnabled = vm.isLedEffectEnabled();
		brightness = vm.getLedBrightness();
		patternId = vm.getLedPatternId();
		primaryColor = vm.getLedPrimaryColor();
	}

	vm.registerObserver(handleVisibilityChange);
	onDestroy(() => vm.unregisterObserver(handleVisibilityChange));

	function toggleLed() {
		vm.toggleLedEffect();
	}
</script>

<div class="led-panel-content">
	<button
		class="toggle-row"
		aria-pressed={ledEnabled}
		onclick={toggleLed}
	>
		<span>LED Effect</span>
		<span class="toggle-indicator" class:active={ledEnabled}></span>
	</button>

	{#if ledEnabled}
		<span class="group-label">Brightness</span>
		<div class="preset-row">
			{#each [1, 2, 3, 4, 5] as level}
				<button
					class="preset-btn"
					class:active={brightness === level}
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
					aria-pressed={patternId === pattern.id}
					onclick={() => vm.setLedPatternId(pattern.id)}
				>
					{pattern.name}
				</button>
			{/each}
		</div>

		<span class="group-label">Color</span>
		<div class="color-row">
			<input
				id="ctx-led-color"
				type="color"
				value={primaryColor}
				oninput={(e) => vm.setLedPrimaryColor(e.currentTarget.value)}
			/>
			<span class="color-value">{primaryColor}</span>
		</div>
	{/if}
</div>

<style>
	.led-panel-content {
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

	.color-row {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: var(--min-touch-target, 44px);
	}

	.color-row input[type="color"] {
		width: 44px;
		height: 36px;
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 6px;
		background: transparent;
		cursor: pointer;
		padding: 2px;
	}

	.color-value {
		font-family: var(--font-mono, monospace);
		font-size: var(--font-size-compact, 12px);
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
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
