<script lang="ts">
  import { getLetterPronunciation } from "$lib/shared/pronunciation/pronunciation-plan";

  import SessionReport from "./SessionReport.svelte";

  interface SessionView {
    status: string;
    abortReason: string | null;
    folderName: string | null;
    currentWord: readonly string[] | null;
    nextWord: readonly string[] | null;
    completed: number;
    remaining: number;
    retired: readonly (readonly string[])[];
    levelDb: number;
    start: () => Promise<void>;
  }

  let { session }: { session: SessionView } = $props();

  /**
   * The word as it is written — the thing he actually reads. Never routed
   * through `simplifyRepeatedWord`: that rule is for displaying a sequence
   * label, and this is a script. A word that repeats four times has to be read
   * four times or the aligner is handed a quarter of what it was promised.
   */
  const written = (word: readonly string[] | null) => word?.join("") ?? "";

  /**
   * How to say it, in the shorthand — "sig dash ome dash lam". Subordinate to
   * the written word on purpose: it settles that `Σ-` is read "sig dash" and
   * not "sigma dash", which is the difference between a token bank that plays
   * back at conversational speed and one that recites Greek.
   */
  const spoken = (word: readonly string[] | null) =>
    word
      ?.map((letter) => getLetterPronunciation(letter as never)?.shortName ?? letter)
      .join(" ") ?? "";

  // -60 dBFS reads as empty, 0 as full. A linear map of dBFS is the only meter
  // that shows a quiet microphone as quiet rather than as almost silent.
  const meter = $derived(Math.max(0, Math.min(1, (session.levelDb + 60) / 60)));
  const total = $derived(session.completed + session.remaining);
</script>

<div class="session">
  {#if session.status === "idle"}
    <h1 class="title">Record the pronunciation corpus</h1>
    <p class="hint">
      Words appear one at a time. Read each one out loud in your normal voice — it hears you
      stop, saves the audio, and moves to the next one on its own. Nothing to press between
      words.
    </p>
    <button class="start" onclick={() => session.start()}>Start recording</button>
    <p class="hint">Starting asks for your microphone. The recordings save to your account.</p>
  {:else if session.status === "running"}
    <p class="instruction">Read this out loud</p>

    <p class="prompt" aria-live="polite">{written(session.currentWord)}</p>
    <p class="guide">{spoken(session.currentWord)}</p>

    <p class="upcoming">
      {session.nextWord ? `Next: ${written(session.nextWord)}` : "Last one"}
    </p>

    <div class="status">
      <p class="progress" aria-live="off">Word {session.completed + 1} of {total}</p>
      <span class="level">
        <span class="level-label"><i class="fas fa-microphone" aria-hidden="true"></i> Mic</span>
        <span class="meter" role="img" aria-label="Microphone input level">
          <span class="fill" style:transform={`scaleX(${meter})`}></span>
        </span>
      </span>
    </div>
  {:else if session.status === "failed"}
    <p class="prompt-failed">
      Could not start. Allow the microphone when the browser asks, and make sure you are signed
      in — the recordings save to your account.
    </p>
    <button class="start" onclick={() => session.start()}>Try again</button>
  {:else}
    <SessionReport
      retired={session.retired}
      recorded={session.completed}
      folderName={session.folderName}
      abortReason={session.abortReason}
    />
  {/if}
</div>

<style>
  .session {
    display: grid;
    align-content: center;
    justify-items: center;
    /* Both track the viewport's SHORT axis. On a 960x412 fold four 1rem gaps
       plus 2rem of padding is a sixth of the height, which is what pushed the
       count off the bottom; at 2160 the same 1rem reads as no gap at all. */
    gap: clamp(0.5rem, 3vh, 3rem);
    min-height: 100%;
    padding: clamp(1rem, 3vh, 2.5rem);
    text-align: center;
  }

  .start {
    /* An action he presses once from across the room, not an inline link.
       Width is pinned to the label: a stretched pill reads as a progress bar. */
    width: max-content;
    max-width: 100%;
    min-height: 44px;
    /* `em`, so the pill grows with its own label rather than staying a 1080p
       lozenge marooned in the middle of a 4K canvas. */
    padding: 0.7em 2em;
    border: 1px solid var(--theme-accent, currentColor);
    border-radius: 999px;
    background: var(--theme-accent, transparent);
    color: var(--theme-on-accent, inherit);
    font-size: clamp(1.25rem, 1.8vw, 3.5rem);
    cursor: pointer;
  }

  .title {
    margin: 0;
    font-size: clamp(1.5rem, 2.2vw, 4rem);
    font-weight: 700;
  }

  .hint {
    margin: 0;
    max-width: 46ch;
    font-size: clamp(1rem, 1vw, 2rem);
    line-height: 1.5;
    opacity: 0.6;
  }

  .instruction {
    margin: 0;
    font-size: clamp(1rem, 1.1vw, 2.25rem);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    opacity: 0.5;
  }

  .progress {
    margin: 0;
    /* Changing digits with proportional figures shove the meter sideways. */
    font-variant-numeric: tabular-nums;
    font-size: clamp(1rem, 1.1vw, 2.25rem);
    opacity: 0.6;
  }

  .prompt {
    margin: 0;
    /* A fixed box holding a viewport-sized word. The reserve is what keeps the
       count and the meter below from moving between a two-letter word and an
       eight-letter one, and `16vh` is what keeps a two-line word inside that
       reserve (2 lines x 1.05 line-height = 33.6vh, against 30vh of box, with
       `text-wrap: balance` making the second line the short one). The 20rem
       ceiling is what stops the prompt reading as small print on a TV. */
    display: grid;
    /* Bottom-anchored inside its reserved box so a two-line word grows upward
       and the pronunciation below it never moves. Centring instead would park
       the guide a hundred pixels under a one-line word. */
    place-content: end center;
    width: 100%;
    /* Two lines of reserve, expressed in the prompt's own type size, so a short
       fold reserves two short lines rather than a third of a tall screen. */
    height: min(30vh, 2.2em);
    font-size: clamp(2rem, min(9vw, 16vh), 20rem);
    font-weight: 700;
    line-height: 1.05;
    text-wrap: balance;
    overflow-wrap: anywhere;
  }

  .guide {
    margin: 0;
    /* The pronunciation, not the prompt. The longest word reads out to about
       sixty-five characters — one line on a TV, four on a phone — so the box is
       reserved at four either way and the meter below cannot move. */
    display: grid;
    place-content: start center;
    width: 100%;
    /* Four lines where there is room for them, fewer on a fold — where the
       screen is also wide enough that the longest spelling fits on one. */
    height: min(4.5em, 12vh);
    font-size: clamp(0.9rem, 0.95vw, 1.8rem);
    line-height: 1.3;
    text-wrap: balance;
    overflow-wrap: anywhere;
    opacity: 0.55;
  }

  .prompt-failed {
    margin: 0;
    font-size: clamp(1.25rem, 1.8vw, 3rem);
    max-width: 40ch;
  }

  .upcoming {
    margin: 0;
    /* One line, reserved: the longest word in the pool is fifteen characters,
       which fits on one line at every width this screen is used at. */
    display: grid;
    place-content: center;
    width: 100%;
    height: 1.6em;
    font-size: clamp(0.95rem, 1vw, 2rem);
    overflow-wrap: anywhere;
    opacity: 0.35;
  }

  .status {
    /* Count and level share one strip. Two stacked status rows is what pushed
       the count under the fold on a 960x412 phone in landscape. */
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.5em 1.5em;
    width: min(45rem, 80vw);
  }

  .level {
    /* The label is what stops a horizontal bar reading as a progress bar. It is
       not decoration — an unlabelled fill next to a word count is a loading
       indicator to anyone who did not write it. */
    display: flex;
    flex: 1 1 12rem;
    align-items: center;
    gap: 0.75em;
    font-size: clamp(0.85rem, 0.9vw, 1.6rem);
    opacity: 0.6;
  }

  .level-label {
    flex: 0 0 auto;
    white-space: nowrap;
  }

  .meter {
    flex: 1 1 auto;
    height: 0.6em;
    border-radius: 999px;
    background: color-mix(in srgb, currentColor 15%, transparent);
    overflow: hidden;
  }

  .fill {
    display: block;
    width: 100%;
    height: 100%;
    background: var(--theme-accent, currentColor);
    transform-origin: left center;
    transition: transform 80ms linear;
  }

  @media (prefers-reduced-motion: reduce) {
    .fill {
      transition: none;
    }
  }
</style>
