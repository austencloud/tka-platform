<!--
  ScanViewerHeader.svelte

  Header for the /q/[code] QR scan landing page. Mirrors the real /sequence
  viewer's "Sequence Viewer" header (RouteViewerHeader) but carries the guest
  funnel actions — Open in Composer, Open TKA, Download — instead of the
  auth/save/publish actions. Follows RouteViewerHeader's grid pattern and reuses
  ViewerOverflowMenu for the title-triggered menu.

  Desktop / landscape: right cluster = [Open in Composer] + [Open TKA]; title
  menu holds Download. Portrait: right cluster empty; title menu holds Open in
  Composer · Download · Open TKA. The centered title is always the menu trigger,
  matching the app.
-->
<script lang="ts">
  import ViewerOverflowMenu from "./ViewerOverflowMenu.svelte";

  interface Props {
    isMobile: boolean;
    onOpenInComposer: () => void;
    openTkaHref: string;
    onDownload: () => void;
    downloadBusy?: boolean;
  }

  let {
    isMobile,
    onOpenInComposer,
    openTkaHref,
    onDownload,
    downloadBusy = false,
  }: Props = $props();
</script>

<header class="scan-header" class:mobile={isMobile}>
  {#if isMobile}
    <div class="swipe-handle" aria-hidden="true"></div>
  {/if}

  <div class="header-left"></div>

  {#snippet titleTrigger({ isOpen, hasMenu }: { isOpen: boolean; hasMenu: boolean })}
    <span class="sequence-title">Sequence Viewer</span>
    {#if hasMenu}
      <i class="fas fa-chevron-down title-caret" class:open={isOpen} aria-hidden="true"></i>
    {/if}
  {/snippet}

  <div class="header-center">
    {#if isMobile}
      <ViewerOverflowMenu
        trigger={titleTrigger}
        dropDown
        align="center"
        variant="header"
        onRemix={onOpenInComposer}
        remixLabel="Open in Composer"
        onDownload={onDownload}
        {downloadBusy}
        onOpenApp={() => { location.href = openTkaHref; }}
      />
    {:else}
      <ViewerOverflowMenu
        trigger={titleTrigger}
        dropDown
        align="center"
        variant="header"
        onDownload={onDownload}
        {downloadBusy}
      />
    {/if}
  </div>

  <div class="header-right">
    {#if !isMobile}
      <button type="button" class="cta accent" onclick={onOpenInComposer}>
        <i class="fas fa-pen" aria-hidden="true"></i>
        <span>Open in Composer</span>
      </button>
      <a class="cta ghost" href={openTkaHref}>
        <i class="fas fa-compass" aria-hidden="true"></i>
        <span>Open TKA</span>
      </a>
    {/if}
  </div>
</header>

<style>
  .scan-header {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    padding: 12px 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
    position: relative;
    z-index: 20;
  }

  .scan-header.mobile {
    padding-top: 16px;
    touch-action: pan-y;
  }

  .swipe-handle {
    position: absolute;
    top: 6px;
    left: 50%;
    transform: translateX(-50%);
    width: 40px;
    height: 4px;
    background: rgba(255, 255, 255, 0.3);
    border-radius: 2px;
  }

  .header-left {
    justify-self: start;
  }

  .header-center {
    display: flex;
    justify-content: center;
  }

  .header-right {
    justify-self: end;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .sequence-title {
    margin: 0;
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
    color: var(--theme-text, #fff);
    white-space: nowrap;
  }

  .scan-header.mobile .sequence-title {
    font-size: var(--font-size-min, 14px);
  }

  .title-caret {
    font-size: 11px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    transition: transform 180ms ease;
    margin-left: 6px;
    flex-shrink: 0;
  }

  .title-caret.open {
    transform: rotate(180deg);
  }

  .cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: var(--min-touch-target, 44px);
    padding: 0 16px;
    border-radius: 8px;
    font-weight: 600;
    font-size: var(--font-size-min, 14px);
    cursor: pointer;
    text-decoration: none;
    border: none;
    white-space: nowrap;
  }

  .cta.accent {
    background: var(--theme-accent, #6366f1);
    color: #fff;
  }

  .cta.ghost {
    background: rgba(18, 18, 28, 0.85);
    border: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.18));
    color: var(--theme-text, #fff);
  }

  .cta:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .title-caret {
      transition: none;
    }
  }
</style>
