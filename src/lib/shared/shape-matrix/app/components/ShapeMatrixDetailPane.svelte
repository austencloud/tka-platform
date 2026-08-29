<script lang="ts">
  import ShapeMatrixDrill from "$lib/shared/shape-matrix/components/ShapeMatrixDrill.svelte";
  import { getShapeMatrixAppContext } from "../context/shape-matrix-app-context";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import type { ShapeMatrixRelationshipDriver } from "../state/shape-matrix-app-state.svelte";
  import { Popover } from "bits-ui";

  const state = getShapeMatrixAppContext();
  const DRIVER_OPTIONS = [
    { value: "hands" as const, label: "Hand path", shortLabel: "Hands" },
    {
      value: "props" as const,
      label: "Prop motion",
      shortLabel: "Props",
    },
  ];
</script>

{#snippet driverOption(driver: ShapeMatrixRelationshipDriver)}
  <i
    class={driver === "hands" ? "fas fa-hands" : "fas fa-wand-magic-sparkles"}
    aria-hidden="true"
  ></i>
  <span>{driver === "hands" ? "Hand path" : "Prop motion"}</span>
{/snippet}

<aside class="detail-pane" aria-label="Shape realization">
  <header class="pane-heading">
    <div class="heading-title">
      <span class="eyebrow">Realization</span>
      <Popover.Root>
        <Popover.Trigger>
          {#snippet child({ props })}
            <button
              {...props}
              type="button"
              class="info-action"
              aria-label="How hand and prop relationships are connected"
            >
              <i class="fas fa-circle-info" aria-hidden="true"></i>
            </button>
          {/snippet}
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            class="relationship-info-popover"
            side="bottom"
            align="start"
            sideOffset={8}
            collisionPadding={16}
          >
            <strong>Hands and props</strong>
            <p>
              Choose a hand path to see the prop relationship it produces, or
              choose a prop relationship to find a matching hand path. The
              paired result stays below the animation. Both controls describe
              the same realization from a different starting point.
            </p>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
    <div class="driver-control">
      <span class="driver-label">Choose from</span>
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
  }

  .heading-title {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    min-width: 0;
  }

  .driver-control {
    width: min(18rem, 58%);
    margin-left: auto;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 0.5rem;
    --theme-accent: #d9901a;
  }

  .driver-label {
    color: var(--theme-text-dim, rgb(255 255 255 / 0.58));
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 600;
    letter-spacing: 0.015em;
    white-space: nowrap;
  }

  .eyebrow {
    color: #f4b54c;
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 650;
    letter-spacing: 0.015em;
  }

  .info-action {
    display: grid;
    place-items: center;
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    flex: 0 0 auto;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--theme-text-dim, rgb(255 255 255 / 0.62));
    font: inherit;
    cursor: pointer;
  }

  .info-action:hover {
    color: #f4b54c;
    background: rgb(245 158 11 / 0.08);
  }

  .info-action:focus-visible {
    outline: 2px solid #f59e0b;
    outline-offset: 2px;
  }

  :global(.relationship-info-popover) {
    z-index: var(--z-dropdown, 1000);
    width: min(22rem, calc(100vw - 32px));
    padding: 1rem;
    border: 1px solid var(--theme-stroke-strong, rgb(255 255 255 / 0.18));
    border-radius: 14px;
    /* The root theme's panel token may be translucent. A portaled disclosure
       needs an opaque reading surface because it sits over animated content. */
    background: #101721;
    box-shadow: 0 18px 48px rgb(0 0 0 / 0.42);
    color: var(--theme-text, #fff);
  }

  :global(.relationship-info-popover strong) {
    display: block;
    margin-bottom: 0.35rem;
    font-size: 0.9rem;
  }

  :global(.relationship-info-popover p) {
    margin: 0;
    color: var(--theme-text-dim, rgb(255 255 255 / 0.68));
    font-size: var(--font-size-sm, 0.875rem);
    line-height: 1.5;
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

    .driver-control {
      width: min(16rem, 58%);
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

    .driver-label {
      display: none;
    }
  }
</style>
