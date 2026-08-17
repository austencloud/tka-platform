<script lang="ts">
  /**
   * Visual harness for the hands-free pronunciation recording screen.
   *
   * The screen's real home is the Lab tab, which is `adminOnly` and needs a
   * microphone plus a folder grant before it renders anything past the Start
   * button. This route mounts the same component against a fake session so all
   * four states can be judged at every viewport without either.
   */
  import { Letter } from "$lib/shared/foundation/domain/models/letter";
  import CorpusSessionScreen from "$lib/features/lab/pronunciation-recorder/components/CorpusSessionScreen.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";

  type State = "idle" | "running" | "long" | "failed" | "finished" | "aborted";

  let state = $state<State>("idle");

  const OPTIONS = [
    { value: "idle" as const, label: "Idle" },
    { value: "running" as const, label: "Running" },
    { value: "long" as const, label: "Longest word" },
    { value: "failed" as const, label: "Failed" },
    { value: "finished" as const, label: "Finished" },
    { value: "aborted" as const, label: "Aborted" },
  ];

  // Eight letters is the longest length the word pool generates, so this is the
  // widest prompt the screen ever has to hold.
  const LONGEST = [
    Letter.SIGMA_DASH,
    Letter.OMEGA_DASH,
    Letter.LAMBDA_DASH,
    Letter.THETA_DASH,
    Letter.DELTA_DASH,
    Letter.PSI_DASH,
    Letter.PHI_DASH,
    Letter.GAMMA,
  ];

  const session = $derived({
    status:
      state === "long"
        ? "running"
        : state === "aborted"
          ? "finished"
          : state,
    abortReason: state === "aborted" ? "consecutive-failures" : null,
    folderName: state === "idle" ? null : "tka-corpus-2026-08-16",
    currentWord:
      state === "long" ? LONGEST : state === "running" ? [Letter.A, Letter.B, Letter.C] : null,
    nextWord: state === "long" ? [Letter.W_DASH, Letter.Z] : state === "running" ? [Letter.SIGMA] : null,
    completed: state === "idle" ? 0 : 137,
    remaining: state === "finished" || state === "aborted" ? 0 : 263,
    retired:
      state === "finished" || state === "aborted"
        ? [
            [Letter.THETA_DASH, Letter.OMEGA],
            [Letter.PSI_DASH],
          ]
        : [],
    levelDb: state === "long" ? -12 : -34,
    // The two label states are different widths, so both need looking at: the
    // reserve on the label is what stops the meter resizing between them.
    hearing: state === "long",
    failure: state === "failed" ? "The speech detector could not start listening." : null,
    start: async () => {},
  });
</script>

<svelte:head><title>Corpus session screen harness</title></svelte:head>

<div class="harness">
  <header>
    <p class="banner">
      Mock. Nothing here records: the numbers are invented and Start does nothing. The working
      recorder is at <a href="/lab/pronunciation-recorder">/lab/pronunciation-recorder</a>.
    </p>

    <!-- SegmentedControl's root is `width: 100%`, so without a bounded wrapper
         six short labels stretch into a 3840px progress bar. -->
    <div class="switcher">
      <SegmentedControl
        options={OPTIONS}
        value={state}
        onchange={(next) => (state = next)}
        ariaLabel="Screen state"
        size="sm"
      />
    </div>
  </header>

  <main>
    <CorpusSessionScreen {session} />
  </main>
</div>

<style>
  .harness {
    display: grid;
    grid-template-rows: auto 1fr;
    /* Deliberately thin. On the 960x412 fold this chrome competes with the
       screen under test for the same scarce height, and a harness that
       manufactures its own overflow tells you nothing about the component. */
    gap: 0.5rem;
    min-height: 100dvh;
    padding: 0.5rem;
    background: var(--theme-bg, #0b0e14);
    color: var(--theme-text, #e8ecf2);
  }

  header {
    display: grid;
    gap: 0.4rem;
    justify-items: center;
  }

  .banner {
    margin: 0;
    max-width: 90ch;
    font-size: 0.8rem;
    text-align: center;
    opacity: 0.7;
  }

  .switcher {
    width: min(52rem, 100%);
  }

  main {
    display: grid;
    min-height: 0;
  }
</style>
