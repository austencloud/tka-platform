<!--
  ConstructSection.svelte — live construct demo for the composer-wings TEST page.

  Mounts the REAL construct primitives (StartPositionPicker + OptionPicker) so a
  visitor can build a short sequence: pick a start position, then tap valid Type-1
  next steps and watch the word grow. Fully self-contained — owns its own local
  $state and deliberately does NOT touch the shared create-tutorial singleton, so
  this preview can never collide with a real build in progress. Marketing-demo
  surface, not shipping chrome; a parent page provides the section frame.
-->
<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { createSimplifiedStartPositionState } from "$lib/shared/create/state/start-position-state.svelte";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import {
    getLetterType,
    type Letter,
  } from "$lib/shared/foundation/domain/models/letter";
  import { LetterType } from "$lib/shared/foundation/domain/models/letter-type";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";

  const MAX_STEPS = 4;

  // Isolated demo state — start position + picked steps. The full sequence and
  // display word are derived from these two, so the UI stays in lockstep.
  let startPosition = $state<PictographData | null>(null);
  let gridMode = $state<GridMode>(GridMode.DIAMOND);
  let steps = $state<PictographData[]>([]);

  // The real start-position picker drives its own state object; we subscribe to
  // the user's pick and lift it into our local demo state (source "sync" changes
  // — e.g. our own clear on reset — are ignored, exactly like the tutorial step).
  const startPositionState = createSimplifiedStartPositionState();
  let unsubscribe: (() => void) | null = null;

  onMount(() => {
    unsubscribe = startPositionState.onSelectedPositionChange(
      (position, source) => {
        if (source === "user" && position) {
          startPosition = position;
          gridMode = startPositionState.currentGridMode;
          steps = [];
        }
      },
    );
  });

  onDestroy(() => {
    unsubscribe?.();
  });

  // Full sequence fed to the option picker: start position + every picked step.
  const currentSequence = $derived<PictographData[]>(
    startPosition ? [startPosition, ...steps] : [],
  );

  // Three phases, derived straight from state.
  const phase = $derived<"pick-start" | "add-step" | "done">(
    !startPosition
      ? "pick-start"
      : steps.length >= MAX_STEPS
        ? "done"
        : "add-step",
  );

  // sequence.word is DATA (the expanded letters); what the user reads is the
  // simplified form — repeated words always collapse to their smallest form.
  const rawWord = $derived(steps.map((s) => s.letter ?? "").join(""));
  const displayWord = $derived(simplifyRepeatedWord(rawWord));

  // Only Type 1 (dual-shift) options, presented as the whole set — mirrors the
  // create tutorial so first-time builders see one clean, valid family.
  function isType1(option: PictographData): boolean {
    return (
      !!option.letter &&
      getLetterType(option.letter as Letter) === LetterType.TYPE1
    );
  }

  function handleOptionSelected(option: PictographData) {
    if (steps.length >= MAX_STEPS) return;
    steps = [...steps, option];
  }

  function reset() {
    steps = [];
    startPosition = null;
    startPositionState.clearSelectedPosition();
  }
</script>

<section class="construct-demo">
  <header class="demo-status">
    {#if phase === "pick-start"}
      <p class="hint">Pick a starting position to begin.</p>
    {:else}
      <p class="word-line">
        <span class="word-label">Your sequence</span>
        <span class="word">{displayWord || "—"}</span>
        <span class="count">
          Step <span class="num">{steps.length}</span>/<span class="num"
            >{MAX_STEPS}</span
          >
        </span>
      </p>
    {/if}
  </header>

  <div class="picker-container">
    {#if phase === "pick-start"}
      {#await import("$lib/features/create/construct/start-position-picker/components/StartPositionPicker.svelte") then mod}
        <mod.default {startPositionState} embedded />
      {/await}
    {:else if phase === "add-step"}
      {#await import("$lib/features/create/construct/option-picker/components/OptionPicker.svelte") then mod}
        <mod.default
          {currentSequence}
          currentGridMode={gridMode}
          onOptionSelected={handleOptionSelected}
          filterPredicate={isType1}
          hideFilters
        />
      {/await}
    {:else}
      <div class="done-state">
        <p class="done-eyebrow">You built</p>
        <p class="done-word">{displayWord}</p>
        <p class="done-sub">
          {MAX_STEPS} steps from a single start position.
        </p>
        <button type="button" class="reset-btn" onclick={reset}>
          Build another
        </button>
      </div>
    {/if}
  </div>
</section>

<style>
  .construct-demo {
    container-type: inline-size;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    width: 100%;
    /* Fills a wide showcase band; capped so the 3 start tiles stay ~one-third
       each rather than sprawling on a 4K canvas. */
    max-width: min(100%, 1040px);
    margin: 0 auto;
    text-align: center;
    color: var(--theme-text, #fff);
  }

  .demo-status {
    min-height: 1.6rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .hint {
    margin: 0;
    font-size: 0.95rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .word-line {
    margin: 0;
    display: inline-flex;
    align-items: baseline;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px 14px;
  }

  .word-label {
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .word {
    font-size: 1.4rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--theme-text, #fff);
  }

  .count {
    font-size: 0.85rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  /* Digits never jitter the layout as the count climbs. */
  .num {
    font-variant-numeric: tabular-nums;
  }

  .picker-container {
    width: 100%;
    /* Viewport-keyed so the start tiles + option grid grow with the screen
       instead of sitting small on a big monitor. */
    height: clamp(340px, 54vh, 720px);
  }

  /* The option grid caps its tile size; in a tall picker it top-aligns because
     the single-section fallback drops the grid into a flex item that isn't a
     flex container. Center it, scoped to this demo picker. */
  .picker-container :global(.swipe-container) {
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .done-state {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 24px;
    border-radius: 20px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.6));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .done-eyebrow {
    margin: 0;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
  }

  .done-word {
    margin: 0;
    font-size: clamp(2rem, 8cqw, 3.2rem);
    font-weight: 800;
    letter-spacing: 0.04em;
    color: var(--theme-text, #fff);
  }

  .done-sub {
    margin: 0 0 6px;
    font-size: 0.9rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .reset-btn {
    min-height: 44px;
    padding: 0 22px;
    border-radius: 999px;
    border: 1px solid
      color-mix(in srgb, var(--theme-accent, #8b5cf6) 55%, transparent);
    background: color-mix(
      in srgb,
      var(--theme-accent, #8b5cf6) 22%,
      transparent
    );
    color: var(--theme-text, #fff);
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition:
      background 0.16s ease,
      transform 0.16s ease;
  }

  .reset-btn:hover {
    background: color-mix(
      in srgb,
      var(--theme-accent, #8b5cf6) 34%,
      transparent
    );
    transform: translateY(-1px);
  }

  .reset-btn:active {
    transform: translateY(0);
  }

  @media (max-width: 480px) {
    .picker-container {
      height: clamp(340px, 60vh, 520px);
    }
    .word {
      font-size: 1.25rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .reset-btn {
      transition: none;
    }
  }
</style>
