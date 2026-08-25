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
    label,
    linked = false,
    disabled = false,
    bluePropType,
    redPropType,
    sourceOrigin = null,
    previousCount = 0,
    onChoose,
    onGenerateNow,
    onEditGeneration,
    onPrevious,
    onEditPairing,
  }: {
    performer: TunnelPerformer | null;
    displaySequence?: SequenceData | null;
    label: string;
    linked?: boolean;
    disabled?: boolean;
    bluePropType?: PropType;
    redPropType?: PropType;
    sourceOrigin?: TunnelSourceOrigin | null;
    previousCount?: number;
    onChoose: () => void;
    onGenerateNow?: () => void;
    onEditGeneration?: () => void;
    onPrevious?: () => void;
    onEditPairing?: () => void;
  } = $props();

  const ownSequence = $derived(
    performer?.source.kind === "independent" ? performer.source.sequence : null
  );
  const previewSequence = $derived(ownSequence ?? displaySequence);
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

<section class="source-card" aria-label={`${label} sequence`}>
  <header class="source-heading">
    <div class="source-identity">
      <div>
        <h3>{label}</h3>
        <p>
          {#if previewSequence}
            {previewSequence.steps.length} steps{#if sourceOrigin === "generated"}
              · Generated
            {/if}{#if linked && sourceLabel}
              · {sourceLabel}
            {/if}
          {:else if linked}
            Follows the Performer 1 sequence
          {:else}
            Complete two-prop sequence
          {/if}
        </p>
      </div>
    </div>

    {#if linked && sourceLabel && onEditPairing}
      <PanelButton
        variant="secondary"
        onclick={onEditPairing}
        ariaLabel={`Edit pairing: ${sourceLabel}`}
      >
        <i class="fas fa-link" aria-hidden="true"></i>
        Edit pairing
        <i class="fas fa-pen-to-square" aria-hidden="true"></i>
      </PanelButton>
    {:else if !linked && ownSequence}
      <div class="source-actions" aria-label={`${label} source actions`}>
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
            <span class="action-label">Generation settings</span>
          </PanelButton>
        {/if}
        <PanelButton
          variant="secondary"
          onclick={onChoose}
          ariaLabel={`Choose an existing sequence for ${label}`}
        >
          <i class="fas fa-folder-open" aria-hidden="true"></i>
          <span class="action-label">Choose</span>
        </PanelButton>
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
        sequenceWord={displayWord}
      />
    </div>

    {#if !previewSequence}
      <div class="source-empty">
        <i class="fas fa-book-open" aria-hidden="true"></i>
        <div>
          <strong
            >{linked ? "Waiting for Performer 1" : "Choose a sequence"}</strong
          >
          <span>
            {linked
              ? "Performer 2 will use the same complete sequence."
              : "Pick from your library or the community."}
          </span>
        </div>
        {#if !linked}
          <div class="empty-actions">
            <PanelButton variant="secondary" {disabled} onclick={onChoose}>
              <i class="fas fa-folder-open" aria-hidden="true"></i>
              Choose existing
            </PanelButton>
            {#if onGenerateNow}
              <PanelButton variant="primary" {disabled} onclick={onGenerateNow}>
                <i class="fas fa-dice" aria-hidden="true"></i>
                Generate
              </PanelButton>
            {/if}
            {#if onEditGeneration}
              <PanelButton
                variant="secondary"
                {disabled}
                onclick={onEditGeneration}
              >
                <i class="fas fa-sliders" aria-hidden="true"></i>
                Generation settings
              </PanelButton>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</section>

<style>
  .source-card {
    container-type: inline-size;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--settings-radius-lg, 20px);
    background: var(--theme-panel-bg);
  }

  .source-heading,
  .source-identity {
    display: flex;
    align-items: center;
  }

  .source-heading {
    justify-content: space-between;
    gap: var(--settings-spacing-sm, 8px);
    min-height: 3.5rem;
    padding: var(--settings-spacing-sm, 8px) var(--settings-spacing-md, 14px);
    border-bottom: 1px solid var(--theme-stroke);
  }

  .source-identity {
    min-width: 0;
  }

  .source-actions,
  .empty-actions {
    display: flex;
    align-items: center;
    gap: var(--settings-spacing-xs, 6px);
  }

  .source-actions {
    flex: 0 0 auto;
  }

  .empty-actions {
    flex-wrap: wrap;
    justify-content: center;
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
  }

  @container (max-width: 46rem) {
    .source-actions .action-label {
      display: none;
    }
  }
</style>