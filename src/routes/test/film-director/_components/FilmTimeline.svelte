<script lang="ts">
  import { getFilmDirectorContext } from "../_lib/film-director-context";
  import {
    buildTimelineSegments,
    fractionAtSeconds,
    secondsAtFraction,
  } from "../_lib/film-timeline-geometry";

  const director = getFilmDirectorContext();

  let trackEl = $state<HTMLElement | null>(null);
  let scrubbing = $state(false);
  let resumeAfterScrub = false;

  const segments = $derived(
    buildTimelineSegments(director.film.scenes, director.film.durationSeconds)
  );
  const playheadFraction = $derived(
    fractionAtSeconds(director.playheadSeconds, director.film.durationSeconds)
  );

  function seekToPointer(event: PointerEvent): void {
    const rect = trackEl?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    director.seek(
      secondsAtFraction(
        (event.clientX - rect.left) / rect.width,
        director.film.durationSeconds
      )
    );
  }

  // The playhead keeps advancing under rAF between pointer samples, so a drag
  // that did not pause would fight its own seeks. Pausing also stops scene
  // transitions from retriggering at every boundary the drag crosses.
  function onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    trackEl?.setPointerCapture(event.pointerId);
    scrubbing = true;
    resumeAfterScrub = director.wantsToPlay;
    director.pause();
    seekToPointer(event);
  }

  function onPointerMove(event: PointerEvent): void {
    if (scrubbing) seekToPointer(event);
  }

  function onPointerUp(event: PointerEvent): void {
    if (!scrubbing) return;
    scrubbing = false;
    trackEl?.releasePointerCapture(event.pointerId);
    if (resumeAfterScrub) director.play();
    resumeAfterScrub = false;
  }

  function onKeydown(event: KeyboardEvent): void {
    const step =
      event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
    if (step === 0) return;
    event.preventDefault();
    director.seek(director.playheadSeconds + step * (event.shiftKey ? 5 : 1));
  }
</script>

<div
  class="timeline"
  bind:this={trackEl}
  role="slider"
  tabindex="0"
  aria-label="Film position"
  aria-valuemin={0}
  aria-valuemax={director.film.durationSeconds}
  aria-valuenow={Math.round(director.playheadSeconds)}
  aria-valuetext="{director.frame.scene.title}, {Math.round(
    director.playheadSeconds
  )} of {Math.round(director.film.durationSeconds)} seconds"
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointercancel={onPointerUp}
  onkeydown={onKeydown}
>
  {#each segments as segment (segment.id)}
    <div
      class="segment"
      class:current={segment.index === director.frame.sceneIndex}
      class:outside-solo={director.soloSceneIndex !== null &&
        segment.index !== director.soloSceneIndex}
      style:left="{segment.offset * 100}%"
      style:width="{segment.width * 100}%"
    >
      <!-- Jumping to a scene lands past its transition, which seeking to the
           same x would land inside, so the label is its own action rather than
           part of the drag. -->
      <button
        type="button"
        onpointerdown={(event) => event.stopPropagation()}
        onclick={() => director.selectScene(segment.index)}
      >
        <span class="segment-number">
          {String(segment.index + 1).padStart(2, "0")}
        </span>
        <span class="segment-title">{segment.title}</span>
      </button>
    </div>
  {/each}

  <div
    class="playhead"
    style:left="{playheadFraction * 100}%"
    aria-hidden="true"
  ></div>
</div>

<style>
  .timeline {
    position: relative;
    min-width: 0;
    height: 2.75rem;
    overflow: hidden;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: 0.7rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
    cursor: pointer;
    touch-action: none;
  }

  .timeline:focus-visible {
    outline: 3px solid var(--theme-accent, #9d8cff);
    outline-offset: 2px;
  }

  .segment {
    position: absolute;
    top: 0;
    bottom: 0;
    min-width: 0;
    overflow: hidden;
    container-type: inline-size;
    border-right: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
  }

  .segment:last-of-type {
    border-right: 0;
  }

  .segment.current {
    background: color-mix(
      in srgb,
      var(--theme-accent, #7869eb) 22%,
      transparent
    );
  }

  /* While one scene is soloed the rest of the film is still reachable — a click
     moves the solo — but it is not what is playing, and the track should say so
     at a glance rather than looking like an ordinary playthrough. */
  .segment.outside-solo {
    opacity: 0.38;
  }

  .segment button {
    display: flex;
    width: 100%;
    height: 100%;
    align-items: center;
    gap: 0.4rem;
    padding: 0 0.55rem;
    border: 0;
    color: inherit;
    background: transparent;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .segment button:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .segment button:focus-visible {
    outline: 2px solid var(--theme-accent, #9d8cff);
    outline-offset: -3px;
  }

  .segment-number {
    flex: 0 0 auto;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 0.75rem);
    font-variant-numeric: tabular-nums;
  }

  .segment-title {
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 700;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* A segment is a share of the track, so no viewport breakpoint describes it:
     the same phone gives an 17-second scene room for its title and an
     11-second one none. Each band decides for itself. */
  @container (max-width: 6rem) {
    .segment-title {
      display: none;
    }
  }

  @container (max-width: 2.75rem) {
    .segment button {
      justify-content: center;
      padding: 0;
    }
  }

  @container (max-width: 1.6rem) {
    .segment-number {
      display: none;
    }
  }

  .playhead {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    margin-left: -1px;
    background: var(--theme-text, #fff);
    box-shadow: 0 0 0.5rem rgba(0, 0, 0, 0.6);
    pointer-events: none;
  }
</style>
