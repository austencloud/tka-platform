<script lang="ts">
  import { onDestroy } from "svelte";
  import { getAnimationVisibilityManager } from "../../state/animation-visibility-state.svelte";

  const vm = getAnimationVisibilityManager();

  let pathShape = $state(vm.getPathShape());

  function handleVisibilityChange(): void {
    pathShape = vm.getPathShape();
  }

  vm.registerObserver(handleVisibilityChange);
  onDestroy(() => vm.unregisterObserver(handleVisibilityChange));

  const options = [
    { id: "arc" as const, label: "Arc", color: "#60a5fa" },
    { id: "linear" as const, label: "Linear", color: "#f97316" },
  ];
</script>

<div class="path-shape-grid">
  {#each options as option}
    <button
      class="path-btn"
      class:active={pathShape === option.id}
      type="button"
      aria-pressed={pathShape === option.id}
      onclick={() => vm.setPathShape(option.id)}
      style:--path-color={option.color}
    >
      {option.label}
    </button>
  {/each}
</div>

<style>
  .path-shape-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }

  .path-btn {
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

  .path-btn:hover {
    background: color-mix(in srgb, var(--theme-text) 8%, transparent);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, white);
  }

  .path-btn.active {
    background: color-mix(in srgb, var(--path-color) 20%, transparent);
    border-color: color-mix(in srgb, var(--path-color) 50%, transparent);
    color: var(--theme-text, white);
  }

  .path-btn:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--path-color) 50%, transparent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .path-btn {
      transition: none;
    }
  }
</style>
