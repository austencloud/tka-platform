<!--
  TransformHelpCard.svelte

  A single card in the transform help sheet.
  Displays icon, name, description, and optional warning.
-->
<script lang="ts">
  import type { TransformHelpItem } from "../../domain/transforms/transform-help-content";
  import type { Snippet } from "svelte";

  interface Props {
    item: TransformHelpItem;
    children?: Snippet;
  }

  let { item, children }: Props = $props();
</script>

<div class="help-card" style="--help-color: {item.color}">
  <div class="help-card-header">
    <div class="help-card-icon" aria-hidden="true">
      <i class="fas {item.icon}" aria-hidden="true"></i>
    </div>
    <div class="help-card-text">
      <h4>{item.name}</h4>
      <p class="help-short">{item.shortDesc}</p>
    </div>
  </div>

  <p class="help-full">{item.fullDesc}</p>

  {#if item.warning}
    <p class="help-warning" role="alert">
      <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
      {item.warning}
    </p>
  {/if}

  {#if children}
    {@render children()}
  {/if}
</div>

<style>
  .help-card {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--help-color) 12%, transparent) 0%,
      color-mix(in srgb, var(--help-color) 5%, transparent) 100%
    );
    border: 1px solid color-mix(in srgb, var(--help-color) 25%, transparent);
    border-radius: 14px;
  }

  .help-card-header {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }

  .help-card-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: var(--help-color);
    border-radius: 10px;
    color: white;
    font-size: var(--font-size-base);
    flex-shrink: 0;
  }

  .help-card-text {
    flex: 1;
    min-width: 0;
  }

  .help-card-text h4 {
    margin: 0 0 2px;
    font-size: 1rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
  }

  .help-short {
    margin: 0;
    font-size: 0.85rem;
    color: var(--help-color);
    font-weight: 500;
  }

  .help-full {
    margin: 0;
    font-size: 0.8rem;
    color: var(--theme-text-dim);
    line-height: 1.45;
  }

  .help-warning {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.75rem;
    color: var(--semantic-warning);
    background: rgba(251, 191, 36, 0.1);
    padding: 6px 10px;
    border-radius: 6px;
    border: 1px solid rgba(251, 191, 36, 0.2);
  }

  .help-warning i {
    font-size: var(--font-size-compact);
  }
</style>
