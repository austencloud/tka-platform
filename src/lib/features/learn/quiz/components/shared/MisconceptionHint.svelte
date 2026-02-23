<!--
MisconceptionHint - Shows a targeted hint when a wrong answer
matches a known confusion pair in the knowledge graph.

Appears below the feedback banner during the feedback window.
Tappable: navigates to TIKA with the misconception pre-loaded.
-->
<script lang="ts">
  import type { DetectedGap } from "../../../services/contracts/IGapDetector";
  import { tkaKnowledgeGraph } from "$lib/features/tika/knowledge/semantic-graph";
  import { handleModuleChange } from "$lib/shared/navigation-coordinator/navigation-coordinator.svelte";
  import { browser } from "$app/environment";

  let { gap }: { gap: DetectedGap } = $props();

  // Use actual letters for the visible hint, type names for TIKA context
  const correctLetter = gap.correctLabel;
  const chosenLetter = gap.chosenLabel;

  const correctNode = $derived(tkaKnowledgeGraph.getNode(gap.correctNodeId));
  const chosenNode = $derived(tkaKnowledgeGraph.getNode(gap.chosenNodeId));
  const correctTypeName = $derived(correctNode?.name.en ?? gap.correctNodeId);
  const chosenTypeName = $derived(chosenNode?.name.en ?? gap.chosenNodeId);

  const hintText = `Not sure about ${correctLetter} vs ${chosenLetter}? Ask TIKA`;

  function openInTika() {
    if (!browser) return;

    // Give TIKA full context: the specific letters AND their types
    const question = `I just picked ${chosenLetter} instead of ${correctLetter} in a pictograph quiz. ${correctLetter} is ${correctTypeName} and ${chosenLetter} is ${chosenTypeName}. What's the difference and how can I tell them apart?`;
    sessionStorage.setItem("tika-seed-message", question);
    handleModuleChange("tika");
  }
</script>

<button
  class="misconception-hint"
  onclick={openInTika}
  aria-label="Ask TIKA about this misconception"
>
  <span class="hint-icon">i</span>
  <span class="hint-text">{hintText}</span>
  <span class="hint-arrow" aria-hidden="true">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  </span>
</button>

<style>
  .misconception-hint {
    position: fixed;
    bottom: calc(var(--primary-nav-height, 64px) + 4.5rem);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: color-mix(in srgb, var(--semantic-info, #3b82f6) 85%, transparent);
    border: none;
    border-radius: 10px;
    max-width: 340px;
    z-index: 149;
    cursor: pointer;
    animation: hintSlideIn var(--duration-emphasis, 300ms) cubic-bezier(0.16, 1, 0.3, 1);
    animation-delay: 200ms;
    animation-fill-mode: backwards;
    transition: filter var(--duration-fast, 150ms) ease;
  }

  .misconception-hint:hover {
    filter: brightness(1.15);
  }

  .misconception-hint:active {
    filter: brightness(0.95);
  }

  .hint-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--theme-text, #ffffff) 20%, transparent);
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    flex-shrink: 0;
  }

  .hint-text {
    color: var(--theme-text, #ffffff);
    font-size: var(--font-size-compact, 12px);
    line-height: 1.4;
    text-align: left;
  }

  .hint-arrow {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
  }

  @keyframes hintSlideIn {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(6px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .misconception-hint {
      animation: none;
    }
  }
</style>
