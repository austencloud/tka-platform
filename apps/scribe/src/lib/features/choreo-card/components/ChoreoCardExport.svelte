<!--
  ChoreoCardExport.svelte - Export controls for Choreo Cards

  Provides buttons to export current page or all filtered cards
  as print-ready images with pure white backgrounds.
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";

  interface Props {
    /** All filtered sequences (for "Export All") */
    sequences: SequenceData[];
    /** Current page sequences (for "Export Page") */
    currentPageSequences: SequenceData[];
    /** Current visibility settings to pass to renderer */
    showGrid: boolean;
    showTKA: boolean;
    showWord: boolean;
    includeStartPosition: boolean;
    /** Callback when export starts/ends (for loading state) */
    onExportStart?: () => void;
    onExportEnd?: () => void;
  }

  let {
    sequences,
    currentPageSequences,
    showGrid,
    showTKA,
    showWord,
    includeStartPosition,
    onExportStart,
    onExportEnd,
  }: Props = $props();

  let hapticService: IHapticFeedback;
  let isExporting = $state(false);

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });

  async function exportSequences(seqs: SequenceData[], filename: string) {
    if (seqs.length === 0 || isExporting) return;

    isExporting = true;
    onExportStart?.();
    hapticService?.trigger("selection");

    try {
      const renderer = container.items.sequenceRenderer;

      // For single sequence, download directly
      if (seqs.length === 1 && seqs[0]) {
        const blob = await renderer.renderSequenceToBlob(seqs[0], {
          stepSize: 300, // Higher quality for print
          format: "PNG",
          quality: 1.0,
          includeStartPosition,
          addStepNumbers: true,
          addWord: showWord,
          addDifficultyLevel: false,
          addUserInfo: false,
          addReversalSymbols: true,
          visibilityOverrides: {
            darkMode: false,
            printMode: true, // Pure white background for print
            showGrid,
            showTKA,
          },
        });

        downloadBlob(blob, `${seqs[0].word || seqs[0].name || "choreo-card"}.png`);
        hapticService?.trigger("success");
        return;
      }

      // For multiple sequences, create a zip file
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      for (let i = 0; i < seqs.length; i++) {
        const seq = seqs[i];
        if (!seq) continue;

        const blob = await renderer.renderSequenceToBlob(seq, {
          stepSize: 300,
          format: "PNG",
          quality: 1.0,
          includeStartPosition,
          addStepNumbers: true,
          addWord: showWord,
          addDifficultyLevel: false,
          addUserInfo: false,
          addReversalSymbols: true,
          visibilityOverrides: {
            darkMode: false,
            printMode: true,
            showGrid,
            showTKA,
          },
        });

        const name = seq.word || seq.name || `card-${i + 1}`;
        zip.file(`${name}.png`, blob);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      downloadBlob(zipBlob, `${filename}.zip`);
      hapticService?.trigger("success");
    } catch (error) {
      console.error("[ChoreoCardExport] Export failed:", error);
      hapticService?.trigger("error");
    } finally {
      isExporting = false;
      onExportEnd?.();
    }
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleExportPage() {
    exportSequences(currentPageSequences, "choreo-cards-page");
  }

  function handleExportAll() {
    exportSequences(sequences, "choreo-cards-all");
  }
</script>

<div class="export-section">
  <h3 class="section-title">
    <i class="fas fa-download" aria-hidden="true"></i>
    Export for Print
  </h3>

  <p class="section-description">
    Export with pure white backgrounds for professional printing.
  </p>

  <div class="export-buttons">
    <button
      class="export-btn"
      onclick={handleExportPage}
      disabled={isExporting || currentPageSequences.length === 0}
      aria-label="Export current page as print-ready images"
    >
      {#if isExporting}
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      {:else}
        <i class="fas fa-file-image" aria-hidden="true"></i>
      {/if}
      <span>Export Page ({currentPageSequences.length})</span>
    </button>

    <button
      class="export-btn export-all"
      onclick={handleExportAll}
      disabled={isExporting || sequences.length === 0}
      aria-label="Export all filtered sequences as print-ready images"
    >
      {#if isExporting}
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      {:else}
        <i class="fas fa-file-archive" aria-hidden="true"></i>
      {/if}
      <span>Export All ({sequences.length})</span>
    </button>
  </div>
</div>

<style>
  .export-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .section-title i {
    color: var(--theme-accent, #f43f5e);
    font-size: 0.875rem;
  }

  .section-description {
    margin: 0;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    line-height: 1.4;
  }

  .export-buttons {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .export-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--border-radius-md, 8px);
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) ease;
  }

  .export-btn:hover:not(:disabled) {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .export-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .export-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .export-btn i {
    font-size: 0.875rem;
  }

  .export-all {
    background: var(--theme-accent-bg, rgba(99, 102, 241, 0.15));
    border-color: var(--theme-accent, #6366f1);
  }

  .export-all:hover:not(:disabled) {
    background: var(--theme-accent-glow, rgba(99, 102, 241, 0.25));
  }

  /* Mobile responsive */
  @media (max-width: 768px) {
    .export-section {
      flex-direction: row;
      align-items: center;
      flex-wrap: wrap;
    }

    .section-title {
      font-size: var(--font-size-compact, 12px);
    }

    .section-description {
      display: none;
    }

    .export-buttons {
      flex-direction: row;
      flex: 1;
    }

    .export-btn {
      flex: 1;
      padding: var(--spacing-xs) var(--spacing-sm);
      font-size: var(--font-size-compact, 12px);
    }

    .export-btn span {
      display: none;
    }

    .export-btn i {
      font-size: 1rem;
    }
  }
</style>
