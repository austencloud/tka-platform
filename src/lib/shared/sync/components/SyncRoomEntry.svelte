<!--
  SyncRoomEntry.svelte

  Entry point for the device sync feature.
  Allows users to either:
  1. Start syncing a sequence (creates a room)
  2. Join an existing room by code
-->
<script lang="ts">
  import { deviceSyncState, getConnectionStatusText } from '../state/device-sync-state.svelte';
  import SyncStatusIndicator from './SyncStatusIndicator.svelte';
  import type { SequenceData } from '$lib/shared/foundation/domain/models/SequenceData';
  import ProgressRing from '$lib/shared/components/loading/ProgressRing.svelte';

  let {
    sequence = null,
    displayName = 'User',
    onRoomJoined,
    onError,
  }: {
    /** Sequence to sync (if starting a new room) */
    sequence?: SequenceData | null;
    /** Display name for this device */
    displayName?: string;
    /** Called when successfully joined/created a room */
    onRoomJoined?: (roomCode: string) => void;
    /** Called on error */
    onError?: (error: string) => void;
  } = $props();

  let mode = $state<'choose' | 'create' | 'join'>('choose');
  let roomCodeInput = $state('');
  let isLoading = $state(false);
  let errorMessage = $state<string | null>(null);

  const connectionStatus = $derived(deviceSyncState.connectionState.status);
  const isConnecting = $derived(
    connectionStatus === 'creating-room' ||
    connectionStatus === 'joining-room' ||
    connectionStatus === 'waiting-for-peer'
  );

  async function handleStartSync() {
    if (!sequence) {
      errorMessage = 'No sequence selected';
      return;
    }

    isLoading = true;
    errorMessage = null;

    try {
      const roomCode = await deviceSyncState.sync(sequence, displayName);
      onRoomJoined?.(roomCode);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to start sync';
      errorMessage = msg;
      onError?.(msg);
    } finally {
      isLoading = false;
    }
  }

  async function handleJoinRoom() {
    const code = roomCodeInput.trim().toUpperCase();
    if (!code) {
      errorMessage = 'Please enter a room code';
      return;
    }

    if (code.length < 4) {
      errorMessage = 'Room code must be at least 4 characters';
      return;
    }

    isLoading = true;
    errorMessage = null;

    try {
      await deviceSyncState.joinRoom(code, displayName);
      onRoomJoined?.(code);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to join room';
      errorMessage = msg;
      onError?.(msg);
    } finally {
      isLoading = false;
    }
  }

  function handleBack() {
    mode = 'choose';
    errorMessage = null;
    roomCodeInput = '';
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && mode === 'join') {
      handleJoinRoom();
    }
  }
</script>

<div class="sync-entry">
  {#if mode === 'choose'}
    <div class="entry-content">
      <div class="entry-header">
        <i class="fas fa-sync-alt" aria-hidden="true"></i>
        <h2>Multi-Device Sync</h2>
        <p>Sync playback across multiple devices in real-time</p>
      </div>

      <div class="entry-options">
        {#if sequence}
          <button class="option-btn primary" onclick={() => { mode = 'create'; handleStartSync(); }} disabled={isConnecting || isLoading}>
            <i class="fas fa-broadcast-tower" aria-hidden="true"></i>
            <span class="option-title">Start Sync</span>
            <span class="option-desc">Share this sequence with other devices</span>
          </button>
        {/if}

        <button class="option-btn" onclick={() => mode = 'join'} disabled={isConnecting || isLoading}>
          <i class="fas fa-sign-in-alt" aria-hidden="true"></i>
          <span class="option-title">Join Room</span>
          <span class="option-desc">Enter a room code to join</span>
        </button>
      </div>

      {#if isConnecting}
        <div class="status-indicator">
          <SyncStatusIndicator compact={false} />
        </div>
      {/if}
    </div>

  {:else if mode === 'create'}
    <div class="entry-content">
      <div class="entry-header compact">
        <i class="fas fa-broadcast-tower" aria-hidden="true"></i>
        <h3>Creating Room...</h3>
      </div>

      <div class="status-indicator">
        <SyncStatusIndicator compact={false} />
      </div>

      {#if errorMessage}
        <div class="error-message">
          <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
          <span>{errorMessage}</span>
        </div>
      {/if}

      <button class="back-btn" onclick={handleBack}>
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
        Back
      </button>
    </div>

  {:else if mode === 'join'}
    <div class="entry-content">
      <div class="entry-header compact">
        <i class="fas fa-sign-in-alt" aria-hidden="true"></i>
        <h3>Join Room</h3>
      </div>

      <div class="join-form">
        <label for="room-code-input" class="input-label">Room Code</label>
        <input
          id="room-code-input"
          type="text"
          class="room-code-input"
          bind:value={roomCodeInput}
          onkeydown={handleKeyDown}
          placeholder="Enter code..."
          maxlength="10"
          autocapitalize="characters"
          autocomplete="off"
          disabled={isLoading || isConnecting}
        />

        <button
          class="join-btn"
          onclick={handleJoinRoom}
          disabled={!roomCodeInput.trim() || isLoading || isConnecting}
        >
          {#if isLoading || isConnecting}
            <ProgressRing percent={-1} size={24} strokeWidth={2} />
            Joining...
          {:else}
            <i class="fas fa-sign-in-alt" aria-hidden="true"></i>
            Join
          {/if}
        </button>
      </div>

      {#if errorMessage}
        <div class="error-message">
          <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
          <span>{errorMessage}</span>
        </div>
      {/if}

      <button class="back-btn" onclick={handleBack} disabled={isLoading || isConnecting}>
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
        Back
      </button>
    </div>
  {/if}
</div>

<style>
  .sync-entry {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding: 24px;
    box-sizing: border-box;
  }

  .entry-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
    max-width: 400px;
    width: 100%;
  }

  .entry-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 8px;
  }

  .entry-header i {
    font-size: 2.5rem;
    color: var(--theme-accent, #8b5cf6);
    margin-bottom: 8px;
  }

  .entry-header h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .entry-header h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .entry-header p {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .entry-header.compact {
    gap: 4px;
  }

  .entry-header.compact i {
    font-size: 1.5rem;
    margin-bottom: 4px;
  }

  /* Options */
  .entry-options {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
  }

  .option-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 20px 16px;
    min-height: 80px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    color: var(--theme-text, #ffffff);
    cursor: pointer;
    transition: all var(--duration-normal, 150ms) ease;
  }

  .option-btn:hover:not(:disabled) {
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .option-btn:active:not(:disabled) {
    transform: scale(0.98);
  }

  .option-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .option-btn.primary {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-color: var(--theme-accent, #8b5cf6);
  }

  .option-btn.primary:hover:not(:disabled) {
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-color: var(--theme-accent, #8b5cf6);
  }

  .option-btn i {
    font-size: 1.5rem;
    color: var(--theme-accent, #8b5cf6);
  }

  .option-title {
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
  }

  .option-desc {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  /* Join form */
  .join-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
  }

  .input-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .room-code-input {
    width: 100%;
    padding: 16px;
    font-size: 1.5rem;
    font-family: var(--font-mono, monospace);
    font-weight: 600;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text, #ffffff);
    transition: border-color var(--duration-fast, 100ms) ease;
    box-sizing: border-box;
  }

  .room-code-input:focus {
    outline: none;
    border-color: var(--theme-accent, #8b5cf6);
  }

  .room-code-input::placeholder {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.3));
    text-transform: none;
    letter-spacing: normal;
  }

  .room-code-input:disabled {
    opacity: 0.5;
  }

  .join-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 16px;
    min-height: 56px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-accent, #8b5cf6);
    border-radius: 8px;
    color: var(--theme-accent, #8b5cf6);
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal, 150ms) ease;
  }

  .join-btn:hover:not(:disabled) {
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-color: var(--theme-accent, #8b5cf6);
  }

  .join-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Back button */
  .back-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    min-height: var(--min-touch-target);
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    transition: all var(--duration-normal, 150ms) ease;
  }

  .back-btn:hover:not(:disabled) {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #ffffff);
  }

  .back-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Status and error */
  .status-indicator {
    padding: 12px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 8px;
    width: 100%;
    display: flex;
    justify-content: center;
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    color: var(--semantic-error, rgba(248, 113, 113, 1));
    font-size: var(--font-size-sm, 14px);
    width: 100%;
  }

  /* Responsive */
  @media (max-width: 480px) {
    .sync-entry {
      padding: 16px;
    }

    .entry-header h2 {
      font-size: 1.25rem;
    }

    .room-code-input {
      font-size: 1.25rem;
      padding: 14px;
    }
  }

</style>
