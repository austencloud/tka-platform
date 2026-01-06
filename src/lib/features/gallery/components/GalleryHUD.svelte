<script lang="ts">
  /**
   * GalleryHUD
   *
   * Heads-up display overlay for the gallery.
   * Shows controls hint, focused exhibit info, and exit button.
   */

  import type { GalleryState } from "../state/gallery-state.svelte";
  import { goto } from "$app/navigation";

  interface Props {
    /** Gallery state */
    state: GalleryState;
    /** Whether pointer is locked (user is in navigation mode) */
    isNavigating: boolean;
  }

  let { state, isNavigating }: Props = $props();

  function handleExit() {
    goto("/");
  }
</script>

<div class="hud">
  <!-- Top bar -->
  <div class="top-bar">
    <button class="exit-button" onclick={handleExit}>
      <i class="fas fa-arrow-left"></i>
      Exit Gallery
    </button>

    {#if state.sourceUserId}
      <div class="viewing-info">
        Viewing gallery
      </div>
    {/if}
  </div>

  <!-- Controls hint (shown when not navigating) -->
  {#if !isNavigating}
    <div class="controls-hint">
      <p><strong>Click</strong> to look around</p>
      <p><strong>WASD</strong> to move</p>
      <p><strong>ESC</strong> to release cursor</p>
    </div>
  {/if}

  <!-- Focused exhibit info -->
  {#if state.focusedExhibit}
    <div class="exhibit-info">
      <h3>
        {state.focusedExhibit.sequence.displayName ||
          state.focusedExhibit.sequence.name ||
          state.focusedExhibit.sequence.word ||
          "Untitled"}
      </h3>
      {#if state.focusedExhibit.sequence.author || state.focusedExhibit.sequence.ownerDisplayName}
        <p class="author">
          by {state.focusedExhibit.sequence.author ||
            state.focusedExhibit.sequence.ownerDisplayName}
        </p>
      {/if}
      {#if state.focusedExhibit.sequence.beats}
        <p class="beats">{state.focusedExhibit.sequence.beats.length} beats</p>
      {/if}
    </div>
  {/if}

  <!-- Loading indicator -->
  {#if state.isLoading}
    <div class="loading-overlay">
      <div class="loading-spinner"></div>
      <p>Loading gallery...</p>
    </div>
  {/if}

  <!-- Error message -->
  {#if state.error}
    <div class="error-message">
      <p>{state.error}</p>
      <button onclick={() => state.setError(null)}>Dismiss</button>
    </div>
  {/if}
</div>

<style>
  .hud {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 100;
  }

  .hud > * {
    pointer-events: auto;
  }

  .top-bar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    background: linear-gradient(to bottom, rgba(0, 0, 0, 0.5), transparent);
  }

  .exit-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: white;
    font-size: 14px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .exit-button:hover {
    background: rgba(0, 0, 0, 0.8);
  }

  .viewing-info {
    color: rgba(255, 255, 255, 0.8);
    font-size: 14px;
  }

  .controls-hint {
    position: absolute;
    bottom: 50%;
    left: 50%;
    transform: translate(-50%, 50%);
    text-align: center;
    color: white;
    background: rgba(0, 0, 0, 0.7);
    padding: 24px 32px;
    border-radius: 12px;
    backdrop-filter: blur(10px);
  }

  .controls-hint p {
    margin: 8px 0;
    font-size: 16px;
  }

  .controls-hint strong {
    color: #f59e0b;
  }

  .exhibit-info {
    position: absolute;
    bottom: 24px;
    left: 24px;
    background: rgba(0, 0, 0, 0.7);
    padding: 16px 20px;
    border-radius: 12px;
    backdrop-filter: blur(10px);
    max-width: 300px;
  }

  .exhibit-info h3 {
    margin: 0 0 8px 0;
    color: white;
    font-size: 18px;
    font-weight: 600;
  }

  .exhibit-info .author {
    margin: 0 0 4px 0;
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
  }

  .exhibit-info .beats {
    margin: 0;
    color: rgba(255, 255, 255, 0.5);
    font-size: 12px;
  }

  .loading-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.8);
    color: white;
  }

  .loading-spinner {
    width: 48px;
    height: 48px;
    border: 3px solid rgba(255, 255, 255, 0.2);
    border-top-color: #f59e0b;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error-message {
    position: absolute;
    bottom: 24px;
    right: 24px;
    background: rgba(220, 38, 38, 0.9);
    padding: 16px 20px;
    border-radius: 12px;
    color: white;
    max-width: 300px;
  }

  .error-message button {
    margin-top: 12px;
    padding: 8px 16px;
    background: rgba(255, 255, 255, 0.2);
    border: none;
    border-radius: 6px;
    color: white;
    cursor: pointer;
  }
</style>
