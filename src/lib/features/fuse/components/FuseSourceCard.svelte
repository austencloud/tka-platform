<script lang="ts">
  import type { BrowseViewMode } from "$lib/shared/browse/domain/browse-view-mode";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import OverflowMenu from "$lib/shared/ui/components/OverflowMenu.svelte";
  import SequencePickerModal from "$lib/shared/components/sequence-picker/SequencePickerModal.svelte";
  import FuseVtgPathPicker from "./FuseVtgPathPicker.svelte";
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";
  import ChoreoCard from "$lib/shared/sequence-viewer/components/ChoreoCard.svelte";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import {
    createSequenceData,
    type SequenceData,
  } from "$lib/shared/foundation/domain/models/sequence-data";
  import {
    extractBlueSoloProp,
    extractRedSoloProp,
  } from "$lib/shared/foundation/services/sequence-decomposer";
  import { getFuseContext } from "../context/fuse-context";
  import { FUSE_TRANSFORMS } from "../state/fuse-state.svelte";
  import type { FuseSide } from "../state/fuse-shuffle-pool.svelte";

  let {
    side,
    full = false,
    compactHero = false,
    stepCols = 4,
  }: {
    side: FuseSide;
    // Big desktop only: render the complete choreo card — start position plus
    // the solo-colored mandala — instead of the lean steps-only view. Gated by
    // FuseLayout on cell size so the extra cells never shrink the pictographs.
    full?: boolean;
    /** Full-bleed current-step preview used by the phone workspace. */
    compactHero?: boolean;
    // Step column count FuseLayout picked to maximize pictograph size for the
    // current seam width and length. Only used in full (desktop) mode.
    stepCols?: number;
  } = $props();

  const { state: fuseState } = getFuseContext();
  const settings = getSettings();
  const source = $derived(side === "blue" ? fuseState.blue : fuseState.red);
  const label = $derived(side === "blue" ? "Blue" : "Red");
  const viewMode = $derived<BrowseViewMode>({
    subject: "props",
    granularity: "solo",
    color: side,
  });
  // The notation stage's live size. ChoreoCard's autoFit reads a landscape
  // stage as "one long row" — 8 tiny cells with dead space above and below.
  // Instead we measure the real stage and pick the column count that maximizes
  // pictograph size, the same optimization the desktop seam runs. (Full/desktop
  // keeps FuseLayout's seam-aware count and a start-position left column.)
  let stageEl = $state<HTMLDivElement | null>(null);
  let stageW = $state(0);
  let stageH = $state(0);
  const startLayout = $derived<"row" | "column" | null>(full ? "column" : null);
  const sourceControlsDisabled = $derived(
    fuseState.isLoadingLength ||
      fuseState.pendingSide !== null ||
      fuseState.isFusing
  );

  // Symmetry mode: the driver keeps its source + controls; the follower renders
  // the derived result (fuseState.symmetryPreview) read-only, so this card shows the
  // fused follower hand and hides Back/Shuffle/overflow while symmetry is on.
  const isSymmetryFollower = $derived(
    fuseState.mode === "symmetry" && side !== fuseState.driverSide
  );
  const displaySequence = $derived(
    isSymmetryFollower ? fuseState.symmetryPreview : source.sequence
  );
  const followerTransformLabel = $derived(
    FUSE_TRANSFORMS.find((transform) => transform.id === fuseState.transformId)
      ?.label ?? "Mirror"
  );
  const driverLabel = $derived(
    fuseState.driverSide === "blue" ? "Blue" : "Red"
  );

  // The playing beat, mapped to a 0-based step index, so the card cell for the
  // step currently on the animation canvas lights up in lockstep. The shared
  // Fuse clock is a continuous float; floor(step % length) is the same index
  // FuseAnimationPreview paints.
  const stepCount = $derived(displaySequence?.steps.length ?? 0);
  const highlightIndex = $derived(
    stepCount > 0
      ? Math.floor(
          ((fuseState.currentStep % stepCount) + stepCount) % stepCount
        )
      : null
  );

  // Full mode: FuseLayout hands down a seam-aware column count. Non-full: pick
  // the count that maximizes cell size for the measured stage — fewer columns
  // (more rows) when the stage is tall, more when it's wide — so the pictographs
  // fill the card instead of shrinking into one thin autoFit row.
  const STAGE_COL_CANDIDATES = [2, 4, 6, 8] as const;
  function bestStageCols(w: number, h: number, steps: number): number {
    if (w <= 0 || h <= 0 || steps <= 0) return Math.min(4, Math.max(1, steps));
    let best = Math.min(STAGE_COL_CANDIDATES[0], steps);
    let bestCell = -1;
    for (const cols of STAGE_COL_CANDIDATES) {
      if (cols > steps) continue;
      const rows = Math.ceil(steps / cols);
      const cell = Math.min(w / cols, h / rows);
      if (cell > bestCell) {
        bestCell = cell;
        best = cols;
      }
    }
    return best;
  }
  const stepColumns = $derived<number | null>(
    full ? stepCols : bestStageCols(stageW, stageH, stepCount)
  );

  // Phone cards keep one canonical pictograph renderer mounted and feed it the
  // playing step. This avoids ChoreoCard's heavy-content crossfade, preserves a
  // stable grid, and lets PropSvg/ArrowSvg animate their in-place changes.
  const compactStep = $derived(
    highlightIndex === null
      ? null
      : (displaySequence?.steps[highlightIndex] ?? null)
  );
  const compactStepLabel = $derived(
    highlightIndex === null ? "" : `${highlightIndex + 1} / ${stepCount}`
  );

  // Measure the notation stage so the non-full column choice tracks the real
  // card size (tablet side-by-side, portrait, etc.) rather than ChoreoCard's
  // aspect-only autoFit.
  $effect(() => {
    const el = stageEl;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const box = entry?.contentRect;
      if (box) {
        stageW = Math.round(box.width);
        stageH = Math.round(box.height);
      }
    });
    ro.observe(el);
    stageW = Math.round(el.clientWidth);
    stageH = Math.round(el.clientHeight);
    return () => ro.disconnect();
  });

  // The next candidate this side's Shuffle will land on, hydrated ahead of time
  // by the pool. Rendering it in a hidden card now bakes its pictographs into
  // the shared cell cache, so the visible swap on Shuffle is a cache hit instead
  // of a cold render. Same props as the live card => identical cache keys.
  const nextSequence = $derived(source.nextSequence);

  // Library source pick: open a sequence picker filtered to the current fused
  // length, then inject the chosen sequence's hand for this side. Gated with
  // {#if} so the browse engine only instantiates on open (two source cards).
  let pickerOpen = $state(false);

  function openLibraryPicker(): void {
    pickerOpen = true;
  }

  async function handleLibrarySelect(sequence: SequenceData): Promise<void> {
    // Extract just this side's hand from the picked two-hand sequence and wrap
    // it as a single-hand source carrying the side's soloProp; setSource fuses
    // it against the counterpart's current path and tiles it to the length.
    const solo =
      side === "blue"
        ? extractBlueSoloProp(sequence)
        : extractRedSoloProp(sequence);
    const wrapped = createSequenceData({
      id: sequence.id,
      word: sequence.word,
      name: sequence.name,
      ...(side === "blue" ? { blueSoloProp: solo } : { redSoloProp: solo }),
    });
    await fuseState.setSource(side, wrapped, {
      kind: "library",
      id: sequence.id,
      word: sequence.word,
      name: sequence.name,
    });
  }

  // VTG source pick: open the flower picker, then inject the chosen single-hand
  // solo path. buildFlowerSequence already returns this side's solo, so
  // setSource extracts it directly. Gated with {#if} so the shape-matrix load
  // only fires on open.
  let vtgOpen = $state(false);

  function openVtgPicker(): void {
    vtgOpen = true;
  }

  async function handleVtgSelect(
    sequence: SequenceData,
    label: string
  ): Promise<void> {
    await fuseState.setSource(side, sequence, { kind: "vtg", label });
  }

  const sourceMenuItems = $derived([
    {
      label: "Pick from library",
      icon: "fas fa-book",
      action: openLibraryPicker,
    },
    {
      label: "Pick a VTG path",
      icon: "fas fa-fan",
      action: openVtgPicker,
    },
  ]);
  const compactSourceMenuItems = $derived([
    ...(source.canGoBack
      ? [
          {
            label: "Previous path",
            icon: "fas fa-arrow-rotate-left",
            action: () => fuseState.previous(side),
          },
        ]
      : []),
    ...sourceMenuItems,
  ]);
</script>

<section
  class="source-card {side}-source"
  class:loading={source.isLoading}
  class:compact-hero={compactHero}
  aria-label="{label} path"
  aria-busy={source.isLoading}
>
  <div class="notation-stage" bind:this={stageEl}>
    {#if compactHero && compactStep}
      <div
        class="compact-live-pictograph"
        class:playing={fuseState.clockRunning}
        style:--fuse-beat-duration={`${60_000 / fuseState.bpm}ms`}
      >
        <PictographContainer
          pictographData={compactStep}
          disableTransitions={true}
          showGrid={true}
          showTKA={false}
          showReversals={false}
          showNonRadialPoints={false}
          showTnD={false}
          showElemental={false}
          showPositions={false}
          showHandPoints={true}
          visibleHand={side}
          darkMode={true}
          bluePropTypeOverride={settings.bluePropType}
          redPropTypeOverride={settings.redPropType}
          stepNumberOverride={false}
        />
      </div>
    {:else if displaySequence}
      <div class="notation-scroll themed-scrollbar">
        <ChoreoCard
          sequence={displaySequence}
          browseViewMode={viewMode}
          columnCount={stepColumns}
          startPositionLayoutOverride={startLayout}
          includeStartPosition={full}
          showMandala={full}
          showWord={false}
          showStepNumbers={true}
          showDifficultyLevel={false}
          showCreatorName={false}
          showNotes={false}
          showBirthday={false}
          showLoopGlyph={false}
          showHighlight={true}
          highlightedStepIndex={highlightIndex}
          darkMode={true}
          bluePropType={settings.bluePropType}
          redPropType={settings.redPropType}
          hideSoloHeader={true}
          fitWidth={true}
        />
      </div>
    {:else if source.isLoading || isSymmetryFollower}
      <div class="notation-skeleton" aria-hidden="true"></div>
    {:else}
      <p class="notation-empty">No notation to show.</p>
    {/if}

    {#if compactHero && displaySequence}
      <span class="compact-step-position" aria-hidden="true">
        {compactStepLabel}
      </span>
    {/if}

    {#if source.isLoading && displaySequence && !isSymmetryFollower}
      <div class="notation-loading" aria-hidden="true">
        <i class="fas fa-shuffle fa-spin"></i>
      </div>
    {/if}
  </div>

  {#if compactHero}
    {#if isSymmetryFollower}
      <span
        class="compact-derived-indicator"
        title="{followerTransformLabel} of {driverLabel}"
        aria-label="{followerTransformLabel} of {driverLabel}"
      >
        <i class="fas fa-link" aria-hidden="true"></i>
      </span>
    {:else}
      <div class="compact-source-menu">
        <OverflowMenu
          items={compactSourceMenuItems}
          disabled={sourceControlsDisabled}
          ariaLabel="{label} path options"
          placement="bottom"
        />
      </div>
    {/if}
  {/if}

  {#if isSymmetryFollower && !compactHero}
    <div class="follower-note" role="status">
      <i class="fas fa-link" aria-hidden="true"></i>
      <span>{followerTransformLabel} of {driverLabel}</span>
    </div>
  {:else if !compactHero}
    <div class="source-actions">
      <PanelButton
        variant="secondary"
        fullWidth={true}
        disabled={sourceControlsDisabled || !source.canGoBack}
        onclick={() => fuseState.previous(side)}
      >
        <i class="fas fa-arrow-rotate-left" aria-hidden="true"></i>
        Back
      </PanelButton>
      <div class="shuffle-slot">
        <PanelButton
          variant="secondary"
          fullWidth={true}
          disabled={sourceControlsDisabled || !source.sequence}
          onclick={() => void fuseState.shuffle(side)}
        >
          <i class="fas fa-shuffle" aria-hidden="true"></i>
          Shuffle
        </PanelButton>
      </div>
      <div class="source-menu">
        <OverflowMenu
          items={sourceMenuItems}
          disabled={sourceControlsDisabled}
        />
      </div>
    </div>
  {/if}

  {#if source.revision > 1}
    {#key source.revision}
      <span class="change-flash" aria-hidden="true"></span>
    {/key}
  {/if}
</section>

{#if nextSequence && !isSymmetryFollower}
  {#key nextSequence}
    <div class="prewarm" aria-hidden="true">
      <ChoreoCard
        sequence={nextSequence}
        browseViewMode={viewMode}
        columnCount={stepColumns}
        startPositionLayoutOverride={startLayout}
        includeStartPosition={full}
        showMandala={full}
        showWord={false}
        showStepNumbers={true}
        showDifficultyLevel={false}
        showCreatorName={false}
        showNotes={false}
        showBirthday={false}
        showLoopGlyph={false}
        darkMode={true}
        bluePropType={settings.bluePropType}
        redPropType={settings.redPropType}
        hideSoloHeader={true}
        fitWidth={true}
      />
    </div>
  {/key}
{/if}

{#if pickerOpen}
  <SequencePickerModal
    open
    title="Pick a {label} path"
    requiredBeatCount={fuseState.appliedLength}
    onSelect={handleLibrarySelect}
    onClose={() => (pickerOpen = false)}
  />
{/if}

{#if vtgOpen}
  <FuseVtgPathPicker
    {side}
    onSelect={handleVtgSelect}
    onClose={() => (vtgOpen = false)}
  />
{/if}

<style>
  .source-card {
    --source-color: var(--prop-blue, #2196f3);
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-sm, 10px);
    min-width: 0;
    padding: var(--settings-spacing-md, 16px);
    overflow: hidden;
    border: 1px solid
      color-mix(in srgb, var(--source-color) 32%, var(--theme-stroke));
    border-radius: var(--settings-radius-lg, 20px);
    background:
      linear-gradient(
        145deg,
        color-mix(in srgb, var(--source-color) 8%, transparent),
        transparent 42%
      ),
      var(--theme-card-bg, rgba(255, 255, 255, 0.045));
  }

  .blue-source {
    grid-area: blue;
  }

  .red-source {
    --source-color: var(--prop-red, #f44336);
    grid-area: red;
  }

  .source-card.loading {
    border-style: dashed;
  }

  .notation-empty {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
    min-height: 150px;
    padding: 18px;
    margin: 0;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.58));
    font-size: var(--font-size-min, 14px);
    text-align: center;
  }

  .notation-skeleton {
    background: color-mix(in srgb, var(--theme-text, white) 8%, transparent);
    animation: loading-pulse 1.4s ease-in-out infinite;
  }

  .notation-stage {
    position: relative;
    isolation: isolate;
    flex: 1 1 180px;
    min-height: 150px;
    overflow: hidden;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--settings-radius-md, 14px);
    background: color-mix(in srgb, var(--theme-panel-bg) 84%, black);
  }

  .notation-scroll {
    position: relative;
    z-index: 0;
    width: 100%;
    height: 100%;
    overflow: auto;
  }

  .compact-live-pictograph {
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  /* The notation itself never disappears between beats. A restrained light
     pass makes the live arrow read as active while its canonical renderer
     updates position and rotation in place. */
  .compact-live-pictograph.playing :global(.arrow-svg) {
    animation: live-arrow-energy var(--fuse-beat-duration, 1000ms) ease-in-out
      infinite;
  }

  @keyframes live-arrow-energy {
    0%,
    100% {
      filter: brightness(1) drop-shadow(0 0 0 transparent);
    }
    48% {
      filter: brightness(1.28)
        drop-shadow(
          0 0 7px color-mix(in srgb, var(--source-color) 62%, transparent)
        );
    }
  }

  .compact-step-position {
    position: absolute;
    z-index: 2;
    bottom: 7px;
    left: 7px;
    min-width: 7ch;
    padding: 4px 6px;
    border-radius: 999px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.72));
    background: rgba(0, 0, 0, 0.76);
    font-size: var(--font-size-min, 14px);
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    white-space: nowrap;
  }

  .compact-source-menu,
  .compact-derived-indicator {
    position: absolute;
    z-index: 4;
    top: 14px;
    right: 14px;
  }

  .compact-derived-indicator {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border: 1px solid
      color-mix(in srgb, var(--source-color) 62%, var(--theme-stroke));
    border-radius: 50%;
    color: color-mix(in srgb, var(--source-color) 70%, white);
    background: color-mix(
      in srgb,
      var(--source-color) 17%,
      rgba(0, 0, 0, 0.76)
    );
    font-size: var(--font-size-min, 14px);
  }

  .notation-skeleton {
    width: 100%;
    height: 100%;
  }

  /* Instant response to Shuffle: the old card stays put while the next path
     loads, with a colored spinner over it so the tap registers immediately. */
  .notation-loading {
    position: absolute;
    z-index: 3;
    top: 8px;
    right: 8px;
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    color: color-mix(in srgb, var(--source-color) 85%, white);
    background: color-mix(in srgb, var(--theme-panel-bg) 70%, transparent);
    backdrop-filter: blur(2px);
    font-size: 14px;
  }

  .source-actions {
    display: grid;
    grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr) auto;
    gap: var(--settings-spacing-sm, 8px);
    margin-top: auto;
  }

  /* Read-only footer for the derived follower in symmetry mode. Occupies the
     same slot the action row would, at the touch-target height, so swapping in
     and out of symmetry doesn't resize the card. */
  .follower-note {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: var(--min-touch-target, 44px);
    margin-top: auto;
    padding: 0 12px;
    border: 1px dashed
      color-mix(in srgb, var(--source-color) 40%, var(--theme-stroke));
    border-radius: var(--settings-radius-md, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    font-size: var(--font-size-compact, 0.8rem);
    font-weight: 600;
  }

  .follower-note i {
    color: color-mix(in srgb, var(--source-color) 80%, white);
  }

  /* The overflow menu anchors its dropdown to itself and opens upward, so it
     stays inside the card even though the card clips overflow. */
  .source-menu {
    display: flex;
    align-items: stretch;
  }

  /* Shuffle is the primary action, tinted in the path's color; the word "Blue"
     / "Red" is redundant with the tint, so the label is just "Shuffle". */
  .shuffle-slot :global(.panel-btn) {
    border-color: color-mix(in srgb, var(--source-color) 78%, transparent);
    background: color-mix(
      in srgb,
      var(--source-color) 34%,
      var(--theme-card-bg, #161821)
    );
    color: var(--theme-text, #fff);
    font-weight: 600;
  }

  .shuffle-slot :global(.panel-btn:focus-visible) {
    outline: 2px solid var(--source-color);
    outline-offset: 2px;
  }

  /* Hidden pre-render of the next Shuffle candidate — off-screen, no hit
     testing, fixed size so the cells actually rasterize into the cache. */
  .prewarm {
    position: absolute;
    left: -10000px;
    top: 0;
    width: 240px;
    height: 300px;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
  }

  .change-flash {
    position: absolute;
    inset: 2px;
    pointer-events: none;
    border: 2px solid color-mix(in srgb, var(--source-color) 72%, white);
    border-radius: calc(var(--settings-radius-lg, 20px) - 2px);
    animation: source-change 240ms ease-out both;
  }

  @keyframes source-change {
    0% {
      opacity: 0;
      transform: scale(0.99);
    }
    35% {
      opacity: 0.85;
    }
    100% {
      opacity: 0;
      transform: scale(1);
    }
  }

  @keyframes loading-pulse {
    0%,
    100% {
      opacity: 0.45;
    }
    50% {
      opacity: 0.9;
    }
  }

  @media (hover: hover) and (pointer: fine) {
    .shuffle-slot :global(.panel-btn:hover:not(:disabled)) {
      background: color-mix(
        in srgb,
        var(--source-color) 46%,
        var(--theme-card-bg, #161821)
      );
    }
  }

  @container fuse (max-width: 599px) {
    .source-card {
      padding: 14px;
      gap: 10px;
    }

    .source-actions {
      margin-top: 0;
    }

    .source-card.compact-hero {
      height: 100%;
      min-height: 0;
      gap: 0;
      padding: 7px;
      overflow: visible;
      border-color: color-mix(
        in srgb,
        var(--source-color) 52%,
        var(--theme-stroke, transparent)
      );
      border-radius: var(--settings-radius-md, 14px);
      box-shadow: inset 0 3px 0
        color-mix(in srgb, var(--source-color) 72%, transparent);
      background:
        linear-gradient(
          145deg,
          color-mix(in srgb, var(--source-color) 13%, transparent),
          transparent 50%
        ),
        var(--theme-card-bg, rgba(255, 255, 255, 0.045));
    }

    .compact-hero .notation-stage {
      flex: 1 1 0;
      min-height: 0;
      border-color: color-mix(
        in srgb,
        var(--source-color) 24%,
        var(--theme-stroke, transparent)
      );
      border-radius: calc(var(--settings-radius-md, 14px) - 3px);
    }

    .compact-hero .notation-scroll {
      overflow: hidden;
    }

    .compact-hero .notation-loading {
      top: 50%;
      right: auto;
      left: 50%;
      transform: translate(-50%, -50%);
    }

    .compact-hero :global(.overflow-trigger) {
      width: var(--min-touch-target, 44px);
      height: var(--min-touch-target, 44px);
      border-color: color-mix(
        in srgb,
        var(--source-color) 38%,
        var(--theme-stroke, transparent)
      );
      background: color-mix(
        in srgb,
        var(--source-color) 12%,
        var(--theme-card-bg, #161821)
      );
    }

    .compact-hero :global(.overflow-dropdown) {
      min-width: 160px;
    }
  }

  /* One-page fit layouts only (mirrors FuseLayout's fr-row conditions).
     min-height: 0 lets the card shrink inside its fr row; anywhere else it
     zeroes the card's minimum contribution and collapses the auto grid rows.
     The notation stage gives up its tall floor and scrolls internally. */
  @container fuse (min-width: 600px) and (min-height: 600px) {
    .source-card {
      min-height: 0;
    }

    .notation-stage {
      min-height: 64px;
    }
  }

  @container fuse (min-width: 1100px) {
    .source-card {
      padding: clamp(14px, 1.4cqw, 22px);
    }
  }

  /* Locked desktop columns get their taller notation floor back. */
  @container fuse (min-width: 1100px) and (min-height: 780px) {
    .notation-stage {
      min-height: 120px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .notation-skeleton,
    .change-flash,
    .notation-loading .fa-spin,
    .compact-live-pictograph.playing :global(.arrow-svg) {
      animation: none;
    }
  }
</style>
