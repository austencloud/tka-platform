<script lang="ts">
  import { BackgroundType } from "@austencloud/backgrounds";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import { getCardColors } from "$lib/shared/create/domain/card-colors";
  import { settingsService } from "$lib/shared/settings/state/settings-state.svelte";
  import { getFuseContext } from "../context/fuse-context";
  import type { FuseRecipeDestination } from "../domain/fuse-recipe-destination";
  import { buildFuseRecipeSummaries } from "../domain/fuse-recipe-summaries";
  import type { FuseMode } from "../state/fuse-state.svelte";
  import FuseGridTile from "./FuseGridTile.svelte";
  import FuseLevelTile from "./FuseLevelTile.svelte";
  import FuseModeBar from "./FuseModeBar.svelte";
  import FusePairingTile from "./FusePairingTile.svelte";
  import FuseRecipePopover from "./FuseRecipePopover.svelte";

  let {
    onOpenRecipe = () => {},
    onOpenSetting = () => {},
    onModeChange,
    recipeOpen = false,
  }: {
    onOpenRecipe?: () => void;
    onOpenSetting?: (destination: FuseRecipeDestination) => void;
    onModeChange: (mode: FuseMode) => void;
    /** Whether the recipe panel is showing. The trigger is a toggle, so it has
     *  to say which way it points. */
    recipeOpen?: boolean;
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
      rule: fuseState.rule,
    })
  );
  type RailTile = {
    id: FuseRecipeDestination;
    title: string;
    width: string;
    align: "start" | "center" | "end";
    color: string;
    shadowColor: string;
    textColor?: string;
  };

  // The slots that open an editor. Level, Grid, and Pairing are not here — they
  // are their own tiles, each holding the control it governs.
  const leadingTiles = $derived<RailTile[]>([
    {
      id: "length" as const,
      title: "Length",
      width: "29rem",
      align: "start" as const,
      ...cardColors.length,
    },
  ]);

  const trailingTiles = $derived<RailTile[]>([
    {
      id: "style" as const,
      title: "Style",
      width: "36rem",
      align: "center" as const,
      ...cardColors.customize,
    },
    {
      id: "starting" as const,
      title: "Starting conditions",
      width: "64rem",
      align: "center" as const,
      ...cardColors.startEnd,
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
       is, so it stays a visible switch instead of hiding behind an editor. Where
       the rail fits, this moves into the Pairing tile — same control, sitting in
       the slot it governs. -->
  <div class="mode-switch">
    <FuseModeBar compact={true} onSelect={onModeChange} />
  </div>

  <div class="recipe-rail" aria-label="Fuse recipe controls">
    <!-- Length opens an editor. Level and Grid own their values outright — three
         ordered settings and two named ones — so they carry their control on the
         tile instead of hiding it behind a popover. -->
    {#each leadingTiles as tile (tile.id)}
      <FuseRecipePopover
        destination={tile.id}
        title={tile.title}
        summary={summaries[tile.id]}
        color={tile.color}
        shadowColor={tile.shadowColor}
        textColor={tile.textColor}
        width={tile.width}
        align={tile.align}
        open={activeSetting === tile.id}
        disabled={optionsDisabled}
        onOpenChange={(open) => setTileOpen(tile.id, open)}
      />
    {/each}

    <FuseLevelTile summary={summaries.level} disabled={optionsDisabled} />

    <FuseGridTile
      color={cardColors.gridMode.color}
      shadowColor={cardColors.gridMode.shadowColor}
      disabled={optionsDisabled}
    />

    {#each trailingTiles as tile (tile.id)}
      <FuseRecipePopover
        destination={tile.id}
        title={tile.title}
        summary={summaries[tile.id]}
        color={tile.color}
        shadowColor={tile.shadowColor}
        textColor={tile.textColor}
        width={tile.width}
        align={tile.align}
        open={activeSetting === tile.id}
        disabled={optionsDisabled}
        onOpenChange={(open) => setTileOpen(tile.id, open)}
      />
    {/each}

    <FusePairingTile
      color={cardColors.mode.color}
      shadowColor={cardColors.mode.shadowColor}
      disabled={optionsDisabled}
      {onModeChange}
      onEditRule={() => onOpenSetting("pairing")}
    />
  </div>

  <!-- The way into the recipe panel, at every width. Where the rail is showing
       it narrows to its icon and sits beside the title: the tiles each open one
       setting, this opens all of them in a column, and both doors stay on the
       header rather than one of them being reachable only by backing out of the
       other. It is a toggle, so the same control closes what it opened. -->
  <div class="recipe-trigger" class:is-open={recipeOpen}>
    <PanelButton
      variant="secondary"
      disabled={optionsDisabled}
      onclick={onOpenRecipe}
      ariaLabel={recipeOpen
        ? "Close Fuse recipe settings"
        : "Open Fuse recipe settings"}
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

    /* Two centered rows instead of one right-heavy line. The old row put the
       title alone on the left, the recipe door floating by itself in the gap
       after it, and all six tiles packed against the right edge — the rail's
       centre sat 165px right of the header's. Title and door now sit together
       as one centred pair, and the rail gets the full width under them. */
    .fuse-header {
      flex-wrap: wrap;
      justify-content: center;
      row-gap: 10px;
    }

    .title-block {
      flex: 0 0 auto;
    }

    /* Row 1 is one line. The subtitle costs ~40px of workspace height here, and
       spending it tips the page into overflow — the scrollbar that appears
       takes the source card under its 940px seam and collapses its seven
       actions into two ragged rows. The tab is already labelled Fuse in the nav
       and the tiles below state the recipe, so the sentence is the affordable
       thing to drop. */
    .title-block p {
      display: none;
    }

    /* The Pairing tile holds the switch at this size — two of them in one header
       row would be the same control twice. */
    .mode-switch {
      display: none;
    }

    /* The trigger keeps its door but gives up its width to the rail: icon only,
       square, sitting between the title and the tiles. The summary it was
       carrying is redundant here — every tile in the rail already states its
       own value. */
    .recipe-trigger {
      order: 1;
      flex: 0 0 auto;
    }

    .recipe-trigger :global(.panel-btn) {
      width: var(--min-touch-target, 48px);
      min-width: var(--min-touch-target, 48px);
      min-height: var(--min-touch-target, 48px);
      justify-content: center;
      padding: 0;
    }

    .recipe-trigger .recipe-label,
    .recipe-trigger .recipe-chevron {
      display: none;
    }

    /* Open is a state of the workspace, not of this button alone, so it reads
       as held down rather than merely hovered. */
    .recipe-trigger.is-open :global(.panel-btn) {
      color: var(--theme-text);
      background: color-mix(
        in srgb,
        var(--theme-accent) 26%,
        var(--theme-card-bg, rgba(255, 255, 255, 0.08))
      );
      border-color: color-mix(in srgb, var(--theme-accent) 62%, transparent);
    }

    .recipe-rail {
      order: 2;
      display: grid;
      /* Floors are each ~2.5rem lower than they were: that is the leading icon
         box and its gap, which every tile has given back. */
      /* Level and Grid carry controls now, not a word: the stepper needs room for
         two buttons either side of "Level 2", and the Grid switch for both of its
         values at once. Their floors are set to those controls. */
      grid-template-columns:
        minmax(4.75rem, 0.7fr) minmax(9.5rem, 1.05fr)
        minmax(9rem, 1fr) minmax(5rem, 0.7fr)
        minmax(8.5rem, 1.12fr) minmax(11rem, 1.3fr);
      gap: 8px;
      /* 100% basis is what puts the rail on its own row under the centred
         title. Keep it in this shorthand — a bare `flex-basis` earlier in the
         block gets reset by this declaration. */
      flex: 1 1 100%;
      min-width: 0;
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
    }
  }
</style>
