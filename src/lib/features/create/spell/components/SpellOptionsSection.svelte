<!--
SpellOptionsSection.svelte - Collapsible advanced preferences container

Contains the advanced generation preferences (Minimize Reversals,
Continuous Flow, Motion Style) in a collapsed-by-default section.
Remembers expansion state in localStorage.
-->
<script lang="ts">
  import { browser } from "$app/environment";
  import type { Snippet } from "svelte";

  /**
   * SpellOptionsSection - Collapsible container for advanced preferences
   *
   * Features:
   * - Collapsed by default for progressive disclosure
   * - Smooth CSS Grid animation (0fr → 1fr)
   * - Persists expansion state in localStorage
   * - 48px touch-friendly header
   */

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();

  const STORAGE_KEY = "spell-options-expanded";

  // Load initial state from localStorage
  const getInitialState = (): boolean => {
    if (!browser) return false;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === "true";
    } catch {
      return false;
    }
  };

  let isExpanded = $state(getInitialState());

  // Persist expansion state
  $effect(() => {
    if (!browser) return;
    try {
      localStorage.setItem(STORAGE_KEY, String(isExpanded));
    } catch {
      // Ignore localStorage errors
    }
  });

  function toggle() {
    isExpanded = !isExpanded;
  }
</script>

<div class="options-section">
  <button
    class="options-header"
    onclick={toggle}
    aria-expanded={isExpanded}
    aria-controls="spell-options-content"
  >
    <span class="header-content">
      <i class="fa-solid fa-sliders" aria-hidden="true"></i>
      <span class="header-text">Options</span>
    </span>
    <i
      class="fa-solid fa-chevron-down expand-icon"
      class:rotated={isExpanded}
      aria-hidden="true"
    ></i>
  </button>

  <div
    id="spell-options-content"
    class="options-content"
    class:expanded={isExpanded}
  >
    <div class="options-inner">
      {@render children()}
    </div>
  </div>
</div>

<style>
  .options-section {
    border: 1px solid var(--theme-stroke);
    border-radius: 10px;
    background: var(--theme-card-bg);
    overflow: hidden;
  }

  .options-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    min-height: 48px;
    padding: 12px 16px;
    background: transparent;
    border: none;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .options-header:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text);
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-content i {
    font-size: var(--font-size-sm);
    opacity: 0.7;
  }

  .header-text {
    font-weight: 600;
  }

  .expand-icon {
    font-size: var(--font-size-compact);
    transition: transform var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1);
  }

  .expand-icon.rotated {
    transform: rotate(180deg);
  }

  /* Smooth expansion using CSS Grid */
  .options-content {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1);
  }

  .options-content.expanded {
    grid-template-rows: 1fr;
  }

  .options-inner {
    overflow: hidden;
    padding: 0 16px;
    transition: padding var(--duration-emphasis) cubic-bezier(0.4, 0, 0.2, 1);
  }

  .options-content.expanded .options-inner {
    padding: 0 16px 16px 16px;
  }

  /* Focus indicators for accessibility */
  .options-header:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: -2px;
  }
</style>
