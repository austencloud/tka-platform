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
   * Every letter, always spelled out. `simplifyRepeatedWord` is the rule for
   * displaying a sequence label, and this is the one surface it must not touch:
   * the prompt is a script to read aloud, and the corpus needs a token for each
   * letter in each position. Showing "F Psi" for a word that repeats four times
   * would record a quarter of what the aligner is about to be handed.
   */
  const spoken = (word: readonly string[] | null) =>
    word
      ?.map((letter) => getLetterPronunciation(letter as never)?.spokenName ?? letter)
      .join(" ") ?? "";

  // -60 dBFS reads as empty, 0 as full. A linear map of dBFS is the only meter
  // that shows a quiet microphone as quiet rather than as almost silent.
  const meter = $derived(Math.max(0, Math.min(1, (session.levelDb + 60) / 60)));
  const total = $derived(session.completed + session.remaining);
</script>

<div class="session">
  {#if session.status === "idle"}
    <button class="start" onclick={() => session.start()}>Start recording</button>
    <p class="hint">Pick a folder, then read each word aloud. It advances by itself.</p>
  {:else if session.status === "running"}
    <p class="progress" aria-live="off">{session.completed} of {total}</p>

    <p class="prompt" aria-live="polite">{spoken(session.currentWord)}</p>
    <p class="upcoming" aria-hidden="true">{spoken(session.nextWord)}</p>

    <div class="meter" role="img" aria-label="Input level">
      <span class="fill" style:transform={`scaleX(${meter})`}></span>
    </div>
  {:else if session.status === "failed"}
    <p class="prompt-failed">Could not open the microphone or the folder.</p>
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
    /* Both track the viewport's SHORT axis. On a 960x412 fold three fixed 2rem
       gaps plus 2rem of padding is a sixth of the height, which is what pushes
       the meter off the bottom; at 2160 the same 2rem reads as no gap at all. */
    gap: clamp(1rem, 3vh, 3rem);
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

  .hint {
    margin: 0;
    max-width: 40ch;
    font-size: clamp(1rem, 1vw, 2rem);
    opacity: 0.6;
  }

  .progress {
    margin: 0;
    /* Changing digits with proportional figures shove the prompt sideways. */
    font-variant-numeric: tabular-nums;
    font-size: clamp(1rem, 1.1vw, 2.25rem);
    opacity: 0.6;
  }

  .prompt {
    margin: 0;
    /* A fixed box, centred, holding a viewport-sized word. Both halves are
       load-bearing: `42vh` reserves the four-line worst case up front so the
       meter and the count below never move between a two-letter word and an
       eight-letter one, and the `9.5vh` term keeps that worst case inside the
       box it was given (4 lines x 1.05 line-height = 40vh). The 16rem ceiling
       is what stops the prompt reading as small print on a TV. */
    display: grid;
    place-content: center;
    width: 100%;
    height: 42vh;
    font-size: clamp(2rem, min(7vw, 9.5vh), 16rem);
    font-weight: 700;
    line-height: 1.05;
    text-wrap: balance;
    overflow-wrap: anywhere;
  }

  .prompt-failed {
    margin: 0;
    font-size: clamp(1.25rem, 1.8vw, 3rem);
    max-width: 40ch;
  }

  .upcoming {
    margin: 0;
    /* Same reservation, two lines deep: the next word is drawn from the same
       pool, so it has the same range of lengths as the prompt above it. */
    display: grid;
    place-content: center;
    width: 100%;
    height: 2.5em;
    font-size: clamp(1rem, 2vw, 4rem);
    overflow-wrap: anywhere;
    opacity: 0.35;
  }

  .meter {
    width: min(45rem, 60vw);
    height: clamp(0.5rem, 0.55vw, 1.25rem);
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
