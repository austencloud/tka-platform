<script lang="ts">
  import type { Snippet } from "svelte";
  import type { PostStudioExportProgress } from "$lib/shared/media-composition/services/post-studio-exporter";
  import TKAWordGlyph from "$lib/shared/choreo-card/components/TKAWordGlyph.svelte";

  interface Props {
    sequenceName: string;
    presetName: string;
    /**
     * Saved layouts, as one control rather than a column. The arrangement is
     * now built by choosing sources in the preview, so a preset list is a
     * shortcut to a known arrangement — top-bar weight, not rail weight.
     */
    layouts?: Snippet;
    missingCount: number;
    missingLabel?: string;
    canRender: boolean;
    exporting: boolean;
    exportProgress: PostStudioExportProgress | null;
    exportPercent: number;
    exportedUrl: string | null;
    exportFilename: string;
    onBack?: () => void;
    onClose?: () => void;
    onFixMissing: () => void;
    onRender: () => void;
    onCancelExport: () => void;
  }

  let {
    sequenceName,
    presetName,
    layouts,
    missingCount,
    missingLabel = "source",
    canRender,
    exporting,
    exportProgress,
    exportPercent,
    exportedUrl,
    exportFilename,
    onBack,
    onClose,
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

<header class="topbar">
  <div class="navigation-actions">
    {#if onBack}
      <button
        type="button"
        class="icon-button back-button"
        aria-label="Share, back to sharing"
        onclick={onBack}
      >
        <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
        <span>Share</span>
      </button>
    {/if}
  </div>

  <div class="title-block">
    <span>Post Studio</span>
    <h2 id="post-studio-title" aria-label={sequenceName}>
      <TKAWordGlyph word={sequenceName} height={26} darkMode fitToParent />
    </h2>
  </div>

  <div class="project-state">
    {#if layouts}
      {@render layouts()}
    {:else}
      <span class="preset-name">{presetName}</span>
    {/if}
    {#if missingCount > 0}
      <button type="button" class="missing-state" onclick={onFixMissing}>
        <i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
        {missingCount === 1
          ? `${missingLabel} needed`
          : `${missingCount} sources needed`}
      </button>
    {:else}
      <span class="ready-state">
        <i class="fa-solid fa-circle-check" aria-hidden="true"></i>
        Ready
      </span>
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

    {#if onClose}
      <button
        type="button"
        class="icon-button close-button"
        aria-label="Close Post Studio"
        onclick={onClose}
      >
        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
      </button>
    {/if}
  </div>
</header>

<style>
  .topbar {
    display: grid;
    grid-template-columns: auto minmax(12rem, 0.7fr) minmax(16rem, 1fr) auto;
    align-items: center;
    gap: var(--spacing-lg);
    min-height: 4.5rem;
    padding: 0.625rem var(--spacing-md);
    border-bottom: 1px solid var(--theme-stroke);
    background: var(--theme-panel-bg);
  }

  .navigation-actions,
  .export-actions,
  .project-state {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    min-width: 0;
  }

  .title-block {
    display: grid;
    gap: 0.1rem;
    min-width: 0;
  }

  .title-block > span {
    color: var(--theme-accent);
    font-size: var(--font-size-compact);
    font-weight: 750;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h2 {
    display: flex;
    align-items: center;
    min-height: 1.8rem;
    margin: 0;
    overflow: hidden;
    color: var(--theme-text);
    font-size: 1.2rem;
    line-height: 1.1;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .project-state {
    justify-content: center;
  }

  .preset-name,
  .ready-state,
  .missing-state {
    min-height: 2.75rem;
    border-radius: var(--radius-2026-sm);
    font-size: var(--font-size-compact);
  }

  .preset-name {
    display: inline-flex;
    align-items: center;
    max-width: 15rem;
    padding: 0 0.75rem;
    overflow: hidden;
    border: 1px solid var(--theme-stroke);
    color: var(--theme-text-dim);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ready-state,
  .missing-state {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: 0 0.75rem;
  }

  .ready-state {
    color: var(--semantic-success);
  }

  .missing-state {
    border: 1px solid
      color-mix(in srgb, var(--semantic-warning) 48%, transparent);
    background: color-mix(in srgb, var(--semantic-warning) 10%, transparent);
    color: var(--semantic-warning);
    font: inherit;
    cursor: pointer;
  }

  .icon-button,
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

  .icon-button,
  .secondary-button {
    border: 1px solid var(--theme-stroke);
    background: var(--theme-card-bg);
  }

  .icon-button {
    padding-inline: 0.75rem;
  }

  .close-button {
    width: 2.75rem;
    padding: 0;
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

  .icon-button:hover,
  .secondary-button:hover:not(:disabled) {
    border-color: var(--theme-stroke-strong);
  }

  .icon-button:focus-visible,
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
    .topbar {
      grid-template-columns: auto minmax(14rem, 0.8fr) minmax(20rem, 1fr) auto;
      min-height: 5rem;
      padding: 0.75rem 1.25rem;
    }

    .title-block > span,
    .preset-name,
    .ready-state,
    .missing-state {
      font-size: 0.8125rem;
    }

    h2 {
      font-size: 1.35rem;
    }

    .preset-name,
    .ready-state,
    .missing-state,
    .icon-button,
    .secondary-button,
    .render-button,
    .download-button {
      min-height: 3.25rem;
    }

    .icon-button,
    .secondary-button,
    .render-button,
    .download-button {
      font-size: 0.9375rem;
    }

    .close-button {
      width: 3.25rem;
    }
  }

  @container post-studio (min-width: 180rem) {
    .topbar {
      grid-template-columns: auto minmax(18rem, 0.8fr) minmax(26rem, 1fr) auto;
      gap: 2.5rem;
      min-height: 6rem;
      padding: 1rem 2.5rem;
    }

    .navigation-actions,
    .export-actions,
    .project-state {
      gap: 1rem;
    }

    .title-block {
      gap: 0.25rem;
    }

    .title-block > span,
    .preset-name,
    .ready-state,
    .missing-state {
      font-size: 1rem;
    }

    h2 {
      font-size: 1.75rem;
    }

    .preset-name {
      max-width: 24rem;
      padding-inline: 1.25rem;
    }

    .preset-name,
    .ready-state,
    .missing-state,
    .icon-button,
    .secondary-button,
    .render-button,
    .download-button {
      min-height: 3.75rem;
    }

    .icon-button,
    .secondary-button,
    .render-button,
    .download-button {
      padding-inline: 1.25rem;
      font-size: 1.125rem;
    }

    .close-button {
      width: 3.75rem;
      padding: 0;
    }

    .export-progress {
      width: 14rem;
      font-size: 1rem;
    }
  }

  @container post-studio (max-width: 70rem) {
    .topbar {
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: var(--spacing-sm);
    }

    .project-state {
      display: none;
    }

    .export-actions {
      justify-content: end;
    }

    .rerender-button,
    .export-progress,
    .back-button span {
      display: none;
    }
  }

  @container post-studio (max-width: 35rem) {
    .topbar {
      min-height: 4rem;
      padding-inline: var(--spacing-sm);
    }

    .title-block > span {
      display: none;
    }

    h2 {
      font-size: 1rem;
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

    .back-button {
      width: 2.75rem;
      padding: 0;
    }
  }

  @media (max-height: 40rem) {
    .topbar {
      min-height: 3.5rem;
      padding-block: var(--spacing-xs);
    }

    .title-block > span,
    .project-state,
    .rerender-button,
    .export-progress,
    .back-button span {
      display: none;
    }
  }
</style>
