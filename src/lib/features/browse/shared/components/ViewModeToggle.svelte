<!--
  ViewModeToggle - Segmented controls for switching browse view mode.

  Two rows of toggle chips:
  1. Subject: Props / Hands (what layer to view)
  2. Granularity: Both / One (combined pair or single hand/prop)

  When granularity is "solo", a third row appears to pick which color (Blue / Red).
-->
<script lang="ts">
  import type { BrowseViewMode } from "../domain/BrowseViewMode";

  interface Props {
    viewMode: BrowseViewMode;
    onViewModeChange: (mode: BrowseViewMode) => void;
  }

  let { viewMode, onViewModeChange }: Props = $props();

  function setSubject(subject: BrowseViewMode["subject"]): void {
    if (subject === viewMode.subject) return;
    onViewModeChange({ ...viewMode, subject });
  }

  function setGranularity(granularity: BrowseViewMode["granularity"]): void {
    if (granularity === viewMode.granularity) return;
    onViewModeChange({ ...viewMode, granularity });
  }

  function setColor(color: BrowseViewMode["color"]): void {
    if (color === viewMode.color) return;
    onViewModeChange({ ...viewMode, color });
  }
</script>

<div class="view-mode-toggle" role="toolbar" aria-label="View mode">
  <!-- Subject toggle: Props / Hands -->
  <div class="toggle-group" role="radiogroup" aria-label="Subject">
    <button
      class="toggle-chip"
      class:active={viewMode.subject === "props"}
      role="radio"
      aria-checked={viewMode.subject === "props"}
      onclick={() => setSubject("props")}
    >
      Props
    </button>
    <button
      class="toggle-chip"
      class:active={viewMode.subject === "hands"}
      role="radio"
      aria-checked={viewMode.subject === "hands"}
      onclick={() => setSubject("hands")}
    >
      Hands
    </button>
  </div>

  <!-- Granularity toggle: Both / One -->
  <div class="toggle-group" role="radiogroup" aria-label="Granularity">
    <button
      class="toggle-chip"
      class:active={viewMode.granularity === "combined"}
      role="radio"
      aria-checked={viewMode.granularity === "combined"}
      onclick={() => setGranularity("combined")}
    >
      Both
    </button>
    <button
      class="toggle-chip"
      class:active={viewMode.granularity === "solo"}
      role="radio"
      aria-checked={viewMode.granularity === "solo"}
      onclick={() => setGranularity("solo")}
    >
      One
    </button>
  </div>

  <!-- Color toggle: Blue / Red (only when solo mode) -->
  {#if viewMode.granularity === "solo"}
    <div class="toggle-group" role="radiogroup" aria-label="Color">
      <button
        class="toggle-chip color-chip blue-chip"
        class:active={viewMode.color === "blue"}
        role="radio"
        aria-checked={viewMode.color === "blue"}
        onclick={() => setColor("blue")}
      >
        Blue
      </button>
      <button
        class="toggle-chip color-chip red-chip"
        class:active={viewMode.color === "red"}
        role="radio"
        aria-checked={viewMode.color === "red"}
        onclick={() => setColor("red")}
      >
        Red
      </button>
    </div>
  {/if}
</div>

<style>
  .view-mode-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    flex-wrap: wrap;
  }

  .toggle-group {
    display: flex;
    gap: 2px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    padding: 2px;
  }

  .toggle-chip {
    min-height: var(--min-touch-target, 44px);
    min-width: var(--min-touch-target, 44px);
    padding: 6px 14px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .toggle-chip:hover {
    background: var(--theme-accent-subtle, rgba(99, 102, 241, 0.08));
    color: var(--theme-text, #fff);
  }

  .toggle-chip.active {
    background: var(--theme-accent-subtle, rgba(99, 102, 241, 0.12));
    color: var(--theme-accent, #6366f1);
  }

  /* Color chips use prop colors for their active state */
  .color-chip.blue-chip.active {
    background: color-mix(in srgb, var(--prop-blue, #2e8bf0) 20%, transparent);
    color: var(--prop-blue, #2e8bf0);
  }

  .color-chip.red-chip.active {
    background: color-mix(in srgb, var(--prop-red, #ed1c24) 20%, transparent);
    color: var(--prop-red, #ed1c24);
  }

  /* Focus indicators */
  .toggle-chip:focus-visible {
    outline: 2px solid var(--theme-text, #ffffff);
    outline-offset: 2px;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .toggle-chip {
      transition: none;
    }
  }
</style>
