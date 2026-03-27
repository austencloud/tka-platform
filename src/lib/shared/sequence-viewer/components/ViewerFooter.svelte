<!--
  ViewerFooter.svelte

  Unified footer for the Sequence Viewer modal.

  Layout (ResizeObserver-based):
  - Desktop (wide): Single row with transport + BPM on left, actions on right
  - Mid: MorphChip toolbar when desktop content wouldn't fit
  - Mobile (<600px): Two stacked rows (actions on top, playback below)

  The desktop minimum width is calculated from known component sizes
  (transport controls, tempo section, action buttons). A ResizeObserver
  on the footer element triggers re-evaluation on any width change.

  Auto-hide behavior (mobile only):
  - Controls visible when modal opens
  - Auto-hide after 3 seconds of playback
  - Tap animation area to toggle visibility
  - Stay visible when paused
-->
<script lang="ts">
  import TempoControl from "./TempoControl.svelte";
  import ViewerOverflowMenu from "./ViewerOverflowMenu.svelte";

  interface Props {
    bpm: number;
    isPlaying: boolean;
    isLoggedIn: boolean;
    controlsVisible?: boolean;
    landscape?: boolean;
    practiceActive?: boolean;
    onBpmChange: (bpm: number) => void;
    onPlayPause: () => void;
    onStepBack: () => void;
    onStepForward: () => void;
    onStepHalfBack?: () => void;
    onStepHalfForward?: () => void;
    onRestartToStart?: () => void;
    onSave: () => void;
    onEdit: () => void;
    onGetApp?: () => void;
    onExportVideo?: () => void;
    onExportImage?: () => void;
    onPracticeStart?: () => void;
    onPracticeStop?: () => void;
    isOwned?: boolean;
    onDeleteRequest?: () => void;
    onVideoUpload?: () => void;
    videoCount?: number;
    isSaved?: boolean;
    isPublished?: boolean;
    isFavorite?: boolean;
    onFavorite?: () => void;
    onPublish?: () => void;
    onUnpublish?: () => void;
    onCopyLink?: () => void;
    onPropsOpen?: () => void;
    linkCopied?: boolean;
  }

  let {
    bpm,
    isPlaying,
    isLoggedIn,
    controlsVisible = true,
    landscape = false,
    practiceActive = false,
    onBpmChange,
    onPlayPause,
    onStepBack,
    onStepForward,
    onStepHalfBack,
    onStepHalfForward,
    onRestartToStart,
    onSave,
    onEdit,
    onGetApp,
    onExportVideo,
    onExportImage,
    onPracticeStart,
    onPracticeStop,
    isOwned = false,
    onDeleteRequest,
    onVideoUpload,
    videoCount,
    isSaved = true,
    isPublished = true,
    isFavorite = false,
    onFavorite,
    onPublish,
    onUnpublish,
    onCopyLink,
    onPropsOpen,
    linkCopied = false,
  }: Props = $props();

  // Landscape BPM popover state
  let bpmPopoverOpen = $state(false);

  // Layout detection using ResizeObserver on the footer element.
  // Two layouts for consistency:
  //   - Mid: MorphChip toolbar (default, used on mobile and tablets)
  //   - Desktop: Full single-row layout with all controls visible
  // Desktop minimum width is calculated from known component sizes:
  //   Transport: 5 buttons (48px) + 4 gaps (8px) = 272px
  //   Tempo: BPM display + hold buttons + presets + practice ≈ 400px
  //   Actions: N buttons × ~100px (68px min-width + 32px padding) + gaps
  //   Structural: playback gap (16) + section gap (16) + footer padding (32)
  type FooterLayout = "mid" | "desktop";
  let layout = $state<FooterLayout>("mid");
  let footerEl: HTMLElement | null = $state(null);

  $effect(() => {
    if (!footerEl) return;

    const selectLayout = () => {
      // Three equal thirds need room: tempo with presets (~450px) + transport (~160px) + actions (~200px) + gaps
      const minDesktopWidth = 960;
      layout = footerEl!.clientWidth >= minDesktopWidth ? "desktop" : "mid";
    };

    const observer = new ResizeObserver(() => selectLayout());
    observer.observe(footerEl);
    selectLayout();

    return () => observer.disconnect();
  });
</script>

{#if landscape}
  <!-- Landscape mobile: Vertical column of icon-only buttons on the right side -->
  <aside class="landscape-controls" aria-label="Playback and actions">
    <!-- Play/Pause (prominent, larger) -->
    <button
      type="button"
      class="landscape-btn play-pause"
      onclick={onPlayPause}
      aria-label={isPlaying ? "Pause" : "Play"}
    >
      <i class="fas {isPlaying ? 'fa-pause' : 'fa-play'}" aria-hidden="true"></i>
    </button>

    <!-- Step controls -->
    <button
      type="button"
      class="landscape-btn"
      onclick={onRestartToStart ?? onStepBack}
      aria-label={onRestartToStart ? "Restart from beginning" : "Step backward"}
    >
      <i class="fas {onRestartToStart ? 'fa-backward-fast' : 'fa-backward-step'}" aria-hidden="true"></i>
    </button>
    <button
      type="button"
      class="landscape-btn"
      onclick={onStepForward}
      aria-label="Step forward"
    >
      <i class="fas fa-forward-step" aria-hidden="true"></i>
    </button>

    <!-- BPM display / popover trigger -->
    <div class="landscape-bpm-wrapper">
      <button
        type="button"
        class="landscape-btn bpm-trigger"
        onclick={() => (bpmPopoverOpen = !bpmPopoverOpen)}
        aria-label="Adjust BPM: {bpm}"
        aria-expanded={bpmPopoverOpen}
      >
        <span class="bpm-value">{bpm}</span>
        <span class="bpm-label">BPM</span>
      </button>

      {#if bpmPopoverOpen}
        <!-- BPM popover overlay -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="bpm-popover-backdrop"
          onclick={() => (bpmPopoverOpen = false)}
          onkeydown={(e) => { if (e.key === "Escape") bpmPopoverOpen = false; }}
        ></div>
        <div class="bpm-popover" role="dialog" aria-label="Tempo control">
          <TempoControl
            {bpm}
            {onBpmChange}
            practiceActive={practiceActive}
            onPracticeStart={onPracticeStart}
            onPracticeStop={onPracticeStop}
          />
        </div>
      {/if}
    </div>

    <div class="landscape-divider" aria-hidden="true"></div>

    <!-- Action buttons -->
    {#if isLoggedIn}
      {#if onFavorite}
        <button
          type="button"
          class="landscape-btn"
          class:favorited={isFavorite}
          onclick={onFavorite}
          aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <i class="fas fa-heart" aria-hidden="true"></i>
        </button>
      {/if}
      {#if isOwned && !isSaved}
        <button
          type="button"
          class="landscape-btn save"
          onclick={onSave}
          aria-label="Save"
        >
          <i class="fas fa-floppy-disk" aria-hidden="true"></i>
        </button>
      {/if}
      <button
        type="button"
        class="landscape-btn edit"
        onclick={onEdit}
        aria-label="Remix"
      >
        <i class="fas fa-pen-to-square" aria-hidden="true"></i>
      </button>
    {/if}
    {#if isLoggedIn && onVideoUpload}
      <button
        type="button"
        class="landscape-btn video"
        onclick={onVideoUpload}
        aria-label="Upload video"
      >
        <i class="fas fa-video" aria-hidden="true"></i>
        {#if videoCount && videoCount > 0}
          <span class="video-badge video-badge-sm">{videoCount}</span>
        {/if}
      </button>
    {/if}
    {#if isOwned && isSaved}
      <button
        type="button"
        class="landscape-btn"
        onclick={isPublished ? onUnpublish : onPublish}
        aria-label={isPublished ? "Make Private" : "Make Public"}
      >
        <i class="fas {isPublished ? 'fa-eye-slash' : 'fa-eye'}" aria-hidden="true"></i>
      </button>
      {#if onDeleteRequest}
        <button
          type="button"
          class="landscape-btn delete"
          onclick={onDeleteRequest}
          aria-label="Delete sequence"
        >
          <i class="fas fa-trash" aria-hidden="true"></i>
        </button>
      {/if}
    {/if}
  </aside>
{:else}
<footer
  bind:this={footerEl}
  class="viewer-footer"
  data-controls-visible={controlsVisible}
>
  {#if layout === "mid"}
    <!-- Mid-width: Two-row layout with all controls visible -->
    <div class="mid-layout">
      <!-- Row 1: Tempo (BPM + presets) -->
      <div class="mid-tempo-row">
        <TempoControl
          {bpm}
          {onBpmChange}
          showPresets={true}
          showPractice={false}
        />
      </div>

      <!-- Row 2: Transport + Actions -->
      <div class="mid-controls-row">
        <div class="mid-transport-group">
          {#if onRestartToStart}
            <button
              type="button"
              class="mid-step-btn"
              onclick={onRestartToStart}
              aria-label="Restart from beginning"
            >
              <i class="fas fa-backward-fast" aria-hidden="true"></i>
            </button>
          {/if}
          <button
            type="button"
            class="mid-play-btn"
            class:playing={isPlaying}
            onclick={onPlayPause}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            <i class="fas {isPlaying ? 'fa-pause' : 'fa-play'}" aria-hidden="true"></i>
          </button>
          <button
            type="button"
            class="mid-step-btn"
            onclick={onStepForward}
            aria-label="Next beat"
          >
            <i class="fas fa-forward-step" aria-hidden="true"></i>
          </button>
        </div>

        <div class="mid-actions-group">
          {#if isLoggedIn}
            {#if onFavorite}
              <button
                type="button"
                class="mid-action-btn"
                class:favorited={isFavorite}
                onclick={onFavorite}
                aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
              >
                <i class="fas fa-heart" aria-hidden="true"></i>
              </button>
            {/if}

            {#if isOwned && !isSaved}
              <button
                type="button"
                class="mid-action-btn save"
                onclick={onSave}
                aria-label="Save sequence"
              >
                <i class="fas fa-floppy-disk" aria-hidden="true"></i>
              </button>
            {/if}

            {#if isOwned && isSaved}
              <button
                type="button"
                class="mid-action-btn edit"
                onclick={onEdit}
                aria-label="Remix"
              >
                <i class="fas fa-pen-to-square" aria-hidden="true"></i>
              </button>
            {/if}
          {:else}
            <button
              type="button"
              class="mid-get-app-btn"
              onclick={onGetApp}
              aria-label="Get TKA Composer"
            >
              <i class="fas fa-arrow-up-right-from-square" aria-hidden="true"></i>
              <span>Get App</span>
            </button>
          {/if}

          {#if isLoggedIn && onVideoUpload}
            <button
              type="button"
              class="mid-action-btn video"
              onclick={onVideoUpload}
              aria-label="Upload video"
            >
              <i class="fas fa-video" aria-hidden="true"></i>
              {#if videoCount && videoCount > 0}
                <span class="video-badge video-badge-sm">{videoCount}</span>
              {/if}
            </button>
          {/if}

          <!-- Overflow menu renders for all users — it self-hides when no items -->
          <ViewerOverflowMenu
            {isPublished}
            onCopyLink={isLoggedIn ? onCopyLink : undefined}
            {linkCopied}
            onPropsOpen={isLoggedIn ? onPropsOpen : undefined}
            onPublish={isLoggedIn && isOwned && isSaved ? onPublish : undefined}
            onUnpublish={isLoggedIn && isOwned && isSaved ? onUnpublish : undefined}
            onDeleteRequest={isLoggedIn && isOwned && isSaved ? onDeleteRequest : undefined}
            {practiceActive}
            onPracticeStart={onPracticeStart}
            onPracticeStop={onPracticeStop}
          />
        </div>
      </div>
    </div>
  {:else}
    <!-- Desktop: tempo (shrink) | transport (fixed center) | actions (shrink) -->
    <div class="desktop-row">
      <!-- Left: tempo controls — takes whatever space it needs, no more -->
      <div class="footer-side footer-left">
        <div class="tempo-section">
          <TempoControl
            {bpm}
            {onBpmChange}
            practiceActive={practiceActive}
            onPracticeStart={onPracticeStart}
            onPracticeStop={onPracticeStop}
          />
        </div>
      </div>

      <!-- Center: play + step controls — fixed width, always centered -->
      <div class="footer-center">
        {#if onRestartToStart}
          <button
            type="button"
            class="step-btn"
            onclick={onRestartToStart}
            aria-label="Restart from beginning"
          >
            <i class="fas fa-backward-fast" aria-hidden="true"></i>
          </button>
        {/if}
        <button
          type="button"
          class="play-btn"
          class:playing={isPlaying}
          onclick={onPlayPause}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          <i class="fas {isPlaying ? 'fa-pause' : 'fa-play'}" aria-hidden="true"></i>
        </button>
        <button
          type="button"
          class="step-btn"
          onclick={onStepForward}
          aria-label="Next beat"
        >
          <i class="fas fa-forward-step" aria-hidden="true"></i>
        </button>
      </div>

      <!-- Right: action buttons — takes whatever space it needs -->
      <div class="footer-side footer-right">
        <div class="actions-section">
          {#if isLoggedIn}
            <!-- Favorite heart -->
            {#if onFavorite}
              <button
                type="button"
                class="action-btn"
                class:favorited={isFavorite}
                onclick={onFavorite}
                aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
              >
                <i class="fas fa-heart" aria-hidden="true"></i>
                <span>{isFavorite ? "Favorited" : "Favorite"}</span>
              </button>
            {/if}

            {#if onCopyLink}
              <button
                type="button"
                class="action-btn"
                class:copied={linkCopied}
                onclick={onCopyLink}
                aria-label={linkCopied ? "Link copied" : "Copy shareable link"}
              >
                <i class="fas {linkCopied ? 'fa-check' : 'fa-link'}" aria-hidden="true"></i>
                <span>{linkCopied ? "Copied" : "Copy Link"}</span>
              </button>
            {/if}

            <!-- Save (only when unsaved) -->
            {#if isOwned && !isSaved}
              <button
                type="button"
                class="action-btn save"
                onclick={onSave}
                aria-label="Save sequence"
              >
                <i class="fas fa-floppy-disk" aria-hidden="true"></i>
                <span>Save</span>
              </button>
            {/if}

            <!-- Remix -->
            <button
              type="button"
              class="action-btn edit"
              onclick={onEdit}
              aria-label="Remix"
            >
              <i class="fas fa-pen-to-square" aria-hidden="true"></i>
              <span>Remix</span>
            </button>
          {:else}
            <button
              type="button"
              class="action-btn get-app"
              onclick={onGetApp}
              aria-label="Get TKA Composer"
            >
              <i class="fas fa-arrow-up-right-from-square" aria-hidden="true"></i>
              <span>Get App</span>
            </button>
          {/if}
          {#if isLoggedIn && onVideoUpload}
            <button
              type="button"
              class="action-btn video"
              onclick={onVideoUpload}
              aria-label="Upload video"
            >
              <i class="fas fa-video" aria-hidden="true"></i>
              <span>Video</span>
              {#if videoCount && videoCount > 0}
                <span class="video-badge">{videoCount}</span>
              {/if}
            </button>
          {/if}
          {#if isOwned && isSaved}
            <button
              type="button"
              class="action-btn"
              onclick={isPublished ? onUnpublish : onPublish}
              aria-label={isPublished ? "Make Private" : "Make Public"}
            >
              <i class="fas {isPublished ? 'fa-eye-slash' : 'fa-eye'}" aria-hidden="true"></i>
              <span>{isPublished ? "Make Private" : "Make Public"}</span>
            </button>
            {#if onDeleteRequest}
              <button
                type="button"
                class="action-btn delete"
                onclick={onDeleteRequest}
                aria-label="Delete sequence"
              >
                <i class="fas fa-trash" aria-hidden="true"></i>
                <span>Delete</span>
              </button>
            {/if}
          {/if}
        </div>
      </div>
    </div>
  {/if}
</footer>
{/if}

<style>
  /* ===========================
     LANDSCAPE VERTICAL CONTROLS
     =========================== */

  .landscape-controls {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 6px 4px;
    padding-right: calc(4px + env(safe-area-inset-right, 0px));
    padding-bottom: calc(6px + env(safe-area-inset-bottom, 0px));
    width: 60px;
    height: 100%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: none;
  }

  .landscape-controls::-webkit-scrollbar {
    display: none;
  }

  .landscape-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    min-height: 32px;
    height: 40px;
    border-radius: 10px;
    background: transparent;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 14px;
    cursor: pointer;
    flex-shrink: 1;
    -webkit-tap-highlight-color: transparent;
    transition: all var(--duration-fast, 150ms) ease;
  }

  .landscape-btn:active {
    transform: scale(0.9);
    transition-duration: 0ms;
  }

  .landscape-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .landscape-btn.play-pause {
    width: 44px;
    min-height: 36px;
    height: 44px;
    border-radius: 50%;
    background: var(--theme-accent, #6366f1);
    border-color: transparent;
    color: white;
    font-size: 16px;
    flex-shrink: 0;
  }

  .landscape-btn.play-pause:active {
    background: var(--theme-accent-hover, #4f46e5);
  }

  /* Color-coded landscape buttons */
  .landscape-btn.save { color: #22c55e; border-color: rgba(34, 197, 94, 0.25); }
  .landscape-btn.edit { color: #f59e0b; border-color: rgba(245, 158, 11, 0.25); }
  .landscape-btn.delete { color: var(--semantic-error); border-color: color-mix(in srgb, var(--semantic-error) 25%, transparent); }
  .landscape-btn.favorited { color: var(--semantic-error); border-color: color-mix(in srgb, var(--semantic-error) 25%, transparent); }

  .landscape-divider {
    width: 28px;
    height: 1px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 1;
    margin: 1px 0;
  }

  /* BPM trigger in landscape */
  .landscape-btn.bpm-trigger {
    flex-direction: column;
    gap: 0;
    min-height: 32px;
    height: 40px;
    width: 40px;
    border-color: var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .bpm-value {
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    color: var(--theme-text, white);
    line-height: 1;
  }

  .bpm-label {
    font-size: 9px;
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.5px;
    line-height: 1;
  }

  /* BPM popover */
  .landscape-bpm-wrapper {
    position: relative;
  }

  .bpm-popover-backdrop {
    position: fixed;
    inset: 0;
    z-index: 99;
  }

  .bpm-popover {
    position: absolute;
    right: calc(100% + 8px);
    top: 50%;
    transform: translateY(-50%);
    z-index: 100;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    padding: 12px;
    min-width: 200px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }

  /* ===========================
     FOOTER BASE
     =========================== */

  .viewer-footer {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
  }

  /* ===========================
     MID-WIDTH TWO-ROW LAYOUT
     =========================== */

  .mid-layout {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }

  .mid-tempo-row {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    flex-wrap: wrap;
  }

  .mid-controls-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    gap: 8px;
  }

  .mid-transport-group {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .mid-actions-group {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  /* Transport buttons (mid) */
  .mid-step-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
  }

  @media (hover: hover) and (pointer: fine) {
    .mid-step-btn:hover {
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
      border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
      color: var(--theme-text, white);
    }
  }

  .mid-step-btn:active {
    transform: scale(0.9);
    transition-duration: 0ms;
  }

  .mid-step-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* Play/Pause button (mid) */
  .mid-play-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-accent, rgba(139, 92, 246, 0.4));
    color: var(--theme-accent, rgba(139, 92, 246, 1));
    font-size: var(--font-size-lg, 18px);
    cursor: pointer;
    transition: all var(--duration-normal, 200ms) cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 2px 8px var(--theme-shadow, rgba(0, 0, 0, 0.2));
    -webkit-tap-highlight-color: transparent;
  }

  .mid-play-btn.playing {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, white);
  }

  @media (hover: hover) and (pointer: fine) {
    .mid-play-btn:hover {
      transform: scale(1.05);
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    }
  }

  .mid-play-btn:active {
    transform: scale(0.92);
    transition-duration: 0ms;
  }

  .mid-play-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* Icon-only action buttons (mid) */
  .mid-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 16px;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
    position: relative;
  }

  @media (hover: hover) and (pointer: fine) {
    .mid-action-btn:hover {
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
      border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
      color: var(--theme-text, white);
    }
  }

  .mid-action-btn:active {
    transform: scale(0.9);
    transition-duration: 0ms;
  }

  .mid-action-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* Color-coded mid action buttons */
  .mid-action-btn.save {
    border-color: rgba(34, 197, 94, 0.25);
    color: #22c55e;
  }

  .mid-action-btn.edit {
    border-color: rgba(245, 158, 11, 0.25);
    color: #f59e0b;
  }

  .mid-action-btn.favorited {
    color: var(--semantic-error);
    border-color: color-mix(in srgb, var(--semantic-error) 30%, transparent);
  }

  .mid-action-btn.video {
    position: relative;
  }

  /* Get App pill button (logged-out state) */
  .mid-get-app-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 44px;
    padding: 0 16px;
    background: rgba(34, 197, 94, 0.1);
    border: 1.5px solid rgba(34, 197, 94, 0.25);
    border-radius: 22px;
    color: #22c55e;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
    white-space: nowrap;
  }

  @media (hover: hover) and (pointer: fine) {
    .mid-get-app-btn:hover {
      background: rgba(34, 197, 94, 0.2);
      border-color: rgba(34, 197, 94, 0.4);
    }
  }

  .mid-get-app-btn:active {
    transform: scale(0.95);
    transition-duration: 0ms;
  }

  .mid-get-app-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* Mid-layout reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .mid-step-btn,
    .mid-play-btn,
    .mid-action-btn,
    .mid-get-app-btn {
      transition: none;
    }

    .mid-step-btn:active,
    .mid-play-btn:active,
    .mid-play-btn:hover,
    .mid-action-btn:active,
    .mid-get-app-btn:active {
      transform: none;
    }
  }

  /* ===========================
     DESKTOP LAYOUT
     =========================== */

  .desktop-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  /* Sides take their natural width, don't grow beyond content */
  .footer-side {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .footer-left {
    justify-content: flex-start;
  }

  .footer-right {
    justify-content: flex-end;
    margin-left: auto;
  }

  /* Center transport: pushed to center by the sides */
  .footer-center {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .actions-section {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .step-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .step-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, white);
  }

  .step-btn:active {
    transform: scale(0.9);
    transition-duration: 0ms;
  }

  .play-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-accent, rgba(139, 92, 246, 0.4));
    color: var(--theme-accent, rgba(139, 92, 246, 1));
    font-size: var(--font-size-lg, 18px);
    cursor: pointer;
    transition: all var(--duration-normal, 200ms) cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 2px 8px var(--theme-shadow, rgba(0, 0, 0, 0.2));
    -webkit-tap-highlight-color: transparent;
  }

  .play-btn.playing {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, white);
  }

  .play-btn:hover {
    transform: scale(1.05);
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
  }

  .play-btn:active {
    transform: scale(0.92);
    transition-duration: 0ms;
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
    min-width: 68px;
    height: var(--min-touch-target);
    padding: 6px 16px;
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

  .action-btn.edit {
    background: rgba(245, 158, 11, 0.1);
    border-color: rgba(245, 158, 11, 0.25);
    color: #f59e0b;
  }

  .action-btn.edit:hover {
    background: rgba(245, 158, 11, 0.2);
    border-color: rgba(245, 158, 11, 0.4);
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

  .action-btn.delete {
    background: color-mix(in srgb, var(--semantic-error) 10%, transparent);
    border-color: color-mix(in srgb, var(--semantic-error) 25%, transparent);
    color: var(--semantic-error);
  }

  .action-btn.delete:hover {
    background: color-mix(in srgb, var(--semantic-error) 20%, transparent);
    border-color: color-mix(in srgb, var(--semantic-error) 40%, transparent);
  }

  .action-btn.favorited {
    color: var(--semantic-error);
    border-color: color-mix(in srgb, var(--semantic-error) 30%, transparent);
  }

  .action-btn.favorited:hover {
    background: color-mix(in srgb, var(--semantic-error) 15%, transparent);
  }

  .action-btn.copied {
    color: var(--semantic-success, #22c55e);
    border-color: rgba(34, 197, 94, 0.25);
  }

  /* ===========================
     TEMPO CONTROL SECTION
     =========================== */

  .tempo-section {
    min-width: 0;
    max-width: 500px;
  }

  /* ===========================
     VIDEO COUNT BADGE
     =========================== */

  .action-btn.video,
  .landscape-btn.video {
    position: relative;
  }

  .video-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: var(--theme-accent, #6366f1);
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  /* Smaller badge for landscape icon-only buttons */
  .video-badge-sm {
    position: absolute;
    top: -2px;
    right: -2px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 8px;
    background: var(--theme-accent, #6366f1);
    color: #fff;
    font-size: 10px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
  }

  /* ===========================
     ACCESSIBILITY
     =========================== */

  @media (prefers-reduced-motion: reduce) {
    .action-btn,
    .landscape-btn {
      transition: none;
    }

    .action-btn:active,
    .landscape-btn:active {
      transform: none;
    }
  }
</style>
