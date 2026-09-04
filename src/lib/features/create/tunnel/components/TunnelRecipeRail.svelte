<script lang="ts">
  import { BackgroundType } from "@austencloud/backgrounds";
  import BaseCard from "$lib/features/create/generate/components/cards/BaseCard.svelte";
  import ToggleCard from "$lib/features/create/generate/components/cards/ToggleCard.svelte";
  import StepperCard from "$lib/shared/components/stepper-card/StepperCard.svelte";
  import { getCardColors } from "$lib/shared/create/domain/card-colors";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import type { TunnelViewController } from "$lib/shared/sequence-viewer/tunnel/tunnel-view-controller.svelte";
  import { getTunnelCreatorContext } from "../context/tunnel-creator-context";
  import type { TunnelWorkflowMode } from "../domain/tunnel-creator-draft";

  let {
    controller,
    short = false,
    onCastChange,
    onOpenSettings,
  }: {
    controller: TunnelViewController;
    short?: boolean;
    onCastChange: (count: number) => void;
    onOpenSettings: () => void;
  } = $props();

  const creator = getTunnelCreatorContext();
  const cardColors = $derived(
    getCardColors(
      settingsService.settings.backgroundType ?? BackgroundType.WINTER
    )
  );
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
  const summary = $derived.by(() => {
    const authored = creator.authoredPerformerCount;
    const rendered = controller.performerCount;
    const workflow =
      creator.workflow === "seeded" ? "Seeded canon" : "Custom cast";
    const copies = Math.max(0, rendered - authored);
    return `${workflow} · ${authored} authored · ${rendered} stage ${rendered === 1 ? "instance" : "instances"} · together after ${controller.loopSteps} ${controller.loopSteps === 1 ? "step" : "steps"}${copies > 0 ? ` · ${copies} generated formation ${copies === 1 ? "copy" : "copies"}, not choreography cards` : ""}`;
  });
</script>

<section class="tunnel-recipe" class:short aria-label="Tunnel recipe">
  <div class="recipe-cards">
    <div class="card-slot">
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
    width: min(100%, 80rem);
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-auto-rows: 4.75rem;
    gap: 8px;
    min-width: 0;
    padding: 2px;
    --rail-card-title-size: var(--font-size-compact, 12px);
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
  }

  .card-slot > :global(*) {
    flex: 1;
    min-width: 0;
    min-height: 0;
  }

  .tunnel-recipe.short {
    gap: 0;
  }

  .tunnel-recipe.short .recipe-cards {
    grid-auto-rows: 3.5rem;
  }

  .tunnel-recipe.short .recipe-summary {
    display: none;
  }

  .recipe-summary {
    display: flex;
    width: min(100%, 80rem);
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
</style>
