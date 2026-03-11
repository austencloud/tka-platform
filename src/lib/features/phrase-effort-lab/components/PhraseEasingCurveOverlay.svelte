<!--
  PhraseEasingCurveOverlay.svelte

  Renders easing curve visualization below the timeline.
  Steep = fast motion, flat = lingering.
  In blend mode, shows crossfade regions where adjacent curves merge.
-->
<script lang="ts">
  import type { EffortTimeline, EffortPhrase } from "../domain/effort-timeline-types";
  import type { EffortId } from "$lib/features/effort-lab/domain/effort-types";
  import { EFFORTS } from "$lib/features/effort-lab/domain/effort-types";
  import { applyEffort } from "$lib/features/effort-lab/domain/effort-easing-unified";

  interface Props {
    timeline: EffortTimeline;
    totalBeats: number;
    height?: number;
  }

  let { timeline, totalBeats, height = 40 }: Props = $props();

  const SAMPLES = 48;

  function getColor(effortId: EffortId): string {
    return EFFORTS.find((e) => e.id === effortId)?.color ?? "#94a3b8";
  }

  function beatToPct(beat: number): number {
    return ((beat - 1) / totalBeats) * 100;
  }

  function buildCurvePath(
    effortId: EffortId,
    leftPct: number,
    widthPct: number,
  ): string {
    const points: string[] = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const t = i / SAMPLES;
      const eased = applyEffort(effortId, t);
      const x = leftPct + t * widthPct;
      const y = (1 - eased) * height;
      points.push(`${i === 0 ? "M" : "L"} ${x} ${y}`);
    }
    return points.join(" ");
  }

  /** Build a blended crossfade curve between two adjacent phrases */
  function buildBlendPath(
    phraseA: EffortPhrase,
    phraseB: EffortPhrase,
    blendBeats: number,
  ): string {
    const halfBlend = blendBeats / 2;
    // Blend region: [boundary - halfBlend, boundary + halfBlend]
    const boundary = phraseB.startBeat; // where B starts (integer)
    const blendStart = boundary - halfBlend;
    const blendEnd = boundary + halfBlend;

    const blendStartPct = beatToPct(blendStart);
    const blendEndPct = beatToPct(blendEnd);
    const blendWidthPct = blendEndPct - blendStartPct;

    const points: string[] = [];
    const BLEND_SAMPLES = 32;

    for (let i = 0; i <= BLEND_SAMPLES; i++) {
      const t = i / BLEND_SAMPLES; // 0 to 1 across blend region
      const currentBeat = blendStart + t * blendBeats;

      // Evaluate both curves at this beat position
      const durationA = phraseA.endBeat - phraseA.startBeat + 1;
      const progressA = Math.min((currentBeat - phraseA.startBeat) / durationA, 1);
      const easedA = applyEffort(phraseA.effortId, Math.max(0, progressA));

      const durationB = phraseB.endBeat - phraseB.startBeat + 1;
      const progressB = Math.max((currentBeat - phraseB.startBeat) / durationB, 0);
      const easedB = applyEffort(phraseB.effortId, Math.min(progressB, 1));

      // Lerp between the two based on blend progress
      const blended = easedA * (1 - t) + easedB * t;

      const x = blendStartPct + t * blendWidthPct;
      const y = (1 - blended) * height;
      points.push(`${i === 0 ? "M" : "L"} ${x} ${y}`);
    }

    return points.join(" ");
  }

  const phraseData = $derived(
    timeline.phrases.map((phrase) => {
      const color = getColor(phrase.effortId);
      const leftPct = beatToPct(phrase.startBeat);
      const rightPct = beatToPct(phrase.endBeat + 1);
      const widthPct = rightPct - leftPct;
      const path = buildCurvePath(phrase.effortId, leftPct, widthPct);
      return { id: phrase.id, color, leftPct, widthPct, path, phrase };
    })
  );

  /** Blend curves between adjacent phrases (only in blend mode) */
  const blendCurves = $derived.by(() => {
    if (timeline.transition !== "blend" || !timeline.blendBeats) return [];

    const curves: { path: string; colorA: string; colorB: string; id: string }[] = [];
    const phrases = timeline.phrases;

    for (let i = 0; i < phrases.length - 1; i++) {
      const a = phrases[i]!;
      const b = phrases[i + 1]!;
      if (!a || !b) continue;
      // Only blend adjacent phrases (no gap between them)
      if (a.endBeat + 1 === b.startBeat) {
        curves.push({
          path: buildBlendPath(a, b, timeline.blendBeats!),
          colorA: getColor(a.effortId),
          colorB: getColor(b.effortId),
          id: `blend-${a.id}-${b.id}`,
        });
      }
    }
    return curves;
  });

  /** Blend zone markers for visual indication */
  const blendZones = $derived.by(() => {
    if (timeline.transition !== "blend" || !timeline.blendBeats) return [];

    const zones: { leftPct: number; widthPct: number; id: string }[] = [];
    const phrases = timeline.phrases;
    const halfBlend = timeline.blendBeats! / 2;

    for (let i = 0; i < phrases.length - 1; i++) {
      const a = phrases[i]!;
      const b = phrases[i + 1]!;
      if (!a || !b) continue;
      if (a.endBeat + 1 === b.startBeat) {
        const boundary = b.startBeat;
        const leftPct = beatToPct(boundary - halfBlend);
        const rightPct = beatToPct(boundary + halfBlend);
        zones.push({ leftPct, widthPct: rightPct - leftPct, id: `zone-${i}` });
      }
    }
    return zones;
  });
</script>

<svg
  class="easing-curve-overlay"
  viewBox="0 0 100 {height}"
  preserveAspectRatio="none"
  style:height="{height}px"
  aria-hidden="true"
>
  <!-- Background grid lines -->
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

  <!-- Blend zone highlights -->
  {#each blendZones as zone (zone.id)}
    <rect
      x={zone.leftPct}
      y="0"
      width={zone.widthPct}
      height={height}
      fill="rgba(255,255,255,0.04)"
      stroke="rgba(255,255,255,0.1)"
      stroke-width="0.15"
      stroke-dasharray="0.5 0.5"
    />
  {/each}

  <!-- Linear reference lines -->
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

  <!-- Per-phrase easing curves -->
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

  <!-- Blend crossfade curves (white, overlaid on top) -->
  {#each blendCurves as curve (curve.id)}
    <path
      d={curve.path}
      fill="none"
      stroke="white"
      stroke-width="0.7"
      opacity="0.9"
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
