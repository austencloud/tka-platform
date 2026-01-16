<!--
  SettingsButtonRow.svelte

  Single button to open Visual Settings sheet (visibility + trails combined).
  Shows summary of current visibility and trail state.
-->
<script lang="ts">
  import {
    animationSettings,
    TrailMode,
  } from "$lib/shared/animation-engine/state/animation-settings-state.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";

  let {
    onOpenVisibility = () => {},
  }: {
    onOpenVisibility?: () => void;
  } = $props();

  const visibilityManager = getAnimationVisibilityManager();

  // Use counter pattern for reactivity
  let updateCounter = $state(0);

  // Derive trail summary from animation settings
  const trailSummary = $derived.by(() => {
    const trail = animationSettings.trail;
    if (!trail.enabled || trail.mode === TrailMode.OFF) return "Off";
    return "On";
  });

  // Get visibility summary with reactive dependency
  function getVisibilitySummary() {
    updateCounter; // Create dependency
    const blue = visibilityManager.getVisibility("blueMotion");
    const red = visibilityManager.getVisibility("redMotion");
    if (blue && red) return "All";
    if (!blue && !red) return "Hidden";
    return blue ? "Blue" : "Red";
  }

  // Combined summary for button
  const buttonSummary = $derived.by(() => {
    const vis = getVisibilitySummary();
    return `${vis} · Trails ${trailSummary}`;
  });
</script>

<div class="settings-button-row">
  <button
    class="settings-btn visual-btn"
    onclick={onOpenVisibility}
    type="button"
  >
    <i class="fas fa-eye" aria-hidden="true"></i>
    <span class="btn-label">Visual Settings</span>
    <span class="btn-summary">{buttonSummary}</span>
  </button>
</div>

<style>
  .settings-button-row {
    display: flex;
    width: 100%;
  }

  .settings-btn {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: var(--touch-target-min, 44px);
    padding: 10px 14px;
    background: var(--theme-card-bg);
    border: 1.5px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 12px;
    color: var(--theme-text);
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    -webkit-tap-highlight-color: transparent;
  }

  .settings-btn i {
    font-size: var(--font-size-sm);
    color: var(--theme-accent);
    flex-shrink: 0;
  }

  .btn-label {
    flex-shrink: 0;
  }

  .btn-summary {
    flex: 1;
    text-align: right;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-weight: 400;
  }

  @media (hover: hover) and (pointer: fine) {
    .settings-btn:hover {
      background: var(--theme-card-hover-bg);
      border-color: var(--theme-stroke-strong);
    }
  }

  .settings-btn:active {
    transform: scale(0.98);
  }
</style>
