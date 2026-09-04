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
    activeStepIndices = {},
    leftPropType,
    rightPropType,
    colorMode,
    customPropColors,
    renderedInstanceCount,
    focusMode = false,
    short = false,
    onChoose,
    onChooseShapeMatrix,
    onGenerateNow,
    onEditGeneration,
    onEditRelationship,
    onSelectPerformer,
  }: {
    displays: Record<string, TunnelPerformerDisplay>;
    activeStepIndices?: Readonly<Record<string, number>>;
    leftPropType: PropType;
    rightPropType: PropType;
    colorMode: TunnelPropColorMode;
    customPropColors: TunnelPropColorPair;
    renderedInstanceCount: number;
    focusMode?: boolean;
    short?: boolean;
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
  class:focus-mode={focusMode}
  class:short
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
    {#if focusMode}
      <div class="roster-toolbar">
        <div class="performer-switcher" role="tablist" aria-label="Performers">
          {#each creator.performerSlots as slot}
            <button
              type="button"
              role="tab"
              aria-selected={creator.selectedPerformerId === slot.id}
              onclick={() => select(slot.id)}
            >
              {slot.label.replace("Performer ", "P")}
            </button>
          {/each}
        </div>
        {#if creator.canAddPerformer}
          <PanelButton
            variant="secondary"
            onclick={add}
            ariaLabel="Add another authored performer"
          >
            <i class="fas fa-user-plus" aria-hidden="true"></i>
            <span class="compact-add-count">
              {creator.performerSlots.length}/4
            </span>
          </PanelButton>
        {/if}
      </div>
    {/if}
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
        activeStepIndex={activeStepIndices[slot.id] ?? null}
        stageTransformLabel={display?.stageTransformLabel ?? null}
        generatedInstanceCount={display?.generatedInstanceCount ?? 0}
        formationCopy={index === 1 && creator.partnerIsFormationCopy}
        label={slot.label}
        {linked}
        sourcePerformerLabel={sourceLabel(slot.id)}
        selected={creator.selectedPerformerId === slot.id}
        {short}
        expanded={focusMode
          ? creator.selectedPerformerId === slot.id
          : creator.performerSlots.length <= 2 ||
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

  {#if creator.canAddPerformer && !focusMode}
    <footer class="roster-footer">
      <PanelButton
        variant="secondary"
        onclick={add}
        ariaLabel="Add another authored performer"
      >
        <i class="fas fa-user-plus" aria-hidden="true"></i>
        Add performer
        <span
          >{creator.performerSlots.length}{creator.performerSlots.length > 4
            ? " preserved"
            : "/4"}</span
        >
      </PanelButton>
    </footer>
  {:else if creator.addPerformerBlockedReason}
    <p class="sr-only" role="status">
      {creator.addPerformerBlockedReason}
    </p>
  {/if}
</section>

<style>
  .performer-roster {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    min-width: 0;
    min-height: 0;
    height: 100%;
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

  .performer-switcher {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }

  .roster-toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    margin-left: auto;
  }

  .roster-toolbar :global(.panel-btn) {
    min-width: var(--min-touch-target, 48px);
    min-height: var(--min-touch-target, 48px);
    padding-inline: 8px;
  }

  .compact-add-count {
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 12px);
    font-variant-numeric: tabular-nums;
  }

  .performer-switcher button {
    min-width: var(--min-touch-target, 48px);
    min-height: var(--min-touch-target, 48px);
    padding: 6px 10px;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--settings-radius-sm, 10px);
    color: var(--theme-text-dim);
    background: var(--theme-card-bg);
    font-size: var(--font-size-min, 14px);
    font-weight: 750;
    cursor: pointer;
  }

  .performer-switcher button[aria-selected="true"] {
    border-color: color-mix(in srgb, var(--theme-accent) 70%, white 10%);
    color: var(--theme-text);
    background: color-mix(
      in srgb,
      var(--theme-accent) 18%,
      var(--theme-card-bg)
    );
  }

  .performer-switcher button:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
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

  .performer-roster.focus-mode .roster-scroll {
    display: grid;
    grid-template: minmax(0, 1fr) / minmax(0, 1fr);
    overflow: hidden;
  }

  .performer-roster.focus-mode .roster-scroll :global(.source-card) {
    grid-area: 1 / 1;
    min-height: 0;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition:
      opacity var(--transition-fast),
      visibility 0s linear var(--duration-fast);
  }

  .performer-roster.focus-mode .roster-scroll :global(.source-card.selected) {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    transition-delay: 0s;
  }

  .performer-roster.focus-mode.few-cards
    .roster-scroll
    :global(.source-card.expanded) {
    min-height: 0;
  }

  .roster-footer {
    border-top: 1px solid var(--theme-stroke);
  }

  .roster-footer :global(.panel-btn) {
    width: 100%;
  }

  .roster-footer :global(.panel-btn span:last-child) {
    margin-left: auto;
    color: var(--theme-text-dim);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @container tunnel (max-width: 719px) {
    .performer-roster {
      min-height: min(26rem, 64dvh);
      max-height: none;
    }
  }

  @container tunnel (min-width: 600px) and (max-height: 540px) {
    .performer-roster.short {
      min-height: 0;
    }

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

    .performer-roster.short .roster-heading > div:first-child,
    .performer-roster.short .roster-footer {
      display: none;
    }

    .performer-roster.short .roster-heading {
      justify-content: flex-end;
      min-height: var(--min-touch-target, 48px);
      padding-block: 0;
    }

    .performer-roster.short .roster-scroll {
      overflow: hidden;
    }
  }

  @container tunnel (max-width: 430px) {
    .roster-heading {
      gap: 6px;
      padding: 6px 8px;
    }

    .roster-heading > div:first-child > span {
      display: none;
    }

    .performer-switcher {
      margin-left: 0;
    }

    .performer-switcher button {
      min-width: 44px;
      min-height: 44px;
      padding-inline: 8px;
    }

    .roster-toolbar :global(.panel-btn) {
      width: 44px;
      min-width: 44px;
      min-height: 44px;
      padding: 0;
    }

    .compact-add-count {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
      clip-path: inset(50%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .performer-roster.focus-mode .roster-scroll :global(.source-card) {
      transition: none;
    }
  }
</style>
