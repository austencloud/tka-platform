<!-- One directly editable VTG ratio. Theory composes one for each axis so
     neither half of the grid is hidden behind an Apply-to mode. -->
<script lang="ts">
  import { spinRatioKey, type SpinRatio } from "@vtg/domain";
  import {
    theoryRatioFromParts,
    theoryRatioLabel,
    theoryRatioSpokenLabel,
    THEORY_RATIO_MAX_PART,
  } from "$lib/shared/shape-matrix/domain/theory-ratio";
  import { getShapeMatrixAppContext } from "../context/shape-matrix-app-context";

  interface Props {
    hand: "left" | "right";
    layout?: "ribbon" | "tray";
    onfocuschange?: (hand: "left" | "right" | null) => void;
  }
  let { hand, layout = "ribbon", onfocuschange }: Props = $props();

  const appState = getShapeMatrixAppContext();
  const current = $derived(
    hand === "left" ? appState.theoryLeftRatio : appState.theoryRightRatio
  );
  const currentKey = $derived(spinRatioKey(current));
  const axisLabel = $derived(
    hand === "left" ? "Left-hand rows" : "Right-hand columns"
  );

  let propText = $state("");
  let handText = $state("");

  /* An emptied field must stay empty long enough for the next digit. The text
     only reseeds when the applied ratio changed outside this editor. */
  let seededKey = $state<string | null>(null);

  $effect(() => {
    if (currentKey === seededKey) return;
    seededKey = currentKey;
    propText = String(current.propRotations);
    handText = String(current.handCycles);
  });

  function readPart(text: string): number | null {
    const trimmed = text.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    return Number(trimmed);
  }

  function reduceTyped(prop: string, cycle: string): SpinRatio | null {
    const propRotations = readPart(prop);
    const handCycles = readPart(cycle);
    if (propRotations === null || handCycles === null) return null;
    return theoryRatioFromParts(propRotations, handCycles);
  }

  const typed = $derived(reduceTyped(propText, handText));
  const actionLabel = $derived(theoryRatioLabel(typed ?? current));

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
      return `Each number can be 0 through ${THEORY_RATIO_MAX_PART}.`;
    }
    return null;
  });

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
    return theoryRatioLabel(typed);
  });

  function apply(): void {
    if (!typed || problem) return;
    appState.setTheoryRatioFor(hand, typed);
    // Keep 2:4 under the cursor while the grid correctly applies 1:2.
    seededKey = spinRatioKey(typed);
  }

  function useForBoth(): void {
    if (!typed || problem) return;
    appState.setTheoryRatios(typed, typed);
    seededKey = spinRatioKey(typed);
  }

  function onPart(next: string, side: "prop" | "hand"): void {
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

  function onFocusOut(event: FocusEvent): void {
    const host = event.currentTarget as HTMLElement | null;
    const next = event.relatedTarget;
    if (!host || !(next instanceof Node) || !host.contains(next)) {
      onfocuschange?.(null);
    }
  }
</script>

<section
  class="ratio-side"
  class:left={hand === "left"}
  class:right={hand === "right"}
  class:tray={layout === "tray"}
  aria-label={`${axisLabel} ratio`}
  onfocusin={() => onfocuschange?.(hand)}
  onfocusout={onFocusOut}
>
  <header class="side-head">
    <span class="axis-label">{axisLabel}</span>
    <button
      type="button"
      class="use-both"
      disabled={!typed || Boolean(problem)}
      aria-label={`Use ${actionLabel} for both axes`}
      onclick={useForBoth}
    >
      Use for both
    </button>
  </header>

  <div class="entry-row" class:invalid={Boolean(problem)}>
    <label class="part-field">
      <span>Hand cycles</span>
      <input
        type="text"
        inputmode="numeric"
        autocomplete="off"
        value={handText}
        aria-label={`${axisLabel} hand cycles`}
        aria-invalid={Boolean(problem)}
        oninput={(event) => onPart(event.currentTarget.value, "hand")}
        onkeydown={(event) => onKey(event, "hand")}
      />
    </label>

    <span class="colon" aria-hidden="true">:</span>

    <label class="part-field">
      <span>Prop rotations</span>
      <input
        type="text"
        inputmode="numeric"
        autocomplete="off"
        value={propText}
        aria-label={`${axisLabel} prop rotations`}
        aria-invalid={Boolean(problem)}
        oninput={(event) => onPart(event.currentTarget.value, "prop")}
        onkeydown={(event) => onKey(event, "prop")}
      />
    </label>
  </div>

  <div class="feedback" aria-live="polite">
    {#if problem}
      <span class="problem">{problem}</span>
    {:else if reducedNote}
      <span class="reduced">Reduces to {reducedNote}</span>
    {/if}
  </div>

  <span class="sr-only" aria-live="polite">
    {theoryRatioSpokenLabel(current)}
  </span>
</section>

<style>
  .ratio-side {
    --axis-color: var(--theme-accent, #f59e0b);
    --axis-base: var(--theme-accent, #f59e0b);
    display: grid;
    grid-template-rows: auto auto 1.9rem;
    width: 15rem;
    min-width: 0;
    gap: 0.45rem;
    padding: 0.5rem;
    border: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.12));
    border-radius: 10px;
    background: var(--theme-card-bg, rgb(255 255 255 / 0.05));
    transition:
      border-color var(--duration-fast, 150ms) var(--transition-easing, ease),
      background var(--duration-fast, 150ms) var(--transition-easing, ease),
      box-shadow var(--duration-fast, 150ms) var(--transition-easing, ease);
  }

  .ratio-side.left {
    --axis-color: var(--prop-blue-text, #818cf8);
    --axis-base: var(--prop-blue, #2e3192);
  }

  .ratio-side.right {
    --axis-color: var(--prop-red-text, #f87171);
    --axis-base: var(--prop-red, #ed1c24);
  }

  .ratio-side:focus-within {
    border-color: color-mix(in srgb, var(--axis-color) 72%, transparent);
    background: color-mix(
      in srgb,
      var(--axis-base) 10%,
      var(--theme-card-bg, rgb(255 255 255 / 0.05))
    );
    box-shadow: inset 0 0 0 1px
      color-mix(in srgb, var(--axis-color) 34%, transparent);
  }

  .side-head {
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .axis-label {
    color: var(--axis-color);
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 700;
    white-space: nowrap;
  }

  .use-both {
    min-height: var(--min-touch-target, 44px);
    flex: 0 0 auto;
    padding: 0.35rem 0.6rem;
    border: 1px solid var(--theme-stroke, rgb(255 255 255 / 0.12));
    border-radius: 8px;
    background: color-mix(in srgb, var(--axis-base) 7%, transparent);
    color: var(--theme-text-dim, rgb(255 255 255 / 0.72));
    cursor: pointer;
    font: inherit;
    font-size: var(--font-size-min, 0.875rem);
    white-space: nowrap;
    transition:
      color var(--duration-fast, 150ms) var(--transition-easing, ease),
      border-color var(--duration-fast, 150ms) var(--transition-easing, ease),
      background var(--duration-fast, 150ms) var(--transition-easing, ease);
  }

  .use-both:hover:not(:disabled) {
    border-color: color-mix(in srgb, var(--axis-color) 58%, transparent);
    background: color-mix(in srgb, var(--axis-base) 16%, transparent);
    color: var(--theme-text, #fff);
  }

  .use-both:focus-visible {
    outline: 2px solid var(--axis-color);
    outline-offset: 2px;
  }

  .use-both:disabled {
    cursor: not-allowed;
    opacity: 0.42;
  }

  .entry-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: end;
    gap: 0.35rem;
  }

  .part-field {
    display: grid;
    min-width: 0;
    gap: 0.25rem;
    color: var(--theme-text-dim, rgb(255 255 255 / 0.58));
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 600;
    text-align: center;
  }

  .part-field input {
    width: 100%;
    min-width: 0;
    height: var(--min-touch-target, 44px);
    padding: 0 0.35rem;
    border: 1px solid var(--theme-stroke-strong, rgb(255 255 255 / 0.2));
    border-radius: 8px;
    background: color-mix(in srgb, #000 34%, transparent);
    color: var(--theme-text, #fff);
    font: inherit;
    font-size: 1.125rem;
    font-weight: 750;
    font-variant-numeric: tabular-nums;
    text-align: center;
    transition:
      border-color var(--duration-fast, 150ms) var(--transition-easing, ease),
      background var(--duration-fast, 150ms) var(--transition-easing, ease);
  }

  .part-field input:hover {
    border-color: color-mix(in srgb, var(--axis-color) 48%, transparent);
  }

  .part-field input:focus-visible {
    border-color: var(--axis-color);
    outline: 2px solid color-mix(in srgb, var(--axis-color) 72%, transparent);
    outline-offset: 1px;
    background: color-mix(in srgb, var(--axis-base) 12%, #000 88%);
  }

  .entry-row.invalid .part-field input {
    border-color: color-mix(
      in srgb,
      var(--semantic-danger, #ef4444) 68%,
      transparent
    );
  }

  .colon {
    display: grid;
    height: var(--min-touch-target, 44px);
    place-items: center;
    color: var(--theme-text-dim, rgb(255 255 255 / 0.55));
    font-size: 1.125rem;
    font-weight: 750;
  }

  .feedback {
    min-width: 0;
    color: var(--theme-text-dim, rgb(255 255 255 / 0.62));
    font-size: var(--font-size-compact, 0.75rem);
    line-height: 1.25;
  }

  .problem {
    color: color-mix(in srgb, var(--semantic-danger, #ef4444) 30%, #fff);
  }

  .reduced {
    color: color-mix(in srgb, var(--theme-accent, #f59e0b) 82%, #fff);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .ratio-side.tray {
    width: 100%;
  }

  @media (prefers-reduced-motion: reduce) {
    .ratio-side,
    .use-both,
    .part-field input {
      transition: none;
    }
  }
</style>
