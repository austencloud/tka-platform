<!--
  TransformIntroStep.svelte

  Introduction step showing what the transform does with a text explanation.
-->
<script lang="ts">
  import type { TransformHelpItem } from "../../../domain/transforms/transform-help-content";

  type TransformId = "mirror" | "flip" | "invert" | "rotate" | "swap" | "rewind";

  interface Props {
    transformId: TransformId;
    transform: TransformHelpItem;
  }

  let { transformId, transform }: Props = $props();

  // Additional intro content per transform
  const introContent: Record<TransformId, { title: string; bullets: string[] }> = {
    mirror: {
      title: "What Mirror Does",
      bullets: [
        "Flips your sequence horizontally across the vertical center line",
        "Left movements become right, and right becomes left",
        "Clockwise turns become counter-clockwise",
        "Great for creating mirror-image variations",
      ],
    },
    flip: {
      title: "What Flip Does",
      bullets: [
        "Flips your sequence vertically across the horizontal center line",
        "Upward movements become downward, and vice versa",
        "Clockwise turns become counter-clockwise",
        "Creates vertical variations of your patterns",
      ],
    },
    invert: {
      title: "What Invert Does",
      bullets: [
        "Reverses all rotation directions in your sequence",
        "Clockwise turns become counter-clockwise, and vice versa",
        "PRO motions become ANTI, and ANTI becomes PRO",
        "Warning: This changes the letters in your sequence!",
      ],
    },
    rotate: {
      title: "What Rotate Does",
      bullets: [
        "Pivots the entire sequence 45 degrees",
        "Like physically turning your body while performing",
        "North positions become Northeast (clockwise) or Northwest (counter-clockwise)",
        "Rotate 4 times in the same direction for a full 180°",
      ],
    },
    swap: {
      title: "What Swap Hands Does",
      bullets: [
        "Exchanges all left-hand movements with right-hand movements",
        "Your sequence looks the same, but opposite hands perform each motion",
        "Great for practicing with your other hand",
        "Helps build ambidextrous flow skills",
      ],
    },
    rewind: {
      title: "What Rewind Does",
      bullets: [
        "Plays your sequence backwards, like rewinding a video",
        "Takes the end position and makes it the new starting point",
        "Every beat plays in reverse order",
        "Turn directions flip (clockwise becomes counter-clockwise)",
      ],
    },
  };

  const content = $derived(introContent[transformId]);
</script>

<div class="intro-step">
  <h3 class="step-title">{content.title}</h3>

  <p class="full-description">{transform.fullDesc}</p>

  <ul class="bullet-list">
    {#each content.bullets as bullet}
      <li>
        <i class="fas fa-check" aria-hidden="true"></i>
        <span>{bullet}</span>
      </li>
    {/each}
  </ul>

  {#if transform.warning}
    <div class="warning-box">
      <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
      <span>{transform.warning}</span>
    </div>
  {/if}

  <div class="next-hint">
    <i class="fas fa-arrow-right" aria-hidden="true"></i>
    <span>Tap <strong>Next</strong> to see an interactive example</span>
  </div>
</div>

<style>
  .intro-step {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .step-title {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
  }

  .full-description {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.8);
  }

  .bullet-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .bullet-list li {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-size: var(--font-size-min, 14px);
    color: rgba(255, 255, 255, 0.75);
  }

  .bullet-list li i {
    color: #22c55e;
    font-size: 12px;
    margin-top: 4px;
    flex-shrink: 0;
  }

  .warning-box {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 10px;
    font-size: var(--font-size-min, 14px);
    color: #fbbf24;
  }

  .warning-box i {
    font-size: var(--font-size-lg, 18px);
    flex-shrink: 0;
  }

  .next-hint {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: 10px;
    font-size: var(--font-size-min, 14px);
    color: rgba(255, 255, 255, 0.7);
    margin-top: 8px;
  }

  .next-hint i {
    color: #60a5fa;
    animation: bounce-right 1s ease-in-out infinite;
  }

  @keyframes bounce-right {
    0%,
    100% {
      transform: translateX(0);
    }
    50% {
      transform: translateX(4px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .next-hint i {
      animation: none;
    }
  }
</style>
