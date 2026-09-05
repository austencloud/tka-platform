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
  <div class="lesson-actions">
    {#if exploring}
      <PanelButton onclick={() => loadPair(null, null)}>Clear grid</PanelButton>
      <PanelButton
        variant={workshop.canFinish ? "secondary" : "primary"}
        onclick={practice}
        >{workshop.round > 0 && workshop.round < POSITION_CHALLENGES.length
          ? "Resume practice"
          : "Practice positions"}</PanelButton
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
{/snippet}

<div class="positions-scroll">
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
              ? "Place the hands. See which position you make."
              : workshop.canFinish
                ? "Keep exploring, or continue to Hand Motions."
                : gridMode === GridMode.DIAMOND
                  ? "Diamond grid"
                  : "Box grid"}
          </p>
        </LessonStageHeading>
      {/snippet}

      {#snippet artifact()}
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
                leftNoun="blue (left) hand"
                rightNoun="red (right) hand"
                initialLeftLocation={preset.left}
                initialRightLocation={preset.right}
                resetEpoch={epoch}
                hitTargetRadius={Math.max(
                  75,
                  (44 * 950) /
                    Math.max(128, Math.min(boardWidth, boardHeight - 80)) /
                    2
                )}
                editAfterCompletion
                renderTray={false}
                onChange={changed}
              />
            </div>
            <div class="board-status" aria-hidden="true">
              <Crossfade key={`${built}-${workshop.feedback}`}>
                {#if built && (exploring || workshop.feedback !== "idle")}
                  {POSITION_TYPE_INFO[built].label}{workshop.feedback ===
                  "correct"
                    ? " ✓"
                    : workshop.feedback === "incorrect"
                      ? " · Try again"
                      : ""}
                {:else}
                  {placement.complete ? "Ready to check" : ""}
                {/if}
              </Crossfade>
            </div>
            <div class="hand-controls" role="group" aria-label="Move the hands">
              <PanelButton
                disabled={!placement.complete}
                accentColor="var(--prop-blue)"
                ariaPressed={placement.activeHand === HandSide.LEFT}
                onclick={() => grid?.moveProp(HandSide.LEFT)}
                >Move blue</PanelButton
              >
              <PanelButton
                disabled={!placement.complete}
                accentColor="var(--prop-red)"
                ariaPressed={placement.activeHand === HandSide.RIGHT}
                onclick={() => grid?.moveProp(HandSide.RIGHT)}
                >Move red</PanelButton
              >
              <PanelButton
                disabled={!placement.canUndo}
                onclick={() => grid?.undoPlacement()}>Undo</PanelButton
              >
            </div>
            {@render lessonActions()}
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
              <Crossfade key={Boolean(referencesVisible)}>
                {#if referencesVisible}
                  <div class="reference-heading">
                    <h3>{exploring ? "Try an example" : "Reference"}</h3>
                    {#if exploring}<span
                        >{workshop.explored.length} / 3 explored</span
                      >{/if}
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
                            >{POSITION_TYPE_INFO[example.kind]
                              .label}</PanelButton
                          >
                        {:else}
                          <strong
                            >{POSITION_TYPE_INFO[example.kind].label}</strong
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
                  <PanelButton
                    disabled={!built}
                    onclick={() => transform("swap")}>Swap</PanelButton
                  >
                </div>
              </div>
            {:else}
              <div class="practice-progress">
                <span
                  >{workshop.round} of {POSITION_CHALLENGES.length} built</span
                >
                <progress
                  max={POSITION_CHALLENGES.length}
                  value={workshop.round}
                  aria-label="Positions built"
                ></progress>
              </div>
            {/if}
          </div>
        </div>
      {/snippet}
    </LessonStageFrame>
  </div>
</div>

<style>
  .positions-scroll {
    width: 100%;
    min-height: 100%;
    color: var(--theme-text);
  }
  .positions-experience {
    width: 100%;
    min-height: 100%;
    --lesson-artifact-wide-max: min(var(--shell-w, 96rem), 76rem);
  }
  .workshop {
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(20rem, 1fr);
    gap: clamp(1rem, 3cqw, 3rem);
    align-items: center;
    min-width: 0;
  }
  .board-column {
    display: grid;
    grid-template-rows: auto auto auto auto;
    gap: 0.75rem;
    min-height: 0;
    container-type: inline-size;
  }
  .board {
    height: min(clamp(22rem, calc(100svh - 26rem), 48rem), calc(100cqw + 3rem));
    width: 100%;
  }
  .board-status {
    display: none;
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
  .lesson-side {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0;
    gap: 1.25rem;
  }
  .result {
    min-height: 8.75rem;
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
    min-height: 12rem;
  }
  .reference-heading {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }
  .reference-heading span,
  .practice-progress span {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim);
    font-variant-numeric: tabular-nums;
  }
  .examples {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.5rem;
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
  .practice-progress {
    display: grid;
    gap: 0.5rem;
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
      grid-template-rows: auto auto;
      gap: 1rem;
    }
    .board {
      height: 18.5rem;
    }
    .board-status {
      display: block;
      min-height: 2rem;
      text-align: center;
      font-size: 1.5rem;
      font-weight: 750;
    }
    .lesson-side {
      gap: 1rem;
    }
    .result {
      min-height: 7.5rem;
    }
    .reference-area {
      min-height: 11rem;
    }
    .examples {
      max-width: 28rem;
    }
    .example-art {
      max-width: 8rem;
    }
    .explore-tools {
      grid-template-columns: 1fr;
      justify-items: center;
    }
    .lesson-actions {
      max-width: 24rem;
    }
  }
  @media (min-width: 2400px) and (min-height: 1300px) {
    .positions-experience {
      --lesson-artifact-wide-max: min(var(--shell-w, 120rem), 100rem);
    }
    .workshop {
      grid-template-columns: minmax(0, 1.6fr) minmax(24rem, 1fr);
    }
  }
</style>
