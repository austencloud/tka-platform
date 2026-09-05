<!-- src/lib/shared/shape-matrix/app/components/ShapeMatrixRecipeBar.svelte
  The grid's own recipe: what the current 4×4 is made of, always, whether it
  came from a roll or from an edit. Rows (blue, left hand) and columns (red,
  right hand) each carry their own value control, the relationship names
  the chosen hand path, and "Surprise me" rolls all three from here so the
  result lands where the eye already is. It never becomes a stale "last
  roll" message: every field reads live state. -->
<script lang="ts">
  import { spinRatioEquals } from "@vtg/domain";
  import { flyFade } from "$lib/shared/transitions/motion";
  import { flowerLabel } from "$lib/shared/shape-matrix/domain/flower-signature";
  import { matrixTurnSpokenLabel } from "$lib/shared/shape-matrix/domain/matrix-turn-band";
  import { theoryFlowerLabel } from "$lib/shared/shape-matrix/domain/theory-flower";
  import {
    theoryRatioLabel,
    theoryRatioSpokenLabel,
  } from "$lib/shared/shape-matrix/domain/theory-ratio";
  import {
    MODE_LABEL,
    type VtgMode,
  } from "$lib/shared/shape-matrix/services/shape-matrix-realizations";
  import { FAMILY_BY_MODE } from "$lib/shared/shape-matrix/services/build-mode-realizations";
  import { TND_BY_FAMILY } from "$lib/features/choreo-card/domain/tnd-element";
  import { getShapeMatrixAppContext } from "../context/shape-matrix-app-context";
  import { SHAPE_MATRIX_REVEAL } from "../services/shape-matrix-reveal";
  import ShapeMatrixAxisStepper from "./ShapeMatrixAxisStepper.svelte";
  import ShapeMatrixRatioEntry from "./ShapeMatrixRatioEntry.svelte";

  interface Props {
    /** The pane that owns this bar. Both panes stay mounted, so the bar
       describes its own grid rather than whichever surface is showing. */
    surface?: "level" | "theory";
    onsurprise: () => void;
    /** Theory's ratio editor points back at the axis it is changing. */
    onratiofocuschange?: (hand: "left" | "right" | "both" | null) => void;
  }
  let { surface, onsurprise, onratiofocuschange }: Props = $props();

  const appState = getShapeMatrixAppContext();
  const theory = $derived((surface ?? appState.surface) === "theory");

  const rowsVisible = $derived(
    theory
      ? theoryRatioLabel(appState.theoryLeftRatio)
      : appState.leftTurn === "fl"
        ? "Float"
        : String(appState.leftTurn)
  );
  const columnsVisible = $derived(
    theory
      ? theoryRatioLabel(appState.theoryRightRatio)
      : appState.rightTurn === "fl"
        ? "Float"
        : String(appState.rightTurn)
  );
  const rowsSpoken = $derived(
    theory
      ? theoryRatioSpokenLabel(appState.theoryLeftRatio)
      : matrixTurnSpokenLabel(appState.leftTurn, appState.labelMode)
  );
  const columnsSpoken = $derived(
    theory
      ? theoryRatioSpokenLabel(appState.theoryRightRatio)
      : matrixTurnSpokenLabel(appState.rightTurn, appState.labelMode)
  );

  const mode = $derived<VtgMode | null>(
    theory ? appState.theoryMode : appState.selectedMode
  );
  const relationship = $derived.by(() => {
    if (!mode) return null;
    const element = TND_BY_FAMILY[FAMILY_BY_MODE[mode] ?? ""];
    const name = element
      ? element.element.charAt(0).toUpperCase() + element.element.slice(1)
      : MODE_LABEL[mode];
    return { mode, name, accent: element?.accentColor ?? null };
  });
  const hasPair = $derived(
    theory ? appState.theoryPair !== null : appState.selectedPair !== null
  );

  const ratiosMatch = $derived(
    spinRatioEquals(appState.theoryLeftRatio, appState.theoryRightRatio)
  );
  function toggleLink(): void {
    if (appState.theoryRatiosLinked) {
      appState.unlinkTheoryRatios();
      return;
    }
    // Linking keeps the rows ratio; the bar reads left to right.
    appState.linkTheoryRatios("left");
  }

  /* One sentence for assistive technology after each roll, with everything
     the reveal shows sighted users. Reduced motion gets the same sentence,
     which is the whole reveal in that case. */
  let announcement = $state("");
  let announcedToken: number | null = null;
  $effect(() => {
    const token = appState.revealToken;
    if (announcedToken === null) {
      announcedToken = token;
      return;
    }
    if (token === announcedToken) return;
    announcedToken = token;
    // Both panes stay mounted; only the showing surface speaks the roll.
    if (theory !== (appState.surface === "theory")) return;
    const crossing = theory
      ? appState.theoryPair
        ? `${theoryFlowerLabel(appState.theoryPair.left)} over ${theoryFlowerLabel(appState.theoryPair.right)}`
        : null
      : appState.selectedPair
        ? `${flowerLabel(appState.selectedPair.left)} over ${flowerLabel(appState.selectedPair.right)}`
        : null;
    announcement = [
      `New grid. Rows ${rowsSpoken}. Columns ${columnsSpoken}.`,
      crossing ? `Crossing: left ${crossing}.` : null,
      relationship
        ? `Relationship: ${relationship.mode}, ${relationship.name}.`
        : null,
    ]
      .filter(Boolean)
      .join(" ");
  });

  const beat = SHAPE_MATRIX_REVEAL;
</script>

<div
  class="recipe-bar"
  class:theory
  class:compact={appState.compact}
  role="group"
  aria-label="Current grid"
>
  <button
    type="button"
    class="surprise"
    aria-label="Surprise me with a new grid, crossing, and hand relationship"
    title="Pick a new grid, crossing, and hand relationship"
    disabled={!theory && !appState.data}
    onclick={onsurprise}
  >
    <i class="fas fa-dice" aria-hidden="true"></i>
    <span>Surprise me</span>
  </button>

  <div class="recipe">
    {#key appState.revealToken}
      <div
        class="axis rows"
        in:flyFade={{ y: -4, duration: beat.rows.duration }}
      >
        <span class="axis-name">
          <i class="axis-dot" aria-hidden="true"></i>
          <span>Rows</span>
          <span class="arrow" aria-hidden="true">↓</span>
        </span>
        {#if appState.compact}
          <output class="readout" aria-label={`Rows: ${rowsSpoken}`}
            >{rowsVisible}</output
          >
        {:else if theory}
          <ShapeMatrixRatioEntry
            hand="left"
            layout="bar"
            onfocuschange={onratiofocuschange}
          />
        {:else}
          <ShapeMatrixAxisStepper hand="left" />
        {/if}
      </div>
    {/key}

    {#if theory && !appState.compact}
      <button
        type="button"
        class="cross link"
        class:linked={appState.theoryRatiosLinked}
        aria-pressed={appState.theoryRatiosLinked}
        aria-label={appState.theoryRatiosLinked
          ? "Unlink row and column ratios"
          : ratiosMatch
            ? "Link row and column ratios"
            : "Link column ratio to the row ratio"}
        title={appState.theoryRatiosLinked ? "Linked" : "Link ratios"}
        onclick={toggleLink}
      >
        <i class="fas fa-link" aria-hidden="true"></i>
      </button>
    {:else}
      <span class="cross" aria-hidden="true">×</span>
    {/if}

    {#key appState.revealToken}
      <div
        class="axis columns"
        in:flyFade={{
          y: -4,
          delay: beat.columns.at,
          duration: beat.columns.duration,
        }}
      >
        <span class="axis-name">
          <i class="axis-dot" aria-hidden="true"></i>
          <span>Columns</span>
          <span class="arrow" aria-hidden="true">→</span>
        </span>
        {#if appState.compact}
          <output class="readout" aria-label={`Columns: ${columnsSpoken}`}
            >{columnsVisible}</output
          >
        {:else if theory}
          <ShapeMatrixRatioEntry
            hand="right"
            layout="bar"
            onfocuschange={onratiofocuschange}
          />
        {:else}
          <ShapeMatrixAxisStepper hand="right" />
        {/if}
      </div>
    {/key}

    {#key appState.revealToken}
      <output
        class="relationship"
        class:empty={!relationship || !hasPair}
        style={relationship?.accent
          ? `--relationship-accent: ${relationship.accent}`
          : undefined}
        aria-label={relationship && hasPair
          ? `Relationship: ${relationship.mode}, ${relationship.name}, ${MODE_LABEL[relationship.mode]}`
          : "No crossing chosen yet"}
        in:flyFade={{
          y: -4,
          delay: beat.relationship.at,
          duration: beat.relationship.duration,
        }}
      >
        {#if relationship && hasPair}
          <i class="relationship-dot" aria-hidden="true"></i>
          <strong>{relationship.mode}</strong>
          <span class="relationship-name">{relationship.name}</span>
        {:else}
          <span class="relationship-name">Pick a crossing</span>
        {/if}
      </output>
    {/key}
  </div>

  <span class="sr-only" aria-live="polite">{announcement}</span>
</div>

<style>
  .recipe-bar {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    min-width: 0;
    padding: 0.45rem 0.6rem;
    border-bottom: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.1));
    background: var(--theme-panel-bg, rgb(16 23 33 / 0.82));
  }

  .surprise {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 0.45rem;
    min-height: var(--min-touch-target, 44px);
    padding: 0.45rem 0.85rem;
    border: 1px solid
      color-mix(
        in srgb,
        var(--theme-accent, #f59e0b) 58%,
        var(--theme-stroke, transparent)
      );
    border-radius: 10px;
    background: color-mix(
      in srgb,
      var(--theme-accent, #f59e0b) 13%,
      var(--theme-card-bg, transparent)
    );
    color: var(--theme-text, #fff);
    cursor: pointer;
    font: inherit;
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 750;
    white-space: nowrap;
    transition:
      border-color var(--duration-fast, 150ms) ease,
      background var(--duration-fast, 150ms) ease,
      transform var(--duration-fast, 150ms) ease;
  }

  .surprise i {
    color: var(--theme-accent, #f59e0b);
  }

  .surprise:hover:not(:disabled) {
    border-color: var(--theme-accent, #f59e0b);
    background: color-mix(
      in srgb,
      var(--theme-accent, #f59e0b) 22%,
      var(--theme-card-bg, transparent)
    );
  }

  .surprise:active:not(:disabled) {
    transform: scale(0.97);
  }

  .surprise:active:not(:disabled) i {
    animation: roll var(--duration-emphasis, 280ms) ease;
  }

  @keyframes roll {
    to {
      transform: rotate(180deg);
    }
  }

  .surprise:disabled {
    border-color: var(--theme-stroke, rgb(255 255 255 / 0.09));
    background: transparent;
    color: var(--theme-text-dim, rgb(255 255 255 / 0.42));
    cursor: wait;
    opacity: 0.6;
  }

  .surprise:focus-visible,
  .link:focus-visible {
    outline: 2px solid var(--theme-accent, #f59e0b);
    outline-offset: 2px;
  }

  .recipe {
    display: flex;
    flex: 1 1 auto;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.35rem 0.6rem;
    min-width: 0;
  }

  .axis {
    --axis-color: var(--prop-blue-text, #818cf8);
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  .axis.columns {
    --axis-color: var(--prop-red-text, #f87171);
  }

  .axis-name {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    color: var(--theme-text-dim, rgb(255 255 255 / 0.68));
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 650;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .axis-dot {
    display: block;
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: var(--axis-color);
    box-shadow: 0 0 0.5rem
      color-mix(in srgb, var(--axis-color) 45%, transparent);
  }

  .arrow {
    color: var(--axis-color);
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 800;
    letter-spacing: 0;
  }

  .readout {
    color: var(--axis-color);
    font-size: var(--font-size-md, 1rem);
    font-weight: 750;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .cross {
    display: grid;
    place-items: center;
    color: var(--theme-text-dim, rgb(255 255 255 / 0.45));
    font-size: var(--font-size-md, 1rem);
    font-weight: 700;
  }

  .link {
    width: var(--min-touch-target, 44px);
    min-height: var(--min-touch-target, 44px);
    padding: 0;
    border: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.12));
    border-radius: 10px;
    background: var(--theme-card-bg, rgb(255 255 255 / 0.05));
    color: var(--theme-text-dim, rgb(255 255 255 / 0.7));
    cursor: pointer;
    font: inherit;
    transition:
      color var(--duration-fast, 150ms) ease,
      border-color var(--duration-fast, 150ms) ease,
      background var(--duration-fast, 150ms) ease;
  }

  .link:hover {
    color: var(--theme-text, #fff);
    border-color: color-mix(
      in srgb,
      var(--theme-accent, #f59e0b) 55%,
      transparent
    );
  }

  .link.linked {
    border-color: color-mix(
      in srgb,
      var(--theme-accent, #f59e0b) 60%,
      transparent
    );
    background: color-mix(
      in srgb,
      var(--theme-accent, #f59e0b) 14%,
      transparent
    );
    color: var(--theme-accent, #f59e0b);
  }

  .relationship {
    --relationship-accent: var(--theme-accent, #f59e0b);
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: var(--min-touch-target, 44px);
    padding: 0.35rem 0.75rem;
    border: 1px solid
      color-mix(in srgb, var(--relationship-accent) 45%, transparent);
    border-radius: 10px;
    background: color-mix(in srgb, var(--relationship-accent) 10%, transparent);
    color: var(--theme-text, #fff);
    white-space: nowrap;
  }

  .relationship.empty {
    border-color: var(--theme-stroke, rgb(255 255 255 / 0.12));
    background: transparent;
    color: var(--theme-text-dim, rgb(255 255 255 / 0.6));
  }

  .relationship-dot {
    display: block;
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 50%;
    background: var(--relationship-accent);
    box-shadow: 0 0 0.5rem
      color-mix(in srgb, var(--relationship-accent) 55%, transparent);
  }

  .relationship strong {
    font-size: var(--font-size-md, 1rem);
    font-weight: 750;
  }

  .relationship-name {
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 600;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  /* Compact: one line of values beside the dice. The header popover edits
     them, so the bar's job here is to read, not to edit. */
  .recipe-bar.compact {
    gap: 0.5rem;
    padding: 0.35rem 0.5rem;
  }

  .recipe-bar.compact .surprise {
    width: var(--min-touch-target, 44px);
    justify-content: center;
    padding: 0;
  }

  .recipe-bar.compact .surprise span {
    display: none;
  }

  .recipe-bar.compact .recipe {
    flex-wrap: nowrap;
    justify-content: flex-start;
    gap: 0.45rem;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .recipe-bar.compact .axis-name > span:not(.arrow) {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }

  .recipe-bar.compact .axis-dot {
    display: none;
  }

  .recipe-bar.compact .relationship {
    min-height: 2rem;
    padding: 0.2rem 0.55rem;
  }

  .recipe-bar.compact .relationship-name {
    display: none;
  }

  /* With no crossing chosen there is nothing to abbreviate, so the compact
     bar drops the pill instead of showing an empty box. */
  .recipe-bar.compact .relationship.empty {
    display: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .surprise,
    .link {
      transition: none;
    }

    .surprise:active:not(:disabled) {
      transform: none;
    }

    .surprise:active:not(:disabled) i {
      animation: none;
    }
  }
</style>
