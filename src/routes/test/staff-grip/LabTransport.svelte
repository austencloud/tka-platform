<!--
  The lab's playback bar.

  It sits under the cameras rather than in the rail because that is where the
  app puts a transport: `SceneControlWorkspace` reserves a `bottomOffset` for
  exactly this, and the buttons are the shared `TransportControls` every other
  player in the product uses. The lab owns none of that — it supplies the
  handlers and the scrub, and the phase writes stay coalesced replaces so
  scrubbing never fills the Back stack.
-->
<script lang="ts">
  import TransportControls from "$lib/shared/animation-engine/components/controls/TransportControls.svelte";

  import type { StaffLabState } from "./lab-state.svelte";

  interface Props {
    lab: StaffLabState;
    /** Steps in the loaded sequence; the scrub's span and the readout's total. */
    stepCount: number;
    /** `1.00`-style label the page already derives for its header. */
    phaseLabel: string;
    /** No sequence yet: the bar stays in place, inert, so nothing moves later. */
    disabled?: boolean;
  }

  let { lab, stepCount, phaseLabel, disabled = false }: Props = $props();

  /** A step is a whole count; a half step is the midpoint the notation uses. */
  function nudge(steps: number): void {
    lab.setPhase(lab.phase + steps);
    lab.flushPhase();
  }
</script>

<div class="transport-bar" role="group" aria-label="Playback">
  <div class="transport-slot">
    <TransportControls
      isPlaying={lab.playing}
      {disabled}
      onPlaybackToggle={() => lab.setPlaying(!lab.playing)}
      onStepHalfBeatBackward={() => nudge(-0.5)}
      onStepHalfBeatForward={() => nudge(0.5)}
      onStepFullBeatBackward={() => nudge(-1)}
      onStepFullBeatForward={() => nudge(1)}
    />
  </div>

  <label class="scrub" for="grid-phase">
    <span class="visually-hidden">Position in sequence</span>
    <input
      id="grid-phase"
      type="range"
      min="0"
      max={Math.max(stepCount - 0.01, 0.01)}
      step="0.01"
      value={lab.phase}
      {disabled}
      oninput={(event) => lab.setPhase(event.currentTarget.valueAsNumber)}
      onchange={() => lab.flushPhase()}
    />
  </label>

  <!--
    `8.99` is 99% of the way through step 8 of 8, so pairing it with a total
    reads as an overrun. The sequence card already says how many steps there
    are; this says where in them the stage is.
  -->
  <span class="step-readout">Step {phaseLabel}</span>
</div>

<style>
  /*
     The app's 3D workspace docks its transport as a centred rounded card that
     sizes to its own contents rather than as a full-bleed toolbar, and that
     shape is what makes a playback cluster read as this product's. The lab
     keeps the dock in flow instead of floating it over the canvas because the
     stage stacks four panes taller than the viewport at narrow widths, where
     an absolutely placed dock would cover the last camera.
  */
  .transport-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.4rem 0.9rem;
    width: fit-content;
    max-width: calc(100% - 1.5rem);
    margin: 0 auto 0.75rem;
    padding: 0.6rem 1rem;
    min-width: 0;
    border-radius: 16px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    background: var(--theme-card-bg, rgba(0, 0, 0, 0.75));
    box-shadow: var(--theme-panel-shadow, 0 18px 50px rgba(0, 0, 0, 0.36));
  }

  .transport-slot {
    flex: 0 0 auto;
  }

  /* The scrub takes the room left over, and drops to its own line before it
     would squeeze the buttons. */
  .scrub {
    display: flex;
    align-items: center;
    /* A dock that sizes to its contents needs the scrub to declare a measure
       of its own; `1fr` inside a `fit-content` box collapses to nothing. */
    flex: 1 1 16rem;
    max-width: 34rem;
    min-width: 0;
  }

  .scrub input {
    width: 100%;
    min-height: 44px;
    accent-color: var(--theme-accent, #7a73da);
  }

  .step-readout {
    flex: 0 0 auto;
    font-size: var(--font-size-sm, 0.875rem);
    font-variant-numeric: tabular-nums;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
    /* The label grows a digit at step 10. Reserving the widest form keeps the
       scrub from resizing under a moving playhead. */
    min-width: 8.5ch;
    text-align: right;
  }

  /* Phone width. A 16rem scrub cannot share a row with the readout here, so
     the readout drops to a line of its own and the dock grows a third row.
     A shorter measure keeps the scrub and its number together. */
  @media (max-width: 30rem) {
    .scrub {
      flex: 1 1 10rem;
    }
  }

  /* Wide and short — a folded phone in landscape. Every pixel the bar does not
     take is a pixel the cameras get. */
  @media (max-height: 34rem) {
    .transport-bar {
      margin-bottom: 0.4rem;
      padding: 0.3rem 0.75rem;
      gap: 0.25rem 0.75rem;
    }

    /* One row here or the dock takes a quarter of a 412px-tall viewport away
       from the cameras it exists to serve. */
    .scrub {
      flex: 1 1 8rem;
    }
  }
</style>
