<!--
  AnimationDesktopControls.svelte

  Progressive disclosure: Effects always visible, Motion and Display collapsed.
-->
<script lang="ts">
  import EffectPicker from "$lib/shared/animation-engine/components/canvas-settings-modal/EffectPicker.svelte";
  import type { ActiveEffect } from "$lib/shared/animation-engine/components/canvas-settings-modal/EffectPicker.svelte";
  import FireCategory from "$lib/shared/animation-engine/components/canvas-settings-modal/categories/FireCategory.svelte";
  import CharcoalCategory from "$lib/shared/animation-engine/components/canvas-settings-modal/categories/CharcoalCategory.svelte";
  import LedCategory from "$lib/shared/animation-engine/components/canvas-settings-modal/categories/LedCategory.svelte";
  import PlaybackCategory from "$lib/shared/animation-engine/components/canvas-settings-modal/categories/PlaybackCategory.svelte";
  import EffortCategory from "$lib/shared/animation-engine/components/canvas-settings-modal/categories/EffortCategory.svelte";
  import DisplayCategory from "$lib/shared/animation-engine/components/canvas-settings-modal/categories/DisplayCategory.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { onDestroy } from "svelte";
  import { slide } from "svelte/transition";

  const vm = getAnimationVisibilityManager();

  let fireEnabled = $state(vm.isFireEffectEnabled());
  let charcoalEnabled = $state(vm.getFireUseCharcoal());
  let ledEnabled = $state(vm.isLedEffectEnabled());
  let trailsVisible = $state(vm.isTrailsVisible());

  function sync(): void {
    fireEnabled = vm.isFireEffectEnabled();
    charcoalEnabled = vm.getFireUseCharcoal();
    ledEnabled = vm.isLedEffectEnabled();
    trailsVisible = vm.isTrailsVisible();
  }

  vm.registerObserver(sync);
  onDestroy(() => vm.unregisterObserver(sync));

  const activeEffect: ActiveEffect = $derived.by(() => {
    if (fireEnabled && charcoalEnabled) return "charcoal";
    if (fireEnabled) return "fire";
    if (ledEnabled) return "led";
    if (trailsVisible) return "trails";
    return "none";
  });

  function selectEffect(effect: ActiveEffect) {
    if (vm.isFireEffectEnabled()) vm.setFireEffect(false);
    if (vm.isLedEffectEnabled()) vm.setLedEffect(false);
    if (vm.isTrailsVisible()) vm.setTrailStyle("off");
    vm.setFireUseCharcoal(false);

    if (effect === "fire") {
      vm.setFireEffect(true);
    } else if (effect === "charcoal") {
      vm.setFireUseCharcoal(true);
      vm.setFireEffect(true);
    } else if (effect === "led") {
      vm.setLedEffect(true);
    } else if (effect === "trails") {
      vm.setTrailStyle("on");
    }
  }

  // Collapsible sections — both collapsed by default
  let motionOpen = $state(false);
  let displayOpen = $state(false);
</script>

<div class="desktop-controls">
  <!-- Effects: always visible — the primary thing users adjust -->
  <div class="control-group">
    <span class="group-label">Effects</span>
    <EffectPicker {activeEffect} onSelect={selectEffect} />

    {#if activeEffect === "fire"}
      <FireCategory />
    {:else if activeEffect === "charcoal"}
      <CharcoalCategory />
    {:else if activeEffect === "led"}
      <LedCategory />
    {/if}
  </div>

  <!-- Motion: collapsed by default -->
  <button
    class="section-toggle"
    type="button"
    aria-expanded={motionOpen}
    onclick={() => (motionOpen = !motionOpen)}
  >
    <span class="section-toggle-label">Motion</span>
    <i class="fas {motionOpen ? 'fa-chevron-up' : 'fa-chevron-down'}" aria-hidden="true"></i>
  </button>
  {#if motionOpen}
    <div class="collapsible-section" transition:slide={{ duration: 150 }}>
      <div class="control-group">
        <span class="group-label">Playback</span>
        <PlaybackCategory />
      </div>
      <div class="control-group">
        <span class="group-label">Effort</span>
        <EffortCategory />
      </div>
    </div>
  {/if}

  <!-- Display: collapsed by default -->
  <button
    class="section-toggle"
    type="button"
    aria-expanded={displayOpen}
    onclick={() => (displayOpen = !displayOpen)}
  >
    <span class="section-toggle-label">Display</span>
    <i class="fas {displayOpen ? 'fa-chevron-up' : 'fa-chevron-down'}" aria-hidden="true"></i>
  </button>
  {#if displayOpen}
    <div class="collapsible-section" transition:slide={{ duration: 150 }}>
      <DisplayCategory />
    </div>
  {/if}
</div>

<style>
  .desktop-controls {
    display: flex;
    flex-direction: column;
    gap: clamp(6px, 1.5cqi, 10px);
    width: 100%;
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: clamp(4px, 1cqi, 6px);
  }

  .group-label {
    font-size: var(--font-size-compact);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--theme-text-dim);
    padding-left: 2px;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
    line-height: 1.2;
  }

  /* Collapsible section toggle */
  .section-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 10px 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    cursor: pointer;
    transition: all var(--duration-fast, 100ms) ease;
    min-height: 44px;
  }

  .section-toggle:hover {
    background: color-mix(in srgb, var(--theme-text) 6%, transparent);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, white);
  }

  .section-toggle:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 2px;
  }

  .section-toggle-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
  }

  .section-toggle i {
    font-size: 10px;
    opacity: 0.6;
  }

  .collapsible-section {
    display: flex;
    flex-direction: column;
    gap: clamp(6px, 1.5cqi, 10px);
    padding: 4px 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .section-toggle {
      transition: none;
    }
  }
</style>
