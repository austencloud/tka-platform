<script lang="ts">
  import SequencePickerModal from "$lib/shared/components/sequence-picker/SequencePickerModal.svelte";
  import TransportControls from "$lib/shared/animation-engine/components/controls/TransportControls.svelte";
  import BpmChips from "$lib/shared/animation-engine/components/controls/BpmChips.svelte";
  import TimeRuler from "$lib/features/compose/timeline/components/TimeRuler.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  import { getStageChoreographyContext } from "../context/stage-choreography-context";
  import {
    getActiveStageSequenceClip,
    getStageSequenceClipEnd,
  } from "../domain/stage-sequence-timeline";
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
  const selectedClip = $derived.by(() => {
    if (!editMode.selectedClipId) return null;
    for (const performer of choreography.performers) {
      const clip = performer.sequenceClips.find(
        (candidate) => candidate.id === editMode.selectedClipId
      );
      if (clip) return { performer, clip };
    }
    return null;
  });

  let bpm = $state(choreography.bpm);
  let pixelsPerBeat = $state(64);
  let timelineViewportWidth = $state(0);
  let pickerOpen = $state(false);
  let pickerPerformerId = $state<string | null>(null);
  let drag = $state<ClipDrag | null>(null);
  let didDrag = false;
  const effectivePixelsPerBeat = $derived(
    Math.max(
      pixelsPerBeat,
      (timelineViewportWidth - 168) / Math.max(1, maxBeats)
    )
  );

  $effect(() => {
    bpm = choreography.bpm;
  });

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
    stageState.seek(beat / maxBeats);
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
    }
  }

  function zoom(delta: number): void {
    pixelsPerBeat = Math.max(36, Math.min(128, pixelsPerBeat + delta));
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
      <i class="fas fa-wave-square" aria-hidden="true"></i>
      <span>Performance</span>
      <strong>Beat {stageState.currentBeat.toFixed(1)}</strong>
    </div>

    <TransportControls
      isPlaying={stageState.isPlaying}
      onPlaybackToggle={() => stageState.togglePlay()}
      onRestartToStart={() => stageState.seek(0)}
    />

    <div class="timeline-tools">
      <BpmChips
        bind:bpm
        variant="compact"
        onBpmChange={(nextBpm) => stageState.setBpm(nextBpm)}
      />
      <div class="zoom-controls" role="group" aria-label="Timeline zoom">
        <button type="button" onclick={() => zoom(-12)} aria-label="Zoom out">
          <i class="fas fa-minus" aria-hidden="true"></i>
        </button>
        <button type="button" onclick={() => zoom(12)} aria-label="Zoom in">
          <i class="fas fa-plus" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  </header>

  {#if selectedClip}
    <div
      class="clip-inspector"
      style:--performer-color={selectedClip.performer.color}
    >
      <span class="selected-performer">{selectedClip.performer.label}</span>
      <strong>{selectedClip.clip.label}</strong>
      <span
        >{selectedClip.clip.startBeat.toFixed(1)}–{getStageSequenceClipEnd(
          selectedClip.clip
        ).toFixed(1)} beats</span
      >
      <button
        type="button"
        class:active={selectedClip.clip.loop}
        aria-pressed={selectedClip.clip.loop}
        onclick={() => stageState.toggleSequenceClipLoop(selectedClip.clip.id)}
      >
        <i class="fas fa-repeat" aria-hidden="true"></i>
        Loop
      </button>
      <button
        type="button"
        class="delete-clip"
        onclick={() => {
          stageState.removeSequenceClip(selectedClip.clip.id);
          editMode.selectPerformer(selectedClip.performer.id);
        }}
      >
        <i class="fas fa-trash" aria-hidden="true"></i>
        Remove
      </button>
    </div>
  {/if}

  <div class="timeline-scroll" bind:clientWidth={timelineViewportWidth}>
    <div
      class="timeline-grid"
      style:--timeline-width="{Math.max(
        720,
        maxBeats * effectivePixelsPerBeat
      )}px"
    >
      <div class="ruler-label" aria-hidden="true">PERFORMER</div>
      <div class="ruler" style:width="var(--timeline-width)">
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
            <small>{performer.sequenceClips.length} clips</small>
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
                <span class="clip-meta">{clip.durationBeats}b</span>
                {#if clip.loop}
                  <i class="fas fa-repeat" aria-label="Loops"></i>
                {/if}
              </button>
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
  .timeline-tools,
  .zoom-controls,
  .clip-inspector {
    display: flex;
    align-items: center;
  }

  .timeline-title {
    min-width: 0;
    gap: 0.5rem;
    font-size: var(--font-size-min, 0.875rem);
  }

  .timeline-title i {
    color: var(--theme-accent, #f59e0b);
  }

  .timeline-title strong {
    padding-left: 0.35rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.62));
    font-size: var(--font-size-compact, 0.75rem);
    font-variant-numeric: tabular-nums;
  }

  .timeline-tools {
    min-width: 0;
    justify-content: flex-end;
    gap: 0.45rem;
  }

  .zoom-controls {
    gap: 0.25rem;
  }

  .zoom-controls button,
  .clip-inspector button {
    min-width: 2.75rem;
    min-height: 2.75rem;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    border-radius: 0.65rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.045));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.68));
    cursor: pointer;
  }

  .clip-inspector {
    min-height: 3rem;
    flex: 0 0 auto;
    gap: 0.55rem;
    padding: 0.25rem 0.65rem;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.64));
    font-size: var(--font-size-compact, 0.75rem);
  }

  .clip-inspector strong {
    color: var(--theme-text, white);
  }

  .clip-inspector button {
    display: flex;
    min-height: 2.5rem;
    align-items: center;
    gap: 0.4rem;
    padding: 0 0.7rem;
  }

  .clip-inspector button:first-of-type {
    margin-left: auto;
  }

  .clip-inspector button.active {
    border-color: var(--performer-color);
    color: white;
  }

  .clip-inspector .delete-clip {
    color: var(--semantic-error, #f87171);
  }

  .selected-performer {
    display: grid;
    width: 1.75rem;
    height: 1.75rem;
    place-items: center;
    border: 1px solid var(--performer-color);
    border-radius: 999px;
    color: var(--performer-color);
    font-weight: 800;
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
    grid-template-columns: 10.5rem var(--timeline-width);
    grid-auto-rows: 3.5rem;
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
    height: 3.5rem;
    overflow: hidden;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: #11131c;
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

  .performer-select small {
    overflow: hidden;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
    text-overflow: ellipsis;
    white-space: nowrap;
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

  .clip-meta {
    color: rgba(255, 255, 255, 0.72);
    font-size: 0.65rem;
    font-variant-numeric: tabular-nums;
  }

  .resize-handle {
    width: 1rem;
    min-height: 2.75rem;
    flex: 0 0 auto;
    border: 0;
    border-left: 1px solid rgba(255, 255, 255, 0.22);
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.28));
    cursor: ew-resize;
  }

  button:focus-visible,
  .sequence-clip:focus-visible {
    outline: 3px solid var(--theme-accent, #f59e0b);
    outline-offset: 2px;
  }

  @media (max-width: 920px) {
    .timeline-toolbar {
      grid-template-columns: 1fr auto;
      grid-template-rows: auto auto;
    }

    .timeline-title strong,
    .timeline-tools :global(.bpm-chips) {
      display: none;
    }

    .timeline-toolbar > :global(.transport-controls) {
      grid-column: 1 / -1;
      grid-row: 2;
    }

    .timeline-tools {
      grid-column: 2;
      grid-row: 1;
    }

    .timeline-grid {
      grid-template-columns: 8rem var(--timeline-width);
    }

    .clip-inspector > span:not(.selected-performer) {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sequence-clip {
      scroll-behavior: auto;
    }
  }
</style>
