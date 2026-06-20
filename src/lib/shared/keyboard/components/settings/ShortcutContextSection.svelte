<!--
  ShortcutContextSection.svelte

  Collapsible section grouping shortcuts by WHERE they work (context).
  Clean accordion with minimal visual noise.
-->
<script lang="ts">
  import { slide } from "svelte/transition";
  import ShortcutRow from "./ShortcutRow.svelte";
  import type { ShortcutWithBinding } from "../../services/types";
  import type { ShortcutContext } from "../../domain/types/keyboard-types";

  let {
    context,
    label,
    icon,
    shortcuts,
    isExpanded = $bindable(false),
    onEditShortcut = () => {},
    onResetShortcut = () => {},
  }: {
    context: ShortcutContext | "all";
    label: string;
    icon: string;
    shortcuts: ShortcutWithBinding[];
    isExpanded?: boolean;
    onEditShortcut?: (item: ShortcutWithBinding) => void;
    onResetShortcut?: (item: ShortcutWithBinding) => void;
  } = $props();

  const customizedCount = $derived(
    shortcuts.filter((s) => s.isCustomized).length
  );

  function toggle() {
    isExpanded = !isExpanded;
  }
</script>

<section class="context-section">
  <button
    type="button"
    class="section-header"
    class:expanded={isExpanded}
    onclick={toggle}
    aria-expanded={isExpanded}
    aria-controls="shortcut-section-content-{context}"
  >
    <i class="fas {icon} section-icon" aria-hidden="true"></i>
    <span class="section-label">{label}</span>

    <div class="section-meta">
      {#if customizedCount > 0}
        <span class="custom-count">{customizedCount} custom</span>
      {/if}
      <span class="count">{shortcuts.length}</span>
    </div>

    <i class="fas fa-chevron-right chevron" aria-hidden="true"></i>
  </button>

  {#if isExpanded}
    <div
      id="shortcut-section-content-{context}"
      class="section-content"
      transition:slide={{ duration: 150 }}
    >
      {#each shortcuts as item (item.shortcut.id)}
        <ShortcutRow {item} onEdit={onEditShortcut} onReset={onResetShortcut} />
      {/each}
    </div>
  {/if}
</section>

<style>
  .context-section {
    border-radius: 16px;
    overflow: hidden;
    background: var(
      --theme-panel-bg,
      color-mix(in srgb, var(--theme-shadow, #000) 40%, transparent)
    );
    backdrop-filter: blur(16px);
    border: 1px solid var(--theme-stroke);
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 16px 20px;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background var(--duration-fast) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .section-header:hover {
    background: var(
      --theme-card-bg,
      color-mix(in srgb, var(--theme-text, #fff) 4%, transparent)
    );
  }

  .section-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    font-size: var(--font-size-sm);
    color: var(--theme-accent);
    background: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent-strong)) 12%,
      transparent
    );
    border: 1px solid
      color-mix(
        in srgb,
        var(--theme-accent, var(--theme-accent-strong)) 25%,
        transparent
      );
    border-radius: 10px;
  }

  .section-label {
    flex: 1;
    font-size: var(--font-size-base);
    font-weight: 600;
    color: var(--theme-text);
  }

  .section-meta {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .custom-count {
    font-size: var(--font-size-compact);
    font-weight: 600;
    text-transform: uppercase;
    padding: 4px 10px;
    border-radius: 6px;
    background: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent-strong)) 18%,
      transparent
    );
    color: var(--theme-accent);
  }

  .count {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 28px;
    height: 28px;
    padding: 0 8px;
    font-size: var(--font-size-compact);
    font-weight: 600;
    color: var(--theme-text-dim, var(--theme-text-dim));
    background: var(
      --theme-card-bg,
      color-mix(in srgb, var(--theme-text, #fff) 6%, transparent)
    );
    border-radius: 6px;
    font-variant-numeric: tabular-nums;
  }

  .chevron {
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim);
    transition: transform var(--duration-normal) ease;
  }

  .section-header.expanded .chevron {
    transform: rotate(90deg);
  }

  .section-content {
    padding: 10px 12px 14px;
    display: grid;
    grid-template-columns: 1fr;
    gap: 6px;
    border-top: 1px solid
      var(
        --theme-stroke,
        color-mix(in srgb, var(--theme-text, #fff) 6%, transparent)
      );
  }

  /* Two columns on wider screens */
  @media (min-width: 700px) {
    .section-content {
      grid-template-columns: 1fr 1fr;
      gap: 6px 20px;
    }
  }

  /* Focus state */
  .section-header:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: -2px;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .chevron {
      transition: none;
    }
  }
</style>
