<script lang="ts">
  import type { PostStudioExportProgress } from "$lib/shared/media-composition/services/post-studio-exporter";

  /**
   * Post Studio's own actions — nothing else.
   *
   * This replaced a full title bar that carried Back, the sequence word, a
   * Close X and a "Ready" pill. All four were redundant or empty once the
   * studio became a sequence-viewer surface: the viewer header owns the word
   * and the close, the content rail owns going back, and "Ready" was the
   * `{:else}` of the missing-sources warning — it announced the absence of a
   * problem. What is left is the same shape the viewer's other export panels
   * take: the thing you press to get a file, and its progress.
   */
  interface Props {
    missingCount: number;
    missingLabel?: string;
    canRender: boolean;
    exporting: boolean;
    exportProgress: PostStudioExportProgress | null;
    exportPercent: number;
    exportedUrl: string | null;
    exportFilename: string;
    onFixMissing: () => void;
    onRender: () => void;
    onCancelExport: () => void;
  }

  let {
    missingCount,
    missingLabel = "source",
    canRender,
    exporting,
    exportProgress,
    exportPercent,
    exportedUrl,
    exportFilename,
    onFixMissing,
    onRender,
    onCancelExport,
  }: Props = $props();

  const exportLabel = $derived(
    exportProgress?.phase === "audio"
      ? "Adding sound"
      : exportProgress?.phase === "encoding"
        ? "Encoding MP4"
        : "Rendering"
  );
</script>

<div class="actionbar">
  <div class="state">
    {#if missingCount > 0}
      <button type="button" class="missing-state" onclick={onFixMissing}>
        <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
        {missingCount === 1
          ? `${missingLabel} needed`
          : `${missingCount} sources needed`}
      </button>
    {/if}
  </div>

  <div class="export-actions">
    {#if exporting}
      <div class="export-progress" role="status" aria-live="polite">
        <span><strong>{exportLabel}</strong> {exportPercent}%</span>
        <span class="progress-track" aria-hidden="true">
          <span style:width={`${exportPercent}%`}></span>
        </span>
      </div>
      <button type="button" class="secondary-button" onclick={onCancelExport}>
        Cancel
      </button>
    {:else if exportedUrl}
      <a class="download-button" href={exportedUrl} download={exportFilename}>
        <i class="fa-solid fa-download" aria-hidden="true"></i>
        Download MP4
      </a>
      <button
        type="button"
        class="secondary-button rerender-button"
        disabled={!canRender}
        onclick={onRender}
      >
        Render again
      </button>
    {:else}
      <button
        type="button"
        class="render-button"
        disabled={!canRender}
        onclick={onRender}
      >
        <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
        Render post
      </button>
    {/if}
  </div>
</div>

<style>
  .actionbar {
    display: flex;
    align-items: center;
    gap: var(--spacing-lg);
    min-height: 3.5rem;
    padding: 0.5rem var(--spacing-md);
    border-bottom: 1px solid var(--theme-stroke);
    background: var(--theme-panel-bg);
  }

  .state,
  .export-actions {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    min-width: 0;
  }

  /* The warning takes the slack so the render action sits hard right. Empty in
     the healthy case, which is the common one — a zero-width flex child, not a
     reserved band of dead air. */
  .state {
    flex: 1;
  }

  .missing-state {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-sm);
    min-height: 2.75rem;
    padding: 0 0.75rem;
    border: 1px solid
      color-mix(in srgb, var(--semantic-warning) 48%, transparent);
    border-radius: var(--radius-2026-sm);
    background: color-mix(in srgb, var(--semantic-warning) 10%, transparent);
    color: var(--semantic-warning);
    font: inherit;
    font-size: var(--font-size-compact);
    cursor: pointer;
  }

  .secondary-button,
  .render-button,
  .download-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    min-height: 2.75rem;
    padding: 0.5rem 0.8rem;
    border-radius: var(--radius-2026-sm);
    color: var(--theme-text);
    font: inherit;
    font-size: var(--font-size-min);
    font-weight: 700;
    text-decoration: none;
    cursor: pointer;
  }

  .secondary-button {
    border: 1px solid var(--theme-stroke);
    background: var(--theme-card-bg);
  }

  .render-button {
    border: 1px solid var(--theme-accent);
    background: color-mix(in srgb, var(--theme-accent) 62%, #24223d);
  }

  .download-button {
    border: 1px solid var(--semantic-success);
    background: color-mix(
      in srgb,
      var(--semantic-success) 14%,
      var(--theme-card-bg)
    );
    color: var(--semantic-success);
  }

  .render-button:disabled,
  .secondary-button:disabled {
    opacity: 0.42;
    cursor: not-allowed;
  }

  .secondary-button:hover:not(:disabled) {
    border-color: var(--theme-stroke-strong);
  }

  .secondary-button:focus-visible,
  .render-button:focus-visible,
  .download-button:focus-visible,
  .missing-state:focus-visible {
    outline: 3px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .export-progress {
    display: grid;
    gap: var(--spacing-xs);
    width: 11rem;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact);
    font-variant-numeric: tabular-nums;
  }

  .export-progress strong {
    color: var(--theme-text);
  }

  .progress-track {
    display: block;
    height: 0.35rem;
    overflow: hidden;
    border-radius: var(--radius-2026-full);
    background: var(--theme-stroke);
  }

  .progress-track > span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--theme-accent);
    transition: width var(--duration-fast) linear;
  }

  @container post-studio (min-width: 105rem) {
    .actionbar {
      min-height: 4rem;
      padding: 0.625rem 1.25rem;
    }

    .missing-state,
    .secondary-button,
    .render-button,
    .download-button {
      min-height: 3.25rem;
    }

    .missing-state {
      font-size: 0.8125rem;
    }

    .secondary-button,
    .render-button,
    .download-button {
      font-size: 0.9375rem;
    }
  }

  @container post-studio (min-width: 180rem) {
    .actionbar {
      gap: 2.5rem;
      min-height: 5rem;
      padding: 0.75rem 2.5rem;
    }

    .state,
    .export-actions {
      gap: 1rem;
    }

    .missing-state,
    .secondary-button,
    .render-button,
    .download-button {
      min-height: 3.75rem;
    }

    .missing-state {
      font-size: 1rem;
    }

    .secondary-button,
    .render-button,
    .download-button {
      padding-inline: 1.25rem;
      font-size: 1.125rem;
    }

    .export-progress {
      width: 14rem;
      font-size: 1rem;
    }
  }

  @container post-studio (max-width: 70rem) {
    .actionbar {
      gap: var(--spacing-sm);
    }

    .rerender-button,
    .export-progress {
      display: none;
    }
  }

  @container post-studio (max-width: 35rem) {
    .actionbar {
      min-height: 3rem;
      padding-inline: var(--spacing-sm);
    }

    .render-button,
    .download-button {
      width: 2.75rem;
      padding: 0;
      font-size: 0;
    }

    .render-button i,
    .download-button i {
      font-size: var(--font-size-min);
    }
  }

  @media (max-height: 40rem) {
    .actionbar {
      min-height: 3rem;
      padding-block: var(--spacing-xs);
    }

    .rerender-button,
    .export-progress {
      display: none;
    }
  }
</style>
