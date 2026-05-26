<script lang="ts">
  import { getStageChoreographyState } from '../state/stage-choreography-state.svelte';
  import type { StageEditMode } from '../state/stage-edit-mode.svelte';
  import type { Timeline as TimelineType, TimelineModel, TimelineOptions } from 'animation-timeline-js';

  interface Props {
    editMode: StageEditMode;
  }

  let { editMode }: Props = $props();

  const stageState = getStageChoreographyState();
  const choreography = $derived(stageState.choreography);
  const isPlaying = $derived(stageState.isPlaying);
  const overallProgress = $derived(stageState.overallProgress);

  let containerEl: HTMLDivElement | null = $state(null);
  let timeline: TimelineType | null = $state(null);

  $effect(() => {
    if (!containerEl) return;

    let instance: TimelineType | null = null;

    import('animation-timeline-js').then((module) => {
      const TimelineClass = module.Timeline;
      if (!TimelineClass) {
        console.warn('[StageTimeline] Could not find Timeline constructor');
        return;
      }

      instance = new TimelineClass({ id: containerEl } as TimelineOptions);
      timeline = instance;
    });

    return () => {
      instance?.dispose?.();
      instance = null;
      timeline = null;
    };
  });

  // Update model when choreography changes
  $effect(() => {
    if (!timeline) return;

    const maxBeats = Math.max(
      16,
      ...choreography.performers.map((p) =>
        p.marks.reduce((sum, m) => sum + m.beats, 0)
      )
    );

    const rows = choreography.performers.map((performer) => {
      let accumulated = 0;
      const keyframes = performer.marks.slice(1).map((mark) => {
        accumulated += mark.beats;
        return { val: accumulated };
      });
      return { keyframes };
    });

    timeline.setModel({ rows } as TimelineModel);
    timeline.setOptions({
      min: 0,
      max: maxBeats,
      stepVal: 1,
      snapStep: 1,
    });
  });

  // Drive playhead from state
  $effect(() => {
    if (!timeline || !isPlaying) return;
    const maxBeats = Math.max(
      1,
      ...choreography.performers.map((p) =>
        p.marks.reduce((sum, m) => sum + m.beats, 0)
      )
    );
    timeline.setTime(overallProgress * maxBeats);
  });
</script>

<div class="stage-timeline" bind:this={containerEl} aria-label="Beat timeline"></div>

<style>
  .stage-timeline {
    width: 100%;
    height: 80px;
    min-height: 60px;
    flex-shrink: 0;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: color-mix(in srgb, var(--theme-panel-bg, rgba(18, 18, 28, 0.98)) 90%, black);
  }
</style>
