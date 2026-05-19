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
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&display=swap"
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
