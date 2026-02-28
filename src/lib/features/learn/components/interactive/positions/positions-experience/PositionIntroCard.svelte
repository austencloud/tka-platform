<!--
PositionIntroCard - Intro card for a position type
-->
<script lang="ts">
  import type { PositionInfo } from "../../../../domain/constants/positions-experience-data";

  let {
    info,
  }: {
    info: PositionInfo;
  } = $props();

  interface TextSegment {
    text: string;
    bold: boolean;
  }

  function parseSummarySegments(input: string): TextSegment[] {
    const segments: TextSegment[] = [];
    const regex = /opposite|same|right angles/gi;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(input)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ text: input.slice(lastIndex, match.index), bold: false });
      }
      segments.push({ text: match[0], bold: true });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < input.length) {
      segments.push({ text: input.slice(lastIndex), bold: false });
    }
    return segments;
  }

  const summarySegments = $derived(parseSummarySegments(info.summary));
</script>

<div class="position-intro">
  <div class="position-icon">
    <span class="greek-symbol" aria-hidden="true">{info.symbol}</span>
  </div>
  <p class="position-summary">
    {#each summarySegments as segment}{#if segment.bold}<strong>{segment.text}</strong>{:else}{segment.text}{/if}{/each}
  </p>
</div>

<style>
  .position-intro {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 1.5rem;
    border-radius: 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .position-icon {
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: color-mix(in srgb, var(--theme-accent, #22d3ee) 15%, transparent);
  }

  .greek-symbol {
    font-size: 1.75rem;
    font-weight: 600;
    line-height: 1;
    color: var(--theme-text);
  }

  .position-summary {
    font-size: 1.25rem;
    font-weight: 500;
    color: var(--theme-text, rgba(255, 255, 255, 0.85));
    margin: 0;
    text-align: center;
  }
</style>
