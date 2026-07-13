<!--
  ComposerMicroGameDemo

  The Games bento cell: one playable round of "Name That Pictograph" using
  the fixture's four letters (C, Ψ, Ω, X). Real GuidePictograph render with
  the TKA glyph hidden (it would give the answer away), four letter buttons,
  score streak. Pure client, no engine.
-->
<script lang="ts">
  import GuidePictograph from "../../guide/level-1/_components/GuidePictograph.svelte";
  import { DEMO_LETTER_BEATS } from "../_data/demo-beats";

  const LETTERS = DEMO_LETTER_BEATS.map((b) => String(b.letter));

  let roundIndex = $state(Math.floor(Math.random() * DEMO_LETTER_BEATS.length));
  let picked = $state<string | null>(null);
  let streak = $state(0);
  let best = $state(0);

  const current = $derived(DEMO_LETTER_BEATS[roundIndex]);
  const answer = $derived(String(current?.letter));

  function pick(letter: string) {
    if (picked !== null) return;
    picked = letter;
    if (letter === answer) {
      streak += 1;
      if (streak > best) best = streak;
    } else {
      streak = 0;
    }
    setTimeout(() => {
      picked = null;
      let next = Math.floor(Math.random() * DEMO_LETTER_BEATS.length);
      if (next === roundIndex) next = (next + 1) % DEMO_LETTER_BEATS.length;
      roundIndex = next;
    }, 900);
  }
</script>

<div class="game-demo">
  <div class="game-stage" class:right={picked !== null && picked === answer} class:wrong={picked !== null && picked !== answer}>
    {#key current?.id}
      <GuidePictograph data={current} size="md" bordered showTKA={false} eager />
    {/key}
  </div>
  <div class="choices">
    {#each LETTERS as letter}
      <button
        type="button"
        class="choice tka-font"
        class:hit={picked === letter && letter === answer}
        class:miss={picked === letter && letter !== answer}
        onclick={() => pick(letter)}
        disabled={picked !== null}
      >
        {letter}
      </button>
    {/each}
  </div>
  <div class="scoreline">
    <span>Which letter is this?</span>
    <span class="score">streak <strong>{streak}</strong> · best <strong>{best}</strong></span>
  </div>
</div>

<style>
  .game-demo {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.9rem 0.8rem 0.2rem;
  }

  .game-stage {
    border-radius: 10px;
    transition: box-shadow 160ms ease;
  }
  .game-stage.right {
    box-shadow: 0 0 0 3px oklch(0.7 0.18 150);
  }
  .game-stage.wrong {
    box-shadow: 0 0 0 3px oklch(0.6 0.2 25);
  }

  .choices {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.8rem;
  }

  .choice {
    min-width: 48px;
    min-height: 44px;
    font-size: 1.15rem;
    color: oklch(0.88 0.02 270);
    background: oklch(0.3 0.04 270 / 0.18);
    border: 1px solid oklch(0.5 0.06 270 / 0.3);
    border-radius: 11px;
    cursor: pointer;
    transition:
      background 140ms ease,
      border-color 140ms ease;
  }
  .choice:hover:not(:disabled) {
    background: oklch(0.34 0.05 270 / 0.28);
  }
  .choice.hit {
    background: oklch(0.4 0.12 150 / 0.4);
    border-color: oklch(0.7 0.18 150);
  }
  .choice.miss {
    background: oklch(0.4 0.14 25 / 0.35);
    border-color: oklch(0.6 0.2 25);
  }
  .choice:disabled {
    cursor: default;
  }

  .scoreline {
    display: flex;
    align-items: baseline;
    gap: 0.8rem;
    margin-top: 0.7rem;
    font-size: 0.8rem;
    color: oklch(0.62 0.02 270);
  }
  .score {
    font-variant-numeric: tabular-nums;
  }
  .score strong {
    color: oklch(0.88 0.03 270);
  }

  @media (prefers-reduced-motion: reduce) {
    .game-stage,
    .choice {
      transition: none;
    }
  }
</style>
