<script lang="ts">
  import { onDestroy } from "svelte";
  import { getMediaCompositionContext } from "$lib/shared/media-composition/state/media-composition-context";
  import { resolvePresetTimePoint } from "$lib/shared/media-composition/services/frame-evaluator";
  import TempoControl from "$lib/shared/animation-panel/components/TempoControl.svelte";

  let {
    advanced = false,
    performanceAlignmentDetail = null,
    onMapPerformance,
    onToggleAdvanced,
  }: {
    advanced?: boolean;
    performanceAlignmentDetail?: string | null;
    onMapPerformance?: () => void;
    onToggleAdvanced: () => void;
  } = $props();

  const composition = getMediaCompositionContext();
  let frameRequest: number | null = null;
  let previousTime: number | null = null;
  let trimDrag: {
    clipId: string;
    boundary: "start" | "end";
    track: HTMLElement;
  } | null = null;

  const lanes = $derived(
    composition.regions.map((region) => ({
      region,
      clips: composition.activePreset.clips.filter(
        (clip) => clip.kind === "visual" && clip.regionId === region.id
      ),
    }))
  );

  function tick(now: number): void {
    if (previousTime !== null) composition.advance((now - previousTime) / 1000);
    previousTime = now;
    if (composition.isPlaying) frameRequest = requestAnimationFrame(tick);
  }

  $effect(() => {
    if (!composition.isPlaying) {
      if (frameRequest !== null) cancelAnimationFrame(frameRequest);
      frameRequest = null;
      previousTime = null;
      return;
    }

    frameRequest = requestAnimationFrame(tick);
    return () => {
      if (frameRequest !== null) cancelAnimationFrame(frameRequest);
      frameRequest = null;
      previousTime = null;
    };
  });

  onDestroy(() => {
    if (frameRequest !== null) cancelAnimationFrame(frameRequest);
    stopTrim();
  });

  function percent(
    point: Parameters<typeof resolvePresetTimePoint>[0]
  ): number {
    return (
      (resolvePresetTimePoint(point, composition.durationSeconds) /
        composition.durationSeconds) *
      100
    );
  }

  function clipStyle(clip: (typeof lanes)[number]["clips"][number]): string {
    const left = percent(clip.start);
    const right = percent(clip.end);
    return `left:${left}%;width:${right - left}%`;
  }

  function clipTimeLabel(
    clip: (typeof lanes)[number]["clips"][number]
  ): string {
    return `${formatTime(boundarySeconds(clip, "start"))} – ${formatTime(boundarySeconds(clip, "end"))}`;
  }

  function transitionStyle(
    transition: (typeof composition.activePreset.transitions)[number]
  ): string {
    const left = percent(transition.start);
    const right = percent(transition.end);
    return `left:${left}%;width:${right - left}%`;
  }

  function roleLabel(roleKey: string): string {
    return composition.bindingForRole(roleKey)?.label ?? roleKey;
  }

  function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds - minutes * 60;
    return `${minutes}:${remainder.toFixed(1).padStart(4, "0")}`;
  }

  const alignmentLabel = $derived.by(() => {
    if (performanceAlignmentDetail) {
      if (performanceAlignmentDetail.startsWith("Unmapped")) {
        return "Even timing estimate";
      }
      if (performanceAlignmentDetail.includes("needs repair")) {
        return "Timing map needs repair";
      }
      return performanceAlignmentDetail;
    }
    const source = composition.sequenceTimeMap?.source;
    if (!source) return null;
    if (source === "tempo-grid") return "Even timing";
    if (source === "audio-detected") return "Audio aligned";
    if (source === "motion-detected") return "Motion aligned";
    if (source === "hybrid") return "Audio + motion aligned";
    return "Beat aligned";
  });
  const alignmentNeedsMapping = $derived(
    Boolean(
      performanceAlignmentDetail?.startsWith("Unmapped") ||
      performanceAlignmentDetail?.includes("needs repair")
    )
  );

  function onScrub(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    composition.seek(Number(input.value));
  }

  function boundarySeconds(
    clip: (typeof lanes)[number]["clips"][number],
    boundary: "start" | "end"
  ): number {
    return resolvePresetTimePoint(clip[boundary], composition.durationSeconds);
  }

  function secondsAtPointer(event: PointerEvent, track: HTMLElement): number {
    const bounds = track.getBoundingClientRect();
    const progress = Math.min(
      1,
      Math.max(0, (event.clientX - bounds.left) / bounds.width)
    );
    return progress * composition.durationSeconds;
  }

  function updateTrim(event: PointerEvent): void {
    if (!trimDrag) return;
    composition.setClipBoundary(
      trimDrag.clipId,
      trimDrag.boundary,
      secondsAtPointer(event, trimDrag.track)
    );
  }

  function stopTrim(): void {
    trimDrag = null;
    window.removeEventListener("pointermove", updateTrim);
    window.removeEventListener("pointerup", stopTrim);
    window.removeEventListener("pointercancel", stopTrim);
  }

  function beginTrim(
    event: PointerEvent,
    clipId: string,
    boundary: "start" | "end"
  ): void {
    const handle = event.currentTarget as HTMLElement;
    const track = handle.closest(".lane-track");
    if (!(track instanceof HTMLElement)) return;
    event.preventDefault();
    event.stopPropagation();
    composition.pause();
    trimDrag = { clipId, boundary, track };
    updateTrim(event);
    window.addEventListener("pointermove", updateTrim);
    window.addEventListener("pointerup", stopTrim);
    window.addEventListener("pointercancel", stopTrim);
  }

  function nudgeTrim(
    event: KeyboardEvent,
    clip: (typeof lanes)[number]["clips"][number],
    boundary: "start" | "end"
  ): void {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    composition.pause();
    const direction = event.key === "ArrowLeft" ? -1 : 1;
    const increment = event.shiftKey ? 1 : 0.1;
    composition.setClipBoundary(
      clip.id,
      boundary,
      boundarySeconds(clip, boundary) + direction * increment
    );
  }
</script>

<section class="timeline" class:advanced aria-labelledby="post-studio-timing">
  <div class="timeline-heading">
    <div class="heading-title">
      <div class="title-row">
        <h3 id="post-studio-timing">Timing</h3>
        {#if alignmentLabel}
          <span
            class="alignment"
            title={composition.sequenceTimeMap?.source === "tempo-grid"
              ? "A starting grid. Drag the timing handles to match the performance."
              : "The performance, animation, and card use the same beat map."}
          >
            <i class="fa-solid fa-wave-square" aria-hidden="true"></i>
            {alignmentLabel}
          </span>
        {/if}
        {#if alignmentNeedsMapping && onMapPerformance}
          <button type="button" class="map-timing" onclick={onMapPerformance}>
            Map performance
          </button>
        {/if}
      </div>
    </div>
    <div class="primary-controls">
      <div class="transport">
        <button
          type="button"
          class="play-button"
          onclick={composition.togglePlayback}
          aria-label={composition.isPlaying ? "Pause preview" : "Play preview"}
        >
          <i
            class={composition.isPlaying
              ? "fa-solid fa-pause"
              : "fa-solid fa-play"}
            aria-hidden="true"
          ></i>
        </button>
        <span>{formatTime(composition.previewSeconds)}</span>
        <span class="duration">/ {formatTime(composition.durationSeconds)}</span
        >
      </div>
      {#if composition.tempoBpm !== null}
        <!-- No "Tempo" label: the control already reads "… BPM". The group
             role carries the name for assistive tech instead. -->
        <div class="tempo-editor" role="group" aria-label="Tempo">
          <TempoControl
            bpm={composition.tempoBpm}
            onBpmChange={composition.setTempoBpm}
            showPresets={false}
            showPractice={false}
            presetsMode="popover"
          />
        </div>
      {/if}
    </div>
    <button
      type="button"
      class:active={advanced}
      class="advanced-toggle"
      aria-expanded={advanced}
      onclick={onToggleAdvanced}
    >
      <i class="fa-solid fa-sliders" aria-hidden="true"></i>
      {advanced ? "Hide timeline" : "Advanced timing"}
    </button>
  </div>

  {#if advanced}
    <div class="advanced-panel">
      <p class="timeline-help">
        Drag clip edges to change when each source appears. Arrow keys move 0.1
        seconds; hold Shift for 1 second.
      </p>
      <div class="ruler" aria-hidden="true">
        <span>{formatTime(0)}</span>
        <span>{formatTime(composition.durationSeconds * 0.25)}</span>
        <span>{formatTime(composition.durationSeconds * 0.5)}</span>
        <span>{formatTime(composition.durationSeconds * 0.75)}</span>
        <span>{formatTime(composition.durationSeconds)}</span>
      </div>

      <div class="lanes">
        {#each lanes as lane (lane.region.id)}
          <div class="lane">
            <span class="lane-label">{lane.region.label}</span>
            <div class="lane-track">
              {#each lane.clips as clip (clip.id)}
                <button
                  type="button"
                  class="clip"
                  class:selected={composition.selectedRegion?.id ===
                    lane.region.id}
                  data-role={clip.sourceRole}
                  style={clipStyle(clip)}
                  aria-label={`Edit ${roleLabel(clip.sourceRole)}, ${clipTimeLabel(clip)}`}
                  title={`${roleLabel(clip.sourceRole)} · ${clipTimeLabel(clip)}`}
                  onclick={() => composition.selectRole(clip.sourceRole)}
                >
                  <strong>{roleLabel(clip.sourceRole)}</strong>
                  <span class="clip-time">{clipTimeLabel(clip)}</span>
                </button>
                {@const clipStartPercent = percent(clip.start)}
                {@const clipEndPercent = percent(clip.end)}
                <button
                  type="button"
                  role="slider"
                  class="trim-handle trim-start"
                  class:at-leading={clipStartPercent < 0.5}
                  style:left={`${clipStartPercent}%`}
                  aria-label={`Trim ${roleLabel(clip.sourceRole)} start`}
                  aria-valuemin="0"
                  aria-valuemax={composition.durationSeconds}
                  aria-valuenow={boundarySeconds(clip, "start")}
                  aria-valuetext={formatTime(boundarySeconds(clip, "start"))}
                  title="Drag to change when this starts"
                  onpointerdown={(event) => beginTrim(event, clip.id, "start")}
                  onkeydown={(event) => nudgeTrim(event, clip, "start")}
                ></button>
                <button
                  type="button"
                  role="slider"
                  class="trim-handle trim-end"
                  class:at-trailing={clipEndPercent > 99.5}
                  style:left={`${clipEndPercent}%`}
                  aria-label={`Trim ${roleLabel(clip.sourceRole)} end`}
                  aria-valuemin="0"
                  aria-valuemax={composition.durationSeconds}
                  aria-valuenow={boundarySeconds(clip, "end")}
                  aria-valuetext={formatTime(boundarySeconds(clip, "end"))}
                  title="Drag to change when this ends"
                  onpointerdown={(event) => beginTrim(event, clip.id, "end")}
                  onkeydown={(event) => nudgeTrim(event, clip, "end")}
                ></button>
              {/each}
              {#each composition.activePreset.transitions.filter( (transition) => lane.clips.some((clip) => clip.id === transition.outgoingClipId) ) as transition (transition.id)}
                <span
                  class="transition"
                  style={transitionStyle(transition)}
                  title="Crossfade"
                  aria-hidden="true"
                ></span>
              {/each}
            </div>
          </div>
        {/each}
      </div>

      <div class="scrubber">
        <input
          type="range"
          min="0"
          max={composition.durationSeconds}
          step="0.01"
          value={composition.previewSeconds}
          aria-label="Preview time"
          oninput={onScrub}
        />
        <span
          class="playhead"
          style:left={`${(composition.previewSeconds / composition.durationSeconds) * 100}%`}
          aria-hidden="true"
        ></span>
      </div>
    </div>
  {/if}
</section>

<style>
  .timeline {
    display: grid;
    gap: clamp(0.75rem, 0.65rem + 0.12cqi, 1rem);
    min-width: 0;
  }

  .timeline.advanced {
    min-width: 42rem;
  }

  /* Three zones, not two ends. Spanning the full workspace, `space-between`
     would have thrown the title and the transport ~3000px apart at 4K. The
     centre track keeps the transport near the frame it drives while the
     title and the mode toggle hold the edges, and the outer 1fr columns stay
     equal so the centre stays centred as the title text changes. */
  .timeline-heading {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center;
    gap: 1rem;
  }

  .heading-title {
    min-width: 0;
  }

  .advanced-toggle {
    justify-self: end;
  }

  .timeline-help {
    margin: 0.3rem 0 0;
    color: var(--theme-text-dim);
    font-size: var(--studio-meta-size, var(--font-size-compact));
    line-height: 1.35;
  }

  .advanced-panel {
    display: grid;
    gap: clamp(0.65rem, 0.55rem + 0.1cqi, 0.9rem);
  }

  h3 {
    margin: 0;
    color: var(--theme-text, #fff);
    font-size: var(--studio-section-title-size, 1.15rem);
    line-height: 1.1;
  }

  .title-row,
  .alignment {
    display: flex;
    align-items: center;
  }

  /* Both sit in the heading's flexible first column. Without this they wrap to
     three lines at tablet widths rather than letting the column shrink. */
  .alignment,
  .map-timing {
    white-space: nowrap;
  }

  .map-timing {
    min-height: 2.25rem;
    padding: 0.35rem 0.65rem;
    border: 1px solid var(--theme-accent);
    border-radius: var(--radius-2026-full);
    background: color-mix(in srgb, var(--theme-accent) 12%, transparent);
    color: var(--theme-text);
    font: inherit;
    font-size: var(--studio-meta-size, var(--font-size-compact));
    font-weight: 700;
    cursor: pointer;
  }

  .title-row {
    gap: 0.55rem;
  }

  .alignment {
    gap: 0.3rem;
    padding: 0.25rem 0.45rem;
    border: 1px solid var(--theme-stroke);
    border-radius: 999px;
    background: var(--theme-card-bg);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.66));
    font-size: var(--studio-meta-size, var(--font-size-compact, 0.75rem));
    line-height: 1;
  }

  .transport {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    min-width: 8.75rem;
    color: var(--theme-text, #fff);
    font-variant-numeric: tabular-nums;
    font-size: var(--studio-body-size, var(--font-size-min, 0.875rem));
  }

  .primary-controls,
  .tempo-editor {
    display: flex;
    align-items: center;
  }

  .primary-controls {
    justify-content: center;
    gap: var(--spacing-lg);
    min-width: 0;
  }

  .tempo-editor {
    color: var(--theme-text-dim);
    font-size: var(--studio-meta-size, var(--font-size-compact));
  }

  .tempo-editor :global(.tempo-wrapper) {
    width: 13rem;
  }

  .advanced-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    min-width: 10rem;
    min-height: var(--studio-control-height, 2.75rem);
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-2026-sm);
    background: var(--theme-card-bg);
    color: var(--theme-text);
    font: inherit;
    font-size: var(--studio-meta-size, var(--font-size-compact));
    font-weight: 700;
    cursor: pointer;
  }

  .advanced-toggle.active {
    border-color: var(--theme-accent);
    color: var(--theme-accent);
  }

  .duration {
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.55));
  }

  .play-button {
    display: grid;
    place-items: center;
    width: var(--studio-control-height, 2.75rem);
    height: var(--studio-control-height, 2.75rem);
    margin-right: 0.25rem;
    padding: 0;
    border: 1px solid
      color-mix(in srgb, var(--theme-accent, #8b7cff) 58%, transparent);
    border-radius: 999px;
    background: color-mix(
      in srgb,
      var(--theme-accent, #8b7cff) 18%,
      transparent
    );
    color: color-mix(in srgb, var(--theme-accent, #8b7cff) 62%, white);
    cursor: pointer;
  }

  .play-button:focus-visible,
  .map-timing:focus-visible,
  .advanced-toggle:focus-visible,
  input:focus-visible {
    outline: 3px solid var(--theme-accent, #8b7cff);
    outline-offset: 2px;
  }

  .lanes {
    display: grid;
    gap: 0.4rem;
  }

  .ruler {
    display: grid;
    grid-template-columns: repeat(4, 1fr) auto;
    margin-left: 6.125rem;
    color: var(--theme-text-dim);
    font-size: var(--studio-meta-size, var(--font-size-compact));
    font-variant-numeric: tabular-nums;
  }

  .ruler span:not(:first-child):not(:last-child) {
    transform: translateX(-50%);
  }

  .lane {
    display: grid;
    grid-template-columns: 5.5rem minmax(0, 1fr);
    align-items: center;
    gap: 0.625rem;
  }

  .lane-label {
    overflow: hidden;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.66));
    font-size: var(--studio-meta-size, var(--font-size-compact, 0.75rem));
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .lane-track {
    position: relative;
    height: var(--studio-control-height, 2.75rem);
    overflow: hidden;
    border: 1px solid var(--theme-stroke);
    border-radius: 0.5rem;
    background: color-mix(in srgb, var(--theme-card-bg) 70%, transparent);
  }

  .trim-handle {
    position: absolute;
    inset-block: 0;
    z-index: 5;
    width: var(--studio-control-height, 2.75rem);
    min-width: var(--studio-control-height, 2.75rem);
    min-height: var(--studio-control-height, 2.75rem);
    padding: 0;
    border: 0;
    background: transparent;
    color: white;
    cursor: ew-resize;
    touch-action: none;
    transform: translateX(-50%);
  }

  .trim-handle::after {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0.65rem;
    height: 1.6rem;
    border: 1px solid color-mix(in srgb, var(--theme-text) 72%, transparent);
    border-radius: var(--radius-2026-xs);
    background: var(--theme-panel-bg);
    box-shadow: 0 0 0 1px var(--theme-shadow);
    content: "";
    transform: translate(-50%, -50%);
  }

  .trim-handle.at-leading {
    transform: none;
  }

  .trim-handle.at-leading::after {
    left: 0.2rem;
  }

  .trim-handle.at-trailing {
    transform: translateX(-100%);
  }

  .trim-handle.at-trailing::after {
    left: calc(100% - 0.2rem);
  }

  .trim-handle:hover::after,
  .trim-handle:focus-visible::after {
    border-color: white;
    background: color-mix(in srgb, var(--theme-accent, #8b7cff) 72%, #101018);
  }

  .trim-handle:focus-visible {
    outline: 3px solid var(--theme-accent, #8b7cff);
    outline-offset: -4px;
  }

  .clip {
    position: absolute;
    inset-block: 0.2rem;
    display: flex;
    align-items: center;
    min-width: 0.25rem;
    padding-inline: 0.5rem;
    overflow: hidden;
    gap: var(--spacing-sm);
    border: 1px solid color-mix(in srgb, var(--theme-text) 14%, transparent);
    border-radius: 0.35rem;
    background: linear-gradient(135deg, #243b84, #182557);
    color: rgba(255, 255, 255, 0.88);
    font: inherit;
    font-size: var(--studio-meta-size, var(--font-size-compact, 0.75rem));
    white-space: nowrap;
    cursor: pointer;
  }

  .clip.selected {
    border-color: var(--theme-accent);
    box-shadow: inset 0 0 0 1px var(--theme-accent);
  }

  .clip strong {
    overflow: hidden;
    font-size: inherit;
    text-overflow: ellipsis;
  }

  .clip-time {
    margin-left: auto;
    color: color-mix(in srgb, currentColor 76%, transparent);
    font-variant-numeric: tabular-nums;
  }

  .clip[data-role="performance-video"] {
    background: linear-gradient(135deg, #8a315d, #4d203f);
  }

  .clip[data-role="choreo-card"] {
    background: linear-gradient(135deg, #34343d, #24242b);
  }

  .transition {
    position: absolute;
    inset-block: 0.15rem;
    z-index: 3;
    min-width: 0.35rem;
    border: 1px solid rgba(255, 219, 178, 0.68);
    border-radius: 0.4rem;
    background: repeating-linear-gradient(
      135deg,
      rgba(255, 196, 128, 0.4) 0 0.3rem,
      rgba(255, 255, 255, 0.08) 0.3rem 0.6rem
    );
    box-shadow: 0 0 0.75rem rgba(255, 174, 92, 0.2);
  }

  .scrubber {
    position: relative;
    margin-left: 6.125rem;
    min-height: var(--studio-control-height, 2.75rem);
  }

  input {
    display: block;
    width: 100%;
    height: var(--studio-control-height, 2.75rem);
    margin: 0;
    opacity: 0.001;
    cursor: ew-resize;
  }

  .scrubber::before {
    content: "";
    position: absolute;
    inset: 50% 0 auto;
    height: 2px;
    background: rgba(255, 255, 255, 0.14);
    transform: translateY(-50%);
    pointer-events: none;
  }

  .playhead {
    position: absolute;
    top: 0.5rem;
    bottom: 0.5rem;
    width: 2px;
    border-radius: 99px;
    background: color-mix(in srgb, var(--theme-accent, #8b7cff) 66%, white);
    box-shadow: 0 0 0 3px
      color-mix(in srgb, var(--theme-accent, #8b7cff) 20%, transparent);
    transform: translateX(-1px);
    pointer-events: none;
  }

  @container post-studio (max-width: 34rem) {
    .timeline.advanced {
      min-width: 0;
    }

    .timeline-heading {
      grid-template-columns: minmax(0, 1fr);
      align-items: start;
    }

    .primary-controls {
      align-items: stretch;
      width: 100%;
      flex-wrap: wrap;
      justify-content: flex-start;
      gap: var(--spacing-sm);
    }

    .transport {
      min-width: 0;
    }

    .tempo-editor {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      flex: 1 1 100%;
    }

    .tempo-editor :global(.tempo-wrapper) {
      width: auto;
      min-width: 0;
    }

    .advanced-toggle {
      display: none;
    }

    .lane {
      grid-template-columns: 4.25rem minmax(0, 1fr);
    }

    .ruler,
    .scrubber {
      margin-left: 4.875rem;
    }

    .ruler span:nth-child(even) {
      visibility: hidden;
    }

    .clip {
      padding-inline: 0.3rem;
    }
  }

  /* The 70–90rem tier used to force the controls onto their own line: at that
     width the row could not fit inside the canvas column. Spanning the
     workspace it fits on one line from 70rem up, so the tier is gone. */

  @container post-studio (min-width: 105rem) {
    .lane {
      grid-template-columns: 7rem minmax(0, 1fr);
    }

    .ruler,
    .scrubber {
      margin-left: 7.625rem;
    }

    .clip,
    .lane-label {
      font-size: var(--studio-body-size, 0.9375rem);
    }
  }

  @container post-studio (min-width: 180rem) {
    .lane {
      grid-template-columns: 8rem minmax(0, 1fr);
      gap: 1rem;
    }

    .ruler,
    .scrubber {
      margin-left: 9rem;
    }
  }
</style>
