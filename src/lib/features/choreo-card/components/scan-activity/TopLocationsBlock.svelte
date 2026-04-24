<!-- Horizontal bar chart of top 5 scan-origin countries over a rolling window. -->
<script lang="ts">
  import type { ScanEventRow } from "$lib/features/choreo-card/state/scan-activity-state.svelte";

  let { events, windowDays = 7 }: { events: ScanEventRow[]; windowDays?: number } = $props();

  const buckets = $derived.by(() => {
    const cutoff = Date.now() - windowDays * 86400000;
    const counts = new Map<string, number>();
    for (const e of events) {
      if (!e.country) continue;
      if (new Date(e.timestamp).getTime() < cutoff) continue;
      counts.set(e.country, (counts.get(e.country) ?? 0) + 1);
    }
    const arr = Array.from(counts.entries())
      .map(([country, n]) => ({ country, n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 5);
    const max = arr[0]?.n ?? 1;
    return arr.map((b) => ({ ...b, pct: (b.n / max) * 100 }));
  });
</script>

<div class="block">
  <h5>Top locations <span class="win">· {windowDays}d</span></h5>
  {#if buckets.length === 0}
    <p class="empty">No scans yet.</p>
  {:else}
    {#each buckets as b}
      <div class="row">
        <span class="name">{b.country}</span>
        <span class="bar-wrap"><span class="fill" style:width={`${b.pct}%`}></span></span>
        <span class="val">{b.n}</span>
      </div>
    {/each}
  {/if}
</div>

<style>
  .block { background: var(--theme-card-bg, #0f1220); border: 1px solid var(--theme-stroke, #1a1f2e); border-radius: 8px; padding: 14px; }
  h5 { margin: 0 0 10px; color: var(--theme-text-muted, #d0d5e0); font-size: var(--font-size-sm, 14px); font-weight: 600; }
  .win { color: var(--theme-text-dim, #6b7491); font-weight: 400; }
  .row { display: flex; align-items: center; gap: 8px; font-size: var(--font-size-sm, 14px); padding: 8px 0; border-bottom: 1px solid var(--theme-stroke, #1a1f2e); min-height: 44px; }
  .row:last-child { border-bottom: none; }
  .name { color: var(--theme-text-muted, #d0d5e0); flex: 0 0 auto; }
  .bar-wrap { flex: 1; height: 6px; background: var(--theme-panel-bg, #0b0d17); border-radius: 3px; overflow: hidden; }
  .fill { display: block; height: 100%; background: linear-gradient(90deg, var(--theme-accent, #10b981), var(--theme-accent, #34d399)); }
  .val { color: var(--theme-accent, #34d399); font-weight: 600; min-width: 28px; text-align: right; }
  .empty { color: var(--theme-text-dim, #6b7491); font-size: var(--font-size-sm, 14px); margin: 0; }
</style>
