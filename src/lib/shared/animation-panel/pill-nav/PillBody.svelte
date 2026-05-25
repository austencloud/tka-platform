<!--
  PillBody.svelte

  Layout wrapper for the active pill's body. The only thing that differs
  between mobile and desktop is *where* the body is mounted:

  - mobile: rendered inside a RailBentoSheet that slides up from the
    bottom of the canvas. Closes via the sheet's × / backdrop / Escape.
    Sheet handles aria-modal + focus trap.
  - desktop: rendered inline in a flex-grow scrollable region between
    the pill row and the download footer. Always visible - never closes.
    Wrapped in role="region" with aria-label={title} so screen readers
    announce a named content landmark.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import RailBentoSheet from "../bento/RailBentoSheet.svelte";

  interface Props {
    title: string;
    variant: "mobile" | "desktop";
    onClose?: () => void;
    returnFocusTo?: HTMLElement | null;
    children: Snippet;
  }

  const { title, variant, onClose, returnFocusTo = null, children }: Props = $props();
</script>

{#if variant === "mobile"}
  <RailBentoSheet
    {title}
    onClose={onClose ?? (() => {})}
    {returnFocusTo}
  >
    {@render children()}
  </RailBentoSheet>
{:else}
  <div
    class="pill-body-inline"
    role="region"
    aria-label={title}
  >
    {@render children()}
  </div>
{/if}

<style>
  .pill-body-inline {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    display: flex;
    flex-direction: column;
  }
</style>
