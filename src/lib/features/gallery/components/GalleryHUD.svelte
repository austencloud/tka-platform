<script lang="ts">
  /**
   * GalleryHUD
   *
   * Heads-up display overlay for the gallery.
   * Shows controls hint, focused exhibit info, exit button, and multiplayer UI.
   */

  import type { GalleryState } from "../state/gallery-state.svelte";
  import type { MultiplayerStateInstance } from "../multiplayer/state/multiplayer-state.svelte";
  import { goto } from "$app/navigation";
  import { getUser } from "$lib/shared/auth/state/authState.svelte";

  // Multiplayer components
  import GalleryMinimap from "../multiplayer/components/GalleryMinimap.svelte";
  import SessionJoinDrawer from "../multiplayer/components/SessionJoinDrawer.svelte";
  import SessionChat from "../multiplayer/components/SessionChat.svelte";

  interface Props {
    /** Gallery state - named galleryState to avoid Svelte compiler treating 'state' as a store */
    galleryState: GalleryState;
    /** Whether pointer is locked (user is in navigation mode) */
    isNavigating: boolean;
    /** Multiplayer state (optional) */
    multiplayerState?: MultiplayerStateInstance | null;
    /** Callback to create a new session */
    onCreateSession?: (name: string, visibility: 'public' | 'private' | 'friends') => Promise<void>;
    /** Callback to join an existing session */
    onJoinSession?: (sessionId: string) => Promise<void>;
    /** Callback to leave the current session */
    onLeaveSession?: () => Promise<void>;
    /** Callback to send a chat message */
    onSendMessage?: (text: string) => Promise<void>;
  }

  let {
    galleryState,
    isNavigating,
    multiplayerState = null,
    onCreateSession,
    onJoinSession,
    onLeaveSession,
    onSendMessage
  }: Props = $props();

  // Local UI state
  let showSessionDrawer = $state(false);
  let showChat = $state(false);
  let showMinimap = $state(true);

  // Access multiplayer properties directly (they're already reactive getters)
  // Using functions to avoid Svelte 5 $derived issues with nullable props
  function getIsInSession() { return multiplayerState?.isInSession ?? false; }
  function getCurrentSession() { return multiplayerState?.currentSession ?? null; }
  function getRemotePlayers() { return multiplayerState?.remotePlayers ?? []; }
  function getChatMessages() { return multiplayerState?.chatMessages ?? []; }
  function getPlayerCount() { return (multiplayerState?.remotePlayers?.length ?? 0) + 1; }

  // Access authState through imported functions to avoid Svelte 5 reactivity issues
  function getCurrentUser() { return getUser(); }
  function getCurrentUserId() { return getUser()?.uid ?? null; }

  // Get author name - prefer current user's name since viewing own library
  function getAuthorName(): string | null {
    if (!galleryState.focusedExhibit) return null;
    // If viewing own library, use current user's display name
    const currentUser = getCurrentUser();
    if (currentUser?.displayName) {
      return currentUser.displayName;
    }
    // Fall back to sequence author data
    return galleryState.focusedExhibit.sequence.author ||
           galleryState.focusedExhibit.sequence.ownerDisplayName ||
           null;
  }

  function handleExit() {
    goto("/");
  }

  async function handleLeaveSession() {
    if (onLeaveSession) {
      await onLeaveSession();
    }
  }

  async function handleSendMessage(text: string) {
    if (onSendMessage) {
      await onSendMessage(text);
    }
  }
</script>

<div class="hud">
  <!-- Top bar -->
  <div class="top-bar">
    <div class="left-controls">
      <button class="exit-button" onclick={handleExit}>
        <i class="fas fa-arrow-left"></i>
        Exit Gallery
      </button>

      <button class="lights-toggle" onclick={() => galleryState.toggleLights()}>
        <i class="fas {galleryState.lightsOn ? 'fa-sun' : 'fa-moon'}"></i>
        {galleryState.lightsOn ? 'Light Mode' : 'Dark Mode'}
      </button>
    </div>

    <!-- Multiplayer status (only show when multiplayerState is available) -->
    <div class="center-controls">
      {#if multiplayerState && getIsInSession() && getCurrentSession()}
        {@const session = getCurrentSession()}
        <div class="session-info">
          <i class="fas fa-users" aria-hidden="true"></i>
          <span class="session-name">{session?.meta.name}</span>
          <span class="player-count">{getPlayerCount()} online</span>
        </div>
      {/if}
    </div>

    <div class="right-controls">
      {#if galleryState.sourceUserId}
        <div class="viewing-info">
          Viewing gallery
        </div>
      {/if}

      <!-- Multiplayer controls (only show when multiplayerState is available) -->
      {#if multiplayerState}
        {#if getIsInSession()}
          <button
            class="hud-button minimap-toggle"
            class:active={showMinimap}
            onclick={() => showMinimap = !showMinimap}
            aria-label="Toggle minimap"
          >
            <i class="fas fa-map" aria-hidden="true"></i>
          </button>

          <button
            class="hud-button chat-toggle"
            class:active={showChat}
            onclick={() => showChat = !showChat}
            aria-label="Toggle chat"
          >
            <i class="fas fa-comments" aria-hidden="true"></i>
            {#if getChatMessages().length > 0}
              <span class="unread-badge"></span>
            {/if}
          </button>

          <button class="hud-button leave-button" onclick={handleLeaveSession}>
            <i class="fas fa-sign-out-alt" aria-hidden="true"></i>
            Leave
          </button>
        {:else}
          <button class="hud-button join-button" onclick={() => showSessionDrawer = true}>
            <i class="fas fa-users" aria-hidden="true"></i>
            Multiplayer
          </button>
        {/if}
      {/if}
    </div>
  </div>

  <!-- Controls hint (shown when not navigating) -->
  {#if !isNavigating}
    <div class="controls-hint">
      <p><strong>Click</strong> to look around</p>
      <p><strong>WASD</strong> to move</p>
      <p><strong>T</strong> to toggle light/dark mode</p>
      <p><strong>ESC</strong> to release cursor</p>
    </div>
  {/if}

  <!-- Focused exhibit info -->
  {#if galleryState.focusedExhibit}
    {@const author = getAuthorName()}
    <div class="exhibit-info">
      <h3>
        {galleryState.focusedExhibit.sequence.word ||
          galleryState.focusedExhibit.sequence.displayName ||
          galleryState.focusedExhibit.sequence.name ||
          "Untitled"}
      </h3>
      {#if author}
        <p class="author">by {author}</p>
      {/if}
      {#if galleryState.focusedExhibit.sequence.beats?.length}
        <p class="beats">{galleryState.focusedExhibit.sequence.beats.length} beats</p>
      {/if}
    </div>
  {/if}

  <!-- Loading indicator -->
  {#if galleryState.isLoading}
    <div class="loading-overlay">
      <div class="loading-spinner"></div>
      <p>Loading gallery...</p>
    </div>
  {/if}

  <!-- Error message -->
  {#if galleryState.error}
    <div class="error-message">
      <p>{galleryState.error}</p>
      <button onclick={() => galleryState.setError(null)}>Dismiss</button>
    </div>
  {/if}

  <!-- Multiplayer: Only render these components when multiplayerState is available -->
  {#if multiplayerState}
    <!-- Minimap -->
    {#if getIsInSession() && showMinimap && galleryState.layout}
      <GalleryMinimap
        layout={galleryState.layout}
        localPosition={{
          x: galleryState.playerPosition.x,
          y: galleryState.playerPosition.y,
          z: galleryState.playerPosition.z
        }}
        remotePlayers={getRemotePlayers()}
      />
    {/if}

    <!-- Chat panel -->
    {#if getIsInSession()}
      <SessionChat
        open={showChat}
        messages={getChatMessages()}
        currentUserId={getCurrentUserId()}
        onSend={handleSendMessage}
        onClose={() => showChat = false}
      />
    {/if}

    <!-- Session join drawer -->
    <SessionJoinDrawer
      open={showSessionDrawer}
      onClose={() => showSessionDrawer = false}
      onCreate={onCreateSession ?? (async () => {})}
      onJoin={onJoinSession ?? (async () => {})}
    />
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

  .left-controls,
  .right-controls {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .center-controls {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
  }

  .exit-button,
  .lights-toggle {
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
    transition: background 0.2s, border-color 0.2s;
  }

  .exit-button:hover,
  .lights-toggle:hover {
    background: rgba(0, 0, 0, 0.8);
  }

  .lights-toggle {
    border-color: rgba(245, 158, 11, 0.4);
  }

  .lights-toggle:hover {
    border-color: rgba(245, 158, 11, 0.7);
  }

  .lights-toggle i {
    color: #f59e0b;
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

  /* Multiplayer styles */
  .session-info {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid rgba(96, 165, 250, 0.4);
    border-radius: 20px;
    color: white;
    font-size: 14px;
  }

  .session-info i {
    color: #60a5fa;
  }

  .session-name {
    font-weight: 500;
  }

  .player-count {
    color: rgba(255, 255, 255, 0.6);
    font-size: 12px;
  }

  .hud-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 14px;
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    color: white;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
  }

  .hud-button:hover {
    background: rgba(0, 0, 0, 0.8);
    border-color: rgba(255, 255, 255, 0.3);
  }

  .hud-button.active {
    background: rgba(96, 165, 250, 0.2);
    border-color: rgba(96, 165, 250, 0.5);
  }

  .hud-button.active i {
    color: #60a5fa;
  }

  .join-button {
    border-color: rgba(96, 165, 250, 0.4);
  }

  .join-button:hover {
    border-color: rgba(96, 165, 250, 0.7);
    background: rgba(96, 165, 250, 0.15);
  }

  .join-button i {
    color: #60a5fa;
  }

  .leave-button {
    border-color: rgba(239, 68, 68, 0.4);
  }

  .leave-button:hover {
    border-color: rgba(239, 68, 68, 0.7);
    background: rgba(239, 68, 68, 0.15);
  }

  .leave-button i {
    color: #ef4444;
  }

  .unread-badge {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 8px;
    height: 8px;
    background: #ef4444;
    border-radius: 50%;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.7;
      transform: scale(1.2);
    }
  }

  /* Mobile adjustments */
  @media (max-width: 768px) {
    .top-bar {
      padding: 12px;
      flex-wrap: wrap;
      gap: 8px;
    }

    .left-controls,
    .right-controls {
      gap: 8px;
    }

    .center-controls {
      position: static;
      transform: none;
      order: 3;
      width: 100%;
      justify-content: center;
      display: flex;
    }

    .exit-button span,
    .lights-toggle span,
    .leave-button span {
      display: none;
    }

    .hud-button {
      padding: 10px;
    }

    .session-info {
      font-size: 12px;
      padding: 6px 12px;
    }
  }
</style>
