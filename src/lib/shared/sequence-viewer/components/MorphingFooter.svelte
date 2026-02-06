<!--
  MorphingFooter.svelte

  Mobile-only morphing footer for the Sequence Viewer modal.

  3-button footer that expands in-place when tapped:
  - Settings: Visibility chips for animation canvas
  - Play/Pause: Transport controls + BPM chips
  - Share: Action buttons (Save, Compose, Share, Download)

  Features:
  - State machine for mode transitions (collapsed/settings/playback/actions)
  - CSS-based expand/collapse animation with crossfade
  - Unified dark mode toggle affecting both animation and choreo card
  - No auto-hide - controls stay visible until user collapses
-->
<script lang="ts">
  import ChipToggle from "$lib/shared/components/selection/ChipToggle.svelte";
  import TempoControl from "./TempoControl.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { container } from "$lib/shared/di";

  type FooterMode = 'collapsed' | 'settings' | 'playback' | 'actions';

  interface Props {
    /** Current BPM value */
    bpm: number;
    /** Whether animation is currently playing */
    isPlaying: boolean;
    /** Whether user is logged in (affects Save/Compose buttons) */
    isLoggedIn: boolean;
    /** Unified dark mode state */
    darkMode: boolean;
    /** Whether sync is currently connecting/disconnecting */
    isSyncToggling?: boolean;
    /** Whether sync is active (searching or connected) */
    isSyncActive?: boolean;
    /** Whether sync is connected to another device */
    isSyncConnected?: boolean;
    /** Callback when BPM changes */
    onBpmChange: (bpm: number) => void;
    /** Callback to toggle play/pause */
    onPlayPause: () => void;
    /** Callback for step backward (full beat) */
    onStepBack: () => void;
    /** Callback for step forward (full beat) */
    onStepForward: () => void;
    /** Callback for half-step backward */
    onStepHalfBack?: () => void;
    /** Callback for half-step forward */
    onStepHalfForward?: () => void;
    /** Callback when Save is clicked */
    onSave: () => void;
    /** Callback when Compose is clicked */
    onCompose: () => void;
    /** Callback when Share is clicked */
    onShare: () => void;
    /** Callback when Export is clicked */
    onExport: () => void;
    /** Callback when unified dark mode is toggled */
    onDarkModeToggle: () => void;
    /** Callback when "Get TKA Scribe" is clicked (unauthenticated users) */
    onGetApp?: () => void;
    /** Whether tempo ramp is currently active */
    rampActive?: boolean;
    /** Callback when ramp training starts */
    onRampStart?: () => void;
    /** Callback when ramp training stops */
    onRampStop?: () => void;
    /** Callback when Connect is clicked (toggle LAN sync) */
    onConnect?: () => void;
  }

  let {
    bpm,
    isPlaying,
    isLoggedIn,
    darkMode,
    isSyncToggling = false,
    isSyncActive = false,
    isSyncConnected = false,
    onBpmChange,
    onPlayPause,
    onStepBack,
    onStepForward,
    onStepHalfBack,
    onStepHalfForward,
    onSave,
    onCompose,
    onShare,
    onExport,
    onDarkModeToggle,
    onGetApp,
    rampActive = false,
    onRampStart,
    onRampStop,
    onConnect,
  }: Props = $props();

  // Footer mode state machine
  let mode = $state<FooterMode>('collapsed');

  // Animation visibility manager (global singleton)
  const animVisibility = getAnimationVisibilityManager();

  // Local reactive state for animation settings (synced with manager)
  let animGridVisible = $state(animVisibility.isGridVisible());
  let animTrailsOn = $state(animVisibility.isTrailsVisible());
  let animTkaGlyph = $state(animVisibility.getVisibility("tkaGlyph"));
  let animWordHeader = $state(animVisibility.getVisibility("wordHeader"));
  let animStepNumbers = $state(animVisibility.getVisibility("stepNumbers"));

  // Toggle handlers for animation settings
  function toggleAnimGrid() {
    haptic();
    const newMode = animGridVisible ? "none" : "diamond";
    animVisibility.setGridMode(newMode);
    animGridVisible = newMode !== "none";
  }

  function toggleAnimTrails() {
    haptic();
    const newStyle = animTrailsOn ? "off" : "on";
    animVisibility.setTrailStyle(newStyle);
    animTrailsOn = newStyle === "on";
  }

  function toggleAnimTkaGlyph() {
    haptic();
    animTkaGlyph = !animTkaGlyph;
    animVisibility.setVisibility("tkaGlyph", animTkaGlyph);
  }

  function toggleAnimWordHeader() {
    haptic();
    animWordHeader = !animWordHeader;
    animVisibility.setVisibility("wordHeader", animWordHeader);
  }

  function toggleAnimStepNumbers() {
    haptic();
    animStepNumbers = !animStepNumbers;
    animVisibility.setVisibility("stepNumbers", animStepNumbers);
  }

  // Haptic feedback helper
  function haptic() {
    container.items.hapticFeedback?.trigger("selection");
  }

  // Step button glow state — tracks which button is animating
  let steppingBtn = $state<'half-back' | 'full-back' | 'full-fwd' | 'half-fwd' | null>(null);
  let steppingTimer: ReturnType<typeof setTimeout> | null = null;

  function glowStep(btn: typeof steppingBtn, duration: number) {
    if (steppingTimer) clearTimeout(steppingTimer);
    steppingBtn = btn;
    steppingTimer = setTimeout(() => { steppingBtn = null; }, duration);
  }

  // Compute step animation duration (matches AnimationPlaybackController.getStepDuration)
  function getHalfStepDuration(): number {
    const speedMultiplier = bpm / 60;
    return (1000 / speedMultiplier) * 0.5;
  }

  function getFullStepDuration(): number {
    const speedMultiplier = bpm / 60;
    return 1000 / speedMultiplier;
  }

  // Button handlers
  function handleSettingsClick() {
    haptic();
    mode = mode === 'settings' ? 'collapsed' : 'settings';
  }

  function handlePlayClick() {
    haptic();
    // Always toggle playback
    onPlayPause();
    // Toggle panel visibility
    mode = mode === 'playback' ? 'collapsed' : 'playback';
  }

  function handleShareClick() {
    haptic();
    mode = mode === 'actions' ? 'collapsed' : 'actions';
  }

  // Derived state for expanded panel
  const isExpanded = $derived(mode !== 'collapsed');
</script>

<footer class="morphing-footer" data-mode={mode}>
  <!-- Expanded Panel (slides up when mode !== collapsed) -->
  <div class="expanded-panel" class:visible={isExpanded}>
    <!-- Settings Panel -->
    <div class="panel-content" class:active={mode === 'settings'}>
      <div class="chip-grid">
        <ChipToggle
          label={darkMode ? "Dark" : "Light"}
          icon={darkMode ? "fa-moon" : "fa-sun"}
          active={darkMode}
          color="amber"
          onclick={onDarkModeToggle}
        />
        <ChipToggle
          label="Grid"
          icon="fa-th"
          active={animGridVisible}
          onclick={toggleAnimGrid}
        />
        <ChipToggle
          label="Trails"
          icon="fa-wind"
          active={animTrailsOn}
          onclick={toggleAnimTrails}
        />
        <ChipToggle
          label="TKA"
          icon="fa-font"
          active={animTkaGlyph}
          onclick={toggleAnimTkaGlyph}
        />
        <ChipToggle
          label="Word"
          icon="fa-heading"
          active={animWordHeader}
          onclick={toggleAnimWordHeader}
        />
        <ChipToggle
          label="Beats"
          icon="fa-hashtag"
          active={animStepNumbers}
          onclick={toggleAnimStepNumbers}
        />
      </div>
    </div>

    <!-- Playback Panel -->
    <div class="panel-content" class:active={mode === 'playback'}>
      <div class="playback-controls">
        <!-- Step controls only - main FAB handles play/pause -->
        <div class="step-controls">
          <button
            class="step-btn step-half"
            class:stepping={steppingBtn === 'half-back'}
            onclick={() => { haptic(); glowStep('half-back', getHalfStepDuration()); (onStepHalfBack ?? (() => {}))(); }}
            type="button"
            aria-label="Previous half beat"
          >
            <i class="fas fa-chevron-left" aria-hidden="true"></i>
          </button>
          <button
            class="step-btn step-full"
            class:stepping={steppingBtn === 'full-back'}
            onclick={() => { haptic(); glowStep('full-back', getFullStepDuration()); onStepBack(); }}
            type="button"
            aria-label="Previous full beat"
          >
            <i class="fas fa-angles-left" aria-hidden="true"></i>
          </button>
          <button
            class="step-btn step-full"
            class:stepping={steppingBtn === 'full-fwd'}
            onclick={() => { haptic(); glowStep('full-fwd', getFullStepDuration()); onStepForward(); }}
            type="button"
            aria-label="Next full beat"
          >
            <i class="fas fa-angles-right" aria-hidden="true"></i>
          </button>
          <button
            class="step-btn step-half"
            class:stepping={steppingBtn === 'half-fwd'}
            onclick={() => { haptic(); glowStep('half-fwd', getHalfStepDuration()); (onStepHalfForward ?? (() => {}))(); }}
            type="button"
            aria-label="Next half beat"
          >
            <i class="fas fa-chevron-right" aria-hidden="true"></i>
          </button>
        </div>
        <div class="bpm-section">
          <TempoControl
            {bpm}
            {onBpmChange}
            showPresets={false}
            rampActive={rampActive}
            onRampStart={onRampStart}
            onRampStop={onRampStop}
          />
        </div>
      </div>
    </div>

    <!-- Actions Panel -->
    <div class="panel-content" class:active={mode === 'actions'}>
      <div class="actions-grid">
        {#if isLoggedIn}
          <button
            type="button"
            class="action-btn save"
            onclick={() => { haptic(); onSave(); }}
            aria-label="Save to Library"
          >
            <i class="fas fa-bookmark" aria-hidden="true"></i>
            <span>Save</span>
          </button>
          <button
            type="button"
            class="action-btn compose"
            onclick={() => { haptic(); onCompose(); }}
            aria-label="Open in Compose"
          >
            <i class="fas fa-users" aria-hidden="true"></i>
            <span>Compose</span>
          </button>
          {#if onConnect}
            <button
              type="button"
              class="action-btn connect"
              class:active={isSyncActive}
              class:connected={isSyncConnected}
              onclick={() => { haptic(); onConnect(); }}
              disabled={isSyncToggling}
              aria-label={isSyncConnected ? "Disconnect from sync" : isSyncActive ? "Searching..." : "Connect"}
            >
              <i class="fas {isSyncConnected ? 'fa-tower-broadcast' : isSyncActive ? 'fa-spinner fa-pulse' : 'fa-tower-broadcast'}" aria-hidden="true"></i>
              <span>{isSyncConnected ? "Connected" : isSyncActive ? "Searching" : "Connect"}</span>
            </button>
          {/if}
        {:else}
          <button
            type="button"
            class="action-btn get-app"
            onclick={() => { haptic(); onGetApp?.(); }}
            aria-label="Get TKA Scribe"
          >
            <i class="fas fa-arrow-up-right-from-square" aria-hidden="true"></i>
            <span>Get App</span>
          </button>
        {/if}
        <button
          type="button"
          class="action-btn share"
          onclick={() => { haptic(); onShare(); }}
          aria-label="Share"
        >
          <i class="fas fa-share" aria-hidden="true"></i>
          <span>Share</span>
        </button>
        <button
          type="button"
          class="action-btn download"
          onclick={() => { haptic(); onExport(); }}
          aria-label="Download"
        >
          <i class="fas fa-download" aria-hidden="true"></i>
          <span>Download</span>
        </button>
      </div>
    </div>
  </div>

  <!-- Fixed Button Bar (always visible) -->
  <div class="button-bar">
    <button
      type="button"
      class="morph-btn settings"
      class:active={mode === 'settings'}
      onclick={handleSettingsClick}
      aria-label="Settings"
      aria-expanded={mode === 'settings'}
    >
      <i class="fas fa-cog" aria-hidden="true"></i>
    </button>

    <button
      type="button"
      class="morph-btn play"
      class:active={mode === 'playback'}
      onclick={handlePlayClick}
      aria-label={isPlaying ? "Pause" : "Play"}
      aria-expanded={mode === 'playback'}
    >
      <i class="fas {isPlaying ? 'fa-pause' : 'fa-play'}" aria-hidden="true"></i>
    </button>

    <button
      type="button"
      class="morph-btn share"
      class:active={mode === 'actions'}
      onclick={handleShareClick}
      aria-label="Actions"
      aria-expanded={mode === 'actions'}
    >
      <i class="fas fa-share-alt" aria-hidden="true"></i>
    </button>
  </div>
</footer>

<style>
  /* ===========================
     FOOTER BASE
     =========================== */

  .morphing-footer {
    display: flex;
    flex-direction: column;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
    overflow: hidden;
  }

  /* ===========================
     EXPANDED PANEL
     =========================== */

  .expanded-panel {
    max-height: 0;
    opacity: 0;
    overflow: hidden;
    transition: max-height 300ms cubic-bezier(0.32, 0.72, 0, 1),
                opacity 200ms ease-out;
  }

  .expanded-panel.visible {
    max-height: 250px;
    opacity: 1;
  }

  .panel-content {
    opacity: 0;
    pointer-events: none;
    transition: opacity 150ms ease-out;
    padding: 16px 12px 12px;
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .panel-content.active {
    opacity: 1;
    pointer-events: auto;
    position: relative;
  }

  /* ===========================
     CHIP GRID (Settings)
     =========================== */

  .chip-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
  }

  /* ===========================
     PLAYBACK CONTROLS
     =========================== */

  .playback-controls {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    width: 100%;
  }

  /* Step controls - horizontal row of prev/next buttons */
  .step-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .step-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    flex-shrink: 0;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 50%;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition: all var(--duration-normal, 200ms) cubic-bezier(0.4, 0, 0.2, 1);
    -webkit-tap-highlight-color: transparent;
  }

  .step-btn.step-full {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text, rgba(255, 255, 255, 0.9));
  }

  .step-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, white);
  }

  .step-btn:active {
    transform: scale(0.9);
    background: var(--theme-card-hover-bg);
    transition-duration: 0ms;
  }

  .step-btn.stepping {
    border-color: var(--theme-accent, rgba(99, 102, 241, 0.6));
    background: rgba(99, 102, 241, 0.15);
    color: var(--theme-text, white);
    box-shadow: 0 0 10px rgba(99, 102, 241, 0.3);
  }

  .bpm-section {
    width: 100%;
    max-width: 400px;
  }

  /* ===========================
     ACTIONS GRID
     =========================== */

  .actions-grid {
    display: flex;
    align-items: center;
    justify-content: space-evenly;
    gap: 8px;
    width: 100%;
  }

  .action-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    flex: 1;
    min-width: 0;
    height: 48px;
    padding: 8px 4px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .action-btn i {
    font-size: 16px;
  }

  .action-btn span {
    font-size: 11px;
    white-space: nowrap;
  }

  .action-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, white);
  }

  .action-btn:active {
    transform: scale(0.9);
    transition-duration: 0ms;
  }

  .action-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* Color-coded action buttons */
  .action-btn.save {
    background: rgba(34, 197, 94, 0.1);
    border-color: rgba(34, 197, 94, 0.25);
    color: #22c55e;
  }

  .action-btn.save:hover {
    background: rgba(34, 197, 94, 0.2);
    border-color: rgba(34, 197, 94, 0.4);
  }

  .action-btn.compose {
    background: rgba(6, 182, 212, 0.1);
    border-color: rgba(6, 182, 212, 0.25);
    color: #06b6d4;
  }

  .action-btn.compose:hover {
    background: rgba(6, 182, 212, 0.2);
    border-color: rgba(6, 182, 212, 0.4);
  }

  .action-btn.get-app {
    background: rgba(34, 197, 94, 0.1);
    border-color: rgba(34, 197, 94, 0.25);
    color: #22c55e;
  }

  .action-btn.get-app:hover {
    background: rgba(34, 197, 94, 0.2);
    border-color: rgba(34, 197, 94, 0.4);
  }

  .action-btn.share {
    background: rgba(168, 85, 247, 0.1);
    border-color: rgba(168, 85, 247, 0.25);
    color: #a855f7;
  }

  .action-btn.share:hover {
    background: rgba(168, 85, 247, 0.2);
    border-color: rgba(168, 85, 247, 0.4);
  }

  .action-btn.download {
    background: rgba(99, 102, 241, 0.15);
    border-color: rgba(99, 102, 241, 0.35);
    color: #818cf8;
  }

  .action-btn.download:hover {
    background: rgba(99, 102, 241, 0.25);
    border-color: rgba(99, 102, 241, 0.5);
    color: #a5b4fc;
  }

  .action-btn.connect {
    background: rgba(245, 158, 11, 0.1);
    border-color: rgba(245, 158, 11, 0.25);
    color: #f59e0b;
  }

  .action-btn.connect:hover {
    background: rgba(245, 158, 11, 0.2);
    border-color: rgba(245, 158, 11, 0.4);
  }

  .action-btn.connect.active {
    background: rgba(245, 158, 11, 0.15);
    border-color: rgba(245, 158, 11, 0.35);
  }

  .action-btn.connect.connected {
    background: rgba(34, 197, 94, 0.15);
    border-color: rgba(34, 197, 94, 0.35);
    color: #22c55e;
  }

  .action-btn.connect:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* ===========================
     BUTTON BAR (Always Visible)
     =========================== */

  .button-bar {
    display: flex;
    align-items: center;
    justify-content: space-around;
    padding: 12px 24px;
    gap: 16px;
  }

  .morph-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 50%;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
    font-size: 20px;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.32, 0.72, 0, 1);
    -webkit-tap-highlight-color: transparent;
  }

  .morph-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.1));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, white);
  }

  .morph-btn:active {
    transform: scale(0.88);
    transition-duration: 0ms;
  }

  .morph-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* Active states with color coding */
  .morph-btn.settings.active {
    background: rgba(251, 191, 36, 0.15);
    border-color: rgba(251, 191, 36, 0.4);
    color: #fbbf24;
    box-shadow: 0 0 16px rgba(251, 191, 36, 0.2);
  }

  .morph-btn.play {
    /* Play button is larger and more prominent */
    width: 64px;
    height: 64px;
    font-size: 22px;
    background: var(--theme-accent, #6366f1);
    border-color: transparent;
    color: white;
  }

  .morph-btn.play:hover {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 85%, white);
    transform: scale(1.05);
  }

  .morph-btn.play:active {
    transform: scale(0.88);
    transition-duration: 0ms;
  }

  .morph-btn.play.active {
    background: rgba(99, 102, 241, 0.25);
    border: 2px solid rgba(99, 102, 241, 0.5);
    color: #a5b4fc;
    box-shadow: 0 0 20px rgba(99, 102, 241, 0.3);
  }

  .morph-btn.share.active {
    background: rgba(168, 85, 247, 0.15);
    border-color: rgba(168, 85, 247, 0.4);
    color: #a855f7;
    box-shadow: 0 0 16px rgba(168, 85, 247, 0.2);
  }

  /* ===========================
     EXTRA SMALL DEVICES
     =========================== */

  @media (max-width: 375px) {
    .button-bar {
      padding: 10px 16px;
      gap: 12px;
    }

    .morph-btn {
      width: 52px;
      height: 52px;
      font-size: 18px;
    }

    .morph-btn.play {
      width: 60px;
      height: 60px;
      font-size: 20px;
    }

    .action-btn i {
      font-size: 14px;
    }

    .action-btn span {
      font-size: 10px;
    }
  }

  /* ===========================
     ACCESSIBILITY
     =========================== */

  @media (prefers-reduced-motion: reduce) {
    .expanded-panel,
    .panel-content,
    .morph-btn,
    .action-btn {
      transition: none;
    }

    .morph-btn:hover,
    .morph-btn:active,
    .action-btn:active {
      transform: none;
    }
  }
</style>
