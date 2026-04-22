<!--
  PillBody.svelte

  Layout wrapper for the active pill's body. The only thing that differs
  between mobile and desktop is *where* the body is mounted:

  - mobile: rendered inside a RailBentoSheet that slides up from the
    bottom of the canvas. Closes via the sheet's ✕ / backdrop / Escape.
    Sheet handles aria-modal + focus trap.
  - desktop: rendered inline in a flex-grow scrollable region between
    the pill row and the download footer. Always visible — never closes.
    Wrapped in role="region" with aria-label={title} so screen readers
    announce a named content landmark. NO aria-live here — a live region
    on the pill body would announce the entire newly-mounted subtree on
    every pill switch (wall of text). Announcement duty moves to a
    visually-hidden aria-live status line in the parent ExportVideoDrawer,
    which updates with a terse "<title> settings" on pill change.

  NOT role="tabpanel" — see DownloadPillNav for the rationale (the panel
  is conditionally mounted, not a permanent DOM sibling).
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import RailBentoSheet from "../bento/RailBentoSheet.svelte";

  interface Props {
    title: string;
    variant: "mobile" | "desktop";
    onClose?: () => void;
    /** Mobile only: element to restore focus to when the sheet closes
     *  (typically the activating pill button). Forwarded to RailBentoSheet. */
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
  /* No internal padding — the active pill's content owns its own chrome
     (EffectsPanel renders self-padded .sb-section blocks; the inline
     pill bodies wrap themselves in a .pill-inline-pad div, see Task 6).
     PillBody only manages flex sizing and scroll. */
  .pill-body-inline {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    display: flex;
    flex-direction: column;
  }
</style>
