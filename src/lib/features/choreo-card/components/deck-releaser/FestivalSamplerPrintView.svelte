<script lang="ts">
  import { onMount } from "svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import {
    FESTIVAL_SAMPLER_MAX_PACKS,
    FESTIVAL_SAMPLER_NAME,
    renderFestivalSamplerBatch,
    type FestivalSamplerPack,
  } from "../../services/festival-sampler-renderer";
  import { mirrorFestivalSheetColumns } from "../../services/festival-sampler-sheet";
  import {
    exportCalibrationPDF,
    exportFixedSheetBatchPDF,
    type PrintPDFMode,
  } from "../../services/print-pdf-exporter";
  import { printPdfBlob } from "../../services/print-blob";
  import { exportDeckZIP } from "../../services/print-zip-exporter";
  import { downloadBlobToDisk } from "$lib/shared/foundation/services/file-downloader";
  import { createFestivalSamplerPrintState } from "./state/festival-sampler-print-state.svelte";

  interface Props {
    onExit: () => void;
  }

  let { onExit }: Props = $props();

  const OUTPUT_OPTIONS = [
    { value: "combined", label: "Duplex" },
    { value: "fronts", label: "Fronts" },
    { value: "backs", label: "Backs" },
  ];
  const PACK_COUNT_PRESETS = [10, 30, 60];
  const printSettings = createFestivalSamplerPrintState(
    typeof window === "undefined" ? null : window.localStorage
  );

  let packs = $state<FestivalSamplerPack[]>([]);
  let previewPackIndex = $state(0);
  let output = $state<PrintPDFMode>("combined");
  let status = $state("Loading the festival sampler…");
  let progress = $state(0);
  let progressTotal = $state(0);
  let error = $state("");
  let isWorking = $state(false);

  const packCount = $derived(printSettings.packCount);
  const pairs = $derived(packs[previewPackIndex]?.pairs ?? []);
  const ready = $derived(packs.length >= packCount);
  const backPairs = $derived(mirrorFestivalSheetColumns(pairs));
  const selectedSheets = $derived(
    packs.slice(0, packCount).map((pack) => pack.pairs)
  );
  const archivePairs = $derived.by(() => {
    const seen = new Set<HTMLCanvasElement>();
    return selectedSheets.flat().filter((pair) => {
      if (seen.has(pair.front)) return false;
      seen.add(pair.front);
      return true;
    });
  });
  const showFronts = $derived(output !== "backs");
  const showBacks = $derived(output !== "fronts");
  const pageCount = $derived((output === "combined" ? 2 : 1) * packCount);
  const outputLabel = $derived(
    output === "combined" ? "Duplex" : output === "fronts" ? "Fronts" : "Backs"
  );
  const batchLabel = $derived(
    output === "combined"
      ? `${packCount} unique packs`
      : `${packCount} ${output === "fronts" ? "front" : "back"} sheets`
  );

  $effect(() => {
    if (previewPackIndex >= packCount) previewPackIndex = packCount - 1;
  });

  onMount(() => {
    let cancelled = false;
    void renderFestivalSamplerBatch(FESTIVAL_SAMPLER_MAX_PACKS, (next) => {
      if (cancelled) return;
      progress = next.current;
      progressTotal = next.total;
      status = next.label;
    })
      .then((rendered) => {
        if (cancelled) return;
        packs = rendered;
        status = `${packCount} unique packs ready to print`;
      })
      .catch((cause) => {
        if (cancelled) return;
        error = cause instanceof Error ? cause.message : String(cause);
        status = "Could not render the festival sampler";
      });
    return () => {
      cancelled = true;
    };
  });

  async function buildPdf(mode: PrintPDFMode): Promise<Blob> {
    return exportFixedSheetBatchPDF(
      selectedSheets,
      FESTIVAL_SAMPLER_NAME,
      "poker",
      (current) => {
        progress = current;
      },
      mode,
      {
        paperSize: "letter",
        meta: {
          title: FESTIVAL_SAMPLER_NAME,
          subject: `${packCount} unique nine-card home-print festival handouts`,
          keywords: ["festival", "sampler", "poker cards", "duplex"],
          deckSummary:
            "8 sample cards + signup · Unique assortment · Long-edge duplex",
        },
      }
    );
  }

  async function handlePrint(): Promise<void> {
    if (!ready || isWorking) return;
    isWorking = true;
    error = "";
    status = `Preparing ${batchLabel}…`;
    try {
      const blob = await buildPdf(output);
      printPdfBlob(blob);
      status = "Print dialog opened";
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
      status = "Could not prepare the print file";
    } finally {
      isWorking = false;
    }
  }

  async function handleDownloadPdf(): Promise<void> {
    if (!ready || isWorking) return;
    isWorking = true;
    error = "";
    status = `Building ${batchLabel}…`;
    try {
      const blob = await buildPdf(output);
      await downloadBlobToDisk(
        blob,
        `Festival_Sampler_2026_${packCount}_${outputLabel}.pdf`
      );
      status = "PDF downloaded";
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
      status = "Could not build the PDF";
    } finally {
      isWorking = false;
    }
  }

  async function handleDownloadImages(): Promise<void> {
    if (!ready || isWorking) return;
    isWorking = true;
    error = "";
    status = "Building card image archive…";
    try {
      const blob = await exportDeckZIP(
        archivePairs,
        "Festival_Sampler_2026_unique_cards"
      );
      await downloadBlobToDisk(blob, "Festival_Sampler_2026_cards.zip");
      status = "Card images downloaded";
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
      status = "Could not build the image archive";
    } finally {
      isWorking = false;
    }
  }

  async function handleTestSheet(): Promise<void> {
    if (isWorking) return;
    isWorking = true;
    error = "";
    status = "Preparing the scale test…";
    try {
      printPdfBlob(await exportCalibrationPDF("poker", "letter"));
      status = "Scale-test print dialog opened";
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
      status = "Could not prepare the scale test";
    } finally {
      isWorking = false;
    }
  }
</script>

<div class="festival-print" data-testid="festival-sampler-print-view">
  <main class="preview-area">
    <header class="preview-header">
      <button class="back-button" type="button" onclick={onExit}>
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
        Deck Releaser
      </button>
      <div class="title-block">
        <span class="eyebrow">Ready-to-print job</span>
        <h1>{FESTIVAL_SAMPLER_NAME}</h1>
        <p>1 signup card + 8 sample choreo cards</p>
      </div>
      <div class="job-status" class:ready aria-live="polite">
        {#if !ready && !error}
          <i class="fas fa-circle-notch fa-spin" aria-hidden="true"></i>
        {:else if ready}
          <i class="fas fa-check-circle" aria-hidden="true"></i>
        {/if}
        <span>{status}</span>
        {#if !ready && !error}
          <small>{progress} / {progressTotal}</small>
        {/if}
      </div>
    </header>

    {#if error}
      <div class="error" role="alert">
        <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
        <span>{error}</span>
      </div>
    {/if}

    <nav class="pack-navigator" aria-label="Preview a unique festival pack">
      <button
        type="button"
        aria-label="Previous pack"
        disabled={previewPackIndex === 0}
        onclick={() => {
          previewPackIndex -= 1;
        }}
      >
        <i class="fas fa-chevron-left" aria-hidden="true"></i>
      </button>
      <div>
        <span>Previewing</span>
        <strong>Pack {previewPackIndex + 1} of {packCount}</strong>
      </div>
      <button
        type="button"
        aria-label="Next pack"
        disabled={!ready || previewPackIndex >= packCount - 1}
        onclick={() => {
          previewPackIndex += 1;
        }}
      >
        <i class="fas fa-chevron-right" aria-hidden="true"></i>
      </button>
    </nav>

    <section class="sheets" aria-label="Festival sampler print preview">
      {#if showFronts}
        <article class="sheet-block">
          <div class="sheet-heading">
            <strong>Fronts</strong>
            <span>Pack {previewPackIndex + 1} · Page 1</span>
          </div>
          <div class="paper" data-testid="festival-front-sheet">
            <div class="card-grid">
              {#each pairs as pair (pair.slot)}
                <img
                  src={pair.front.toDataURL("image/png")}
                  alt={`${pair.name} front`}
                />
              {/each}
            </div>
          </div>
        </article>
      {/if}

      {#if showBacks}
        <article class="sheet-block">
          <div class="sheet-heading">
            <strong>Backs</strong>
            <span
              >Pack {previewPackIndex + 1} · {output === "combined"
                ? "Page 2 · "
                : ""}columns mirrored</span
            >
          </div>
          <div class="paper" data-testid="festival-back-sheet">
            <div class="card-grid">
              {#each backPairs as pair (pair.slot)}
                <img
                  src={pair.back.toDataURL("image/png")}
                  alt={`${pair.name} back`}
                />
              {/each}
            </div>
          </div>
        </article>
      {/if}
    </section>
  </main>

  <aside class="print-sidebar" aria-label="Festival sampler print controls">
    <section class="job-summary">
      <span class="summary-icon"
        ><i class="fas fa-layer-group" aria-hidden="true"></i></span
      >
      <div>
        <strong>{packCount} unique packs</strong>
        <span>Letter · Poker 2.5″ × 3.5″</span>
      </div>
    </section>

    <section class="control-section">
      <h2>Pack quantity</h2>
      <div class="quantity-control">
        <div class="quantity-presets" aria-label="Pack quantity presets">
          {#each PACK_COUNT_PRESETS as count}
            <button
              type="button"
              class:active={packCount === count}
              aria-pressed={packCount === count}
              onclick={() => {
                printSettings.packCount = count;
              }}>{count}</button
            >
          {/each}
        </div>
        <label class="custom-quantity">
          <span>Custom</span>
          <input
            type="number"
            min="1"
            max="200"
            step="1"
            value={packCount}
            aria-label="Number of festival sample packs"
            onchange={(event) => {
              printSettings.packCount = Number(event.currentTarget.value);
            }}
          />
        </label>
      </div>
      <p class="quantity-note">
        Every numbered pack has a different eight-card assortment. Keep printer
        copies at 1.
      </p>
    </section>

    <section class="control-section">
      <h2>Print output</h2>
      <SegmentedControl
        options={OUTPUT_OPTIONS}
        value={output}
        onchange={(value) => {
          output = value as PrintPDFMode;
        }}
        color="accent"
        size="sm"
        semantics="radiogroup"
        ariaLabel="Print output"
      />
      <div class="output-detail">
        <strong>{pageCount} {pageCount === 1 ? "page" : "pages"}</strong>
        <span>
          {output === "combined"
            ? "Each front is followed immediately by its matching mirrored back."
            : output === "fronts"
              ? "Print this side first."
              : "Use after flipping the front sheet on its long edge."}
        </span>
      </div>
    </section>

    <section class="checklist">
      <h2>Print dialog</h2>
      <ul>
        <li>
          <i class="fas fa-file" aria-hidden="true"></i><span
            >Paper: <strong>Letter</strong></span
          >
        </li>
        <li>
          <i class="fas fa-expand" aria-hidden="true"></i><span
            >Scale: <strong>100% / Actual size</strong></span
          >
        </li>
        <li>
          <i class="fas fa-layer-group" aria-hidden="true"></i><span
            >Copies: <strong>1</strong></span
          >
        </li>
        {#if output === "combined"}
          <li>
            <i class="fas fa-copy" aria-hidden="true"></i><span
              >Two-sided: <strong>Flip on long edge</strong></span
            >
          </li>
        {/if}
      </ul>
      <button
        type="button"
        class="test-button"
        disabled={isWorking}
        onclick={handleTestSheet}
      >
        <i class="fas fa-ruler-horizontal" aria-hidden="true"></i>
        Print scale test on scrap paper
      </button>
    </section>

    <div class="actions">
      <button
        type="button"
        class="primary-action"
        disabled={!ready || isWorking}
        onclick={handlePrint}
      >
        <i
          class={isWorking ? "fas fa-circle-notch fa-spin" : "fas fa-print"}
          aria-hidden="true"
        ></i>
        Print {batchLabel}
      </button>
      <button
        type="button"
        class="secondary-action"
        disabled={!ready || isWorking}
        onclick={handleDownloadPdf}
      >
        <i class="fas fa-file-pdf" aria-hidden="true"></i>
        Download {batchLabel} PDF
      </button>
      <button
        type="button"
        class="secondary-action"
        disabled={!ready || isWorking}
        onclick={handleDownloadImages}
      >
        <i class="fas fa-images" aria-hidden="true"></i>
        Download unique card images
      </button>
    </div>

    <p class="copy-note">
      This job contains {pageCount} numbered pages for {batchLabel}. Printing
      more than one copy in the system dialog duplicates the full run.
    </p>
  </aside>
</div>

<style>
  .festival-print {
    container-type: inline-size;
    display: flex;
    height: 100%;
    min-height: 0;
    color: var(--theme-text, #f7f7fb);
  }

  .preview-area {
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr);
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    box-sizing: border-box;
    padding: clamp(18px, 2vw, 32px);
    background: color-mix(in srgb, var(--theme-background, #11131a) 92%, black);
  }

  .preview-header {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 18px;
    max-width: var(--shell-w, min(1720px, 92vw));
    margin: 0 auto 24px;
  }

  button {
    min-height: 44px;
    border: 0;
    border-radius: 10px;
    color: inherit;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  button:focus-visible {
    outline: 3px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .back-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 0 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.07));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
  }

  .title-block h1,
  .title-block p,
  .title-block .eyebrow {
    margin: 0;
  }

  .eyebrow {
    display: block;
    margin-bottom: 3px !important;
    color: var(--theme-accent, #a78bfa);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .title-block h1 {
    font-size: clamp(22px, 2vw, 32px);
    line-height: 1.1;
  }

  .title-block p {
    margin-top: 5px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.64));
    font-size: 14px;
  }

  .job-status {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 42px;
    padding: 0 13px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 999px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
    font-size: 13px;
  }

  .job-status.ready {
    border-color: color-mix(
      in srgb,
      var(--semantic-success, #10b981) 55%,
      transparent
    );
    color: var(--semantic-success, #34d399);
  }

  .job-status small {
    color: inherit;
    opacity: 0.7;
  }

  .error {
    display: flex;
    gap: 10px;
    max-width: 900px;
    margin: 0 auto 20px;
    padding: 14px;
    border: 1px solid
      color-mix(in srgb, var(--semantic-error, #ef4444) 55%, transparent);
    border-radius: 10px;
    background: color-mix(
      in srgb,
      var(--semantic-error, #ef4444) 10%,
      transparent
    );
    color: #fecaca;
  }

  .pack-navigator {
    display: grid;
    grid-template-columns: 44px minmax(150px, auto) 44px;
    align-items: center;
    width: fit-content;
    margin: 0 auto 20px;
    overflow: hidden;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
  }

  .pack-navigator button {
    min-width: 44px;
    padding: 0;
    border-radius: 0;
    background: transparent;
  }

  .pack-navigator button:first-child {
    border-right: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .pack-navigator button:last-child {
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .pack-navigator div {
    display: grid;
    gap: 2px;
    padding: 7px 16px;
    text-align: center;
  }

  .pack-navigator span {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.62));
    font-size: 11px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .pack-navigator strong {
    font-size: 14px;
  }

  .sheets {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 390px), 1fr));
    align-items: stretch;
    gap: clamp(20px, 2vw, 32px);
    min-height: 0;
    max-width: var(--shell-w, min(1720px, 92vw));
    width: 100%;
    height: 100%;
    margin: 0 auto;
  }

  .sheet-block {
    --preview-paper-width: min(100cqw, calc(77.2727cqh - 28px));

    container-type: size;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    justify-items: center;
    min-width: 0;
    min-height: 0;
  }

  .sheet-heading {
    display: flex;
    justify-content: space-between;
    width: var(--preview-paper-width);
    margin-bottom: 9px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.62));
    font-size: 13px;
  }

  .sheet-heading strong {
    color: var(--theme-text, #fff);
    font-size: 15px;
  }

  .paper {
    position: relative;
    width: var(--preview-paper-width);
    aspect-ratio: 8.5 / 11;
    overflow: hidden;
    background: white;
    box-shadow: 0 18px 52px rgba(0, 0, 0, 0.36);
  }

  .card-grid {
    position: absolute;
    inset: 2.2727% 5.8824%;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(3, 1fr);
  }

  .card-grid img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: fill;
  }

  .print-sidebar {
    width: clamp(320px, 20vw, 410px);
    flex: 0 0 auto;
    overflow-y: auto;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .job-summary,
  .control-section,
  .checklist,
  .actions,
  .copy-note {
    margin: 0;
    padding: 18px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.09));
  }

  .job-summary {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .summary-icon {
    display: grid;
    width: 42px;
    height: 42px;
    place-items: center;
    border-radius: 11px;
    background: color-mix(
      in srgb,
      var(--theme-accent, #8b5cf6) 18%,
      transparent
    );
    color: var(--theme-accent, #a78bfa);
  }

  .job-summary div,
  .output-detail {
    display: grid;
    gap: 3px;
  }

  .job-summary span,
  .output-detail span,
  .copy-note {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.62));
    font-size: 13px;
    line-height: 1.45;
  }

  h2 {
    margin: 0 0 12px;
    font-size: 13px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .output-detail {
    margin-top: 12px;
    padding: 12px;
    border-radius: 9px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
  }

  .quantity-control {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 82px;
    gap: 10px;
  }

  .quantity-presets {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }

  .quantity-presets button {
    min-width: 0;
    padding: 0 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
  }

  .quantity-presets button.active {
    background: color-mix(
      in srgb,
      var(--theme-accent, #8b5cf6) 24%,
      transparent
    );
    border-color: var(--theme-accent, #8b5cf6);
    color: white;
  }

  .custom-quantity {
    display: grid;
    gap: 4px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.62));
    font-size: 11px;
  }

  .custom-quantity input {
    width: 100%;
    min-height: 44px;
    box-sizing: border-box;
    padding: 0 10px;
    appearance: textfield;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 9px;
    color: var(--theme-text, #fff);
    font: inherit;
    font-size: 15px;
    font-weight: 700;
  }

  .custom-quantity input::-webkit-inner-spin-button,
  .custom-quantity input::-webkit-outer-spin-button {
    margin: 0;
    appearance: none;
  }

  .custom-quantity input:focus-visible {
    outline: 3px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .quantity-note {
    margin: 10px 0 0;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.62));
    font-size: 12px;
    line-height: 1.45;
  }

  .checklist ul {
    display: grid;
    gap: 10px;
    margin: 0 0 14px;
    padding: 0;
    list-style: none;
  }

  .checklist li {
    display: flex;
    align-items: center;
    gap: 9px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
    font-size: 13px;
  }

  .checklist li i {
    width: 18px;
    color: var(--theme-accent, #a78bfa);
    text-align: center;
  }

  .test-button,
  .secondary-action {
    width: 100%;
    padding: 10px 13px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
  }

  .actions {
    display: grid;
    gap: 10px;
  }

  .primary-action,
  .secondary-action,
  .test-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
  }

  .primary-action {
    min-height: 50px;
    padding: 11px 15px;
    background: var(--theme-accent, #8b5cf6);
    color: white;
  }

  .copy-note {
    border-bottom: 0;
  }

  @media (min-width: 2600px) {
    .preview-area {
      padding: 3rem;
    }

    .preview-header {
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .title-block h1 {
      font-size: 2.5rem;
    }

    .title-block p,
    .job-status,
    .sheet-heading,
    .job-summary span,
    .output-detail span,
    .copy-note,
    .checklist li {
      font-size: 1rem;
    }

    .eyebrow,
    h2 {
      font-size: 0.9rem;
    }

    .job-status {
      min-height: 3.25rem;
      padding-inline: 1rem;
    }

    .pack-navigator {
      grid-template-columns: 3rem minmax(12rem, auto) 3rem;
      margin-bottom: 1.5rem;
    }

    .pack-navigator button {
      min-width: 3rem;
      min-height: 3rem;
    }

    .pack-navigator span {
      font-size: 0.8rem;
    }

    .pack-navigator strong,
    .sheet-heading strong {
      font-size: 1.1rem;
    }

    .print-sidebar {
      width: clamp(30rem, 18vw, 40rem);
    }

    .job-summary,
    .control-section,
    .checklist,
    .actions,
    .copy-note {
      padding: 1.5rem;
    }

    .quantity-note,
    .custom-quantity {
      font-size: 0.85rem;
    }

    .primary-action,
    .secondary-action,
    .test-button,
    .quantity-presets button,
    .custom-quantity input {
      min-height: 3.25rem;
      font-size: 1rem;
    }
  }

  @media (max-width: 980px) {
    .festival-print {
      flex-direction: column;
      overflow-y: auto;
    }

    .preview-area {
      display: block;
      flex: none;
      overflow: visible;
    }

    .print-sidebar {
      width: auto;
      overflow: visible;
      border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
      border-left: 0;
    }

    .sheets {
      height: auto;
    }

    .sheet-block {
      --preview-paper-width: min(100cqw, calc((100svh - 210px) * 0.772727));

      container-type: inline-size;
      display: grid;
      justify-items: center;
    }
  }

  @media (max-width: 620px) {
    .preview-header {
      grid-template-columns: 1fr;
    }

    .back-button,
    .job-status {
      justify-self: start;
    }

    .preview-area {
      padding: 14px;
    }

    .sheet-block {
      --preview-paper-width: min(100cqw, calc((100svh - 355px) * 0.772727));
    }
  }

  @media (min-width: 621px) and (max-height: 600px) {
    .preview-area {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-rows: auto minmax(0, 1fr);
      flex: 0 0 100%;
      height: 100%;
      overflow: hidden;
      padding: 10px 16px;
    }

    .preview-header {
      grid-column: 1;
      grid-row: 1;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 12px;
      max-width: none;
      margin: 0 0 8px;
    }

    .title-block .eyebrow,
    .title-block p,
    .job-status {
      display: none;
    }

    .title-block h1 {
      font-size: 20px;
    }

    .pack-navigator {
      grid-column: 2;
      grid-row: 1;
      margin: 0 0 8px 12px;
    }

    .sheets {
      grid-column: 1 / -1;
      grid-row: 2;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      height: 100%;
    }

    .sheet-block {
      --preview-paper-width: min(100cqw, calc(77.2727cqh - 28px));

      container-type: size;
    }

    .sheet-heading span {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    :global(.fa-spin) {
      animation: none;
    }
  }
</style>
