<script lang="ts">
  import { BackgroundType } from "@austencloud/backgrounds";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import { getCardColors } from "$lib/shared/create/domain/card-colors";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import { getFuseContext } from "../context/fuse-context";
  import type { FuseRecipeDestination } from "../domain/fuse-recipe-destination";
  import { buildFuseRecipeSummaries } from "../domain/fuse-recipe-summaries";
  import FuseModeBar from "./FuseModeBar.svelte";
  import FuseRecipePopover from "./FuseRecipePopover.svelte";

  let {
    onOpenRecipe = () => {},
  }: {
    onOpenRecipe?: () => void;
  } = $props();

  const { state: fuseState } = getFuseContext();
  let activeSetting = $state<FuseRecipeDestination | null>(null);

  const optionsDisabled = $derived(
    fuseState.isLoadingLength ||
      fuseState.pendingSide !== null ||
      fuseState.isFusing
  );
  const cardColors = $derived(
    getCardColors(
      settingsService.settings.backgroundType ?? BackgroundType.WINTER
    )
  );
  const summaries = $derived(
    buildFuseRecipeSummaries({
      requestedLength: fuseState.requestedLength,
      generationLevel: fuseState.generationLevel,
      maxTurnIntensity: fuseState.maxTurnIntensity,
      gridMode: fuseState.gridMode,
      constraintPreset: fuseState.constraintPreset,
      handPathMode: fuseState.handPathMode,
      motionTypeFilter: fuseState.motionTypeFilter,
      startLocation: fuseState.startLocation,
      startOrientation: fuseState.startOrientation,
      traversalDirection: fuseState.traversalDirection,
      mode: fuseState.mode,
      driverSide: fuseState.driverSide,
      transformId: fuseState.transformId,
    })
  );
  const tiles = $derived([
    {
      id: "length" as const,
      title: "Length",
      icon: "fas fa-list-ol",
      width: "29rem",
      align: "start" as const,
      ...cardColors.length,
    },
    {
      id: "level" as const,
      title: "Level",
      icon: "fas fa-layer-group",
      width: "48rem",
      align: "center" as const,
      ...cardColors.level,
    },
    {
      id: "grid" as const,
      title: "Grid",
      icon: "fas fa-border-all",
      width: "31rem",
      align: "center" as const,
      ...cardColors.gridMode,
    },
    {
      id: "style" as const,
      title: "Style",
      icon: "fas fa-wand-magic-sparkles",
      width: "36rem",
      align: "center" as const,
      ...cardColors.customize,
    },
    {
      id: "starting" as const,
      title: "Starting conditions",
      icon: "fas fa-location-crosshairs",
      width: "64rem",
      align: "center" as const,
      ...cardColors.startEnd,
    },
    {
      id: "pairing" as const,
      title: "Pairing",
      icon: "fas fa-link",
      width: "56rem",
      align: "end" as const,
      ...cardColors.mode,
    },
  ]);
  const compactSummary = $derived(
    `${summaries.length} · L${fuseState.generationLevel} · ${summaries.grid} · ${summaries.pairing}`
  );

  $effect(() => {
    if (optionsDisabled) activeSetting = null;
  });

  function setTileOpen(
    destination: FuseRecipeDestination,
    open: boolean
  ): void {
    if (open) {
      activeSetting = destination;
    } else if (activeSetting === destination) {
      activeSetting = null;
    }
  }
</script>

<!-- One recipe, six focused controls. Compact layouts drill into the same state. -->
<header class="fuse-header">
  <div class="title-block">
    <h2 aria-label="Fuse two paths">
      <span class="title-full">Fuse two paths</span>
      <span class="title-compact" aria-hidden="true">Fuse</span>
    </h2>
    <p>Build two one-hand LOOPs into one sequence.</p>
  </div>

  <!-- Separate/Linked is the one recipe decision that changes what the whole tab
       is, so it stays a visible switch instead of hiding behind the Pairing
       popover. -->
  <div class="mode-switch">
    <FuseModeBar compact={true} />
  </div>

  <div class="recipe-rail" aria-label="Fuse recipe controls">
    {#each tiles as tile (tile.id)}
      <FuseRecipePopover
        destination={tile.id}
        title={tile.title}
        summary={summaries[tile.id]}
        icon={tile.icon}
        color={tile.color}
        shadowColor={tile.shadowColor}
        width={tile.width}
        align={tile.align}
        open={activeSetting === tile.id}
        disabled={optionsDisabled}
        onOpenChange={(open) => setTileOpen(tile.id, open)}
      />
    {/each}
  </div>

  <div class="recipe-trigger">
    <PanelButton
      variant="secondary"
      disabled={optionsDisabled}
      onclick={onOpenRecipe}
      ariaLabel="Open Fuse recipe settings"
    >
      <i class="fas fa-sliders" aria-hidden="true"></i>
      <span class="recipe-label">
        <span>Fuse recipe</span>
        <strong>{compactSummary}</strong>
      </span>
      <i class="fas fa-chevron-right recipe-chevron" aria-hidden="true"></i>
    </PanelButton>
  </div>
</header>

<style>
  .fuse-header {
    grid-area: header;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--settings-spacing-md, 14px);
    min-height: var(--min-touch-target, 48px);
    padding: var(--settings-spacing-sm, 8px) var(--settings-spacing-md, 14px);
    border: 1px solid var(--theme-stroke);
    border-radius: var(--settings-radius-lg, 20px);
    background: var(--theme-panel-bg);
  }

  .title-block {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  h2 {
    min-width: 0;
    margin: 0;
    overflow: hidden;
    color: var(--theme-text);
    font-size: clamp(1.05rem, 2.2cqw, 1.35rem);
    font-weight: 750;
    letter-spacing: -0.02em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .title-block p {
    margin: 0;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 12px);
  }

  .title-compact,
  .recipe-rail {
    display: none;
  }

  /* The lone auto margin in the row: it collects all the slack so the switch
     stays beside the title instead of drifting to the middle. */
  .mode-switch {
    display: flex;
    flex: 0 1 auto;
    min-width: 0;
    margin-right: auto;
  }

  /* Two short words — size to them, never to the rail's leftover space. */
  .mode-switch :global(.fuse-mode-bar) {
    width: min(100%, 14rem);
    min-width: 9.5rem;
  }

  .recipe-trigger {
    flex: 0 1 auto;
    min-width: 0;
  }

  .recipe-trigger :global(.panel-btn) {
    width: min(100%, 30rem);
    min-width: 17rem;
    min-height: 3.25rem;
    justify-content: flex-start;
    gap: 10px;
    padding: 8px 12px;
  }

  .recipe-label {
    display: grid;
    flex: 1;
    gap: 1px;
    min-width: 0;
    text-align: left;
  }

  .recipe-label > span {
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 12px);
    font-weight: 650;
  }

  .recipe-label strong {
    overflow: hidden;
    color: var(--theme-text);
    font-size: var(--font-size-min, 14px);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .recipe-chevron {
    color: var(--theme-text-dim);
    font-size: 11px;
  }

  @container fuse (max-width: 760px) {
    .fuse-header {
      flex-wrap: wrap;
    }

    /* The switch takes its own row rather than squeezing the recipe button
       below a usable width. */
    .mode-switch {
      flex: 1 0 100%;
      order: 3;
      margin-right: 0;
    }

    .mode-switch :global(.fuse-mode-bar) {
      width: 100%;
    }
  }

  @container fuse (max-width: 520px) {
    .fuse-header {
      gap: 8px;
      padding: 7px 8px;
    }

    .title-full,
    .title-block p {
      display: none;
    }

    .title-compact {
      display: inline;
    }

    .recipe-trigger {
      flex: 1;
    }

    .recipe-trigger :global(.panel-btn) {
      width: 100%;
      min-width: 0;
    }
  }

  @container fuse (min-width: 1680px) and (min-height: 900px) {
    .fuse-header {
      gap: 18px;
      min-height: 5.25rem;
      padding: 10px 12px 10px 18px;
    }

    .title-block {
      flex: 0 1 15rem;
    }

    .recipe-trigger {
      display: none;
    }

    .recipe-rail {
      display: grid;
      grid-template-columns:
        minmax(7.25rem, 0.72fr) minmax(9.25rem, 0.95fr)
        minmax(7.5rem, 0.75fr) minmax(7.5rem, 0.75fr)
        minmax(11rem, 1.18fr) minmax(13.5rem, 1.38fr);
      gap: 8px;
      flex: 1 1 auto;
      min-width: 0;
      max-width: 102rem;
    }
  }

  @container fuse (min-width: 2600px) and (min-height: 1400px) {
    .fuse-header {
      min-height: 6.5rem;
      padding: 14px 18px 14px 24px;
    }

    .title-block {
      flex-basis: 20rem;
    }

    h2 {
      font-size: 1.65rem;
    }

    .recipe-rail {
      gap: 12px;
      max-width: 132rem;
    }
  }
</style>
