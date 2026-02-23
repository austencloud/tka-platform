<!--
PositionExplanation - Explanation box for a position type
-->
<script lang="ts">
  import type { PositionInfo } from "../../../../domain/constants/positions-experience-data";

  let {
    info,
  }: {
    info: PositionInfo;
  } = $props();

  const BOLD_WORDS = /straight line|identical position|perpendicular/gi;

  interface TextSegment {
    text: string;
    bold: boolean;
  }

  function parseDescriptionSegments(input: string): TextSegment[] {
    const segments: TextSegment[] = [];
    let lastIndex = 0;
    const regex = new RegExp(BOLD_WORDS.source, "gi");
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

  const descriptionSegments = $derived(parseDescriptionSegments(info.description));
</script>

<div class="explanation">
  <h3>Understanding {info.name}</h3>
  <ul>
    <li>
      {#each descriptionSegments as segment}{#if segment.bold}<strong>{segment.text}</strong>{:else}{segment.text}{/if}{/each}
    </li>
    <li>Think: <strong>{info.angle} apart</strong></li>
    <li>Examples: {info.examples}</li>
  </ul>
</div>

<style>
  .explanation {
    padding: 1.25rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 12px;
  }

  h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: white;
    margin: 0;
  }

  ul {
    margin: 0.75rem 0 0 0;
    padding-left: 1.25rem;
  }

  li {
    font-size: 1rem;
    color: var(--theme-text, rgba(255, 255, 255, 0.75));
    line-height: 1.6;
    margin-bottom: 0.5rem;
  }

  li:last-child {
    margin-bottom: 0;
  }
</style>
