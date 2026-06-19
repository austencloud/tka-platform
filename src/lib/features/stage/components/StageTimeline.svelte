<script lang="ts">
  import { getStageChoreographyState } from '../state/stage-choreography-state.svelte';
  import type { StageEditMode } from '../state/stage-edit-mode.svelte';
  import { TimelineCapShape } from 'animation-timeline-js';

  // animation-timeline-js ships no @types package, so we declare a minimal
  // local surface covering only the members this component touches.
  interface TimelineTimeChangedEvent {
    val: number;
  }
  interface TimelineSelectedEvent {
    selected?: Array<{ data?: { markId?: string; performerId?: string } }>;
  }
  interface TimelineInstance {
    _formatUnitsText: (ms: number) => string;
    onTimeChanged(cb: (e: TimelineTimeChangedEvent) => void): void;
    onSelected(cb: (e: TimelineSelectedEvent | undefined) => void): void;
    setModel(model: { rows: unknown[] }): void;
    setTime(time: number): void;
    dispose?(): void;
  }

  interface Props {
    editMode: StageEditMode;
  }

  let { editMode }: Props = $props();

  const stageState = getStageChoreographyState();
  const choreography = $derived(stageState.choreography);
  const isPlaying = $derived(stageState.isPlaying);
  const overallProgress = $derived(stageState.overallProgress);

  let containerEl: HTMLDivElement | null = $state(null);
  let timeline: TimelineInstance | null = $state(null);

  const maxBeats = $derived(
    Math.max(
      16,
      ...choreography.performers.map((p) =>
        p.marks.reduce((sum, m) => sum + m.beats, 0)
      )
    )
  );

  $effect(() => {
    if (!containerEl) return;

    let instance: TimelineInstance | null = null;

    import('animation-timeline-js').then((module) => {
      const TimelineClass = module.Timeline;
      if (!TimelineClass) return;

      // Cast through unknown: the lib's constructor type isn't exported in a
      // usable form, so we narrow it to our local TimelineInstance surface.
      instance = new TimelineClass({
        id: containerEl,
        min: 0,
        max: maxBeats * 1000,
        stepVal: 1000,
        stepPx: 80,
        snapStep: 1000,
        snapEnabled: true,
        headerHeight: 28,
        zoom: 1,
        zoomMin: 0.1,
        zoomMax: 10,
        timelineDraggable: true,
        keyframesDraggable: true,
        headerFillColor: 'rgba(18, 18, 28, 0.98)',
        fillColor: 'rgba(12, 12, 20, 0.98)',
        labelsColor: 'rgba(255, 255, 255, 0.5)',
        tickColor: 'rgba(255, 255, 255, 0.15)',
        selectionColor: 'rgba(99, 102, 241, 0.3)',
        font: '11px system-ui, sans-serif',
        rowsStyle: {
          height: 28,
          marginBottom: 2,
        },
        timelineStyle: {
          width: 2,
          fillColor: '#f59e0b',
          strokeColor: '#f59e0b',
          capStyle: {
            width: 8,
            height: 8,
            fillColor: '#f59e0b',
            capType: TimelineCapShape.Triangle,
          },
        },
      }) as unknown as TimelineInstance;

      instance._formatUnitsText = (ms: number) => {
        const beat = Math.round(ms / 1000);
        return `${beat}`;
      };

      instance.onTimeChanged((e: TimelineTimeChangedEvent) => {
        if (!isPlaying) {
          const beatPos = e.val / 1000;
          const progress = maxBeats > 0 ? Math.min(1, beatPos / maxBeats) : 0;
          stageState.seek(progress);
        }
      });

      instance.onSelected((e: TimelineSelectedEvent | undefined) => {
        const selected = e?.selected;
        if (selected && selected.length > 0) {
          const kf = selected[0];
          if (kf?.data?.markId && kf?.data?.performerId) {
            editMode.selectMark(kf.data.performerId, kf.data.markId);
          }
        }
      });

      timeline = instance;
    });

    return () => {
      instance?.dispose?.();
      instance = null;
      timeline = null;
    };
  });

  $effect(() => {
    if (!timeline) return;

    const rows = choreography.performers.map((performer) => {
      let accumulated = 0;
      const keyframes = performer.marks.slice(1).map((mark) => {
        accumulated += mark.beats;
        return {
          val: accumulated * 1000,
          data: { markId: mark.id, performerId: performer.id },
        };
      });
      return {
        keyframes,
        style: {
          fillColor: `${performer.color}22`,
          strokeColor: performer.color,
        },
      };
    });

    timeline.setModel({ rows });
  });

  $effect(() => {
    if (!timeline || !isPlaying) return;
    timeline.setTime(overallProgress * maxBeats * 1000);
  });
</script>

<div class="stage-timeline" bind:this={containerEl} aria-label="Beat timeline" role="region"></div>

<style>
  .stage-timeline {
    width: 100%;
    height: 100%;
    min-height: 0;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: color-mix(in srgb, var(--theme-panel-bg, rgba(18, 18, 28, 0.98)) 90%, black);
  }
</style>
