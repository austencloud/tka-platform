<script lang="ts">
  import { fly } from "svelte/transition";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import type { GenerationSettings } from "$lib/features/landing/domain/models/spinner-models";
  import type * as sequenceDataSerializerModule from "$lib/features/landing/services/sequence-data-serializer";
  type SequenceDataSerializer = typeof sequenceDataSerializerModule;

  export interface SequenceHistoryEntry {
    sequence: SequenceData;
    settings: GenerationSettings | null;
    timestamp: Date;
  }

  interface Props {
    entries: SequenceHistoryEntry[];
    serializer: SequenceDataSerializer;
  }

  let { entries, serializer }: Props = $props();

  let copiedIndex = $state<number | null>(null);
  let copiedFormat = $state<"compact" | "full" | null>(null);

  async function copyEntry(entry: SequenceHistoryEntry, index: number, full: boolean) {
    const text = full
      ? serializer.toFullJson(entry.sequence, entry.settings)
      : serializer.toCompactDebug(entry.sequence, entry.settings);

    try {
      await navigator.clipboard.writeText(text);
      copiedIndex = index;
      copiedFormat = full ? "full" : "compact";
      setTimeout(() => {
        copiedIndex = null;
        copiedFormat = null;
      }, 1500);
    } catch {
      // Fallback for non-secure contexts
      fallbackCopy(text);
      copiedIndex = index;
      copiedFormat = full ? "full" : "compact";
      setTimeout(() => {
        copiedIndex = null;
        copiedFormat = null;
      }, 1500);
    }
  }

  function fallbackCopy(text: string) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }

  function formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  function formatLoopType(settings: GenerationSettings | null): string {
    if (!settings) return "";
    return settings.loopType.replace(/^strict_/i, "").replace(/_/g, " ").toLowerCase();
  }
</script>

<div class="history-panel" transition:fly={{ y: 100, duration: 250 }}>
  <div class="panel-header">
    <span class="panel-title">Recent Sequences</span>
    <span class="entry-count">{entries.length}</span>
  </div>

  <div class="entries">
    {#if entries.length === 0}
      <div class="empty">No sequences played yet</div>
    {:else}
      {#each entries as entry, i}
        <div class="entry" class:current={i === 0}>
          <div class="entry-info">
            <span class="entry-index">#{entries.length - i}</span>
            <span class="entry-word">{entry.sequence.word || "Generated"}</span>
            {#if entry.settings}
              <span class="entry-loop">{formatLoopType(entry.settings)}</span>
            {/if}
            <span class="entry-time">{formatTime(entry.timestamp)}</span>
          </div>
          <div class="entry-actions">
            <button
              class="copy-btn"
              class:copied={copiedIndex === i && copiedFormat === "compact"}
              onclick={() => copyEntry(entry, i, false)}
              title="Copy compact debug format"
            >
              {copiedIndex === i && copiedFormat === "compact" ? "Copied" : "Copy"}
            </button>
            <button
              class="copy-btn full"
              class:copied={copiedIndex === i && copiedFormat === "full"}
              onclick={() => copyEntry(entry, i, true)}
              title="Copy full JSON"
            >
              {copiedIndex === i && copiedFormat === "full" ? "Copied" : "Full"}
            </button>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .history-panel {
    width: 100%;
    max-width: 520px;
    max-height: 320px;
    display: flex;
    flex-direction: column;
    background: rgba(10, 10, 20, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .panel-title {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: rgba(255, 255, 255, 0.8);
  }

  .entry-count {
    font-size: var(--font-size-compact, 12px);
    color: rgba(255, 255, 255, 0.4);
    background: rgba(255, 255, 255, 0.08);
    padding: 2px 8px;
    border-radius: 10px;
  }

  .entries {
    flex: 1;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2)) transparent;
  }

  .empty {
    padding: 24px;
    text-align: center;
    color: rgba(255, 255, 255, 0.3);
    font-size: var(--font-size-min, 14px);
  }

  .entry {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    gap: 8px;
  }

  .entry.current {
    background: rgba(99, 102, 241, 0.08);
  }

  .entry:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .entry-info {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  .entry-index {
    font-size: var(--font-size-compact, 12px);
    color: rgba(255, 255, 255, 0.3);
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
  }

  .entry-word {
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    color: rgba(255, 255, 255, 0.9);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .entry-loop {
    font-size: var(--font-size-compact, 12px);
    color: rgba(139, 92, 246, 0.8);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .entry-time {
    font-size: var(--font-size-compact, 12px);
    color: rgba(255, 255, 255, 0.25);
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
  }

  .entry-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .copy-btn {
    padding: 4px 10px;
    min-height: 28px;
    font-size: var(--font-size-compact, 12px);
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .copy-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.9);
  }

  .copy-btn.full {
    color: rgba(255, 255, 255, 0.4);
  }

  .copy-btn.copied {
    background: rgba(74, 222, 128, 0.15);
    border-color: rgba(74, 222, 128, 0.3);
    color: rgba(74, 222, 128, 0.9);
  }

  .copy-btn:focus-visible {
    outline: 2px solid #6366f1;
    outline-offset: 2px;
  }

  @media (max-width: 600px) {
    .entry-loop,
    .entry-time {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .copy-btn {
      transition: none;
    }
  }
</style>
