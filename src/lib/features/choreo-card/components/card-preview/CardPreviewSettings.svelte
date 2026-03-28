<script lang="ts">
  import type { CardSizeId } from "../../domain/card-sizes";

  interface ThemeOption {
    id: string;
    label: string;
    color: string;
  }

  interface Props {
    isOpen: boolean;
    showGrid: boolean;
    showTKA: boolean;
    showWord: boolean;
    includeStartPosition: boolean;
    handPointsVisible: boolean;
    selectedTheme: string;
    themeOptions: readonly ThemeOption[];
    exportFormat: "pdf" | "zip";
    cardSize: CardSizeId;
    totalCards: number;
    isExporting: boolean;
    hasRenderedCards: boolean;
    onToggle: () => void;
    onVisibilityChange: (key: string, value: boolean) => void;
    onThemeChange: (themeId: string) => void;
    onExportFormatChange: (format: "pdf" | "zip") => void;
    onExport: () => void;
  }

  let {
    isOpen,
    showGrid,
    showTKA,
    showWord,
    includeStartPosition,
    handPointsVisible,
    selectedTheme,
    themeOptions,
    exportFormat,
    cardSize,
    totalCards,
    isExporting,
    hasRenderedCards,
    onToggle,
    onVisibilityChange,
    onThemeChange,
    onExportFormatChange,
    onExport,
  }: Props = $props();
</script>

{#if isOpen}
  <aside class="settings-panel">
    <div class="settings-header">
      <h3>Settings</h3>
      <button class="close-btn" onclick={onToggle} aria-label="Close settings">
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>

    <section class="settings-section">
      <h4>Visibility</h4>
      <button class="toggle-row" onclick={() => onVisibilityChange('showGrid', !showGrid)}>
        <span class="toggle-indicator" class:on={showGrid}></span>
        Grid
      </button>
      <button class="toggle-row" onclick={() => onVisibilityChange('showTKA', !showTKA)}>
        <span class="toggle-indicator" class:on={showTKA}></span>
        TKA Notation
      </button>
      <button class="toggle-row" onclick={() => onVisibilityChange('showWord', !showWord)}>
        <span class="toggle-indicator" class:on={showWord}></span>
        Word
      </button>
      <button class="toggle-row" onclick={() => onVisibilityChange('includeStartPosition', !includeStartPosition)}>
        <span class="toggle-indicator" class:on={includeStartPosition}></span>
        Start Position
      </button>
      <button class="toggle-row" onclick={() => onVisibilityChange('handPointsVisible', !handPointsVisible)}>
        <span class="toggle-indicator" class:on={handPointsVisible}></span>
        Hand Points
      </button>
    </section>

    <section class="settings-section">
      <h4>Card Back Theme</h4>
      <div class="theme-grid">
        {#each themeOptions as theme}
          <button
            class="theme-swatch"
            class:active={selectedTheme === theme.id}
            style:background={theme.color}
            title={theme.label}
            onclick={() => onThemeChange(theme.id)}
            aria-label="Theme: {theme.label}"
          ></button>
        {/each}
      </div>
    </section>

    <section class="settings-section">
      <h4>Export</h4>
      <div class="export-format">
        <button
          class="format-btn"
          class:active={exportFormat === 'pdf'}
          onclick={() => onExportFormatChange('pdf')}
        >PDF</button>
        <button
          class="format-btn"
          class:active={exportFormat === 'zip'}
          onclick={() => onExportFormatChange('zip')}
        >ZIP</button>
      </div>
      <button
        class="export-btn"
        disabled={!hasRenderedCards || isExporting || totalCards === 0}
        onclick={onExport}
      >
        {#if isExporting}
          Exporting...
        {:else}
          Export {totalCards} cards ({cardSize})
        {/if}
      </button>
    </section>
  </aside>
{/if}

<style>
  .settings-panel {
    width: 260px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    padding: 16px;
    overflow-y: auto;
    flex-shrink: 0;
  }

  .settings-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .settings-header h3 {
    margin: 0;
    font-size: var(--font-size-min, 14px);
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    padding: 4px;
  }

  .settings-section {
    margin-bottom: 20px;
  }

  .settings-section h4 {
    margin: 0 0 8px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .toggle-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    color: var(--theme-text, #ffffff);
    background: none;
    border: none;
    width: 100%;
    text-align: left;
  }

  .toggle-indicator {
    width: 32px;
    height: 18px;
    border-radius: 9px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.15));
    position: relative;
    transition: background 0.15s;
    flex-shrink: 0;
  }

  .toggle-indicator::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #fff;
    transition: transform 0.15s;
  }

  .toggle-indicator.on {
    background: var(--theme-accent, #4a9eff);
  }

  .toggle-indicator.on::after {
    transform: translateX(14px);
  }

  .theme-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .theme-swatch {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: 2px solid transparent;
    cursor: pointer;
    transition: border-color 0.15s;
  }

  .theme-swatch.active {
    border-color: #fff;
  }

  .export-format {
    display: flex;
    gap: 4px;
    margin-bottom: 8px;
  }

  .format-btn {
    flex: 1;
    padding: 6px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    background: transparent;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    font-size: var(--font-size-compact, 12px);
  }

  .format-btn.active {
    background: var(--theme-accent, #4a9eff);
    color: #fff;
    border-color: var(--theme-accent, #4a9eff);
  }

  .export-btn {
    width: 100%;
    padding: 10px;
    border-radius: 8px;
    border: none;
    background: var(--theme-accent, #4a9eff);
    color: #fff;
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
  }

  .export-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
