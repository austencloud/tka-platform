<script lang="ts">
  /**
   * Which span of the take the post uses.
   *
   * This is NOT the clip handles in the lanes below it. Those move a clip
   * around INSIDE the post — when the animation appears, when the card takes
   * over — and the post is exactly as long either way. This shortens the post
   * itself: it is the difference between "the card comes in at four seconds"
   * and "the first four seconds of this take were me walking into frame."
   *
   * So the track is drawn against the source's own full length rather than the
   * project's, and the window on it is the part that survives. Trimming the
   * head also slides the step map by the same amount, which the composition
   * state handles — the card stays on the step the performer is landing.
   */
  import { onDestroy } from "svelte";
  import { getMediaCompositionContext } from "$lib/shared/media-composition/state/media-composition-context";

  const composition = getMediaCompositionContext();

  const roleKey = $derived(composition.durationSourceRole);
  const sourceLength = $derived(
    roleKey ? composition.sourceLengthFor(roleKey) : 0
  );
  const trim = $derived(roleKey ? composition.sourceTrimFor(roleKey) : null);
  const inSeconds = $derived(trim?.inSeconds ?? 0);
  const outSeconds = $derived(trim?.outSeconds ?? sourceLength);
  const roleLabel = $derived(
    (roleKey ? composition.bindingForRole(roleKey)?.label : null) ?? "Footage"
  );

  let track = $state<HTMLElement | null>(null);
  let dragging = $state<"in" | "out" | null>(null);

  function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds - minutes * 60;
    return `${minutes}:${remainder.toFixed(1).padStart(4, "0")}`;
  }

  function percentOf(seconds: number): number {
    if (sourceLength <= 0) return 0;
    return (seconds / sourceLength) * 100;
  }

  function apply(boundary: "in" | "out", seconds: number): void {
    if (!roleKey) return;
    composition.setSourceTrim(roleKey, {
      inSeconds: boundary === "in" ? seconds : inSeconds,
      outSeconds: boundary === "out" ? seconds : outSeconds,
    });
  }

  function secondsAtPointer(event: PointerEvent): number {
    if (!track) return 0;
    const bounds = track.getBoundingClientRect();
    const progress = Math.min(
      1,
      Math.max(0, (event.clientX - bounds.left) / bounds.width)
    );
    return progress * sourceLength;
  }

  function onPointerMove(event: PointerEvent): void {
    if (!dragging) return;
    apply(dragging, secondsAtPointer(event));
  }

  function stopDrag(): void {
    dragging = null;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", stopDrag);
    window.removeEventListener("pointercancel", stopDrag);
  }

  function beginDrag(event: PointerEvent, boundary: "in" | "out"): void {
    if (!roleKey) return;
    event.preventDefault();
    event.stopPropagation();
    composition.pause();
    dragging = boundary;
    apply(boundary, secondsAtPointer(event));
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDrag);
    window.addEventListener("pointercancel", stopDrag);
  }

  function nudge(event: KeyboardEvent, boundary: "in" | "out"): void {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    composition.pause();
    const direction = event.key === "ArrowLeft" ? -1 : 1;
    const increment = event.shiftKey ? 1 : 0.1;
    const current = boundary === "in" ? inSeconds : outSeconds;
    apply(boundary, current + direction * increment);
  }

  onDestroy(stopDrag);
</script>

{#if roleKey && sourceLength > 0}
  <div class="source-trim">
    <div class="trim-heading">
      <span class="trim-label">Trim {roleLabel}</span>
      <span class="trim-readout">
        {formatTime(inSeconds)} – {formatTime(outSeconds)}
        <span class="trim-length">({formatTime(outSeconds - inSeconds)})</span>
      </span>
      <button
        type="button"
        class="trim-reset"
        disabled={!trim}
        onclick={() => composition.setSourceTrim(roleKey, null)}
      >
        <i class="fa-solid fa-arrow-rotate-left" aria-hidden="true"></i>
        Whole take
      </button>
    </div>

    <div class="trim-track" bind:this={track}>
      <span
        class="trim-window"
        style:left={`${percentOf(inSeconds)}%`}
        style:width={`${percentOf(outSeconds - inSeconds)}%`}
        aria-hidden="true"
      ></span>
      <button
        type="button"
        role="slider"
        class="trim-grip"
        class:at-leading={percentOf(inSeconds) < 0.5}
        style:left={`${percentOf(inSeconds)}%`}
        aria-label={`Start of ${roleLabel}`}
        aria-valuemin="0"
        aria-valuemax={sourceLength}
        aria-valuenow={inSeconds}
        aria-valuetext={formatTime(inSeconds)}
        title="Drag to cut the head off this take"
        onpointerdown={(event) => beginDrag(event, "in")}
        onkeydown={(event) => nudge(event, "in")}
      ></button>
      <button
        type="button"
        role="slider"
        class="trim-grip"
        class:at-trailing={percentOf(outSeconds) > 99.5}
        style:left={`${percentOf(outSeconds)}%`}
        aria-label={`End of ${roleLabel}`}
        aria-valuemin="0"
        aria-valuemax={sourceLength}
        aria-valuenow={outSeconds}
        aria-valuetext={formatTime(outSeconds)}
        title="Drag to cut the tail off this take"
        onpointerdown={(event) => beginDrag(event, "out")}
        onkeydown={(event) => nudge(event, "out")}
      ></button>
    </div>
  </div>
{/if}

<style>
  .source-trim {
    display: grid;
    gap: 0.45rem;
  }

  .trim-heading {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .trim-label {
    color: var(--theme-text-dim);
    font-size: var(--studio-meta-size, var(--font-size-compact));
    font-weight: 650;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  /* The times change every frame of a drag, so the digits are tabular and the
     readout holds its width — otherwise the Whole take button walks sideways
     while you drag. */
  .trim-readout {
    margin-right: auto;
    color: var(--theme-text);
    font-size: var(--studio-meta-size, var(--font-size-compact));
    font-variant-numeric: tabular-nums;
  }

  .trim-length {
    color: var(--theme-text-dim);
  }

  .trim-reset {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 2.25rem;
    padding: 0.35rem 0.65rem;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-2026-full);
    background: var(--theme-card-bg);
    color: var(--theme-text);
    font: inherit;
    font-size: var(--studio-meta-size, var(--font-size-compact));
    white-space: nowrap;
    cursor: pointer;
  }

  .trim-reset:disabled {
    opacity: 0.42;
    cursor: not-allowed;
  }

  .trim-track {
    position: relative;
    height: 2.25rem;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-2026-sm);
    /* The whole take, dimmed; the window over it is what the post keeps. */
    background: color-mix(in srgb, var(--theme-text) 8%, transparent);
  }

  .trim-window {
    position: absolute;
    top: 0;
    bottom: 0;
    border-radius: var(--radius-2026-sm);
    background: color-mix(in srgb, var(--theme-accent) 30%, transparent);
  }

  .trim-grip {
    position: absolute;
    top: 50%;
    /* 44px of grab area, 4px of visible line: the touch target is the padding,
       not the mark, so the handle reads as a cut rather than a slab. */
    width: 2.75rem;
    height: 2.75rem;
    padding: 0;
    border: 0;
    background: transparent;
    transform: translate(-50%, -50%);
    cursor: ew-resize;
  }

  .trim-grip::after {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    width: 4px;
    height: 1.9rem;
    border-radius: 2px;
    background: var(--theme-accent);
    transform: translate(-50%, -50%);
  }

  /* At the very ends the line would sit half outside the track. */
  .trim-grip.at-leading::after {
    transform: translate(-25%, -50%);
  }

  .trim-grip.at-trailing::after {
    transform: translate(-75%, -50%);
  }

  .trim-grip:focus-visible,
  .trim-reset:focus-visible {
    outline: 3px solid var(--theme-accent);
    outline-offset: 2px;
  }
</style>
