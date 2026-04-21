<script lang="ts">
	import { onDestroy } from "svelte";
	import { getAnimationVisibilityManager } from "../../state/animation-visibility-state.svelte";
	import type { PlaybackMode } from "../../state/animation-visibility-state.svelte";

	const vm = getAnimationVisibilityManager();

	let playbackMode = $state(vm.getPlaybackMode());

	function handleVisibilityChange(): void {
		playbackMode = vm.getPlaybackMode();
	}

	vm.registerObserver(handleVisibilityChange);
	onDestroy(() => vm.unregisterObserver(handleVisibilityChange));

	const modes: { id: PlaybackMode; label: string }[] = [
		{ id: "continuous", label: "Continuous" },
		{ id: "step", label: "Step" },
	];
</script>

<div class="playback-category">
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
</div>

<style>
	.playback-category {
		display: flex;
		flex-direction: column;
		gap: 8px;
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

	@media (prefers-reduced-motion: reduce) {
		.preset-btn {
			transition: none;
		}
	}
</style>
