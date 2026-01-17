<!--
  PropControlPair.svelte

  Unified layout component for Blue + Red prop controls.
  Provides consistent glass-morphism card styling for both props.
  Handles stacked (mobile) vs side-by-side (desktop) layout.

  Compact mode: Tighter padding and gaps for mobile screens.

  Usage:
    <PropControlPair stacked={isMobile} compact={isMobile}>
      {#snippet blueContent()} ... blue controls ... {/snippet}
      {#snippet redContent()} ... red controls ... {/snippet}
    </PropControlPair>
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    /** Stack cards vertically (mobile) vs side-by-side (desktop) */
    stacked?: boolean;
    /** Use compact styling with tighter padding/gaps */
    compact?: boolean;
    /** Content for the blue prop card */
    blueContent?: Snippet;
    /** Content for the red prop card */
    redContent?: Snippet;
  }

  let { stacked = false, compact = false, blueContent, redContent }: Props = $props();
</script>

<div class="prop-pair" class:stacked class:compact>
  <div class="prop-card blue">
    <span class="prop-label">Blue</span>
    <div class="card-content">
      {@render blueContent?.()}
    </div>
  </div>
  <div class="prop-card red">
    <span class="prop-label">Red</span>
    <div class="card-content">
      {@render redContent?.()}
    </div>
  </div>
</div>

<style>
  /* ============================================================================
     PROP PAIR LAYOUT - Stacked (mobile) vs side-by-side (desktop)
     ============================================================================ */

  .prop-pair {
    display: flex;
    gap: 12px;
  }

  .prop-pair.stacked {
    flex-direction: column;
  }

  /* Compact mode: tighter gaps */
  .prop-pair.compact {
    gap: 6px;
  }

  /* ============================================================================
     PROP CARD - Glass-morphism colored panels
     Unified styling for all blue/red control contexts
     ============================================================================ */

  .prop-card {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 14px;
    border-radius: 12px;
    border: 1px solid;
    transition: all var(--duration-fast) ease;
  }

  /* Compact mode: tighter padding and gaps */
  .prop-pair.compact .prop-card {
    padding: 8px;
    gap: 6px;
    border-radius: 10px;
  }

  /* Blue - Indigo glass pane */
  .prop-card.blue {
    background: linear-gradient(
      135deg,
      rgba(59, 130, 246, 0.15) 0%,
      rgba(59, 130, 246, 0.05) 100%
    );
    border-color: rgba(59, 130, 246, 0.35);
  }

  .prop-card.blue:hover {
    background: linear-gradient(
      135deg,
      rgba(59, 130, 246, 0.2) 0%,
      rgba(59, 130, 246, 0.1) 100%
    );
    border-color: rgba(59, 130, 246, 0.5);
    box-shadow: 0 4px 16px rgba(59, 130, 246, 0.2);
  }

  /* Red - Rose glass pane */
  .prop-card.red {
    background: linear-gradient(
      135deg,
      rgba(239, 68, 68, 0.15) 0%,
      rgba(239, 68, 68, 0.05) 100%
    );
    border-color: rgba(239, 68, 68, 0.35);
  }

  .prop-card.red:hover {
    background: linear-gradient(
      135deg,
      rgba(239, 68, 68, 0.2) 0%,
      rgba(239, 68, 68, 0.1) 100%
    );
    border-color: rgba(239, 68, 68, 0.5);
    box-shadow: 0 4px 16px rgba(239, 68, 68, 0.2);
  }

  /* ============================================================================
     PROP LABEL - Consistent header for both cards
     ============================================================================ */

  .prop-label {
    font-size: 0.75rem;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.8);
    text-transform: uppercase;
    letter-spacing: 0.75px;
  }

  /* Compact mode: smaller label */
  .prop-pair.compact .prop-label {
    font-size: 0.65rem;
    letter-spacing: 0.5px;
  }

  /* ============================================================================
     CARD CONTENT - Container for slotted controls
     Minimum height ensures consistent card size between different control types
     (turns controls have 2 rows, orientation has 1 row - both should look same)
     ============================================================================ */

  .card-content {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    /* Min height to accommodate turns controls (2 rows of buttons) */
    min-height: calc(var(--min-touch-target, 44px) * 2 + 8px);
  }

  /* Compact mode: reduced gap and min-height (single row layout) */
  .prop-pair.compact .card-content {
    gap: 4px;
    min-height: 38px; /* Single row of compact buttons */
  }

  /* ============================================================================
     CSS CUSTOM PROPERTIES - Exposed for child styling
     Children can use these to match the card's color theme
     ============================================================================ */

  .prop-card.blue {
    --prop-color: var(--semantic-info);
    --prop-color-rgb: 59, 130, 246;
  }

  .prop-card.red {
    --prop-color: var(--semantic-error);
    --prop-color-rgb: 239, 68, 68;
  }

  /* ============================================================================
     REDUCED MOTION
     ============================================================================ */

  @media (prefers-reduced-motion: reduce) {
    .prop-card {
      transition: none;
    }
  }
</style>
