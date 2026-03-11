<script lang="ts">
  /**
   * GalleryHUD
   *
   * Heads-up display overlay for the gallery.
   * Shows controls hint, focused exhibit info, exit button, and multiplayer UI.
   */

  import type { GalleryState } from "../state/gallery-state.svelte";
  import type { GallerySettingsInstance } from "../state/gallery-settings.svelte";
  import type { MultiplayerStateInstance } from "../multiplayer/state/multiplayer-state.svelte";
  import { goto } from "$app/navigation";
  import { getUser } from "$lib/shared/auth/state/authState.svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  // Multiplayer components
  import GalleryMinimap from "../multiplayer/components/GalleryMinimap.svelte";
  import SessionJoinDrawer from "../multiplayer/components/SessionJoinDrawer.svelte";
  import SessionChat from "../multiplayer/components/SessionChat.svelte";

  // UI primitives
  import { ChipToggle, ChipGroup } from '@austencloud/chip-toggle';
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";

  interface Props {
    /** Gallery state - named galleryState to avoid Svelte compiler treating 'state' as a store */
    galleryState: GalleryState;
    /** Gallery settings for physics mode and rendering */
    gallerySettings: GallerySettingsInstance;
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
    gallerySettings,
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
  let showSettings = $state(false);

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
        {t("gallery_exit")}
      </button>

      <button class="lights-toggle" onclick={() => galleryState.toggleLights()}>
        <i class="fas {galleryState.lightsOn ? 'fa-sun' : 'fa-moon'}"></i>
        {galleryState.lightsOn ? t("gallery_light_mode") : t("gallery_dark_mode")}
      </button>
    </div>

    <!-- Multiplayer status (only show when multiplayerState is available) -->
    <div class="center-controls">
      {#if multiplayerState && getIsInSession() && getCurrentSession()}
        {@const session = getCurrentSession()}
        <div class="session-info">
          <i class="fas fa-users" aria-hidden="true"></i>
          <span class="session-name">{session?.name}</span>
          <span class="player-count">{t("gallery_online_count", { count: getPlayerCount().toString() })}</span>
        </div>
      {/if}
    </div>

    <div class="right-controls">
      {#if galleryState.sourceUserId}
        <div class="viewing-info">
          {t("gallery_viewing_gallery")}
        </div>
      {/if}

      <!-- Settings button -->
      <button
        class="hud-button settings-toggle"
        class:active={showSettings}
        onclick={() => showSettings = !showSettings}
        aria-label={t("gallery_toggle_settings")}
      >
        <i class="fas fa-cog" aria-hidden="true"></i>
      </button>

      <!-- Multiplayer controls (only show when multiplayerState is available) -->
      {#if multiplayerState}
        {#if getIsInSession()}
          <button
            class="hud-button minimap-toggle"
            class:active={showMinimap}
            onclick={() => showMinimap = !showMinimap}
            aria-label={t("gallery_toggle_minimap")}
          >
            <i class="fas fa-map" aria-hidden="true"></i>
          </button>

          <button
            class="hud-button chat-toggle"
            class:active={showChat}
            onclick={() => showChat = !showChat}
            aria-label={t("gallery_toggle_chat")}
          >
            <i class="fas fa-comments" aria-hidden="true"></i>
            {#if getChatMessages().length > 0}
              <span class="unread-badge"></span>
            {/if}
          </button>

          <button class="hud-button leave-button" onclick={handleLeaveSession}>
            <i class="fas fa-sign-out-alt" aria-hidden="true"></i>
            {t("gallery_leave")}
          </button>
        {:else}
          <button class="hud-button join-button" onclick={() => showSessionDrawer = true}>
            <i class="fas fa-users" aria-hidden="true"></i>
            {t("gallery_multiplayer")}
          </button>
        {/if}
      {/if}
    </div>
  </div>

  <!-- Settings Panel -->
  {#if showSettings}
    <div class="settings-panel">
      <h3>{t("gallery_settings_title")}</h3>

      <ChipGroup>
        <ChipToggle
          label={t("gallery_settings_raycasting")}
          icon="fa-feather"
          active={gallerySettings.physicsMode === "raycasting"}
          color="cyan"
          onclick={() => {
            gallerySettings.setPhysicsMode("raycasting");
            window.location.reload();
          }}
        />
        <ChipToggle
          label={t("gallery_settings_rapier")}
          icon="fa-cube"
          active={gallerySettings.physicsMode === "rapier"}
          color="cyan"
          onclick={() => {
            gallerySettings.setPhysicsMode("rapier");
            window.location.reload();
          }}
        />
      </ChipGroup>

      <ChipGroup>
        <ChipToggle
          label={t("gallery_settings_webgl")}
          icon="fa-globe"
          active={gallerySettings.renderingBackend === "webgl"}
          color="emerald"
          onclick={() => {
            gallerySettings.setRenderingBackend("webgl");
            window.location.reload();
          }}
        />
        <ChipToggle
          label={t("gallery_settings_webgpu")}
          icon="fa-bolt"
          active={gallerySettings.renderingBackend === "webgpu-auto"}
          color="emerald"
          onclick={() => {
            gallerySettings.setRenderingBackend("webgpu-auto");
            window.location.reload();
          }}
        />
      </ChipGroup>

      <ChipGroup>
        <ChipToggle
          label="60°"
          active={gallerySettings.fov === 60}
          color="amber"
          onclick={() => gallerySettings.setFov(60)}
        />
        <ChipToggle
          label="75°"
          active={gallerySettings.fov === 75}
          color="amber"
          onclick={() => gallerySettings.setFov(75)}
        />
        <ChipToggle
          label="90°"
          active={gallerySettings.fov === 90}
          color="amber"
          onclick={() => gallerySettings.setFov(90)}
        />
        <ChipToggle
          label="110°"
          active={gallerySettings.fov === 110}
          color="amber"
          onclick={() => gallerySettings.setFov(110)}
        />
      </ChipGroup>

      <ChipGroup>
        <ChipToggle
          label="0.5x"
          active={gallerySettings.mouseSensitivity === 0.5}
          color="rose"
          onclick={() => gallerySettings.setMouseSensitivity(0.5)}
        />
        <ChipToggle
          label="1x"
          active={gallerySettings.mouseSensitivity === 1.0}
          color="rose"
          onclick={() => gallerySettings.setMouseSensitivity(1.0)}
        />
        <ChipToggle
          label="1.5x"
          active={gallerySettings.mouseSensitivity === 1.5}
          color="rose"
          onclick={() => gallerySettings.setMouseSensitivity(1.5)}
        />
        <ChipToggle
          label="2x"
          active={gallerySettings.mouseSensitivity === 2.0}
          color="rose"
          onclick={() => gallerySettings.setMouseSensitivity(2.0)}
        />
      </ChipGroup>

      <button class="reset-button" onclick={() => {
        gallerySettings.reset();
        window.location.reload();
      }}>
        {t("gallery_settings_reset")}
      </button>
    </div>
  {/if}

  <!-- Controls hint (shown when not navigating) -->
  {#if !isNavigating}
    <div class="controls-hint">
      <p>{@html t("gallery_hint_click").replace('Click', '<strong>Click</strong>')}</p>
      <p>{@html t("gallery_hint_wasd").replace('WASD', '<strong>WASD</strong>')}</p>
      <p>{@html t("gallery_hint_toggle").replace('T', '<strong>T</strong>')}</p>
      <p>{@html t("gallery_hint_escape").replace('ESC', '<strong>ESC</strong>')}</p>
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
          t("gallery_untitled")}
      </h3>
      {#if author}
        <p class="author">{t("gallery_by_author", { author })}</p>
      {/if}
      {#if galleryState.focusedExhibit.sequence.steps?.length}
        <p class="steps">{t("gallery_beats_count", { count: galleryState.focusedExhibit.sequence.steps.length.toString() })}</p>
      {/if}
    </div>
  {/if}

  <!-- Loading indicator -->
  {#if galleryState.isLoading}
    <div class="loading-overlay">
      <ProgressRing percent={-1} size={32} strokeWidth={3} />
      <p>{t("gallery_loading")}</p>
    </div>
  {/if}

  <!-- Error message -->
  {#if galleryState.error}
    <div class="error-message">
      <p>{galleryState.error}</p>
      <button onclick={() => galleryState.setError(null)}>{t("gallery_dismiss")}</button>
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
    transition: background var(--duration-normal), border-color var(--duration-normal);
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
    pointer-events: none; /* Allow mouse events to pass through to canvas */
  }

  .controls-hint p {
    margin: 8px 0;
    font-size: 16px;
  }

  .controls-hint :global(strong) {
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

  .exhibit-info .steps {
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
    transition: all var(--duration-normal);
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

  /* Settings Panel */
  .settings-panel {
    position: absolute;
    top: 70px;
    right: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    background: rgba(0, 0, 0, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 16px;
    padding: 20px;
    min-width: 280px;
    max-width: 320px;
    z-index: 100;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  }

  .settings-panel h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #ffffff;
  }

  .reset-button {
    padding: 10px;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 12px;
    color: #fca5a5;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  @media (hover: hover) {
    .reset-button:hover {
      background: rgba(239, 68, 68, 0.25);
      border-color: rgba(239, 68, 68, 0.5);
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


    .hud-button {
      padding: 10px;
    }

    .session-info {
      font-size: 12px;
      padding: 6px 12px;
    }

    .settings-panel {
      right: 8px;
      left: 8px;
      min-width: auto;
      max-width: none;
    }
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .unread-badge {
      animation: none;
    }
  }
</style>
