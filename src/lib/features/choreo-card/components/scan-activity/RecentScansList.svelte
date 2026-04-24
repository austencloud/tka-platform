<!-- Compact list of most recent scan events rendered under the minimap globe. -->
<script lang="ts">
  import type { ScanEventRow } from "$lib/features/choreo-card/state/scan-activity-state.svelte";

  let {
    events,
    onRowClick,
    limit = 4,
  }: { events: ScanEventRow[]; onRowClick: (code: string) => void; limit?: number } = $props();

  const rows = $derived(events.slice(0, limit));

  function ago(ts: string): string {
    const ms = Date.now() - new Date(ts).getTime();
    const m = Math.floor(ms / 60000);
    if (m < 1) return "now";
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h`;
  }
</script>

<div class="list">
  {#each rows as r (r.code + r.timestamp)}
    <button class="row" onclick={() => onRowClick(r.code)}>
      <span class="city">{r.city ?? "—"}</span>
      <span class="code">{r.code}</span>
      <span class="when">{ago(r.timestamp)}</span>
    </button>
  {/each}
  {#if rows.length === 0}
    <p class="empty">No recent scans.</p>
  {/if}
</div>

<style>
  .list { display: flex; flex-direction: column; gap: 6px; }
  .row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 0 10px;
    background: var(--theme-panel-bg, #0b0d17); border: 1px solid var(--theme-stroke, #1a1f2e); border-radius: 6px;
    font-size: var(--font-size-sm, 14px); color: inherit; font: inherit;
    min-height: 44px; cursor: pointer; gap: 8px; text-align: left;
  }
  .row:hover { border-color: var(--theme-accent, rgba(16, 185, 129, 0.4)); }
  .row:focus-visible { outline: 2px solid var(--theme-accent, #34d399); outline-offset: 2px; }
  .city { color: var(--theme-text-muted, #d0d5e0); flex: 1; min-width: 0; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; }
  .code { font-family: monospace; color: var(--theme-accent, #34d399); }
  .when { color: var(--theme-text-dim, #6b7491); }
  .empty { color: var(--theme-text-dim, #6b7491); font-size: var(--font-size-sm, 14px); }
</style>
