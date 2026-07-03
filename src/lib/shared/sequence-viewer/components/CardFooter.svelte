<!--
  CardFooter.svelte

  Renders the ChoreoCard footer section: creator name, notes, birthday,
  and path-shape metadata. Extracted from ChoreoCard.svelte.
-->
<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";

  interface Props {
    showFooter: boolean;
    showCreatorName: boolean;
    showNotes: boolean;
    showBirthday: boolean;
    hasPathShapeMetadata: boolean;
    effectiveUserName: string;
    customNotesText: string;
    birthdayDate: string;
    scaledFooterHeight: number;
    footerFontSize: number;
    footerMargin: number;
    activeDarkMode: boolean;
  }

  const {
    showFooter,
    showCreatorName,
    showNotes,
    showBirthday,
    hasPathShapeMetadata,
    effectiveUserName,
    customNotesText,
    birthdayDate,
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
    style="height: {scaledFooterHeight}px; padding-left: {footerMargin}px; padding-right: {footerMargin}px; font-size: {footerFontSize}px;"
    transition:fly|local={{ y: 20, duration: 250, easing: cubicOut }}
  >
    {#if showCreatorName && effectiveUserName}
      <span class="footer-name" transition:fly|local={{ x: -20, duration: 200, easing: cubicOut }}>
        {effectiveUserName}
      </span>
    {/if}

    {#if showNotes}
      <span class="footer-notes" transition:fade|local={{ duration: 200 }}>
        {customNotesText}
      </span>
    {/if}

    {#if showBirthday}
      <span class="footer-birthday" transition:fly|local={{ x: 20, duration: 200, easing: cubicOut }}>
        🎂 {birthdayDate}
      </span>
    {/if}

    {#if hasPathShapeMetadata}
      <span class="footer-path-shape">Linear shifts</span>
    {/if}
  </div>
{/if}

<style>
  /* Footer section — three fixed lanes (name | notes | date). Explicit grid
     columns keep each element in its own lane regardless of which siblings
     render, so the centered branding can never overlap the name/date and the
     box never resizes when the text changes (a flex + absolute-centered note
     used to collide on narrow cards). min-width:0 lets each lane truncate with
     an ellipsis instead of overflowing into its neighbor. */
  .footer-section {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, auto) minmax(0, 1fr);
    align-items: center;
    column-gap: 10px;
    background: rgba(245, 245, 245, 0.98);
    border-top: 1px solid rgba(0, 0, 0, 0.1);
    font-family: Georgia, serif;
    color: black;
    flex-shrink: 0;
    width: 100%;
    box-sizing: border-box;
    transition: background-color 350ms ease, border-color 350ms ease, color 350ms ease;
  }

  .footer-section.dark-mode {
    background: rgba(10, 10, 15, 0.98);
    border-top-color: var(--theme-stroke, rgba(255, 255, 255, 0.15));
    color: white;
  }

  .footer-name {
    grid-column: 1;
    justify-self: start;
    font-weight: bold;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .footer-notes {
    grid-column: 2;
    justify-self: center;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .footer-birthday {
    grid-column: 3;
    justify-self: end;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .footer-path-shape {
    grid-column: 2;
    justify-self: center;
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
