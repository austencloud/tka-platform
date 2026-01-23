<!--
  ContextualCTA

  Action button that changes based on content type/intent.
  - Tutorial: "Start Learning"
  - Demo: "View Sequence"
  - Sequence: "Practice"
  - Composition: "Open"
-->
<script lang="ts">
  import type { FeedItemIntent } from "../../domain/models/feed-models";

  interface Props {
    intent: FeedItemIntent;
    onClick?: () => void;
  }

  const { intent, onClick }: Props = $props();

  // Determine label and icon based on intent
  const ctaConfig = $derived.by(() => {
    switch (intent) {
      case "tutorial":
        return { label: "Start Learning", icon: "fas fa-graduation-cap" };
      case "demo":
        return { label: "View Sequence", icon: "fas fa-eye" };
      case "composition":
        return { label: "Open", icon: "fas fa-folder-open" };
      case "sequence":
      default:
        return { label: "Practice", icon: "fas fa-play" };
    }
  });

  function handleClick(e: Event) {
    e.stopPropagation(); // Don't trigger card click
    onClick?.();
  }
</script>

<button class="contextual-cta" onclick={handleClick} type="button">
  <i class={ctaConfig.icon} aria-hidden="true"></i>
  <span>{ctaConfig.label}</span>
</button>

<style>
  .contextual-cta {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: var(--min-touch-target, 44px);
    padding: 12px 20px;
    background: linear-gradient(
      135deg,
      var(--theme-accent) 0%,
      color-mix(in srgb, var(--theme-accent) 80%, black) 100%
    );
    border: none;
    border-radius: 12px;
    color: white;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) ease;
  }

  .contextual-cta:hover {
    filter: brightness(1.1);
    transform: translateY(-1px);
  }

  .contextual-cta:active {
    transform: translateY(0);
  }

  .contextual-cta:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .contextual-cta i {
    font-size: 0.9em;
  }
</style>
