<script lang="ts">
  /**
   * CollisionReadout
   *
   * Shows the current pose's collision state: severity badge + list of
   * colliding zones with their penetration depth. Empty state when clear.
   */

  import { getCollisionLabContext } from "../context/collision-lab-context";
  import type { SnapshotSeverity } from "../domain/types";

  const { state } = getCollisionLabContext();

  const severityColor: Record<SnapshotSeverity, string> = {
    clear: "#22c55e",
    graze: "#eab308",
    clip: "#f97316",
    penetrate: "#ef4444",
  };

  const severityLabel: Record<SnapshotSeverity, string> = {
    clear: "CLEAR",
    graze: "GRAZE",
    clip: "CLIP",
    penetrate: "PENETRATE",
  };

  const snapshot = $derived(state.currentCollision);
  const severity = $derived<SnapshotSeverity>(snapshot?.severity ?? "clear");
</script>

<div class="readout">
  <div class="severity-badge" style="background: {severityColor[severity]};">
    {severityLabel[severity]}
  </div>

  {#if snapshot && snapshot.zones.length > 0}
    <ul class="zones">
      {#each snapshot.zones as zone}
        <li>
          <span class="zone-type">{zone.type.replace(/-/g, " ")}</span>
          <span class="zone-depth">{zone.depthCm.toFixed(1)}cm</span>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="empty">No collisions detected.</p>
  {/if}
</div>

<style>
  .readout {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 14px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    height: 100%;
    box-sizing: border-box;
  }
  .severity-badge {
    /*
      Opt out of flex-column's default stretch so the pill sizes to its
      content instead of spanning the full panel width. Also tightened
      padding + font so it sits in proportion with the neighboring panels.
    */
    align-self: flex-start;
    padding: 5px 14px;
    border-radius: 999px;
    font-weight: 700;
    font-size: 13px;
    color: white;
    letter-spacing: 0.5px;
  }
  .zones {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .zones li {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    padding: 4px 8px;
    background: var(--theme-panel-bg);
    border-radius: 4px;
  }
  .zone-type {
    text-transform: capitalize;
  }
  .zone-depth {
    font-family: monospace;
    opacity: 0.8;
  }
  .empty {
    margin: 0;
    font-size: 12px;
    opacity: 0.6;
  }
</style>
