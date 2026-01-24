<!--
  ViewerFooter.svelte

  Unified footer for the Sequence Viewer modal.

  Layout:
  - Desktop: Single row with transport + BPM on left, actions on right
  - Mobile: Two stacked rows (actions on top, playback below)

  Auto-hide behavior (mobile only):
  - Controls visible when modal opens
  - Auto-hide after 3 seconds of playback
  - Tap animation area to toggle visibility
  - Stay visible when paused
-->
<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte.js";
  import TransportControls from "$lib/features/compose/components/controls/TransportControls.svelte";
  import BpmChips from "$lib/features/compose/components/controls/BpmChips.svelte";

  interface Props {
    /** Current BPM value */
    bpm: number;
    /** Whether animation is currently playing */
    isPlaying: boolean;
    /** Whether user is logged in (affects Save button) */
    isLoggedIn: boolean;
    /** Whether controls should be visible (for auto-hide) */
    controlsVisible?: boolean;
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
  }

  let {
    bpm,
    isPlaying,
    isLoggedIn,
    controlsVisible = true,
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
  }: Props = $props();

  // Detect if we're on mobile
  let isMobile = $state(false);

  $effect(() => {
    if (typeof window !== "undefined") {
      const checkMobile = () => {
        isMobile = window.innerWidth < 768;
      };
      checkMobile();
      window.addEventListener("resize", checkMobile);
      return () => window.removeEventListener("resize", checkMobile);
    }
  });
</script>

<footer
  class="viewer-footer"
  class:mobile={isMobile}
  data-controls-visible={controlsVisible}
>
  {#if isMobile}
    <!-- Mobile: Stacked layout -->
    <!-- Row 1: Primary actions (always visible) -->
    <div class="actions-row">
      <button
        type="button"
        class="action-btn"
        onclick={onSave}
        aria-label={t("viewer_save") ?? "Save to Library"}
      >
        <i class="fas fa-bookmark" aria-hidden="true"></i>
        <span>Save</span>
      </button>
      <button
        type="button"
        class="action-btn"
        onclick={onCompose}
        aria-label={t("viewer_compose") ?? "Open in Compose"}
      >
        <i class="fas fa-users" aria-hidden="true"></i>
        <span>Compose</span>
      </button>
      <button
        type="button"
        class="action-btn"
        onclick={onShare}
        aria-label={t("viewer_share") ?? "Share"}
      >
        <i class="fas fa-share" aria-hidden="true"></i>
        <span>Share</span>
      </button>
      <button
        type="button"
        class="action-btn accent"
        onclick={onExport}
        aria-label={t("viewer_export") ?? "Export"}
      >
        <i class="fas fa-download" aria-hidden="true"></i>
        <span>Export</span>
      </button>
    </div>

    <!-- Row 2: Playback controls (auto-hides during playback) -->
    <div class="playback-row" class:hidden={!controlsVisible}>
      <TransportControls
        {isPlaying}
        onPlaybackToggle={onPlayPause}
        onStepHalfBeatBackward={onStepHalfBack ?? (() => {})}
        onStepHalfBeatForward={onStepHalfForward ?? (() => {})}
        onStepFullBeatBackward={onStepBack}
        onStepFullBeatForward={onStepForward}
      />
      <div class="bpm-compact">
        <BpmChips
          {bpm}
          variant="compact"
          {onBpmChange}
        />
      </div>
    </div>
  {:else}
    <!-- Desktop: Single row layout -->
    <div class="desktop-row">
      <div class="playback-section">
        <TransportControls
          {isPlaying}
          onPlaybackToggle={onPlayPause}
          onStepHalfBeatBackward={onStepHalfBack ?? (() => {})}
          onStepHalfBeatForward={onStepHalfForward ?? (() => {})}
          onStepFullBeatBackward={onStepBack}
          onStepFullBeatForward={onStepForward}
        />
        <div class="bpm-compact">
          <BpmChips
            {bpm}
            variant="compact"
            {onBpmChange}
          />
        </div>
      </div>

      <div class="actions-section">
        <button
          type="button"
          class="action-btn"
          onclick={onSave}
          aria-label={t("viewer_save") ?? "Save to Library"}
        >
          <i class="fas fa-bookmark" aria-hidden="true"></i>
          <span>Save</span>
        </button>
        <button
          type="button"
          class="action-btn"
          onclick={onCompose}
          aria-label={t("viewer_compose") ?? "Open in Compose"}
        >
          <i class="fas fa-users" aria-hidden="true"></i>
          <span>Compose</span>
        </button>
        <button
          type="button"
          class="action-btn"
          onclick={onShare}
          aria-label={t("viewer_share") ?? "Share"}
        >
          <i class="fas fa-share" aria-hidden="true"></i>
          <span>Share</span>
        </button>
        <button
          type="button"
          class="action-btn accent"
          onclick={onExport}
          aria-label={t("viewer_export") ?? "Export"}
        >
          <i class="fas fa-download" aria-hidden="true"></i>
          <span>Export</span>
        </button>
      </div>
    </div>
  {/if}
</footer>

<style>
  /* ===========================
     FOOTER BASE
     =========================== */

  .viewer-footer {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
  }

  /* ===========================
     DESKTOP LAYOUT
     =========================== */

  .desktop-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .playback-section {
    display: flex;
    align-items: center;
    gap: 16px;
    flex: 1;
    min-width: 0;
  }

  .actions-section {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  /* ===========================
     MOBILE LAYOUT
     =========================== */

  .viewer-footer.mobile {
    padding: 12px;
    gap: 8px;
  }

  .actions-row {
    display: flex;
    align-items: center;
    justify-content: space-evenly;
    gap: 8px;
  }

  .playback-row {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    transition:
      opacity var(--duration-normal, 200ms) ease-out,
      transform var(--duration-normal, 200ms) ease-out,
      max-height var(--duration-normal, 200ms) ease-out;
    max-height: 200px;
    overflow: hidden;
  }

  .playback-row.hidden {
    opacity: 0;
    transform: translateY(20px);
    max-height: 0;
    pointer-events: none;
  }

  /* ===========================
     ACTION BUTTONS
     =========================== */

  .action-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    min-width: 48px;
    min-height: 48px;
    padding: 8px 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .action-btn i {
    font-size: 16px;
  }

  .action-btn span {
    font-size: var(--font-size-compact, 12px);
    white-space: nowrap;
  }

  .action-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, white);
  }

  .action-btn:active {
    transform: scale(0.95);
    transition-duration: 50ms;
  }

  .action-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* Accent button (Export) */
  .action-btn.accent {
    background: var(--theme-accent, #6366f1);
    border-color: transparent;
    color: white;
  }

  .action-btn.accent:hover {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 85%, white);
    border-color: transparent;
  }

  /* ===========================
     BPM COMPACT STYLING
     =========================== */

  .bpm-compact {
    flex: 1;
    min-width: 200px;
    max-width: 400px;
  }

  /* Demote BPM visually - less prominent */
  .bpm-compact :global(.bpm-chips) {
    opacity: 0.85;
  }

  .bpm-compact :global(.preset-chip) {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-color: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    box-shadow: none;
    min-height: 40px;
  }

  .bpm-compact :global(.preset-chip.active) {
    background: rgba(139, 92, 246, 0.15);
    border-color: rgba(139, 92, 246, 0.3);
    box-shadow: none;
    opacity: 1;
  }

  .bpm-compact :global(.preset-chip:hover:not(.active)) {
    opacity: 1;
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
  }

  /* ===========================
     RESPONSIVE
     =========================== */

  @media (max-width: 767px) {
    .actions-row {
      width: 100%;
    }

    .action-btn {
      flex: 1;
      min-width: 0;
      padding: 8px 4px;
    }

    .action-btn span {
      font-size: 11px;
    }

    .bpm-compact {
      width: 100%;
      max-width: none;
    }
  }

  /* Extra small devices (iPhone SE) */
  @media (max-width: 375px) {
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
    .action-btn,
    .playback-row {
      transition: none;
    }

    .action-btn:active {
      transform: none;
    }

    .playback-row.hidden {
      transform: none;
    }
  }
</style>
