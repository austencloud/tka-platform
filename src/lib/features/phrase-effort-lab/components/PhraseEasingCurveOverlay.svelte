<!--
  PhraseEasingCurveOverlay.svelte

  Renders a mini easing curve visualization below each phrase region
  on the timeline. Shows how animation speed varies across the phrase:
  steep = fast motion, flat = lingering.
-->
<script lang="ts">
  import type { EffortTimeline } from "../domain/effort-timeline-types";
  import type { EffortId } from "$lib/features/effort-lab/domain/effort-types";
  import { EFFORTS } from "$lib/features/effort-lab/domain/effort-types";
  import { applyEffort } from "$lib/features/effort-lab/domain/effort-easing-unified";

  interface Props {
    timeline: EffortTimeline;
    totalBeats: number;
    /** Height of the curve area in pixels */
    height?: number;
  }

  let { timeline, totalBeats, height = 40 }: Props = $props();

  const SAMPLES = 48; // points per phrase curve

  /**
   * Generate an SVG path for one phrase's easing curve.
   * Y is inverted (SVG 0 = top), so a Press curve (slow start) shows
   * as flat at the left, steep at the right.
   */
  function buildCurvePath(
    effortId: EffortId,
    phraseLeftPct: number,
    phraseWidthPct: number,
  ): string {
    const points: string[] = [];

    for (let i = 0; i <= SAMPLES; i++) {
      const t = i / SAMPLES;
      const eased = applyEffort(effortId, t);
      // X: position within the phrase region (as percentage of total width)
      const x = phraseLeftPct + t * phraseWidthPct;
      // Y: eased value, flipped so 0 = bottom, 1 = top
      const y = (1 - eased) * height;
      points.push(`${i === 0 ? "M" : "L"} ${x} ${y}`);
    }

    return points.join(" ");
  }

  const phraseData = $derived(
    timeline.phrases.map((phrase) => {
      const effort = EFFORTS.find((e) => e.id === phrase.effortId);
      const color = effort?.color ?? "#94a3b8";
      const leftPct = ((phrase.startBeat - 1) / totalBeats) * 100;
      const widthPct = ((phrase.endBeat - phrase.startBeat + 1) / totalBeats) * 100;
      const path = buildCurvePath(phrase.effortId, leftPct, widthPct);
      return { id: phrase.id, color, leftPct, widthPct, path };
    })
  );
</script>

<svg
  class="easing-curve-overlay"
  viewBox="0 0 100 {height}"
  preserveAspectRatio="none"
  style:height="{height}px"
  aria-hidden="true"
>
  <!-- Background grid lines for each beat -->
  {#each Array.from({ length: totalBeats }, (_, i) => i) as beat}
    <line
      x1={((beat) / totalBeats) * 100}
      y1="0"
      x2={((beat) / totalBeats) * 100}
      y2={height}
      stroke="rgba(255,255,255,0.06)"
      stroke-width="0.2"
    />
  {/each}

  <!-- Linear reference line (diagonal) for each phrase -->
  {#each phraseData as { id, leftPct, widthPct }}
    <line
      x1={leftPct}
      y1={height}
      x2={leftPct + widthPct}
      y2="0"
      stroke="rgba(255,255,255,0.08)"
      stroke-width="0.15"
      stroke-dasharray="1 1"
    />
  {/each}

  <!-- Easing curves -->
  {#each phraseData as { id, color, path }}
    <path
      d={path}
      fill="none"
      stroke={color}
      stroke-width="0.5"
      opacity="0.8"
      vector-effect="non-scaling-stroke"
    />
  {/each}
</svg>

<style>
  .easing-curve-overlay {
    width: 100%;
    display: block;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
    border-top: none;
    border-radius: 0 0 8px 8px;
    background: rgba(0, 0, 0, 0.15);
  }
</style>
