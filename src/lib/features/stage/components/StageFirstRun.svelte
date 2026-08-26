<script lang="ts">
  /**
   * StageFirstRun
   *
   * What to do first, second, and next — shown once, on the surface itself.
   * The Stage always boots with a cast standing in an opening set, so there is
   * no empty state to explain. What a first-time author needs is the order of
   * the three moves, and one button that starts the first of them.
   */

  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import SceneChromeButton from "$lib/shared/3d/components/controls/SceneChromeButton.svelte";

  interface Props {
    /** The sequence the cast is currently performing, if one has resolved. */
    word: string | null;
    onChooseSequence: () => void;
    onOpenChart: () => void;
  }

  let { word, onChooseSequence, onOpenChart }: Props = $props();

  const STORAGE_KEY = "tka-stage-first-run-dismissed";

  function alreadyDismissed(): boolean {
    if (typeof localStorage === "undefined") return false;
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  }

  let dismissed = $state(alreadyDismissed());

  function dismiss(): void {
    dismissed = true;
    try {
      localStorage?.setItem(STORAGE_KEY, "1");
    } catch {
      // Remembering the dismissal is a courtesy, not a requirement.
    }
  }
</script>

{#if !dismissed}
  <aside class="first-run" aria-labelledby="stage-first-run-title">
    <header>
      <div class="title-block">
        <h1 id="stage-first-run-title">Three moves make a show</h1>
        <p>
          {#if word}
            Your cast is performing <strong>{word}</strong>.
          {:else}
            Your cast is standing in its opening set.
          {/if}
        </p>
      </div>
      <SceneChromeButton
        icon="fa-times"
        label="Dismiss"
        tooltipSide="left"
        class="dismiss"
        onclick={dismiss}
      />
    </header>

    <ol>
      <li>
        <span class="num">1</span>
        <span>Choose what they perform. Every lane starts on that sequence.</span>
      </li>
      <li>
        <span class="num">2</span>
        <span>
          Raise the drill chart and drag performers to their spots. Each set
          names the count they arrive on and how many counts the walk takes.
        </span>
      </li>
      <li>
        <span class="num">3</span>
        <span>
          Play it. The lines on the floor are the paths, and the rings are the
          spots.
        </span>
      </li>
    </ol>

    <div class="actions">
      <PanelButton
        variant="primary"
        onclick={(event) => {
          event.stopPropagation();
          dismiss();
          onChooseSequence();
        }}
      >
        <i class="fas fa-folder-open" aria-hidden="true"></i>
        Choose the sequence
      </PanelButton>
      <PanelButton
        variant="secondary"
        onclick={(event) => {
          event.stopPropagation();
          dismiss();
          onOpenChart();
        }}
      >
        <i class="fas fa-border-all" aria-hidden="true"></i>
        Open the drill chart
      </PanelButton>
    </div>
  </aside>
{/if}

<style>
  .first-run {
    position: absolute;
    /* Below the scene's title row and tool buttons. The performer spine only
       appears once the workspace is both wide and tall enough for it — the
       shared scene-control breakpoint, 768x544 — so the deeper offset that
       clears it is paid in the matching container query, not at every size. */
    top: 4.5rem;
    left: clamp(0.75rem, 2.5cqi, 3rem);
    display: flex;
    /* The scene panel can be short: a folded phone in landscape leaves it
       around 230px. The card is bounded by the panel it sits in and scrolls
       inside itself rather than running off the bottom of the stage. The
       reserve at the foot clears the compact Performer/Scene bar, which the
       scene control workspace floats above every overlay a host contributes. */
    max-height: calc(100% - 8.5rem);
    width: min(30rem, calc(100% - 7rem));
    flex-direction: column;
    overflow-y: auto;
    overscroll-behavior: contain;
    gap: 1rem;
    padding: 1.25rem;
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.14));
    border-radius: 0.875rem;
    /* The scene behind this is already busy. A solid panel keeps the copy
       readable without adding another translucent card to the stack. */
    background: #0c0e16;
    box-shadow: var(--theme-panel-shadow, 0 1rem 3rem rgba(0, 0, 0, 0.52));
    color: var(--theme-text, #fff);
  }

  header {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .title-block {
    flex: 1;
    min-width: 0;
  }

  h1 {
    margin: 0;
    font-size: clamp(1.15rem, 1.9cqi, 1.6rem);
    line-height: 1.15;
    letter-spacing: -0.02em;
  }

  header p {
    margin: 0.35rem 0 0;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.68));
    font-size: var(--font-size-min, 0.875rem);
  }

  header p strong {
    color: var(--theme-text, #fff);
  }

  ol {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    gap: 0.6rem;
    list-style: none;
  }

  li {
    display: flex;
    align-items: flex-start;
    gap: 0.65rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.76));
    font-size: var(--font-size-min, 0.875rem);
    line-height: 1.45;
  }

  .num {
    display: grid;
    width: 1.5rem;
    height: 1.5rem;
    flex: none;
    place-items: center;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.16));
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.05);
    color: var(--theme-text, #fff);
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.625rem;
  }

  /* Wide and tall enough that the performer spine is on screen: clear it. */
  @container (min-width: 48rem) and (min-height: 34rem) {
    .first-run {
      top: 10rem;
      max-height: calc(100% - 11rem);
    }
  }

  @container (max-width: 36rem) {
    .first-run {
      right: 0.75rem;
      left: 0.75rem;
      width: auto;
      padding: 1rem;
    }

    .actions {
      flex-direction: column;
    }

    .actions :global(.panel-btn) {
      width: 100%;
    }
  }

  @container (min-width: 120rem) {
    .first-run {
      width: 36rem;
      gap: 1.25rem;
      padding: 1.5rem;
    }

    h1 {
      font-size: 1.9rem;
    }

    header p,
    li,
    .actions :global(.panel-btn) {
      font-size: 1rem;
    }
  }
</style>
