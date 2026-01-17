<script lang="ts">
  /**
   * PanelCard - Card component with hover states
   *
   * Uses theme-aware CSS variables for backgrounds and borders.
   */

  import type { Snippet } from "svelte";

  interface Props {
    /** Content to render */
    children: Snippet;
    /** Whether the card is interactive (clickable) */
    interactive?: boolean;
    /** Optional click handler */
    onclick?: () => void;
  }

  let { children, interactive = false, onclick }: Props = $props();
</script>

{#if interactive}
  <button class="panel-card panel-card--interactive" {onclick} type="button">
    {@render children()}
  </button>
{:else}
  <div class="panel-card">
    {@render children()}
  </div>
{/if}

<style>
  .panel-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    transition: all var(--duration-normal) ease;
    text-align: left;
    width: 100%;
  }

  .panel-card:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
  }

  .panel-card--interactive {
    cursor: pointer;
  }

  .panel-card--interactive:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px var(--theme-shadow);
  }

  .panel-card--interactive:active {
    transform: translateY(0);
  }

  @media (prefers-reduced-motion: reduce) {
    .panel-card {
      transition: none;
    }

    .panel-card--interactive:hover {
      transform: none;
    }
  }
</style>
