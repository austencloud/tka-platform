<!--
  LibrarySectionHeader.svelte

  Collapsible section header for grouping library sequences.
  Shows section title, count, and chevron indicator.
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { resolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import { onMount } from "svelte";

  interface Props {
    title: string;
    count: number;
    isExpanded: boolean;
    onToggle: () => void;
  }

  let { title, count, isExpanded, onToggle }: Props = $props();

  let hapticService: IHapticFeedback | null = $state(null);

  onMount(async () => {
    hapticService = await resolve<IHapticFeedback>(TYPES.IHapticFeedback);
  });

  function handleClick() {
    hapticService?.trigger("selection");
    onToggle();
  }
</script>

<button
  class="section-header"
  class:expanded={isExpanded}
  onclick={handleClick}
  aria-expanded={isExpanded}
>
  <div class="section-info">
    <span class="section-title">{title}</span>
    <span class="section-count">{count}</span>
  </div>
  <i
    class="fas fa-chevron-down chevron"
    class:rotated={isExpanded}
    aria-hidden="true"
  ></i>
</button>

<style>
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    background: color-mix(in srgb, var(--theme-accent) 5%, transparent);
    border: none;
    border-radius: var(--radius-2026-sm, 8px);
    cursor: pointer;
    transition: all 0.2s ease;
    margin-bottom: var(--spacing-xs);
  }

  .section-header:hover {
    background: color-mix(in srgb, var(--theme-accent) 10%, transparent);
  }

  .section-header.expanded {
    background: color-mix(in srgb, var(--theme-accent) 12%, transparent);
    margin-bottom: var(--spacing-sm);
  }

  .section-info {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .section-title {
    font-size: var(--font-size-base, 16px);
    font-weight: 600;
    color: var(--theme-text);
  }

  .section-count {
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    color: var(--theme-text-dim);
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
    padding: 2px 8px;
    border-radius: 999px;
  }

  .chevron {
    font-size: 0.8rem;
    color: var(--theme-text-dim);
    transition: transform 0.2s ease;
  }

  .chevron.rotated {
    transform: rotate(180deg);
  }

  /* Touch feedback */
  .section-header:active {
    transform: scale(0.99);
  }

  @media (prefers-reduced-motion: reduce) {
    .section-header,
    .chevron {
      transition: none;
    }
  }
</style>
