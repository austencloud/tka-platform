<script lang="ts">
  /**
   * ChoreoCardDisplayToggles
   *
   * Chip-style toggles for 2D pictograph display settings:
   * motion visibility, grid, hand points, non-radial points,
   * and step/beat numbers. Reads/writes the global
   * VisibilityStateManager from the pictograph system.
   */

  import { getVisibilityStateManager } from "$lib/shared/pictograph/shared/state/visibility-state.svelte";
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

  const vm = getVisibilityStateManager();

  // Bridge observer into reactive state
  let version = $state(0);
  $effect(() => {
    const bump = () => { version++; };
    vm.registerObserver(bump);
    return () => vm.unregisterObserver(bump);
  });

  function getState() {
    void version;
    return {
      blueMotion: vm.getMotionVisibility(MotionColor.BLUE),
      redMotion: vm.getMotionVisibility(MotionColor.RED),
      grid: vm.getGridVisibility(),
      handPoints: vm.getHandPointVisibility(),
      nonRadial: vm.getNonRadialVisibility(),
      beatNumbers: vm.getBeatNumbersVisibility(),
    };
  }

  function toggleBlue() { const s = getState(); vm.setMotionVisibility(MotionColor.BLUE, !s.blueMotion); }
  function toggleRed() { const s = getState(); vm.setMotionVisibility(MotionColor.RED, !s.redMotion); }
  function toggleGrid() { const s = getState(); vm.setGridVisibility(!getState().grid); }
  function toggleHandPoints() {
    const s = getState();
    vm.setHandPointVisibility(s.handPoints === "all" ? "active" : "all");
  }
  function toggleNonRadial() { vm.setNonRadialVisibility(!getState().nonRadial); }
  function toggleBeatNumbers() { vm.setBeatNumbersVisibility(!getState().beatNumbers); }

  // Reactive display state — recomputes whenever `version` increments (observer fires)
  const s = $derived(getState());
</script>

<div class="display-chips">
  <button class="chip blue-chip" class:active={s.blueMotion} onclick={toggleBlue} aria-pressed={s.blueMotion}>
    Blue Motion
  </button>
  <button class="chip red-chip" class:active={s.redMotion} onclick={toggleRed} aria-pressed={s.redMotion}>
    Red Motion
  </button>
  <button class="chip" class:active={s.grid} onclick={toggleGrid} aria-pressed={s.grid}>
    Grid
  </button>
  <button
    class="chip"
    class:active={s.handPoints === "all"}
    onclick={toggleHandPoints}
    aria-pressed={s.handPoints === "all"}
  >
    Hand Points
  </button>
  <button class="chip" class:active={s.nonRadial} onclick={toggleNonRadial} aria-pressed={s.nonRadial}>
    Non-Radial
  </button>
  <button class="chip" class:active={s.beatNumbers} onclick={toggleBeatNumbers} aria-pressed={s.beatNumbers}>
    Beat #s
  </button>
</div>

<style>
  .display-chips {
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

  .blue-chip.active {
    border-color: color-mix(in srgb, #2563eb 40%, transparent);
    background: color-mix(in srgb, #2563eb 15%, transparent);
  }

  .red-chip.active {
    border-color: color-mix(in srgb, #dc2626 40%, transparent);
    background: color-mix(in srgb, #dc2626 15%, transparent);
  }
</style>
