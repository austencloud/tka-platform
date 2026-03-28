<script lang="ts">
  import type { MuseumTile } from "../../domain/museum-grid-types";
  import { getTileMetadata } from "../../domain/tile-registry";

  interface Props {
    tile: MuseumTile;
    tileSize: number;
  }

  let { tile, tileSize }: Props = $props();

  let meta = $derived(getTileMetadata(tile.type));
  let materialClass = $derived(tile.material ? `material-${tile.material}` : "");
</script>

<div
  class="museum-tile {meta.cssClass} {materialClass}"
  style="width: {tileSize}px; height: {tileSize}px;"
  role="presentation"
>
  {#if meta.icon}
    <i class="fas {meta.icon} tile-icon" aria-hidden="true"></i>
  {/if}
</div>

<style>
  .museum-tile {
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    position: relative;
  }

  .tile-icon {
    font-size: 1em;
    opacity: 0.9;
    pointer-events: none;
    filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.5));
  }

  /* ---- Tile types ---- */

  .tile-floor {
    background: #2a2520;
    border: 1px solid rgba(255, 255, 255, 0.03);
  }

  .tile-wall {
    background:
      repeating-linear-gradient(
        0deg,
        transparent,
        transparent 45%,
        rgba(255, 255, 255, 0.04) 45%,
        rgba(255, 255, 255, 0.04) 48%
      ),
      repeating-linear-gradient(
        90deg,
        transparent,
        transparent 48%,
        rgba(255, 255, 255, 0.03) 48%,
        rgba(255, 255, 255, 0.03) 52%
      ),
      #1a1510;
    border: 1px solid rgba(0, 0, 0, 0.6);
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.04),
      inset 0 2px 6px rgba(0, 0, 0, 0.5);
  }

  .tile-door {
    background: #3a3020;
    border: 1px solid rgba(200, 180, 140, 0.2);
  }

  .tile-exhibit {
    background: #1e1e2e;
    border: 2px solid rgba(150, 200, 255, 0.35);
    box-shadow:
      inset 0 0 10px rgba(150, 200, 255, 0.12),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
    background-image: linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.04) 0%,
      transparent 50%,
      rgba(150, 200, 255, 0.03) 100%
    );
  }

  .tile-exhibit .tile-icon {
    color: #c8b890;
    opacity: 0.9;
  }

  .tile-performer {
    background: #1e2e1e;
    border: 2px solid rgba(150, 200, 255, 0.35);
    box-shadow:
      inset 0 0 10px rgba(150, 200, 255, 0.12),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
    background-image: linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.04) 0%,
      transparent 50%,
      rgba(150, 200, 255, 0.03) 100%
    );
  }

  .tile-performer .tile-icon {
    color: #8cc88c;
    opacity: 0.9;
  }

  .tile-torch {
    background: #2a2520;
    border: 1px solid rgba(255, 160, 60, 0.15);
  }

  .tile-torch .tile-icon {
    color: #ff9030;
    opacity: 1;
    animation: torch-flicker 0.4s ease-in-out infinite alternate;
    filter: drop-shadow(0 0 4px rgba(255, 140, 40, 0.6));
  }

  @keyframes torch-flicker {
    0% { transform: scale(1) translateY(0); opacity: 0.85; }
    100% { transform: scale(1.1) translateY(-1px); opacity: 1; }
  }

  .tile-pedestal {
    background: #2e2a22;
    border: 2px solid rgba(150, 200, 255, 0.35);
    box-shadow:
      inset 0 0 10px rgba(150, 200, 255, 0.12),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
    background-image: linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.04) 0%,
      transparent 50%,
      rgba(150, 200, 255, 0.03) 100%
    );
  }

  .tile-pedestal .tile-icon {
    color: #c8b890;
    opacity: 1;
  }

  .tile-trigger {
    background: #2a2520;
    border: 1px solid rgba(255, 255, 255, 0.03);
  }

  .tile-corridor {
    background: #252018;
    border: 1px solid rgba(255, 255, 255, 0.02);
  }

  /* ---- Floor materials ---- */

  .material-stone {
    background-image:
      radial-gradient(circle at 20% 30%, rgba(255, 255, 255, 0.02) 0%, transparent 40%),
      radial-gradient(circle at 80% 70%, rgba(0, 0, 0, 0.1) 0%, transparent 40%);
  }

  .material-marble {
    background-image:
      linear-gradient(135deg, rgba(255, 255, 255, 0.03) 25%, transparent 25%),
      linear-gradient(225deg, rgba(255, 255, 255, 0.02) 25%, transparent 25%);
  }

  .material-marble.tile-floor {
    background-color: #2e2b28;
  }

  .material-wood {
    background-image:
      repeating-linear-gradient(
        90deg,
        transparent,
        transparent 60%,
        rgba(139, 90, 43, 0.08) 60%,
        rgba(139, 90, 43, 0.08) 62%
      );
  }

  .material-wood.tile-floor {
    background-color: #302418;
  }

  .material-dirt.tile-floor {
    background-color: #28201a;
  }

  .material-sandstone.tile-floor {
    background-color: #302a1e;
  }

  .material-sandstone {
    background-image:
      radial-gradient(circle at 50% 50%, rgba(200, 180, 140, 0.04) 0%, transparent 60%);
  }
</style>
