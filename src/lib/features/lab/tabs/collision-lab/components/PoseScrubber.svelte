<script lang="ts">
  /**
   * PoseScrubber
   *
   * Bottom bar with filter chips, a stepper (prev / next / numeric input),
   * and a stacked progress bar showing how many poses are labeled in each
   * status. The cursor hotkeys (arrow keys) are handled by CollisionLab
   * root, not here.
   */

  import { getCollisionLabContext } from "../context/collision-lab-context";
  import { Plane } from "@austencloud/scene-3d";
  import type { HandOrientation } from "../domain/types";

  const { state } = getCollisionLabContext();

  const planeOptions: Array<{ value: "all" | Plane; label: string }> = [
    { value: "all", label: "Any" },
    { value: Plane.WALL, label: "Wall" },
    { value: Plane.WHEEL, label: "Wheel" },
    { value: Plane.FLOOR, label: "Floor" },
  ];

  const oriOptions: Array<{ value: "all" | HandOrientation; label: string }> = [
    { value: "all", label: "Both" },
    { value: "in", label: "In" },
    { value: "out", label: "Out" },
  ];

  const inputValue = $derived((state.cursorIndex + 1).toString());

  function onInput(e: Event) {
    const v = parseInt((e.target as HTMLInputElement).value, 10);
    if (!Number.isNaN(v)) state.jumpTo(v - 1);
  }

  const progressPct = $derived.by(() => {
    const total = state.progress.total;
    if (total === 0) return { clear: 0, needs: 0, unreachable: 0, skipped: 0 };
    return {
      clear: (state.progress.clear / total) * 100,
      needs: (state.progress.needsAdjustment / total) * 100,
      unreachable: (state.progress.unreachable / total) * 100,
      skipped: (state.progress.skipped / total) * 100,
    };
  });
</script>

<div class="scrubber">
  <div class="filters">
    <div class="filter-group">
      <span class="group-label">Left plane</span>
      <div class="chips">
        {#each planeOptions as opt}
          <button
            class="chip"
            class:active={state.leftPlaneFilter === opt.value}
            onclick={() => state.setLeftPlaneFilter(opt.value)}
            >{opt.label}</button
          >
        {/each}
      </div>
    </div>

    <div class="filter-group">
      <span class="group-label">Right plane</span>
      <div class="chips">
        {#each planeOptions as opt}
          <button
            class="chip"
            class:active={state.rightPlaneFilter === opt.value}
            onclick={() => state.setRightPlaneFilter(opt.value)}
            >{opt.label}</button
          >
        {/each}
      </div>
    </div>

    <div class="filter-group">
      <span class="group-label">Left ori</span>
      <div class="chips">
        {#each oriOptions as opt}
          <button
            class="chip"
            class:active={state.leftOrientationFilter === opt.value}
            onclick={() => state.setLeftOrientationFilter(opt.value)}
            >{opt.label}</button
          >
        {/each}
      </div>
    </div>

    <div class="filter-group">
      <span class="group-label">Right ori</span>
      <div class="chips">
        {#each oriOptions as opt}
          <button
            class="chip"
            class:active={state.rightOrientationFilter === opt.value}
            onclick={() => state.setRightOrientationFilter(opt.value)}
            >{opt.label}</button
          >
        {/each}
      </div>
    </div>

    <div class="filter-group">
      <span class="group-label">&nbsp;</span>
      <button
        class="chip cross-plane"
        class:active={state.crossPlaneOnly}
        onclick={() => state.setCrossPlaneOnly(!state.crossPlaneOnly)}
        title="Show only poses where the two hands are on different planes"
        >Cross-plane only</button
      >
    </div>
  </div>

  <div class="stepper">
    <button
      class="nav"
      onclick={() => state.stepBackward()}
      aria-label="Previous pose">◄</button
    >
    <span class="cursor">
      Pose
      <input
        type="number"
        min="1"
        max={state.filteredPoses.length}
        value={inputValue}
        oninput={onInput}
      />
      / {state.filteredPoses.length}
    </span>
    <button
      class="nav"
      onclick={() => state.stepForward()}
      aria-label="Next pose">►</button
    >
    <button class="export" onclick={() => state.exportLabels()}
      >Export JSON</button
    >
  </div>

  <div class="progress">
    <div class="bar">
      <div class="seg clear" style="width: {progressPct.clear}%"></div>
      <div class="seg needs" style="width: {progressPct.needs}%"></div>
      <div
        class="seg unreachable"
        style="width: {progressPct.unreachable}%"
      ></div>
      <div class="seg skipped" style="width: {progressPct.skipped}%"></div>
    </div>
    <div class="counts">
      <span>Clear: {state.progress.clear}</span>
      <span>Needs: {state.progress.needsAdjustment}</span>
      <span>Unreachable: {state.progress.unreachable}</span>
      <span>Skip: {state.progress.skipped}</span>
      <span
        >Total labeled: {state.progress.labeled} / {state.progress.total}</span
      >
    </div>
  </div>
</div>

<style>
  .scrubber {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px 16px;
    background: var(--theme-card-bg);
    border-top: 1px solid var(--theme-stroke);
  }
  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
  }
  .filter-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .filter-group .group-label {
    font-size: 12px;
    opacity: 0.7;
  }
  .chips {
    display: flex;
    gap: 4px;
  }
  .chip {
    padding: 4px 10px;
    background: var(--theme-panel-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 999px;
    font-size: 12px;
    color: inherit;
    cursor: pointer;
  }
  .chip.active {
    background: #3b82f6;
    color: white;
    border-color: transparent;
  }
  .stepper {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    font-size: 14px;
  }
  .nav {
    padding: 6px 14px;
    background: var(--theme-panel-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 6px;
    color: inherit;
    cursor: pointer;
    font-size: 16px;
  }
  .cursor {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .cursor input {
    width: 60px;
    padding: 4px 6px;
    background: var(--theme-panel-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 4px;
    color: inherit;
    text-align: center;
    font-family: monospace;
  }
  .export {
    margin-left: auto;
    padding: 6px 14px;
    background: #3b82f6;
    border: none;
    border-radius: 6px;
    color: white;
    cursor: pointer;
    font-size: 13px;
  }
  .progress {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .bar {
    display: flex;
    width: 100%;
    height: 8px;
    background: var(--theme-panel-bg);
    border-radius: 4px;
    overflow: hidden;
  }
  .seg.clear {
    background: #22c55e;
  }
  .seg.needs {
    background: #eab308;
  }
  .seg.unreachable {
    background: #6b7280;
  }
  .seg.skipped {
    background: #64748b;
  }
  .counts {
    display: flex;
    gap: 16px;
    font-size: 12px;
    opacity: 0.8;
  }
</style>
