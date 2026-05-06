<script lang="ts">
	import type { ContentType } from '../state/viewer-state.svelte';

	interface Props {
		activeMode: ContentType;
		videoCount?: number;
		onBack: () => void;
		onSelectMode: (mode: ContentType) => void;
	}

	let { activeMode, videoCount = 0, onBack, onSelectMode }: Props = $props();

	const modes: { id: ContentType; icon: string; label: string }[] = [
		{ id: 'animation', icon: 'fa-play', label: 'Animation' },
		{ id: 'card', icon: 'fa-grip', label: 'Card' },
		{ id: 'videos', icon: 'fa-video', label: 'Videos' }
	];

	let navEl: HTMLElement | undefined = $state();

	function focusAt(index: number) {
		const buttons = navEl?.querySelectorAll<HTMLButtonElement>('.rail-mode-btn');
		buttons?.[index]?.focus();
	}

	function handleKeydown(e: KeyboardEvent, index: number) {
		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				focusAt(Math.min(index + 1, modes.length - 1));
				break;
			case 'ArrowUp':
				e.preventDefault();
				focusAt(Math.max(index - 1, 0));
				break;
			case 'Home':
				e.preventDefault();
				focusAt(0);
				break;
			case 'End':
				e.preventDefault();
				focusAt(modes.length - 1);
				break;
		}
	}
</script>

<nav class="content-rail" role="group" aria-label="Content switcher" bind:this={navEl}>
	<button type="button" class="rail-back-btn" onclick={onBack} aria-label="Back to split view">
		<i class="fas fa-chevron-left" aria-hidden="true"></i>
		<span class="rail-back-label">Back</span>
	</button>

	<div class="rail-modes">
		{#each modes as mode, i (mode.id)}
			<button
				type="button"
				class="rail-mode-btn"
				class:active={activeMode === mode.id}
				aria-pressed={activeMode === mode.id}
				aria-label={mode.label}
				onclick={() => onSelectMode(mode.id)}
				onkeydown={(e) => handleKeydown(e, i)}
			>
				<i class="fas {mode.icon}" aria-hidden="true"></i>
				<span class="rail-mode-label">{mode.label}</span>
				{#if mode.id === 'videos' && videoCount > 0}
					<span class="rail-badge">{videoCount}</span>
				{/if}
			</button>
		{/each}
	</div>
</nav>

<style>
	.content-rail {
		display: flex;
		flex-direction: column;
		background: var(--theme-panel-bg, #0a0a14);
		border-right: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
		overflow: hidden;
	}

	.rail-back-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 16px 8px;
		background: none;
		border: none;
		border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
		cursor: pointer;
		transition:
			background 120ms cubic-bezier(0.2, 0, 0, 1),
			color 120ms cubic-bezier(0.2, 0, 0, 1);
	}

	.rail-back-btn:hover {
		background: color-mix(in srgb, var(--theme-panel-bg, #0a0a14) 85%, white);
		color: var(--theme-text, #ffffff);
	}

	.rail-back-btn:focus-visible {
		outline: 2px solid var(--theme-accent, #f43f5e);
		outline-offset: -2px;
	}

	.rail-back-btn i {
		font-size: 18px;
	}

	.rail-back-label {
		font-size: var(--font-size-xs, 11px);
		font-weight: 500;
		letter-spacing: 0.03em;
	}

	.rail-modes {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.rail-mode-btn {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		background: none;
		border: none;
		border-left: 3px solid transparent;
		color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
		cursor: pointer;
		position: relative;
		transition:
			background 120ms cubic-bezier(0.2, 0, 0, 1),
			color 120ms cubic-bezier(0.2, 0, 0, 1),
			border-color 120ms cubic-bezier(0.2, 0, 0, 1);
	}

	.rail-mode-btn:hover:not(.active) {
		background: rgba(255, 255, 255, 0.04);
		color: var(--theme-text, rgba(255, 255, 255, 0.8));
	}

	.rail-mode-btn.active {
		background: color-mix(in srgb, var(--theme-accent, #6366f1) 12%, transparent);
		border-left-color: var(--theme-accent, #6366f1);
		color: var(--theme-text, #ffffff);
	}

	.rail-mode-btn:focus-visible {
		outline: 2px solid var(--theme-accent, #6366f1);
		outline-offset: -2px;
	}

	.rail-mode-btn i {
		font-size: 20px;
	}

	.rail-mode-label {
		font-size: var(--font-size-xs, 11px);
		font-weight: 500;
		letter-spacing: 0.02em;
	}

	.rail-badge {
		position: absolute;
		top: 12px;
		right: 12px;
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		border-radius: 9px;
		background: var(--theme-accent, #6366f1);
		color: white;
		font-size: 10px;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
	}

	@media (prefers-reduced-motion: reduce) {
		.rail-back-btn,
		.rail-mode-btn {
			transition: none;
		}
	}
</style>
