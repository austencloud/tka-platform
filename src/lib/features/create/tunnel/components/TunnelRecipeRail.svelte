<script lang="ts">
  import { BackgroundType } from "@austencloud/backgrounds";
  import BaseCard from "$lib/features/create/generate/components/cards/BaseCard.svelte";
  import ToggleCard from "$lib/features/create/generate/components/cards/ToggleCard.svelte";
  import StepperCard from "$lib/shared/components/stepper-card/StepperCard.svelte";
  import type { PlaybackMode } from "$lib/shared/animation-engine/state/animation-panel-state.svelte";
  import { getCardColors } from "$lib/shared/create/domain/card-colors";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import type { TunnelViewController } from "$lib/shared/sequence-viewer/tunnel/tunnel-view-controller.svelte";
  import { getTunnelCreatorContext } from "../context/tunnel-creator-context";
  import type { TunnelWorkflowMode } from "../domain/tunnel-creator-draft";

  let {
    controller,
    bpm,
    playbackMode,
    onCastChange,
    onOpenSettings,
    onOpenGeneration,
    onOpenShapeMatrix,
    onOpenBrowse,
  }: {
    controller: TunnelViewController;
    bpm: number;
    playbackMode: PlaybackMode;
    onCastChange: (count: number) => void;
    onOpenSettings: () => void;
    onOpenGeneration: (performerId: string) => void;
    onOpenShapeMatrix: (performerId: string) => void;
    onOpenBrowse: (performerId: string) => void;
  } = $props();

  const creator = getTunnelCreatorContext();
  const cardColors = $derived(
    getCardColors(
      settingsService.settings.backgroundType ?? BackgroundType.WINTER
    )
  );
  const selected = $derived(
    creator.performerSlots.find(
      (slot) => slot.id === creator.selectedPerformerId
    ) ?? creator.performerSlots[0]
  );
  const selectedId = $derived(selected?.id ?? null);
  const selectedShortLabel = $derived(
    selected ? selected.label.replace("Performer ", "P") : "P1"
  );
  const selectedSourceLabel = $derived.by(() => {
    const performer = selected?.performer;
    if (!performer) return "Choose source";
    if (performer.source.kind === "derived") {
      const sourcePerformerId = performer.source.performerId;
      const source = creator.performerSlots.find(
        (slot) => slot.id === sourcePerformerId
      );
      return `Follows ${source?.label.replace("Performer ", "P") ?? "source"}`;
    }
    const provenance = performer.source.provenance;
    if (provenance?.kind === "generator-recipe") {
      const config = provenance.setup.config;
      const length = typeof config.length === "number" ? config.length : null;
      const level = typeof config.level === "number" ? config.level : null;
      return (
        [length ? `${length} steps` : null, level ? `L${level}` : null]
          .filter(Boolean)
          .join(" · ") || "Generated"
      );
    }
    if (provenance?.kind === "shape-matrix-realization") {
      return `${provenance.mode} realization`;
    }
    if (provenance?.kind === "library-sequence") {
      return provenance.scope === "personal"
        ? "From Yours"
        : provenance.scope === "public"
          ? "From Public"
          : "From library";
    }
    return selected?.origin === "generated" ? "Generated" : "Existing sequence";
  });
  const formationLabel = $derived.by(() => {
    const recipe = controller.presetRecipe;
    if (recipe) {
      return `${recipe.name}${controller.presetRecipeModified ? " · modified" : ""}`;
    }
    const modifiers = [
      controller.mirror ? "mirror" : null,
      controller.flip ? "flip" : null,
      controller.invert ? "invert" : null,
      controller.echo ? "echo" : null,
    ].filter(Boolean);
    return `${controller.fold}-fold${modifiers.length ? ` · ${modifiers.join(" · ")}` : ""}`;
  });
  const playbackLabel = $derived(
    `${bpm} BPM · ${playbackMode === "continuous" ? "Continuous" : "Step-by-step"}`
  );
  const summary = $derived.by(() => {
    const authored = creator.authoredPerformerCount;
    const rendered = controller.performerCount;
    const workflow =
      creator.workflow === "seeded" ? "Seeded canon" : "Custom cast";
    const copies = Math.max(0, rendered - authored);
    return `${workflow} · ${authored} authored · ${rendered} stage ${rendered === 1 ? "instance" : "instances"} · together after ${controller.loopSteps} ${controller.loopSteps === 1 ? "step" : "steps"}${copies > 0 ? ` · ${copies} generated formation ${copies === 1 ? "copy" : "copies"}, not choreography cards` : ""}`;
  });

  function withSelected(action: (performerId: string) => void): void {
    if (selectedId) action(selectedId);
  }
</script>

<section class="tunnel-recipe" aria-label="Tunnel recipe">
  <div class="recipe-cards themed-scrollbar">
    <div class="card-slot mode-card">
      <ToggleCard
        title="Compose"
        option1={{
          value: "custom" as TunnelWorkflowMode,
          label: "Custom cast",
        }}
        option2={{
          value: "seeded" as TunnelWorkflowMode,
          label: "Seeded canon",
        }}
        activeOption={creator.workflow}
        onToggle={creator.setWorkflow}
        color={cardColors.mode.color}
        shadowColor={cardColors.mode.shadowColor}
        gridColumnSpan={1}
        headerFontSize="var(--rail-card-title-size)"
      />
    </div>

    <div class="card-slot">
      {#if creator.performerSlots.length <= 4}
        <StepperCard
          title="Cast"
          currentValue={creator.performerSlots.length}
          minValue={1}
          maxValue={4}
          onIncrement={() => onCastChange(creator.performerSlots.length + 1)}
          onDecrement={() => onCastChange(creator.performerSlots.length - 1)}
          formatValue={(value: number) => String(value)}
          subtitle="performers"
          color={cardColors.length.color}
          shadowColor={cardColors.length.shadowColor}
          gridColumnSpan={1}
          headerFontSize="var(--rail-card-title-size)"
        />
      {:else}
        <BaseCard
          title="Cast"
          currentValue={`${creator.performerSlots.length} preserved`}
          clickable={false}
          color={cardColors.length.color}
          shadowColor={cardColors.length.shadowColor}
          gridColumnSpan={1}
          headerFontSize="var(--rail-card-title-size)"
          ariaLabel={`${creator.performerSlots.length} legacy performers preserved`}
        />
      {/if}
    </div>

    <div class="card-slot">
      <BaseCard
        title={`Generate ${selectedShortLabel}`}
        currentValue={selectedSourceLabel}
        color={cardColors.turnIntensity.color}
        shadowColor={cardColors.turnIntensity.shadowColor}
        gridColumnSpan={1}
        headerFontSize="var(--rail-card-title-size)"
        ariaLabel={`Open the generator recipe for ${selected?.label ?? "Performer 1"}`}
        onClick={() => withSelected(onOpenGeneration)}
      />
    </div>

    <div class="card-slot">
      <BaseCard
        title="Shape Matrix"
        currentValue={`${selectedShortLabel} · TnD`}
        color={cardColors.gridMode.color}
        shadowColor={cardColors.gridMode.shadowColor}
        gridColumnSpan={1}
        headerFontSize="var(--rail-card-title-size)"
        ariaLabel={`Choose an exact Shape Matrix and timing-and-direction realization for ${selected?.label ?? "Performer 1"}`}
        onClick={() => withSelected(onOpenShapeMatrix)}
      />
    </div>

    <div class="card-slot">
      <BaseCard
        title="Browse"
        currentValue="Public + Yours"
        color={cardColors.favorite.color}
        shadowColor={cardColors.favorite.shadowColor}
        gridColumnSpan={1}
        headerFontSize="var(--rail-card-title-size)"
        ariaLabel={`Browse public and personal sequences for ${selected?.label ?? "Performer 1"}`}
        onClick={() => withSelected(onOpenBrowse)}
      />
    </div>

    <div class="card-slot">
      <BaseCard
        title="Formation"
        currentValue={formationLabel}
        color={cardColors.customize.color}
        shadowColor={cardColors.customize.shadowColor}
        gridColumnSpan={1}
        headerFontSize="var(--rail-card-title-size)"
        ariaLabel={`Formation: ${formationLabel}. Open Tunnel settings.`}
        onClick={onOpenSettings}
      />
    </div>

    <div class="card-slot">
      <BaseCard
        title="Timing"
        currentValue={`Together in ${controller.loopSteps}`}
        color={cardColors.duration.color}
        shadowColor={cardColors.duration.shadowColor}
        gridColumnSpan={1}
        headerFontSize="var(--rail-card-title-size)"
        ariaLabel={`All performer sources return together after ${controller.loopSteps} steps. Open Tunnel settings.`}
        onClick={onOpenSettings}
      />
    </div>

    <div class="card-slot colors-card">
      <ToggleCard
        title="Colors"
        option1={{ value: "hands", label: "Hand colors" }}
        option2={{ value: "spectrum", label: "Spectrum" }}
        activeOption={controller.spectrum ? "spectrum" : "hands"}
        onToggle={(value) => (controller.spectrum = value === "spectrum")}
        color={cardColors.period.color}
        shadowColor={cardColors.period.shadowColor}
        gridColumnSpan={1}
        headerFontSize="var(--rail-card-title-size)"
      />
    </div>

    <div class="card-slot">
      <BaseCard
        title="Playback"
        currentValue={playbackLabel}
        color={cardColors.startEnd.color}
        shadowColor={cardColors.startEnd.shadowColor}
        gridColumnSpan={1}
        headerFontSize="var(--rail-card-title-size)"
        ariaLabel={`Playback: ${playbackLabel}. Open Tunnel settings.`}
        onClick={onOpenSettings}
      />
    </div>
  </div>

  <div class="recipe-summary">
    <p>{summary}</p>
    {#if controller.presetRecipe && controller.presetRecipeModified}
      <button type="button" onclick={() => controller.resetPresetRecipe()}>
        Reset {controller.presetRecipe.name}
      </button>
    {/if}
  </div>
</section>

<style>
  .tunnel-recipe {
    display: grid;
    flex: 1 1 100%;
    gap: 6px;
    min-width: 0;
  }

  .recipe-cards {
    display: grid;
    grid-auto-columns: minmax(8.75rem, 1fr);
    grid-auto-flow: column;
    grid-auto-rows: 6.5rem;
    gap: 8px;
    min-width: 0;
    padding: 2px;
    overflow-x: auto;
    overflow-y: clip;
    overscroll-behavior-inline: contain;
    scroll-snap-type: inline proximity;
    --rail-card-title-size: 9px;
    --card-text-size: clamp(0.8rem, 18cqh, 1.25rem);
    --card-text-weight: 750;
    --card-text-spacing: 0;
    --card-text-shadow: 0 2px 6px var(--theme-shadow);
  }

  .card-slot {
    container: generate-card / size;
    display: flex;
    min-width: 0;
    min-height: 0;
    scroll-snap-align: start;
  }

  .card-slot > :global(*) {
    flex: 1;
    min-width: 0;
    min-height: 0;
  }

  .recipe-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-width: 0;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 12px);
  }

  .recipe-summary p {
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .recipe-summary button {
    flex: 0 0 auto;
    min-height: 2rem;
    padding: 3px 9px;
    border: 1px solid
      color-mix(in srgb, var(--theme-accent) 45%, var(--theme-stroke));
    border-radius: 999px;
    color: var(--theme-accent);
    background: color-mix(in srgb, var(--theme-accent) 9%, transparent);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  .recipe-summary button:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  @container tunnel (min-width: 1680px) and (min-height: 900px) {
    .recipe-cards {
      grid-auto-columns: minmax(0, 1fr);
      overflow: visible;
    }
  }

  @container tunnel (min-width: 2600px) and (min-height: 1400px) {
    .recipe-cards {
      grid-auto-rows: 8rem;
      gap: 12px;
      --rail-card-title-size: 0.78rem;
      --card-text-size: clamp(1rem, 18cqh, 1.75rem);
    }
  }
</style>
