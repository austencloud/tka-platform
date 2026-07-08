<script lang="ts">
  import "$lib/shared/selection/selection.css";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import SelectionHit from "$lib/shared/selection/SelectionHit.svelte";
  import {
    SequenceSelection,
    setSequenceSelection,
  } from "$lib/shared/selection/sequence-selection.svelte";
  import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
  import { MotionType, MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { GridMode, GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { getGridPositionFromLocations } from "$lib/shared/pictograph/grid/services/grid-position-deriver";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";

  const scope = new SequenceSelection();
  setSequenceSelection(scope);

  const gp = (a: GridLocation, b: GridLocation) => {
    try {
      return getGridPositionFromLocations(a, b);
    } catch {
      return null;
    }
  };

  // A static α pose per cell — real pictograph data, same shape as the guide's box().
  function staticStep(step: number): StepData {
    const from = GridLocation.SOUTH;
    const redFrom = GridLocation.NORTH;
    return {
      id: `demo-${step}`,
      letter: null,
      gridMode: GridMode.DIAMOND,
      startPosition: gp(from, redFrom),
      endPosition: gp(from, redFrom),
      motions: {
        blue: createMotionData({
          motionType: MotionType.STATIC,
          startLocation: from,
          endLocation: from,
          color: MotionColor.BLUE,
          propType: PropType.HAND,
          gridMode: GridMode.DIAMOND,
        }),
        red: createMotionData({
          motionType: MotionType.STATIC,
          startLocation: redFrom,
          endLocation: redFrom,
          color: MotionColor.RED,
          propType: PropType.HAND,
          gridMode: GridMode.DIAMOND,
        }),
      },
      stepNumber: step,
      duration: 1,
      blueReversal: false,
      redReversal: false,
      isBlank: false,
    } as unknown as StepData;
  }

  const CELLS = [0, 1, 2, 3, 4];
  const STRIP_KEY = "strip-1";
  const GROUP_KEY = "group-2";

  let radius = $state(6);
  let selWidth = $state(2);
  let selTint = $state(12);
  let selGlow = $state(10);
  let hoverWidth = $state(2);
  let hoverOffset = $state(3);
  let hoverTint = $state(6);

  const stageVars = $derived(
    `--tka-seq-radius:${radius}px;` +
      `--tka-seq-sel-width:${selWidth}px;` +
      `--tka-seq-sel-tint:${selTint}%;` +
      `--tka-seq-sel-glow:${selGlow}px;` +
      `--tka-seq-hover-width:${hoverWidth}px;` +
      `--tka-seq-hover-offset:${hoverOffset}px;` +
      `--tka-seq-hover-tint:${hoverTint}%;`
  );
</script>

<div class="page">
  <h1>Sequence selection — tuning</h1>
  <p>
    Hover / click the strip and the wrapping group. Tune the knobs; paste the values
    into <code>selection.css</code> once it feels right. Selected:
    <strong>{scope.selectedId ?? "none"}</strong>
  </p>

  <div class="knobs">
    <label>radius <input type="range" min="0" max="16" bind:value={radius} /> {radius}px</label>
    <label>sel width <input type="range" min="1" max="5" bind:value={selWidth} /> {selWidth}px</label>
    <label>sel tint <input type="range" min="0" max="40" bind:value={selTint} /> {selTint}%</label>
    <label>sel glow <input type="range" min="0" max="30" bind:value={selGlow} /> {selGlow}px</label>
    <label>hover width <input type="range" min="1" max="5" bind:value={hoverWidth} /> {hoverWidth}px</label>
    <label>hover offset <input type="range" min="0" max="10" bind:value={hoverOffset} /> {hoverOffset}px</label>
    <label>hover tint <input type="range" min="0" max="30" bind:value={hoverTint} /> {hoverTint}%</label>
  </div>

  <div class="stage" style={stageVars}>
    <section>
      <h2>Contiguous strip (guide-style — 1 unit → single ring)</h2>
      <div
        class="demo-strip tka-seq-cell"
        class:is-hovered={scope.isHovered(STRIP_KEY)}
        class:is-selected={scope.isSelected(STRIP_KEY)}
      >
        {#each CELLS as c (c)}
          <div class="demo-cell">
            <PictographContainer
              pictographData={staticStep(c)}
              gridMode={GridMode.DIAMOND}
              bluePropTypeOverride={PropType.HAND}
              redPropTypeOverride={PropType.HAND}
              showGrid={true}
              showTKA={false}
              showPositions={c > 0}
              showHandPoints={true}
              darkMode={false}
              printMode={true}
              disableTransitions={true}
            />
          </div>
        {/each}
        <SelectionHit
          groupId={STRIP_KEY}
          isGroupStart
          label="Select the demo strip"
          onselect={(id) => scope.select(id)}
        />
      </div>
    </section>

    <section>
      <h2>Wrapping group (choreo-style — N units → per-cell rings)</h2>
      <div class="demo-grid">
        {#each CELLS as c (c)}
          <div
            class="demo-gridcell tka-seq-cell"
            class:is-hovered={scope.isHovered(GROUP_KEY)}
            class:is-selected={scope.isSelected(GROUP_KEY)}
          >
            <div class="demo-cell">
              <PictographContainer
                pictographData={staticStep(c)}
                gridMode={GridMode.DIAMOND}
                bluePropTypeOverride={PropType.HAND}
                redPropTypeOverride={PropType.HAND}
                showGrid={true}
                showTKA={false}
                showPositions={c > 0}
                showHandPoints={true}
                darkMode={false}
                printMode={true}
                disableTransitions={true}
              />
            </div>
            <SelectionHit
              groupId={GROUP_KEY}
              isGroupStart={c === 0}
              label={c === 0 ? "Select the demo group" : ""}
              onselect={(id) => scope.toggle(id)}
            />
          </div>
        {/each}
      </div>
    </section>
  </div>
</div>

<style>
  .page {
    padding: 24px;
    color: var(--theme-text, #eee);
  }
  .knobs {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    margin: 16px 0;
  }
  .knobs label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
  }
  .stage {
    display: flex;
    flex-direction: column;
    gap: 40px;
    margin-top: 24px;
    background: #fff;
    padding: 32px;
    border-radius: 8px;
  }
  h2 {
    color: #333;
    font-size: 14px;
    margin: 0 0 8px;
  }
  .demo-strip {
    display: grid;
    grid-template-columns: repeat(5, 80px);
    border: 1px solid #c4c4cc;
    background: #fff;
    width: max-content;
  }
  .demo-cell {
    position: relative;
    width: 80px;
    height: 80px;
    overflow: hidden;
  }
  .demo-grid {
    display: grid;
    grid-template-columns: repeat(3, 84px);
    gap: 6px;
    width: max-content;
  }
  .demo-gridcell {
    border: 1px solid rgba(0, 0, 0, 0.18);
    border-radius: 3px;
    overflow: hidden;
  }
</style>
