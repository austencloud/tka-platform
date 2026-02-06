<script lang="ts">
  /**
   * LabeledSection - Section with label above content
   * Uses --theme-* CSS variables for consistent theming.
   */

  import type { Snippet } from "svelte";

  interface Props {
    /** Section label */
    label?: string;
    /** Content to render */
    children: Snippet;
  }

  let { label, children }: Props = $props();
</script>

<section class="labeled-section">
  {#if label}
    <span class="section-label">{label}</span>
  {/if}
  {@render children()}
</section>

<style>
  .labeled-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .section-label {
    font-size: var(--font-size-compact, 0.75rem);
    text-transform: uppercase;
    color: var(--theme-text-dim);
    letter-spacing: 0.05em;
  }
</style>
