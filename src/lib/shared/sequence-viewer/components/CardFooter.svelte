<!--
  CardFooter.svelte

  Renders centered card notes and path-shape metadata. Submission provenance
  and record dates belong on the sequence record, not the portable card.
-->
<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";

  interface Props {
    showFooter: boolean;
    showNotes: boolean;
    hasPathShapeMetadata: boolean;
    customNotesText: string;
    scaledFooterHeight: number;
    footerFontSize: number;
    footerMargin: number;
    activeDarkMode: boolean;
  }

  const {
    showFooter,
    showNotes,
    hasPathShapeMetadata,
    customNotesText,
    scaledFooterHeight,
    footerFontSize,
    footerMargin,
    activeDarkMode,
  }: Props = $props();
</script>

{#if showFooter}
  <div
    class="footer-section"
    class:dark-mode={activeDarkMode}
    style="height: {scaledFooterHeight}px; padding-left: {footerMargin}px; padding-right: {footerMargin}px; font-size: max(var(--font-size-compact, 12px), {footerFontSize}px);"
    transition:fly|local={{ y: 20, duration: 250, easing: cubicOut }}
  >
    {#if showNotes}
      <span class="footer-notes" transition:fade|local={{ duration: 200 }}>
        {customNotesText}
      </span>
    {/if}

    {#if hasPathShapeMetadata}
      <span class="footer-path-shape">Linear shifts</span>
    {/if}
  </div>
{/if}

<style>
  /* The footer contains card facts only, centered as one balanced group. */
  .footer-section {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    column-gap: 10px;
    background: rgba(245, 245, 245, 0.98);
    border-top: 1px solid rgba(0, 0, 0, 0.1);
    font-family: Georgia, serif;
    color: black;
    flex-shrink: 0;
    width: 100%;
    box-sizing: border-box;
    transition:
      background-color 350ms ease,
      border-color 350ms ease,
      color 350ms ease;
  }

  .footer-section.dark-mode {
    background: rgba(10, 10, 15, 0.98);
    border-top-color: var(--theme-stroke, rgba(255, 255, 255, 0.15));
    color: white;
  }

  .footer-notes {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .footer-path-shape {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: inherit;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-style: italic;
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .footer-section {
      transition: none;
    }
  }
</style>
