<!--
Gallery Layout - 3-Button Navigation System

Provides responsive layout with clean 3-button interface:
- View Presets (All, Favorites, Easy, etc.)
- Sort & Jump (Sort method + Quick navigation)
- Advanced Filters
- Auto-hides on scroll
- Center panel for content (full width)
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  // ✅ PURE RUNES: Props using modern Svelte 5 runes
  const { centerPanel } = $props<{
    centerPanel: Snippet;
  }>();
</script>

<div class="gallery-layout">
  <!-- Main Content Area (Full Width) -->
  <div class="explore-content">
    <!-- Center Panel: Content -->
    <div class="center-panel">
      {@render centerPanel()}
    </div>
  </div>
</div>

<style>
  .gallery-layout {
    display: flex;
    flex-direction: column;
    flex: 1;
    height: 100%;
    overflow: hidden;
    background: transparent;
    color: white;
  }

  /* Main Content Area - Full width content */
  .explore-content {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  /* Center Panel - Content area (full width) */
  .center-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
    background: color-mix(in srgb, var(--theme-text, white) 1%, transparent);
  }

  /* Mobile-first responsive design */
  @media (max-width: 480px) {
    .gallery-layout {
      height: 100vh;
      height: 100dvh;
    }

    .center-panel {
      padding: 0;
    }
  }
</style>
