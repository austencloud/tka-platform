<script lang="ts">
  import ShapeMatrixDrill from "$lib/shared/shape-matrix/components/ShapeMatrixDrill.svelte";
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import { getShapeMatrixAppContext } from "../context/shape-matrix-app-context";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import type { ShapeMatrixRelationshipDriver } from "../state/shape-matrix-app-state.svelte";

  const state = getShapeMatrixAppContext();
  const DRIVER_OPTIONS = [
    { value: "hands" as const, label: "Hand path", shortLabel: "Hands" },
    {
      value: "props" as const,
      label: "Prop motion",
      shortLabel: "Props",
    },
  ];
  const driverHint = $derived(
    state.relationshipDriver === "hands"
      ? "Pick by where your hands travel."
      : "Pick by what the prop does."
  );
</script>

{#snippet driverOption(driver: ShapeMatrixRelationshipDriver)}
  <i
    class={driver === "hands" ? "fas fa-hands" : "fas fa-wand-magic-sparkles"}
    aria-hidden="true"
  ></i>
  <span class="driver-full">{driver === "hands" ? "Hand path" : "Prop motion"}</span>
  <span class="driver-short">{driver === "hands" ? "Hands" : "Props"}</span>
{/snippet}

<aside class="detail-pane" aria-label="Shape detail">
  <header class="pane-heading">
    <div class="heading-title">
      <span class="eyebrow">Shape detail</span>
      <div class="driver-hint-slot">
        <Crossfade key={state.relationshipDriver}>
          <span class="driver-hint">{driverHint}</span>
        </Crossfade>
      </div>
    </div>
    <div class="driver-control">
      <SegmentedControl
        options={DRIVER_OPTIONS}
        value={state.relationshipDriver}
        onchange={(driver: ShapeMatrixRelationshipDriver) =>
          state.setRelationshipDriver(driver)}
        color="accent"
        size="sm"
        density="tight"
        semantics="radiogroup"
        ariaLabel="Relationship selection source"
        optionContent={driverOption}
      />
    </div>
  </header>

  <div class="drill-stage">
    {#if state.data}
      <ShapeMatrixDrill
        pair={state.selectedPair}
        data={state.data}
        selectedMode={state.selectedMode}
        selectedPropMode={state.selectedPropMode}
        onmodechange={state.setMode}
        onpropmodechange={state.setPropMode}
        relationshipDriver={state.relationshipDriver}
        propType={state.propType}
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
    background: rgb(16 23 33 / 0.82);
  }

  .pane-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    min-height: 3.5rem;
    padding: 0.35rem 0.75rem;
    border-bottom: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.1));
    /* The heading measures itself: the split-view divider can make this pane
       narrower than any app-level band, and the driver labels must swap to
       their short forms before they would wrap to two lines. */
    container: shape-matrix-detail-heading / inline-size;
  }

  .heading-title {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    min-width: 0;
    flex: 1 1 auto;
    overflow: hidden;
  }

  .driver-hint-slot {
    min-width: 0;
    overflow: hidden;
  }

  .driver-hint {
    display: block;
    overflow: hidden;
    color: var(--theme-text-dim, rgb(255 255 255 / 0.55));
    font-size: var(--font-size-min, 0.875rem);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .driver-control {
    width: min(14rem, 58%);
    margin-left: auto;
    flex: 0 0 auto;
    --theme-accent: #d9901a;
  }

  .driver-full,
  .driver-short {
    white-space: nowrap;
  }

  .driver-short {
    display: none;
  }

  /* The hint is a nicety, not chrome: once the divider squeezes the pane it
     yields its space to the title and the control. The About modal carries
     the full explanation for anyone who wants it. */
  @container shape-matrix-detail-heading (max-width: 40rem) {
    .driver-hint-slot {
      display: none;
    }
  }

  @container shape-matrix-detail-heading (max-width: 34rem) {
    .driver-full {
      display: none;
    }

    .driver-short {
      display: inline;
    }
  }

  .eyebrow {
    flex: 0 0 auto;
    color: #f4b54c;
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 650;
    letter-spacing: 0.015em;
    white-space: nowrap;
  }

  .drill-stage {
    min-width: 0;
    min-height: 0;
    padding: 0.9rem;
    overflow: hidden;
    background: #0a0f14;
    container: shape-matrix-drill / size;
  }

  .status {
    display: grid;
    place-content: center;
    width: 100%;
    height: 100%;
    text-align: center;
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

    .heading-title {
      flex: 1 1 auto;
    }

    .driver-control {
      width: min(11.5rem, 54%);
      flex: 0 0 auto;
    }
  }
</style>
