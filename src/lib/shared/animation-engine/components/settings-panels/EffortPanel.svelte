<script lang="ts">
  import { onDestroy } from "svelte";
  import { getAnimationVisibilityManager } from "../../state/animation-visibility-state.svelte";
  import { EFFORTS } from "$lib/shared/effort/domain/effort-types";

  const vm = getAnimationVisibilityManager();

  let effortPreset = $state(vm.getEffortPreset());

  function handleVisibilityChange(): void {
    effortPreset = vm.getEffortPreset();
  }

  vm.registerObserver(handleVisibilityChange);
  onDestroy(() => vm.unregisterObserver(handleVisibilityChange));
</script>

<div class="effort-grid">
  {#each EFFORTS as effort}
    <button
      class="effort-btn"
      class:active={effortPreset === effort.id}
      type="button"
      aria-pressed={effortPreset === effort.id}
      onclick={() => vm.setEffortPreset(effort.id)}
      style:--effort-color={effort.color}
    >
      {effort.label}
    </button>
  {/each}
</div>

<style>
  .effort-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }

  .effort-btn {
    min-height: var(--min-touch-target, 44px);
    padding: 8px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast, 100ms) ease;
  }

  .effort-btn:hover {
    background: color-mix(in srgb, var(--theme-text) 8%, transparent);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, white);
  }

  .effort-btn.active {
    background: color-mix(in srgb, var(--effort-color) 20%, transparent);
    border-color: color-mix(in srgb, var(--effort-color) 50%, transparent);
    color: var(--theme-text, white);
  }

  .effort-btn:focus-visible {
    outline: 2px solid var(--effort-color, #94a3b8);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .effort-btn {
      transition: none;
    }
  }
</style>
