<script lang="ts">
  import type { BrowseViewMode } from "$lib/shared/browse/domain/browse-view-mode";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import OverflowMenu from "$lib/shared/ui/components/OverflowMenu.svelte";
  import SequencePickerModal from "$lib/shared/components/sequence-picker/SequencePickerModal.svelte";
  import FuseVtgPathPicker from "./FuseVtgPathPicker.svelte";
  import { getSettings } from "$lib/shared/application/state/app-state.svelte";
  import ChoreoCard from "$lib/shared/sequence-viewer/components/ChoreoCard.svelte";
  import {
    createSequenceData,
    type SequenceData,
  } from "$lib/shared/foundation/domain/models/sequence-data";
  import {
    extractBlueSoloProp,
    extractRedSoloProp,
  } from "$lib/shared/foundation/services/sequence-decomposer";
  import { getFuseContext } from "../context/fuse-context";
  import type { FuseSide } from "../state/fuse-shuffle-pool.svelte";

  let {
    side,
    showInlineNotation,
    full = false,
    stepCols = 4,
    onViewNotation,
  }: {
    side: FuseSide;
    showInlineNotation: boolean;
    // Big desktop only: render the complete choreo card — start position plus
    // the solo-colored mandala — instead of the lean steps-only view. Gated by
    // FuseLayout on cell size so the extra cells never shrink the pictographs.
    full?: boolean;
    // Step column count FuseLayout picked to maximize pictograph size for the
    // current seam width and length. Only used in full (desktop) mode.
    stepCols?: number;
    onViewNotation: (side: FuseSide) => void;
  } = $props();

  const { state } = getFuseContext();
  const settings = getSettings();
  const source = $derived(side === "blue" ? state.blue : state.red);
  const label = $derived(side === "blue" ? "Blue" : "Red");
  const viewMode = $derived<BrowseViewMode>({
    subject: "props",
    granularity: "solo",
    color: side,
  });
  // Full desktop card: the notation stage is landscape, and autoFit reads that
  // as "one long row" — 8 tiny cells with dead space below. Pin 4 step columns
  // with the start position as a left column instead: fewer, bigger pictographs
  // that fill the tall stage. Compact keeps auto (null).
  const stepColumns = $derived<number | null>(full ? stepCols : null);
  const startLayout = $derived<"row" | "column" | null>(full ? "column" : null);
  const viewDisabled = $derived(source.isLoading || state.isFusing);
  const sourceControlsDisabled = $derived(
    state.isLoadingLength || state.pendingSide !== null || state.isFusing
  );

  // The playing beat, mapped to a 0-based step index, so the card cell for the
  // step currently on the animation canvas lights up in lockstep. The shared
  // Fuse clock is a continuous float; floor(step % length) is the same index
  // FuseAnimationPreview paints.
  const stepCount = $derived(source.sequence?.steps.length ?? 0);
  const highlightIndex = $derived(
    stepCount > 0
      ? Math.floor(((state.currentStep % stepCount) + stepCount) % stepCount)
      : null
  );

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
      ...(side === "blue"
        ? { blueSoloProp: solo }
        : { redSoloProp: solo }),
    });
    await state.setSource(side, wrapped, {
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
    await state.setSource(side, sequence, { kind: "vtg", label });
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
</script>

<section
  class="source-card {side}-source"
  class:loading={source.isLoading}
  aria-label="{label} path"
  aria-busy={source.isLoading}
>
  {#if showInlineNotation}
    <div class="notation-stage">
      {#if source.sequence}
        <div class="notation-scroll themed-scrollbar">
          <ChoreoCard
            sequence={source.sequence}
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
      {:else if source.isLoading}
        <div class="notation-skeleton" aria-hidden="true"></div>
      {:else}
        <p class="notation-empty">No notation to show.</p>
      {/if}

      {#if source.isLoading && source.sequence}
        <div class="notation-loading" aria-hidden="true">
          <i class="fas fa-shuffle fa-spin"></i>
        </div>
      {/if}
    </div>
  {:else}
    <div class="notation-reserve" aria-hidden="true"></div>
    {#if source.sequence}
      <div class="notation-button">
        <PanelButton
          variant="secondary"
          fullWidth={true}
          disabled={viewDisabled}
          onclick={() => onViewNotation(side)}
        >
          <i class="fas fa-table-cells" aria-hidden="true"></i>
          View notation
        </PanelButton>
      </div>
    {/if}
  {/if}

  <div class="source-actions">
    <PanelButton
      variant="secondary"
      fullWidth={true}
      disabled={sourceControlsDisabled || !source.canGoBack}
      onclick={() => state.previous(side)}
    >
      <i class="fas fa-arrow-rotate-left" aria-hidden="true"></i>
      Back
    </PanelButton>
    <div class="shuffle-slot">
      <PanelButton
        variant="secondary"
        fullWidth={true}
        disabled={sourceControlsDisabled || !source.sequence}
        onclick={() => void state.shuffle(side)}
      >
        <i class="fas fa-shuffle" aria-hidden="true"></i>
        Shuffle
      </PanelButton>
    </div>
    <div class="source-menu">
      <OverflowMenu items={sourceMenuItems} />
    </div>
  </div>

  {#if source.revision > 1}
    {#key source.revision}
      <span class="change-flash" aria-hidden="true"></span>
    {/key}
  {/if}
</section>

{#if showInlineNotation && nextSequence}
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
    requiredBeatCount={state.appliedLength}
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
    flex: 1 1 180px;
    min-height: 150px;
    overflow: hidden;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--settings-radius-md, 14px);
    background: color-mix(in srgb, var(--theme-panel-bg) 84%, black);
  }

  .notation-scroll {
    width: 100%;
    height: 100%;
    overflow: auto;
  }

  .notation-skeleton {
    width: 100%;
    height: 100%;
  }

  /* Instant response to Shuffle: the old card stays put while the next path
     loads, with a colored spinner over it so the tap registers immediately. */
  .notation-loading {
    position: absolute;
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

  .notation-button {
    min-height: var(--min-touch-target, 44px);
  }

  .notation-reserve {
    display: none;
  }

  .source-actions {
    display: grid;
    grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr) auto;
    gap: var(--settings-spacing-sm, 8px);
    margin-top: auto;
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
  }

  @container fuse (min-width: 600px) {
    .notation-button {
      display: none;
    }

    .notation-reserve {
      display: block;
      flex: 1 1 180px;
      min-height: 150px;
      border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
      border-radius: var(--settings-radius-md, 14px);
      background: color-mix(in srgb, var(--theme-text, white) 4%, transparent);
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

    .notation-stage,
    .notation-reserve {
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
    .notation-stage,
    .notation-reserve {
      min-height: 120px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .notation-skeleton,
    .change-flash,
    .notation-loading .fa-spin {
      animation: none;
    }
  }
</style>
