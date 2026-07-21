<script lang="ts">
  import type { SeoDashboardSnapshot } from "$lib/features/admin/domain/models/seo-dashboard-model";
  import {
    formatInteger,
    formatPercent,
    formatPosition,
  } from "./seo-dashboard-format";

  let { snapshot }: { snapshot: SeoDashboardSnapshot } = $props();
</script>

<section class="panel" aria-labelledby="queries-title">
  <div class="panel-heading">
    <div>
      <span class="panel-kicker">Category ownership</span>
      <h3 id="queries-title">Query groups</h3>
    </div>
    <span class="window-label">{snapshot.currentWindow ?? "baseline"}</span>
  </div>
  <div class="table-scroll themed-scrollbar">
    <table>
      <thead>
        <tr>
          <th scope="col">Group</th>
          <th scope="col">Impressions</th>
          <th scope="col">Clicks</th>
          <th scope="col">CTR</th>
          <th scope="col">Avg. position</th>
        </tr>
      </thead>
      <tbody>
        {#each snapshot.queryGroups as group (group.id)}
          {@const metrics = group.current ?? group.baseline}
          <tr>
            <th scope="row">{group.label}</th>
            <td>{formatInteger(metrics.impressions)}</td>
            <td>{formatInteger(metrics.clicks)}</td>
            <td>{formatPercent(metrics.ctr)}</td>
            <td>{formatPosition(metrics.position)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>

<style>
  .panel {
    padding: clamp(14px, 1.6vw, 22px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 14px;
    background: var(--theme-card-bg, rgba(15, 23, 42, 0.74));
  }

  .panel-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }

  .panel-kicker,
  .window-label {
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  .panel-kicker {
    color: var(--semantic-seo-accent);
  }

  .window-label {
    color: var(--theme-text-dim, rgba(248, 250, 252, 0.58));
  }

  h3 {
    margin: 3px 0 0;
    font-size: clamp(1rem, 0.92rem + 0.4vw, 1.25rem);
  }

  .table-scroll {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--font-size-min, 0.875rem);
  }

  th,
  td {
    padding: 11px 12px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  th:first-child,
  td:first-child {
    text-align: left;
  }

  thead th {
    color: var(--theme-text-dim, rgba(248, 250, 252, 0.55));
    font-size: var(--font-size-compact, 0.75rem);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  tbody tr:last-child th,
  tbody tr:last-child td {
    border-bottom: 0;
  }

  @media (max-width: 520px) {
    .panel-heading {
      align-items: stretch;
      flex-direction: column;
    }
  }
</style>
