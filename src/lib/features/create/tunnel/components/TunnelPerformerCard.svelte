<script lang="ts">
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import type { TunnelPerformer } from "$lib/shared/sequence-viewer/tunnel/tunnel-composition";
  import { copyOpsLabel } from "$lib/shared/sequence-viewer/tunnel/tunnel-composition";
  import StepGrid from "$lib/features/create/shared/workspace-panel/sequence-display/components/StepGrid.svelte";
  import WordLabel from "$lib/features/create/shared/workspace-panel/sequence-display/components/WordLabel.svelte";
  import type { TunnelSourceOrigin } from "../domain/tunnel-creator-draft";

  let {
    performer,
    displaySequence = null,
    stageTransformLabel = null,
    formationCopy = false,
    label,
    linked = false,
    expanded = false,
    selected = false,
    generatedInstanceCount = 0,
    sourcePerformerLabel = null,
    bluePropType,
    redPropType,
    stageColors = [],
    sourceOrigin = null,
    previousCount = 0,
    onChoose,
    onChooseShapeMatrix,
    onGenerateNow,
    onEditGeneration,
    onPrevious,
    onEditPairing,
    onSelect,
    onMoveUp,
    onMoveDown,
    onRemove,
    canMoveUp = false,
    canMoveDown = false,
    canRemove = false,
    removeBlockedReason = null,
  }: {
    performer: TunnelPerformer | null;
    displaySequence?: SequenceData | null;
    stageTransformLabel?: string | null;
    /** A reconstructed legacy arm: visible for performed-result inspection,
     * but absent from the authored composition until the user edits it. */
    formationCopy?: boolean;
    label: string;
    linked?: boolean;
    expanded?: boolean;
    selected?: boolean;
    generatedInstanceCount?: number;
    sourcePerformerLabel?: string | null;
    bluePropType?: PropType;
    redPropType?: PropType;
    stageColors?: Array<{ arm: number; left: string; right: string }>;
    sourceOrigin?: TunnelSourceOrigin | null;
    previousCount?: number;
    onChoose: () => void;
    onChooseShapeMatrix?: () => void;
    onGenerateNow?: () => void;
    onEditGeneration?: () => void;
    onPrevious?: () => void;
    onEditPairing?: () => void;
    onSelect?: () => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    onRemove?: () => void;
    canMoveUp?: boolean;
    canMoveDown?: boolean;
    canRemove?: boolean;
    removeBlockedReason?: string | null;
  } = $props();

  const ownSequence = $derived(
    performer?.source.kind === "independent" ? performer.source.sequence : null
  );
  const previewSequence = $derived(displaySequence ?? ownSequence);
  const displayWord = $derived(
    previewSequence
      ? simplifyRepeatedWord(
          previewSequence.displayName ??
            previewSequence.intendedWord ??
            previewSequence.word ??
            ""
        )
      : ""
  );
  const sourceLabel = $derived(
    performer?.source.kind === "derived"
      ? copyOpsLabel(performer.source.transforms)
      : null
  );
  const sourceDescriptor = $derived.by(() => {
    if (linked) return null;
    const provenance =
      performer?.source.kind === "independent"
        ? performer.source.provenance
        : null;
    if (provenance?.kind === "shape-matrix-realization") {
      return `Shape Matrix ${provenance.mode}`;
    }
    if (provenance?.kind === "library-sequence") {
      return provenance.scope === "personal"
        ? "Yours"
        : provenance.scope === "public"
          ? "Public"
          : "Library";
    }
    return sourceOrigin === "generated" ? "Generated" : null;
  });
  const primaryStageColors = $derived(stageColors[0] ?? null);

  let gridRef:
    | {
        prepareGenerationAnimation: (stepCount: number) => void;
        clearGenerationAnimation: () => void;
      }
    | undefined = $state();

  export function prepareGenerationAnimation(stepCount: number): void {
    gridRef?.prepareGenerationAnimation(stepCount);
  }

  export function clearGenerationAnimation(): void {
    gridRef?.clearGenerationAnimation();
  }
</script>

<section
  class="source-card"
  class:expanded
  class:selected
  aria-label={`${label} sequence`}
>
  <header class="source-heading">
    <button
      type="button"
      class="source-identity"
      aria-expanded={expanded}
      aria-pressed={selected}
      onclick={onSelect}
    >
      <div>
        <h3>{label}</h3>
        <p>
          {#if previewSequence}
            {previewSequence.steps.length} steps{#if sourceDescriptor}
              · {sourceDescriptor}
            {/if}{#if linked && sourceLabel}
              · Follows {sourcePerformerLabel ?? "earlier performer"} · {sourceLabel}
            {/if}{#if linked && stageTransformLabel}
              · On stage: {stageTransformLabel}
            {/if}
            {#if formationCopy}
              · Formation copy (not authored)
            {/if}
            {#if generatedInstanceCount > 0}
              · Drives {generatedInstanceCount} stage {generatedInstanceCount ===
              1
                ? "instance"
                : "instances"}
            {/if}
          {:else if linked}
            Follows {sourcePerformerLabel ?? "an earlier performer"}
          {:else}
            Complete two-prop sequence
          {/if}
        </p>
      </div>
      <span class="expand-indicator" aria-hidden="true">
        <i class={`fas ${expanded ? "fa-chevron-up" : "fa-chevron-down"}`}></i>
      </span>
    </button>

    <div
      class="hand-key"
      aria-label={primaryStageColors
        ? `${label} stage colors: Left ${primaryStageColors.left}, Right ${primaryStageColors.right}${stageColors.length > 1 ? `; ${stageColors.length} generated color pairs` : ""}`
        : `${label} hand identity: Left and Right`}
    >
      <span
        class="hand"
        style:--hand-color={primaryStageColors?.left ??
          "var(--prop-blue, #2e8bf0)"}><i aria-hidden="true"></i><b>L</b></span
      >
      <span
        class="hand"
        style:--hand-color={primaryStageColors?.right ??
          "var(--prop-red, #ed1c24)"}><i aria-hidden="true"></i><b>R</b></span
      >
      {#if stageColors.length > 1}
        <span
          class="pair-count"
          title={`${stageColors.length} stage instances use distinct spectrum pairs`}
          >×{stageColors.length}</span
        >
      {/if}
    </div>

    {#if expanded}
      <div class="source-actions" aria-label={`${label} source actions`}>
        {#if onEditPairing}
          <PanelButton
            variant="secondary"
            onclick={onEditPairing}
            ariaLabel={linked
              ? `${formationCopy ? "Author" : "Edit"} source relationship${sourceLabel ? `: ${sourceLabel}` : ""}`
              : `Link ${label} to an earlier performer`}
          >
            <i class="fas fa-link" aria-hidden="true"></i>
            <span class="action-label">{linked ? "Relationship" : "Link"}</span>
          </PanelButton>
        {/if}
        {#if previousCount > 0 && onPrevious}
          <PanelButton
            variant="secondary"
            onclick={onPrevious}
            ariaLabel={`Show the previous ${label} sequence`}
          >
            <i class="fas fa-clock-rotate-left" aria-hidden="true"></i>
            <span class="action-label">Previous</span>
          </PanelButton>
        {/if}
        {#if onGenerateNow}
          <PanelButton
            variant="primary"
            onclick={onGenerateNow}
            ariaLabel={`Generate a new ${label} sequence with the current settings`}
          >
            <i class="fas fa-dice" aria-hidden="true"></i>
            <span class="action-label">Generate</span>
          </PanelButton>
        {/if}
        {#if onEditGeneration}
          <PanelButton
            variant="secondary"
            onclick={onEditGeneration}
            ariaLabel={`Edit generation settings for ${label}`}
          >
            <i class="fas fa-sliders" aria-hidden="true"></i>
            <span class="action-label">Recipe</span>
          </PanelButton>
        {/if}
        <PanelButton
          variant="secondary"
          onclick={onChoose}
          ariaLabel={`Choose an existing sequence for ${label}`}
        >
          <i class="fas fa-folder-open" aria-hidden="true"></i>
          <span class="action-label">Browse</span>
        </PanelButton>
        {#if onChooseShapeMatrix}
          <PanelButton
            variant="secondary"
            onclick={onChooseShapeMatrix}
            ariaLabel={`Choose a Shape Matrix realization for ${label}`}
          >
            <i class="fas fa-shapes" aria-hidden="true"></i>
            <span class="action-label">Matrix</span>
          </PanelButton>
        {/if}
        <span class="action-spacer" aria-hidden="true"></span>
        <div class="roster-actions" aria-label={`${label} roster controls`}>
          <PanelButton
            variant="secondary"
            disabled={!canMoveUp}
            onclick={onMoveUp}
            ariaLabel={`Move ${label} earlier`}
          >
            <i class="fas fa-arrow-up" aria-hidden="true"></i>
          </PanelButton>
          <PanelButton
            variant="secondary"
            disabled={!canMoveDown}
            onclick={onMoveDown}
            ariaLabel={`Move ${label} later`}
          >
            <i class="fas fa-arrow-down" aria-hidden="true"></i>
          </PanelButton>
          {#if onRemove}
            <span title={removeBlockedReason ?? undefined}>
              <PanelButton
                variant="secondary"
                disabled={!canRemove}
                onclick={onRemove}
                ariaLabel={removeBlockedReason ?? `Remove ${label}`}
              >
                <i class="fas fa-user-minus" aria-hidden="true"></i>
              </PanelButton>
            </span>
          {/if}
        </div>
      </div>
    {/if}
  </header>

  <div class="workbench-stage">
    {#if displayWord}
      <div class="word-rail">
        <WordLabel word={displayWord} scrollMode={false} />
      </div>
    {/if}
    <div class="live-grid">
      <StepGrid
        bind:this={gridRef}
        steps={previewSequence?.steps ?? []}
        startPosition={previewSequence?.startPosition ??
          previewSequence?.startingPosition ??
          null}
        activeMode={null}
        isTimelineMode={false}
        fitAllSteps={true}
        narrowMaxColumns={3}
        preferWidthSizingOnNarrow={true}
        bluePropTypeOverride={bluePropType}
        redPropTypeOverride={redPropType}
        blueColorOverride={primaryStageColors?.left}
        redColorOverride={primaryStageColors?.right}
        sequenceWord={displayWord}
      />
    </div>

    {#if !previewSequence}
      <div class="source-empty">
        <i class="fas fa-book-open" aria-hidden="true"></i>
        <div>
          <strong
            >{linked
              ? `Waiting for ${sourcePerformerLabel ?? "source performer"}`
              : "Choose a sequence"}</strong
          >
          <span>
            {linked
              ? `${label} will resolve from ${sourcePerformerLabel ?? "its source"}.`
              : "Pick from your library or the community."}
          </span>
        </div>
      </div>
    {/if}
  </div>
</section>

<style>
  .source-card {
    container-type: inline-size;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    flex: 0 0 9.5rem;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--settings-radius-lg, 20px);
    background: var(--theme-panel-bg);
  }

  .source-card.expanded {
    flex-basis: clamp(22rem, 58cqh, 34rem);
    grid-template-rows: auto minmax(0, 1fr);
  }

  .source-card.selected {
    border-color: color-mix(in srgb, var(--theme-accent) 70%, white 10%);
    box-shadow: 0 0 0 1px
      color-mix(in srgb, var(--theme-accent) 35%, transparent);
  }

  .source-heading,
  .source-identity {
    display: flex;
    align-items: center;
  }

  .source-heading {
    flex-wrap: wrap;
    justify-content: space-between;
    gap: var(--settings-spacing-sm, 8px);
    min-height: 3.5rem;
    padding: var(--settings-spacing-sm, 8px) var(--settings-spacing-md, 14px);
    border-bottom: 1px solid var(--theme-stroke);
  }

  .source-identity {
    flex: 1 1 11rem;
    min-width: 0;
    min-height: var(--min-touch-target, 44px);
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  .source-identity:focus-visible {
    border-radius: var(--settings-radius-sm, 8px);
    outline: 2px solid var(--theme-accent);
    outline-offset: 3px;
  }

  .expand-indicator {
    display: grid;
    flex: 0 0 var(--min-touch-target, 44px);
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    place-items: center;
    color: var(--theme-text-dim);
  }

  .source-actions,
  .roster-actions,
  .hand-key {
    display: flex;
    align-items: center;
    gap: var(--settings-spacing-xs, 6px);
  }

  .source-actions {
    flex: 1 1 100%;
    flex-wrap: wrap;
  }

  .action-spacer {
    flex: 1 1 auto;
  }

  .roster-actions {
    flex: 0 0 auto;
  }

  .roster-actions :global(.panel-btn) {
    width: var(--min-touch-target, 44px);
    min-width: var(--min-touch-target, 44px);
    padding-inline: 0;
  }

  .hand-key {
    flex: 0 0 auto;
  }

  .hand {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 1.75rem;
    padding: 2px 7px;
    border: 1px solid var(--theme-stroke);
    border-radius: 999px;
    color: var(--theme-text-dim);
    background: var(--theme-card-bg);
    font-size: var(--font-size-compact, 12px);
    white-space: nowrap;
  }

  .hand i {
    width: 0.65rem;
    height: 0.65rem;
    border-radius: 50%;
    background: var(--hand-color);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--hand-color) 70%, white);
  }

  .hand b {
    color: var(--theme-text);
  }

  .pair-count {
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 12px);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .source-identity > div {
    min-width: 0;
  }

  h3,
  p {
    margin: 0;
  }

  h3 {
    color: var(--theme-text);
    font-size: var(--font-size-min, 14px);
    font-weight: 750;
  }

  p {
    overflow: hidden;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 12px);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .workbench-stage {
    position: relative;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background: color-mix(in srgb, var(--theme-card-bg) 72%, black);
  }

  .source-card:not(.expanded) .word-rail {
    display: none;
  }

  .source-card:not(.expanded) .live-grid {
    padding: 4px;
  }

  .source-card:not(.expanded) .source-empty {
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    align-content: center;
    justify-items: start;
    min-height: 0;
    padding: var(--settings-spacing-sm, 8px) var(--settings-spacing-md, 14px);
    text-align: left;
  }

  .source-card:not(.expanded) .source-empty > i {
    font-size: var(--font-size-min, 14px);
  }

  .source-card:not(.expanded) .source-empty span {
    display: none;
  }

  .word-rail {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    min-height: 2.75rem;
    padding: 4px var(--settings-spacing-md, 14px);
    border-bottom: 1px solid var(--theme-stroke);
  }

  .word-rail :global(.word-label) {
    width: 100%;
  }

  .live-grid {
    min-width: 0;
    min-height: 0;
    padding: var(--settings-spacing-xs, 6px);
    overflow: hidden;
  }

  .source-empty {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: grid;
    align-content: center;
    justify-items: center;
    gap: var(--settings-spacing-md, 14px);
    min-height: 11rem;
    padding: var(--settings-spacing-lg, 20px);
    color: var(--theme-text-dim);
    text-align: center;
    background: color-mix(in srgb, var(--theme-card-bg) 94%, black);
  }

  .source-empty > i {
    font-size: var(--font-size-2xl, 24px);
    opacity: 0.7;
  }

  .source-empty > div {
    display: grid;
    gap: 4px;
  }

  .source-empty strong,
  .source-empty span {
    display: block;
  }

  .source-empty strong {
    color: var(--theme-text);
    font-size: var(--font-size-min, 14px);
  }

  .source-empty span {
    color: var(--theme-text-dim);
    font-size: var(--font-size-min, 14px);
    line-height: 1.4;
  }

  @container (max-width: 22rem) {
    .source-heading {
      align-items: flex-start;
    }

    .source-heading :global(.panel-btn) {
      min-width: var(--min-touch-target, 44px);
      padding-inline: 12px;
    }

    .source-actions .action-label {
      display: none;
    }

    .hand {
      padding-inline: 6px;
    }

    .hand:not(b) {
      font-size: 0;
    }

    .hand b,
    .hand i {
      font-size: var(--font-size-compact, 12px);
    }
  }

  @container (max-width: 56rem) {
    .source-actions .action-label {
      display: none;
    }
  }
</style>
