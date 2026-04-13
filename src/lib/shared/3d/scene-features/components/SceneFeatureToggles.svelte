<script lang="ts">
  /**
   * SceneFeatureToggles
   *
   * Content for the "Scene" tab in Viewer3DGearPopover.
   * Renders chip-style toggles for each scene feature.
   */

  import { getSceneFeatureContext } from "../context/scene-feature-context";

  const sceneFeatures = getSceneFeatureContext();

  function handleToggle(key: string) {
    sceneFeatures.toggle(key);
  }
</script>

<div class="scene-chips">
  {#each sceneFeatures.features as feature (feature.key)}
    {@const enabled = sceneFeatures.isEnabled(feature.key)}
    <button
      class="chip"
      class:active={enabled}
      onclick={() => handleToggle(feature.key)}
      aria-pressed={enabled}
    >
      {feature.label}
    </button>
  {/each}
</div>

<style>
  .scene-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 4px 0;
  }

  .chip {
    padding: 5px 12px;
    border-radius: 100px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .chip:hover {
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.08);
  }

  .chip.active {
    border-color: color-mix(in srgb, #8b8bff 40%, transparent);
    background: color-mix(in srgb, #8b8bff 15%, transparent);
    color: rgba(255, 255, 255, 0.9);
  }
</style>
