<script lang="ts">
  import ShapeMatrixDrill from "$lib/shared/shape-matrix/components/ShapeMatrixDrill.svelte";
  import { getShapeMatrixAnimationContext } from "../context/shape-matrix-animation-context";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import { getShapeMatrixAppContext } from "../context/shape-matrix-app-context";

  const state = getShapeMatrixAppContext();
  // The shell owns the animation state so its compact topbar can host the
  // relationships toggle; this pane only presents it.
  const animationState = getShapeMatrixAnimationContext();

  const controlLabels = {
    grid: "Grid",
    layers: "Layers",
    effects: "Effects",
    props: "Props",
    effort: "Effort",
    playback: "Playback",
    display: "Display",
    motion: "Motion",
    export: "Export",
  } as const;
  const activeControlLabel = $derived(
    animationState.activeSection
      ? controlLabels[animationState.activeSection]
      : null
  );

  $effect(() => {
    if (state.propPickerOpen) {
      animationState.setActiveSection("props");
    } else if (animationState.activeSection === "props") {
      animationState.setActiveSection(null);
    }
  });
</script>

<aside
  class="detail-pane"
  class:compact={state.compact}
  aria-label="Shape animation and element relationships"
>
  <!-- Wide layouts carry the relationships toggle here. Compact detail keeps
       the topbar as the only chrome row, so the shell hosts the toggle. -->
  {#if !state.compact}
  <header class="pane-heading">
    <div
      class="relationship-entry"
      class:current={animationState.activeSection === null}
    >
      <PanelButton
        ariaLabel="Show element relationships"
        ariaExpanded={animationState.activeSection === null}
        onclick={animationState.showRelationships}
      >
        <i class="fas fa-shapes" aria-hidden="true"></i>
        <span>Element relationships</span>
      </PanelButton>
    </div>
    {#if activeControlLabel}
      <span class="active-workspace" aria-live="polite">
        <i class="fas fa-sliders" aria-hidden="true"></i>
        {activeControlLabel}
      </span>
    {/if}
  </header>
  {/if}

  <div class="drill-stage">
    {#if state.data}
      <ShapeMatrixDrill
        pair={state.selectedPair}
        data={state.data}
        selectedMode={state.selectedMode}
        selectedPropMode={state.selectedPropMode}
        onmodechange={state.setMode}
        onpropmodechange={state.setPropMode}
        propType={state.propType}
        onproptypechange={(propType) => void state.setPropType(propType)}
        onopenproppicker={state.openPropPicker}
        mandalaTransition={{
          claim: state.compact && state.activeView === "detail",
          handoff: state.mandalaHandoff,
        }}
      />
    {:else}
      <p class="status">Building the matrix…</p>
    {/if}
  </div>
</aside>

<style>
  .detail-pane {
    height: 100%;
    min-height: 0;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    overflow: hidden;
    border: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.1));
    border-radius: 16px;
    background: var(--theme-panel-bg, rgb(16 23 33 / 0.82));
  }

  .detail-pane.compact {
    grid-template-rows: minmax(0, 1fr);
  }

  .pane-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.65rem;
    min-height: 3.5rem;
    padding: 0.35rem 0.75rem;
    border-bottom: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.1));
    container: shape-matrix-detail-heading / inline-size;
  }

  .relationship-entry {
    min-width: 0;
  }

  .relationship-entry :global(.panel-btn) {
    min-height: var(--min-touch-target, 44px);
    justify-content: flex-start;
    padding: 0.45rem 0.7rem;
    white-space: nowrap;
  }

  .relationship-entry.current :global(.panel-btn) {
    border-color: color-mix(
      in srgb,
      var(--theme-accent, #f4b54c) 52%,
      transparent
    );
    background: color-mix(
      in srgb,
      var(--theme-accent, #f4b54c) 14%,
      var(--theme-card-bg, transparent)
    );
    color: var(--theme-accent, #f4b54c);
  }

  .active-workspace {
    display: inline-flex;
    min-width: 0;
    align-items: center;
    gap: 0.4rem;
    color: var(--theme-text-dim, rgb(255 255 255 / 0.62));
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 650;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
  }

  .active-workspace i {
    color: var(--theme-accent, #f4b54c);
  }

  .drill-stage {
    min-width: 0;
    min-height: 0;
    padding: 0.9rem;
    overflow: hidden;
    background: var(--theme-panel-bg, #0a0f14);
    container: shape-matrix-drill / size;
  }

  .status {
    display: grid;
    place-content: center;
    width: 100%;
    height: 100%;
    text-align: center;
    font-size: var(--font-size-min, 0.875rem);
  }

  @container shape-matrix-app (max-width: 74.99rem) or (max-height: 41.99rem) {
    .detail-pane {
      border: 0;
      border-radius: 0;
    }

    .pane-heading {
      min-height: 3.4rem;
      padding-block: 0.3rem;
    }

    .drill-stage {
      padding: 0.65rem;
    }
  }

  @container shape-matrix-app (max-width: 30rem) {
    .pane-heading {
      gap: 0.4rem;
      padding-inline: 0.45rem;
    }
  }
</style>
