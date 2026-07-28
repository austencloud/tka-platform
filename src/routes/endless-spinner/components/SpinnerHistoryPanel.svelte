<!--
  SpinnerHistoryPanel.svelte

  The "Recent Sequences" drawer under the transport bar: every sequence the
  spinner has played this visit, newest first, each with a Copy action. Owns
  its own per-row "Copied" feedback; the page owns the actual clipboard call
  (and its error toast) through onCopyEntry.
-->
<script lang="ts">
  import { onDestroy } from "svelte";
  import { flyFade } from "$lib/shared/transitions/motion";
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import type { PlaybackHistoryEntry } from "$lib/shared/animation-engine/domain/chaining-types";

  let {
    entries,
    onCopyEntry,
  }: {
    entries: readonly PlaybackHistoryEntry[];
    /** Resolves true when the sequence data reached the clipboard. */
    onCopyEntry: (index: number) => Promise<boolean>;
  } = $props();

  let copiedIndex = $state<number | null>(null);
  let copyResetTimeout: ReturnType<typeof setTimeout> | null = null;

  async function handleCopy(index: number) {
    const copied = await onCopyEntry(index);
    if (!copied) return;
    copiedIndex = index;
    if (copyResetTimeout) clearTimeout(copyResetTimeout);
    copyResetTimeout = setTimeout(() => {
      copiedIndex = null;
      copyResetTimeout = null;
    }, 1500);
  }

  onDestroy(() => {
    if (copyResetTimeout) clearTimeout(copyResetTimeout);
  });
</script>

<div class="history-panel" transition:flyFade={{ y: 100, duration: 250 }}>
  <div class="panel-header">
    <span class="panel-title">{t("landing_spinner_recent_sequences")}</span>
    <span class="entry-count">{entries.length}</span>
  </div>
  {#if entries.length > 0}
    <div class="entries themed-scrollbar">
      {#each entries as entry, i (entry.timestamp)}
        <div class="entry" class:current={i === 0}>
          <div class="entry-info">
            <span class="entry-index">#{entries.length - i}</span>
            <span class="entry-word"
              >{simplifyRepeatedWord(entry.word ?? entry.sequence.word ?? "") ||
                t("landing_spinner_generated")}</span
            >
            <span class="entry-mode">{entry.sourceMode}</span>
            <span class="entry-steps"
              >{t("landing_infinite_steps", {
                count: entry.sequence.steps?.length ?? 0,
              })}</span
            >
          </div>
          <div class="entry-actions">
            <button
              type="button"
              class="history-copy-btn"
              class:copied={copiedIndex === i}
              onclick={() => handleCopy(i)}
              >{copiedIndex === i
                ? t("landing_spinner_copied")
                : t("landing_spinner_copy")}</button
            >
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="empty-history">
      {t("landing_spinner_history_empty")}
    </div>
  {/if}
</div>

<style>
  .history-panel {
    width: 100%;
    max-height: min(24rem, 48dvh);
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    background: var(--theme-card-bg, rgba(10, 10, 20, 0.96));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 1rem;
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .panel-title {
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 600;
    color: var(--theme-text, rgba(255, 255, 255, 0.8));
  }

  .entry-count {
    font-size: var(--font-size-compact, 0.75rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    padding: 0.125rem 0.5rem;
    border-radius: 0.625rem;
  }

  .entries {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2))
      transparent;
  }

  .entry {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.04));
    gap: 0.5rem;
  }

  .entry.current {
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 8%, transparent);
  }

  .entry:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .entry-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  .entry-index {
    font-size: var(--font-size-compact, 0.75rem);
    color: var(--theme-text-tertiary, rgba(255, 255, 255, 0.3));
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
  }

  .entry-word {
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 500;
    color: var(--theme-text, rgba(255, 255, 255, 0.9));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .entry-mode {
    font-size: var(--font-size-compact, 0.75rem);
    color: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 80%,
      transparent
    );
    white-space: nowrap;
    flex-shrink: 0;
  }

  .entry-steps {
    font-size: var(--font-size-compact, 0.75rem);
    color: var(--theme-text-tertiary, rgba(255, 255, 255, 0.25));
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
  }

  .entry-actions {
    display: flex;
    gap: 0.25rem;
    flex-shrink: 0;
  }

  .history-copy-btn {
    padding: 0.5rem 0.875rem;
    min-height: var(--min-touch-target, 44px);
    /* Wide enough for the "Copied" state so the swap never resizes the button. */
    min-width: 4.75rem;
    text-align: center;
    font-size: var(--font-size-compact, 0.75rem);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.08));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 0.375rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .history-copy-btn:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.12));
    color: var(--theme-text, rgba(255, 255, 255, 0.9));
  }

  .history-copy-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .history-copy-btn.copied {
    background: color-mix(
      in srgb,
      var(--semantic-success, #22c55e) 15%,
      transparent
    );
    border-color: color-mix(
      in srgb,
      var(--semantic-success, #22c55e) 30%,
      transparent
    );
    color: color-mix(in srgb, var(--semantic-success, #22c55e) 70%, white);
  }

  .empty-history {
    padding: 1.5rem 1rem;
    text-align: center;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.45));
    font-size: var(--font-size-min, 0.875rem);
  }

  @media (max-width: 600px) {
    .entry-mode,
    .entry-steps {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .history-copy-btn {
      transition: none;
    }
  }
</style>
