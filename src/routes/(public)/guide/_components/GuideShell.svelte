<script lang="ts">
  /**
   * The one guide shell every host renders: the site header, mobile menu
   * button, the sidebar aside (hosting GuideSidebar directly - no more
   * per-level GuideNav wrappers, they added nothing once GuideSidebar became
   * the single TOC source), and the content column with the shared site
   * footer. Level 1, Level 2, and the guide hub all mount THIS component so
   * the chrome is identical by construction instead of three copies drifting
   * apart. See docs/superpowers/specs/2026-07-16-unified-guide-shell-design.md
   * (G2).
   *
   * SiteHeader is mounted directly (not via MarketingChrome - that also
   * brings the cosmic background + view-transition machinery this shell
   * doesn't want). Because no MarketingChrome runs on the guide subtree,
   * nothing seeds the --theme-* / --semantic-* vars SiteHeader's descendants
   * (RobustAvatar) read - so this shell runs the theme pipeline itself,
   * browser-only, same precedent as the /q standalone host
   * (.claude/rules/sequence-viewer-shell.md).
   *
   * Callers keep their own `<svelte:head>` font/preconnect blocks and their
   * own `setActiveSectionContext` wiring - that's route-specific, not shell
   * chrome - and pass the resulting `activeSectionId` in here so the sidebar
   * can highlight the in-view Level 2 section.
   */
  import type { Snippet } from "svelte";
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import GuideSidebar from "./GuideSidebar.svelte";
  import SiteHeader from "$lib/shared/landing/components/SiteHeader.svelte";
  import SiteFooter from "$lib/shared/landing/components/SiteFooter.svelte";
  import "../level-1/_styles/guide.css";

  let {
    activeSectionId = $bindable(""),
    children,
  }: {
    activeSectionId?: string;
    children: Snippet;
  } = $props();

  let sidebarOpen = $state(false);

  function closeSidebar() {
    sidebarOpen = false;
  }

  onMount(() => {
    if (!browser) return;
    void (async () => {
      const { applyThemeForBackground } = await import(
        "$lib/shared/settings/utils/background-theme-calculator"
      );
      const { BackgroundType } = await import("@austencloud/backgrounds");
      applyThemeForBackground(BackgroundType.COSMIC);
    })();
  });
</script>

<SiteHeader />

<div class="guide-layout">
  <button
    class="mobile-menu-btn"
    onclick={() => (sidebarOpen = !sidebarOpen)}
    aria-label="Toggle navigation"
  >
    ☰
  </button>

  <aside class="guide-sidebar" class:open={sidebarOpen}>
    <GuideSidebar {activeSectionId} onLinkClick={closeSidebar} />
  </aside>

  <main class="guide-content">
    {@render children()}
  </main>
</div>

<!-- The guide subtree runs its own chrome (SiteHeader above, no
     MarketingChrome), so it mounts the shared site footer itself - deep
     guide pages are top Google entry points and need a way back out to the
     rest of the site. Below .guide-layout (not inside .guide-content): the
     >=1680px tier centers the sidebar+content composition, and a footer
     inside that flex pair paints its background as an island ending at the
     composition edge. Out here it bleeds full-width; its own .inner caps
     the content (widened to the composition width in guide.css). The bleed
     wrapper (styled in guide.css) continues the guide navy behind the
     footer's translucent gradient. -->
<div class="guide-footer-bleed">
  <SiteFooter />
</div>

<style>
  /* SiteHeader is a fixed 64px bar (56px once scrolled) that doesn't push
     document flow - the sidebar/menu-button below clear it explicitly
     instead of relying on layout push. */
  .mobile-menu-btn {
    display: none;
    position: fixed;
    top: calc(64px + 1rem);
    left: 1rem;
    z-index: 60;
    font-size: 1.5rem;
    background: oklch(0.18 0.02 270 / 0.8);
    backdrop-filter: blur(12px);
    border: 1px solid oklch(0.30 0.04 270 / 0.3);
    border-radius: 10px;
    padding: 0.25rem 0.5rem;
    cursor: pointer;
    min-width: 44px;
    min-height: 44px;
    color: oklch(0.80 0.04 270);
  }

  @media (max-width: 768px) {
    .mobile-menu-btn {
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }
</style>
