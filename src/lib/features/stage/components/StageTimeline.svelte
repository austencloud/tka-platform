<script lang="ts">
  import SequencePickerModal from "$lib/shared/components/sequence-picker/SequencePickerModal.svelte";
  import TransportControls from "$lib/shared/animation-engine/components/controls/TransportControls.svelte";
  import TempoControl from "$lib/shared/animation-panel/components/TempoControl.svelte";
  import TimeRuler from "$lib/features/compose/timeline/components/TimeRuler.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  import { getStageChoreographyContext } from "../context/stage-choreography-context";
  import { getActiveStageSequenceClip } from "../domain/stage-sequence-timeline";
  import type {
    Formation,
    Performer,
    StageSequenceClip,
  } from "../domain/stage-types";
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

  type FormationDrag = {
    formationId: string;
    mode: "move" | "transition";
    pointerStartX: number;
    initialAtBeat: number;
    initialTransitionBeats: number;
    draftAtBeat: number;
    draftTransitionBeats: number;
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
  let formationDrag = $state<FormationDrag | null>(null);
  let didFormationDrag = false;
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
    if (
      (event.target as Element).closest(".sequence-clip, .formation-block")
    )
      return;
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

  function formationBeat(formation: Formation): number {
    return formationDrag?.formationId === formation.id &&
      formationDrag.mode === "move"
      ? formationDrag.draftAtBeat
      : formation.atBeat;
  }

  function formationTransition(formation: Formation): number {
    return formationDrag?.formationId === formation.id &&
      formationDrag.mode === "transition"
      ? formationDrag.draftTransitionBeats
      : formation.transitionBeats;
  }

  /**
   * A set is held from the beat it lands on until the walk into the NEXT set
   * begins. The hold can legitimately be zero — the default document walks for
   * all eight counts — so this drives a rail drawn behind the set's chip, never
   * the chip's own width. Sizing the chip by the hold collapsed it to an
   * unreadable stub whenever the cast never stops.
   */
  function formationHoldBeats(index: number): number {
    const formation = choreography.formations[index];
    if (!formation) return 0;
    const next = choreography.formations[index + 1];
    const end = next
      ? formationBeat(next) - formationTransition(next)
      : maxBeats;
    return Math.max(0, end - formationBeat(formation));
  }

  function formationName(formation: Formation, index: number): string {
    return formation.label?.trim() || `Set ${index + 1}`;
  }

  function addFormationAtPlayhead(): void {
    const formation = stageState.addFormation(
      Math.round(stageState.currentBeat)
    );
    if (formation) editMode.selectFormation(formation.id);
  }

  function removeFormation(formationId: string): void {
    stageState.removeFormation(formationId);
    editMode.selectFormation(null);
  }

  function beginFormationDrag(
    event: PointerEvent,
    formation: Formation,
    mode: FormationDrag["mode"]
  ): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    didFormationDrag = false;
    stageState.beginDrag();
    formationDrag = {
      formationId: formation.id,
      mode,
      pointerStartX: event.clientX,
      initialAtBeat: formation.atBeat,
      initialTransitionBeats: formation.transitionBeats,
      draftAtBeat: formation.atBeat,
      draftTransitionBeats: formation.transitionBeats,
    };
  }

  function updateFormationDrag(event: PointerEvent): void {
    if (!formationDrag) return;
    const beatDelta =
      (event.clientX - formationDrag.pointerStartX) / effectivePixelsPerBeat;
    if (Math.abs(event.clientX - formationDrag.pointerStartX) > 3) {
      didFormationDrag = true;
    }
    if (formationDrag.mode === "move") {
      formationDrag.draftAtBeat = Math.max(
        1,
        Math.round(formationDrag.initialAtBeat + beatDelta)
      );
    } else {
      // The handle sits on the set's leading edge, so dragging it left pulls
      // the start of the walk earlier and lengthens the transition.
      formationDrag.draftTransitionBeats = Math.max(
        0,
        Math.round(formationDrag.initialTransitionBeats - beatDelta)
      );
    }
  }

  function commitFormationDrag(): void {
    if (!formationDrag) return;
    if (didFormationDrag) {
      if (formationDrag.mode === "move") {
        stageState.moveFormation(
          formationDrag.formationId,
          formationDrag.draftAtBeat
        );
      } else {
        stageState.setFormationTransitionBeats(
          formationDrag.formationId,
          formationDrag.draftTransitionBeats
        );
      }
    }
    formationDrag = null;
  }

  function handleFormationKeydown(
    event: KeyboardEvent,
    formation: Formation,
    index: number
  ): void {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      editMode.selectFormation(formation.id);
      return;
    }
    if (index > 0 && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      const direction = event.key === "ArrowLeft" ? -1 : 1;
      stageState.moveFormation(
        formation.id,
        formation.atBeat + direction * (event.shiftKey ? 4 : 1)
      );
      return;
    }
    if (index > 0 && (event.key === "Delete" || event.key === "Backspace")) {
      event.preventDefault();
      removeFormation(formation.id);
    }
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
  onpointermove={(event) => {
    updateClipDrag(event);
    updateFormationDrag(event);
  }}
  onpointerup={() => {
    commitClipDrag();
    commitFormationDrag();
  }}
  onpointercancel={() => {
    commitClipDrag();
    commitFormationDrag();
  }}
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

      <div class="formation-label">
        <span class="formation-label-text">SETS</span>
        <button
          type="button"
          class="add-formation"
          onclick={addFormationAtPlayhead}
          aria-label="Add a set at the playhead"
          title="Add a set at the playhead"
        >
          <i class="fas fa-plus" aria-hidden="true"></i>
        </button>
      </div>

      <div
        class="formation-track"
        style="width: var(--timeline-width); --pixels-per-beat: {effectivePixelsPerBeat}px"
        onpointerdown={seekFromPointer}
        role="listbox"
        aria-label="Formation sets. Each block is a held set; the ramp before it is the walk into that set."
        tabindex="-1"
      >
        <div
          class="lane-playhead"
          style:left="{stageState.currentBeat * effectivePixelsPerBeat}px"
        ></div>
        {#each choreography.formations as formation, index (formation.id)}
          {@const beat = formationBeat(formation)}
          {@const transition = formationTransition(formation)}
          {@const hold = formationHoldBeats(index)}
          {@const selected = editMode.selectedFormationId === formation.id}
          {#if hold > 0}
            <div
              class="formation-hold"
              class:selected
              style="left: {beat * effectivePixelsPerBeat}px; width: {hold *
                effectivePixelsPerBeat}px"
              aria-hidden="true"
            ></div>
          {/if}
          {#if transition > 0}
            <div
              class="formation-ramp"
              class:selected
              style="left: {(beat - transition) *
                effectivePixelsPerBeat}px; width: {transition *
                effectivePixelsPerBeat}px"
              aria-hidden="true"
            ></div>
          {/if}
          <div
            class="formation-block"
            class:selected
            class:dragging={formationDrag?.formationId === formation.id}
            style="left: {beat * effectivePixelsPerBeat}px"
            role="option"
            aria-selected={selected}
            tabindex="0"
            onkeydown={(event) =>
              handleFormationKeydown(event, formation, index)}
          >
            {#if index > 0}
              <button
                type="button"
                class="transition-handle"
                onpointerdown={(event) =>
                  beginFormationDrag(event, formation, "transition")}
                aria-label="Change the walk into {formationName(
                  formation,
                  index
                )}, currently {formation.transitionBeats} counts"
                title="Drag to change how many counts the walk takes"
              ></button>
            {/if}
            <button
              type="button"
              class="formation-body"
              onpointerdown={(event) => {
                if (index === 0) return;
                beginFormationDrag(event, formation, "move");
              }}
              onclick={() => {
                if (didFormationDrag) {
                  didFormationDrag = false;
                  return;
                }
                editMode.selectFormation(formation.id);
              }}
              aria-label="{formationName(formation, index)}, in place on count {formation.atBeat}{index >
              0
                ? `, ${formation.transitionBeats} counts to get there`
                : ''}"
            >
              <span class="formation-name">
                {formationName(formation, index)}
              </span>
              <span class="formation-count">{beat}</span>
            </button>
            {#if selected && index > 0}
              <button
                type="button"
                class="formation-action"
                aria-label="Remove {formationName(formation, index)}"
                title="Remove"
                onpointerdown={(event) => event.stopPropagation()}
                onclick={(event) => {
                  event.stopPropagation();
                  removeFormation(formation.id);
                }}
              >
                <i class="fas fa-trash" aria-hidden="true"></i>
              </button>
            {/if}
          </div>
        {/each}
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
    /* 3.5rem keeps the set chip's 2.75rem touch target intact inside its
       0.35rem inset, and matches the performer lane height. */
    grid-template-rows: 2.25rem 3.5rem;
  }

  .ruler-label,
  .formation-label,
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

  .formation-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.35rem;
    padding: 0.3rem 0.45rem;
    /* Deliberately NOT --theme-accent: the themed accent collides with the
       performer clip colours and makes the spine read as a fifth lane. */
    --formation-accent: #7cd4e8;
  }
  .formation-label-text {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.42));
    font-size: 0.65rem;
    font-weight: 750;
    letter-spacing: 0.1em;
  }
  .add-formation {
    display: grid;
    width: 2.75rem;
    height: 2.75rem;
    flex: 0 0 auto;
    place-items: center;
    border: 1px solid
      color-mix(in srgb, var(--formation-accent) 42%, transparent);
    border-radius: 0.65rem;
    background: color-mix(in srgb, var(--formation-accent) 10%, transparent);
    color: var(--formation-accent);
    cursor: pointer;
  }
  .formation-track {
    position: relative;
    overflow: hidden;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background:
      repeating-linear-gradient(
        90deg,
        transparent 0,
        transparent calc(var(--pixels-per-beat) - 1px),
        rgba(255, 255, 255, 0.06) calc(var(--pixels-per-beat) - 1px),
        rgba(255, 255, 255, 0.06) var(--pixels-per-beat)
      ),
      color-mix(in srgb, var(--theme-panel-bg, #0c0d14) 88%, black);
    /* Deliberately NOT --theme-accent: the themed accent collides with the
       performer clip colours and makes the spine read as a fifth lane. */
    --formation-accent: #7cd4e8;
  }
  /* The cast is standing still: a flat hairline rail, no travel implied. */
  .formation-hold {
    position: absolute;
    top: 50%;
    z-index: 1;
    height: 0.125rem;
    border-radius: 0.0625rem;
    background: color-mix(in srgb, var(--formation-accent) 30%, transparent);
    transform: translateY(-50%);
    pointer-events: none;
  }
  .formation-hold.selected {
    background: color-mix(in srgb, var(--formation-accent) 60%, transparent);
  }
  /* The walk into a set: a bar that thickens toward its arrowhead, so travel
     and its direction read at a glance instead of looking like a divider. */
  .formation-ramp {
    position: absolute;
    top: 50%;
    z-index: 1;
    height: 0.45rem;
    border-radius: 0.225rem 0 0 0.225rem;
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--formation-accent) 10%, transparent),
      color-mix(in srgb, var(--formation-accent) 65%, transparent)
    );
    transform: translateY(-50%);
    pointer-events: none;
  }
  .formation-ramp::after {
    position: absolute;
    top: 50%;
    right: -0.05rem;
    width: 0;
    height: 0;
    border-top: 0.45rem solid transparent;
    border-bottom: 0.45rem solid transparent;
    border-left: 0.5rem solid
      color-mix(in srgb, var(--formation-accent) 65%, transparent);
    content: "";
    transform: translateY(-50%);
  }
  .formation-ramp.selected {
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--formation-accent) 22%, transparent),
      var(--formation-accent)
    );
  }
  .formation-ramp.selected::after {
    border-left-color: var(--formation-accent);
  }
  /* A set is a marker anchored on its count, sized by its own label — never by
     the hold, which is often zero. The leading rule is the count it lands on. */
  .formation-block {
    position: absolute;
    top: 0.35rem;
    bottom: 0.35rem;
    z-index: 2;
    display: flex;
    min-width: 2.75rem;
    max-width: 14rem;
    border: 1px solid
      color-mix(in srgb, var(--formation-accent) 40%, transparent);
    border-left: 2px solid var(--formation-accent);
    border-radius: 0 0.45rem 0.45rem 0;
    background: color-mix(in srgb, var(--formation-accent) 14%, #0e1018);
    box-shadow: 0 0.2rem 0.6rem rgba(0, 0, 0, 0.4);
  }
  .formation-block.selected {
    outline: 2px solid white;
    outline-offset: 1px;
  }
  .formation-block.dragging {
    opacity: 0.85;
  }
  /* The walk length is dragged from the set's leading edge. The hit zone keeps
     the 44px floor the clip resize handles use, but straddles that edge instead
     of sitting in flow: a 44px slab in flow outweighs the label on a set this
     narrow. What you see is the grip below. */
  .transition-handle {
    position: absolute;
    top: 0;
    bottom: 0;
    left: -1.375rem;
    width: 2.75rem;
    min-width: 0;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: ew-resize;
  }
  .transition-handle::before {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 1.375rem;
    width: 0.375rem;
    background: linear-gradient(
      90deg,
      var(--formation-accent),
      color-mix(in srgb, var(--formation-accent) 15%, transparent)
    );
    content: "";
    transition: width 120ms ease;
  }
  .transition-handle:hover::before,
  .transition-handle:focus-visible::before {
    width: 0.7rem;
  }
  .formation-body {
    display: flex;
    min-width: 0;
    min-height: 2.75rem;
    flex: 1;
    align-items: center;
    justify-content: space-between;
    gap: 0.35rem;
    padding: 0 0.5rem 0 0.7rem;
    border: 0;
    background: transparent;
    color: var(--theme-text, white);
    cursor: grab;
    text-align: left;
  }
  .formation-name {
    overflow: hidden;
    /* Matches .clip-name: sets and clips are the same class of timeline label. */
    font-size: 0.75rem;
    font-weight: 750;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* A tinted chip, so "Set 1" and its count read as two things rather than as
     the string "Set 1 0". */
  .formation-count {
    flex: 0 0 auto;
    padding: 0.1rem 0.3rem;
    border-radius: 0.3rem;
    background: color-mix(in srgb, var(--formation-accent) 22%, transparent);
    color: color-mix(in srgb, var(--formation-accent) 75%, white);
    font-size: 0.75rem;
    font-weight: 750;
    /* The count changes as a set is dragged, so fix the digit width. */
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }
  .formation-action {
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
