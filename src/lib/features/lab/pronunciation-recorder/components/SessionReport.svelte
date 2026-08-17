<script lang="ts">
  import { getLetterPronunciation } from "$lib/shared/pronunciation/pronunciation-plan";

  interface Props {
    retired: readonly (readonly string[])[];
    recorded: number;
    folderName: string | null;
    abortReason: string | null;
  }

  let { retired, recorded, folderName, abortReason }: Props = $props();

  const spoken = (word: readonly string[]) =>
    word
      .map((letter) => getLetterPronunciation(letter as never)?.spokenName ?? letter)
      .join(" ");
</script>

<section class="report">
  <h2>{abortReason ? "Session stopped" : "Session complete"}</h2>
  <p class="count">{recorded} words recorded{folderName ? ` into ${folderName}` : ""}.</p>

  {#if abortReason}
    <p class="abort">
      Stopped because {abortReason === "early-failures"
        ? "most of the opening reads failed"
        : "several reads failed in a row"} — check the input level and the selected
      microphone before running again. Everything recorded so far is on disk.
    </p>
  {/if}

  {#if retired.length > 0}
    <h3>Not captured after three attempts</h3>
    <ul>
      {#each retired as word (word.join(""))}
        <li>{spoken(word)}</li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .report {
    display: grid;
    gap: 1rem;
    max-width: var(--shell-w, min(1720px, 92vw));
    margin-inline: auto;
    padding: 2rem;
    text-align: start;
    /* The whole report scales as one block. Every measure below is `em` or
       `ch`, so raising this one number carries the headings, the list, and the
       prose together instead of leaving 16px body copy in a 4K void. */
    font-size: clamp(1rem, 1.1vw, 2.25rem);
  }

  h2 {
    margin: 0;
    font-size: 2.2em;
  }

  h3 {
    margin: 0;
    font-size: 1.3em;
    opacity: 0.7;
  }

  .count {
    margin: 0;
    font-variant-numeric: tabular-nums;
  }

  .abort {
    margin: 0;
    max-width: 60ch;
  }

  ul {
    display: grid;
    gap: 0.5em;
    margin: 0;
    padding-inline-start: 1.5em;
  }
</style>
