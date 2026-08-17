<!--
  FuseLevelTile — the Level slot on the header's recipe rail.

  Three values in order, so the tile steps through them the way Grid switches
  between its two: minus, the level, plus. A popover to move from 2 to 3 is a
  panel that exists to hold one press.

  The turn ceiling still lives in the recipe panel's Level section, because it is
  a second value with up to four settings and it only exists above level 1 — the
  tile states it (`≤2 turns`) rather than trying to edit it.
-->
<script lang="ts">
  import { DIFFICULTY_LEVELS } from "$lib/shared/config/difficulty-styles";
  import { getFuseContext } from "../context/fuse-context";
  import FuseRailTile from "./FuseRailTile.svelte";

  let {
    summary,
    disabled = false,
  }: {
    /** The recipe summary line, e.g. "Level 2 · ≤2 turns". */
    summary: string;
    disabled?: boolean;
  } = $props();

  const { state: fuseState } = getFuseContext();

  const MIN_LEVEL = 1;
  const MAX_LEVEL = 3;

  // The app's level palette — pale blue at 1, silver at 2, gold at 3 — so the
  // tile shows the level the same way the badges and the printed cards do.
  const LEVEL_SHADOWS: Record<number, string> = {
    1: "202deg 80% 58%",
    2: "0deg 0% 45%",
    3: "45deg 92% 45%",
  };
  const style = $derived(
    DIFFICULTY_LEVELS[fuseState.generationLevel] ?? DIFFICULTY_LEVELS[1]!
  );
  const shadowColor = $derived(
    LEVEL_SHADOWS[fuseState.generationLevel] ?? "0deg 0% 45%"
  );
  // The turn ceiling, without repeating the number the stepper already shows.
  const detail = $derived(summary.split(" · ")[1] ?? "");

  function step(offset: -1 | 1): void {
    if (disabled) return;
    const next = fuseState.generationLevel + offset;
    if (next < MIN_LEVEL || next > MAX_LEVEL) return;
    fuseState.setGenerationLevel(next);
  }
</script>

<FuseRailTile
  label="Level"
  ariaLabel="Level: {summary}"
  color={style.cssBg}
  {shadowColor}
  textColor={style.text}
>
  {#snippet trailing()}
    <span class="level-detail">{detail}</span>
  {/snippet}

  <div class="level-stepper">
    <button
      type="button"
      class="step"
      disabled={disabled || fuseState.generationLevel <= MIN_LEVEL}
      onclick={() => step(-1)}
      aria-label="Lower the level"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /></svg>
    </button>

    <strong class="level-value" aria-live="polite"
      >Level {fuseState.generationLevel}</strong
    >

    <button
      type="button"
      class="step"
      disabled={disabled || fuseState.generationLevel >= MAX_LEVEL}
      onclick={() => step(1)}
      aria-label="Raise the level"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"
        ><path d="M12 5v14M5 12h14" /></svg
      >
    </button>
  </div>
</FuseRailTile>

<style>
  .level-stepper {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .step {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    flex: 0 0 auto;
    padding: 0;
    border: 1px solid color-mix(in srgb, currentColor 34%, transparent);
    border-radius: 10px;
    color: inherit;
    background: color-mix(in srgb, black 16%, transparent);
    cursor: pointer;
    transition:
      border-color var(--duration-fast, 120ms) ease,
      background var(--duration-fast, 120ms) ease;
  }

  .step:hover:not(:disabled) {
    border-color: color-mix(in srgb, currentColor 70%, transparent);
    background: color-mix(in srgb, black 26%, transparent);
  }

  .step:focus-visible {
    outline: 3px solid currentColor;
    outline-offset: 2px;
  }

  .step:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .step svg {
    width: 60%;
    height: 60%;
    stroke: currentColor;
    stroke-width: 3;
    stroke-linecap: round;
    fill: none;
  }

  /* Tabular figures and a centred cell: stepping 1 → 3 must not move the
     buttons on either side of it. */
  .level-value {
    overflow: hidden;
    font-size: var(--font-size-min, 14px);
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .level-detail {
    overflow: hidden;
    font-size: var(--font-size-compact, 12px);
    font-weight: 650;
    opacity: 0.78;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (min-width: 2600px) and (min-height: 1400px) {
    .step {
      width: 2.6rem;
      height: 2.6rem;
    }

    .level-value {
      font-size: 1rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .step {
      transition: none;
    }
  }
</style>
