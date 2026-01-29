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
    return undefined;
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
        class="action-btn save"
        onclick={onSave}
        aria-label="Save to Library"
      >
        <i class="fas fa-bookmark" aria-hidden="true"></i>
        <span>Save</span>
      </button>
      <button
        type="button"
        class="action-btn compose"
        onclick={onCompose}
        aria-label="Open in Compose"
      >
        <i class="fas fa-users" aria-hidden="true"></i>
        <span>Compose</span>
      </button>
      <button
        type="button"
        class="action-btn share"
        onclick={onShare}
        aria-label="Share"
      >
        <i class="fas fa-share" aria-hidden="true"></i>
        <span>Share</span>
      </button>
      <button
        type="button"
        class="action-btn download"
        onclick={onExport}
        aria-label="Download"
      >
        <i class="fas fa-download" aria-hidden="true"></i>
        <span>Download</span>
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
          class="action-btn save"
          onclick={onSave}
          aria-label="Save to Library"
        >
          <i class="fas fa-bookmark" aria-hidden="true"></i>
          <span>Save</span>
        </button>
        <button
          type="button"
          class="action-btn compose"
          onclick={onCompose}
          aria-label="Open in Compose"
        >
          <i class="fas fa-users" aria-hidden="true"></i>
          <span>Compose</span>
        </button>
        <button
          type="button"
          class="action-btn share"
          onclick={onShare}
          aria-label="Share"
        >
          <i class="fas fa-share" aria-hidden="true"></i>
          <span>Share</span>
        </button>
        <button
          type="button"
          class="action-btn download"
          onclick={onExport}
          aria-label="Download"
        >
          <i class="fas fa-download" aria-hidden="true"></i>
          <span>Download</span>
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
    gap: 2px;
    min-width: 64px;
    height: 48px;
    padding: 6px 14px;
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

  /* ===========================
     BPM COMPACT STYLING
     =========================== */

  .bpm-compact {
    flex: 1;
    min-width: 0;
    max-width: 350px;
  }

  /* Match action button height and styling */
  .bpm-compact :global(.bpm-chips.compact) {
    gap: 6px;
  }

  .bpm-compact :global(.preset-chip) {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    box-shadow: none;
    min-height: 48px;
    padding: 8px 10px;
    font-size: 13px;
  }

  .bpm-compact :global(.preset-chip.active) {
    background: rgba(139, 92, 246, 0.12);
    border-color: rgba(139, 92, 246, 0.3);
    color: #a78bfa;
  }

  .bpm-compact :global(.preset-chip:hover:not(.active)) {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  /* Custom chip - ensure text doesn't truncate */
  .bpm-compact :global(.custom-chip) {
    min-width: 56px;
    max-width: 70px;
    font-size: 11px;
    padding: 8px 6px;
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
