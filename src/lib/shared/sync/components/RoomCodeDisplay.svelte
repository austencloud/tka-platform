<!--
  RoomCodeDisplay.svelte

  Displays the room code in a large, readable format with sharing options.
  Features:
  - Large monospace room code
  - Copy to clipboard button
  - QR code option for easy mobile scanning
  - Web Share API integration with clipboard fallback

  Accessibility:
  - All buttons have 48px minimum touch targets
  - Proper ARIA labels
  - Keyboard accessible
  - Screen reader announcements for copy/share actions
-->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { deviceSyncState } from '../state/device-sync-state.svelte';
  import { container } from '$lib/shared/di';
  import ProgressRing from '$lib/shared/components/loading/ProgressRing.svelte';

  interface Props {
    /** Override room code (otherwise uses deviceSyncState) */
    roomCode?: string | null;
    /** Show QR code section */
    showQR?: boolean;
    /** Size variant */
    size?: 'compact' | 'normal' | 'large';
    /** Callback when code is copied */
    onCopy?: () => void;
    /** Callback when share is triggered */
    onShare?: () => void;
  }

  let {
    roomCode: roomCodeProp = null,
    showQR = true,
    size = 'normal',
    onCopy,
    onShare,
  }: Props = $props();

  // Internal state
  let copied = $state(false);
  let shared = $state(false);
  let qrDataUrl = $state<string | null>(null);
  let qrLoading = $state(false);
  let qrError = $state<string | null>(null);
  let resetTimers: number[] = [];

  function scheduleReset(fn: () => void, delay: number): void {
    const timer = window.setTimeout(fn, delay);
    resetTimers.push(timer);
  }

  function clearResetTimers(): void {
    for (const timer of resetTimers) {
      clearTimeout(timer);
    }
    resetTimers = [];
  }

  onDestroy(clearResetTimers);

  // Get room code from props or state
  const effectiveRoomCode = $derived(roomCodeProp ?? deviceSyncState.roomCode);

  // Check if Web Share API is available
  const canShare = $derived(typeof navigator !== 'undefined' && !!navigator.share);

  // Generate QR code when room code changes
  $effect(() => {
    if (showQR && effectiveRoomCode) {
      generateQRCode(effectiveRoomCode);
    } else {
      qrDataUrl = null;
    }
  });

  async function generateQRCode(code: string): Promise<void> {
    qrLoading = true;
    qrError = null;

    try {
      const qrGenerator = container.items.qrCodeGenerator;
      const joinUrl = `${window.location.origin}/sync/join/${code}`;
      const result = await qrGenerator.generateForUrl(joinUrl, {
        size: 200,
        margin: 2,
        style: 'modern',
      });
      qrDataUrl = result.dataUrl;
    } catch (error) {
      console.error('Failed to generate QR code:', error);
      qrError = 'Failed to generate QR code';
    } finally {
      qrLoading = false;
    }
  }

  async function handleCopy(): Promise<void> {
    if (!effectiveRoomCode) return;

    try {
      await navigator.clipboard.writeText(effectiveRoomCode);
      copied = true;
      onCopy?.();

      scheduleReset(() => { copied = false; }, 2000);
    } catch (error) {
      console.error('Failed to copy room code:', error);
    }
  }

  async function handleShare(): Promise<void> {
    if (!effectiveRoomCode) return;

    const shareData = {
      title: 'Join TKA Sync Room',
      text: `Join my TKA sync room with code: ${effectiveRoomCode}`,
      url: `${window.location.origin}/sync/join/${effectiveRoomCode}`,
    };

    try {
      if (canShare) {
        await navigator.share(shareData);
        shared = true;
        onShare?.();
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(shareData.url);
        copied = true;
        onCopy?.();
      }

      scheduleReset(() => { shared = false; copied = false; }, 2000);
    } catch (error) {
      // User cancelled or share failed
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Share failed:', error);
      }
    }
  }
</script>

{#if effectiveRoomCode}
  <div class="room-code-display" class:compact={size === 'compact'} class:large={size === 'large'}>
    <!-- Room code section -->
    <div class="code-section">
      <div class="code-label" id="room-code-label">Room Code</div>

      <div
        class="code-value"
        role="status"
        aria-labelledby="room-code-label"
        aria-describedby="room-code-hint"
        aria-live="polite"
      >
        {effectiveRoomCode}
      </div>

      <span id="room-code-hint" class="visually-hidden">
        Share this code with others to let them join your sync room
      </span>
    </div>

    <!-- Action buttons -->
    <div class="actions-section">
      <button
        type="button"
        class="action-btn copy-btn"
        class:success={copied}
        onclick={handleCopy}
        aria-label={copied ? 'Copied!' : 'Copy room code to clipboard'}
      >
        <i class="fas {copied ? 'fa-check' : 'fa-copy'}" aria-hidden="true"></i>
        <span class="btn-label">{copied ? 'Copied!' : 'Copy'}</span>
      </button>

      <button
        type="button"
        class="action-btn share-btn"
        class:success={shared}
        onclick={handleShare}
        aria-label={shared ? 'Shared!' : (canShare ? 'Share room code' : 'Copy link to clipboard')}
      >
        <i class="fas {shared ? 'fa-check' : (canShare ? 'fa-share-alt' : 'fa-link')}" aria-hidden="true"></i>
        <span class="btn-label">{shared ? 'Shared!' : (canShare ? 'Share' : 'Copy Link')}</span>
      </button>
    </div>

    <!-- QR Code section -->
    {#if showQR}
      <div class="qr-section">
        <div class="qr-header">
          <span class="qr-label">Scan to Join</span>
        </div>

        <div class="qr-container" aria-label="QR code to join room">
          {#if qrLoading}
            <div class="qr-placeholder loading">
              <ProgressRing percent={-1} size={32} strokeWidth={3} />
              <span class="visually-hidden">Generating QR code...</span>
            </div>
          {:else if qrError}
            <div class="qr-placeholder error">
              <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
              <span class="qr-error-text">{qrError}</span>
            </div>
          {:else if qrDataUrl}
            <img
              src={qrDataUrl}
              alt="QR code to join room {effectiveRoomCode}"
              class="qr-image"
              width="200"
              height="200"
            />
          {:else}
            <div class="qr-placeholder">
              <i class="fas fa-qrcode" aria-hidden="true"></i>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
{:else}
  <div class="no-room" role="status">
    <i class="fas fa-link-slash" aria-hidden="true"></i>
    <span>No active room</span>
  </div>
{/if}

<style>
  .room-code-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    padding: 24px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 16px;
  }

  .room-code-display.compact {
    padding: 16px;
    gap: 16px;
  }

  .room-code-display.large {
    padding: 32px;
    gap: 24px;
  }

  /* Code section */
  .code-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .code-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
  }

  .code-value {
    font-family: var(--font-mono, monospace);
    font-size: 2.5rem;
    font-weight: 700;
    letter-spacing: 0.15em;
    color: var(--theme-accent, #8b5cf6);
    text-transform: uppercase;
    user-select: all;
    cursor: text;
    padding: 8px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 8px;
  }

  .compact .code-value {
    font-size: 1.75rem;
    padding: 6px 12px;
  }

  .large .code-value {
    font-size: 3.5rem;
    padding: 12px 24px;
  }

  /* Actions section */
  .actions-section {
    display: flex;
    gap: 12px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 48px;
    min-width: 100px;
    padding: 0 20px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal, 150ms) ease;
  }

  .action-btn:hover:not(.success) {
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #ffffff);
  }

  .action-btn:active {
    transform: scale(0.98);
  }

  .action-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .action-btn.success {
    background: rgba(34, 197, 94, 0.15);
    border-color: rgba(34, 197, 94, 0.3);
    color: var(--semantic-success, rgba(74, 222, 128, 1));
  }

  .copy-btn:hover:not(.success) {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-accent, #8b5cf6);
  }

  .share-btn:hover:not(.success) {
    background: rgba(6, 182, 212, 0.15);
    border-color: rgba(6, 182, 212, 0.3);
    color: rgba(34, 211, 238, 1);
  }

  .btn-label {
    white-space: nowrap;
  }

  /* QR section */
  .qr-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding-top: 16px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    width: 100%;
  }

  .qr-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .qr-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .qr-container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 220px;
    height: 220px;
    background: white;
    border-radius: 12px;
    padding: 10px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .compact .qr-container {
    width: 160px;
    height: 160px;
    padding: 8px;
  }

  .qr-image {
    width: 100%;
    height: 100%;
    object-fit: contain;
    border-radius: 4px;
  }

  .qr-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    height: 100%;
    color: rgba(0, 0, 0, 0.3);
    font-size: 3rem;
  }

  .qr-placeholder.loading {
    font-size: 1rem;
  }

  .qr-placeholder.error {
    font-size: 2rem;
    color: var(--semantic-error, rgba(239, 68, 68, 0.6));
  }

  .qr-error-text {
    font-size: var(--font-size-compact, 12px);
    text-align: center;
  }

  /* No room state */
  .no-room {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 24px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-sm, 14px);
  }

  .no-room i {
    font-size: 2rem;
    opacity: 0.6;
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

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .action-btn {
      transition: none;
    }
  }

  /* Mobile responsive */
  @media (max-width: 480px) {
    .room-code-display {
      padding: 20px;
    }

    .code-value {
      font-size: 2rem;
    }

    .actions-section {
      width: 100%;
    }

    .action-btn {
      flex: 1;
    }

    .qr-container {
      width: 180px;
      height: 180px;
    }
  }

  /* High contrast mode */
  @media (prefers-contrast: high) {
    .room-code-display {
      border-width: 2px;
      border-color: var(--theme-text, #ffffff);
    }

    .code-value {
      border: 2px solid var(--theme-accent, #8b5cf6);
    }

    .action-btn {
      border-width: 2px;
    }

    .qr-container {
      border: 2px solid var(--theme-text, #ffffff);
    }
  }
</style>
