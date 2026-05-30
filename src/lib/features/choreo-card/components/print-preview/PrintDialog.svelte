<script lang="ts">
  import { CARD_SIZES, getPageLayout, type CardSizeId } from "../../domain/card-sizes";
  import { TND_ELEMENTS, type TnDElement } from "../../domain/tnd-element";
  import type { PrintPDFMode } from "../../services/print-pdf-exporter";
  import CardSizeToggle from "../card-preview/CardSizeToggle.svelte";

  type ExportFormat = "fronts" | "backs" | "combined" | "zip";

  interface Props {
    title: string;
    subtitle?: string;
    cardCount: number;
    tndElements?: (TnDElement | undefined)[];
    cardSize: CardSizeId;
    theme: string;
    isExporting: boolean;
    exportProgress: number;
    exportTotal: number;
    exportError: string;
    onExportPDF: (mode: PrintPDFMode, copies: number) => void;
    onExportZIP: () => void;
    onCardSizeChange: (size: CardSizeId) => void;
    onClose: () => void;
  }

  let {
    title,
    subtitle = "",
    cardCount,
    tndElements = [],
    cardSize,
    theme,
    isExporting,
    exportProgress,
    exportTotal,
    exportError,
    onExportPDF,
    onExportZIP,
    onCardSizeChange,
    onClose,
  }: Props = $props();

  let selectedFormat = $state<ExportFormat>("fronts");
  let copies = $state(1);

  const sizeSpec = $derived(CARD_SIZES[cardSize]);
  const layout = $derived(getPageLayout(cardSize));

  // Sheets = Σ over colors of ceil(colorCount * copies / cardsPerPage), because
  // each color is padded to whole sheets. Falls back to a flat estimate when the
  // deck carries no element tags.
  const sheetCount = $derived.by(() => {
    const perPage = layout.cardsPerPage;
    const tagged = tndElements.filter((e): e is TnDElement => !!e);
    if (tagged.length === 0) {
      return Math.ceil((cardCount * copies) / perPage);
    }
    const counts = new Map<string, number>();
    let untagged = 0;
    for (const el of tndElements) {
      if (el) counts.set(el.element, (counts.get(el.element) ?? 0) + 1);
      else untagged++;
    }
    let sheets = 0;
    for (const c of counts.values()) sheets += Math.ceil((c * copies) / perPage);
    if (untagged) sheets += Math.ceil((untagged * copies) / perPage);
    return sheets;
  });

  const elementCounts = $derived.by(() => {
    const counts = new Map<string, { element: TnDElement; count: number }>();
    for (const el of tndElements) {
      if (!el) continue;
      const entry = counts.get(el.element);
      if (entry) entry.count++;
      else counts.set(el.element, { element: el, count: 1 });
    }
    const perPage = layout.cardsPerPage;
    return TND_ELEMENTS
      .filter((e) => counts.has(e.element))
      .map((e) => {
        const { element, count } = counts.get(e.element)!;
        return { element, count, sheets: Math.ceil((count * copies) / perPage) };
      });
  });

  const FORMAT_OPTIONS: {
    id: ExportFormat;
    icon: string;
    label: string;
    getDetail: () => string;
    getHint: () => string;
  }[] = [
    {
      id: "fronts",
      icon: "fa-layer-group",
      label: "Fronts Only",
      getDetail: () => `${sheetCount} sheets`,
      getHint: () => "Print first. Card fronts arranged in a grid.",
    },
    {
      id: "backs",
      icon: "fa-rotate",
      label: "Backs Only",
      getDetail: () => `${sheetCount} sheets`,
      getHint: () => "Print second. Columns mirrored for long-edge duplex.",
    },
    {
      id: "combined",
      icon: "fa-book-open",
      label: "Combined PDF",
      getDetail: () => `${sheetCount * 2 + 2} pages`,
      getHint: () => "Fronts + flip instructions + backs + finishing tips.",
    },
    {
      id: "zip",
      icon: "fa-images",
      label: "Card Images",
      getDetail: () => `${cardCount * 2} PNGs`,
      getHint: () => "Individual files for MPC or custom layouts.",
    },
  ];

  const actionLabel = $derived.by(() => {
    if (isExporting) {
      return exportTotal > 0
        ? `Exporting ${exportProgress} / ${exportTotal}...`
        : "Preparing...";
    }
    const opt = FORMAT_OPTIONS.find((f) => f.id === selectedFormat)!;
    return `Download ${opt.label}`;
  });

  function handleExport() {
    if (isExporting) return;
    const safeCopies = Math.max(1, Math.floor(copies || 1));
    if (selectedFormat === "zip") onExportZIP();
    else onExportPDF(selectedFormat, safeCopies);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && !isExporting) onClose();
  }

  function handleBackdropClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains("dialog-backdrop") && !isExporting) {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="dialog-backdrop" role="presentation" onclick={handleBackdropClick}>
  <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="print-dialog-title">
    <button
      class="close-btn"
      onclick={onClose}
      disabled={isExporting}
      aria-label="Close"
    >
      <i class="fas fa-times" aria-hidden="true"></i>
    </button>

    <!-- Header -->
    <div class="header">
      <h2 id="print-dialog-title">{title}</h2>
      {#if subtitle}
        <p class="subtitle">{subtitle}</p>
      {/if}
    </div>

    <!-- Deck summary -->
    <div class="summary">
      <div class="summary-row">
        <span class="summary-label">Cards</span>
        <span class="summary-value">{cardCount}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Sheets</span>
        <span class="summary-value">{sheetCount} ({layout.cols}&times;{layout.rows} per sheet)</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Size</span>
        <span class="summary-value">
          <CardSizeToggle selected={cardSize} onchange={onCardSizeChange} />
        </span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Theme</span>
        <span class="summary-value theme-badge">{theme}</span>
      </div>
    </div>

    <!-- Element breakdown -->
    {#if elementCounts.length > 0}
      <div class="elements" aria-label="Element breakdown">
        {#each elementCounts as { element, count, sheets }}
          <div
            class="element-pill"
            style="--el-color: {element.accentColor}"
            title="{count} card{count === 1 ? '' : 's'} × {copies} = {sheets} sheet{sheets === 1 ? '' : 's'}"
          >
            <img
              src={element.iconPath}
              alt={element.element}
              class="element-icon"
              width="16"
              height="16"
            />
            <span class="element-count">{count} · {sheets}sh</span>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Format selector -->
    <div class="format-section">
      <h3 class="section-label">Export Format</h3>
      <div class="format-grid" role="radiogroup" aria-label="Export format">
        {#each FORMAT_OPTIONS as opt (opt.id)}
          <button
            class="format-card"
            class:selected={selectedFormat === opt.id}
            role="radio"
            aria-checked={selectedFormat === opt.id}
            onclick={() => { selectedFormat = opt.id; }}
          >
            <i class="fas {opt.icon} format-icon" aria-hidden="true"></i>
            <span class="format-label">{opt.label}</span>
            <span class="format-detail">{opt.getDetail()}</span>
          </button>
        {/each}
      </div>
      <p class="format-hint">
        {FORMAT_OPTIONS.find((f) => f.id === selectedFormat)?.getHint()}
      </p>

      {#if selectedFormat !== "zip"}
        <div class="copies-row">
          <label class="copies-label" for="print-copies">Copies per card</label>
          <input
            id="print-copies"
            class="copies-input"
            type="number"
            min="1"
            step="1"
            bind:value={copies}
            onblur={() => { copies = Math.max(1, Math.floor(copies || 1)); }}
          />
        </div>
      {/if}
    </div>

    <!-- Error -->
    {#if exportError}
      <div class="error" role="alert">
        <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
        {exportError}
      </div>
    {/if}

    <!-- Action -->
    <button
      class="export-action"
      disabled={isExporting}
      onclick={handleExport}
    >
      {#if isExporting}
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      {:else}
        <i class="fas fa-download" aria-hidden="true"></i>
      {/if}
      <span>{actionLabel}</span>
    </button>

    <!-- Workflow tip -->
    {#if selectedFormat === "fronts" || selectedFormat === "backs"}
      <p class="workflow-tip">
        {#if selectedFormat === "fronts"}
          Print this first. Then download the backs PDF, flip your paper stack on the <strong>long edge</strong>, and print again.
        {:else}
          Make sure you've already printed the fronts. Flip the stack on the <strong>long edge</strong> before feeding it back in.
        {/if}
      </p>
    {/if}
  </div>
</div>

<style>
  .dialog-backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal, 9000);
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    animation: fadeIn 150ms ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .dialog {
    position: relative;
    background: #151520;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 32px;
    max-width: 520px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .close-btn {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: rgba(255, 255, 255, 0.35);
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
  }

  .close-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.7);
  }

  .close-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .header {
    text-align: center;
    padding-right: 36px;
  }

  .header h2 {
    margin: 0;
    font-size: 22px;
    font-weight: 700;
    color: #fff;
    font-family: "JetBrains Mono", monospace;
  }

  .subtitle {
    margin: 4px 0 0;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.45);
  }

  .summary {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px 16px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
  }

  .summary-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 28px;
  }

  .summary-label {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.4);
  }

  .summary-value {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.8);
    font-variant-numeric: tabular-nums;
  }

  .theme-badge {
    text-transform: capitalize;
    padding: 2px 10px;
    background: rgba(139, 92, 246, 0.12);
    border: 1px solid rgba(139, 92, 246, 0.25);
    border-radius: 6px;
    font-size: 12px;
    color: #a78bfa;
  }

  .elements {
    display: flex;
    gap: 6px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .element-pill {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    background: color-mix(in srgb, var(--el-color) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--el-color) 25%, transparent);
    border-radius: 20px;
  }

  .element-icon {
    width: 16px;
    height: 16px;
    object-fit: contain;
  }

  .element-count {
    font-size: 13px;
    font-weight: 600;
    color: var(--el-color);
    font-variant-numeric: tabular-nums;
  }

  .format-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .section-label {
    margin: 0;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(255, 255, 255, 0.3);
  }

  .format-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .format-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 16px 12px;
    background: rgba(255, 255, 255, 0.02);
    border: 1.5px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    color: rgba(255, 255, 255, 0.5);
    font: inherit;
    cursor: pointer;
    transition: all 0.15s;
  }

  .format-card:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.7);
  }

  .format-card.selected {
    background: rgba(139, 92, 246, 0.1);
    border-color: rgba(139, 92, 246, 0.5);
    color: #fff;
  }

  .format-icon {
    font-size: 20px;
  }

  .format-card.selected .format-icon {
    color: #a78bfa;
  }

  .format-label {
    font-size: 13px;
    font-weight: 600;
  }

  .format-detail {
    font-size: 11px;
    font-weight: 400;
    opacity: 0.6;
    font-variant-numeric: tabular-nums;
  }

  .format-hint {
    margin: 0;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.35);
    text-align: center;
    min-height: 18px;
  }

  .copies-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
  }

  .copies-label {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.6);
  }

  .copies-input {
    width: 80px;
    padding: 6px 10px;
    min-height: 36px;
    font-size: 14px;
    font-variant-numeric: tabular-nums;
    text-align: center;
    color: #fff;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
  }

  .copies-input:focus {
    outline: none;
    border-color: rgba(139, 92, 246, 0.5);
  }

  .error {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: rgba(248, 113, 113, 0.08);
    border: 1px solid rgba(248, 113, 113, 0.2);
    border-radius: 8px;
    font-size: 13px;
    color: #f87171;
  }

  .export-action {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    padding: 14px 24px;
    min-height: 52px;
    font-size: 16px;
    font-weight: 600;
    font-family: inherit;
    color: #fff;
    background: linear-gradient(135deg, #7c3aed, #6d28d9);
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .export-action:hover:not(:disabled) {
    background: linear-gradient(135deg, #8b5cf6, #7c3aed);
    transform: translateY(-1px);
    box-shadow: 0 4px 20px rgba(124, 58, 237, 0.3);
  }

  .export-action:active:not(:disabled) {
    transform: translateY(0);
  }

  .export-action:disabled {
    opacity: 0.7;
    cursor: wait;
  }

  .workflow-tip {
    margin: 0;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.3);
    text-align: center;
    line-height: 1.5;
  }

  .workflow-tip strong {
    color: rgba(255, 255, 255, 0.6);
  }

  @media (max-width: 480px) {
    .dialog {
      padding: 20px;
      gap: 16px;
    }

    .header h2 {
      font-size: 18px;
    }

    .format-grid {
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }

    .format-card {
      padding: 12px 8px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dialog-backdrop { animation: none; }
    .export-action:hover:not(:disabled) { transform: none; }
  }
</style>
