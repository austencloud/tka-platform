<script lang="ts">
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { getFuseContext } from "../context/fuse-context";
  import FuseGenerationControls from "./FuseGenerationControls.svelte";

  let {
    onOpenRecipe = () => {},
  }: {
    onOpenRecipe?: () => void;
  } = $props();
  const { state: fuseState } = getFuseContext();

  const optionsDisabled = $derived(
    fuseState.isLoadingLength || fuseState.isFusing
  );
  const gridSummary = $derived(
    fuseState.gridMode === GridMode.BOX ? "Box" : "Diamond"
  );
</script>

<header class="fuse-header">
  <div class="title-block">
    <h2 aria-label="Fuse two paths">
      <span class="title-full">Fuse two paths</span>
      <span class="title-compact" aria-hidden="true">Fuse</span>
    </h2>
    <p>Build two one-hand LOOPs into one sequence.</p>
  </div>

  <div class="wide-recipe-controls">
    <FuseGenerationControls />
    <div class="customize-trigger">
      <PanelButton
        variant="secondary"
        disabled={optionsDisabled}
        onclick={onOpenRecipe}
        ariaLabel="Open all path generation settings"
      >
        <i class="fas fa-sliders" aria-hidden="true"></i>
        Customize
      </PanelButton>
    </div>
  </div>

  <div class="recipe-trigger">
    <PanelButton
      variant="secondary"
      disabled={optionsDisabled}
      onclick={onOpenRecipe}
      ariaLabel="Open path generation recipe"
    >
      <i class="fas fa-sliders" aria-hidden="true"></i>
      <span class="recipe-label">
        <span>Path recipe</span>
        <strong>
          <span class="recipe-full">
            {fuseState.requestedLength} steps · Level {fuseState.generationLevel}
            · {gridSummary}{fuseState.generationLevel > 1
              ? ` · ≤${fuseState.maxTurnIntensity} turns`
              : ""}
          </span>
          <span class="recipe-compact" aria-hidden="true">
            {fuseState.requestedLength} steps · L{fuseState.generationLevel} ·
            {gridSummary}
          </span>
        </strong>
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
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: var(--settings-radius-lg, 20px);
    background: var(--theme-panel-bg, rgba(12, 14, 22, 0.94));
  }

  h2 {
    min-width: 0;
    margin: 0;
    overflow: hidden;
    color: var(--theme-text, #fff);
    font-size: clamp(1.05rem, 2.2cqw, 1.35rem);
    font-weight: 750;
    letter-spacing: -0.02em;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .title-compact,
  .recipe-compact {
    display: none;
  }

  .wide-recipe-controls {
    display: none;
  }

  .title-block {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .title-block p {
    margin: 0;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.68));
    font-size: var(--font-size-compact, 12px);
  }

  .recipe-trigger {
    flex: 0 1 auto;
  }

  .recipe-trigger :global(.panel-btn) {
    flex: 0 1 auto;
    width: min(100%, 27rem);
    min-width: 17rem;
    min-height: 3.25rem;
    justify-content: flex-start;
    gap: 10px;
    padding: 8px 12px;
    border-color: color-mix(
      in srgb,
      var(--semantic-warning, #f97316) 45%,
      var(--theme-stroke, transparent)
    );
    border-radius: var(--settings-radius-md, 12px);
    background: color-mix(
      in srgb,
      var(--semantic-warning, #f97316) 12%,
      var(--theme-card-bg, #161821)
    );
    font-size: var(--font-size-min, 14px);
    text-align: left;
  }

  .recipe-label {
    display: grid;
    flex: 1;
    gap: 1px;
    min-width: 0;
  }

  .recipe-label > span {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.68));
    font-size: var(--font-size-compact, 12px);
    line-height: 1;
  }

  .recipe-label strong {
    overflow: hidden;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 14px);
    font-variant-numeric: tabular-nums;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .recipe-chevron {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.62));
    font-size: var(--font-size-compact, 12px);
  }

  @container fuse (max-width: 599px) {
    .fuse-header {
      gap: 8px;
      padding: 6px 8px;
    }

    h2 {
      font-size: 1rem;
    }

    .title-full,
    .recipe-full {
      display: none;
    }

    .title-compact,
    .recipe-compact {
      display: inline;
    }

    .title-block p,
    .recipe-label > span {
      display: none;
    }

    .recipe-trigger :global(.panel-btn) {
      width: auto;
      min-width: 0;
      min-height: var(--min-touch-target, 48px);
      padding-inline: 10px;
    }
  }

  @container fuse (min-width: 1680px) and (min-height: 900px) {
    .fuse-header {
      min-height: 88px;
      padding-inline: 20px;
    }

    .title-block {
      flex: 0 1 18rem;
    }

    h2 {
      font-size: 1.65rem;
    }

    .recipe-trigger {
      display: none;
    }

    .wide-recipe-controls {
      display: flex;
      align-items: end;
      justify-content: flex-end;
      gap: 0.9rem;
      min-width: 0;
    }

    .customize-trigger {
      display: flex;
      flex: 0 0 auto;
    }

    .customize-trigger :global(.panel-btn) {
      width: auto;
      min-width: 9.5rem;
      min-height: var(--min-touch-target);
      padding-inline: 1rem;
      border-color: color-mix(
        in srgb,
        var(--semantic-warning, #f97316) 52%,
        var(--theme-stroke, transparent)
      );
      background: color-mix(
        in srgb,
        var(--semantic-warning, #f97316) 14%,
        var(--theme-card-bg, #161821)
      );
    }
  }

  @container fuse (min-width: 2600px) and (min-height: 1400px) {
    .fuse-header {
      min-height: 116px;
      padding-inline: 28px;
    }

    h2 {
      font-size: 2rem;
    }

    .title-block {
      flex-basis: 24rem;
    }

    .customize-trigger :global(.panel-btn) {
      min-width: 12rem;
      min-height: 4.5rem;
      font-size: var(--font-size-min, 18px);
    }
  }
</style>
