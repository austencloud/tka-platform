<script lang="ts">
	import type { ContentType, ViewerMode } from '../state/viewer-state.svelte';
	import { viewerModeOptions, PRACTICE_OPTION } from '../services/viewer-modes';
	import NavButton from '$lib/shared/navigation/components/buttons/NavButton.svelte';

	interface Props {
		activeMode: ViewerMode;
		webgl2Available?: boolean;
		practiceActive?: boolean;
		onSelectMode: (mode: ContentType) => void;
		onSelectSplit: () => void;
		onPracticeToggle?: () => void;
	}

	let {
		activeMode,
		webgl2Available = true,
		practiceActive = false,
		onSelectMode,
		onSelectSplit,
		onPracticeToggle
	}: Props = $props();

	const modes = $derived(viewerModeOptions(webgl2Available));

	function selectMode(id: ViewerMode) {
		if (id === 'split') onSelectSplit();
		else onSelectMode(id as ContentType);
	}
</script>

<nav class="viewer-bottom-bar" aria-label="View switcher">
	{#each modes as mode (mode.id)}
		<NavButton
			icon={`<i class="fas ${mode.icon}"></i>`}
			label={mode.label}
			ariaLabel={mode.label}
			active={activeMode === mode.id}
			onClick={() => selectMode(mode.id)}
		/>
	{/each}
	{#if onPracticeToggle}
		<NavButton
			icon={`<i class="fas ${practiceActive ? 'fa-stop' : PRACTICE_OPTION.icon}"></i>`}
			label={practiceActive ? 'Stop' : PRACTICE_OPTION.label}
			ariaLabel={practiceActive ? 'Stop practice' : 'Practice'}
			active={practiceActive}
			onClick={onPracticeToggle}
		/>
	{/if}
</nav>

<style>
	.viewer-bottom-bar {
		display: flex;
		flex-direction: row;
		align-items: stretch;
		justify-content: space-around;
		gap: var(--spacing-xs, 4px);
		width: 100%;
		flex-shrink: 0;
		padding: 4px 6px;
		padding-bottom: calc(4px + env(safe-area-inset-bottom));
		background: var(--theme-panel-bg, #0a0a14);
		border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));

		/* Mirror BottomNavigation: container queries drive NavButton label visibility */
		container-type: inline-size;
		container-name: viewer-bottom-bar;
	}

	.viewer-bottom-bar :global(.nav-button) {
		flex: 1 1 0%;
		min-height: var(--min-touch-target, 44px);
	}

	/* Full labels (520px+) */
	@container viewer-bottom-bar (min-width: 520px) {
		.viewer-bottom-bar :global(.nav-label-full) {
			display: block;
		}
	}

	/* Compact labels (400-519px) */
	@container viewer-bottom-bar (min-width: 400px) and (max-width: 519px) {
		.viewer-bottom-bar :global(.nav-label-compact) {
			display: block;
		}
	}

	/* <400px: icons only (NavButton default — labels stay hidden) */

	/* Fallback where container queries are unsupported */
	@supports not (container-type: inline-size) {
		@media (min-width: 520px) {
			.viewer-bottom-bar :global(.nav-label-full) {
				display: block;
			}
		}
		@media (min-width: 400px) and (max-width: 519px) {
			.viewer-bottom-bar :global(.nav-label-compact) {
				display: block;
			}
		}
	}
</style>
