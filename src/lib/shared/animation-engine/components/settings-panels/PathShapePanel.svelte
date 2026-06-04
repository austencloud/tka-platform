<script lang="ts">
  import { onDestroy } from "svelte";
  import { getAnimationVisibilityManager } from "../../state/animation-visibility-state.svelte";
  import { getAnimationVisibilityContext } from "../../state/animation-visibility-context";

  const vm = getAnimationVisibilityContext() ?? getAnimationVisibilityManager();

  let pathShape = $state(vm.getPathShape());
  let motionAware = $state(vm.getMotionAwarePaths());

  function handleVisibilityChange(): void {
    pathShape = vm.getPathShape();
    motionAware = vm.getMotionAwarePaths();
  }

  vm.registerObserver(handleVisibilityChange);
  onDestroy(() => vm.unregisterObserver(handleVisibilityChange));

  const options = [
    { id: "arc" as const, label: "Arc", color: "#60a5fa" },
    { id: "linear" as const, label: "Linear", color: "#f97316" },
    { id: "concave" as const, label: "Concave", color: "#a78bfa" },
  ];
</script>

<div class="path-shape-grid">
  {#each options as option}
    <button
      class="path-btn"
      class:active={pathShape === option.id}
      class:dimmed={motionAware}
      type="button"
      aria-pressed={pathShape === option.id}
      disabled={motionAware}
      onclick={() => vm.setPathShape(option.id)}
      style:--path-color={option.color}
    >
      {option.label}
    </button>
  {/each}
</div>

<button
  class="hybrid-btn"
  class:active={motionAware}
  type="button"
  aria-pressed={motionAware}
  onclick={() => vm.toggleMotionAwarePaths()}
>
  <span class="toggle-indicator" class:on={motionAware}></span>
  Hybrid
</button>

{#if motionAware}
  <p class="motion-hint">Pro → Arc · Anti → Concave</p>
{/if}

<style>
  .path-shape-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
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

  .path-btn:hover:not(:disabled) {
    background: color-mix(in srgb, var(--theme-text) 8%, transparent);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, white);
  }

  .path-btn.active {
    background: color-mix(in srgb, var(--path-color) 20%, transparent);
    border-color: color-mix(in srgb, var(--path-color) 50%, transparent);
    color: var(--theme-text, white);
  }

  .path-btn.dimmed {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .path-btn:focus-visible {
    outline: 2px solid var(--path-color, #60a5fa);
    outline-offset: 2px;
  }

  .hybrid-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: var(--min-touch-target, 44px);
    padding: 8px 12px;
    margin-top: 6px;
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast, 100ms) ease;
  }

  .hybrid-btn:hover {
    background: color-mix(in srgb, var(--theme-text) 8%, transparent);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, white);
  }

  .hybrid-btn.active {
    background: color-mix(in srgb, #a78bfa 15%, transparent);
    border-color: color-mix(in srgb, #a78bfa 40%, transparent);
    color: var(--theme-text, white);
  }

  .hybrid-btn:focus-visible {
    outline: 2px solid #a78bfa;
    outline-offset: 2px;
  }

  .toggle-indicator {
    width: 32px;
    height: 18px;
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.15);
    position: relative;
    flex-shrink: 0;
    transition: background var(--duration-fast, 100ms) ease;
  }

  .toggle-indicator::after {
    content: "";
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.5);
    transition: transform var(--duration-fast, 100ms) ease, background var(--duration-fast, 100ms) ease;
  }

  .toggle-indicator.on {
    background: color-mix(in srgb, #a78bfa 50%, transparent);
  }

  .toggle-indicator.on::after {
    transform: translateX(14px);
    background: #a78bfa;
  }

  .motion-hint {
    margin: 4px 0 0;
    padding: 0;
    font-size: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    text-align: center;
  }

  @media (prefers-reduced-motion: reduce) {
    .path-btn,
    .hybrid-btn,
    .toggle-indicator,
    .toggle-indicator::after {
      transition: none;
    }
  }
</style>
