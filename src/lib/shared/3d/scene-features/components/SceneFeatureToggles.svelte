<script lang="ts">
  /**
   * SceneFeatureToggles
   *
   * Content for the "Scene" tab in Viewer3DGearPopover.
   * Renders a toggle per scene feature from the registry.
   */

  import { getSceneFeatureContext } from "../context/scene-feature-context";

  const sceneFeatures = getSceneFeatureContext();

  function handleToggle(key: string) {
    sceneFeatures.toggle(key);
  }
</script>

<div class="scene-toggles">
  {#each sceneFeatures.features as feature (feature.key)}
    {@const enabled = sceneFeatures.isEnabled(feature.key)}
    <button
      class="toggle-row"
      class:enabled
      onclick={() => handleToggle(feature.key)}
      aria-pressed={enabled}
    >
      <span class="toggle-label">{feature.label}</span>
      <span class="toggle-indicator" class:on={enabled}>
        <span class="toggle-dot"></span>
      </span>
    </button>
  {/each}

  <button class="reset-link" onclick={() => sceneFeatures.reset()}>
    Reset to defaults
  </button>
</div>

<style>
  .scene-toggles {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 4px 0;
  }

  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    border: none;
    background: transparent;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .toggle-row:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .toggle-label {
    color: rgba(255, 255, 255, 0.8);
    font-size: var(--font-size-min, 14px);
  }

  .toggle-indicator {
    width: 32px;
    height: 18px;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.12);
    position: relative;
    transition: background 0.2s ease;
    flex-shrink: 0;
  }

  .toggle-indicator.on {
    background: rgba(139, 139, 255, 0.5);
  }

  .toggle-dot {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.7);
    transition: transform 0.2s ease;
  }

  .toggle-indicator.on .toggle-dot {
    transform: translateX(14px);
    background: #fff;
  }

  .reset-link {
    margin-top: 8px;
    padding: 4px 8px;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.35);
    font-size: 12px;
    cursor: pointer;
    text-align: left;
  }

  .reset-link:hover {
    color: rgba(255, 255, 255, 0.6);
  }
</style>
