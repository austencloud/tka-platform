<!--
Gallery Layout - Browse Content Container

Provides responsive layout wrapper for the browse gallery content.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    centerPanel: Snippet;
  }

  const { centerPanel }: Props = $props();
</script>

<div class="gallery-layout">
  <!-- Main Content Area (Full Width) -->
  <div class="browse-content">
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
  .browse-content {
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
