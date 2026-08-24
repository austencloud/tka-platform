<script lang="ts">
  import SequencePickerModal from "$lib/shared/components/sequence-picker/SequencePickerModal.svelte";
  import TransportControls from "$lib/shared/animation-engine/components/controls/TransportControls.svelte";
  import TempoControl from "$lib/shared/animation-panel/components/TempoControl.svelte";
  import TimeRuler from "$lib/features/compose/timeline/components/TimeRuler.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  import { getStageChoreographyContext } from "../context/stage-choreography-context";
  import { getActiveStageSequenceClip } from "../domain/stage-sequence-timeline";
  import type { Performer, StageSequenceClip } from "../domain/stage-types";
  import type { StageEditMode } from "../state/stage-edit-mode.svelte";

  interface Props {
    editMode: StageEditMode;
  }

  type ClipDrag = {
    clipId: string;
    mode: "move" | "resize";
    pointerStartX: number;
    initialStartBeat: number;
    initialDurationBeats: number;
    draftStartBeat: number;
    draftDurationBeats: number;
  };

  let { editMode }: Props = $props();

  const stageState = getStageChoreographyContext();
  const choreography = $derived(stageState.choreography);
  const maxBeats = $derived(Math.max(16, Math.ceil(stageState.maxTotalBeats)));
  const activeClipIds = $derived.by(() => {
    const ids = new Set<string>();
    for (const performer of choreography.performers) {
      const clip = getActiveStageSequenceClip(
        performer,
        stageState.currentBeat
      );
      if (clip) ids.add(clip.id);
    }
    return ids;
  });
  const pixelsPerBeat = 64;
  let timelineViewportWidth = $state(0);
  let pickerOpen = $state(false);
  let pickerPerformerId = $state<string | null>(null);
  let drag = $state<ClipDrag | null>(null);
  let didDrag = false;
  const effectivePixelsPerBeat = $derived(
    Math.max(
      pixelsPerBeat,
      (timelineViewportWidth - 112) / Math.max(1, maxBeats)
    )
  );

  function openPicker(performerId: string): void {
    pickerPerformerId = performerId;
    pickerOpen = true;
  }

  function selectSequence(sequence: SequenceData): void {
    if (!pickerPerformerId) return;
    const clip = stageState.addSequenceClip(
      pickerPerformerId,
      sequence,
      stageState.currentBeat
    );
    if (clip) editMode.selectClip(pickerPerformerId, clip.id);
  }

  function seekFromPointer(event: PointerEvent): void {
    if ((event.target as Element).closest(".sequence-clip")) return;
    const lane = event.currentTarget as HTMLElement;
    const rect = lane.getBoundingClientRect();
    const beat = Math.max(
      0,
      Math.min(maxBeats, (event.clientX - rect.left) / effectivePixelsPerBeat)
    );
    const total = Math.max(1, stageState.maxTotalBeats);
    stageState.seek(Math.min(beat, total) / total);
  }

  function removeClip(performer: Performer, clip: StageSequenceClip): void {
    stageState.removeSequenceClip(clip.id);
    editMode.selectPerformer(performer.id);
  }

  function selectClip(
    event: MouseEvent,
    performer: Performer,
    clip: StageSequenceClip
  ): void {
    event.stopPropagation();
    if (didDrag) {
      didDrag = false;
      return;
    }
    editMode.selectClip(performer.id, clip.id);
  }

  function beginClipDrag(
    event: PointerEvent,
    clip: StageSequenceClip,
    mode: ClipDrag["mode"]
  ): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    didDrag = false;
    drag = {
      clipId: clip.id,
      mode,
      pointerStartX: event.clientX,
      initialStartBeat: clip.startBeat,
      initialDurationBeats: clip.durationBeats,
      draftStartBeat: clip.startBeat,
      draftDurationBeats: clip.durationBeats,
    };
  }

  function updateClipDrag(event: PointerEvent): void {
    if (!drag) return;
    const beatDelta =
      (event.clientX - drag.pointerStartX) / effectivePixelsPerBeat;
    if (Math.abs(event.clientX - drag.pointerStartX) > 3) didDrag = true;
    if (drag.mode === "move") {
      drag.draftStartBeat = Math.max(
        0,
        Math.round((drag.initialStartBeat + beatDelta) * 4) / 4
      );
    } else {
      drag.draftDurationBeats = Math.max(
        0.25,
        Math.round((drag.initialDurationBeats + beatDelta) * 4) / 4
      );
    }
  }

  function commitClipDrag(): void {
    if (!drag) return;
    if (didDrag) {
      if (drag.mode === "move") {
        stageState.moveSequenceClip(drag.clipId, drag.draftStartBeat);
      } else {
        stageState.resizeSequenceClip(drag.clipId, drag.draftDurationBeats);
      }
    }
    drag = null;
  }

  function clipStart(clip: StageSequenceClip): number {
    return drag?.clipId === clip.id ? drag.draftStartBeat : clip.startBeat;
  }

  function clipDuration(clip: StageSequenceClip): number {
    return drag?.clipId === clip.id
      ? drag.draftDurationBeats
      : clip.durationBeats;
  }

  function handleClipKeydown(
    event: KeyboardEvent,
    performer: Performer,
    clip: StageSequenceClip
  ): void {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      editMode.selectClip(performer.id, clip.id);
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const direction = event.key === "ArrowLeft" ? -1 : 1;
      stageState.moveSequenceClip(
        clip.id,
        clip.startBeat + direction * (event.shiftKey ? 4 : 0.25)
      );
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      removeClip(performer, clip);
    }
  }
</script>

<svelte:window
  onpointermove={updateClipDrag}
  onpointerup={commitClipDrag}
  onpointercancel={commitClipDrag}
/>

<section class="stage-timeline" aria-label="Performance timeline">
  <header class="timeline-toolbar">
    <div class="timeline-title">
      <strong
        >Beat {stageState.currentBeat.toFixed(1)} / {Math.round(
          stageState.maxTotalBeats
        )}</strong
      >
    </div>

    <TransportControls
      isPlaying={stageState.isPlaying}
      onPlaybackToggle={() => stageState.togglePlay()}
      onRestartToStart={() => stageState.seek(0)}
    />

    <div class="timeline-tools">
      <TempoControl
        bpm={choreography.bpm}
        onBpmChange={(nextBpm) => stageState.setBpm(nextBpm)}
        showPresets={false}
        showPractice={false}
        presetsMode="popover"
      />
    </div>
  </header>

  <div class="timeline-scroll" bind:clientWidth={timelineViewportWidth}>
    <div
      class="timeline-grid"
      style:--timeline-width="{Math.max(
        720,
        maxBeats * effectivePixelsPerBeat
      )}px"
    >
      <div class="ruler-label" aria-hidden="true">PERFORMER</div>
      <div
        class="ruler"
        style:width="var(--timeline-width)"
        onpointerdown={seekFromPointer}
        role="group"
        aria-label="Beat ruler. Click to move the playhead."
      >
        <TimeRuler
          duration={maxBeats}
          pixelsPerSecond={effectivePixelsPerBeat}
          tickInterval={1}
          formatLabel={(beat) => `${Math.round(beat)}`}
        />
        <div
          class="ruler-playhead"
          style:left="{stageState.currentBeat * effectivePixelsPerBeat}px"
        ></div>
      </div>

      {#each choreography.performers as performer (performer.id)}
        <div
          class="lane-label"
          class:selected={editMode.selectedPerformerId === performer.id}
          style:--performer-color={performer.color}
        >
          <button
            type="button"
            class="performer-select"
            onclick={(event) =>
              editMode.selectPerformer(performer.id, event.shiftKey)}
            aria-pressed={editMode.multiSelectedPerformerIds.has(performer.id)}
          >
            <span>{performer.label}</span>
          </button>
          <button
            type="button"
            class="add-sequence"
            onclick={() => openPicker(performer.id)}
            aria-label="Add sequence for performer {performer.label}"
            title="Add sequence"
          >
            <i class="fas fa-plus" aria-hidden="true"></i>
          </button>
        </div>

        <div
          class="sequence-lane"
          class:selected={editMode.selectedPerformerId === performer.id}
          style="width: var(--timeline-width); --performer-color: {performer.color}; --pixels-per-beat: {effectivePixelsPerBeat}px"
          onpointerdown={seekFromPointer}
          role="group"
          aria-label="Performer {performer.label} sequence lane"
        >
          <div
            class="lane-playhead"
            style:left="{stageState.currentBeat * effectivePixelsPerBeat}px"
          ></div>
          {#if performer.sequenceClips.length === 0}
            <button
              type="button"
              class="lane-add-hint"
              onpointerdown={(event) => event.stopPropagation()}
              onclick={() => openPicker(performer.id)}
            >
              <i class="fas fa-plus" aria-hidden="true"></i>
              Add sequence
            </button>
          {/if}
          {#each performer.sequenceClips as clip (clip.id)}
            <div
              class="sequence-clip"
              class:selected={editMode.selectedClipId === clip.id}
              class:active={activeClipIds.has(clip.id)}
              class:dragging={drag?.clipId === clip.id}
              style="left: {clipStart(clip) *
                effectivePixelsPerBeat}px; width: {Math.max(
                28,
                clipDuration(clip) * effectivePixelsPerBeat
              )}px"
              role="option"
              aria-selected={editMode.selectedClipId === clip.id}
              tabindex="0"
              onkeydown={(event) => handleClipKeydown(event, performer, clip)}
            >
              <button
                type="button"
                class="clip-body"
                onpointerdown={(event) => beginClipDrag(event, clip, "move")}
                onclick={(event) => selectClip(event, performer, clip)}
                aria-label="{clip.label}, starts at beat {clip.startBeat}, lasts {clip.durationBeats} beats"
              >
                <span class="clip-name">{clip.label}</span>
                {#if clip.loop && editMode.selectedClipId !== clip.id}
                  <i class="fas fa-repeat" aria-label="Loops"></i>
                {/if}
              </button>
              {#if editMode.selectedClipId === clip.id}
                <button
                  type="button"
                  class="clip-action"
                  class:active={clip.loop}
                  aria-pressed={clip.loop}
                  aria-label="Loop {clip.label}"
                  title="Loop"
                  onpointerdown={(event) => event.stopPropagation()}
                  onclick={(event) => {
                    event.stopPropagation();
                    stageState.toggleSequenceClipLoop(clip.id);
                  }}
                >
                  <i class="fas fa-repeat" aria-hidden="true"></i>
                </button>
                <button
                  type="button"
                  class="clip-action delete-clip"
                  aria-label="Remove {clip.label}"
                  title="Remove"
                  onpointerdown={(event) => event.stopPropagation()}
                  onclick={(event) => {
                    event.stopPropagation();
                    removeClip(performer, clip);
                  }}
                >
                  <i class="fas fa-trash" aria-hidden="true"></i>
                </button>
              {/if}
              <button
                type="button"
                class="resize-handle"
                onpointerdown={(event) => beginClipDrag(event, clip, "resize")}
                aria-label="Resize {clip.label}"
                title="Drag to change duration"
              ></button>
            </div>
          {/each}
        </div>
      {/each}
    </div>
  </div>
</section>

<SequencePickerModal
  open={pickerOpen}
  title={pickerPerformerId
    ? `Add a sequence to performer ${choreography.performers.find((performer) => performer.id === pickerPerformerId)?.label ?? ""}`
    : "Add sequence"}
  onSelect={selectSequence}
  onClose={() => (pickerOpen = false)}
/>

<style>
  .stage-timeline {
    display: flex;
    height: 100%;
    min-width: 0;
    min-height: 0;
    flex-direction: column;
    overflow: hidden;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: color-mix(in srgb, var(--theme-panel-bg, #10111a) 94%, black);
    color: var(--theme-text, white);
  }

  .timeline-toolbar {
    display: grid;
    min-height: 3.75rem;
    flex: 0 0 auto;
    grid-template-columns: minmax(10rem, 1fr) auto minmax(10rem, 1fr);
    align-items: center;
    gap: 0.75rem;
    padding: 0.4rem 0.65rem;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.035));
  }

  .timeline-title,
  .timeline-tools {
    display: flex;
    align-items: center;
  }

  .timeline-title {
    min-width: 0;
    gap: 0.5rem;
    font-size: var(--font-size-min, 0.875rem);
  }

  .timeline-title strong {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.62));
    font-size: var(--font-size-compact, 0.75rem);
    font-variant-numeric: tabular-nums;
  }

  .timeline-tools {
    position: relative;
    min-width: 0;
    justify-content: flex-end;
  }

  /* TempoControl's inline popover would grow the toolbar row; float it below
     the control instead so opening it never reflows the timeline. */
  .timeline-tools :global(.tempo-wrapper) {
    position: relative;
    width: auto;
  }

  .timeline-tools :global(.tempo-control) {
    width: auto;
  }

  .timeline-tools :global(.bpm-popover) {
    position: absolute;
    top: calc(100% + 0.5rem);
    right: 0;
    z-index: 30;
    min-width: 15rem;
    background: color-mix(in srgb, var(--theme-panel-bg, #12121c) 96%, white);
  }

  .timeline-scroll {
    min-width: 0;
    min-height: 0;
    flex: 1;
    overflow: auto;
    scrollbar-color: var(--theme-stroke-strong, #4b5563) transparent;
  }

  .timeline-grid {
    display: grid;
    width: max-content;
    min-width: 100%;
    min-height: 100%;
    grid-template-columns: 7rem var(--timeline-width);
    grid-auto-rows: minmax(3.5rem, 1fr);
    grid-template-rows: 2.25rem;
  }

  .ruler-label,
  .lane-label {
    position: sticky;
    left: 0;
    z-index: 6;
    border-right: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    background: #11131c;
  }

  .ruler-label,
  .ruler {
    position: sticky;
    top: 0;
    z-index: 7;
  }

  .ruler-label {
    display: flex;
    align-items: center;
    padding: 0 0.75rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.42));
    font-size: 0.65rem;
    font-weight: 750;
    letter-spacing: 0.1em;
  }

  .ruler {
    height: 2.25rem;
    overflow: hidden;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: #11131c;
    cursor: pointer;
  }

  .ruler-playhead,
  .lane-playhead {
    position: absolute;
    top: 0;
    bottom: 0;
    z-index: 5;
    width: 2px;
    background: var(--semantic-warning, #f59e0b);
    box-shadow: 0 0 0.6rem color-mix(in srgb, #f59e0b 65%, transparent);
    pointer-events: none;
  }

  .lane-label {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem 0.45rem;
  }

  .lane-label.selected {
    background: color-mix(in srgb, var(--performer-color) 12%, #11131c);
  }

  .performer-select {
    display: flex;
    min-width: 0;
    min-height: 2.75rem;
    flex: 1;
    align-items: center;
    gap: 0.55rem;
    border: 0;
    border-radius: 0.6rem;
    background: transparent;
    color: var(--theme-text, white);
    cursor: pointer;
    text-align: left;
  }

  .performer-select > span {
    display: grid;
    width: 2rem;
    height: 2rem;
    place-items: center;
    flex: 0 0 auto;
    border: 1px solid var(--performer-color);
    border-radius: 999px;
    color: var(--performer-color);
    font-weight: 800;
  }

  .add-sequence {
    display: grid;
    width: 2.75rem;
    height: 2.75rem;
    place-items: center;
    flex: 0 0 auto;
    border: 1px solid
      color-mix(in srgb, var(--performer-color) 42%, transparent);
    border-radius: 0.65rem;
    background: color-mix(in srgb, var(--performer-color) 10%, transparent);
    color: var(--performer-color);
    cursor: pointer;
  }

  .sequence-lane {
    position: relative;
    overflow: hidden;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    background:
      repeating-linear-gradient(
        90deg,
        transparent 0,
        transparent calc(var(--pixels-per-beat) - 1px),
        rgba(255, 255, 255, 0.06) calc(var(--pixels-per-beat) - 1px),
        rgba(255, 255, 255, 0.06) var(--pixels-per-beat)
      ),
      color-mix(in srgb, var(--theme-panel-bg, #0c0d14) 94%, black);
  }

  .sequence-lane.selected {
    background-color: color-mix(
      in srgb,
      var(--performer-color) 6%,
      var(--theme-panel-bg, #0c0d14)
    );
  }

  .sequence-clip {
    position: absolute;
    top: 0.4rem;
    bottom: 0.4rem;
    z-index: 2;
    display: flex;
    min-width: 1.75rem;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--performer-color) 68%, white);
    border-radius: 0.55rem;
    background: color-mix(in srgb, var(--performer-color) 54%, #151722);
    box-shadow: 0 0.2rem 0.6rem rgba(0, 0, 0, 0.32);
  }

  .sequence-clip.selected {
    outline: 2px solid white;
    outline-offset: 1px;
  }

  .sequence-clip.active {
    box-shadow:
      0 0.2rem 0.7rem rgba(0, 0, 0, 0.4),
      0 0 1rem color-mix(in srgb, var(--performer-color) 50%, transparent);
  }

  .sequence-clip.dragging {
    z-index: 8;
    opacity: 0.9;
  }

  .clip-body {
    display: flex;
    min-width: 0;
    min-height: 2.75rem;
    flex: 1;
    align-items: center;
    gap: 0.45rem;
    padding: 0 0.75rem;
    border: 0;
    background: transparent;
    color: white;
    cursor: grab;
    text-align: left;
  }

  .clip-name {
    min-width: 0;
    overflow: hidden;
    flex: 1;
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 750;
    text-overflow: ellipsis;
    text-shadow: 0 1px 2px black;
    white-space: nowrap;
  }

  .clip-action {
    display: grid;
    width: 2.25rem;
    min-height: 2.75rem;
    flex: 0 0 auto;
    place-items: center;
    border: 0;
    border-left: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(0, 0, 0, 0.28);
    color: rgba(255, 255, 255, 0.82);
    cursor: pointer;
  }

  .clip-action:hover {
    background: rgba(0, 0, 0, 0.45);
    color: white;
  }

  .clip-action.active {
    color: white;
    background: color-mix(in srgb, var(--performer-color) 55%, black);
  }

  .clip-action.delete-clip {
    color: var(--semantic-error, #f87171);
  }

  .resize-handle {
    display: grid;
    width: 1rem;
    min-height: 2.75rem;
    flex: 0 0 auto;
    place-items: center;
    border: 0;
    border-left: 1px solid rgba(255, 255, 255, 0.22);
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.28));
    cursor: ew-resize;
  }

  .resize-handle::after {
    width: 4px;
    height: 1.1rem;
    border-inline: 1.5px solid rgba(255, 255, 255, 0.8);
    content: "";
  }

  .lane-add-hint {
    position: absolute;
    top: 50%;
    left: 0.6rem;
    z-index: 3;
    display: flex;
    min-height: 2.5rem;
    align-items: center;
    gap: 0.45rem;
    padding: 0 0.85rem;
    border: 1px dashed
      color-mix(in srgb, var(--performer-color) 55%, transparent);
    border-radius: 0.55rem;
    background: color-mix(in srgb, var(--performer-color) 8%, transparent);
    color: var(--performer-color);
    cursor: pointer;
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 700;
    translate: 0 -50%;
    white-space: nowrap;
  }

  .lane-add-hint:hover {
    background: color-mix(in srgb, var(--performer-color) 16%, transparent);
  }

  button:focus-visible,
  .sequence-clip:focus-visible {
    outline: 3px solid var(--theme-accent, #f59e0b);
    outline-offset: 2px;
  }

  @media (max-width: 920px) {
    .timeline-grid {
      grid-template-columns: 6rem var(--timeline-width);
    }
  }

  @media (max-width: 560px) {
    .timeline-title {
      display: none;
    }

    .timeline-toolbar {
      grid-template-columns: auto minmax(0, 1fr);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sequence-clip {
      scroll-behavior: auto;
    }
  }
</style>
