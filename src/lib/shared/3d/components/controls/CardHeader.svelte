<script lang="ts">
  /**
   * CardHeader - Reusable card header with colored indicator and action button
   * Uses --theme-* and --prop-* CSS variables for consistent theming.
   */

  import type { Snippet } from "svelte";

  interface Props {
    /** Title text */
    title: string;
    /** Prop color for indicator */
    color?: "blue" | "red";
    /** Optional action button content */
    action?: Snippet;
  }

  let { title, color = "blue", action }: Props = $props();
</script>

<header
  class="card-header"
  class:blue={color === "blue"}
  class:red={color === "red"}
>
  <span class="color-dot"></span>
  <span class="title">{title}</span>
  {#if action}
    {@render action()}
  {/if}
</header>

<style>
  .card-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: var(--theme-panel-bg);
    border-bottom: 1px solid var(--theme-stroke);
  }

  .color-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .card-header.blue .color-dot {
    background: var(--prop-blue);
  }

  .card-header.red .color-dot {
    background: var(--prop-red);
  }

  .title {
    font-weight: 600;
    font-size: var(--font-size-sm, 0.875rem);
    color: var(--theme-text);
    flex: 1;
  }
</style>
