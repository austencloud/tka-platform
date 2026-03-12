<!--
  ExportImagePanel.svelte

  Image export settings panel.
  Desktop: side panel next to choreo card preview (all settings visible).
  Mobile: compact bottom bar with [Export Image] [Settings gear].
    Settings open in a slide-up overlay. Choreo card gets full screen space.
-->
<script lang="ts">
  import { fade } from "svelte/transition";
  import type { ExportOptionsStateManager } from "../state/export-options-state.svelte";

  type PanelLayout = "sidebar" | "bottom";

  interface Props {
    exportOptions: ExportOptionsStateManager;
    isExporting: boolean;
    layout?: PanelLayout;
    onExport: () => void;
    onClose?: () => void;
  }

  let {
    exportOptions,
    isExporting,
    layout = "bottom",
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

  const columnOptions = [
    { label: "Auto", value: null },
    { label: "2", value: 2 },
    { label: "3", value: 3 },
    { label: "4", value: 4 },
    { label: "5", value: 5 },
    { label: "6", value: 6 },
  ] as const;
</script>

{#if layout === "bottom"}
  <!-- ============================================================
       MOBILE: Compact bottom bar + settings overlay
       ============================================================ -->
  <div
    class="mobile-export"
    transition:fade={{ duration: 200 }}
    role="region"
    aria-label="Image export"
  >
    <div class="mobile-bar">
      <button
        type="button"
        class="bar-export-btn"
        onclick={onExport}
        disabled={isExporting}
        aria-label="Export image"
      >
        {#if isExporting}
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          Exporting...
        {:else}
          <i class="fas fa-download" aria-hidden="true"></i>
          Export Image
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

    <!-- Settings overlay (slides up) -->
    {#if settingsOpen}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="settings-backdrop"
        onclick={() => (settingsOpen = false)}
        onkeydown={(e) => { if (e.key === "Escape") settingsOpen = false; }}
      ></div>
      <!-- svelte-ignore a11y_interactive_supports_focus -->
      <div
        class="settings-sheet"
        role="dialog"
        aria-label="Image export settings"
        onkeydown={(e) => { if (e.key === "Escape") settingsOpen = false; }}
      >
        <div class="sheet-header">
          <span class="sheet-title">Image Settings</span>
          <button
            type="button"
            class="sheet-close"
            onclick={() => (settingsOpen = false)}
            aria-label="Close settings"
          >
            <i class="fas fa-times" aria-hidden="true"></i>
          </button>
        </div>

        <div class="sheet-body">
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
  </div>
{:else}
  <!-- ============================================================
       DESKTOP SIDEBAR: All settings visible (unchanged)
       ============================================================ -->
  <div
    class="export-panel"
    transition:fade={{ duration: 200 }}
    role="region"
    aria-label="Image export settings"
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
        aria-label="Export image"
      >
        {#if isExporting}
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          Exporting...
        {:else}
          <i class="fas fa-download" aria-hidden="true"></i>
          Export Image
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
   * MOBILE SETTINGS SHEET (slide-up overlay)
   * ============================================================ */

  .settings-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 50;
  }

  .settings-sheet {
    position: absolute;
    bottom: 100%;
    left: 0;
    right: 0;
    z-index: 51;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-bottom: none;
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.4);
    animation: sheet-slide-up 200ms cubic-bezier(0.4, 0, 0.2, 1) both;
    max-height: 60vh;
    overflow-y: auto;
  }

  @keyframes sheet-slide-up {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px 8px;
    position: sticky;
    top: 0;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    z-index: 1;
  }

  .sheet-title {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .sheet-close {
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

  .sheet-close:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, white);
  }

  .sheet-body {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 8px 16px 16px;
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
    .bar-settings-btn, .settings-sheet {
      transition: none !important;
      animation: none !important;
    }

    .chip:active, .export-btn:active, .bar-export-btn:active {
      transform: none !important;
    }
  }
</style>
