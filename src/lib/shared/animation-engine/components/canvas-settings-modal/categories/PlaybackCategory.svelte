<script lang="ts">
	import { onDestroy } from "svelte";
	import { getAnimationVisibilityManager } from "../../../state/animation-visibility-state.svelte";
	import type { PlaybackMode } from "../../../state/animation-visibility-state.svelte";

	const vm = getAnimationVisibilityManager();

	let playbackMode = $state(vm.getPlaybackMode());
	let speed = $state(vm.getSpeed());

	function handleVisibilityChange(): void {
		playbackMode = vm.getPlaybackMode();
		speed = vm.getSpeed();
	}

	vm.registerObserver(handleVisibilityChange);
	onDestroy(() => vm.unregisterObserver(handleVisibilityChange));

	let derivedBpm = $derived(Math.round(speed * 60));

	const modes: { id: PlaybackMode; label: string }[] = [
		{ id: "continuous", label: "Continuous" },
		{ id: "step", label: "Step" },
	];

	const bpmPresets = [30, 60, 90, 120];
</script>

<div class="playback-category">
	<span class="group-label">Mode</span>
	<div class="preset-row">
		{#each modes as mode}
			<button
				class="preset-btn"
				class:active={playbackMode === mode.id}
				type="button"
				aria-pressed={playbackMode === mode.id}
				onclick={() => vm.setPlaybackMode(mode.id)}
			>
				{mode.label}
			</button>
		{/each}
	</div>

	<span class="group-label">Speed</span>
	<div class="slider-row">
		<label for="ctx-playback-speed">Speed</label>
		<input
			id="ctx-playback-speed"
			type="range"
			min="0.1"
			max="3.0"
			step="0.1"
			value={speed}
			oninput={(e) => vm.setSpeed(Number((e.target as HTMLInputElement).value))}
		/>
		<span class="slider-value">{derivedBpm} BPM</span>
	</div>

	<div class="preset-row">
		{#each bpmPresets as bpm}
			<button
				class="preset-btn"
				class:active={derivedBpm === bpm}
				type="button"
				aria-pressed={derivedBpm === bpm}
				onclick={() => vm.setBpm(bpm)}
			>
				{bpm}
			</button>
		{/each}
	</div>
</div>

<style>
	.playback-category {
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

	@media (prefers-reduced-motion: reduce) {
		.preset-btn {
			transition: none;
		}
	}
</style>
