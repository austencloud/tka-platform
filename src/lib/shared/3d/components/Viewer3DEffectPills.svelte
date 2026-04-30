<script lang="ts">
  /**
   * Viewer3DEffectPills
   *
   * A row of toggle pills for visual effects (Fire, LED, Trails, Sparks).
   * Currently all pills are disabled - the toggle UI is ready for when effect
   * plugins are registered. Users see a "Coming soon" tooltip on hover.
   *
   * The active class tracks effectToggles from context so the UI will
   * light up automatically once effects are enabled in future work.
   */

  import { getViewer3DContext } from "../context/viewer-3d-context";

  const viewer3DState = getViewer3DContext();

  const effects = [
    { name: "fire", label: "Fire", icon: "🔥" },
    { name: "led", label: "LED", icon: "💡" },
    { name: "trails", label: "Trails", icon: "〰" },
    { name: "charcoal", label: "Sparks", icon: "✦" },
  ] as const;
</script>

<div class="effect-pills">
  {#each effects as effect}
    <button
      class="effect-pill"
      class:active={viewer3DState.effectToggles[effect.name]}
      disabled
      title="Coming soon"
      aria-label="{effect.label} effect (coming soon)"
    >
      <span class="effect-icon">{effect.icon}</span>
      <span class="effect-label">{effect.label}</span>
    </button>
  {/each}
</div>

<style>
  .effect-pills {
    display: flex;
    gap: 8px;
    justify-content: center;
  }

  .effect-pill {
    padding: 6px 12px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.3);
    font-size: var(--font-size-compact, 12px);
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: not-allowed;
    opacity: 0.5;
  }

  .effect-pill.active {
    background: rgba(139, 139, 255, 0.15);
    border-color: rgba(139, 139, 255, 0.3);
    color: rgba(139, 139, 255, 0.8);
    opacity: 1;
  }

  .effect-label {
    font-size: var(--font-size-compact, 12px);
  }
</style>
