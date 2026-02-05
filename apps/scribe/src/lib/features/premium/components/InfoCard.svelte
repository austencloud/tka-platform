<!--
  InfoCard - Simple card for displaying information sections
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    title?: string;
    children?: Snippet;
  }

  let { title, children }: Props = $props();
</script>

<div class="card">
  {#if title}
    <h2>{title}</h2>
  {/if}
  <div class="content">
    {#if children}
      {@render children()}
    {/if}
  </div>
</div>

<style>
  .card {
    background: var(--theme-card-bg);
    border: var(--glass-border, 1px solid var(--theme-stroke));
    border-radius: 12px;
    padding: var(--spacing-lg, 24px);
  }

  h2 {
    font-size: clamp(18px, 2.5vw, 22px);
    font-weight: 600;
    margin: 0 0 var(--spacing-md, 16px);
    color: var(--theme-text);
  }

  .content {
    font-size: var(--font-size-min);
    line-height: 1.7;
    color: var(--theme-text-dim);
  }

  .content :global(p) {
    margin: 0 0 var(--spacing-sm, 8px);
  }

  .content :global(p:last-child) {
    margin-bottom: 0;
  }
</style>
