<script lang="ts">
  import { tick, untrack } from "svelte";
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import TKAWordGlyph from "$lib/shared/choreo-card/components/TKAWordGlyph.svelte";
  import PropPlacementGrid from "$lib/shared/pictograph/grid/components/PropPlacementGrid.svelte";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import {
    GridMode,
    type GridLocation,
  } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { PropPlacementChange } from "$lib/shared/pictograph/grid/domain/prop-placement";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { HandSide } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import { getExperiencePersistence } from "../../../state/experience-persistence.svelte";
  import {
    POSITION_TYPE_INFO,
    type PositionType,
  } from "../../../domain/constants/position-quiz-data";
  import type { ExperienceViewMode } from "../../../domain/types";
  import LessonStageFrame from "../LessonStageFrame.svelte";
  import LessonStageHeading from "../LessonStageHeading.svelte";
  import { createPositionWorkshopState } from "./positions-experience-state.svelte";
  import {
    POSITION_CHALLENGES,
    POSITION_DEFINITIONS,
    POSITION_KINDS,
    positionKindFor,
    positionExample,
    positionPreview,
    positionCorrection,
    transformPosition,
  } from "./hand-position-lesson";

  let {
    onComplete,
    onBack,
    viewMode = "step",
  } = $props<{
    onComplete?: (nextConceptId?: string) => void;
    onBack?: () => void;
    viewMode?: ExperienceViewMode;
  }>();

  const workshop = createPositionWorkshopState(
    getExperiencePersistence("hand-positions"),
    untrack(() => viewMode === "scroll")
  );
  let grid = $state<ReturnType<typeof PropPlacementGrid> | null>(null);
  let boardElement: HTMLDivElement;
  let forwardButton = $state<HTMLButtonElement | null>(null);
  let gridMode = $state<GridMode>(
    workshop.challenge && workshop.phase === "practice"
      ? workshop.challenge.gridMode
      : workshop.canFinish
        ? GridMode.BOX
        : GridMode.DIAMOND
  );
  let preset = $state<{
    left: GridLocation | null;
    right: GridLocation | null;
  }>(
    workshop.canFinish
      ? positionExample("beta", GridMode.BOX)
      : { left: null, right: null }
  );
  let placement = $state<PropPlacementChange>({
    leftLocation: null,
    rightLocation: null,
    activeHand: HandSide.LEFT,
    complete: false,
    canUndo: false,
  });
  let epoch = $state(0);
  let showReference = $state(false);
  let actionNote = $state("");
  let boardWidth = $state(300);
  let boardHeight = $state(320);

  const instruction = $derived(
    placement.activeHand === HandSide.LEFT
      ? "Tap a point for your left hand."
      : placement.activeHand === HandSide.RIGHT
        ? "Now place your right hand."
        : workshop.phase === "practice"
          ? "Place both hands, then check your position."
          : "Choose a hand to move, then tap another point."
  );

  const exploring = $derived(workshop.phase === "explore");
  const built = $derived(
    positionKindFor(placement.leftLocation, placement.rightLocation)
  );
  const referencesVisible = $derived(
    exploring ||
      workshop.canFinish ||
      workshop.challenge?.guided ||
      showReference
  );
  const examples = $derived(
    POSITION_KINDS.map((kind) => ({
      kind,
      data: positionPreview(kind, gridMode),
    }))
  );
  const title = $derived(
    exploring
      ? "Hand Positions"
      : workshop.canFinish
        ? "All six built"
        : `Build ${POSITION_TYPE_INFO[workshop.challenge!.kind].label}`
  );
  const feedback = $derived.by(() => {
    if (actionNote) return actionNote;
    if (workshop.canFinish && !exploring)
      return "Alpha, Beta, and Gamma on both grids.";
    if (
      workshop.feedback === "incorrect" &&
      placement.leftLocation &&
      placement.rightLocation &&
      workshop.challenge
    ) {
      return positionCorrection(
        placement.leftLocation,
        placement.rightLocation,
        workshop.challenge.kind,
        gridMode
      );
    }
    if (workshop.feedback === "correct" && built)
      return `Yes, ${POSITION_TYPE_INFO[built].label}. ${POSITION_DEFINITIONS[built]}`;
    if (exploring && built) return POSITION_DEFINITIONS[built];
    if (!exploring && workshop.challenge?.guided)
      return POSITION_DEFINITIONS[workshop.challenge.kind];
    return exploring
      ? "Tap two grid points. You can use the same point twice."
      : "Place both hands, then check your position.";
  });

  function changed(change: PropPlacementChange) {
    const moved =
      change.leftLocation !== placement.leftLocation ||
      change.rightLocation !== placement.rightLocation;
    placement = change;
    if (!moved) return;
    actionNote = "";
    workshop.edited();
    const kind = positionKindFor(change.leftLocation, change.rightLocation);
    if (exploring && kind) workshop.discover(kind);
  }

  function loadPair(left: GridLocation | null, right: GridLocation | null) {
    preset = { left, right };
    placement = {
      leftLocation: left,
      rightLocation: right,
      complete: left !== null && right !== null,
      activeHand: left ? (right ? null : HandSide.RIGHT) : HandSide.LEFT,
      canUndo: false,
    };
    epoch++;
    workshop.edited();
    actionNote = "";
  }

  function study(kind: PositionType) {
    const example = positionExample(kind, gridMode);
    loadPair(example.left, example.right);
    actionNote = POSITION_DEFINITIONS[kind];
  }

  function transform(action: "rotate" | "mirror" | "swap") {
    if (!placement.leftLocation || !placement.rightLocation || !built) return;
    const before = built;
    const result = transformPosition(
      placement.leftLocation,
      placement.rightLocation,
      action
    );
    const unchanged =
      result.left === placement.leftLocation &&
      result.right === placement.rightLocation;
    loadPair(result.left, result.right);
    actionNote = unchanged
      ? `The hands are already in those locations. Still ${POSITION_TYPE_INFO[before].label}.`
      : `Still ${POSITION_TYPE_INFO[before].label}. ${POSITION_DEFINITIONS[before]}`;
  }

  function changeGrid(mode: GridMode) {
    if (mode === gridMode) return;
    gridMode = mode;
    if (built) study(built);
    else loadPair(null, null);
  }

  async function practice() {
    workshop.practice();
    gridMode = workshop.challenge!.gridMode;
    showReference = false;
    loadPair(null, null);
    await tick();
    boardElement.focus();
  }

  function explore() {
    workshop.explore();
    actionNote = "";
  }

  async function next() {
    if (!workshop.next()) return;
    if (workshop.challenge) {
      gridMode = workshop.challenge.gridMode;
      showReference = false;
      loadPair(null, null);
    }
    await tick();
    if (workshop.canFinish) forwardButton?.focus();
    else boardElement.focus();
  }

  async function check() {
    workshop.check(built);
    await tick();
    forwardButton?.focus();
  }

  function finish() {
    if (workshop.canFinish) onComplete?.("hand-motions-intro");
  }

  export function handleBack() {
    if (!exploring) explore();
    else onBack?.();
  }
</script>

{#snippet lessonActions()}
  <nav class="lesson-navigation" aria-label="Lesson navigation">
    <div class="navigation-progress">
      {#if exploring}
        <span>Explore</span>
      {:else}
        <span>{workshop.round} of {POSITION_CHALLENGES.length} built</span>
        <progress
          max={POSITION_CHALLENGES.length}
          value={workshop.round}
          aria-label="Positions built"
        ></progress>
      {/if}
    </div>
    <div class="lesson-actions">
      {#if exploring}
        <PanelButton
          variant={workshop.canFinish ? "secondary" : "primary"}
          onclick={practice}
          >{workshop.round > 0 && workshop.round < POSITION_CHALLENGES.length
            ? "Resume practice"
            : workshop.canFinish
              ? "Practice again"
              : "Next: Practice →"}</PanelButton
        >
        {#if workshop.canFinish}
          <PanelButton variant="primary" onclick={finish}
            >Continue to Hand Motions</PanelButton
          >
        {/if}
      {:else if workshop.canFinish}
        <PanelButton onclick={explore}>Keep exploring</PanelButton>
        <PanelButton variant="primary" bind:ref={forwardButton} onclick={finish}
          >Continue to Hand Motions</PanelButton
        >
      {:else}
        <PanelButton onclick={explore}>Explore</PanelButton>
        {#if workshop.feedback === "correct"}
          <PanelButton variant="primary" bind:ref={forwardButton} onclick={next}
            >{workshop.round === POSITION_CHALLENGES.length - 1
              ? "Finish practice"
              : "Next position"}</PanelButton
          >
        {:else}
          <PanelButton
            variant="primary"
            bind:ref={forwardButton}
            disabled={!built || placement.activeHand !== null}
            onclick={check}>Check position</PanelButton
          >
        {/if}
      {/if}
    </div>
  </nav>
{/snippet}

<div class="positions-experience">
  <LessonStageFrame artifactLayout="workshop">
    {#snippet heading()}
      <LessonStageHeading
        key={title}
        {title}
        eyebrow={exploring
          ? "Explore"
          : workshop.canFinish
            ? "Practice complete"
            : `${workshop.challenge?.guided ? "With a reference" : "On your own"} · ${workshop.round + 1} of ${POSITION_CHALLENGES.length}`}
      >
        <p>
          {exploring
            ? "Place both hands and see the position’s name. Next, try six practice challenges."
            : workshop.canFinish
              ? "Keep exploring, or continue to Hand Motions."
              : gridMode === GridMode.DIAMOND
                ? "Diamond grid"
                : "Box grid"}
        </p>
      </LessonStageHeading>
    {/snippet}

    {#snippet artifact()}
      <div class="placement-instructions">
        <div class="current-task" aria-live="polite">
          <Crossfade key={instruction}>{instruction}</Crossfade>
        </div>
        <p class="hand-key">
          <span class="left-hand">Left = blue</span><span aria-hidden="true">
            ·
          </span><span class="right-hand">Right = red</span>
        </p>
      </div>
      <div class="workshop">
        <div class="board-column">
          <div
            class="board"
            bind:this={boardElement}
            tabindex="-1"
            role="group"
            aria-label="Hand placement grid"
            bind:clientWidth={boardWidth}
            bind:clientHeight={boardHeight}
          >
            <PropPlacementGrid
              bind:this={grid}
              {gridMode}
              leftPropType={PropType.HAND}
              rightPropType={PropType.HAND}
              leftNoun="left hand"
              rightNoun="right hand"
              promptText=""
              initialLeftLocation={preset.left}
              initialRightLocation={preset.right}
              resetEpoch={epoch}
              hitTargetRadius={Math.max(
                75,
                (44 * 950) /
                  Math.max(128, Math.min(boardWidth, boardHeight)) /
                  2
              )}
              editAfterCompletion
              renderTray={false}
              onChange={changed}
            />
          </div>
          <div class="hand-controls" role="group" aria-label="Move the hands">
            <PanelButton
              disabled={!placement.complete}
              accentColor="var(--prop-blue)"
              ariaPressed={placement.activeHand === HandSide.LEFT}
              onclick={() => grid?.moveProp(HandSide.LEFT)}
              >Move left hand</PanelButton
            >
            <PanelButton
              disabled={!placement.complete}
              accentColor="var(--prop-red)"
              ariaPressed={placement.activeHand === HandSide.RIGHT}
              onclick={() => grid?.moveProp(HandSide.RIGHT)}
              >Move right hand</PanelButton
            >
            <PanelButton
              disabled={!placement.canUndo}
              onclick={() => grid?.undoPlacement()}>Undo</PanelButton
            >
            <PanelButton
              disabled={!placement.leftLocation && !placement.rightLocation}
              onclick={() => loadPair(null, null)}>Clear both hands</PanelButton
            >
          </div>
        </div>

        <div class="lesson-side">
          <div
            class="result"
            class:correct={workshop.feedback === "correct"}
            aria-live="polite"
            aria-atomic="true"
          >
            <Crossfade
              key={`${built}-${workshop.feedback}-${actionNote}-${referencesVisible}`}
            >
              <div class="result-copy">
                <div class="position-name">
                  {#if built && (exploring || workshop.feedback !== "idle" || workshop.canFinish)}
                    <span aria-hidden="true"
                      ><TKAWordGlyph
                        word={POSITION_TYPE_INFO[built].symbol}
                        height={32}
                        darkMode
                      /></span
                    >
                    <h2>{POSITION_TYPE_INFO[built].label}</h2>
                    {#if workshop.feedback === "correct"}<span
                        aria-label="Correct">✓</span
                      >{/if}
                  {:else}
                    <h2>
                      {exploring
                        ? "Your position"
                        : workshop.canFinish
                          ? "Practice complete"
                          : "Your turn"}
                    </h2>
                  {/if}
                </div>
                <p>{feedback}</p>
              </div>
            </Crossfade>
          </div>

          <div class="reference-area">
            <Crossfade key={Boolean(referencesVisible)} animateHeight>
              {#if referencesVisible}
                <div class="reference-heading">
                  <h3>{exploring ? "Try an example" : "Reference"}</h3>
                </div>
                <div
                  class="examples"
                  role="group"
                  aria-label="Position examples"
                >
                  {#each examples as example (example.kind)}
                    <div class="example">
                      <div class="example-art" aria-hidden="true">
                        <PictographContainer
                          pictographData={example.data}
                          showTKA={false}
                          showPositions={false}
                          showReversals={false}
                          showTnD={false}
                          showElemental={false}
                          leftPropTypeOverride={PropType.HAND}
                          rightPropTypeOverride={PropType.HAND}
                        />
                      </div>
                      {#if exploring}
                        <PanelButton
                          ariaLabel={`Study ${POSITION_TYPE_INFO[example.kind].label} example`}
                          ariaPressed={built === example.kind}
                          onclick={() => study(example.kind)}
                          >{POSITION_TYPE_INFO[example.kind].label}</PanelButton
                        >
                      {:else}
                        <strong>{POSITION_TYPE_INFO[example.kind].label}</strong
                        >
                      {/if}
                    </div>
                  {/each}
                </div>
              {:else}
                <div class="reference-prompt">
                  <p>Need a reminder?</p>
                  <PanelButton onclick={() => (showReference = true)}
                    >Show reference</PanelButton
                  >
                </div>
              {/if}
            </Crossfade>
          </div>

          {#if exploring}
            <div class="explore-tools">
              <SegmentedControl
                options={[
                  { value: GridMode.DIAMOND, label: "Diamond" },
                  { value: GridMode.BOX, label: "Box" },
                ]}
                value={gridMode}
                onchange={changeGrid}
                semantics="radiogroup"
                ariaLabel="Grid mode"
                color="accent"
              />
              <div
                class="transform-controls"
                role="group"
                aria-label="Transform both hands"
              >
                <PanelButton
                  disabled={!built}
                  onclick={() => transform("rotate")}>Rotate</PanelButton
                >
                <PanelButton
                  disabled={!built}
                  onclick={() => transform("mirror")}>Mirror</PanelButton
                >
                <PanelButton disabled={!built} onclick={() => transform("swap")}
                  >Swap</PanelButton
                >
              </div>
            </div>
          {/if}
        </div>
      </div>
    {/snippet}
    {#snippet controls()}{@render lessonActions()}{/snippet}
  </LessonStageFrame>
</div>

<style>
  .positions-experience {
    display: flex;
    flex: 1 0 auto;
    width: 100%;
    min-height: 100%;
    color: var(--theme-text);
    --position-board-size: clamp(20rem, calc(100svh - 34rem), 58rem);
    --lesson-workshop-max: min(
      var(--shell-w, 96rem),
      calc(var(--position-board-size) + 37rem)
    );
  }
  .workshop {
    display: grid;
    grid-template-columns: minmax(0, var(--position-board-size)) minmax(
        20rem,
        1fr
      );
    gap: clamp(1rem, 3cqw, 3rem);
    align-items: start;
    min-width: 0;
  }
  .board-column {
    display: grid;
    grid-template-rows: auto auto;
    gap: 0.75rem;
    min-height: 0;
    container-type: inline-size;
  }
  .board {
    aspect-ratio: 1;
    height: auto;
    width: 100%;
  }
  .placement-instructions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    margin-bottom: 1rem;
  }
  .current-task {
    min-height: 3rem;
    display: grid;
    align-items: center;
    max-width: 40ch;
    font-size: 1rem;
    font-weight: 650;
  }
  .hand-key {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    white-space: nowrap;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text);
    font-weight: 650;
  }
  .left-hand,
  .right-hand {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }
  .left-hand::before,
  .right-hand::before {
    content: "";
    width: 0.65rem;
    aspect-ratio: 1;
    border-radius: 50%;
    background: var(--prop-blue);
  }
  .right-hand::before {
    background: var(--prop-red);
  }
  .lesson-navigation {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    min-height: 3.5rem;
  }
  .navigation-progress {
    display: grid;
    gap: 0.5rem;
    min-width: 7rem;
    font-size: var(--font-size-min, 14px);
    font-variant-numeric: tabular-nums;
    color: var(--theme-text-dim);
  }
  .hand-controls,
  .transform-controls,
  .lesson-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }
  .hand-controls {
    justify-content: flex-start;
  }
  .lesson-actions {
    justify-content: flex-end;
  }
  .lesson-side {
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: 1.25rem;
  }
  .result {
    min-height: 6.5rem;
  }
  .result-copy {
    display: grid;
    gap: 0.5rem;
  }
  .position-name {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-height: 2.5rem;
  }
  h2 {
    margin: 0;
    font-size: 1.75rem;
    line-height: 1.2;
  }
  h3 {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    font-weight: 650;
  }
  p {
    margin: 0;
    font-size: 1rem;
    line-height: 1.5;
    max-width: 38ch;
    color: var(--theme-text-dim);
  }
  .correct .position-name {
    color: var(--semantic-success);
  }
  .reference-area {
    min-width: 0;
  }
  .reference-heading {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }
  .examples {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.5rem;
    max-width: 28rem;
  }
  .example {
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }
  .example-art {
    width: 100%;
    aspect-ratio: 1;
    overflow: hidden;
  }
  .example strong {
    font-size: var(--font-size-min, 14px);
  }
  .example :global(.panel-btn) {
    padding-inline: 0.75rem;
  }
  .example :global(.panel-btn[aria-pressed="true"]) {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }
  .reference-prompt {
    display: grid;
    justify-items: start;
    gap: 0.75rem;
  }
  .explore-tools {
    display: grid;
    justify-items: start;
    gap: 0.75rem;
  }
  progress {
    width: 100%;
    height: 0.5rem;
    accent-color: var(--theme-accent);
  }
  .lesson-actions {
    min-height: 3rem;
  }
  @media (max-width: 760px) {
    .workshop {
      grid-template-columns: minmax(0, 1fr);
      grid-template-areas: "board" "result" "hands" "reference" "tools";
      gap: 1rem;
    }
    .board-column,
    .lesson-side {
      display: contents;
    }
    .board {
      grid-area: board;
      width: min(100%, 18.5rem);
      justify-self: center;
    }
    .hand-controls {
      grid-area: hands;
    }
    .result {
      grid-area: result;
      min-height: 5.5rem;
    }
    .reference-area {
      grid-area: reference;
    }
    .examples {
      max-width: 28rem;
    }
    .example-art {
      max-width: 8rem;
    }
    .explore-tools {
      grid-area: tools;
      grid-template-columns: 1fr;
      justify-items: center;
    }
    .navigation-progress {
      min-width: 5rem;
    }
    .placement-instructions {
      gap: 0.25rem;
    }
  }
  @media (min-width: 2400px) and (min-height: 1300px) {
    .positions-experience {
      --lesson-workshop-max: min(var(--shell-w, 120rem), 108rem);
    }
  }
</style>
