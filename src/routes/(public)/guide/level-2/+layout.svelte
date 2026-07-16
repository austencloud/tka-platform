<script lang="ts">
  import type { Snippet } from "svelte";
  import GuideNav from "./GuideNav.svelte";
  import { setActiveSectionContext } from "../level-1/_data/guide-data-context";
  import "./_styles/guide.css";

  let { children }: { children: Snippet } = $props();

  let activeSectionId = $state("");
  let sidebarOpen = $state(false);

  setActiveSectionContext((id: string) => {
    activeSectionId = id;
  });
</script>

<svelte:head>
  <!-- Preconnects serve the fonts guide.css @imports (Cormorant/Tangerine).
       The Playfair stylesheet that used to load here was never referenced by
       any level-2 rule (guide.css applies Inter/Cormorant) — removed. -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
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
    <GuideNav bind:activeSectionId />
  </aside>

  <main class="guide-content">
    {@render children()}
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
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 0.25rem 0.5rem;
    cursor: pointer;
  }

  @media (max-width: 768px) {
    .mobile-menu-btn {
      display: block;
    }
  }
</style>
