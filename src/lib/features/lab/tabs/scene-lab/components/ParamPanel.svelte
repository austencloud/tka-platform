<script lang="ts">
  /**
   * ParamPanel
   *
   * Collapsible section wrapper for a group of scene params.
   */

  import { untrack, type Snippet } from "svelte";

  interface Props {
    title: string;
    defaultOpen?: boolean;
    children: Snippet;
  }

  let { title, defaultOpen = true, children }: Props = $props();

  let open = $state(untrack(() => defaultOpen));
</script>

<div class="param-panel" class:open>
  <button class="panel-header" onclick={() => (open = !open)}>
    <span class="chevron" class:rotated={open}>▸</span>
    <span class="title">{title}</span>
  </button>
  {#if open}
    <div class="panel-body">
      {@render children()}
    </div>
  {/if}
</div>

<style>
  .param-panel {
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
  }

  .panel-header {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 10px 0;
    background: none;
    border: none;
    color: var(--theme-text, white);
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    text-align: left;
  }

  .panel-header:hover .title {
    color: var(--theme-accent, #38bdf8);
  }

  .chevron {
    display: inline-block;
    font-size: 10px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    transition: transform 150ms ease;
  }

  .chevron.rotated {
    transform: rotate(90deg);
  }

  .title {
    flex: 1;
    transition: color 150ms ease;
  }

  .panel-body {
    padding: 4px 0 12px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
</style>
