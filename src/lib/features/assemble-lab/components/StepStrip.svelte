<!--
  Assemble's editable overview strip. The strip stays mounted at a fixed height,
  so placing the first prop never steals space from the grid.
-->
<script lang="ts">
  import { scale } from "svelte/transition";
  import { flip } from "svelte/animate";
  import { dragHandle, dragHandleZone, type DndEvent } from "svelte-dnd-action";
  import {
    flipDuration,
    motionDuration,
  } from "$lib/shared/transitions/motion";
  import {
    MotionColor,
    Orientation,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import type { Letter } from "$lib/shared/foundation/domain/models/letter";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import type { AssembleState } from "../state/assemble-state.svelte";
  import {
    createStaticMotion,
    lookupLetter,
    stepToMotion,
  } from "../services/builder-step-converter";
  import StepStripToolbar from "./StepStripToolbar.svelte";

  interface StepStripItem {
    id: string;
    originalIndex: number;
    pictograph: PictographData & { stepNumber: number };
  }

  let { builderState }: { builderState: AssembleState } = $props();

  const flipDurationMs = flipDuration();
  const scaleDurationMs = motionDuration(200);
  let letterCache = $state<Map<string, Letter | null>>(new Map());
  let pendingLetters = $state<Set<string>>(new Set());
  let displayItems = $state<StepStripItem[]>([]);

  function pairKey(index: number): string | null {
    const blue = builderState.blueSteps[index];
    const red = builderState.redSteps[index];
    return blue && red
      ? JSON.stringify([builderState.gridMode, blue, red])
      : null;
  }

  $effect(() => {
    if (
      builderState.blueSteps.length === 0 &&
      builderState.redSteps.length === 0
    ) {
      letterCache = new Map();
      pendingLetters = new Set();
    }
  });

  $effect(() => {
    const blueSteps = builderState.blueSteps;
    const redSteps = builderState.redSteps;
    const paired = Math.min(blueSteps.length, redSteps.length);
    const gridMode = builderState.gridMode;

    for (let index = 0; index < paired; index += 1) {
      const key = pairKey(index);
      if (!key || letterCache.has(key)) continue;
      const blueMotion = stepToMotion(
        blueSteps[index]!,
        MotionColor.BLUE,
        gridMode
      );
      const redMotion = stepToMotion(
        redSteps[index]!,
        MotionColor.RED,
        gridMode
      );
      letterCache = new Map(letterCache).set(key, null);
      pendingLetters = new Set(pendingLetters).add(key);
      void lookupLetter(blueMotion, redMotion, gridMode)
        .then((letter) => {
          letterCache = new Map(letterCache).set(
            key,
            (letter as Letter) ?? null
          );
        })
        .catch(() => undefined)
        .finally(() => {
          const next = new Set(pendingLetters);
          next.delete(key);
          pendingLetters = next;
        });
    }
  });

  const totalSteps = $derived(
    Math.max(builderState.blueSteps.length, builderState.redSteps.length)
  );

  const startPictograph = $derived.by(
    (): (PictographData & { stepNumber: number }) | null => {
      const firstBlue = builderState.blueSteps[0];
      const firstRed = builderState.redSteps[0];
      const bluePose =
        builderState.startPoses[MotionColor.BLUE] ??
        (firstBlue
          ? {
              location: firstBlue.startPosition,
              orientation: firstBlue.startOrientation,
            }
          : null);
      const redPose =
        builderState.startPoses[MotionColor.RED] ??
        (firstRed
          ? {
              location: firstRed.startPosition,
              orientation: firstRed.startOrientation,
            }
          : null);

      if (!bluePose && !redPose) return null;
      const motions: PictographData["motions"] = {};
      if (bluePose) {
        motions[MotionColor.BLUE] = createStaticMotion(
          bluePose.location,
          bluePose.orientation,
          MotionColor.BLUE,
          builderState.gridMode
        );
      }
      if (redPose) {
        motions[MotionColor.RED] = createStaticMotion(
          redPose.location,
          redPose.orientation,
          MotionColor.RED,
          builderState.gridMode
        );
      }
      return {
        id: "builder-start",
        motions,
        gridMode: builderState.gridMode,
        stepNumber: 0,
      };
    }
  );

  const stepPictographs = $derived.by(
    (): (PictographData & { stepNumber: number })[] => {
      const result: (PictographData & { stepNumber: number })[] = [];
      for (let index = 0; index < totalSteps; index += 1) {
        const blueStep = builderState.blueSteps[index];
        const redStep = builderState.redSteps[index];
        const motions: PictographData["motions"] = {};
        if (blueStep) {
          motions[MotionColor.BLUE] = stepToMotion(
            blueStep,
            MotionColor.BLUE,
            builderState.gridMode
          );
        }
        if (redStep) {
          motions[MotionColor.RED] = stepToMotion(
            redStep,
            MotionColor.RED,
            builderState.gridMode
          );
        }
        const key = pairKey(index);
        result.push({
          id: `builder-step-${index}`,
          motions,
          gridMode: builderState.gridMode,
          letter: key ? (letterCache.get(key) ?? undefined) : undefined,
          stepNumber: index + 1,
        });
      }
      return result;
    }
  );

  const sourceItems = $derived(
    stepPictographs.map((pictograph, index) => ({
      id: `assemble-step-${index}-${pairKey(index) ?? "unpaired"}`,
      originalIndex: index,
      pictograph,
    }))
  );

  $effect(() => {
    const nextById = new Map(sourceItems.map((item) => [item.id, item]));
    const sameItems =
      displayItems.length === sourceItems.length &&
      displayItems.every((item) => nextById.has(item.id));
    displayItems = sameItems
      ? displayItems.map((item) => nextById.get(item.id) ?? item)
      : sourceItems;
  });

  const hasContent = $derived(totalSteps > 0 || startPictograph !== null);

  function handleDndConsider(
    event: CustomEvent<DndEvent<StepStripItem>>
  ): void {
    displayItems = event.detail.items;
  }

  function handleDndFinalize(
    event: CustomEvent<DndEvent<StepStripItem>>
  ): void {
    displayItems = event.detail.items;
    const movedId = event.detail.info.id;
    const moved = event.detail.items.find((item) => item.id === movedId);
    const destination = event.detail.items.findIndex(
      (item) => item.id === movedId
    );
    if (moved && destination >= 0) {
      builderState.moveStep(moved.originalIndex, destination);
    }
  }
</script>

<div class="step-strip-container" aria-label="Sequence steps">
  <div class="strip-slot">
    {#if hasContent}
      <div class="step-strip-scroll">
        <div class="step-strip-row" role="list" aria-label="Sequence order">
          {#if startPictograph}
            <div
              class="step-cell start-cell"
              role="listitem"
              aria-label="Start position"
              in:scale={{ duration: scaleDurationMs, start: 0.7, opacity: 0 }}
            >
              <PictographContainer
                pictographData={startPictograph}
                gridMode={builderState.gridMode}
                disableTransitions={true}
                showTKA={false}
                showReversals={false}
                showPositions={false}
                showTnD={false}
                showElemental={false}
              />
            </div>
          {/if}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="dnd-row"
            role="group"
            aria-label="Editable steps"
            use:dragHandleZone={{
              items: displayItems,
              flipDurationMs,
              dragDisabled: !builderState.canReorderSteps,
              dropFromOthersDisabled: true,
              zoneItemTabIndex: -1,
            }}
            onconsider={handleDndConsider}
            onfinalize={handleDndFinalize}
          >
            {#each displayItems as item (item.id)}
              {@const index = item.originalIndex}
              <div
                class="step-cell"
                class:selected={builderState.selectedStepIndex === index}
                role="listitem"
                animate:flip={{ duration: flipDurationMs }}
                in:scale={{
                  duration: scaleDurationMs,
                  start: 0.7,
                  opacity: 0,
                }}
              >
                <button
                  class="step-select"
                  type="button"
                  aria-label="Select step {index + 1}"
                  aria-pressed={builderState.selectedStepIndex === index}
                  onclick={() => builderState.selectStep(index)}
                >
                  <PictographContainer
                    pictographData={item.pictograph}
                    gridMode={builderState.gridMode}
                    disableTransitions={true}
                    showTKA={true}
                    showReversals={false}
                    showPositions={false}
                    showTnD={false}
                    showElemental={false}
                  />
                </button>
                {#if builderState.canReorderSteps}
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <span
                    class="drag-handle"
                    use:dragHandle
                    aria-label="Drag step {index + 1} to reorder"
                    title="Drag to reorder"
                  >
                    <i class="fas fa-grip-lines" aria-hidden="true"></i>
                  </span>
                {/if}
                {#if pairKey(index) && pendingLetters.has(pairKey(index)!)}
                  <span
                    class="letter-skeleton"
                    aria-hidden="true"
                    title="Resolving letter"
                  ></span>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}
  </div>

  <div class="editor-slot">
    {#if builderState.selectedStepIndex !== null}
      <StepStripToolbar {builderState} />
    {:else if totalSteps > 0}
      <p class="strip-hint">
        Tap a step to edit.{builderState.canReorderSteps
          ? " Drag the grip to reorder."
          : " Match both hands to reorder."}
      </p>
    {/if}
  </div>
</div>

<style>
  .step-strip-container {
    flex-shrink: 0;
    width: 100%;
    height: 130px;
    min-height: 130px;
    display: grid;
    grid-template-rows: 78px 52px;
  }

  .strip-slot,
  .editor-slot {
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .step-strip-scroll {
    overflow-x: auto;
    max-width: 100%;
    padding: 4px var(--settings-spacing-sm, 8px);
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb, rgba(255, 255, 255, 0.2))
      transparent;
  }

  .step-strip-row {
    display: flex;
    gap: 6px;
    justify-content: flex-start;
    min-height: 68px;
  }

  .dnd-row {
    display: flex;
    gap: 6px;
  }

  .step-cell {
    position: relative;
    flex-shrink: 0;
    width: 68px;
    height: 68px;
    border: 2px solid transparent;
    border-radius: 9px;
    transition:
      border-color var(--duration-fast, 150ms) ease,
      box-shadow var(--duration-fast, 150ms) ease;
  }

  .step-cell.selected {
    border-color: var(--theme-accent);
    box-shadow: 0 0 0 2px
      color-mix(in srgb, var(--theme-accent) 22%, transparent);
  }

  .step-select {
    width: 100%;
    height: 100%;
    padding: 0;
    border: 0;
    border-radius: 7px;
    background: transparent;
    cursor: pointer;
    overflow: hidden;
  }

  .step-select:focus-visible {
    outline: 2px solid var(--theme-text);
    outline-offset: 2px;
  }

  .step-cell :global(svg) {
    width: 100%;
    height: 100%;
    border-radius: 6px;
  }

  .start-cell {
    opacity: 0.72;
  }

  .drag-handle {
    position: absolute;
    top: 2px;
    right: 2px;
    z-index: 3;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    background: color-mix(in srgb, var(--theme-panel-bg) 88%, transparent);
    color: var(--theme-text-muted);
    cursor: grab;
    touch-action: none;
  }

  .drag-handle:active {
    cursor: grabbing;
  }

  .letter-skeleton {
    position: absolute;
    bottom: 6px;
    left: 50%;
    transform: translateX(-50%);
    width: 38%;
    height: 14px;
    border-radius: 7px;
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.14));
    pointer-events: none;
  }

  .strip-hint {
    margin: 0;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 12px);
    text-align: center;
  }

  @container tool-panel (max-width: 768px) {
    .step-strip-container {
      height: 118px;
      min-height: 118px;
      grid-template-rows: 66px 52px;
    }

    .step-strip-row {
      min-height: 56px;
    }

    .step-cell {
      width: 56px;
      height: 56px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .step-cell {
      transition: none;
    }

    .letter-skeleton {
      opacity: 0.6;
    }
  }
</style>
