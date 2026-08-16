<!--
  StepMapEditor.svelte

  Maps a performance video's timing to a sequence, by tapping the pictograph.

  The button's face is the move happening right now. You watch the performer,
  you see that shape land, you hit the button. Every tap is the same action -
  "the props arrived at that" - which is why the screen needs no instructions:
  it is visual matching, not counting. Slow motion is what makes the match
  findable, so marking runs at 0.5x by default.

  Marking every arrival yields one more instant than there are moves: the
  opening pose, then the landing of each move. A move's arrival IS the next
  move's launch, so those marks map straight onto beatTimestamps (which has
  always meant "when move i+1 starts") plus a final endTimestamp. Nothing
  downstream changes. See
  docs/superpowers/specs/2026-08-16-step-map-editor-redesign-design.md.
-->
<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import type { StepMap } from "$lib/shared/video-collaboration/domain/collaborative-video";
  import { generateEvenBeatTimestamps } from "$lib/shared/video-collaboration/utils/step-map-utils";
  import { formatTime } from "$lib/shared/sequence-viewer/utils/format-time";
  import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
  import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import TKAWordGlyph from "$lib/shared/choreo-card/components/TKAWordGlyph.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import StepMapTimeline from "./StepMapTimeline.svelte";
  import { mirrorBeat } from "$lib/shared/create/services/step-transforms";
  import { mirrorStartPosition } from "$lib/shared/create/services/start-position-transforms";
  import { motionQueryHandler } from "$lib/shared/pictograph/shared/services/motion-query-handler";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

  interface Props {
    videoUrl: string;
    videoDuration: number;
    /** Every move, in order. Its length is the move count. */
    steps: readonly StepData[];
    /** The opening pose. The first mark is the performer settling into it. */
    startPosition?: StartPositionData | null;
    initialStepMap?: StepMap;
    bpm: number;
    onSave: (beatMap: StepMap) => Promise<void>;
    onClose: () => void;
  }

  let {
    videoUrl,
    videoDuration,
    steps,
    startPosition = null,
    initialStepMap,
    bpm,
    onSave,
    onClose,
  }: Props = $props();

  /** Nudging moves a mark by one frame of typical phone footage. */
  const FRAME = 1 / 30;
  /** Slow enough to see a landing, fast enough not to feel like a chore. */
  const MARKING_RATE = 0.5;
  /** One move's worth of footage, give or take: enough to re-watch a landing. */
  const SKIP_SECONDS = 3;

  const moveCount = $derived(steps.length);
  const totalMarks = $derived(moveCount + 1);

  // ---- Video ----
  let videoEl: HTMLVideoElement | undefined = $state();
  let isPlaying = $state(false);
  let currentTime = $state(0);
  /**
   * Marking opens slowed down, because the landing is what you are looking for.
   * Re-timing an existing map opens on the timeline, where full speed is what
   * you want to check the result against.
   */
  let rate = $state(untrack(() => initialStepMap) ? 1 : MARKING_RATE);

  // ---- Marks ----
  /**
   * One timestamp per arrival, in tap order. Shorter than totalMarks while a
   * run is in progress.
   */
  let marks = $state<number[]>(
    untrack(() => marksFromStepMap(initialStepMap, videoDuration))
  );

  /**
   * Marking is the screen when there is no timing yet; an existing map opens on
   * the timeline with its marks intact.
   */
  let mode = $state<"mark" | "review">(
    untrack(() => initialStepMap) ? "review" : "mark"
  );

  let selectedMark = $state(0);
  let isSaving = $state(false);
  let saveError = $state<string | null>(null);
  let flashing = $state(false);
  let flashTimeout: ReturnType<typeof setTimeout> | undefined;

  const complete = $derived(marks.length >= totalMarks);
  const canSave = $derived(!isSaving && complete && moveCount > 0);

  /**
   * How far into the run the playhead sits: how many marks it is at or past.
   * Deriving the run's position from the playhead rather than from a counter is
   * what makes rewinding safe - scrub back and the face, the count and the
   * timeline all return to that moment, while every mark stays exactly where it
   * was. Only a tap commits the re-take.
   */
  const placed = $derived(
    marks.filter((mark) => mark <= currentTime + FRAME).length
  );
  /** Marks the next tap would replace. Zero unless the playhead was rewound. */
  const supersededCount = $derived(Math.max(0, marks.length - placed));
  /** The mark the next tap will place - and so the move to watch for. */
  const pendingIndex = $derived(Math.min(placed, totalMarks - 1));

  /**
   * Mark 0 is the opening pose. Mark i is the landing of move i, so the face
   * shows the move that is happening right now, and you tap when it finishes.
   */
  function faceFor(index: number): StepData | StartPositionData | null {
    const showMirrored = mirrored && mirroredSteps !== null;
    const source = showMirrored ? mirroredSteps! : steps;
    if (index <= 0) return showMirrored ? mirroredStart : startPosition;
    return source[index - 1] ?? null;
  }

  function letterFor(index: number): string {
    if (index <= 0) return "";
    return steps[index - 1]?.letter?.trim() ?? "";
  }

  /** Mark 0 is the opening pose, not move 0, so it is not a number. */
  const markLabels = $derived(
    Array.from({ length: totalMarks }, (_, index) =>
      index === 0 ? "start" : String(index)
    )
  );

  const pendingFace = $derived(faceFor(pendingIndex));
  const selectedFace = $derived(faceFor(selectedMark));

  function marksFromStepMap(
    map: StepMap | undefined,
    duration: number
  ): number[] {
    if (!map) return [];
    // The final arrival was added later, so a map saved before then ends at the
    // clip rather than at a marked instant.
    return [...map.beatTimestamps, map.endTimestamp ?? duration];
  }

  // ---- Playback ----

  function applyRate(next: number): void {
    rate = next;
    if (videoEl) videoEl.playbackRate = next;
  }

  /**
   * The footage's own aspect, which sizes the stage column on wide panels.
   * 16:9 until the file says otherwise; most performance clips are portrait
   * and would otherwise be a strip in a wide black box.
   */
  let videoRatio = $state(16 / 9);

  function handleLoadedMetadata(): void {
    if (!videoEl) return;
    videoEl.playbackRate = rate;
    if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
      videoRatio = videoEl.videoWidth / videoEl.videoHeight;
    }
  }

  function togglePlayPause(): void {
    if (!videoEl) return;
    if (isPlaying) {
      videoEl.pause();
      return;
    }
    void videoEl.play().catch(() => {
      saveError = "Playback could not start. Try the play button again.";
    });
  }

  function seekTo(time: number): void {
    const clamped = Math.max(0, Math.min(time, videoDuration));
    // Move the readout now rather than waiting for the video to decode.
    currentTime = clamped;
    if (videoEl) videoEl.currentTime = clamped;
  }

  /** Jump by a few seconds, for when the landing went past before the tap. */
  function skip(seconds: number): void {
    seekTo((videoEl?.currentTime ?? currentTime) + seconds);
  }

  // ---- Audience view ----

  /**
   * A performer works in their own frame; the camera sees it reflected, so a
   * hand that goes west in the notation appears to go east in the footage.
   * Mirroring flips the pictographs across the vertical axis so they read the
   * way the clip does.
   *
   * The video is deliberately NOT the thing that flips - footage often carries
   * titles or a watermark, and mirroring those wrecks them.
   *
   * This is a view, not an edit: `marks` and everything handed to onSave are
   * untouched. Letters are invariant under mirroring (proven across every row
   * of both dataframes), so the glyphs stay correct as the geometry flips.
   */
  let mirrored = $state(false);
  let mirroredSteps = $state<StepData[] | null>(null);
  let mirroredStart = $state<StartPositionData | null>(null);

  async function toggleMirror(): Promise<void> {
    mirrored = !mirrored;
    if (!mirrored || mirroredSteps) return;

    mirroredSteps = await Promise.all(
      steps.map((step) =>
        mirrorBeat(
          step,
          step.motions[MotionColor.BLUE]?.gridMode ?? GridMode.DIAMOND,
          motionQueryHandler
        )
      )
    );
    mirroredStart = startPosition ? mirrorStartPosition(startPosition) : null;
  }

  // ---- Marking ----

  function startMarking(): void {
    mode = "mark";
    marks = [];
    saveError = null;
    applyRate(MARKING_RATE);
    seekTo(0);
    if (videoEl) {
      void videoEl.play().catch(() => {
        saveError = "Playback could not start. Try the play button again.";
      });
    }
  }

  function markArrival(): void {
    if (mode !== "mark") return;

    // Straight off the element, not the `currentTime` state: timeupdate fires
    // about four times a second, so the state can be a quarter second stale at
    // the instant of the tap - which is most of a move at 0.5x.
    const at = videoEl?.currentTime ?? currentTime;

    // A tap claims this instant and everything after it. Rewinding and tapping
    // again therefore picks the run back up at that point instead of being
    // swallowed by the ordering rule, and a double-fire overwrites rather than
    // duplicating. Either way the marks stay strictly increasing, which is what
    // every consumer of beatTimestamps assumes.
    const kept = marks.filter((mark) => mark < at - FRAME);
    if (kept.length >= totalMarks) return;

    marks = [...kept, at];
    // Keeps the face in step with the tap rather than with the next timeupdate.
    currentTime = at;

    flashing = true;
    if (flashTimeout) clearTimeout(flashTimeout);
    flashTimeout = setTimeout(() => (flashing = false), 260);

    if (marks.length >= totalMarks) {
      videoEl?.pause();
      applyRate(1);
      selectedMark = totalMarks - 1;
      mode = "review";
    }
  }

  function undoMark(): void {
    if (marks.length === 0) return;
    const undone = marks[marks.length - 1];
    marks = marks.slice(0, -1);

    if (mode === "review") {
      selectedMark = Math.min(selectedMark, marks.length - 1);
      return;
    }
    // Put the playhead back where the rejected mark was, so that moment can be
    // watched again instead of hunted for.
    if (undone !== undefined) seekTo(undone - FRAME);
  }

  function useEvenSpacing(): void {
    marks = generateEvenBeatTimestamps(videoDuration, totalMarks, bpm);
    selectedMark = 0;
    mode = "review";
    applyRate(1);
    videoEl?.pause();
    seekTo(marks[0] ?? 0);
  }

  // ---- Review ----

  function selectMark(index: number): void {
    selectedMark = Math.max(0, Math.min(index, marks.length - 1));
    const at = marks[selectedMark];
    if (at !== undefined) seekTo(at);
  }

  /** Marks cannot cross their neighbours; every consumer reads them in order. */
  function clampMark(index: number, time: number): number {
    const gap = 0.03;
    const min = index > 0 ? (marks[index - 1] ?? 0) + gap : 0;
    const max =
      index < marks.length - 1 ? (marks[index + 1] ?? videoDuration) - gap : videoDuration;
    return Math.max(0, Math.min(Math.max(min, Math.min(max, time)), videoDuration));
  }

  function moveMark(index: number, time: number): void {
    const next = [...marks];
    next[index] = clampMark(index, time);
    marks = next;
  }

  function nudgeSelected(frames: number): void {
    const at = marks[selectedMark];
    if (at === undefined) return;
    moveMark(selectedMark, at + frames * FRAME);
    const moved = marks[selectedMark];
    if (moved !== undefined) seekTo(moved);
  }

  // ---- Keyboard ----

  function handleKeyboard(event: KeyboardEvent): void {
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      undoMark();
      return;
    }

    if (mode === "mark") {
      // Space on a focused button already activates it, so only the cases the
      // browser will not handle need intercepting.
      if (event.code === "Space" || event.key === "Enter") {
        if (target instanceof HTMLButtonElement) return;
        event.preventDefault();
        markArrival();
      }
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      nudgeSelected(event.key === "ArrowLeft" ? -1 : 1);
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      selectMark(selectedMark + (event.key === "ArrowUp" ? -1 : 1));
    }
  }

  // ---- Save ----

  async function handleSave(): Promise<void> {
    isSaving = true;
    saveError = null;

    const ordered = [...marks].sort((a, b) => a - b);
    if (ordered.length !== totalMarks) {
      saveError = `Mark all ${totalMarks} moments before saving.`;
      isSaving = false;
      return;
    }

    try {
      await onSave({
        beatTimestamps: ordered.slice(0, moveCount),
        endTimestamp: ordered[moveCount],
        stepCount: moveCount,
        source: "manual",
        updatedAt: new Date(),
      });
    } catch (cause) {
      saveError =
        cause instanceof Error ? cause.message : "Failed to save the timing";
    } finally {
      isSaving = false;
    }
  }

  onDestroy(() => {
    if (flashTimeout) clearTimeout(flashTimeout);
  });
</script>

<svelte:window onkeydown={handleKeyboard} />

{#snippet mirrorToggle()}
  <button
    type="button"
    class="aux-btn mirror-btn"
    class:on={mirrored}
    aria-pressed={mirrored}
    onclick={toggleMirror}
  >
    <i class="fas fa-arrows-left-right" aria-hidden="true"></i>
    Mirror
  </button>
{/snippet}

<!-- The shell exists to be queried. A container query resolves against an
     ANCESTOR container, so rules that recompose .editor itself cannot live
     behind its own container-type - they silently never applied. -->
<div class="step-map-shell" style="--video-ratio: {videoRatio}">
  <div class="editor">
    <div class="stage">
      <!-- svelte-ignore a11y_media_has_caption -->
      <video
        bind:this={videoEl}
        src={videoUrl}
        playsinline
        onloadedmetadata={handleLoadedMetadata}
        ontimeupdate={() => videoEl && (currentTime = videoEl.currentTime)}
        onplay={() => (isPlaying = true)}
        onpause={() => (isPlaying = false)}
        onended={() => (isPlaying = false)}
      ></video>

      <div class="stage-bar">
        <button
          type="button"
          class="stage-skip"
          onclick={() => skip(-SKIP_SECONDS)}
          aria-label="Back {SKIP_SECONDS} seconds"
        >
          <i class="fas fa-rotate-left" aria-hidden="true"></i>
          <span class="skip-label">{SKIP_SECONDS}s</span>
        </button>
        <button
          type="button"
          class="stage-play"
          onclick={togglePlayPause}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          <i class="fas {isPlaying ? 'fa-pause' : 'fa-play'}" aria-hidden="true"
          ></i>
        </button>
        <button
          type="button"
          class="stage-skip"
          onclick={() => skip(SKIP_SECONDS)}
          aria-label="Forward {SKIP_SECONDS} seconds"
        >
          <i class="fas fa-rotate-right" aria-hidden="true"></i>
          <span class="skip-label">{SKIP_SECONDS}s</span>
        </button>
        <span class="stage-time">
          {formatTime(currentTime)} / {formatTime(videoDuration)}
        </span>
      </div>
    </div>

    <!-- Present while marking too, so overshooting a landing is a scrub back
         rather than a start-over. The marks show as ticks there: a 44px drag
         handle on each one would swallow the pointer-downs used to reach them. -->
    <div class="timeline-row">
      <StepMapTimeline
        duration={videoDuration}
        {currentTime}
        beatTimestamps={marks}
        activeStepIndex={mode === "review" ? selectedMark : placed - 1}
        markerLabels={markLabels}
        readOnlyMarks={mode === "mark"}
        provisionalFrom={mode === "mark" ? placed : Number.POSITIVE_INFINITY}
        onTimestampChange={moveMark}
        onSelect={mode === "review" ? selectMark : undefined}
        onSeek={seekTo}
      />
    </div>

    {#if mode === "mark"}
      <div class="control-bar mark-bar">
        <div class="rate-row">
          <!-- Wrapped because SegmentedControl sets width:100%, which resolves
               flex-basis:auto and stretches three short labels across the row. -->
          <span class="rate-control">
            <SegmentedControl
              options={[
                { value: 0.25, label: "0.25x", ariaLabel: "Quarter speed" },
                { value: 0.5, label: "0.5x", ariaLabel: "Half speed" },
                { value: 1, label: "1x", ariaLabel: "Full speed" },
              ]}
              value={rate}
              onchange={applyRate}
              size="sm"
              ariaLabel="Playback speed"
            />
          </span>
          {@render mirrorToggle()}
          <!-- Sized to the longer of the two sentences at whatever width the
               row happens to be, so toggling Mirror cannot add a line here and
               push the tap button down. -->
          <span class="rate-hint">
            <span class="hint-sizer" aria-hidden="true"
              >Pictographs face the camera, like the audience sees it</span
            >
            <span class="hint-live">
              {mirrored
                ? "Pictographs face the camera, like the audience sees it"
                : "Slow it down to catch the landing"}
            </span>
          </span>
        </div>

        <button
          type="button"
          class="tap-target"
          class:flash={flashing}
          onclick={markArrival}
          disabled={placed >= totalMarks}
        >
          <span class="tap-face">
            {#if pendingFace}
              <PictographContainer
                pictographData={pendingFace}
                disableTransitions={true}
              />
            {/if}
          </span>
          <span class="tap-copy">
            <strong>
              {pendingIndex === 0
                ? "Tap when they set into this pose"
                : "Tap when this move lands"}
            </strong>
            <span class="tap-progress">
              {placed} of {totalMarks} marked
              {#if letterFor(pendingIndex)}
                <span class="tap-letter">
                  <TKAWordGlyph
                    word={letterFor(pendingIndex)}
                    height={18}
                    darkMode
                  />
                </span>
              {/if}
            </span>
            <!-- Two lines are always reserved: this swaps to a longer sentence
                 the moment the playhead is rewound, and growing here would
                 shove every control under it. -->
            <span class="tap-key">
              {#if supersededCount > 0}
                Tapping re-takes from here, replacing the
                {supersededCount}
                {supersededCount === 1 ? "mark" : "marks"} after it
              {:else}
                <span class="kbd-hint">Space works too</span>
              {/if}
            </span>
          </span>
        </button>

        <div class="aux-row">
          <button
            type="button"
            class="aux-btn"
            onclick={undoMark}
            disabled={marks.length === 0}
          >
            <i class="fas fa-rotate-left" aria-hidden="true"></i>
            Undo last
          </button>
          <button type="button" class="aux-btn" onclick={startMarking}>
            <i class="fas fa-backward-fast" aria-hidden="true"></i>
            Start over
          </button>
          <button type="button" class="aux-btn" onclick={useEvenSpacing}>
            <i class="fas fa-ruler-horizontal" aria-hidden="true"></i>
            Start from even spacing
          </button>
        </div>
      </div>
    {:else}
      <div class="control-bar review-bar">
        <div class="selected-row">
          <span class="selected-face">
            {#if selectedFace}
              <PictographContainer
                pictographData={selectedFace}
                disableTransitions={true}
              />
            {/if}
          </span>
          <span class="selected-copy">
            <span class="selected-label">
              {selectedMark === 0 ? "Opening pose" : `Move ${selectedMark}`}
              {#if letterFor(selectedMark)}
                <span class="selected-letter">
                  <TKAWordGlyph
                    word={letterFor(selectedMark)}
                    height={16}
                    darkMode
                  />
                </span>
              {/if}
            </span>
            <span class="selected-time">
              lands at {formatTime(marks[selectedMark] ?? 0)}
            </span>
          </span>
          <span class="nudge">
            <button
              type="button"
              class="aux-btn"
              onclick={() => nudgeSelected(-1)}
              aria-label="Move this mark one frame earlier"
            >
              <i class="fas fa-angle-left" aria-hidden="true"></i>
              a frame earlier
            </button>
            <button
              type="button"
              class="aux-btn"
              onclick={() => nudgeSelected(1)}
              aria-label="Move this mark one frame later"
            >
              a frame later
              <i class="fas fa-angle-right" aria-hidden="true"></i>
            </button>
          </span>
        </div>

        <div class="aux-row">
          <button type="button" class="aux-btn" onclick={startMarking}>
            <i class="fas fa-hand-pointer" aria-hidden="true"></i>
            Mark it again
          </button>
          <button type="button" class="aux-btn" onclick={useEvenSpacing}>
            <i class="fas fa-ruler-horizontal" aria-hidden="true"></i>
            Even spacing
          </button>
          {@render mirrorToggle()}
          <span class="review-progress" class:complete>
            {marks.length} of {totalMarks} marked
          </span>
        </div>
      </div>
    {/if}

    {#if saveError}
      <div class="error-banner" role="alert">
        <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
        <span>{saveError}</span>
      </div>
    {/if}

    <div class="action-bar">
      <button
        type="button"
        class="cancel-btn"
        onclick={onClose}
        disabled={isSaving}
      >
        Cancel
      </button>
      <button
        data-save-shortcut
        type="button"
        class="save-btn"
        onclick={handleSave}
        disabled={!canSave}
      >
        {#if isSaving}
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          Saving...
        {:else}
          <i class="fas fa-check" aria-hidden="true"></i>
          Save timing
        {/if}
      </button>
    </div>
  </div>
</div>

<style>
  /* The one container every query in this file resolves against, so a rule that
     recomposes .editor and a rule that recomposes its children cross the same
     seam at the same width. */
  .step-map-shell {
    container-type: inline-size;
    block-size: 100%;
  }

  /* The stage takes what is left after the controls, so the tap button is
     never the thing that falls below the fold. */
  .editor {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) auto auto auto;
    gap: clamp(0.75rem, 1.4cqw, 1.5rem);
    block-size: 100%;
    padding: clamp(0.75rem, 1.6cqw, 2rem);
    background: var(--theme-panel-bg, #101018);
  }

  .stage {
    position: relative;
    grid-row: 1;
    min-block-size: 0;
    border-radius: 0.75rem;
    overflow: hidden;
  }

  /* Filling the stage absolutely rather than sizing to the file: a percentage
     max-height against a 1fr grid area is treated as indefinite, so the video
     kept its intrinsic 956px height and overflowed everything under it. */
  .stage video {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    object-fit: contain;
  }

  .timeline-row {
    grid-row: 2;
  }

  .control-bar {
    grid-row: 3;
  }

  .action-bar {
    grid-row: 4;
  }

  .stage-bar {
    position: absolute;
    inset-inline: 0;
    inset-block-end: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    /* The stage is only as wide as the footage, and a portrait clip beside the
       controls leaves it narrow. Wrapping costs a strip of video; clipping
       would cost a control. */
    flex-wrap: wrap;
    gap: 0.75rem;
    padding: 0.5rem;
  }

  .stage-play {
    display: grid;
    place-items: center;
    inline-size: 44px;
    block-size: 44px;
    border: none;
    border-radius: 50%;
    background: var(--theme-accent, #22b8cf);
    color: #04141a;
    font-size: 1rem;
    cursor: pointer;
  }

  .stage-skip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.3rem;
    min-inline-size: 44px;
    block-size: 44px;
    padding-inline: 0.6rem;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 0.6rem;
    background: rgba(0, 0, 0, 0.55);
    color: rgba(255, 255, 255, 0.9);
    font-size: 0.8125rem;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
  }

  .stage-skip:hover {
    border-color: var(--theme-accent, #22b8cf);
  }

  .stage-time {
    padding: 0.25rem 0.6rem;
    border-radius: 0.5rem;
    background: rgba(0, 0, 0, 0.55);
    color: rgba(255, 255, 255, 0.85);
    /* The clock changes every frame; proportional digits would jitter it. */
    font-variant-numeric: tabular-nums;
    font-size: 0.8125rem;
  }

  .control-bar {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    inline-size: min(44rem, 100%);
    margin-inline: auto;
  }

  .rate-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .rate-control {
    flex: 0 0 auto;
    inline-size: max-content;
  }

  .rate-hint {
    display: inline-grid;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.55));
    font-size: 0.8125rem;
  }

  .rate-hint > * {
    grid-area: 1 / 1;
  }

  .hint-sizer {
    visibility: hidden;
  }

  /* The whole point of the screen, sized like it. */
  .tap-target {
    display: flex;
    align-items: center;
    gap: clamp(0.75rem, 1.5cqw, 1.5rem);
    padding: clamp(0.75rem, 1.2cqw, 1.25rem);
    border: 2px solid var(--theme-accent, #22b8cf);
    border-radius: 1rem;
    background: color-mix(
      in srgb,
      var(--theme-accent, #22b8cf) 14%,
      transparent
    );
    color: inherit;
    text-align: start;
    cursor: pointer;
    transition:
      background 120ms ease,
      transform 120ms ease;
  }

  .tap-target:hover:not(:disabled) {
    background: color-mix(
      in srgb,
      var(--theme-accent, #22b8cf) 22%,
      transparent
    );
  }

  .tap-target.flash {
    background: color-mix(
      in srgb,
      var(--theme-accent, #22b8cf) 46%,
      transparent
    );
    transform: scale(0.99);
  }

  .tap-target:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .tap-face {
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    /* Reserved before the pictograph prepares, so arrival never reflows the
       button or the row of controls under it. */
    inline-size: clamp(5rem, 14cqw, 9rem);
    aspect-ratio: 1;
    border-radius: 0.75rem;
    background: rgba(255, 255, 255, 0.04);
    overflow: hidden;
  }

  .tap-copy {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-inline-size: 0;
  }

  .tap-copy strong {
    font-size: clamp(1rem, 1.5cqw, 1.5rem);
    line-height: 1.2;
  }

  .tap-progress {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.65));
    font-variant-numeric: tabular-nums;
    font-size: 0.875rem;
  }

  .tap-letter,
  .selected-letter {
    display: inline-flex;
    align-items: center;
  }

  .tap-key {
    /* Reserved for the longer re-take sentence, so swapping to it moves
       nothing below. */
    min-block-size: 2.4em;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    font-size: 0.75rem;
  }

  /* Pressed state is the whole control, not a bar down one edge. */
  .mirror-btn.on {
    border-color: var(--theme-accent, #22b8cf);
    background: color-mix(
      in srgb,
      var(--theme-accent, #22b8cf) 22%,
      var(--theme-card-bg, rgba(255, 255, 255, 0.05))
    );
    color: var(--theme-text, #fff);
  }

  .selected-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 0.75rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .selected-face {
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    inline-size: 3rem;
    aspect-ratio: 1;
    border-radius: 0.5rem;
    background: rgba(255, 255, 255, 0.04);
    overflow: hidden;
  }

  .selected-copy {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 0.15rem;
    min-inline-size: 0;
  }

  .selected-label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-weight: 600;
  }

  .selected-time {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-variant-numeric: tabular-nums;
    font-size: 0.8125rem;
  }

  .nudge {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex: 0 0 auto;
  }

  .aux-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  .aux-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    min-block-size: 44px;
    padding: 0 0.85rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    border-radius: 0.6rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    color: inherit;
    font-size: 0.8125rem;
    cursor: pointer;
  }

  .aux-btn:hover:not(:disabled) {
    border-color: var(--theme-accent, #22b8cf);
  }

  .aux-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .review-progress {
    margin-inline-start: auto;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-variant-numeric: tabular-nums;
    font-size: 0.8125rem;
  }

  .review-progress.complete {
    color: var(--semantic-success, #51cf66);
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 0.85rem;
    border-radius: 0.6rem;
    background: color-mix(in srgb, #ff6b6b 18%, transparent);
    color: #ffc9c9;
    font-size: 0.875rem;
  }

  .action-bar {
    display: flex;
    justify-content: flex-end;
    gap: 0.6rem;
  }

  .cancel-btn,
  .save-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-block-size: 44px;
    padding: 0 1.25rem;
    border-radius: 0.6rem;
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
  }

  .cancel-btn {
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    background: transparent;
    color: inherit;
  }

  .save-btn {
    border: none;
    background: var(--theme-accent, #22b8cf);
    color: #04141a;
  }

  .save-btn:disabled {
    opacity: 0.4;
    cursor: default;
  }

  /* Narrow and in the hand: the stage and the tap button are the screen, and
     the button's copy stacks under its pictograph rather than beside it. */
  @container (max-width: 34rem) {
    /* The controls are heavy enough on a phone to squeeze the stage out of
       existence, and the video is the thing you are watching. Floor it, and let
       the surface scroll rather than hide the tap button.
       The floor is set for a PORTRAIT clip, which is what a performance video
       almost always is: at 7rem such a clip renders about 60px wide, too small
       to see which point a prop arrived at, which is the only question this
       screen asks. The height comes back out of the tap card below. */
    .editor {
      grid-template-rows: minmax(11rem, 1fr) auto auto auto;
      gap: 0.5rem;
      padding: 0.5rem;
      overflow-y: auto;
    }

    /* A thumb-width bar is already a comfortable scrub target, and every pixel
       it gives back is one the tap button stays above the fold with. */
    .timeline-row {
      --timeline-bar-height: 32px;
    }

    /* Face beside the copy rather than above it. Stacked, the card alone was a
       third of a phone screen, and it was taking that height from the video. */
    .tap-target {
      gap: 0.75rem;
      padding: 0.625rem;
    }

    .tap-face {
      flex: 0 0 auto;
      inline-size: 6.5rem;
    }

    /* No hardware keyboard to tell them about. The slot itself stays - it also
       carries the re-take notice, which matters most on the tier where the
       timeline is smallest and overshooting is easiest. */
    .kbd-hint,
    .rate-hint {
      display: none;
    }

    .action-bar {
      justify-content: stretch;
    }

    .cancel-btn,
    .save-btn {
      flex: 1;
    }
  }

  /* Wide enough for two columns: the controls move beside the stage instead of
     under it, so the video gets the full height rather than half of it and the
     rail either side of a portrait clip stops being dead space. The timeline
     still spans the full width, because it is a ruler. */
  @container (min-width: 52rem) {
    .editor {
      /* The stage column is sized from the footage, not from whatever is left
         over. Performance clips are usually shot on a phone in portrait, and a
         9:16 clip given a 1fr column renders as a narrow strip stranded in
         800px of black. Sizing the column by ratio x height puts the video and
         the controls next to each other in the middle of the frame instead.
         The controls column grows with the canvas so a 4K panel does not leave
         them marooned either. */
      grid-template-columns:
        minmax(0, min(52cqw, calc(var(--video-ratio, 1.7778) * 78dvh)))
        minmax(18rem, clamp(24rem, 24cqw, 36rem));
      grid-template-rows: minmax(0, 1fr) auto auto;
      justify-content: center;
    }

    .timeline-row {
      /* A 48px bar spanning 2700px reads as a hairline, not a scrub target. */
      --timeline-bar-height: clamp(48px, 3.5cqw, 88px);
    }

    .control-bar {
      grid-column: 2;
      grid-row: 1;
      align-self: center;
      /* Auto inline margins beat justify-self:stretch, so the column has to be
         claimed explicitly or the controls shrink-to-fit and float in it. */
      inline-size: 100%;
      margin-inline: 0;
    }

    /* In a column rather than a strip, the pictograph goes above the copy and
       gets to be the size of the decision it is asking for. */
    .tap-target {
      flex-direction: column;
      align-items: stretch;
      text-align: center;
    }

    .tap-face,
    .selected-face {
      inline-size: 100%;
      max-inline-size: clamp(11rem, 18cqw, 26rem);
      margin-inline: auto;
    }

    .tap-progress {
      justify-content: center;
    }

    /* Review shows the same big face in the same place as marking did, so
       checking a mark is the same gesture as placing one. */
    .selected-row {
      flex-direction: column;
      align-items: stretch;
      gap: 1rem;
      padding: clamp(0.75rem, 1.2cqw, 1.25rem);
      text-align: center;
    }

    .selected-copy {
      flex: 0 0 auto;
    }

    .selected-label {
      font-size: 1.25rem;
    }

    .selected-label,
    .nudge {
      justify-content: center;
    }

    .timeline-row {
      grid-column: 1 / -1;
      grid-row: 2;
    }

    .action-bar {
      grid-column: 1 / -1;
      grid-row: 3;
    }

    /* Short as well as wide - a folded phone held sideways. A portrait stage
       column leaves most of the canvas unused here, so the controls spend that
       width rather than wrapping the action buttons into a second row there is
       no height for. */
    @media (max-height: 34rem) {
      .editor {
        grid-template-columns:
          minmax(0, min(30cqw, calc(var(--video-ratio, 1.7778) * 78dvh)))
          minmax(18rem, 44rem);
      }

      /* Wide enough that both variants of the notice are one line, so the slot
         no longer has to reserve a second one to hold its neighbours still. */
      .tap-key {
        min-block-size: 1.2em;
      }
    }
  }

  /* 4K at 100%, or a TV across the room. Nothing is scaling for you at this
     size, so the ceilings step up rather than leaving the controls beside a
     1700px-tall video as fine print. 1920 (4K at 200%) stays on the tier
     above, where it already reads correctly. */
  @container (min-width: 150rem) {
    /* SegmentedControl sizes itself from these, so raising them on the wrapper
       scales the rate chips through the primitive's own seam. */
    .rate-control {
      --font-size-sm: 1.15rem;
      --font-size-compact: 1.05rem;
    }

    .tap-face,
    .selected-face {
      max-inline-size: clamp(26rem, 24cqw, 36rem);
    }

    .tap-copy strong {
      font-size: clamp(1.5rem, 1.6cqw, 2.5rem);
    }

    .tap-progress,
    .selected-label {
      font-size: 1.5rem;
    }

    .tap-key,
    .rate-hint,
    .selected-time {
      font-size: 1.1rem;
    }

    .aux-btn,
    .cancel-btn,
    .save-btn {
      min-block-size: 60px;
      padding-inline: 1.4rem;
      font-size: 1.15rem;
    }
  }

  /* Wide and short - a folded phone held sideways. Everything optional goes so
     the stage and the tap button both stay above the fold. */
  @media (max-height: 34rem) {
    .kbd-hint,
    .rate-hint {
      display: none;
    }

    /* The timeline reads out the clock a few pixels below, and three buttons
       plus a clock will not cross a portrait stage column. The skip buttons
       keep their icons and their aria-labels, and lose only the duration they
       repeat from them. */
    .stage-time,
    .skip-label {
      display: none;
    }

    .editor {
      gap: 0.5rem;
      padding: 0.5rem;
    }

    .control-bar {
      gap: 0.5rem;
    }

    /* Back to a strip. Stacked, the face and the copy together are taller than
       the row the two-column layout can give them here, and the column spills
       over the timeline underneath it. */
    .tap-target,
    .selected-row {
      flex-direction: row;
      align-items: center;
      gap: 0.75rem;
      padding: 0.6rem;
      text-align: start;
    }

    .tap-face,
    .selected-face {
      inline-size: clamp(3rem, 6cqw, 4.5rem);
      margin-inline: 0;
    }

    .tap-progress,
    .selected-label,
    .nudge {
      justify-content: flex-start;
    }

    /* A scrub bar still has to be grabbable here, but not at the expense of the
       stage - this is the tier with the least height to spend. */
    .timeline-row {
      --timeline-bar-height: 26px;
    }
  }
</style>
