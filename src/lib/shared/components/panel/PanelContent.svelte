<script lang="ts">
  /**
   * PanelContent - Scrollable content wrapper for panels
   *
   * Provides consistent padding and scroll behavior.
   */

  import type { Snippet } from "svelte";

  interface Props {
    /** Content to render */
    children: Snippet;
    /** Optional padding override */
    noPadding?: boolean;
  }

  let { children, noPadding = false }: Props = $props();
</script>

<div class="panel-content" class:panel-content--no-padding={noPadding}>
  {@render children()}
</div>

<style>
  .panel-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0 20px 20px;
    min-height: 0;
  }

  .panel-content--no-padding {
    padding: 0;
  }

  @media (max-width: 640px) {
    .panel-content {
      padding: 0 16px 16px;
    }

    .panel-content--no-padding {
      padding: 0;
    }
  }
</style>
