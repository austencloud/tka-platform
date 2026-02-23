<!--
VTGComponentCard - Shows direction or timing component explanation
-->
<script lang="ts">
  let {
    type,
    icon,
    title,
    options,
    subtitle,
  }: {
    type: "direction" | "timing";
    icon: string;
    title: string;
    options: string;
    subtitle: string;
  } = $props();

  interface TextSegment {
    text: string;
    bold: boolean;
  }

  function parseStrongTags(input: string): TextSegment[] {
    const segments: TextSegment[] = [];
    const parts = input.split(/(<strong>.*?<\/strong>)/g);
    for (const part of parts) {
      const match = part.match(/^<strong>(.*?)<\/strong>$/);
      if (match) {
        segments.push({ text: match[1] ?? "", bold: true });
      } else if (part) {
        segments.push({ text: part, bold: false });
      }
    }
    return segments;
  }
</script>

<div
  class="component-card"
  class:direction={type === "direction"}
  class:timing={type === "timing"}
>
  <div class="component-icon">
    <i class="fa-solid {icon}" aria-hidden="true"></i>
  </div>
  <h4>{title}</h4>
  <p>{#each parseStrongTags(options) as segment}{#if segment.bold}<strong>{segment.text}</strong>{:else}{segment.text}{/if}{/each}</p>
  <small>{subtitle}</small>
</div>

<style>
  .component-card {
    flex: 1;
    min-width: 200px;
    max-width: 280px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1.25rem;
    border-radius: 12px;
    text-align: center;
  }

  .component-card.direction {
    background: color-mix(in srgb, var(--theme-accent, #22d3ee) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent, #22d3ee) 25%, transparent);
  }

  .component-card.timing {
    background: color-mix(in srgb, var(--theme-accent-secondary, #a78bfa) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent-secondary, #a78bfa) 25%, transparent);
  }

  .component-icon {
    width: var(--min-touch-target, 44px);
    height: var(--min-touch-target, 44px);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-size: 1.25rem;
  }

  .component-card.direction .component-icon {
    background: color-mix(in srgb, var(--theme-accent, #22d3ee) 20%, transparent);
    color: var(--theme-accent, #22d3ee);
  }

  .component-card.timing .component-icon {
    background: color-mix(in srgb, var(--theme-accent-secondary, #a78bfa) 20%, transparent);
    color: var(--theme-accent-secondary, #a78bfa);
  }

  h4 {
    font-size: 1rem;
    font-weight: 700;
    margin: 0;
  }

  .component-card.direction h4 {
    color: var(--theme-accent, #22d3ee);
  }

  .component-card.timing h4 {
    color: var(--theme-accent-secondary, #a78bfa);
  }

  p {
    font-size: 0.9375rem;
    color: var(--theme-text, rgba(255, 255, 255, 0.85));
    margin: 0;
  }

  small {
    font-size: 0.75rem;
    color: var(--theme-text-dim);
  }

  @media (max-width: 600px) {
    .component-card {
      max-width: 100%;
      width: 100%;
    }
  }
</style>
