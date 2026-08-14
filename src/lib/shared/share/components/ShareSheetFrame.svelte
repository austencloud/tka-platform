<!--
  ShareSheetFrame.svelte — the surface the share sheet arrives on.

  A bottom drawer is the right pattern on a phone and the wrong one everywhere
  else: on a 4K panel it reads as a phone strip pinned to the bottom edge of a
  desk-sized screen, a shape this app uses nowhere. Austen (2026-08-11): "why is
  it coming out of the bottom of my 4K screen when that's literally a pattern
  you never use anywhere else."

  So the frame picks by viewport rather than committing to one: BaseModal — the
  app's own native <dialog>, with its backdrop, focus restore and modal stack —
  from 900px up, and Drawer below it, where a thumb-reachable sheet with
  swipe-to-dismiss genuinely is the native answer.

  900 is the same seam the sheet's own layout uses to go two-column, so the
  surface and the composition change together instead of at two different
  widths.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";

  interface Props {
    isOpen: boolean;
    ariaLabel: string;
    onClose: () => void;
    /**
     * A focused single-column step (the QR handoff) rather than the full sheet.
     * The dialog has to narrow with it — the content cannot do this alone,
     * because a 34rem column centred in a 90rem dialog is the dead rail this
     * frame exists to avoid.
     */
    narrow?: boolean;
    /**
     * Post Studio uses the same modal mechanics as sharing, but its preview,
     * setup controls, and timeline need separate desktop columns.
     */
    expanded?: boolean;
    children: Snippet<[surface: "modal" | "drawer"]>;
  }

  let {
    isOpen,
    ariaLabel,
    onClose,
    narrow = false,
    expanded = false,
    children,
  }: Props = $props();

  const WIDE = "(min-width: 900px)";

  // Starts false so the server and the first client frame agree; the effect
  // below corrects it before paint. Guessing "wide" here instead would mount a
  // dialog on a phone for one frame and animate the wrong surface in.
  let wide = $state(false);

  $effect(() => {
    const query = window.matchMedia(WIDE);
    wide = query.matches;
    const sync = (event: MediaQueryListEvent) => (wide = event.matches);
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  });

  // Drawer animates itself out, so it owns its open flag and reports
  // dismissals back rather than binding the caller's state.
  let drawerOpen = $state(false);
  $effect(() => {
    drawerOpen = isOpen;
  });
</script>

{#if wide || expanded}
  <BaseModal
    open={isOpen}
    class={narrow
      ? "share-sheet-modal share-sheet-modal--narrow"
      : expanded
        ? "share-sheet-modal share-sheet-modal--expanded"
        : "share-sheet-modal"}
    size={expanded ? "full" : "fit"}
    position="center"
    animation="pop"
    onclose={onClose}
  >
    {@render children("modal")}
  </BaseModal>
{:else}
  <Drawer
    bind:isOpen={drawerOpen}
    placement="bottom"
    {ariaLabel}
    class="share-sheet-drawer"
    focusContainerOnOpen={true}
    onOpenChange={(open) => {
      if (!open && isOpen) onClose();
    }}
  >
    {@render children("drawer")}
  </Drawer>
{/if}

<style>
  /* The dialog is a frame around the sheet, so the sheet's own width tiers set
     it. Without this every tier resolves against --modal-width-fit's 480px and
     the two-column layout has nowhere to go. */
  :global(dialog.base-modal.share-sheet-modal[data-size]) {
    width: min(58rem, calc(100vw - 4rem));
    /* The sheet is a composition, not a document: it should never be the thing
       that scrolls. Each tier is sized to clear the fold instead. */
    max-height: min(92dvh, calc(var(--viewport-height, 100dvh) - 3rem));
  }

  @media (min-width: 1680px) {
    :global(dialog.base-modal.share-sheet-modal[data-size]) {
      width: min(78rem, calc(100vw - 6rem));
    }
  }

  @media (min-width: 2350px) {
    :global(dialog.base-modal.share-sheet-modal[data-size]) {
      width: min(100rem, calc(100vw - 8rem));
    }
  }

  @media (min-width: 3200px) {
    :global(dialog.base-modal.share-sheet-modal[data-size]) {
      width: min(118rem, calc(100vw - 10rem));
    }
  }

  /* The regular share sheet is intentionally compact. Post Studio is an
     editor, so large desktops spend their width on preview, setup, and timing
     columns instead of stretching one form column across the dialog. */
  :global(dialog.base-modal.share-sheet-modal--expanded[data-size]) {
    width: calc(100vw - 1rem);
    height: calc(var(--viewport-height, 100dvh) - 1rem);
    max-width: none;
    max-height: calc(var(--viewport-height, 100dvh) - 1rem);
    border-radius: var(--radius-2026-lg, 1rem);
  }

  :global(dialog.base-modal.share-sheet-modal--expanded .modal-content-wrapper),
  :global(dialog.base-modal.share-sheet-modal--expanded .modal-body) {
    height: 100%;
    min-height: 0;
  }

  :global(dialog.base-modal.share-sheet-modal--expanded .modal-body) {
    overflow: hidden;
  }

  /* The QR step holds one code and a Back button. Last among the width rules so
     it wins at every tier without repeating itself inside each one. */
  :global(dialog.base-modal.share-sheet-modal--narrow[data-size]) {
    width: min(34rem, calc(100vw - 4rem));
  }

  @media (min-width: 2350px) {
    :global(dialog.base-modal.share-sheet-modal--narrow[data-size]) {
      width: min(38rem, calc(100vw - 8rem));
    }
  }

  @media (min-width: 3200px) {
    :global(dialog.base-modal.share-sheet-modal--narrow[data-size]) {
      width: min(44rem, calc(100vw - 10rem));
    }
  }

  /* Drawer's own skin, unchanged from when this was drawer-only: glass over the
     app, a hairline top edge, and a shadow that lifts it off the page. */
  :global(.share-sheet-drawer) {
    --sheet-bg: linear-gradient(
      180deg,
      color-mix(in srgb, var(--theme-surface, #14141c) 92%, transparent) 0%,
      color-mix(in srgb, var(--theme-surface, #14141c) 98%, transparent) 100%
    );
    --sheet-filter: blur(28px) saturate(160%);
    --sheet-shadow: 0 -1.5rem 4rem rgba(0, 0, 0, 0.55);
    --sheet-border-radius-top-left: 1.5rem;
    --sheet-border-radius-top-right: 1.5rem;
  }

  /* Drawer.css floors bottom sheets at 50dvh so a short one is not a sliver.
     This sheet is never short, so the floor only ever adds empty drawer under
     the content. Hug the sheet instead. */
  :global(.share-sheet-drawer.drawer-content[data-placement="bottom"]) {
    min-height: 0;
  }
</style>
