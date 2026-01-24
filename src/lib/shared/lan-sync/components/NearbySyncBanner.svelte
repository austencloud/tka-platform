<!--
  NearbySyncBanner Component

  Shows a banner when someone nearby is sharing a sequence.
  Tapping "Join" navigates to the sequence and connects.
-->
<script lang="ts">
  import { slide } from "svelte/transition";
  import { lanSyncState } from "../state/lan-sync-state.svelte";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { goto } from "$app/navigation";

  let joining = $state(false);
  let error = $state<string | null>(null);

  // Get the top nearby room (most recent)
  const nearbyRoom = $derived(lanSyncState.topNearbyRoom);

  // Check if user is signed in (required to join)
  const isSignedIn = $derived(!!authState.user);

  async function handleJoin() {
    if (!nearbyRoom || joining) return;

    joining = true;
    error = null;

    try {
      // Navigate to the sequence in gallery
      await goto(`/discover/gallery?sequence=${nearbyRoom.sequenceId}`);

      // Connect to the PeerJS room
      await lanSyncState.joinRoomByCode(nearbyRoom.peerJsRoomCode);

      // Dismiss this banner after successful join
      lanSyncState.dismissRoom(nearbyRoom.roomId);
    } catch (err) {
      console.error("[NearbySyncBanner] Join failed:", err);
      error = "Couldn't connect. Try again?";
    } finally {
      joining = false;
    }
  }

  function handleDismiss() {
    if (nearbyRoom) {
      lanSyncState.dismissRoom(nearbyRoom.roomId);
    }
  }
</script>

{#if nearbyRoom}
  <div class="sync-banner" transition:slide={{ duration: 300 }}>
    <div class="banner-content">
      <i class="fas fa-broadcast-tower banner-icon" aria-hidden="true"></i>

      <div class="banner-text">
        <strong>{nearbyRoom.hostDisplayName} is sharing</strong>
        <span class="sequence-name">"{nearbyRoom.sequenceWord}"</span>
        {#if error}
          <span class="error-text" role="alert">{error}</span>
        {/if}
      </div>

      <div class="banner-actions">
        {#if isSignedIn}
          <button
            class="action-button join-button"
            onclick={handleJoin}
            disabled={joining}
          >
            {joining ? "Joining..." : "Join"}
          </button>
        {:else}
          <button
            class="action-button disabled-button"
            disabled
            title="Sign in to join sync sessions"
          >
            Sign in to join
          </button>
        {/if}
        <button
          class="dismiss-button"
          onclick={handleDismiss}
          aria-label="Dismiss"
        >
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .sync-banner {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    background: linear-gradient(
      135deg,
      var(--theme-accent, #6366f1) 0%,
      #4f46e5 100%
    );
    color: white;
    padding: 12px 16px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  }

  .banner-content {
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: 1200px;
    margin: 0 auto;
  }

  .banner-icon {
    font-size: 20px;
    flex-shrink: 0;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.7;
      transform: scale(1.1);
    }
  }

  .banner-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: var(--font-size-sm, 14px);
    min-width: 0;
  }

  .banner-text strong {
    font-weight: 600;
  }

  .sequence-name {
    font-weight: 500;
    opacity: 0.95;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .error-text {
    color: #fecaca !important;
    font-size: var(--font-size-compact, 12px);
  }

  .banner-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .action-button {
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: white;
    padding: 8px 20px;
    border-radius: 8px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
    min-height: 40px;
  }

  .action-button:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.3);
  }

  .action-button:active:not(:disabled) {
    transform: scale(0.95);
  }

  .action-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .join-button {
    background: rgba(255, 255, 255, 0.25);
    border-color: rgba(255, 255, 255, 0.4);
  }

  .join-button:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.35);
  }

  .disabled-button {
    font-size: 11px;
    padding: 8px 12px;
  }

  .dismiss-button {
    background: transparent;
    border: none;
    color: white;
    padding: 10px;
    border-radius: 6px;
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 40px;
    min-height: 40px;
  }

  .dismiss-button:hover {
    opacity: 1;
  }

  /* Mobile adjustments */
  @media (max-width: 600px) {
    .sync-banner {
      padding: 10px 12px;
    }

    .banner-content {
      gap: 10px;
    }

    .banner-icon {
      font-size: 18px;
    }

    .banner-text {
      font-size: var(--font-size-compact, 12px);
    }

    .action-button {
      padding: 8px 16px;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .banner-icon {
      animation: none;
    }

    .action-button {
      transition: none;
    }
  }
</style>
