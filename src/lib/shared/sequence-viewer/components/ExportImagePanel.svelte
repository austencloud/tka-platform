<!--
  ExportImagePanel.svelte

  Image export settings panel.
  Desktop: side panel next to choreo card preview (all settings visible).
  Mobile: compact bottom bar with [Download Card] [Settings gear].
    Settings open in a slide-up overlay. Choreo card gets full screen space.
-->
<script lang="ts">
  import { fade, slide } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import type { ExportOptionsStateManager } from "../state/export-options-state.svelte";

  type PanelLayout = "sidebar" | "bottom";

  interface Props {
    exportOptions: ExportOptionsStateManager;
    isExporting: boolean;
    layout?: PanelLayout;
    beatCount: number;
    onExport: () => void;
    onClose?: () => void;
  }

  let {
    exportOptions,
    isExporting,
    layout = "bottom",
    beatCount,
    onExport,
    onClose,
  }: Props = $props();

  // Mobile settings drawer state
  let settingsOpen = $state(false);

  /** Summary of current settings for the bottom bar chip */
  const settingsSummary = $derived.by(() => {
    const cols = exportOptions.imageColumnCount ?? "Auto";
    const theme = exportOptions.imageDarkMode ? "Dark" : "Light";
    return `${cols} col · ${theme}`;
  });

  const allColumnOptions = [
    { label: "Auto", value: null },
    { label: "2", value: 2 },
    { label: "3", value: 3 },
    { label: "4", value: 4 },
    { label: "5", value: 5 },
    { label: "6", value: 6 },
    { label: "7", value: 7 },
    { label: "8", value: 8 },
  ] as const;

  // Max columns = beat count only. The start position is an extra cell
  // that doesn't count toward the column limit.
  const columnOptions = $derived(
    allColumnOptions.filter((opt) => opt.value === null || opt.value <= beatCount)
  );

  // If the current selection exceeds the beat count (e.g. user switched
  // to a shorter sequence), reset to Auto.
  $effect(() => {
    const current = exportOptions.imageColumnCount;
    if (current !== null && current > beatCount) {
      exportOptions.setImageColumnCount(null);
    }
  });
</script>

{#if layout === "bottom"}
  <!-- ============================================================
       MOBILE: Compact bottom bar + settings overlay
       ============================================================ -->
  <div
    class="mobile-export"
    role="region"
    aria-label="Card export"
  >
    <!-- Inline settings (collapsible, no overlay) -->
    {#if settingsOpen}
      <div
        class="inline-settings"
        role="region"
        aria-label="Card export settings"
        transition:slide={{ duration: 250, easing: cubicOut }}
      >
        <div class="inline-settings-header">
          <span class="inline-settings-title">Image Settings</span>
          <button
            type="button"
            class="inline-settings-close"
            onclick={() => (settingsOpen = false)}
            aria-label="Close settings"
          >
            <i class="fas fa-chevron-down" aria-hidden="true"></i>
          </button>
        </div>

        <div class="inline-settings-body">
          <!-- Include toggles -->
          <div class="setting-row">
            <span class="setting-label">Include</span>
            <div class="chip-group">
              <button type="button" class="chip" class:active={exportOptions.imageShowWord}
                onclick={() => exportOptions.setImageShowWord(!exportOptions.imageShowWord)}
                aria-pressed={exportOptions.imageShowWord}
              >Word</button>
              <button type="button" class="chip" class:active={exportOptions.imageIncludeStartPosition}
                onclick={() => exportOptions.setImageIncludeStartPosition(!exportOptions.imageIncludeStartPosition)}
                aria-pressed={exportOptions.imageIncludeStartPosition}
              >Start</button>
              <button type="button" class="chip" class:active={exportOptions.imageShowDifficulty}
                onclick={() => exportOptions.setImageShowDifficulty(!exportOptions.imageShowDifficulty)}
                aria-pressed={exportOptions.imageShowDifficulty}
              >Level</button>
              <button type="button" class="chip" class:active={exportOptions.imageShowCreatorName}
                onclick={() => exportOptions.setImageShowCreatorName(!exportOptions.imageShowCreatorName)}
                aria-pressed={exportOptions.imageShowCreatorName}
              >Name</button>
              <button type="button" class="chip" class:active={exportOptions.imageShowNotes}
                onclick={() => exportOptions.setImageShowNotes(!exportOptions.imageShowNotes)}
                aria-pressed={exportOptions.imageShowNotes}
              >Notes</button>
            </div>
          </div>

          <!-- Columns -->
          <div class="setting-row">
            <span class="setting-label">Columns</span>
            <div class="chip-group">
              {#each columnOptions as option}
                <button type="button" class="chip"
                  class:active={exportOptions.imageColumnCount === option.value}
                  onclick={() => exportOptions.setImageColumnCount(option.value)}
                  aria-pressed={exportOptions.imageColumnCount === option.value}
                >{option.label}</button>
              {/each}
            </div>
          </div>

          <!-- Theme -->
          <div class="setting-row">
            <span class="setting-label">Theme</span>
            <div class="chip-group">
              <button type="button" class="chip"
                class:active={!exportOptions.imageDarkMode}
                onclick={() => exportOptions.setImageDarkMode(false)}
                aria-pressed={!exportOptions.imageDarkMode}
              >
                <i class="fas fa-sun" aria-hidden="true"></i> Light
              </button>
              <button type="button" class="chip"
                class:active={exportOptions.imageDarkMode}
                onclick={() => exportOptions.setImageDarkMode(true)}
                aria-pressed={exportOptions.imageDarkMode}
              >
                <i class="fas fa-moon" aria-hidden="true"></i> Dark
              </button>
            </div>
          </div>
        </div>
      </div>
    {/if}

    <div class="mobile-bar">
      <button
        type="button"
        class="bar-export-btn"
        onclick={onExport}
        disabled={isExporting}
        aria-label="Download Card"
      >
        {#if isExporting}
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          Exporting...
        {:else}
          <i class="fas fa-download" aria-hidden="true"></i>
          Download Card
        {/if}
      </button>

      <button
        type="button"
        class="bar-settings-btn"
        class:active={settingsOpen}
        onclick={() => (settingsOpen = !settingsOpen)}
        aria-label="Export settings"
        aria-expanded={settingsOpen}
      >
        <i class="fas fa-cog" aria-hidden="true"></i>
        <span class="settings-summary">{settingsSummary}</span>
      </button>
    </div>
  </div>
{:else}
  <!-- ============================================================
       DESKTOP SIDEBAR: All settings visible (unchanged)
       ============================================================ -->
  <div
    class="export-panel"
    transition:fade={{ duration: 200 }}
    role="region"
    aria-label="Card export settings"
  >
    {#if onClose}
      <div class="panel-header">
        <span class="panel-title">Export Settings</span>
        <button
          type="button"
          class="close-btn"
          onclick={onClose}
          aria-label="Close export panel"
        >
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      </div>
    {/if}

    <div class="panel-body">
      <div class="setting-row">
        <span class="setting-label">Include</span>
        <div class="chip-group">
          <button type="button" class="chip" class:active={exportOptions.imageShowWord}
            onclick={() => exportOptions.setImageShowWord(!exportOptions.imageShowWord)}
            aria-pressed={exportOptions.imageShowWord}
          >Word</button>
          <button type="button" class="chip" class:active={exportOptions.imageIncludeStartPosition}
            onclick={() => exportOptions.setImageIncludeStartPosition(!exportOptions.imageIncludeStartPosition)}
            aria-pressed={exportOptions.imageIncludeStartPosition}
          >Start</button>
          <button type="button" class="chip" class:active={exportOptions.imageShowDifficulty}
            onclick={() => exportOptions.setImageShowDifficulty(!exportOptions.imageShowDifficulty)}
            aria-pressed={exportOptions.imageShowDifficulty}
          >Level</button>
          <button type="button" class="chip" class:active={exportOptions.imageShowCreatorName}
            onclick={() => exportOptions.setImageShowCreatorName(!exportOptions.imageShowCreatorName)}
            aria-pressed={exportOptions.imageShowCreatorName}
          >Name</button>
          <button type="button" class="chip" class:active={exportOptions.imageShowNotes}
            onclick={() => exportOptions.setImageShowNotes(!exportOptions.imageShowNotes)}
            aria-pressed={exportOptions.imageShowNotes}
          >Notes</button>
        </div>
      </div>

      <div class="setting-row">
        <span class="setting-label">Columns</span>
        <div class="chip-group">
          {#each columnOptions as option}
            <button type="button" class="chip"
              class:active={exportOptions.imageColumnCount === option.value}
              onclick={() => exportOptions.setImageColumnCount(option.value)}
              aria-pressed={exportOptions.imageColumnCount === option.value}
            >{option.label}</button>
          {/each}
        </div>
      </div>

      <div class="setting-row">
        <span class="setting-label">Theme</span>
        <div class="chip-group">
          <button type="button" class="chip"
            class:active={!exportOptions.imageDarkMode}
            onclick={() => exportOptions.setImageDarkMode(false)}
            aria-pressed={!exportOptions.imageDarkMode}
          >
            <i class="fas fa-sun" aria-hidden="true"></i> Light
          </button>
          <button type="button" class="chip"
            class:active={exportOptions.imageDarkMode}
            onclick={() => exportOptions.setImageDarkMode(true)}
            aria-pressed={exportOptions.imageDarkMode}
          >
            <i class="fas fa-moon" aria-hidden="true"></i> Dark
          </button>
        </div>
      </div>
    </div>

    <div class="panel-footer">
      <button
        type="button"
        class="export-btn"
        onclick={onExport}
        disabled={isExporting}
        aria-label="Download Card"
      >
        {#if isExporting}
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          Exporting...
        {:else}
          <i class="fas fa-download" aria-hidden="true"></i>
          Download Card
        {/if}
      </button>
    </div>
  </div>
{/if}

<style>
  /* ============================================================
   * MOBILE BOTTOM BAR
   * ============================================================ */

  .mobile-export {
    position: relative;
    flex-shrink: 0;
    /* Cap total height so choreo card preview keeps breathing room */
    max-height: 45vh;
    overflow-y: auto;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
  }

  .mobile-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
  }

  .bar-export-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: var(--min-touch-target);
    padding: 10px 20px;
    border: none;
    border-radius: 12px;
    background: var(--theme-accent, #6366f1);
    color: white;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .bar-export-btn:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .bar-export-btn:active:not(:disabled) {
    transform: scale(0.98);
    transition-duration: 50ms;
  }

  .bar-export-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .bar-settings-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: var(--min-touch-target);
    padding: 8px 12px;
    flex-shrink: 0;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .bar-settings-btn.active {
    border-color: var(--theme-accent, #6366f1);
    color: var(--theme-text, white);
  }

  .settings-summary {
    white-space: nowrap;
  }

  /* ============================================================
   * MOBILE INLINE SETTINGS (collapsible, no overlay)
   * ============================================================ */

  .inline-settings {
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    overflow-y: auto;
    max-height: 35vh;
  }

  .inline-settings-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px 4px;
  }

  .inline-settings-title {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .inline-settings-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: transparent;
    border: none;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .inline-settings-close:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, white);
  }

  .inline-settings-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 2px 12px 8px;
  }

  /* Compact shared controls within mobile inline settings */
  .inline-settings .setting-row {
    gap: 8px;
  }
  .inline-settings .setting-label {
    min-width: 56px;
  }
  .inline-settings .chip-group {
    gap: 6px;
  }
  .inline-settings .chip {
    min-height: 34px;
    padding: 4px 10px;
  }

  /* ============================================================
   * DESKTOP SIDEBAR (unchanged)
   * ============================================================ */

  .export-panel {
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    display: flex;
    flex-direction: column;
    z-index: 10;
    flex-shrink: 0;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    overflow-y: auto;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px 0;
    flex-shrink: 0;
  }

  .panel-title {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 14px;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .close-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, white);
  }

  .close-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* ============================================================
   * SHARED: Settings rows and chips
   * ============================================================ */

  .panel-body {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 12px 16px;
    overflow-y: auto;
  }

  .setting-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .setting-label {
    min-width: 72px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.05em;
    flex-shrink: 0;
  }

  .chip-group {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .chip {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 40px;
    min-width: 40px;
    padding: 6px 14px;
    background: color-mix(in srgb, var(--theme-card-bg) 70%, transparent);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .chip:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, white);
  }

  .chip:active {
    transform: scale(0.92);
    transition-duration: 50ms;
  }

  .chip.active {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 35%, var(--theme-card-bg, rgba(0, 0, 0, 0.4)));
    border-color: color-mix(in srgb, var(--theme-accent, #6366f1) 60%, transparent);
    color: white;
    box-shadow: 0 2px 8px color-mix(in srgb, var(--theme-accent, #6366f1) 25%, transparent);
  }

  .chip:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--theme-accent, #6366f1) 50%, transparent);
    outline-offset: 2px;
  }

  .chip i {
    font-size: 12px;
  }

  .panel-footer {
    padding: 8px 16px 12px;
    flex-shrink: 0;
  }

  .export-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: var(--min-touch-target);
    padding: 12px 24px;
    border: none;
    border-radius: 12px;
    background: var(--theme-accent, #6366f1);
    color: white;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .export-btn:hover:not(:disabled) {
    filter: brightness(1.1);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--theme-accent, #6366f1) 40%, transparent);
  }

  .export-btn:active:not(:disabled) {
    transform: scale(0.98);
    transition-duration: 50ms;
  }

  .export-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* ============================================================
   * Reduced motion
   * ============================================================ */

  @media (prefers-reduced-motion: reduce) {
    .chip, .export-btn, .bar-export-btn,
    .bar-settings-btn, .inline-settings-close {
      transition: none !important;
      animation: none !important;
    }

    .chip:active, .export-btn:active, .bar-export-btn:active {
      transform: none !important;
    }
  }
</style>
