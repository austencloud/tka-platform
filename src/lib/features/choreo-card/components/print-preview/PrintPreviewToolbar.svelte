<script lang="ts">
  import CardSizeToggle from "../card-preview/CardSizeToggle.svelte";
  import type { CardSizeId } from "../../domain/card-sizes";

  interface ThemeOption {
    id: string;
    label: string;
    color: string;
  }

  const THEMES: ThemeOption[] = [
    { id: "nightSky", label: "Night Sky", color: "#1e1b4b" },
    { id: "deepOcean", label: "Deep Ocean", color: "#0c4a6e" },
    { id: "snowfall", label: "Snowfall", color: "#334155" },
    { id: "emberGlow", label: "Ember Glow", color: "#7c2d12" },
    { id: "sakuraDrift", label: "Sakura", color: "#831843" },
    { id: "fireflyForest", label: "Firefly Forest", color: "#14532d" },
    { id: "autumnDrift", label: "Autumn Drift", color: "#d97706" },
    { id: "pride", label: "Pride", color: "#f43f5e" },
  ];

  interface Props {
    cardSize: CardSizeId;
    selectedTheme: string;
    totalCards: number;
    isRendering: boolean;
    isExporting: boolean;
    renderProgress: number;
    renderTotal: number;
    onCardSizeChange: (size: CardSizeId) => void;
    onThemeChange: (themeId: string) => void;
    onExportPDF: () => void;
    onExportZIP: () => void;
    onRerender?: () => void;
  }

  let {
    cardSize,
    selectedTheme,
    totalCards,
    isRendering,
    isExporting,
    renderProgress,
    renderTotal,
    onCardSizeChange,
    onThemeChange,
    onExportPDF,
    onExportZIP,
    onRerender,
  }: Props = $props();

  // Progress text shown while rendering cards
  const progressText = $derived(
    renderTotal > 0
      ? `Rendering ${renderProgress} / ${renderTotal}…`
      : "Rendering…"
  );
</script>

<div class="toolbar" role="toolbar" aria-label="Print preview controls">
  <!-- Left: card size toggle -->
  <div class="toolbar-section size-section">
    <CardSizeToggle selected={cardSize} onchange={onCardSizeChange} />
  </div>

  <!-- Center: theme swatches -->
  <div class="toolbar-section theme-section">
    <span class="section-label">Theme</span>
    <div class="swatches" role="radiogroup" aria-label="Card theme">
      {#each THEMES as theme}
        <button
          class="swatch"
          class:active={selectedTheme === theme.id}
          style="background-color: {theme.color};"
          role="radio"
          aria-checked={selectedTheme === theme.id}
          aria-label={theme.label}
          title={theme.label}
          onclick={() => onThemeChange(theme.id)}
        ></button>
      {/each}
    </div>
  </div>

  <!-- Right: export actions or render progress -->
  <div class="toolbar-section export-section">
    {#if isRendering}
      <span class="progress-text" aria-live="polite" aria-atomic="true">
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        {progressText}
      </span>
    {:else}
      {#if onRerender}
        <button
          class="export-btn"
          disabled={isExporting}
          onclick={onRerender}
          aria-label="Re-render all cards"
          title="Re-render all cards"
        >
          <i class="fas fa-sync-alt" aria-hidden="true"></i>
        </button>
      {/if}
      <button
        class="export-btn"
        disabled={isExporting || totalCards === 0}
        onclick={onExportPDF}
        aria-label="Export as PDF"
      >
        <i class="fas fa-file-pdf" aria-hidden="true"></i>
        <span>PDF</span>
      </button>
      <button
        class="export-btn"
        disabled={isExporting || totalCards === 0}
        onclick={onExportZIP}
        aria-label="Export as ZIP of images"
      >
        <i class="fas fa-file-archive" aria-hidden="true"></i>
        <span>ZIP</span>
      </button>
    {/if}
  </div>
</div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .toolbar-section {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* Push export section to the far right */
  .export-section {
    margin-left: auto;
  }

  /* ── Theme swatches ── */
  .section-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    white-space: nowrap;
    user-select: none;
  }

  .swatches {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .swatch {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    padding: 0;
    transition: border-color 0.15s, transform 0.1s;
    /* Ensure minimum touch target via outline space rather than size */
    outline-offset: 3px;
  }

  .swatch:hover {
    transform: scale(1.15);
  }

  .swatch:focus-visible {
    outline: 2px solid var(--theme-accent, #4a9eff);
    outline-offset: 3px;
  }

  .swatch.active {
    border-color: #fff;
    box-shadow: 0 0 0 2px var(--theme-accent, #4a9eff);
  }

  /* ── Export buttons ── */
  .export-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 0 14px;
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    color: var(--theme-text, #ffffff);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s, border-color 0.15s, opacity 0.15s;
  }

  .export-btn:hover:not(:disabled) {
    background: var(--theme-accent-muted, rgba(74, 158, 255, 0.15));
    border-color: var(--theme-accent, #4a9eff);
  }

  .export-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #4a9eff);
    outline-offset: 2px;
  }

  .export-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* ── Render progress ── */
  .progress-text {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    white-space: nowrap;
  }

  /* ── Mobile: wrap into two rows ── */
  @media (max-width: 767px) {
    .toolbar {
      flex-wrap: wrap;
      row-gap: 8px;
    }

    .export-section {
      margin-left: 0;
      width: 100%;
      justify-content: flex-end;
    }

    .theme-section {
      flex: 1;
    }
  }
</style>
