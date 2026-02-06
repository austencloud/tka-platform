<!--
EmptyStateIndicator.svelte - Empty State Indicator Component

Renders the gray circle with question mark for empty pictographs.
Provides a clear visual indicator when no pictograph data is available.
-->
<script lang="ts">
  let { stepNumber = null, hasValidData = false } = $props<{
    /** The beat number to display (or "?" if null) */
    stepNumber?: number | null;
    /** Whether the pictograph has valid data */
    hasValidData?: boolean;
  }>();

  // Only render if we don't have valid data
  const shouldRender = $derived(() => {
    return !hasValidData;
  });

  // Display text - beat number or question mark
  const displayText = $derived(() => {
    return stepNumber || "?";
  });
</script>

{#if shouldRender()}
  <g class="empty-state">
    <circle
      cx="475"
      cy="475"
      r="100"
      fill="#f3f4f6"
      stroke="#e5e7eb"
      stroke-width="2"
    />
    <text
      x="475"
      y="475"
      text-anchor="middle"
      dominant-baseline="middle"
      font-family="Arial, sans-serif"
      font-size="48"
      font-weight="bold"
      fill="#6b7280"
    >
      {displayText()}
    </text>
  </g>
{/if}
