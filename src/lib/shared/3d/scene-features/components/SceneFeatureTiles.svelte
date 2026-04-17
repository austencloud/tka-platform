<script lang="ts">
  /**
   * SceneFeatureTiles
   *
   * Scene tab content for Viewer3DGearPopover — thumbnail-per-feature tile grid.
   * Active tiles get a colored glow + status dot. Async features show a shimmer
   * while loading (enabled but not yet reported ready).
   */

  import { getSceneFeatureContext } from "../context/scene-feature-context";

  const sceneFeatures = getSceneFeatureContext();

  const ACCENTS: Record<string, string> = {
    stage: "#a78bfa",
    audience: "#ec4899",
    environment: "#f59e0b",
    campfire: "#f97316",
    tent: "#84cc16",
  };

  // Derive loading state from existing API: async feature + enabled + not yet
  // reportReady()'d. SceneFeatureState exposes allEnabledReady/readyProgress
  // but not per-key readiness, so we infer from allEnabledReady as a proxy
  // for "still waiting" per-tile. Until a per-key API lands, any async tile
  // that is enabled-but-not-everyone-ready will show the shimmer.
  function isLoading(key: string, requiresAsync: boolean): boolean {
    if (!requiresAsync) return false;
    if (!sceneFeatures.isEnabled(key)) return false;
    return !sceneFeatures.allEnabledReady;
  }
</script>

<div class="tiles">
  {#each sceneFeatures.features as feature (feature.key)}
    {@const enabled = sceneFeatures.isEnabled(feature.key)}
    {@const loading = isLoading(feature.key, feature.requiresAsyncLoad)}
    <button
      class="tile"
      class:loading
      style:--tile-color={ACCENTS[feature.key] ?? "#888"}
      aria-pressed={enabled}
      onclick={() => sceneFeatures.toggle(feature.key)}
    >
      <div
        class="thumb"
        style:background-image="url(/images/scene-thumbs/{feature.key}.png)"
      ></div>
      <div class="foot">
        <span class="label">{feature.label}</span>
        <span class="status"></span>
      </div>
    </button>
  {/each}
</div>

<style>
  .tiles {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  .tile {
    position: relative;
    aspect-ratio: 1;
    border-radius: 12px;
    border: 1.5px solid rgba(255, 255, 255, 0.1);
    background: rgba(0, 0, 0, 0.35);
    padding: 0;
    cursor: pointer;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: transform 160ms cubic-bezier(0.2, 0, 0.13, 1.5),
      border-color 160ms, box-shadow 160ms;
  }

  .tile:hover {
    transform: translateY(-2px);
    border-color: rgba(255, 255, 255, 0.22);
  }

  .thumb {
    flex: 1;
    background-size: cover;
    background-position: center;
    filter: saturate(0.25) brightness(0.55);
    transition: filter 160ms;
    position: relative;
  }

  .tile[aria-pressed="true"] .thumb {
    filter: none;
  }

  .foot {
    height: 32px;
    padding: 0 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(0, 0, 0, 0.45);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .label {
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.62);
  }

  .tile[aria-pressed="true"] .label {
    color: white;
  }

  .status {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.12);
    transition: background 160ms, box-shadow 160ms;
  }

  .tile[aria-pressed="true"] {
    border-color: var(--tile-color);
    box-shadow: 0 6px 22px
        color-mix(in srgb, var(--tile-color) 30%, transparent),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }

  .tile[aria-pressed="true"] .status {
    background: var(--tile-color);
    box-shadow: 0 0 10px var(--tile-color);
  }

  .tile.loading .thumb::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255, 255, 255, 0.1) 50%,
      transparent 100%
    );
    animation: shimmer 1.4s linear infinite;
  }

  @keyframes shimmer {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }
</style>
