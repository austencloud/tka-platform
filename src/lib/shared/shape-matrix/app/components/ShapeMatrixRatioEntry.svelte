<!-- src/lib/shared/shape-matrix/app/components/ShapeMatrixRatioEntry.svelte
  Type the ratio. Two whole numbers, prop rotations over hand cycles.

  This replaces a scroller over the open band, which asked a viewer who already
  knew they wanted 4:9 to go find 4:9 in a list of twenty-nine, and which could
  only ever offer the band that happened to be open. The numbers are bounded by
  the CATALOG instead: anything the field holds can be typed straight in, and
  the band control follows to report where that ratio lives.

  It reduces on the way in, so 2:4 applies 1:2, and it says so in the caption
  rather than rewriting the digits under the cursor. A pair the catalog does not
  hold is refused with the reason, never snapped to a neighbour: a jump control
  that lands somewhere else is worse than one that says no. -->
<script lang="ts">
  import {
    makeSpinRatio,
    spinRatioEquals,
    spinRatioKey,
    type SpinRatio,
  } from "@vtg/domain";
  import {
    narrowestBandFor,
    theoryRatioSpokenLabel,
    THEORY_RATIO_MAX_PART,
  } from "$lib/shared/shape-matrix/domain/theory-ratio-band";
  import { growFade } from "$lib/shared/transitions/motion";
  import ShapeMatrixRibbonCell from "./ShapeMatrixRibbonCell.svelte";
  import { getShapeMatrixAppContext } from "../context/shape-matrix-app-context";

  interface Props {
    /** Ribbon: the header band. Tray: the compact detail sheet. */
    layout?: "ribbon" | "tray";
  }
  let { layout = "ribbon" }: Props = $props();

  const appState = getShapeMatrixAppContext();

  /*
   * The two axes can hold different ratios, and then there is no single pair of
   * numbers to show. Apply to says which axis is being edited, so this reads
   * the one it points at, and blanks only when "both" is aimed at a split pair.
   */
  const mixed = $derived(
    appState.activeAxis === "both" &&
      !spinRatioEquals(appState.theoryLeftRatio, appState.theoryRightRatio)
  );
  const current = $derived(appState.activeTheoryRatio);
  const currentKey = $derived(mixed ? "" : spinRatioKey(current));

  let propText = $state("");
  let handText = $state("");

  /*
   * The fields are typed into, so they cannot simply mirror the state.
   * Reduction would rewrite 2:4 to 1:2 the instant the second digit landed,
   * and an emptied field would refill itself before the next keystroke. So the
   * text follows the applied ratio only when that ratio changed somewhere
   * ELSE: the grid, the band, a link, the Apply to axis. `seededKey` is what
   * this control has already accounted for.
   */
  let seededKey = $state<string | null>(null);

  $effect(() => {
    if (currentKey === seededKey) return;
    seededKey = currentKey;
    propText = mixed ? "" : String(current.propRotations);
    handText = mixed ? "" : String(current.handCycles);
  });

  function readPart(text: string): number | null {
    const trimmed = text.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    return Number(trimmed);
  }

  /** The reduced ratio a pair of fields describes, or null while it cannot. */
  function reduceTyped(prop: string, hand: string): SpinRatio | null {
    const propRotations = readPart(prop);
    const handCycles = readPart(hand);
    if (propRotations === null || handCycles === null) return null;
    try {
      return makeSpinRatio(propRotations, handCycles);
    } catch {
      return null;
    }
  }

  const typed = $derived(reduceTyped(propText, handText));

  /**
   * Why the typed pair is not on screen, or null when it is.
   *
   * Each case names the bound it crossed rather than reporting "invalid". The
   * bounds are the catalog's own: nothing over nine on either side, prop
   * rotations no further than hand cycles, and not both zero.
   */
  const problem = $derived.by<string | null>(() => {
    const propRotations = readPart(propText);
    const handCycles = readPart(handText);
    if (propRotations === null || handCycles === null) return null;
    if (propRotations === 0 && handCycles === 0) {
      return "A ratio needs a hand cycle or a prop rotation.";
    }
    if (
      propRotations > THEORY_RATIO_MAX_PART ||
      handCycles > THEORY_RATIO_MAX_PART
    ) {
      return `The catalog stops at ${THEORY_RATIO_MAX_PART} on each side.`;
    }
    if (typed && narrowestBandFor(typed) === null) {
      return "Prop rotations cannot pass hand cycles.";
    }
    return null;
  });

  /** Shown when what was typed is not already in lowest terms. */
  const reducedNote = $derived.by<string | null>(() => {
    if (!typed || problem) return null;
    const propRotations = readPart(propText);
    const handCycles = readPart(handText);
    if (
      propRotations === typed.propRotations &&
      handCycles === typed.handCycles
    ) {
      return null;
    }
    return spinRatioKey(typed);
  });

  function apply(): void {
    if (!typed || problem) return;
    appState.setTheoryRatio(typed);
    // Account for the change here so the seeding effect leaves the digits
    // alone. Without it, typing 2 and 4 would snap the fields to 1 and 2.
    seededKey = spinRatioKey(typed);
  }

  function onPart(next: string, side: "prop" | "hand"): void {
    // Drop non-digits rather than refusing the keystroke: a field that
    // silently eats input reads as broken. Two digits is past every bound,
    // which is enough to let the message explain the bound.
    const digits = next.replace(/\D/g, "").slice(0, 2);
    if (side === "prop") propText = digits;
    else handText = digits;
    apply();
  }

  function nudge(side: "prop" | "hand", delta: number): void {
    const from = readPart(side === "prop" ? propText : handText) ?? 0;
    const next = Math.min(THEORY_RATIO_MAX_PART, Math.max(0, from + delta));
    onPart(String(next), side);
  }

  function onKey(event: KeyboardEvent, side: "prop" | "hand"): void {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      nudge(side, 1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      nudge(side, -1);
    }
  }
</script>

<div class="entry-host" class:tray={layout === "tray"}>
  <ShapeMatrixRibbonCell label="Ratio" tray={layout === "tray"} keepLabel>
    {#snippet note()}
      {#if reducedNote}
        <span class="reduced">is {reducedNote}</span>
      {/if}
    {/snippet}
    <div class="entry-stack">
      <div class="entry-row" class:invalid={Boolean(problem)}>
        <input
          class="part"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          value={propText}
          placeholder={mixed ? "–" : ""}
          aria-label="Prop rotations"
          aria-invalid={Boolean(problem)}
          oninput={(event) => onPart(event.currentTarget.value, "prop")}
          onkeydown={(event) => onKey(event, "prop")}
        />
        <span class="colon" aria-hidden="true">:</span>
        <input
          class="part"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          value={handText}
          placeholder={mixed ? "–" : ""}
          aria-label="Hand cycles"
          aria-invalid={Boolean(problem)}
          oninput={(event) => onPart(event.currentTarget.value, "hand")}
          onkeydown={(event) => onKey(event, "hand")}
        />
      </div>

      <!-- Out of flow in the ribbon, so a refused pair explains itself without
           resizing the header band and shifting the grid below it. The tray
           clips its own overflow, so there the message joins the flow and the
           sheet grows to hold it. -->
      {#if problem}
        <p class="entry-problem" role="status" transition:growFade>{problem}</p>
      {/if}

      <!-- Two labelled number fields say what to type but never what came of
           it. The scroller this replaced spoke the whole ratio on every step,
           and that is the part worth keeping. -->
      <span class="sr-only" aria-live="polite">
        {mixed ? "Mixed axis ratios" : theoryRatioSpokenLabel(current)}
      </span>
    </div>
  </ShapeMatrixRibbonCell>
</div>

<style>
  .entry-host {
    display: contents;
  }

  .entry-stack {
    position: relative;
  }

  .entry-row {
    display: flex;
    align-items: center;
    gap: 0.15rem;
    /* Every control beside this one measures 44px, in the ribbon and in the
       tray. A short field would read as a lesser control and miss the touch
       floor, so the row carries the height and the inputs fill it. */
    min-height: 2.75rem;
    padding: 0.1rem 0.3rem;
    border: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.14));
    border-radius: 9px;
    background: color-mix(in srgb, #000 24%, transparent);
    transition: border-color var(--transition-fast, 140ms) ease;
  }

  .entry-row:focus-within {
    border-color: color-mix(
      in srgb,
      var(--theme-accent, #f59e0b) 72%,
      transparent
    );
  }

  .entry-row.invalid {
    border-color: color-mix(
      in srgb,
      var(--semantic-danger, #ef4444) 68%,
      transparent
    );
  }

  /* A definite width, not a content width: a field growing from one digit to
     two would shove the colon and its neighbour on every keystroke. */
  .part {
    align-self: stretch;
    width: 2.25rem;
    padding: 0;
    border: 0;
    border-radius: 5px;
    background: transparent;
    color: var(--theme-text, #fff);
    font: inherit;
    /* Read and chosen, so it keeps the 14px essential-text step. */
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    text-align: center;
  }

  .part:focus-visible {
    outline: 2px solid
      color-mix(in srgb, var(--theme-accent, #f59e0b) 80%, transparent);
    outline-offset: 1px;
  }

  .colon {
    color: var(--theme-text-dim, rgb(255 255 255 / 0.55));
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 700;
  }

  .reduced {
    color: color-mix(in srgb, var(--theme-accent, #f59e0b) 82%, #fff);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
    text-transform: none;
  }

  .entry-problem {
    position: absolute;
    top: calc(100% + 0.3rem);
    left: 0;
    z-index: 6;
    margin: 0;
    /* Out of flow against a two-field row, so shrink-to-fit would cap this at
       the row's own ~76px and stack the sentence one word per line. Ask for the
       content width and clamp it instead, and let the clamp track the viewport
       so a cell sitting near the right edge cannot push the page sideways. */
    width: max-content;
    max-width: min(14rem, calc(100vw - 1.5rem));
    padding: 0.3rem 0.45rem;
    border: 1px solid
      color-mix(in srgb, var(--semantic-danger, #ef4444) 42%, transparent);
    border-radius: 8px;
    background: var(--theme-panel-bg, #101721);
    box-shadow: 0 6px 18px rgb(0 0 0 / 0.38);
    color: color-mix(in srgb, var(--semantic-danger, #ef4444) 30%, #fff);
    font-size: var(--font-size-compact, 0.75rem);
    line-height: 1.25;
  }

  /* The tray is a scrolling sheet with its own bounds, so an absolutely
     positioned message is sliced off at the panel edge. In flow it is the last
     thing in the last cell, so it pushes nothing and the sheet simply grows. */
  /* The tray gives every control the full cell — the Apply to row spans it, and
     a 92px ratio box floating at its left edge read as an unfinished one. It
     also gives the message below a real width to fill. */
  .entry-host.tray .entry-stack {
    width: 100%;
  }

  .entry-host.tray .entry-row {
    justify-content: center;
  }

  .entry-host.tray .entry-problem {
    position: static;
    /* The sheet sizes itself from its contents, so a sentence joining the flow
       would widen the whole panel and reflow the controls above it. Zero width
       contributes nothing to that measurement; the percentage minimum then
       fills whatever width the sheet settled on for everything else. */
    width: 0;
    min-width: 100%;
    max-width: none;
    margin-top: 0.35rem;
  }

  @media (prefers-reduced-motion: reduce) {
    .entry-row {
      transition: none;
    }
  }
</style>
