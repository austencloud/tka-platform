<!--
  ConstructSection.svelte — live construct demo for the composer-wings TEST page.
  Spec: docs/superpowers/specs/2026-07-19-construct-attract-demo-design.md

  Toolbar strip (prop picker + turns picker) above two panes, like the real
  Create tab: the REAL WorkspaceGrid (start position in its own column, steps
  flowing beside it — the canonical workspace layout) beside the REAL
  StartPositionPicker / OptionPicker. Building ends in a PLAY phase: the right
  pane swaps to the real AnimationPlayer and the workspace highlights the
  currently-playing step via the canonical selection mechanism.

  While nobody touches it, the Construct Attract Act builds a random valid walk
  on loop with a ghost pointer — including pressing Play and letting the
  sequence animate — and the first real pointerdown or focusin kills the act
  for the visit. Reduced motion: no act, no ghost, plain interactive.

  Prop policy: this surface pins its own prop via the canonical-five PropPicker
  (staff default) and passes bluePropTypeOverride/redPropTypeOverride down the
  whole chain — the user's global prop setting (which may be poi) never reaches
  this demo. Poi is deliberately impossible here. Turns policy is the same
  move: the demo pins whole turns (0-3) via its own picker and passes
  blueTurnsOverride/redTurnsOverride, so the user's sticky Create-tab turns
  (localStorage) never leak in.

  Fully self-contained — owns its own local $state and deliberately does NOT
  touch the shared create-tutorial singleton, so this preview can never collide
  with a real build in progress. Marketing-demo surface, not shipping chrome.
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { createSimplifiedStartPositionState } from "$lib/shared/create/state/start-position-state.svelte";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
  import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import {
    getLetterType,
    type Letter,
  } from "$lib/shared/foundation/domain/models/letter";
  import { LetterType } from "$lib/shared/foundation/domain/models/letter-type";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import { pictographDataToStepData } from "$lib/shared/pictograph/shared/domain/utils/step-pictograph-conversion";
  import { calculateGridLayout } from "$lib/shared/create/utils/grid-calculations";
  import WorkspaceGrid from "$lib/features/create/shared/workspace-panel/sequence-display/components/WorkspaceGrid.svelte";
  import { createStepGridDisplayState } from "$lib/features/create/shared/workspace-panel/sequence-display/state/step-grid-display-state.svelte";
  import { createScrollState } from "$lib/features/create/shared/workspace-panel/sequence-display/state/scroll-state.svelte";
  import PropPicker from "$lib/features/store/components/PropPicker.svelte";
  import {
    SHOP_PROP_OPTIONS,
    DEFAULT_SHOP_PROP,
  } from "$lib/features/store/domain/shop-prop-options";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import GhostPointer from "./GhostPointer.svelte";
  import {
    createConstructAttractAct,
    type ConstructAttractAct,
  } from "./construct-attract-act.svelte";

  // Visitors can click up to 8 steps (a full 8-count); the attract act builds
  // a quicker 4 so cycles stay snappy. Steps flow 4 per row beside the start
  // column, so 8 steps = two clean rows.
  const MAX_STEPS = 8;
  const STEP_COLUMNS = 4;
  const ATTRACT_STEPS = 4;

  // Whole turns only (0-3) — the demo deliberately skips half turns; the full
  // turns system lives in the real Create tab.
  const TURN_OPTIONS = [
    { value: "0", label: "0" },
    { value: "1", label: "1" },
    { value: "2", label: "2" },
    { value: "3", label: "3" },
  ];

  // Isolated demo state — start position + picked steps. The full sequence and
  // display word are derived from these two, so the UI stays in lockstep.
  let startPosition = $state<PictographData | null>(null);
  let gridMode = $state<GridMode>(GridMode.DIAMOND);
  let steps = $state<PictographData[]>([]);
  let playing = $state(false);
  let playingStepNumber = $state<number | null>(null);

  // The demo's pinned prop — canonical five only, staves first. Never poi, and
  // never the user's global setting.
  let demoProp = $state<PropType>(DEFAULT_SHOP_PROP);

  // The demo's pinned turns — applied to BOTH hands, overriding the picker's
  // sticky localStorage turns (same leak-proofing as the prop override).
  let demoTurnsValue = $state<string>("0");
  const demoTurns = $derived(Number(demoTurnsValue));

  // The real start-position picker drives its own state object; we subscribe to
  // the user's pick and lift it into our local demo state (source "sync" changes
  // — e.g. our own clear on reset — are ignored, exactly like the tutorial step).
  const startPositionState = createSimplifiedStartPositionState();
  let unsubscribe: (() => void) | null = null;

  // Attract act wiring (spec §Attract loop / §Takeover).
  let bandEl = $state<HTMLElement | null>(null);
  let act: ConstructAttractAct | null = $state(null);
  let tookOver = $state(false);
  let io: IntersectionObserver | null = null;

  onMount(() => {
    unsubscribe = startPositionState.onSelectedPositionChange(
      (position, source) => {
        if (source === "user" && position) {
          startPosition = position;
          gridMode = startPositionState.currentGridMode;
          steps = [];
          playing = false;
        }
      },
    );

    // Reduced motion → never create the act; section is plainly interactive.
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!reduced && bandEl) {
      act = createConstructAttractAct({
        getRoot: () => bandEl,
        resetBoard: reset,
        stepsPerCycle: ATTRACT_STEPS,
      });
      io = new IntersectionObserver(
        (entries) => {
          const visible = entries.some((e) => e.isIntersecting);
          act?.setVisible(visible);
          if (visible) act?.start();
        },
        { threshold: 0.25 },
      );
      io.observe(bandEl);
    }
  });

  onDestroy(() => {
    unsubscribe?.();
    act?.kill();
    io?.disconnect();
  });

  // Grab the wheel: first REAL interaction kills the act permanently and the
  // visitor continues from the current board state. The act's programmatic
  // click() fires no pointerdown and never focuses, so it can't trip this.
  function takeover() {
    if (act && !act.dead) {
      act.kill();
      tookOver = true;
    }
  }

  // Full sequence fed to the option picker: start position + every picked step.
  const currentSequence = $derived<PictographData[]>(
    startPosition ? [startPosition, ...steps] : [],
  );

  // Three phases, derived straight from state. Hitting the 8-step cap plays
  // automatically; before that, the Play button flips `playing`.
  const phase = $derived<"pick-start" | "add-step" | "play">(
    !startPosition
      ? "pick-start"
      : playing || steps.length >= MAX_STEPS
        ? "play"
        : "add-step",
  );

  // sequence.word is DATA (the expanded letters); what the user reads is the
  // simplified form — repeated words always collapse to their smallest form.
  const rawWord = $derived(steps.map((s) => s.letter ?? "").join(""));
  const displayWord = $derived(simplifyRepeatedWord(rawWord));

  // ---- Real workspace plumbing (WorkspaceGrid is the canonical layout:
  // start position owns column 1, steps flow in columns 2+). ----
  const workspaceDisplayState = createStepGridDisplayState();
  const workspaceScrollState = createScrollState();

  const startStepData = $derived<StepData | null>(
    startPosition
      ? {
          ...pictographDataToStepData(startPosition, startPosition.id ?? "demo-start"),
          stepNumber: 0,
        }
      : null,
  );
  const stepData = $derived<StepData[]>(
    steps.map((p, i) => ({
      ...pictographDataToStepData(p, p.id ?? `demo-step-${i}`),
      stepNumber: i + 1,
    })),
  );

  let wsW = $state(0);
  let wsH = $state(0);
  // The calculator's narrow few-steps branch sizes cells by width only (mobile
  // convention: a scroll container handles the overflow). This demo's frame is
  // fixed-height and must NEVER scroll — cap the cell to what the frame can
  // actually show (frame minus the grid's own 16px padding ring).
  const gridLayout = $derived.by(() => {
    const raw = calculateGridLayout(stepData.length, wsW || 600, wsH || 240, null, {
      manualColumnCount: STEP_COLUMNS,
    });
    const maxCell = Math.floor(((wsH || 240) - 40) / raw.rows);
    return { ...raw, cellSize: Math.min(raw.cellSize, maxCell) };
  });

  // Only Type 1 (dual-shift) options, presented as the whole set — mirrors the
  // create tutorial so first-time builders see one clean, valid family.
  function isType1(option: PictographData): boolean {
    return (
      !!option.letter &&
      getLetterType(option.letter as Letter) === LetterType.TYPE1
    );
  }

  function handleOptionSelected(option: PictographData) {
    if (steps.length >= MAX_STEPS) return;
    steps = [...steps, option];
  }

  // ---- Play phase: the built sequence, packaged for the real AnimationPlayer.
  // Steps carry full motion data (the option pipeline bakes it in), so the
  // player runs standalone with no gallery lookup.
  const playSequence = $derived<SequenceData | null>(
    phase === "play" && startStepData && stepData.length > 0
      ? ({
          id: `construct-demo-${rawWord}`,
          name: displayWord,
          word: rawWord,
          steps: stepData,
          startPosition: startStepData as unknown as StartPositionData,
          thumbnails: [],
          gridMode,
        } as unknown as SequenceData)
      : null,
  );

  // The player reports the playing step (0-indexed; null = start position) and
  // the workspace highlights it via the canonical selection mechanism.
  function handlePlayerStepChange(stepIndex: number | null) {
    playingStepNumber = stepIndex === null ? 0 : stepIndex + 1;
  }

  function reset() {
    steps = [];
    startPosition = null;
    playing = false;
    playingStepNumber = null;
    startPositionState.clearSelectedPosition();
  }
</script>

<section
  class="construct-demo"
  bind:this={bandEl}
  onpointerdowncapture={takeover}
  onfocusincapture={takeover}
>
  <!-- Toolbar strip above the side-by-side view: prop over the workspace half,
       turns over the picker half. -->
  <div class="demo-toolbar">
    <div class="tool-group">
      <span class="tool-label">Prop</span>
      <PropPicker
        value={demoProp}
        onchange={(p) => (demoProp = p)}
        options={SHOP_PROP_OPTIONS}
      />
    </div>
    <div class="tool-group turns-group">
      <span class="tool-label">Turns</span>
      <SegmentedControl
        options={TURN_OPTIONS}
        value={demoTurnsValue}
        onchange={(v) => (demoTurnsValue = v)}
        color="accent"
      />
    </div>
  </div>

  <div class="demo-body">
    <!-- WORKSPACE: the real WorkspaceGrid — start column + step columns. -->
    <div class="workspace">
      <header class="demo-status" aria-live={tookOver ? "polite" : "off"}>
        {#if phase === "pick-start"}
          <p class="hint">
            {#if act && !tookOver}
              Watch it build — or tap anything to take over.
            {:else}
              Pick a starting position to begin.
            {/if}
          </p>
        {:else}
          <p class="word-line">
            <span class="word-label">Your sequence</span>
            <span class="word">{displayWord || "—"}</span>
            <span class="count">
              Step <span class="num">{steps.length}</span>/<span class="num"
                >{MAX_STEPS}</span
              >
            </span>
          </p>
          {#if phase === "add-step"}
            <!-- Slot is always reserved; the button only becomes visible (and
                 pressable) once there's something to play. No layout shift. -->
            <button
              type="button"
              class="cta-btn play-btn"
              data-demo-play
              style:visibility={steps.length > 0 ? "visible" : "hidden"}
              onclick={() => (playing = true)}
            >
              <i class="fas fa-play" aria-hidden="true"></i>
              Play
            </button>
          {/if}
        {/if}
      </header>

      <div class="ws-frame" bind:clientWidth={wsW} bind:clientHeight={wsH}>
        {#if startStepData}
          <WorkspaceGrid
            steps={stepData}
            startPosition={startStepData}
            {gridLayout}
            displayState={workspaceDisplayState}
            scrollState={workspaceScrollState}
            selectedStepNumber={phase === "play" ? playingStepNumber : null}
            getStepKey={(beat, index) => beat.id ?? `demo-key-${index}`}
            getDurationDisplay={(stepIndex) => String(stepIndex + 1)}
            bluePropTypeOverride={demoProp}
            redPropTypeOverride={demoProp}
            sequenceWord={rawWord}
          />
        {:else}
          <p class="ws-empty" aria-hidden="true">
            The sequence appears here as it's built.
          </p>
        {/if}
      </div>
    </div>

    <!-- PICKER / PLAYER: the real primitives; phase swap lives HERE only. -->
    <div class="picker-pane">
      {#if phase === "pick-start"}
        {#await import("$lib/features/create/construct/start-position-picker/components/StartPositionPicker.svelte") then mod}
          <mod.default
            {startPositionState}
            embedded
            bluePropTypeOverride={demoProp}
            redPropTypeOverride={demoProp}
          />
        {/await}
      {:else if phase === "add-step"}
        {#await import("$lib/features/create/construct/option-picker/components/OptionPicker.svelte") then mod}
          <mod.default
            {currentSequence}
            currentGridMode={gridMode}
            onOptionSelected={handleOptionSelected}
            filterPredicate={isType1}
            hideFilters
            bluePropTypeOverride={demoProp}
            redPropTypeOverride={demoProp}
            blueTurnsOverride={demoTurns}
            redTurnsOverride={demoTurns}
          />
        {/await}
      {:else if playSequence}
        {#await import("$lib/shared/sequence-viewer/components/AnimationPlayer.svelte") then mod}
          <div class="play-pane">
            <div class="player-frame">
              <mod.default
                sequence={playSequence}
                autoPlay
                showControls={false}
                hideWordHeader
                tapToToggle
                bluePropType={demoProp}
                redPropType={demoProp}
                onStepChange={handlePlayerStepChange}
              />
            </div>
            <button type="button" class="cta-btn" onclick={reset}>
              Build another
            </button>
          </div>
        {/await}
      {/if}
    </div>
  </div>

  {#if act}
    <GhostPointer
      x={act.ghost.x}
      y={act.ghost.y}
      pressed={act.ghost.pressed}
      visible={act.ghost.visible}
    />
  {/if}
</section>

<style>
  .construct-demo {
    container-type: inline-size;
    position: relative;
    width: 100%;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 18px;
    color: var(--theme-text, #fff);
  }

  /* ===== Toolbar strip ===== */
  .demo-toolbar {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: flex-end;
    gap: 16px 32px;
    width: 100%;
  }

  .tool-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  .tool-label {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  /* Denser prop tiles for this compact demo toolbar (the shop default 104px
     basis is sized for configurator pages). */
  .tool-group :global(.prop-option) {
    flex-basis: 84px;
    min-width: 72px;
  }

  .turns-group :global(.segmented-control) {
    width: max-content;
  }

  .demo-body {
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
  }

  /* Side-by-side once the band is wide enough: workspace left (result reads
     first), picker right (the side the ghost taps). Both grow with the band —
     this is what fills the 1680+ tier instead of the old 54vh void. The
     toolbar mirrors the same columns so Prop sits over the workspace half and
     Turns sits over the picker half. */
  @container (min-width: 1100px) {
    .demo-body,
    .demo-toolbar {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
      gap: clamp(24px, 3cqw, 56px);
    }
    .demo-body {
      align-items: center;
    }
    .demo-toolbar {
      align-items: end;
    }
    .turns-group {
      justify-self: start;
    }
  }

  .workspace {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 0;
  }

  /* Status row reserves the CTA height so the Play button appearing (or the
     hint swapping to the word line) never shifts the workspace below. */
  .demo-status {
    min-height: 48px;
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }

  .hint {
    margin: 0;
    font-size: 0.95rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .word-line {
    margin: 0;
    display: inline-flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 10px 14px;
  }

  .word-label {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .word {
    font-size: 1.4rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--theme-text, #fff);
  }

  .count {
    font-size: 0.85rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  /* Digits never jitter the layout as the count climbs. */
  .num {
    font-variant-numeric: tabular-nums;
  }

  /* Fixed-height frame reserves the workspace footprint before anything is
     built — the grid appears INSIDE it, so nothing below ever shifts. */
  .ws-frame {
    height: clamp(180px, 26vh, 320px);
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0;
  }

  .ws-empty {
    margin: 0;
    text-align: center;
    font-size: 0.85rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.35));
  }

  /* The picker still needs an explicit height for its internal grid-fit math,
     but far tighter than the old 54vh — and it now shares the row with the
     workspace instead of floating alone in a void. */
  .picker-pane {
    width: 100%;
    height: clamp(320px, 42vh, 600px);
  }

  /* The option grid caps its tile size; in a tall picker it top-aligns because
     the single-section fallback drops the grid into a flex item that isn't a
     flex container. Center it, scoped to this demo picker. */
  .picker-pane :global(.swipe-container) {
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  /* ===== Play phase ===== */
  .play-pane {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
  }

  .player-frame {
    flex: 1;
    width: 100%;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .cta-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 22px;
    border-radius: 999px;
    border: 1px solid
      color-mix(in srgb, var(--theme-accent, #8b5cf6) 55%, transparent);
    background: color-mix(
      in srgb,
      var(--theme-accent, #8b5cf6) 22%,
      transparent
    );
    color: var(--theme-text, #fff);
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition:
      background 0.16s ease,
      transform 0.16s ease;
  }

  .cta-btn:hover {
    background: color-mix(
      in srgb,
      var(--theme-accent, #8b5cf6) 34%,
      transparent
    );
    transform: translateY(-1px);
  }

  .cta-btn:active {
    transform: translateY(0);
  }

  .play-btn i {
    font-size: 0.8em;
  }

  @media (max-width: 480px) {
    .picker-pane {
      height: clamp(320px, 56vh, 520px);
    }
    .word {
      font-size: 1.25rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .cta-btn {
      transition: none;
    }
  }
</style>
