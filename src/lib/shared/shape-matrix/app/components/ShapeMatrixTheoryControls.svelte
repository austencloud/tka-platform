<!-- Theory is an equation, not a serial settings form. Both axis ratios stay
     visible so the control reads the same way as the grid it builds. -->
<script lang="ts">
  import { THEORY_RATIO_MAX_PART } from "$lib/shared/shape-matrix/domain/theory-ratio";
  import ShapeMatrixRatioEntry from "./ShapeMatrixRatioEntry.svelte";

  interface Props {
    layout?: "ribbon" | "tray";
    onfocuschange?: (hand: "left" | "right" | null) => void;
  }
  let { layout = "ribbon", onfocuschange }: Props = $props();
</script>

<section
  class="theory-builder"
  class:tray={layout === "tray"}
  aria-labelledby="theory-ratio-builder-title"
>
  <header class="builder-head">
    <span class="builder-title" id="theory-ratio-builder-title">
      Build a 4×4 ratio grid
    </span>
    <span class="builder-hint">
      Any whole number 0–{THEORY_RATIO_MAX_PART}
    </span>
  </header>

  <div class="ratio-equation">
    <ShapeMatrixRatioEntry hand="left" {layout} {onfocuschange} />
    <span class="against">against</span>
    <ShapeMatrixRatioEntry hand="right" {layout} {onfocuschange} />
  </div>
</section>

<style>
  .theory-builder {
    display: grid;
    width: fit-content;
    max-width: 100%;
    gap: 0.5rem;
    padding: 0.55rem;
    border: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.12));
    border-radius: 12px;
    background: color-mix(
      in srgb,
      var(--theme-panel-bg, #101721) 88%,
      transparent
    );
    box-shadow: inset 0 1px 0
      color-mix(in srgb, var(--theme-text, #fff) 4%, transparent);
  }

  .builder-head {
    display: flex;
    min-width: 0;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
  }

  .builder-title {
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 750;
  }

  .builder-hint {
    color: var(--theme-text-dim, rgb(255 255 255 / 0.58));
    font-size: var(--font-size-compact, 0.75rem);
    white-space: nowrap;
  }

  .ratio-equation {
    display: grid;
    grid-template-columns: minmax(0, 1fr) max-content minmax(0, 1fr);
    align-items: center;
    gap: 0.55rem;
    min-width: 0;
  }

  .against {
    color: var(--theme-text-dim, rgb(255 255 255 / 0.62));
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 650;
  }

  .theory-builder.tray {
    width: min(21rem, calc(100vw - 2.5rem));
    border: 0;
    padding: 0;
    background: transparent;
    box-shadow: none;
  }

  .theory-builder.tray .builder-head {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.15rem;
  }

  .theory-builder.tray .ratio-equation {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.35rem;
  }

  .theory-builder.tray .against {
    justify-self: center;
  }

  @media (min-width: 50rem) and (max-height: 30rem) {
    .theory-builder.tray {
      width: min(34rem, calc(100vw - 2.5rem));
    }

    .theory-builder.tray .builder-head {
      align-items: baseline;
      flex-direction: row;
      gap: 1rem;
    }

    .theory-builder.tray .ratio-equation {
      grid-template-columns: minmax(0, 1fr) max-content minmax(0, 1fr);
      gap: 0.55rem;
    }
  }
</style>
