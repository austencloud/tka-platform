<script lang="ts">
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { getBaseMotionColors } from "$lib/shared/animation-engine/services/svg-generator";
  import {
    tunnelPropColor,
    type TunnelPropColorMode,
    type TunnelPropColorPair,
  } from "$lib/shared/sequence-viewer/tunnel/tunnel-prop-colors";
  import { getTunnelCreatorContext } from "../context/tunnel-creator-context";
  import TunnelPerformerCard from "./TunnelPerformerCard.svelte";

  interface TunnelPerformerDisplay {
    sequence: SequenceData | null;
    stageTransformLabel: string | null;
    generatedInstanceCount: number;
    stageArms: number[];
  }

  interface CardRef {
    prepareGenerationAnimation: (stepCount: number) => void;
    clearGenerationAnimation: () => void;
  }

  let {
    displays,
    leftPropType,
    rightPropType,
    colorMode,
    customPropColors,
    renderedInstanceCount,
    onChoose,
    onChooseShapeMatrix,
    onGenerateNow,
    onEditGeneration,
    onEditRelationship,
    onSelectPerformer,
  }: {
    displays: Record<string, TunnelPerformerDisplay>;
    leftPropType: PropType;
    rightPropType: PropType;
    colorMode: TunnelPropColorMode;
    customPropColors: TunnelPropColorPair;
    renderedInstanceCount: number;
    onChoose: (performerId: string) => void;
    onChooseShapeMatrix: (performerId: string) => void;
    onGenerateNow: (performerId: string) => void;
    onEditGeneration: (performerId: string) => void;
    onEditRelationship: (performerId: string) => void;
    onSelectPerformer: (performerId: string | null) => void;
  } = $props();

  const creator = getTunnelCreatorContext();
  const baseMotionColors = getBaseMotionColors();
  let cardRefs = $state<Record<string, CardRef | undefined>>({});

  function sourceLabel(performerId: string): string | null {
    const performer = creator.performerSlots.find(
      (slot) => slot.id === performerId
    )?.performer;
    if (performer?.source.kind !== "derived") return null;
    const sourcePerformerId = performer.source.performerId;
    return (
      creator.performerSlots.find((slot) => slot.id === sourcePerformerId)
        ?.label ?? "an earlier performer"
    );
  }

  function select(performerId: string): void {
    creator.selectPerformer(performerId);
    onSelectPerformer(creator.selectedPerformerId);
  }

  function add(): void {
    const performerId = creator.addPerformer();
    if (!performerId) return;
    onSelectPerformer(performerId);
  }

  function removeReason(performerId: string): string | null {
    if (creator.performerSlots.length <= 1) {
      return "A tunnel needs at least one performer card.";
    }
    const dependants = creator.dependantLabels(performerId);
    if (dependants.length > 0) {
      return `Reassign ${dependants.join(", ")} before removing this source.`;
    }
    return null;
  }

  function stageColorPairs(performerId: string): Array<{
    arm: number;
    left: string;
    right: string;
  }> {
    const arms = displays[performerId]?.stageArms ?? [];
    const layerCount = Math.max(0, renderedInstanceCount - 1);
    return arms.map((arm) => ({
      arm,
      left:
        colorMode === "custom"
          ? customPropColors.left
          : colorMode !== "spectrum" || arm === 0
            ? baseMotionColors.left
            : tunnelPropColor(arm * 2, layerCount).hex,
      right:
        colorMode === "custom"
          ? customPropColors.right
          : colorMode !== "spectrum" || arm === 0
            ? baseMotionColors.right
            : tunnelPropColor(arm * 2 + 1, layerCount).hex,
    }));
  }

  export function prepareGenerationAnimation(
    performerId: string,
    stepCount: number
  ): void {
    cardRefs[performerId]?.prepareGenerationAnimation(stepCount);
  }

  export function clearGenerationAnimation(performerId: string): void {
    cardRefs[performerId]?.clearGenerationAnimation();
  }
</script>

<section
  class="performer-roster"
  class:few-cards={creator.performerSlots.length <= 2}
  aria-labelledby="performer-roster-title"
>
  <header class="roster-heading">
    <div>
      <span>Authored choreography</span>
      <h3 id="performer-roster-title">
        {creator.authoredPerformerCount} authored · {creator.performerSlots
          .length}
        {creator.performerSlots.length === 1 ? " card" : " cards"}
      </h3>
    </div>
  </header>

  <div class="roster-scroll themed-scrollbar">
    {#each creator.performerSlots as slot, index (slot.id)}
      {@const linked = slot.performer?.source.kind === "derived"}
      {@const display = displays[slot.id]}
      {@const removeBlockedReason = removeReason(slot.id)}
      <TunnelPerformerCard
        bind:this={cardRefs[slot.id]}
        performer={slot.performer}
        displaySequence={display?.sequence ?? null}
        stageTransformLabel={display?.stageTransformLabel ?? null}
        generatedInstanceCount={display?.generatedInstanceCount ?? 0}
        formationCopy={index === 1 && creator.partnerIsFormationCopy}
        label={slot.label}
        {linked}
        sourcePerformerLabel={sourceLabel(slot.id)}
        selected={creator.selectedPerformerId === slot.id}
        expanded={creator.performerSlots.length <= 2 ||
          creator.selectedPerformerId === slot.id}
        sourceOrigin={slot.origin}
        previousCount={slot.previousCount}
        {leftPropType}
        {rightPropType}
        stageColors={stageColorPairs(slot.id)}
        canMoveUp={creator.canMovePerformer(slot.id, -1)}
        canMoveDown={creator.canMovePerformer(slot.id, 1)}
        canRemove={creator.canRemovePerformer(slot.id)}
        {removeBlockedReason}
        onSelect={() => select(slot.id)}
        onChoose={() => onChoose(slot.id)}
        onChooseShapeMatrix={() => onChooseShapeMatrix(slot.id)}
        onGenerateNow={() => onGenerateNow(slot.id)}
        onEditGeneration={() => onEditGeneration(slot.id)}
        onPrevious={() => creator.restorePreviousSequence(slot.id)}
        onEditPairing={index > 0
          ? () => onEditRelationship(slot.id)
          : undefined}
        onMoveUp={() => creator.movePerformer(slot.id, -1)}
        onMoveDown={() => creator.movePerformer(slot.id, 1)}
        onRemove={() => {
          if (creator.removePerformer(slot.id)) {
            onSelectPerformer(creator.selectedPerformerId);
          }
        }}
      />
    {/each}
  </div>

  <footer class="roster-footer">
    <PanelButton
      variant="secondary"
      disabled={!creator.canAddPerformer}
      onclick={add}
      ariaLabel={creator.addPerformerBlockedReason ??
        "Add another authored performer"}
    >
      <i class="fas fa-user-plus" aria-hidden="true"></i>
      Add performer
      <span
        >{creator.performerSlots.length}{creator.performerSlots.length > 4
          ? " preserved"
          : "/4"}</span
      >
    </PanelButton>
    {#if creator.addPerformerBlockedReason}
      <p role="status">{creator.addPerformerBlockedReason}</p>
    {/if}
  </footer>
</section>

<style>
  .performer-roster {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--settings-radius-lg, 20px);
    background: var(--theme-panel-bg);
  }

  .roster-heading,
  .roster-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--settings-spacing-sm, 8px);
    padding: var(--settings-spacing-sm, 8px) var(--settings-spacing-md, 14px);
    background: var(--theme-card-bg);
  }

  .roster-heading {
    border-bottom: 1px solid var(--theme-stroke);
  }

  .roster-heading > div:first-child {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .roster-heading span,
  .roster-footer p {
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 12px);
  }

  h3,
  p {
    margin: 0;
  }

  h3 {
    color: var(--theme-text);
    font-size: var(--font-size-min, 14px);
  }

  .roster-scroll {
    display: flex;
    flex-direction: column;
    gap: var(--settings-spacing-sm, 8px);
    min-width: 0;
    min-height: 0;
    padding: var(--settings-spacing-sm, 8px);
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .performer-roster.few-cards .roster-scroll :global(.source-card.expanded) {
    flex: 1 1 0;
    min-height: 17rem;
  }

  .roster-footer {
    align-items: flex-start;
    flex-direction: column;
    border-top: 1px solid var(--theme-stroke);
  }

  .roster-footer :global(.panel-btn) {
    width: 100%;
  }

  .roster-footer :global(.panel-btn span:last-child) {
    margin-left: auto;
    color: var(--theme-text-dim);
  }

  .roster-footer p {
    line-height: 1.35;
  }

  @container tunnel (max-width: 719px) {
    .performer-roster {
      max-height: min(52rem, 68dvh);
    }
  }

  @container tunnel (min-width: 720px) and (max-height: 500px) {
    .roster-heading,
    .roster-footer {
      padding-block: 5px;
    }

    .roster-scroll {
      flex-direction: row;
      overflow-x: auto;
      overflow-y: hidden;
    }

    .roster-scroll :global(.source-card) {
      flex: 0 0 min(22rem, 78cqw);
    }
  }

  @container tunnel (max-width: 430px) {
    .roster-heading {
      align-items: flex-start;
      flex-direction: column;
    }
  }
</style>
