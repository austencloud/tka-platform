<!--
FilterChipBase.svelte - Shared base for all filter chips.
Renders an interactive chip with icon, label, optional count badge,
and dropdown arrow. Supports toggle and dropdown modes.
Popover uses fixed positioning to escape overflow:hidden containers.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte";

  interface Props {
    label: string;
    icon?: string;
    active?: boolean;
    count?: number | null;
    chipColor?: string;
    mode?: "toggle" | "dropdown";
    expanded?: boolean;
    disabled?: boolean;
    children?: Snippet;
    onclick?: () => void;
  }

  let {
    label,
    icon,
    active = false,
    count = null,
    chipColor = "var(--theme-accent)",
    mode = "dropdown",
    expanded = false,
    disabled = false,
    children,
    onclick,
  }: Props = $props();

  let chipEl: HTMLButtonElement | null = $state(null);
  let popoverTop = $state(0);
  let popoverLeft = $state(0);

  $effect(() => {
    if (expanded && chipEl) {
      const rect = chipEl.getBoundingClientRect();
      popoverTop = rect.bottom + 6;
      popoverLeft = rect.left;
    }
  });
</script>

<button
  class="filter-chip"
  class:active
  class:disabled
  class:expanded
  style="--chip-color: {chipColor};"
  type="button"
  role={mode === "toggle" ? "switch" : "button"}
  aria-pressed={mode === "toggle" ? active : undefined}
  aria-haspopup={mode === "dropdown" ? "listbox" : undefined}
  aria-expanded={mode === "dropdown" ? expanded : undefined}
  aria-label="{label}{count != null ? ` (${count})` : ''}"
  {disabled}
  {onclick}
  bind:this={chipEl}
>
  {#if icon}
    <i class={icon} aria-hidden="true"></i>
  {/if}

  <span class="chip-label">{label}</span>

  {#if count != null}
    <span class="chip-count">{count}</span>
  {/if}

  {#if mode === "dropdown"}
    <i class="fas fa-chevron-down chip-arrow" class:rotated={expanded} aria-hidden="true"></i>
  {/if}
</button>

{#if children && expanded}
  <div
    class="chip-popover"
    role="listbox"
    aria-label="{label} options"
    style="top: {popoverTop}px; left: {popoverLeft}px;"
  >
    {@render children()}
  </div>
{/if}

<style>
  .filter-chip {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 14px;
    min-height: var(--min-touch-target);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 100px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    white-space: nowrap;
    cursor: pointer;
    flex-shrink: 0;
    transition:
      background var(--duration-fast, 150ms) ease,
      border-color var(--duration-fast, 150ms) ease,
      color var(--duration-fast, 150ms) ease,
      transform var(--duration-fast, 150ms) ease;
  }

  .filter-chip.active {
    background: color-mix(in srgb, var(--chip-color) 15%, transparent);
    border-color: color-mix(in srgb, var(--chip-color) 40%, transparent);
    color: var(--theme-text);
  }

  .filter-chip.expanded {
    border-color: color-mix(in srgb, var(--chip-color) 50%, transparent);
    background: color-mix(in srgb, var(--chip-color) 20%, transparent);
  }

  .filter-chip.disabled {
    opacity: 0.4;
    cursor: not-allowed;
    pointer-events: none;
  }

  @media (hover: hover) {
    .filter-chip:not(.disabled):hover {
      background: color-mix(in srgb, var(--chip-color) 10%, transparent);
      border-color: color-mix(in srgb, var(--chip-color) 30%, transparent);
      color: var(--theme-text);
    }
  }

  .filter-chip:not(.disabled):active {
    transform: scale(0.97);
  }

  .filter-chip:focus-visible {
    outline: 2px solid var(--chip-color);
    outline-offset: 2px;
  }

  .filter-chip i:not(.chip-arrow) {
    font-size: var(--font-size-compact, 12px);
  }

  .chip-label {
    line-height: 1;
  }

  .chip-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    background: color-mix(in srgb, var(--chip-color) 25%, transparent);
    border-radius: 100px;
    font-size: 10px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--theme-text);
  }

  .chip-arrow {
    font-size: 8px;
    transition: transform var(--duration-fast, 150ms) ease;
    opacity: 0.6;
  }

  .chip-arrow.rotated {
    transform: rotate(180deg);
  }

  .chip-popover {
    position: fixed;
    z-index: var(--z-dropdown);
    min-width: 160px;
    padding: 4px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    box-shadow:
      0 4px 12px rgba(0, 0, 0, 0.3),
      0 1px 3px rgba(0, 0, 0, 0.2);
    animation: popoverIn var(--duration-fast, 150ms) cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes popoverIn {
    from {
      opacity: 0;
      transform: translateY(-4px) scale(0.97);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .filter-chip,
    .chip-arrow {
      transition: none;
    }
    .chip-popover {
      animation: none;
    }
  }
</style>
