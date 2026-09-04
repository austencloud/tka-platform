<!--
  Hand Positions continues directly from the Grid lesson. The grid keeps the
  same stage, heading rhythm, and controls while the hands become the subject.
  Alpha, Beta, and Gamma share one live artifact so their relationship is shown
  by the hands moving, not by replacing the whole page.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import LessonGridDisplay from "$lib/shared/pictograph/grid/components/LessonGridDisplay.svelte";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import type { PropPlacementData } from "$lib/shared/pictograph/prop/domain/models/prop-placement-data";
  import { propSvgLoader } from "$lib/shared/pictograph/prop/services/prop-svg-loader";
  import { HandSide } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
  import type { ExperienceViewMode } from "../../../domain/types";
  import LessonStageControls from "../LessonStageControls.svelte";
  import LessonStageFrame from "../LessonStageFrame.svelte";
  import LessonStageHeading from "../LessonStageHeading.svelte";

  let {
    onComplete,
    onBack,
    viewMode = "step",
  } = $props<{
    onComplete?: (nextConceptId?: string) => void;
    onBack?: () => void;
    viewMode?: ExperienceViewMode;
  }>();

  type SvgData = {
    svgContent: string;
    viewBox: { width: number; height: number };
    center: { x: number; y: number };
  };
  type Point = { x: number; y: number };
  type PositionKind = "alpha" | "beta" | "gamma";
  type PositionStep = {
    name: string;
    vtg: string;
    kind: PositionKind;
    caption: string;
  };

  const points: Point[] = [
    { x: 475, y: 331.9 },
    { x: 576.2, y: 373.8 },
    { x: 618.1, y: 475 },
    { x: 576.2, y: 576.2 },
    { x: 475, y: 618.1 },
    { x: 373.8, y: 576.2 },
    { x: 331.9, y: 475 },
    { x: 373.8, y: 373.8 },
  ];
  const betaOffset = 16;
  const wrap = (value: number) => ((value % 8) + 8) % 8;

  const steps: PositionStep[] = [
    {
      name: "Alpha",
      vtg: "Split",
      kind: "alpha",
      caption: "Hands at opposite points on the grid.",
    },
    {
      name: "Beta",
      vtg: "Together",
      kind: "beta",
      caption: "Both hands at the same point.",
    },
    {
      name: "Gamma",
      vtg: "Quarter",
      kind: "gamma",
      caption: "Hands at neighboring points, a right angle apart.",
    },
  ];

  const base: Record<PositionKind, { right: number; left: number }> = {
    alpha: { right: 0, left: 4 },
    beta: { right: 4, left: 4 },
    gamma: { right: 2, left: 4 },
  };

  const glyphs: Record<
    PositionKind,
    { src: string; width: number; height: number }
  > = {
    alpha: {
      src: "/images/letters_trimmed/Type6/α.svg",
      width: 92.22,
      height: 100,
    },
    beta: {
      src: "/images/letters_trimmed/Type6/β.svg",
      width: 66.05,
      height: 100,
    },
    gamma: {
      src: "/images/letters_trimmed/Type6/γ.svg",
      width: 79,
      height: 100.11,
    },
  };

  const compareStage = steps.length;
  const totalStages = steps.length + 1;
  let stage = $state(0);
  let focus = $state<number | null>(null);
  let rightIndex = $state(0);
  let leftIndex = $state(0);
  let visited = $state<Set<number>>(new Set());
  let lastAction = $state("");
  let rightHand = $state<SvgData | null>(null);
  let leftHand = $state<SvgData | null>(null);

  const isCompare = $derived(stage === compareStage);
  const step = $derived(steps[Math.min(stage, steps.length - 1)]!);
  const focusedStep = $derived(focus === null ? null : steps[focus]);
  const focusHands = $derived(
    focusedStep ? handsFor(focusedStep.kind, rightIndex, leftIndex) : null
  );
  const artifactKey = $derived(
    !isCompare ? "position" : focus === null ? "comparison" : `focus-${focus}`
  );
  const headingKey = $derived(
    `${stage}-${focus ?? "none"}-${lastAction}`
  );
  const headingTitle = $derived(
    focusedStep?.name ?? (isCompare ? "Hand Positions" : step.name)
  );
  const headingEyebrow = $derived(
    focusedStep?.vtg ?? (isCompare ? undefined : step.vtg)
  );
  const headingDescription = $derived.by(() => {
    if (focusedStep) {
      return (
        lastAction ||
        `Rotate, mirror, or swap hands. It stays ${focusedStep.name}.`
      );
    }
    if (isCompare) {
      return "These are the three basic positions. Tap one to play with it.";
    }
    return step.caption;
  });
  const currentCell = $derived(focusHands?.cell ?? 0);
  const focusTotal = $derived(focusHands?.total ?? 8);

  $effect(() => {
    if (focus === null || visited.has(currentCell)) return;
    visited = new Set(visited).add(currentCell);
  });

  async function loadHand(hand: HandSide): Promise<SvgData | null> {
    const motionData = {
      propType: PropType.HAND,
      hand,
    } as unknown as MotionData;
    const propData = {
      positionX: 0,
      positionY: 0,
      rotationAngle: 0,
      coordinates: null,
      svgCenter: null,
      svgMirrored: false,
      manualAdjustmentX: 0,
      manualAdjustmentY: 0,
    } as unknown as PropPlacementData;
    const result = await propSvgLoader.loadPropSvg(propData, motionData, true, {
      themeMode: "light",
    });
    return result.svgData as SvgData | null;
  }

  onMount(async () => {
    [rightHand, leftHand] = await Promise.all([
      loadHand(HandSide.RIGHT),
      loadHand(HandSide.LEFT),
    ]);
  });

  function handsFor(kind: PositionKind, right: number, left: number) {
    let rightPoint = points[right]!;
    let leftPoint = points[left]!;
    if (kind === "beta") {
      rightPoint = { x: rightPoint.x + betaOffset, y: rightPoint.y };
      leftPoint = { x: leftPoint.x - betaOffset, y: leftPoint.y };
    }
    const difference = wrap(left - right);
    const cell = kind === "gamma" ? right + (difference === 2 ? 0 : 8) : right;
    return {
      right: rightPoint,
      left: leftPoint,
      diamond: right % 2 === 0,
      cell,
      total: kind === "gamma" ? 16 : 8,
    };
  }

  function baseHands(kind: PositionKind) {
    return handsFor(kind, base[kind].right, base[kind].left);
  }

  function go(next: number) {
    focus = null;
    lastAction = "";
    stage = Math.max(0, Math.min(compareStage, next));
  }

  function openFocus(index: number) {
    focus = index;
    const kind = steps[index]!.kind;
    rightIndex = base[kind].right;
    leftIndex = base[kind].left;
    visited = new Set();
    lastAction = "";
  }

  function rotate() {
    rightIndex = wrap(rightIndex + 1);
    leftIndex = wrap(leftIndex + 1);
    lastAction = `Rotated clockwise, still ${focusedStep!.name}.`;
  }

  function mirror() {
    const nextRight = wrap(8 - rightIndex);
    const nextLeft = wrap(8 - leftIndex);
    const unchanged = nextRight === rightIndex && nextLeft === leftIndex;
    rightIndex = nextRight;
    leftIndex = nextLeft;
    lastAction = unchanged
      ? `Mirror does nothing here. This one's symmetric. Still ${focusedStep!.name}.`
      : `Mirrored, still ${focusedStep!.name}.`;
  }

  function swap() {
    const unchanged = rightIndex === leftIndex;
    [rightIndex, leftIndex] = [leftIndex, rightIndex];
    lastAction = unchanged
      ? `Swap does nothing here. Both hands share a point. Still ${focusedStep!.name}.`
      : `Swapped colors, still ${focusedStep!.name}.`;
  }

  function handlePrimaryAction() {
    if (stage === compareStage) {
      onComplete?.("hand-motions-intro");
      return;
    }
    go(stage + 1);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (viewMode !== "step") return;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      handlePrimaryAction();
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      handleBack();
    }
  }

  export function handleBack() {
    if (focus !== null) {
      focus = null;
      lastAction = "";
      return;
    }
    if (stage > 0) {
      go(stage - 1);
      return;
    }
    onBack?.();
  }
</script>

{#snippet hand(svg: SvgData, point: Point, mirrorHand: boolean)}
  <g
    class="hand"
    style="transform: translate({point.x}px, {point.y}px) {mirrorHand
      ? 'scaleX(-1) '
      : ''}translate({-svg.center.x}px, {-svg.center.y}px);"
  >
    {@html svg.svgContent}
  </g>
{/snippet}

{#snippet glyph(kind: PositionKind)}
  <image
    class="glyph"
    href={glyphs[kind].src}
    x="50"
    y="800"
    width={glyphs[kind].width}
    height={glyphs[kind].height}
    aria-hidden="true"
  />
{/snippet}

{#snippet positionArt(kind: PositionKind, hands: ReturnType<typeof handsFor>)}
  <div class="position-art">
    <div class="grid-layer">
      <LessonGridDisplay
        type={hands.diamond ? "diamond" : "box"}
        showLabels={false}
        size="large"
      />
    </div>
    <svg class="hand-layer" viewBox="0 0 950 950" aria-hidden="true">
      {@render glyph(kind)}
      {#if rightHand}{@render hand(rightHand, hands.right, true)}{/if}
      {#if leftHand}{@render hand(leftHand, hands.left, false)}{/if}
    </svg>
  </div>
{/snippet}

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  class="positions-experience"
  onkeydown={handleKeydown}
  tabindex="0"
  role="application"
  aria-label="Hand Positions lesson, use arrow keys to navigate"
>
  <LessonStageFrame artifactLayout={isCompare ? "wide" : "square"}>
    {#snippet heading()}
      <LessonStageHeading
        key={headingKey}
        title={headingTitle}
        eyebrow={headingEyebrow}
      >
        <p>{headingDescription}</p>
      </LessonStageHeading>
    {/snippet}

    {#snippet artifact()}
      <Crossfade key={artifactKey} fill>
        {#if !isCompare}
          {@const hands = baseHands(step.kind)}
          <div class="artifact-state hero-state">
            {@render positionArt(step.kind, hands)}
          </div>
        {:else if focus === null}
          <div class="artifact-state comparison-state">
            <div class="comparison-grid">
              {#each steps as option, index (option.name)}
                {@const hands = baseHands(option.kind)}
                <button
                  type="button"
                  class="position-option"
                  onclick={() => openFocus(index)}
                  aria-label={`Explore ${option.name}`}
                >
                  <span class="option-art">
                    {@render positionArt(option.kind, hands)}
                  </span>
                  <span class="option-copy">
                    <span class="option-eyebrow">{option.vtg}</span>
                    <strong>{option.name}</strong>
                  </span>
                </button>
              {/each}
            </div>
          </div>
        {:else if focusedStep && focusHands}
          <div class="artifact-state focus-state">
            <div class="focus-art">
              {@render positionArt(focusedStep.kind, focusHands)}
            </div>

            <div class="focus-actions">
              <div class="transform-actions">
                <PanelButton fullWidth onclick={rotate}>
                  <span aria-hidden="true">⟳</span><span>Rotate</span>
                </PanelButton>
                <PanelButton fullWidth onclick={mirror}>
                  <span aria-hidden="true">⇄</span><span>Mirror</span>
                </PanelButton>
                <PanelButton fullWidth onclick={swap}>
                  <span aria-hidden="true">◐</span><span>Swap colors</span>
                </PanelButton>
              </div>
              <div class="discovery-tray">
                <div
                  class="tray-grid"
                  style:grid-template-columns={`repeat(${focusTotal > 8 ? 8 : 4}, 1fr)`}
                >
                  {#each Array(focusTotal) as _, cell}
                    <span class="tray-cell" class:lit={visited.has(cell)}></span>
                  {/each}
                </div>
                <span>Discovered {visited.size} of {focusTotal}</span>
              </div>
            </div>
          </div>
        {/if}
      </Crossfade>
    {/snippet}

    {#snippet controls()}
      <LessonStageControls
        label={stage === compareStage ? "Finish ✓" : "Next ›"}
        currentStep={stage + 1}
        totalSteps={totalStages}
        onAction={handlePrimaryAction}
      />
    {/snippet}
  </LessonStageFrame>
</div>

<style>
  .positions-experience {
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    color: var(--theme-text);
    outline: none;
  }

  .artifact-state,
  .position-art {
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
  }

  .artifact-state {
    display: grid;
    place-items: center;
  }

  .position-art {
    position: relative;
  }

  .grid-layer,
  .hand-layer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .grid-layer :global(.lesson-grid-display),
  .grid-layer :global(.grid-svg) {
    width: 100%;
    max-width: none !important;
  }

  .hand-layer {
    overflow: visible;
  }

  .hand {
    transition: transform var(--duration-emphasis) var(--ease-out);
  }

  .glyph {
    filter: invert(0.85);
  }

  .comparison-grid {
    width: 100%;
    height: 100%;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-items: center;
    gap: clamp(0.5rem, 2cqw, 1rem);
  }

  .position-option {
    min-width: 0;
    container-type: inline-size;
    display: grid;
    grid-template-rows: auto auto;
    gap: 0.5rem;
    padding: 0.45rem;
    border: 1px solid var(--theme-stroke);
    border-radius: 14px;
    background: var(--theme-card-bg);
    color: var(--theme-text);
    cursor: pointer;
    transition:
      background var(--duration-fast) var(--ease-out),
      border-color var(--duration-fast) var(--ease-out),
      transform var(--duration-fast) var(--ease-out);
  }

  .position-option:hover {
    border-color: var(--theme-stroke-strong);
    background: var(--theme-card-hover-bg);
  }

  .position-option:active {
    transform: scale(0.98);
  }

  .position-option:focus-visible,
  .transform-actions :global(.panel-btn:focus-visible) {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .option-art {
    display: block;
    width: min(100cqi, calc(100cqh - 3.25rem));
    aspect-ratio: 1;
    justify-self: center;
  }

  .option-copy {
    display: grid;
    justify-items: center;
    gap: 0.15rem;
  }

  .option-copy strong {
    font-size: clamp(1rem, 2.5cqw, 1.35rem);
  }

  .option-eyebrow {
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .focus-state {
    grid-template-rows: minmax(0, 1fr) auto;
    gap: 0.65rem;
  }

  .focus-art {
    width: min(100%, 75cqh);
    aspect-ratio: 1;
  }

  .focus-actions {
    width: min(100%, 28rem);
  }

  .transform-actions {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.55rem;
  }

  .transform-actions :global(.panel-btn) {
    min-width: 0;
    min-height: max(var(--min-touch-target, 44px), 3.25rem);
    padding: 0.75rem 0.65rem;
    border-radius: 12px;
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 700;
  }

  .discovery-tray {
    display: grid;
    justify-items: center;
    gap: 0.35rem;
    margin-top: 0.55rem;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 0.75rem);
    font-variant-numeric: tabular-nums;
  }

  .tray-grid {
    display: grid;
    gap: 0.3rem;
  }

  .tray-cell {
    width: 0.8rem;
    aspect-ratio: 1;
    border: 1px solid var(--theme-stroke-strong);
    border-radius: 3px;
    background: transparent;
    transition:
      background var(--duration-normal) var(--ease-out),
      border-color var(--duration-normal) var(--ease-out),
      transform var(--duration-normal) var(--ease-out);
  }

  .tray-cell.lit {
    border-color: var(--theme-accent);
    background: var(--theme-accent);
    transform: scale(1.1);
  }

  @media (max-width: 640px) {
    .comparison-grid {
      gap: 0.25rem;
    }

    .position-option {
      padding: 0.2rem;
    }

    .option-copy strong {
      font-size: var(--font-size-min, 0.875rem);
    }

    .option-eyebrow {
      font-size: 0.7rem;
    }

    .focus-art {
      width: min(100%, 68cqh);
    }

  }

  @media (max-height: 480px) and (min-width: 641px) {
    .comparison-grid {
      gap: 0.75rem;
    }

    .position-option {
      gap: 0.2rem;
      padding: 0.2rem;
    }

    .option-copy {
      grid-template-columns: auto auto;
      justify-content: center;
      align-items: baseline;
      gap: 0.4rem;
    }

    .option-copy strong,
    .option-eyebrow {
      font-size: 0.75rem;
    }

    .focus-state {
      grid-template-columns: minmax(0, 1fr) minmax(18rem, 1.25fr);
      grid-template-rows: minmax(0, 1fr);
      gap: 1rem;
    }

    .focus-art {
      width: min(100%, 100cqh);
      align-self: center;
      justify-self: end;
    }

    .focus-actions {
      align-self: center;
      justify-self: start;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .hand,
    .position-option,
    .tray-cell {
      transition: none;
    }
  }
</style>
