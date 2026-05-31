<script lang="ts">
  import { getPageLayout, type CardSizeId } from "../../domain/card-sizes";
  import { TND_ELEMENTS, type TnDElement } from "../../domain/tnd-element";
  import type { PrintPDFMode } from "../../services/print-pdf-exporter";

  /** The side picker's four choices. 'zip' = card images (download only). */
  export type PrintSide = "fronts" | "backs" | "combined" | "zip";

  interface Props {
    cardCount: number;
    tndElements?: (TnDElement | undefined)[];
    cardSize: CardSizeId;
    copies?: number;
    groupByElement?: boolean;
    theme: string;
    /** Controlled side selection (lifted to the tab so the preview can scope). */
    selectedSide: PrintSide;
    onSideChange: (side: PrintSide) => void;
    isExporting: boolean;
    isPrinting?: boolean;
    exportProgress: number;
    exportTotal: number;
    exportError: string;
    onPrint: (mode: PrintPDFMode) => void;
    onExportPDF: (mode: PrintPDFMode, copies: number) => void;
    onExportZIP: () => void;
  }

  let {
    cardCount,
    tndElements = [],
    cardSize,
    copies = 1,
    groupByElement = true,
    theme,
    selectedSide,
    onSideChange,
    isExporting,
    isPrinting = false,
    exportProgress,
    exportTotal,
    exportError,
    onPrint,
    onExportPDF,
    onExportZIP,
  }: Props = $props();

  const busy = $derived(isExporting || isPrinting);
  const printable = $derived(selectedSide !== "zip");
  const layout = $derived(getPageLayout(cardSize));

  // Sheets = Σ over colors of ceil(colorCount * copies / cardsPerPage); each
  // color pads to whole sheets. Normal-fill (or untagged) → flat count.
  const sheetCount = $derived.by(() => {
    const perPage = layout.cardsPerPage;
    const tagged = tndElements.filter((e): e is TnDElement => !!e);
    if (!groupByElement || tagged.length === 0) {
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
    return TND_ELEMENTS.filter((e) => counts.has(e.element)).map((e) => {
      const { element, count } = counts.get(e.element)!;
      return { element, count, sheets: Math.ceil((count * copies) / perPage) };
    });
  });

  const SIDE_OPTIONS: {
    id: PrintSide;
    icon: string;
    label: string;
    getDetail: () => string;
    getHint: () => string;
  }[] = [
    { id: "fronts", icon: "fa-layer-group", label: "Fronts",
      getDetail: () => `${sheetCount} sheets`,
      getHint: () => "Print these first, then flip the stack for the backs." },
    { id: "backs", icon: "fa-rotate", label: "Backs",
      getDetail: () => `${sheetCount} sheets`,
      getHint: () => "Print after the fronts. Columns mirrored for the long-edge flip." },
    { id: "combined", icon: "fa-book-open", label: "Combined",
      getDetail: () => `${sheetCount * 2 + 2} pages`,
      getHint: () => "Fronts + flip instructions + backs + finishing tips, in one file." },
    { id: "zip", icon: "fa-images", label: "Images",
      getDetail: () => `${cardCount * 2} PNGs`,
      getHint: () => "Individual files for MPC or custom layouts. Download only." },
  ];

  const selectedOption = $derived(SIDE_OPTIONS.find((f) => f.id === selectedSide)!);

  const printLabel = $derived.by(() => {
    if (isPrinting) return "Preparing…";
    switch (selectedSide) {
      case "fronts": return "Print Fronts";
      case "backs": return "Print Backs";
      case "combined": return "Print Combined";
      default: return "Print";
    }
  });

  const downloadLabel = $derived.by(() => {
    if (isExporting) {
      return exportTotal > 0 ? `Exporting ${exportProgress} / ${exportTotal}…` : "Preparing…";
    }
    return `Download ${selectedOption.label}`;
  });

  function handlePrint() {
    if (busy || !printable) return;
    onPrint(selectedSide as PrintPDFMode);
  }

  function handleExport() {
    if (busy) return;
    if (selectedSide === "zip") onExportZIP();
    else onExportPDF(selectedSide, Math.max(1, Math.floor(copies || 1)));
  }
</script>

<div class="print-panel">
  <section class="summary" aria-label="Deck summary">
    <div class="summary-row">
      <span class="summary-label">Cards</span>
      <span class="summary-value">{cardCount}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">Sheets</span>
      <span class="summary-value">{sheetCount} ({layout.cols}&times;{layout.rows} per sheet)</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">Copies / card</span>
      <span class="summary-value">{copies}<span class="inline-hint">toolbar</span></span>
    </div>
    <div class="summary-row">
      <span class="summary-label">Theme</span>
      <span class="summary-value theme-badge">{theme}</span>
    </div>
  </section>

  {#if elementCounts.length > 0 && groupByElement}
    <div class="elements" aria-label="Element breakdown">
      {#each elementCounts as { element, count, sheets }}
        <div class="element-pill" style="--el-color: {element.accentColor}"
          title="{count} card{count === 1 ? '' : 's'} × {copies} = {sheets} sheet{sheets === 1 ? '' : 's'}">
          <img src={element.iconPath} alt={element.element} class="element-icon" width="16" height="16" />
          <span class="element-count">{count} · {sheets}sh</span>
        </div>
      {/each}
    </div>
  {/if}

  <h3 class="section-label">Choose a side</h3>
  <div class="side-grid" role="radiogroup" aria-label="Print side">
    {#each SIDE_OPTIONS as opt (opt.id)}
      <button class="side-card" class:selected={selectedSide === opt.id}
        role="radio" aria-checked={selectedSide === opt.id}
        onclick={() => onSideChange(opt.id)}>
        <i class="fas {opt.icon} side-icon" aria-hidden="true"></i>
        <span class="side-label">{opt.label}</span>
        <span class="side-detail">{opt.getDetail()}</span>
      </button>
    {/each}
  </div>
  <p class="side-hint">{selectedOption.getHint()}</p>

  {#if exportError}
    <div class="error" role="alert">
      <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
      {exportError}
    </div>
  {/if}

  <div class="actions">
    <button class="action print-action"
      disabled={busy || !printable || cardCount === 0}
      title={!printable ? "Card images can't be sent to a printer — download instead." : undefined}
      onclick={handlePrint}>
      {#if isPrinting}<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      {:else}<i class="fas fa-print" aria-hidden="true"></i>{/if}
      <span>{printLabel}</span>
    </button>
    <button class="action download-action" disabled={busy} onclick={handleExport}>
      {#if isExporting}<i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      {:else}<i class="fas fa-download" aria-hidden="true"></i>{/if}
      <span>{downloadLabel}</span>
    </button>
  </div>

  <p class="workflow-tip">
    Print the fronts, flip your paper stack on the <strong>long edge</strong>, then print the backs.
  </p>
</div>

<style>
  .print-panel {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    overflow-y: auto;
    min-height: 0;
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
    gap: 12px;
    min-height: 28px;
  }

  .summary-label { font-size: 13px; color: rgba(255, 255, 255, 0.4); }

  .summary-value {
    display: inline-flex;
    align-items: baseline;
    gap: 8px;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.8);
    font-variant-numeric: tabular-nums;
  }

  .inline-hint { font-size: 11px; font-weight: 400; color: rgba(255, 255, 255, 0.3); }

  .theme-badge {
    text-transform: capitalize;
    padding: 2px 10px;
    background: rgba(139, 92, 246, 0.12);
    border: 1px solid rgba(139, 92, 246, 0.25);
    border-radius: 6px;
    font-size: 12px;
    color: #a78bfa;
  }

  .elements { display: flex; gap: 6px; flex-wrap: wrap; }

  .element-pill {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    background: color-mix(in srgb, var(--el-color) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--el-color) 25%, transparent);
    border-radius: 20px;
  }

  .element-icon { width: 16px; height: 16px; object-fit: contain; }

  .element-count {
    font-size: 13px;
    font-weight: 600;
    color: var(--el-color);
    font-variant-numeric: tabular-nums;
  }

  .section-label {
    margin: 0;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(255, 255, 255, 0.3);
  }

  .side-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

  .side-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 14px 12px;
    background: rgba(255, 255, 255, 0.02);
    border: 1.5px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    color: rgba(255, 255, 255, 0.5);
    font: inherit;
    cursor: pointer;
    transition: all 0.15s;
  }

  .side-card:hover {
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.7);
  }

  .side-card.selected {
    background: rgba(139, 92, 246, 0.1);
    border-color: rgba(139, 92, 246, 0.5);
    color: #fff;
  }

  .side-icon { font-size: 20px; }
  .side-card.selected .side-icon { color: #a78bfa; }
  .side-label { font-size: 13px; font-weight: 600; }
  .side-detail { font-size: 11px; font-weight: 400; opacity: 0.6; font-variant-numeric: tabular-nums; }

  .side-hint { margin: 0; font-size: 12px; color: rgba(255, 255, 255, 0.4); min-height: 32px; }

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

  .actions { display: flex; flex-direction: column; gap: 10px; }

  .action {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 14px 20px;
    min-height: 52px;
    font-size: 15px;
    font-weight: 700;
    font-family: inherit;
    color: #fff;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .action:disabled { opacity: 0.5; cursor: not-allowed; }

  .print-action { background: linear-gradient(135deg, #10b981, #059669); }

  .print-action:hover:not(:disabled) {
    background: linear-gradient(135deg, #34d399, #10b981);
    box-shadow: 0 4px 20px rgba(16, 185, 129, 0.3);
  }

  .download-action {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
  }

  .download-action:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
  }

  .workflow-tip { margin: 0; font-size: 12px; color: rgba(255, 255, 255, 0.3); line-height: 1.5; }
  .workflow-tip strong { color: rgba(255, 255, 255, 0.6); }
</style>
