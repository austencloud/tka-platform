<script lang="ts">
  import type { Snippet } from "svelte";
  import GuideNav from "./_components/GuideNav.svelte";
  import SiteFooter from "$lib/shared/landing/components/SiteFooter.svelte";
  import { setActiveSectionContext } from "./_data/guide-data-context";
  import "./_styles/guide.css";

  let { children }: { children: Snippet } = $props();

  let activeSectionId = $state("");
  let sidebarOpen = $state(false);

  setActiveSectionContext((id: string) => {
    activeSectionId = id;
  });

  function closeSidebar() {
    sidebarOpen = false;
  }
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300..800&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<div class="guide-layout">
  <button
    class="mobile-menu-btn"
    onclick={() => (sidebarOpen = !sidebarOpen)}
    aria-label="Toggle navigation"
  >
    ☰
  </button>

  <aside class="guide-sidebar" class:open={sidebarOpen}>
    <GuideNav bind:activeSectionId onSectionClick={closeSidebar} />
  </aside>

  <main class="guide-content">
    {@render children()}
    <!-- The guide subtree runs its own GuideNav chrome (no MarketingChrome),
         so it mounts the shared site footer itself — deep guide pages are top
         Google entry points and need a way back out to the rest of the site. -->
    <SiteFooter />
  </main>
</div>

<style>
  .mobile-menu-btn {
    display: none;
    position: fixed;
    top: 1rem;
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
