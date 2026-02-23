<!--
  SessionViewer.svelte

  Full-screen overlay for viewing a synced sequence.
  Features:
  - Display preference (animation/pictograph/split)
  - Synced playback controls
  - Solo mode toggle
  - Participant count
-->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { connectState } from '../../state/connect-state.svelte';
	import { container } from '$lib/shared/di';
	import { lanSyncState } from '$lib/shared/lan-sync/state/lan-sync-state.svelte';
	import type { DisplayPreference, SyncSession } from '../../domain/models/connect-models';
	import type { SequenceData } from '$lib/shared/foundation/domain/models/SequenceData';
	import SessionControls from './SessionControls.svelte';
	import SyncToggle from './SyncToggle.svelte';
	import ParticipantsList from './ParticipantsList.svelte';
	import DisplayPreferenceSelector from './DisplayPreferenceSelector.svelte';
	import ProgressRing from '$lib/shared/components/loading/ProgressRing.svelte';

	// Lazy load heavy components
	import AnimationPlayer from '$lib/shared/sequence-viewer/components/AnimationPlayer.svelte';
	import LayeredSequencePreview from '$lib/shared/sequence-viewer/components/LayeredSequencePreview.svelte';

	interface Props {
		session: SyncSession;
		onClose: () => void;
	}

	let { session, onClose }: Props = $props();

	// State
	let sequence = $state<SequenceData | null>(null);
	let isLoading = $state(true);
	let loadError = $state<string | null>(null);
	let showParticipants = $state(false);

	// Derived from connectState
	const displayPreference = $derived(connectState.displayPreference);
	const isSoloMode = $derived(connectState.isSoloMode);
	const participants = $derived(connectState.participants);
	const isHost = $derived(connectState.isHost);

	// Synced playback state from lanSyncState
	const playbackState = $derived(lanSyncState.playbackState);
	const currentBeat = $derived(playbackState.currentStep);
	const isPlaying = $derived(playbackState.isPlaying);
	const playbackSpeed = $derived(playbackState.speed);

	// Load sequence data
	onMount(async () => {
		try {
			const browseLoader = container.items.browseLoader;
			const loadedSequence = await browseLoader.loadSequenceById(session.sequenceId);

			if (loadedSequence) {
				sequence = loadedSequence;
			} else {
				loadError = 'Sequence not found';
			}
		} catch (error) {
			console.error('[SessionViewer] Failed to load sequence:', error);
			loadError = error instanceof Error ? error.message : 'Failed to load sequence';
		} finally {
			isLoading = false;
		}
	});

	// Keyboard shortcuts
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onClose();
		}
	}

	// Display preference change
	async function handleDisplayChange(pref: DisplayPreference) {
		await connectState.setDisplayPreference(pref);
	}

	// Solo mode toggle
	async function handleSoloToggle() {
		await connectState.toggleSoloMode();
	}

	// Playback controls (only affect sync when not in solo mode)
	function handlePlay() {
		if (!isSoloMode) {
			lanSyncState.updatePlayback({ isPlaying: true });
		}
	}

	function handlePause() {
		if (!isSoloMode) {
			lanSyncState.updatePlayback({ isPlaying: false });
		}
	}

	function handleSeek(beat: number) {
		if (!isSoloMode) {
			lanSyncState.updatePlayback({ currentStep: beat });
		}
	}

	function handlePrevious() {
		if (!isSoloMode && currentBeat > 0) {
			lanSyncState.updatePlayback({ currentStep: currentBeat - 1, isPlaying: false });
		}
	}

	function handleNext() {
		const maxBeat = sequence?.steps?.length ?? 0;
		if (!isSoloMode && currentBeat < maxBeat) {
			lanSyncState.updatePlayback({ currentStep: currentBeat + 1, isPlaying: false });
		}
	}

	function handleFirst() {
		if (!isSoloMode) {
			lanSyncState.updatePlayback({ currentStep: 0, isPlaying: false });
		}
	}

	function handleLast() {
		const maxBeat = sequence?.steps?.length ?? 0;
		if (!isSoloMode) {
			lanSyncState.updatePlayback({ currentStep: maxBeat, isPlaying: false });
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="session-viewer-overlay" transition:fade={{ duration: 200 }}>
	<div class="session-viewer" transition:fly={{ y: 50, duration: 300 }}>
		<!-- Header -->
		<header class="viewer-header">
			<button class="back-button" onclick={onClose} aria-label="Leave session">
				<i class="fas fa-arrow-left" aria-hidden="true"></i>
			</button>

			<div class="header-info">
				<h1 class="sequence-word">"{session.sequenceWord}"</h1>
				<button
					class="participants-badge"
					onclick={() => (showParticipants = !showParticipants)}
					aria-expanded={showParticipants}
				>
					<i class="fas fa-users" aria-hidden="true"></i>
					<span>{participants.length} synced</span>
				</button>
			</div>

			<div class="header-actions">
				<DisplayPreferenceSelector
					value={displayPreference}
					onChange={handleDisplayChange}
				/>

				<button class="leave-button" onclick={onClose}>
					Leave
				</button>
			</div>
		</header>

		<!-- Participants dropdown -->
		{#if showParticipants}
			<div class="participants-dropdown" transition:fly={{ y: -10, duration: 150 }}>
				<ParticipantsList {participants} hostUserId={session.hostUserId} />
			</div>
		{/if}

		<!-- Main content area -->
		<main class="viewer-content">
			{#if isLoading}
				<div class="loading-state">
					<ProgressRing percent={-1} size={32} strokeWidth={3} />
					<p>Loading sequence...</p>
				</div>
			{:else if loadError}
				<div class="error-state">
					<i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
					<p>{loadError}</p>
				</div>
			{:else if sequence}
				<div class="display-area">
					{#if displayPreference === 'animation'}
						<div class="animation-container">
							<AnimationPlayer
								{sequence}
								autoPlay={false}
								showControls={false}
								layout="vertical"
							/>
						</div>
					{:else if displayPreference === 'pictograph'}
						<div class="pictograph-container">
							<LayeredSequencePreview
								{sequence}
								showStepNumbers={true}
								showDifficultyLevel={false}
								includeStartPosition={true}
								darkMode={true}
							/>
						</div>
					{:else if displayPreference === 'split'}
						<div class="split-container">
							<div class="split-left">
								<AnimationPlayer
									{sequence}
									autoPlay={false}
									showControls={false}
									layout="vertical"
								/>
							</div>
							<div class="split-right">
								<LayeredSequencePreview
									{sequence}
									showStepNumbers={true}
									showDifficultyLevel={false}
									includeStartPosition={true}
									darkMode={true}
								/>
							</div>
						</div>
					{/if}
				</div>

				<!-- Beat indicator -->
				<div class="beat-indicator">
					Beat {currentBeat} of {sequence.steps?.length ?? 0}
				</div>
			{/if}
		</main>

		<!-- Footer with controls -->
		<footer class="viewer-footer">
			<SessionControls
				{isPlaying}
				{currentBeat}
				maxBeat={sequence?.steps?.length ?? 0}
				disabled={isSoloMode}
				onPlay={handlePlay}
				onPause={handlePause}
				onPrevious={handlePrevious}
				onNext={handleNext}
				onFirst={handleFirst}
				onLast={handleLast}
				onSeek={handleSeek}
			/>

			<SyncToggle isSolo={isSoloMode} onToggle={handleSoloToggle} />
		</footer>
	</div>
</div>

<style>
	.session-viewer-overlay {
		position: fixed;
		inset: 0;
		z-index: 1000;
		background: rgba(0, 0, 0, 0.9);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.session-viewer {
		width: 100%;
		height: 100%;
		max-width: 100vw;
		max-height: 100vh;
		display: flex;
		flex-direction: column;
		background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
		color: var(--theme-text, #ffffff);
	}

	/* Header */
	.viewer-header {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 12px 16px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		flex-shrink: 0;
	}

	.back-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		background: none;
		border: none;
		color: var(--theme-text, white);
		cursor: pointer;
		border-radius: 8px;
		transition: background 0.15s ease;
	}

	.back-button:hover {
		background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
	}

	.header-info {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
	}

	.sequence-word {
		font-size: var(--font-size-lg, 18px);
		font-weight: 600;
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--theme-accent, #6366f1);
	}

	.participants-badge {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 20px;
		color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
		font-size: var(--font-size-compact, 12px);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.participants-badge:hover {
		background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
		color: var(--theme-text, white);
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.leave-button {
		padding: 8px 16px;
		background: rgba(239, 68, 68, 0.2);
		border: 1px solid rgba(239, 68, 68, 0.3);
		border-radius: 8px;
		color: var(--semantic-error, #ef4444);
		font-weight: 600;
		font-size: var(--font-size-compact, 12px);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.leave-button:hover {
		background: rgba(239, 68, 68, 0.3);
	}

	/* Participants dropdown */
	.participants-dropdown {
		position: absolute;
		top: 64px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 10;
		background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 12px;
		padding: 12px;
		min-width: 200px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
	}

	/* Main content */
	.viewer-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 16px;
		min-height: 0;
		overflow: hidden;
		position: relative;
	}

	.loading-state,
	.error-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 16px;
		text-align: center;
	}

	.error-state i {
		font-size: 48px;
		color: var(--semantic-error, #ef4444);
	}

	.display-area {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.animation-container,
	.pictograph-container {
		width: 100%;
		height: 100%;
		max-width: 600px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.split-container {
		width: 100%;
		height: 100%;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
	}

	.split-left,
	.split-right {
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}

	.beat-indicator {
		position: absolute;
		bottom: 16px;
		left: 50%;
		transform: translateX(-50%);
		padding: 8px 16px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		border-radius: 20px;
		font-size: var(--font-size-sm, 14px);
		color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
	}

	/* Footer */
	.viewer-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 16px;
		background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
		border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
		flex-shrink: 0;
	}

	/* Mobile */
	@media (max-width: 600px) {
		.viewer-header {
			padding: 8px 12px;
		}

		.sequence-word {
			font-size: var(--font-size-base, 16px);
		}

		.header-actions {
			gap: 8px;
		}

		.leave-button {
			padding: 6px 12px;
		}

		.split-container {
			grid-template-columns: 1fr;
			grid-template-rows: 1fr 1fr;
		}

		.viewer-footer {
			flex-direction: column;
			gap: 12px;
		}
	}

</style>
