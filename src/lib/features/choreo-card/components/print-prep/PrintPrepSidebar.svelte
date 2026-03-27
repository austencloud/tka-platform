<!--
  PrintPrepSidebar.svelte - Sidebar for print preparation settings

  Contains card specs, export format picker, settings toggles,
  theme swatches, and MPC upload guide.
-->
<script lang="ts">
  interface ThemeOption {
    id: string;
    label: string;
    color: string;
  }

  interface Props {
    exportFormat: "pdf" | "zip";
    includeInfoCards: boolean;
    showBleedOverlay: boolean;
    selectedTheme: string;
    themeOptions: readonly ThemeOption[];
    totalCards: number;
    isRendering: boolean;
    isExporting: boolean;
    exportProgress: number;
    exportTotal: number;
    hasRenderedCards: boolean;
    onExportFormatChange: (format: "pdf" | "zip") => void;
    onExport: () => void;
    onToggleInfoCards: () => void;
    onToggleBleedOverlay: () => void;
    onThemeChange: (themeId: string) => void;
  }

  let {
    exportFormat,
    includeInfoCards,
    showBleedOverlay,
    selectedTheme,
    themeOptions,
    totalCards,
    isRendering,
    isExporting,
    exportProgress,
    exportTotal,
    hasRenderedCards,
    onExportFormatChange,
    onExport,
    onToggleInfoCards,
    onToggleBleedOverlay,
    onThemeChange,
  }: Props = $props();
</script>

<aside class="prep-sidebar themed-scrollbar">
  <!-- Card Specs -->
  <section class="sidebar-section">
    <h3 class="section-heading">Card Specs</h3>
    <div class="spec-grid">
      <div class="spec-item">
        <span class="spec-label">Size</span>
        <span class="spec-value">2.5" x 3.5"</span>
      </div>
      <div class="spec-item">
        <span class="spec-label">Resolution</span>
        <span class="spec-value">300 DPI</span>
      </div>
      <div class="spec-item">
        <span class="spec-label">Bleed</span>
        <span class="spec-value">36px (0.12")</span>
      </div>
      <div class="spec-item">
        <span class="spec-label">Pixels</span>
        <span class="spec-value">822 x 1122</span>
      </div>
    </div>
    <p class="spec-note">Standard poker card. Compatible with MakePlayingCards, DriveThruCards, and most print services.</p>
  </section>

  <div class="sidebar-divider"></div>

  <!-- Export -->
  <section class="sidebar-section">
    <h3 class="section-heading">Export</h3>
    <div class="export-format-picker">
      <button
        class="format-option"
        class:active={exportFormat === "zip"}
        onclick={() => onExportFormatChange("zip")}
      >
        <i class="fas fa-file-zipper" aria-hidden="true"></i>
        <span class="format-label">ZIP (PNGs)</span>
        <span class="format-desc">For print services</span>
      </button>
      <button
        class="format-option"
        class:active={exportFormat === "pdf"}
        onclick={() => onExportFormatChange("pdf")}
      >
        <i class="fas fa-file-pdf" aria-hidden="true"></i>
        <span class="format-label">PDF</span>
        <span class="format-desc">For home printing</span>
      </button>
    </div>
    <button
      class="export-btn"
      onclick={onExport}
      disabled={isRendering || isExporting || !hasRenderedCards}
    >
      {#if isExporting}
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        Exporting {exportProgress}/{exportTotal}...
      {:else}
        <i class="fas fa-download" aria-hidden="true"></i>
        Export {totalCards} card{totalCards !== 1 ? "s" : ""}
      {/if}
    </button>
  </section>

  <div class="sidebar-divider"></div>

  <!-- Settings -->
  <section class="sidebar-section">
    <h3 class="section-heading">Settings</h3>
    <button
      class="toggle-chip"
      class:active={includeInfoCards}
      onclick={onToggleInfoCards}
      aria-pressed={includeInfoCards}
    >
      <i class="fas fa-book-open" aria-hidden="true"></i>
      Rules card
    </button>
    <button
      class="toggle-chip"
      class:active={showBleedOverlay}
      onclick={onToggleBleedOverlay}
      aria-pressed={showBleedOverlay}
    >
      <i class="fas fa-crop-alt" aria-hidden="true"></i>
      Bleed zone
    </button>
  </section>

  <div class="sidebar-divider"></div>

  <!-- Theme -->
  <section class="sidebar-section">
    <h3 class="section-heading">Card Back Theme</h3>
    <div class="theme-grid">
      {#each themeOptions as theme}
        <button
          class="theme-swatch"
          class:active={selectedTheme === theme.id}
          style="--swatch-color: {theme.color}"
          onclick={() => onThemeChange(theme.id)}
          title={theme.label}
          aria-label="Select {theme.label} theme"
        >
          <span class="swatch-dot"></span>
          <span class="swatch-label">{theme.label}</span>
        </button>
      {/each}
    </div>
  </section>

  <div class="sidebar-divider"></div>

  <!-- MPC Guide -->
  <section class="sidebar-section">
    <h3 class="section-heading">Print Service Guide</h3>
    <ol class="mpc-steps">
      <li>
        <strong>Export as ZIP</strong> to get individual front/back PNGs in separate folders.
      </li>
      <li>
        <strong>Upload fronts</strong> to your print service's "card fronts" upload area.
      </li>
      <li>
        <strong>Upload backs</strong> to the "card backs" area. Files are numbered to match.
      </li>
      <li>
        <strong>Order</strong> as "Poker Size" (2.5" x 3.5") with your preferred card stock.
      </li>
    </ol>
  </section>
</aside>

<style>
  .prep-sidebar {
    width: 260px;
    flex-shrink: 0;
    overflow-y: auto;
    padding: 16px;
    border-right: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .sidebar-section {
    padding: 12px 0;
  }

  .sidebar-section:first-child {
    padding-top: 0;
  }

  .sidebar-divider {
    height: 1px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .section-heading {
    margin: 0 0 10px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  /* ── Spec grid ───────────────────────────────────────────────────── */
  .spec-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .spec-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .spec-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  .spec-value {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    font-variant-numeric: tabular-nums;
  }

  .spec-note {
    margin: 10px 0 0;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.35));
    line-height: 1.4;
  }

  /* ── Export format picker ────────────────────────────────────────── */
  .export-format-picker {
    display: flex;
    gap: 8px;
    margin-bottom: 10px;
  }

  .format-option {
    flex: 1;
    padding: 8px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    font-size: var(--font-size-compact, 12px);
    min-height: 44px;
  }

  .format-option i {
    font-size: 16px;
  }

  .format-option.active {
    border-color: #059669;
    background: rgba(5, 150, 105, 0.1);
    color: #34d399;
  }

  .format-option:hover:not(.active) {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #ffffff);
  }

  .format-option:focus-visible {
    outline: 2px solid #059669;
    outline-offset: 2px;
  }

  .format-label {
    font-weight: 600;
    font-size: var(--font-size-compact, 12px);
  }

  .format-desc {
    font-size: 10px;
    opacity: 0.7;
  }

  .export-btn {
    width: 100%;
    padding: 10px 16px;
    border: none;
    border-radius: 8px;
    background: #059669;
    color: #ffffff;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 44px;
  }

  .export-btn:hover:not(:disabled) {
    background: #047857;
  }

  .export-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .export-btn:focus-visible {
    outline: 2px solid #059669;
    outline-offset: 2px;
  }

  /* ── Toggle chips ────────────────────────────────────────────────── */
  .toggle-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    min-height: 36px;
    text-align: left;
  }

  .toggle-chip:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, rgba(255, 255, 255, 0.8));
  }

  .toggle-chip.active {
    background: rgba(5, 150, 105, 0.15);
    border-color: rgba(5, 150, 105, 0.4);
    color: #34d399;
  }

  .toggle-chip:focus-visible {
    outline: 2px solid #059669;
    outline-offset: 2px;
  }

  /* ── Theme grid ──────────────────────────────────────────────────── */
  .theme-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .theme-swatch {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: 11px;
    min-height: 32px;
  }

  .theme-swatch.active {
    border-color: var(--swatch-color);
    background: color-mix(in srgb, var(--swatch-color) 12%, transparent);
    color: var(--theme-text, #ffffff);
  }

  .theme-swatch:hover:not(.active) {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
  }

  .theme-swatch:focus-visible {
    outline: 2px solid var(--swatch-color);
    outline-offset: 2px;
  }

  .swatch-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--swatch-color);
    flex-shrink: 0;
  }

  .swatch-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── MPC Steps ───────────────────────────────────────────────────── */
  .mpc-steps {
    margin: 0;
    padding: 0 0 0 20px;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.45));
    line-height: 1.5;
  }

  .mpc-steps li {
    margin-bottom: 8px;
  }

  .mpc-steps li:last-child {
    margin-bottom: 0;
  }

  .mpc-steps strong {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.65));
  }

  /* ── Responsive ──────────────────────────────────────────────────── */
  @media (max-width: 900px) {
    .prep-sidebar {
      width: 100%;
      max-height: 200px;
      border-right: none;
      border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
      flex-direction: row;
      flex-wrap: nowrap;
      overflow-x: auto;
      overflow-y: hidden;
      gap: 16px;
      padding: 12px 16px;
    }

    .sidebar-section {
      flex-shrink: 0;
      min-width: 200px;
      padding: 0;
    }

    .sidebar-divider {
      width: 1px;
      height: auto;
      min-height: 40px;
    }
  }

  @media (max-width: 600px) {
    .prep-sidebar {
      max-height: 160px;
    }

    .sidebar-section {
      min-width: 180px;
    }
  }
</style>
