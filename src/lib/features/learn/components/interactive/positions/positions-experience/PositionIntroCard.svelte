<!--
PositionIntroCard - Intro card for a position type
-->
<script lang="ts">
  import type { PositionInfo } from "../../../../domain/constants/positions-experience-data";

  let {
    type,
    info,
  }: {
    type: "alpha" | "beta" | "gamma";
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

<div class="position-intro {type}">
  <div class="position-icon">
    <i class="fa-solid {info.icon}" aria-hidden="true"></i>
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
  }

  .position-intro.alpha {
    --pos-color: #ff6b6b;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--pos-color) 10%, transparent) 0%,
      color-mix(in srgb, var(--pos-color) 2%, transparent) 100%
    );
    border: 1px solid color-mix(in srgb, var(--pos-color) 20%, transparent);
  }

  .position-intro.beta {
    --pos-color: #4ecdc4;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--pos-color) 10%, transparent) 0%,
      color-mix(in srgb, var(--pos-color) 2%, transparent) 100%
    );
    border: 1px solid color-mix(in srgb, var(--pos-color) 20%, transparent);
  }

  .position-intro.gamma {
    --pos-color: #ffe66d;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--pos-color) 10%, transparent) 0%,
      color-mix(in srgb, var(--pos-color) 2%, transparent) 100%
    );
    border: 1px solid color-mix(in srgb, var(--pos-color) 20%, transparent);
  }

  .position-icon {
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
  }

  .position-intro.alpha .position-icon,
  .position-intro.beta .position-icon,
  .position-intro.gamma .position-icon {
    background: color-mix(in srgb, var(--pos-color) 20%, transparent);
    color: var(--pos-color);
  }

  .position-icon i {
    font-size: 1.5rem;
  }

  .position-summary {
    font-size: 1.25rem;
    font-weight: 500;
    color: var(--theme-text, rgba(255, 255, 255, 0.85));
    margin: 0;
    text-align: center;
  }
</style>
