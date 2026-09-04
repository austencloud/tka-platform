<!--
  The lab's playback bar.

  It sits under the cameras rather than in the rail because that is where the
  app puts a transport: `SceneControlWorkspace` reserves a `bottomOffset` for
  exactly this, and the buttons are the shared `TransportControls` every other
  player in the product uses. The lab owns none of that — it supplies the
  handlers and the scrub, and the phase writes stay coalesced replaces so
  scrubbing never fills the Back stack.

  It also owns the frame. A grip defect is one moment, and reporting one is
  useless unless the moment has a name: the frame group steps phase by exactly
  the amount the address bar can express, and the readout between its two
  arrows renders the same string the `phase=` param carries. Nothing here reads
  or writes pose, grip or playback rate — the lab is being measured, not tuned.
-->
<script lang="ts">
  import TransportControls from "$lib/shared/animation-engine/components/controls/TransportControls.svelte";

  import { LAB_FRAME_STEP, type StaffLabState } from "./lab-state.svelte";

  interface Props {
    lab: StaffLabState;
    /** Steps in the loaded sequence; the scrub's span and the readout's total. */
    stepCount: number;
    /** No sequence yet: the bar stays in place, inert, so nothing moves later. */
    disabled?: boolean;
  }

  let { lab, stepCount, disabled = false }: Props = $props();

  /** How long the copy confirmation holds, matching the rail's Copy link. */
  const COPIED_MS = 1600;

  let copied = $state(false);
  let copyResetTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * What a discrete step just landed on, for a screen reader.
   *
   * Written only by the buttons and the arrow keys, never by the clock — a
   * live region fed by playback would read out sixty phases a second.
   */
  let announcement = $state("");

  /** The exact moment, in the form the URL names it. */
  const phaseToken = $derived(`phase=${lab.phaseParam}`);

  /**
   * The widest reading this sequence can produce, stacked behind the live one.
   *
   * Phase runs to `stepCount - 0.01`, so that value carries the most integer
   * digits the readout will ever show. Reserving it keeps the scrub and the
   * play buttons still while the number underneath the playhead runs.
   */
  const widestReadout = $derived(
    `${Math.max(stepCount - LAB_FRAME_STEP, LAB_FRAME_STEP).toFixed(
      2
    )} / ${stepCount}`
  );

  /**
   * Move by an exact amount and stop.
   *
   * Frame-stepping a running clock is a control that appears to do nothing —
   * the next tick overwrites it — so a discrete move pins playback first, the
   * way every frame-accurate transport does. `setPlaying(false)` flushes the
   * moving phase before it writes, so the step starts from the frame on screen
   * rather than from whatever the last coalesced write happened to catch.
   */
  function step(delta: number): void {
    if (disabled) return;
    if (lab.playing) lab.setPlaying(false);
    lab.stepPhase(delta);
    announcement = phaseToken;
  }

  /**
   * Typing targets keep their keys. The scrub is one of them, and that is
   * deliberate: a focused range input already answers the arrows with its own
   * `step`, which is this same 0.01, so leaving it alone costs nothing.
   */
  function ownsKeys(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
  }

  function onKeydown(event: KeyboardEvent): void {
    if (disabled) return;
    // Browser and OS shortcuts live on these modifiers; Shift does not.
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (ownsKeys(event.target)) return;
    const forward = event.key === "ArrowRight";
    if (!forward && event.key !== "ArrowLeft") return;
    event.preventDefault();
    step((forward ? 1 : -1) * (event.shiftKey ? 1 : LAB_FRAME_STEP));
  }

  $effect(() => {
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  });

  $effect(() => () => {
    if (copyResetTimer) clearTimeout(copyResetTimer);
  });

  /**
   * Copy the frame, not the configuration.
   *
   * The rail's Copy link already hands over the whole setup. What was missing
   * is the short token a person can put in a sentence — "it tears at
   * phase=7.44" — which is also what a URL and a headless sweep both accept
   * verbatim.
   */
  async function copyFrame(): Promise<void> {
    if (lab.playing) lab.setPlaying(false);
    lab.flushPhase();
    try {
      await navigator.clipboard.writeText(phaseToken);
      copied = true;
      if (copyResetTimer) clearTimeout(copyResetTimer);
      copyResetTimer = setTimeout(() => (copied = false), COPIED_MS);
    } catch {
      // Clipboard permission is not something a lab should fight over; the
      // number is on screen and the address bar carries the same value.
      copied = false;
    }
  }
</script>

<div class="transport-bar" role="group" aria-label="Playback">
  <div class="transport-slot">
    <TransportControls
      isPlaying={lab.playing}
      {disabled}
      onPlaybackToggle={() => lab.setPlaying(!lab.playing)}
      onStepHalfBeatBackward={() => step(-0.5)}
      onStepHalfBeatForward={() => step(0.5)}
      onStepFullBeatBackward={() => step(-1)}
      onStepFullBeatForward={() => step(1)}
    />
  </div>

  <label class="scrub" for="grid-phase">
    <span class="visually-hidden">Position in sequence</span>
    <input
      id="grid-phase"
      type="range"
      min="0"
      max={Math.max(stepCount - LAB_FRAME_STEP, LAB_FRAME_STEP)}
      step={LAB_FRAME_STEP}
      value={lab.phase}
      {disabled}
      oninput={(event) => lab.setPhase(event.currentTarget.valueAsNumber)}
      onchange={() => lab.flushPhase()}
    />
  </label>

  <!--
    The two arrows move the number between them by one frame, which is the
    whole reason they flank it rather than joining the play cluster. Sitting
    outside `TransportControls` they would read as a bigger jump than its
    full-step chevrons, when a frame is a hundredth of one.
  -->
  <div class="frame-group" role="group" aria-label="Frame stepping">
    <button
      class="frame-btn"
      type="button"
      aria-label="Previous frame"
      aria-keyshortcuts="ArrowLeft"
      {disabled}
      onclick={() => step(-LAB_FRAME_STEP)}
    >
      <i class="fas fa-caret-left" aria-hidden="true"></i>
    </button>

    <button
      class="frame-readout"
      type="button"
      {disabled}
      aria-label={copied
        ? `Copied ${phaseToken}`
        : `Copy this frame, ${phaseToken}`}
      onclick={copyFrame}
    >
      <!-- Only the glyph swaps, inside a fixed box, so confirming a copy
           cannot resize the control the playhead is running inside. -->
      <i
        class="fas {copied ? 'fa-check' : 'fa-copy'} frame-icon"
        aria-hidden="true"
      ></i>
      <span class="frame-unit">phase</span>
      <span class="frame-value">
        <span class="frame-ghost" aria-hidden="true">{widestReadout}</span>
        <span class="frame-live">{lab.phaseParam} / {stepCount}</span>
      </span>
    </button>

    <button
      class="frame-btn"
      type="button"
      aria-label="Next frame"
      aria-keyshortcuts="ArrowRight"
      {disabled}
      onclick={() => step(LAB_FRAME_STEP)}
    >
      <i class="fas fa-caret-right" aria-hidden="true"></i>
    </button>
  </div>

  <span class="visually-hidden" role="status">{announcement}</span>
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
    /*
       An explicit measure rather than `fit-content`, which cannot size this
       dock correctly: the scrub's range input is `width: 100%`, so it
       contributes nothing intrinsic, and Chrome's max-content for the wrapping
       row came back 657px — enough for the transport and the scrub and not the
       frame group, which then wrapped onto a second line at 1920 with 800px of
       the stage still empty. 56rem is the width at which all three sit on one
       row and the scrub keeps the 368px measure it already had; below that the
       dock still hugs the viewport and wraps as before.
    */
    width: min(100% - 1.5rem, 56rem);
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
    min-height: var(--min-touch-target, 44px);
    accent-color: var(--theme-accent, #7a73da);
  }

  .frame-group {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 0.25rem;
    min-width: 0;
  }

  .frame-btn,
  .frame-readout {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: var(--min-touch-target, 44px);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
    cursor: pointer;
    transition:
      background var(--duration-fast, 150ms) var(--ease-out, ease),
      border-color var(--duration-fast, 150ms) var(--ease-out, ease),
      color var(--duration-fast, 150ms) var(--ease-out, ease),
      transform var(--duration-fast, 150ms) var(--ease-out, ease);
  }

  .frame-btn {
    width: var(--min-touch-target, 44px);
    flex: 0 0 auto;
    border-radius: 50%;
    font-size: var(--font-size-sm, 0.875rem);
  }

  /* The number is the thing being read, so it takes the readable size rather
     than the 12px a chip label would. */
  .frame-readout {
    gap: 0.4rem;
    padding: 0 0.7rem;
    border-radius: 100px;
    font-size: var(--font-size-sm, 0.875rem);
    font-variant-numeric: tabular-nums;
  }

  .frame-icon {
    /* A fixed box for a swapping glyph: check and copy are not the same width,
       and confirming a copy must not resize the control. */
    width: 1em;
    text-align: center;
    font-size: var(--font-size-compact, 0.75rem);
  }

  .frame-unit {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
    font-size: var(--font-size-compact, 0.75rem);
  }

  /* Ghost sizer: the widest reading this sequence can produce holds the box
     open while the live one runs inside it. */
  .frame-value {
    display: grid;
    color: var(--theme-text, #fff);
  }

  .frame-ghost,
  .frame-live {
    grid-area: 1 / 1;
    white-space: nowrap;
  }

  .frame-ghost {
    visibility: hidden;
  }

  @media (hover: hover) and (pointer: fine) {
    .frame-btn:hover:not(:disabled),
    .frame-readout:hover:not(:disabled) {
      background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
      border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.24));
      color: var(--theme-text, #fff);
    }
  }

  .frame-btn:active:not(:disabled),
  .frame-readout:active:not(:disabled) {
    transform: scale(0.96);
  }

  .frame-btn:focus-visible,
  .frame-readout:focus-visible {
    outline: 2px solid var(--theme-accent, #7a73da);
    outline-offset: 2px;
  }

  .frame-btn:disabled,
  .frame-readout:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  @media (prefers-reduced-motion: reduce) {
    .frame-btn,
    .frame-readout {
      transition-duration: 0ms;
    }

    .frame-btn:active:not(:disabled),
    .frame-readout:active:not(:disabled) {
      transform: none;
    }
  }

  /* Phone width. A 16rem scrub cannot share a row with the frame group here,
     so the group drops to a line of its own and the dock grows a third row.
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
       from the cameras it exists to serve. Flex wraps on base sizes rather
       than on shrunk ones, so the basis is what decides: at 960x412 the dock
       gets a 598px content box, and the buttons (244) plus the frame group
       (222) plus two 12px gaps leave 108px for the scrub. An 8rem basis
       overshoots that by 20px and drops the frame group onto a second row.
       6rem clears it, and the scrub still lays out wider than its basis. */
    .scrub {
      flex: 1 1 6rem;
    }
  }
</style>
