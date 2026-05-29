<!--
  ArrowAdjustmentHistory.svelte

  Collapsible history panel showing recent arrow adjustment changes.
  Admin-only. Lazy-loads from Firestore when expanded.
-->
<script lang="ts">
  import { getFirestoreInstance } from "$lib/shared/auth/firebase";
  import {
    collection,
    query,
    orderBy,
    limit,
    getDocs,
  } from "firebase/firestore";
  import { getGlobalAdjustmentRepository } from "$lib/shared/pictograph/arrow/positioning/global/services/global-adjustment-singleton";
  import { globalAdjustmentVersion } from "$lib/shared/pictograph/arrow/positioning/global/state/global-adjustment-version.svelte";
  import { pictographPreparer } from "$lib/shared/pictograph/shared/services/pictograph-preparer";
  import { createComponentLogger } from "$lib/shared/utils/debug-logger";

  const logger = createComponentLogger("ArrowAdjustmentHistory");

  interface HistoryEntry {
    id: string;
    action: string;
    adjustmentX: number;
    adjustmentY: number;
    previousX: number;
    previousY: number;
    timestamp: Date | null;
    updatedBy: string;
    sourceKey: string;
    letter: string;
    arrowKey: string;
  }

  let expanded = $state(false);
  let entries = $state<HistoryEntry[]>([]);
  let loading = $state(false);

  async function loadHistory() {
    loading = true;
    try {
      const firestore = await getFirestoreInstance();
      const q = query(
        collection(firestore, "global_arrow_adjustment_history"),
        orderBy("timestamp", "desc"),
        limit(15)
      );

      const snap = await getDocs(q);
      entries = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          action: data.action ?? "save",
          adjustmentX: data.adjustmentX ?? 0,
          adjustmentY: data.adjustmentY ?? 0,
          previousX: data.previousX ?? 0,
          previousY: data.previousY ?? 0,
          timestamp: data.timestamp?.toDate?.() ?? null,
          updatedBy: data.updatedBy ?? "unknown",
          sourceKey: data.sourceKey ?? "",
          letter: data.letter ?? "?",
          arrowKey: data.arrowKey ?? "?",
        };
      });
    } catch (error) {
      logger.error("Failed to load history:", error);
      entries = [];
    } finally {
      loading = false;
    }
  }

  function toggle() {
    expanded = !expanded;
    if (expanded) {
      loadHistory();
    }
  }

  function formatTime(date: Date | null): string {
    if (!date) return "?";
    const now = Date.now();
    const diff = now - date.getTime();
    if (diff < 60_000) return "just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return date.toLocaleDateString();
  }

  function formatSourceKey(key: string): string {
    // Show abbreviated key: letter|arrowColor
    const parts = key.split("|");
    if (parts.length >= 5) {
      return `${parts[2]}·${parts[4]}`;
    }
    return key.slice(0, 20);
  }

  async function revertTo(entry: HistoryEntry) {
    const repo = getGlobalAdjustmentRepository();
    if (!repo || !entry.sourceKey) return;

    try {
      const parts = entry.sourceKey.split("|");
      if (parts.length < 5) return;

      const targetKey = {
        gridMode: parts[0]!,
        oriKey: parts[1]!,
        letter: parts[2]!,
        turnsTuple: parts[3]!,
        arrowKey: parts[4]!,
        ...(parts[5] ? { propType: parts[5] } : {}),
        ...(parts[6] ? { otherPropType: parts[6] } : {}),
      };

      // Restore the values from this history entry
      repo.saveAdjustmentLocal({
        ...targetKey,
        adjustmentX: entry.adjustmentX,
        adjustmentY: entry.adjustmentY,
      });

      pictographPreparer.clearCache();
      globalAdjustmentVersion.increment();

      // Persist
      await repo.saveAdjustment({
        ...targetKey,
        adjustmentX: entry.adjustmentX,
        adjustmentY: entry.adjustmentY,
      });

      // Reload history
      await loadHistory();
    } catch (error) {
      logger.error("Failed to revert:", error);
    }
  }
</script>

<div class="history-panel">
  <button class="toggle-btn" onclick={toggle} aria-expanded={expanded}>
    <i class="fas fa-history" aria-hidden="true"></i>
    {#if expanded}Hide{:else}History{/if}
  </button>

  {#if expanded}
    <div class="history-list">
      {#if loading}
        <span class="status-msg">
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        </span>
      {:else if entries.length === 0}
        <span class="status-msg">No history</span>
      {:else}
        {#each entries as entry (entry.id)}
          <div class="history-row">
            <span
              class="action-badge"
              class:save={entry.action === "save"}
              class:delete={entry.action === "delete"}
              class:undo={entry.action === "undo"}
              class:reset={entry.action === "reset"}
            >
              {entry.action}
            </span>
            <span class="key-label">{formatSourceKey(entry.sourceKey)}</span>
            <span class="coords">({entry.adjustmentX}, {entry.adjustmentY})</span>
            <span class="time">{formatTime(entry.timestamp)}</span>
            <button
              class="revert-btn"
              onclick={() => revertTo(entry)}
              title="Revert to ({entry.adjustmentX}, {entry.adjustmentY})"
            >
              <i class="fas fa-undo" aria-hidden="true"></i>
            </button>
          </div>
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .history-panel {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.03);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.65rem;
    transition: all var(--duration-fast) ease;
  }

  .toggle-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: white;
  }

  .history-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 200px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2)) transparent;
  }

  .history-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 6px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
    font-size: 0.65rem;
  }

  .action-badge {
    font-size: 0.55rem;
    font-weight: 600;
    text-transform: uppercase;
    padding: 1px 4px;
    border-radius: 2px;
    min-width: 32px;
    text-align: center;
  }

  .action-badge.save {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
  }
  .action-badge.delete,
  .action-badge.reset {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }
  .action-badge.undo {
    background: rgba(96, 165, 250, 0.2);
    color: #60a5fa;
  }

  .key-label {
    font-family: "SF Mono", Monaco, monospace;
    font-size: 0.6rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    min-width: 40px;
  }

  .coords {
    font-family: "SF Mono", Monaco, monospace;
    font-size: 0.65rem;
    color: white;
    min-width: 80px;
  }

  .time {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    font-size: 0.6rem;
    flex: 1;
  }

  .revert-btn {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 1px solid rgba(251, 191, 36, 0.3);
    background: transparent;
    color: #fbbf24;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.5rem;
    padding: 0;
    transition: all var(--duration-fast) ease;
  }

  .revert-btn:hover {
    background: rgba(251, 191, 36, 0.2);
    color: #fcd34d;
  }

  .status-msg {
    font-size: 0.65rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    padding: 4px 8px;
  }

  @media (prefers-reduced-motion: reduce) {
    .toggle-btn,
    .revert-btn {
      transition: none;
    }
  }
</style>
