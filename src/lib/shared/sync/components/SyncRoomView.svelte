<!--
  SyncRoomView.svelte

  The main synchronized view component for multi-device playback.
  Supports three view modes:
  - animation: Shows only the animation canvas
  - grid: Shows only the step grid
  - both: Split view with animation and grid side by side

  Uses deviceSyncState for all playback synchronization.

  Enhanced with:
  - Skeleton loading states
  - Error banner integration
  - Reconnection overlay
  - Smooth state transitions
-->
<script lang="ts">
  import { deviceSyncState } from '../state/device-sync-state.svelte';
  import AnimatorCanvas from '$lib/shared/animation-engine/components/AnimatorCanvas.svelte';
  import AnimationStepGrid from '$lib/shared/animation-engine/components/AnimationStepGrid.svelte';
  import SyncStatusIndicator from './SyncStatusIndicator.svelte';
  import ViewModeSwitcher from './ViewModeSwitcher.svelte';
  import SyncPlaybackControls from './SyncPlaybackControls.svelte';
  import SyncSkeleton from './SyncSkeleton.svelte';
  import SyncErrorBanner from './SyncErrorBanner.svelte';
  import ReconnectionOverlay from './ReconnectionOverlay.svelte';
  import RoomCodeDisplay from './RoomCodeDisplay.svelte';
  import { animationSettings } from '$lib/shared/animation-engine/state/animation-settings-state.svelte';
  import type { SequenceData } from '$lib/shared/foundation/domain/models/SequenceData';

  let {
    onDisconnect,
    onReconnectCancel,
    showRoomCode = false,
  }: {
    onDisconnect?: () => void;
    onReconnectCancel?: () => void;
    /** Show room code display in header (for room hosts) */
    showRoomCode?: boolean;
  } = $props();

  // Reactive state from sync
  const viewMode = $derived(deviceSyncState.viewMode);
  const isConnected = $derived(deviceSyncState.isConnected);
  const roomState = $derived(deviceSyncState.roomState);
  const currentStep = $derived(deviceSyncState.currentStep);
  const isPlaying = $derived(deviceSyncState.isPlaying);
  const roomCode = $derived(deviceSyncState.roomCode);
  const sequenceWord = $derived(deviceSyncState.sequenceWord);
  const connectionStatus = $derived(deviceSyncState.connectionState.status);
  const isReconnecting = $derived(connectionStatus === 'reconnecting');
  const isError = $derived(connectionStatus === 'error');

  // Loading progress tracking
  let loadingProgress = $state(0);
  let loadingText = $state('Connecting...');

  // Extract sequence data from room state
  const sequenceData = $derived(roomState?.sequence.data ?? null);
  const gridMode = $derived(sequenceData?.gridMode);

  // Get step data for the current beat
  const stepData = $derived.by(() => {
    const seq = sequenceData;
    if (!seq) return null;
    if (currentStep < 1) return seq.startPosition ?? null;
    const idx = Math.min(Math.max(0, Math.floor(currentStep) - 1), (seq.steps?.length ?? 1) - 1);
    return seq.steps?.[idx] ?? null;
  });

  const letter = $derived(stepData?.letter ?? null);

  // Trail settings
  const trailSettings = $derived.by(() => {
    const t = animationSettings.trail;
    void t.enabled;
    void t.mode;
    void t.fadeDurationMs;
    void t.lineWidth;
    void t.maxOpacity;
    void t.trackingMode;
    void t.effect;
    return { ...t };
  });

  // Placeholder prop states (can be enhanced to use actual animation state)
  const bluePropState = $derived(null);
  const redPropState = $derived(null);

  function handlePlaybackToggle() {
    if (isPlaying) {
      deviceSyncState.pause();
    } else {
      deviceSyncState.play();
    }
  }

  function handleDisconnect() {
    deviceSyncState.disconnect();
    onDisconnect?.();
  }

  function copyRoomCode() {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode).catch(() => {
        // Fallback: could show a toast
      });
    }
  }

  function handleReconnectCancel(): void {
    deviceSyncState.disconnect();
    onReconnectCancel?.();
  }

  function handleRetryConnection(): void {
    // Trigger reconnection by re-joining the room
    // The coordinator handles this internally
  }

  // Update loading progress based on connection state
  $effect(() => {
    switch (connectionStatus) {
      case 'creating-room':
        loadingText = 'Creating room...';
        loadingProgress = 25;
        break;
      case 'joining-room':
        loadingText = 'Joining room...';
        loadingProgress = 50;
        break;
      case 'waiting-for-peer':
        loadingText = 'Waiting for peers...';
        loadingProgress = 75;
        break;
      case 'connected':
        loadingProgress = 100;
        break;
      default:
        loadingProgress = 0;
    }
  });
</script>

<div
  class="sync-room-view"
  class:split={viewMode === 'both'}
  role="region"
  aria-label="Synchronized playback room"
>
  <!-- Screen reader announcements for connection changes -->
  <div class="visually-hidden" aria-live="polite" aria-atomic="true" role="status">
    {#if isConnected && sequenceData}
      Connected to room {roomCode}. Viewing {sequenceWord}.
    {:else if isReconnecting}
      Attempting to reconnect...
    {:else if isError}
      Connection error occurred.
    {/if}
  </div>

  <!-- Reconnection overlay -->
  <ReconnectionOverlay
    onCancel={handleReconnectCancel}
    onMaxRetriesExceeded={handleDisconnect}
  />

  <!-- Error banner -->
  {#if isError}
    <div class="error-banner-container">
      <SyncErrorBanner
        onRetry={handleRetryConnection}
        onDismiss={handleDisconnect}
      />
    </div>
  {/if}

  {#if !isConnected && !isReconnecting}
    <div class="not-connected" role="status" aria-live="polite">
      <i class="fas fa-unlink" aria-hidden="true"></i>
      <span>Not connected to a sync room</span>
    </div>
  {:else if !sequenceData}
    <div class="loading-state" role="status" aria-live="polite">
      <SyncSkeleton
        variant="room"
        showProgress={true}
        progressText={loadingText}
      />
      <span class="visually-hidden">{loadingText}</span>
    </div>
  {:else}
    <!-- Header with room info and controls -->
    <header class="sync-header" role="banner">
      <div class="header-left">
        <SyncStatusIndicator compact={false} showLatencyAlways={false} />
        <div class="room-info">
          <button
            type="button"
            class="room-code"
            onclick={copyRoomCode}
            aria-label="Copy room code {roomCode} to clipboard"
          >
            {roomCode}
          </button>
          {#if sequenceWord}
            <span class="sequence-word">{sequenceWord}</span>
          {/if}
        </div>
      </div>

      <div class="header-center">
        <ViewModeSwitcher size="compact" />
      </div>

      <div class="header-right">
        <button class="disconnect-btn" onclick={handleDisconnect} aria-label="Disconnect from room">
          <i class="fas fa-sign-out-alt" aria-hidden="true"></i>
          <span class="btn-label">Leave</span>
        </button>
      </div>
    </header>

    <!-- Main content area -->
    <main
      class="sync-content"
      class:animation-only={viewMode === 'animation'}
      class:grid-only={viewMode === 'grid'}
      class:split-view={viewMode === 'both'}
      aria-label="Sequence playback area"
    >
      {#if viewMode === 'animation' || viewMode === 'both'}
        <div
          class="animation-panel"
          onclick={handlePlaybackToggle}
          role="button"
          tabindex="0"
          onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handlePlaybackToggle()}
          aria-label="Animation view - {isPlaying ? 'press to pause' : 'press to play'}"
          aria-pressed={isPlaying}
        >
          <AnimatorCanvas
            blueProp={bluePropState}
            redProp={redPropState}
            gridVisible={true}
            {gridMode}
            {letter}
            {stepData}
            {sequenceData}
            {currentStep}
            {isPlaying}
            word={sequenceWord}
            onPlaybackToggle={handlePlaybackToggle}
            {trailSettings}
            progressBarVariant="minimal"
          />
        </div>
      {/if}

      {#if viewMode === 'grid' || viewMode === 'both'}
        <div
          class="grid-panel"
          onclick={handlePlaybackToggle}
          role="button"
          tabindex="0"
          onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handlePlaybackToggle()}
          aria-label="Step grid view - {isPlaying ? 'press to pause' : 'press to play'}"
          aria-pressed={isPlaying}
        >
          <AnimationStepGrid
            {sequenceData}
            {currentStep}
            {isPlaying}
          />
        </div>
      {/if}
    </main>

    <!-- Footer with playback controls -->
    <footer class="sync-footer" role="toolbar" aria-label="Playback controls">
      <SyncPlaybackControls
        showSpeed={true}
        showLoop={true}
        showStepControls={true}
        compact={viewMode === 'both'}
      />
    </footer>
  {/if}
</div>

<style>
  .sync-room-view {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    color: var(--theme-text, #ffffff);
    overflow: hidden;
  }

  /* Header */
  .sync-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
  }

  .header-left,
  .header-center,
  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .header-left {
    flex: 1;
    min-width: 0;
  }

  .header-center {
    flex: 0 0 auto;
  }

  .header-right {
    flex: 1;
    justify-content: flex-end;
  }

  .room-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .room-code {
    font-family: var(--font-mono, monospace);
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-accent, #8b5cf6);
    cursor: pointer;
    padding: 2px 6px;
    background: rgba(139, 92, 246, 0.1);
    border-radius: 4px;
    transition: background var(--duration-fast, 100ms) ease;
  }

  .room-code:hover {
    background: rgba(139, 92, 246, 0.2);
  }

  .sequence-word {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    text-transform: uppercase;
    letter-spacing: 0.05em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .disconnect-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: 48px;
    padding: 0 16px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    color: rgba(248, 113, 113, 1);
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal, 150ms) ease;
  }

  .disconnect-btn:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.5);
  }

  .disconnect-btn:active {
    transform: scale(0.98);
  }

  /* Main content */
  .sync-content {
    flex: 1;
    display: flex;
    min-height: 0;
    padding: 12px;
    gap: 12px;
  }

  .sync-content.animation-only .animation-panel,
  .sync-content.grid-only .grid-panel {
    flex: 1;
    max-width: 100%;
  }

  .sync-content.split-view {
    flex-direction: row;
  }

  .sync-content.split-view .animation-panel,
  .sync-content.split-view .grid-panel {
    flex: 1;
    min-width: 0;
  }

  .animation-panel,
  .grid-panel {
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    overflow: hidden;
    cursor: pointer;
    transition: border-color var(--duration-fast, 100ms) ease;
  }

  .animation-panel:hover,
  .grid-panel:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .animation-panel:focus-visible,
  .grid-panel:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  /* Footer */
  .sync-footer {
    flex-shrink: 0;
    padding: 0;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  /* Error banner container */
  .error-banner-container {
    position: absolute;
    top: 12px;
    left: 12px;
    right: 12px;
    z-index: 100;
  }

  /* State displays */
  .not-connected,
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    width: 100%;
    height: 100%;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-sm, 14px);
  }

  .not-connected i,
  .loading-state i {
    font-size: 2rem;
    opacity: 0.6;
  }

  /* Mobile responsive */
  @media (max-width: 768px) {
    .sync-header {
      padding: 8px 12px;
      flex-wrap: wrap;
      gap: 8px;
    }

    .header-left {
      order: 1;
      flex: 1;
    }

    .header-right {
      order: 2;
      flex: 0;
    }

    .header-center {
      order: 3;
      width: 100%;
      justify-content: center;
    }

    .btn-label {
      display: none;
    }

    .disconnect-btn {
      padding: 0 12px;
    }

    .sync-content {
      padding: 8px;
      gap: 8px;
    }

    .sync-content.split-view {
      flex-direction: column;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .room-code,
    .disconnect-btn,
    .animation-panel,
    .grid-panel {
      transition: none;
    }
  }

  /* Visually hidden for screen readers */
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .sync-room-view {
      border: 2px solid var(--theme-text, #ffffff);
    }

    .sync-header,
    .sync-footer {
      border-width: 2px;
    }

    .animation-panel:focus-visible,
    .grid-panel:focus-visible {
      outline-width: 3px;
    }

    .disconnect-btn {
      border-width: 2px;
    }

    .room-code {
      border: 2px solid var(--theme-accent, #8b5cf6);
    }
  }
</style>
