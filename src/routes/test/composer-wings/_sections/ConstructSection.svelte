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
  move: the demo pins whole turns (0-3) via per-hand pickers (blue/red) and
  passes blueTurnsOverride/redTurnsOverride, so the user's sticky Create-tab
  turns (localStorage) never leak in.

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
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import { pictographDataToStepData } from "$lib/shared/pictograph/shared/domain/utils/step-pictograph-conversion";
  import { calculateGridLayout } from "$lib/shared/create/utils/grid-calculations";
  import WorkspaceGrid from "$lib/features/create/shared/workspace-panel/sequence-display/components/WorkspaceGrid.svelte";
  import { createStepGridDisplayState } from "$lib/features/create/shared/workspace-panel/sequence-display/state/step-grid-display-state.svelte";
  import { createScrollState } from "$lib/features/create/shared/workspace-panel/sequence-display/state/scroll-state.svelte";
  import WordLabel from "$lib/features/create/shared/workspace-panel/sequence-display/components/WordLabel.svelte";
  import ViewSequenceButton from "$lib/features/create/shared/workspace-panel/shared/components/buttons/ViewSequenceButton.svelte";
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import { DURATION } from "$lib/shared/transitions/transitions";
  import { motionDuration } from "$lib/shared/transitions/motion";
  import { slide } from "svelte/transition";
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

  // The demo's pinned turns — one picker PER HAND (blue/red), overriding the
  // picker's sticky localStorage turns (same leak-proofing as the prop
  // override).
  let blueTurnsValue = $state<string>("0");
  let redTurnsValue = $state<string>("0");
  const blueTurns = $derived(Number(blueTurnsValue));
  const redTurns = $derived(Number(redTurnsValue));

  // The player's playback-toggle fn (via onTogglePlaybackRef). The attract act
  // calls it to demonstrate tap-to-pause/tap-to-play on the canvas — the real
  // tap listener is pointer-based, and the act must never dispatch synthetic
  // pointer events (they'd trip the takeover listener).
  let playerToggle: (() => void) | null = null;

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
        togglePlayback: () => playerToggle?.(),
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
  <div class="demo-shell">
  <!-- Two column stacks: prop + workspace left, turns + picker right. Each
       control sits directly above the panel it affects, and the turns strip
       lives INSIDE the right column — when it slides away for the play phase
       the player pane (flex: 1) expands upward into the freed strip and the
       canvas gets bigger. The columns' total height stays constant across
       phases (the strip's space is reserved), so the page never shifts. -->
  <div class="demo-columns">
    <div class="demo-col">
    <div class="tool-group">
      <span class="tool-label">Prop</span>
      <PropPicker
        value={demoProp}
        onchange={(p) => (demoProp = p)}
        options={SHOP_PROP_OPTIONS}
      />
    </div>

    <!-- WORKSPACE: the real WorkspaceGrid — start column + step columns. -->
    <div class="workspace">
      <!-- Canonical word display: the same WordLabel the real workspace shows
           top-center (TKA glyphs, click-to-copy, letter highlighting during
           playback). No step counter — the app doesn't count steps at you. -->
      <header
        class="demo-status word-label-area"
        aria-live={tookOver ? "polite" : "off"}
      >
        {#if rawWord}
          <WordLabel
            word={rawWord}
            activeStepNumber={phase === "play" && playingStepNumber
              ? playingStepNumber
              : null}
          />
        {:else}
          <p class="hint">
            {#if phase === "pick-start" && act && !tookOver}
              Watch it build — or tap anything to take over.
            {:else if phase === "pick-start"}
              Pick a starting position to begin.
            {:else}
              Tap a pictograph to add it.
            {/if}
          </p>
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

      <!-- The app's ButtonPanel center zone, miniaturized: the canonical green
           View/Play button sits bottom-center of the workspace; during play
           the SAME slot crossfades to Build another (answers "where does Build
           another go on wide screens" — the canonical action slot, not under
           the canvas). -->
      <div class="action-slot">
        <Crossfade key={phase} duration={DURATION.normal}>
          {#if phase === "add-step"}
            <span
              data-demo-play
              style:visibility={steps.length > 0 ? "visible" : "hidden"}
            >
              <ViewSequenceButton onclick={() => (playing = true)} />
            </span>
          {:else if phase === "play"}
            <div class="play-actions">
              <!-- Back to the option picker with the build intact — "one more
                   step". Hidden at the 8-step cap (nothing to go back to). -->
              {#if steps.length < MAX_STEPS}
                <button
                  type="button"
                  class="cta-btn quiet"
                  onclick={() => {
                    playing = false;
                    playingStepNumber = null;
                  }}
                >
                  <i class="fas fa-arrow-left" aria-hidden="true"></i>
                  Keep building
                </button>
              {/if}
              <button
                type="button"
                class="cta-btn"
                data-demo-again
                onclick={reset}
              >
                <i class="fas fa-rotate-left" aria-hidden="true"></i>
                Build another
              </button>
            </div>
          {/if}
        </Crossfade>
      </div>
    </div>
    </div>

    <div class="demo-col">
    <!-- Turns imply "you can change the playing sequence's turns" — not true
         during playback, so they slide away for the play phase (freeing their
         strip for the player) and return on Keep building / Build another. -->
    {#if phase !== "play"}
      <div
        class="turns-pair"
        transition:slide={{ duration: motionDuration(DURATION.normal) }}
      >
        <div class="tool-group turns-group blue">
          <span class="tool-label"
            ><span class="hand-dot blue" aria-hidden="true"></span>Blue
            turns</span
          >
          <SegmentedControl
            options={TURN_OPTIONS}
            value={blueTurnsValue}
            onchange={(v) => (blueTurnsValue = v)}
            color="blue"
          />
        </div>
        <div class="tool-group turns-group red">
          <span class="tool-label"
            ><span class="hand-dot red" aria-hidden="true"></span>Red
            turns</span
          >
          <SegmentedControl
            options={TURN_OPTIONS}
            value={redTurnsValue}
            onchange={(v) => (redTurnsValue = v)}
            color="red"
          />
        </div>
      </div>
    {/if}

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
          <!-- The FULL option set: every letter family, sectioned into the
               real swipe layout (embla pages + arrows), with the picker's own
               All/Continuous filter pill. The old Type-1-only training wheels
               are off — this is the real construct experience in miniature. -->
          <mod.default
            {currentSequence}
            currentGridMode={gridMode}
            onOptionSelected={handleOptionSelected}
            bluePropTypeOverride={demoProp}
            redPropTypeOverride={demoProp}
            blueTurnsOverride={blueTurns}
            redTurnsOverride={redTurns}
          />
        {/await}
      {:else if playSequence}
        {#await import("$lib/shared/sequence-viewer/components/AnimationPlayer.svelte") then mod}
          <div class="play-pane">
            <!-- No transport chrome: tap the canvas to pause/play (hoverHint
                 teaches it on mouse, the act demonstrates it live), with the
                 thin progress line as the only readout. -->
            <div class="player-frame" data-demo-stage>
              <mod.default
                sequence={playSequence}
                autoPlay
                showControls={false}
                hideWordHeader
                tapToToggle
                progressLine
                hoverHint="badge"
                bluePropType={demoProp}
                redPropType={demoProp}
                onStepChange={handlePlayerStepChange}
                onTogglePlaybackRef={(fn: () => void) => (playerToggle = fn)}
              />
            </div>
          </div>
        {/await}
      {/if}
    </div>
    </div>
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
    color: var(--theme-text, #fff);
  }

  /* The toy box: one framed panel holds the whole demo, so toolbar, workspace
     and picker read as a single self-contained unit instead of controls
     floating in the section void. */
  .demo-shell {
    display: flex;
    flex-direction: column;
    gap: 16px;
    /* Contained toy, not a full-bleed slab: on ultrawide viewports the panel
       caps out and centers, so the controls never drift apart into voids.
       4K-native cap per the shell standard (min(1720px, 92vw)) — 1360 left
       the toy inset from its own heading at 2560 CSS. */
    width: 100%;
    max-width: min(1720px, 92vw);
    margin-inline: auto;
    padding: clamp(16px, 2.2cqw, 28px);
    border-radius: 24px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: color-mix(
      in srgb,
      var(--theme-panel-bg, rgba(16, 16, 26, 0.55)) 85%,
      transparent
    );
    box-sizing: border-box;
  }

  /* ===== Column stacks =====
     Narrow: one vertical flow (prop, workspace, turns, picker). Wide: two
     stacks side by side — each control directly above the panel it drives. */
  .demo-columns {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
  }

  .demo-col {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
  }

  .tool-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }

  /* The pair fills whatever cell it's given; each hand's picker takes half.
     Definite widths all the way down, so the controls' width:100% resolves
     (the old content-sized column collapsed them to min-content). */
  .turns-pair {
    display: flex;
    gap: 14px 18px;
    width: 100%;
    min-width: 0;
  }

  .turns-group {
    flex: 1 1 0;
    min-width: 0;
  }

  .tool-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .hand-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .hand-dot.blue {
    background: var(--prop-blue, #4a7bd8);
  }

  .hand-dot.red {
    background: var(--prop-red, #d84a4a);
  }

  /* Prop tiles GROW to fill their toolbar cell — edge-to-edge, no void after
     the last tile. (Denser than the shop's 104px configurator basis.) */
  .tool-group :global(.prop-option) {
    flex: 1 1 84px;
    min-width: 72px;
  }

  /* ===== Per-hand glass turn pickers =====
     Color-coding does the explaining: the blue picker IS blue, the red picker
     IS red — tinted glass shells, and a glossy gradient indicator with a glow
     for the selected count. */
  .turns-group :global(.segmented-control) {
    width: 100%;
    border-radius: 14px;
    padding: 4px;
    gap: 3px;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }

  .turns-group.blue :global(.segmented-control) {
    background: color-mix(
      in srgb,
      var(--prop-blue, #4a7bd8) 10%,
      rgba(255, 255, 255, 0.02)
    );
    border-color: color-mix(
      in srgb,
      var(--prop-blue, #4a7bd8) 38%,
      transparent
    );
  }

  .turns-group.red :global(.segmented-control) {
    background: color-mix(
      in srgb,
      var(--prop-red, #d84a4a) 10%,
      rgba(255, 255, 255, 0.02)
    );
    border-color: color-mix(in srgb, var(--prop-red, #d84a4a) 38%, transparent);
  }

  .turns-group :global(.segmented-control .indicator) {
    border-radius: 10px;
  }

  .turns-group.blue :global(.segmented-control .indicator) {
    background: linear-gradient(
      160deg,
      color-mix(in srgb, var(--prop-blue, #4a7bd8) 70%, white) 0%,
      var(--prop-blue, #4a7bd8) 55%,
      color-mix(in srgb, var(--prop-blue, #4a7bd8) 75%, black) 100%
    );
    box-shadow:
      0 2px 14px color-mix(in srgb, var(--prop-blue, #4a7bd8) 55%, transparent),
      inset 0 1px 0 rgba(255, 255, 255, 0.35);
  }

  .turns-group.red :global(.segmented-control .indicator) {
    background: linear-gradient(
      160deg,
      color-mix(in srgb, var(--prop-red, #d84a4a) 70%, white) 0%,
      var(--prop-red, #d84a4a) 55%,
      color-mix(in srgb, var(--prop-red, #d84a4a) 75%, black) 100%
    );
    box-shadow:
      0 2px 14px color-mix(in srgb, var(--prop-red, #d84a4a) 55%, transparent),
      inset 0 1px 0 rgba(255, 255, 255, 0.35);
  }

  .turns-group :global(.segment) {
    min-height: 48px;
    font-size: 1.05rem;
    font-weight: 650;
  }

  /* Side-by-side once the band is wide enough: workspace stack left (result
     reads first), picker stack right (the side the ghost taps). Workspace ≥
     picker: the built sequence is the star, the picker is the menu.

     The min-height reserve is the trick that lets the player GROW without
     shifting the page: the row's height always includes the turns strip
     (~85px + 16px stack gap), so during the build the strip fills it and
     during play the picker (flex: 1) expands upward into it — same total,
     bigger canvas. */
  @container (min-width: 1100px) {
    .demo-columns {
      display: grid;
      grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
      gap: 0 clamp(24px, 3cqw, 48px);
      align-items: stretch;
      min-height: calc(clamp(300px, 38vh, 540px) + 108px);
    }
    .workspace {
      flex: 1;
    }
    .picker-pane {
      /* flex-basis 0: the pane fills whatever the row gives it but its
         CONTENT never drives the row height — the start picker's intrinsic
         size was pushing the row 21px taller than the other phases, shifting
         the page on every first pick. */
      flex: 1 1 0;
      height: auto;
      min-height: clamp(300px, 38vh, 540px);
      overflow: hidden;
    }
  }

  /* Both halves are framed sub-panels — defined edges instead of controls
     floating in the shell. Symmetric margins INSIDE a visible frame read as a
     stage; the same pixels outside one read as accidental void. */
  .workspace,
  .picker-pane {
    border-radius: 18px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    background: rgba(255, 255, 255, 0.025);
    padding: 12px 16px 14px;
    box-sizing: border-box;
  }

  .workspace {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }

  /* Word row: the canonical WordLabel, centered like the real workspace.
     Fixed height so hint ↔ word swaps never shift the grid below. WordLabel
     reads --text-color (its default is a light-theme navy). */
  .demo-status {
    min-height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    --text-color: var(--theme-text, #fff);
  }

  .hint {
    margin: 0;
    font-size: 0.95rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  /* The ButtonPanel-center-zone slot: green play during building, Build
     another during play. Height reserved — the crossfade never shifts the
     grid above it. */
  .action-slot {
    min-height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* ===== Ghost hover mirror =====
     The fake pointer can't trip CSS :hover, so the act tags its current
     target with .ghost-hover and we mirror the real affordances: buttons
     lift/brighten, and the canvas shows its pause/play badge — the ghost
     reads as someone truly interacting. */
  .construct-demo :global(.ghost-hover) {
    filter: brightness(1.2);
  }

  /* The independent `scale` property, NOT transform: the embla pager arrows
     center themselves with transform: translateY(-50%), and a transform
     override here replaced that — the arrow slid down its half-height over
     the hover transition. `scale` composes with any transform. */
  .construct-demo :global(button.ghost-hover) {
    scale: 1.06;
  }

  /* Fully :global — the ghost-hover class is added at runtime by the act, so
     a scoped selector would be pruned as "unused" at compile time and the
     badge mirror would never ship. .construct-demo keeps it page-scoped. */
  :global(.construct-demo .player-frame.ghost-hover .hover-hint) {
    opacity: 1;
  }

  :global(.construct-demo .player-frame.ghost-hover .hint-stack) {
    transform: scale(1);
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

  /* Side-by-side tier: the frame stretches to the picker column's height so
     the left column has no dead band under the sequence. (Placed AFTER the
     base rule — same specificity, source order decides.) */
  @container (min-width: 1100px) {
    .ws-frame {
      flex: 1;
      height: auto;
      min-height: 240px;
    }
  }

  .ws-empty {
    margin: 0;
    text-align: center;
    font-size: 0.85rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.35));
  }

  /* The picker still needs an explicit height for its internal grid-fit math,
     but far tighter than the old 54vh — and it now shares the row with the
     workspace instead of floating alone in a void. Capped low enough that the
     whole toy (header + toolbar + body) fits a laptop viewport without
     scrolling — the first impression IS the fit. */
  .picker-pane {
    width: 100%;
    height: clamp(300px, 38vh, 540px);
  }

  /* The option grid caps its tile size; in a tall picker it top-aligns because
     the single-section fallback drops the grid into a flex item that isn't a
     flex container. Center it, scoped to this demo picker. */
  .picker-pane :global(.swipe-container) {
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  /* Start tiles: the shared grid sizes tiles at 28% of the container's short
     side — tuned for the full Create tab, undersized in this pane (124px in a
     695×476 box). Three across at ~42% of the short side fills the stage. */
  .picker-pane :global(.pictograph-row .pictograph-wrapper) {
    width: min(100%, 42cqmin);
  }

  /* The All/Continuous pill docks top-LEFT in this pane — centered, it reads
     as a header for the whole picker instead of the small mode control it is. */
  .picker-pane :global(.filter-header) {
    align-items: flex-start;
  }

  /* ===== Play phase ===== */
  .play-pane {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
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

  .cta-btn i {
    font-size: 0.8em;
  }

  /* Play-phase pair: quiet "Keep building" beside the primary Build another. */
  .play-actions {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }

  .cta-btn.quiet {
    background: transparent;
    border-color: var(--theme-stroke, rgba(255, 255, 255, 0.16));
  }

  .cta-btn.quiet:hover {
    background: rgba(255, 255, 255, 0.07);
  }

  @media (max-width: 480px) {
    .picker-pane {
      height: clamp(320px, 56vh, 520px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .cta-btn {
      transition: none;
    }
  }
</style>
