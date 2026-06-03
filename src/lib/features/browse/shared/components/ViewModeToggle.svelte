<!--
  ViewModeToggle - Segmented controls for switching browse view mode.

  Two control groups:
  1. Subject: Props / Hands (what layer to view)
  2. Left/Right color chips (which motion(s) to show)

  The color chips map to BrowseViewMode's granularity + color fields:
  - Both active  -> granularity: "combined"
  - One active   -> granularity: "solo", color: active chip's color
  - Last deactivated -> reactivate both (combined)
-->
<script lang="ts">
  import type { BrowseViewMode } from "$lib/shared/browse/domain/browse-view-mode";
  import MotionColorChips from "$lib/shared/components/MotionColorChips.svelte";

  interface Props {
    viewMode: BrowseViewMode;
    onViewModeChange: (mode: BrowseViewMode) => void;
  }

  let { viewMode, onViewModeChange }: Props = $props();

  const showBlue = $derived(
    viewMode.granularity === "combined" || viewMode.color === "blue"
  );
  const showRed = $derived(
    viewMode.granularity === "combined" || viewMode.color === "red"
  );

  function setSubject(subject: BrowseViewMode["subject"]): void {
    if (subject === viewMode.subject) return;
    onViewModeChange({ ...viewMode, subject });
  }

  function toggleBlue(): void {
    if (showBlue && showRed) {
      // Both on → isolate blue (hide red)
      onViewModeChange({ ...viewMode, granularity: "solo", color: "blue" });
    } else {
      // Blue is either the solo one or the inactive one → show both
      onViewModeChange({ ...viewMode, granularity: "combined", color: "blue" });
    }
  }

  function toggleRed(): void {
    if (showBlue && showRed) {
      // Both on → isolate red (hide blue)
      onViewModeChange({ ...viewMode, granularity: "solo", color: "red" });
    } else {
      // Red is either the solo one or the inactive one → show both
      onViewModeChange({ ...viewMode, granularity: "combined", color: "blue" });
    }
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

  <!-- Left/Right color chips -->
  <MotionColorChips
    {showBlue}
    {showRed}
    onToggleBlue={toggleBlue}
    onToggleRed={toggleRed}
  />
</div>

<style>
  .view-mode-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: nowrap;
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
    min-height: 32px;
    padding: 4px 12px;
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

  .toggle-chip:focus-visible {
    outline: 2px solid var(--theme-text, #ffffff);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .toggle-chip {
      transition: none;
    }
  }
</style>
