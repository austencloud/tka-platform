<script lang="ts">
  import type { MuseumTile } from "../../domain/museum-grid-types";
  import { getTileMetadata } from "../../domain/tile-registry";

  interface Props {
    tile: MuseumTile;
    /** Pixel size for game views. Omit when a parent CSS grid owns sizing. */
    tileSize?: number;
  }

  let { tile, tileSize }: Props = $props();

  let meta = $derived(getTileMetadata(tile.type));
  let materialClass = $derived(tile.material ? `material-${tile.material}` : "");

  // Show a label when the tile is large enough to fit text legibly
  let showLabel = $derived((tileSize ?? 0) >= 28);
  let tileStyle = $derived(
    tileSize === undefined
      ? "width: 100%; height: 100%;"
      : `width: ${tileSize}px; height: ${tileSize}px;`,
  );
</script>

<div
  class="museum-tile {meta.cssClass} {materialClass}"
  style={tileStyle}
  role="presentation"
>
  {#if meta.icon}
    <div class="tile-content">
      <i class="fas {meta.icon} tile-icon" aria-hidden="true"></i>
      {#if showLabel && (tile.type === "performer-station" || tile.type === "exhibit-panel" || tile.type === "pedestal" || tile.type === "sign")}
        <span class="tile-label">
          {meta.label}
        </span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .museum-tile {
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    position: relative;
    overflow: hidden;
  }

  .tile-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .tile-icon {
    font-size: 1.4em;
    opacity: 1;
    pointer-events: none;
    line-height: 1;
  }

  .tile-label {
    font-size: 0.38em;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    opacity: 0.9;
    line-height: 1;
    pointer-events: none;
    white-space: nowrap;
  }


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
    background: #12123a;
    border: 3px solid #c8b890;
    box-shadow:
      inset 0 0 14px rgba(200, 184, 144, 0.18),
      inset 0 1px 0 rgba(255, 255, 255, 0.12),
      0 0 6px rgba(200, 184, 144, 0.25);
    background-image: linear-gradient(
      160deg,
      rgba(200, 184, 144, 0.08) 0%,
      transparent 50%
    );
  }

  .tile-exhibit .tile-icon {
    color: #f0d890;
    filter: drop-shadow(0 0 4px rgba(240, 216, 144, 0.8));
  }

  .tile-exhibit .tile-label {
    color: #c8b890;
  }


  .tile-performer {
    background: #0e2e0e;
    border: 3px solid #4aaa4a;
    box-shadow:
      inset 0 0 14px rgba(74, 170, 74, 0.2),
      inset 0 -3px 0 rgba(0, 0, 0, 0.4),
      inset 0 1px 0 rgba(100, 220, 100, 0.15),
      0 0 6px rgba(74, 170, 74, 0.3);
    background-image: linear-gradient(
      180deg,
      rgba(74, 170, 74, 0.08) 0%,
      transparent 60%,
      rgba(0, 0, 0, 0.2) 100%
    );
  }

  .tile-performer .tile-icon {
    color: #6ee06e;
    filter: drop-shadow(0 0 5px rgba(110, 224, 110, 0.8));
  }

  .tile-performer .tile-label {
    color: #7ad67a;
  }


  .tile-pedestal {
    background: #3a3028;
    border: 3px solid #8a7a60;
    box-shadow:
      inset 0 -4px 0 rgba(0, 0, 0, 0.45),
      inset 0 1px 0 rgba(255, 255, 255, 0.12),
      inset 2px 0 0 rgba(255, 255, 255, 0.05),
      inset -2px 0 0 rgba(0, 0, 0, 0.2),
      0 3px 0 rgba(0, 0, 0, 0.5),
      0 0 5px rgba(138, 122, 96, 0.3);
    background-image: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.06) 0%,
      transparent 40%,
      rgba(0, 0, 0, 0.15) 100%
    );
  }

  .tile-pedestal .tile-icon {
    color: #e0c878;
    filter: drop-shadow(0 0 4px rgba(224, 200, 120, 0.7));
  }

  .tile-pedestal .tile-label {
    color: #b8a870;
  }

  /* ---- Torch - bigger flame, strong glow ---- */

  .tile-torch {
    background: #2a2520;
    border: 1px solid rgba(255, 160, 60, 0.2);
  }

  .tile-torch .tile-icon {
    font-size: 1.5em;
    color: #ffb040;
    opacity: 1;
    animation: torch-flicker 0.4s ease-in-out infinite alternate;
    filter:
      drop-shadow(0 0 5px rgba(255, 160, 40, 0.9))
      drop-shadow(0 0 10px rgba(255, 120, 20, 0.6));
  }

  @keyframes torch-flicker {
    0% {
      transform: scale(1) translateY(0);
      opacity: 0.88;
      filter:
        drop-shadow(0 0 4px rgba(255, 160, 40, 0.8))
        drop-shadow(0 0 8px rgba(255, 100, 20, 0.5));
    }
    100% {
      transform: scale(1.12) translateY(-2px);
      opacity: 1;
      filter:
        drop-shadow(0 0 7px rgba(255, 180, 60, 1))
        drop-shadow(0 0 14px rgba(255, 140, 30, 0.7));
    }
  }

  .tile-trigger {
    background: #2a2520;
    border: 1px solid rgba(255, 255, 255, 0.03);
  }

  .tile-corridor {
    background: #252018;
    border: 1px solid rgba(255, 255, 255, 0.02);
  }


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

  /* ---- Rope barrier (VTG Wing) ---- */

  .tile-rope {
    background: #2a2520;
    border: 1px solid rgba(255, 255, 255, 0.03);
    position: relative;
  }

  .tile-rope::after {
    content: "";
    position: absolute;
    top: 45%;
    left: 5%;
    right: 5%;
    height: 3px;
    background: linear-gradient(90deg, #c4a032, #e8c848, #c4a032);
    border-radius: 2px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  }

  .tile-rope .tile-icon {
    color: #c4a032;
    opacity: 0.7;
  }

  /* ---- Scaffolding (Construction Zone) ---- */

  .tile-scaffolding {
    background:
      repeating-linear-gradient(
        45deg,
        transparent,
        transparent 3px,
        rgba(200, 140, 50, 0.08) 3px,
        rgba(200, 140, 50, 0.08) 6px
      ),
      #28201a;
    border: 2px dashed rgba(200, 140, 50, 0.25);
  }

  .tile-scaffolding .tile-icon {
    color: #d4940a;
    opacity: 0.8;
  }

  /* ---- Sign (readable) ---- */

  .tile-sign {
    background: #1a2030;
    border: 2px solid #4477aa;
    box-shadow:
      inset 0 0 8px rgba(68, 119, 170, 0.15),
      0 0 4px rgba(68, 119, 170, 0.2);
  }

  .tile-sign .tile-icon {
    color: #88bbdd;
    filter: drop-shadow(0 0 3px rgba(136, 187, 221, 0.6));
  }
</style>
