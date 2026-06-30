<!--
  Choreo Sheet — dev harness

  Drives the real pipeline end-to-end: load real public sequences → planSheet() +
  getSheetPageLayout() → live landscape preview (SheetPreviewPages) → Export PDF
  (downloadChoreoSheetPDF). Used to eyeball that 8 cells fit a row, 6 rows fit a
  page, long sequences wrap, short ones pad with blanks, and block separators read
  correctly — then open the exported PDF for the print result.

  Sequence sourcing mirrors src/routes/test/render-compare (PublicSequencesLoader:
  metadata, then loadFullSequenceData per word for populated steps).
-->
<script lang="ts">
  import { planSheet } from "$lib/features/write/services/sheet-row-planner";
  import { getSheetPageLayout } from "$lib/features/write/domain/sheet-page-layout";
  import { DEFAULT_SHEET_LAYOUT, createEmptyChoreoSheet } from "$lib/features/write/domain/types/choreo-sheet";
  import { downloadChoreoSheetPDF } from "$lib/features/write/services/sheet-pdf-exporter";
  import SheetPreviewPages from "$lib/features/write/components/sheet/SheetPreviewPages.svelte";
  import { PublicSequencesLoader } from "$lib/shared/browse/services/public-sequences-loader";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  const layout = DEFAULT_SHEET_LAYOUT;
  const geo = getSheetPageLayout(layout);

  let sequences = $state<SequenceData[]>([]);
  let status = $state("Idle — click Load Sequences.");
  let isLoading = $state(false);
  let isExporting = $state(false);
  let exportProgress = $state<{ done: number; total: number } | null>(null);

  const pages = $derived(planSheet(sequences, layout));

  async function loadSequences() {
    if (isLoading) return;
    isLoading = true;
    status = "Loading public sequences from Firebase…";
    try {
      const loader = new PublicSequencesLoader();
      const metadata = await loader.loadSequenceMetadata();

      const hydrated: SequenceData[] = [];
      for (const meta of metadata.slice(0, 40)) {
        const data = await loader.loadFullSequenceData(meta.word);
        if (data?.steps?.length) hydrated.push(data);
        if (hydrated.length >= 24) break;
      }
      sequences = pickShowcase(hydrated);
      const lengths = sequences.map((s) => s.steps.length).join(", ");
      status = sequences.length
        ? `Loaded ${sequences.length} sequences (step counts: ${lengths}).`
        : "No public sequences with steps found.";
    } catch (err) {
      status = `Load error: ${String(err)}`;
      console.error("[choreo-sheet harness] load failed:", err);
    } finally {
      isLoading = false;
    }
  }

  // Bias the showcase toward proving wrap + pagination: include an 8-count and a
  // 16-count (or the longest >8 available) up front, then fill to ~8 with a
  // length spread.
  function pickShowcase(all: SequenceData[]): SequenceData[] {
    const chosen: SequenceData[] = [];
    const eight = all.find((s) => s.steps.length === 8);
    if (eight) chosen.push(eight);
    const long = all.find((s) => s.steps.length === 16) ?? all.find((s) => s.steps.length > 8);
    if (long && !chosen.includes(long)) chosen.push(long);
    for (const s of all) {
      if (chosen.length >= 8) break;
      if (!chosen.includes(s)) chosen.push(s);
    }
    return chosen;
  }

  async function exportPdf() {
    if (isExporting || sequences.length === 0) return;
    isExporting = true;
    exportProgress = { done: 0, total: 0 };
    try {
      // Throwaway sheet built from the loaded sequences' ids; the hydrated
      // sequences are passed directly so no library round-trip is needed.
      const sheet = {
        ...createEmptyChoreoSheet("test", "Harness"),
        sequenceIds: sequences.map((s) => s.id),
      };
      await downloadChoreoSheetPDF(sheet, sequences, "choreo-sheet-harness.pdf", (done, total) => {
        exportProgress = { done, total };
      });
      status = "PDF exported.";
    } catch (err) {
      status = `Export error: ${String(err)}`;
      console.error("[choreo-sheet harness] export failed:", err);
    } finally {
      isExporting = false;
      exportProgress = null;
    }
  }
</script>

<svelte:head><title>Choreo Sheet — Harness</title></svelte:head>

<div class="harness">
  <header>
    <h1>Choreo Sheet — Harness</h1>
    <p class="meta">
      {sequences.length} sequences → {pages.length} page(s) · cell {geo.cellSizePt.toFixed(1)}pt
      ({geo.columns}×{geo.rows} per page)
    </p>
    <div class="controls">
      <button onclick={loadSequences} disabled={isLoading}>
        {isLoading ? "Loading…" : "Load Sequences"}
      </button>
      <button onclick={exportPdf} disabled={isExporting || sequences.length === 0}>
        {#if isExporting && exportProgress}
          Exporting… {exportProgress.done} / {exportProgress.total}
        {:else if isExporting}
          Exporting…
        {:else}
          Export PDF
        {/if}
      </button>
    </div>
    <p class="status">{status}</p>
  </header>

  <SheetPreviewPages {pages} {geo} {layout} />
</div>

<style>
  .harness {
    min-height: 100vh;
    padding: 24px;
    background: var(--theme-bg, #14141f);
    color: var(--theme-text, #ffffff);
    font-family: system-ui, sans-serif;
  }

  h1 {
    margin: 0 0 4px;
    font-size: var(--font-size-xl, 22px);
  }

  .meta {
    margin: 0 0 16px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
  }

  .controls {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }

  button {
    min-height: 44px;
    padding: 0 20px;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    background: var(--theme-accent-bg, rgba(100, 180, 255, 0.22));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.18));
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.15s ease, transform 0.15s ease;
  }

  button:hover:not(:disabled) {
    background: var(--theme-accent-bg-strong, rgba(100, 180, 255, 0.35));
    transform: translateY(-1px);
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .status {
    margin: 0 0 20px;
    font-size: var(--font-size-compact, 13px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }
</style>
