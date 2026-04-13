<script lang="ts">
  /**
   * ChoreoCardGearPopover
   *
   * Gear icon + tabbed popover for the 2D choreo card viewer.
   * Three tabs: Display (motion/grid/points), Glyphs (notation
   * overlays), Layout (column count + card settings).
   * Replaces the old right-click context menu.
   */

  import { scale } from "svelte/transition";
  import { cubicOut, backOut } from "svelte/easing";
  import ChoreoCardDisplayToggles from "./ChoreoCardDisplayToggles.svelte";
  import ChoreoCardGlyphToggles from "./ChoreoCardGlyphToggles.svelte";
  import ChoreoCardLayoutPanel from "./ChoreoCardLayoutPanel.svelte";

  interface Props {
    stepCount: number;
    onOpenSettings: () => void;
  }

  let { stepCount, onOpenSettings }: Props = $props();

  type TabId = "display" | "glyphs" | "layout";

  const TABS: { id: TabId; label: string }[] = [
    { id: "display", label: "Display" },
    { id: "glyphs", label: "Glyphs" },
    { id: "layout", label: "Layout" },
  ];

  let open = $state(false);
  let activeTab = $state<TabId>("display");
  let rootEl = $state<HTMLDivElement | null>(null);

  function togglePopover(e: MouseEvent) {
    e.stopPropagation();
    open = !open;
  }

  function selectTab(e: MouseEvent, id: TabId) {
    e.stopPropagation();
    activeTab = id;
  }

  // Close on outside click
  function handleWindowClick(e: MouseEvent) {
    if (open && rootEl && !rootEl.contains(e.target as Node)) {
      open = false;
    }
  }
</script>

<svelte:window onclick={handleWindowClick} />

<div class="gear-root" bind:this={rootEl}>
  <button
    class="gear-button"
    class:open
    onclick={togglePopover}
    aria-label="Viewer settings"
    aria-expanded={open}
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  </button>

  {#if open}
    <div
      class="popover"
      role="dialog"
      aria-label="Viewer settings"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => { if (e.key === 'Escape') open = false; }}
      in:scale={{ duration: 250, start: 0.9, opacity: 0, easing: backOut }}
      out:scale={{ duration: 180, start: 0.95, opacity: 0, easing: cubicOut }}
    >
      <!-- Tab bar -->
      <div class="tab-bar" role="tablist">
        {#each TABS as tab}
          <button
            class="tab-btn"
            class:active={activeTab === tab.id}
            onclick={(e) => selectTab(e, tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
          >
            {tab.label}
          </button>
        {/each}
      </div>

      <!-- Display tab -->
      {#if activeTab === "display"}
        <div class="tab-panel" role="tabpanel">
          <ChoreoCardDisplayToggles />
        </div>
      {/if}

      <!-- Glyphs tab -->
      {#if activeTab === "glyphs"}
        <div class="tab-panel" role="tabpanel">
          <ChoreoCardGlyphToggles />
        </div>
      {/if}

      <!-- Layout tab -->
      {#if activeTab === "layout"}
        <div class="tab-panel" role="tabpanel">
          <ChoreoCardLayoutPanel {stepCount} {onOpenSettings} />
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .gear-root {
    position: relative;
  }

  .gear-button {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(0, 0, 0, 0.4);
    color: rgba(255, 255, 255, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    backdrop-filter: blur(8px);
  }

  .gear-button:hover,
  .gear-button.open {
    background: rgba(0, 0, 0, 0.6);
    border-color: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.9);
  }

  .popover {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    min-width: 240px;
    max-width: 320px;
    background: rgba(18, 18, 28, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    backdrop-filter: blur(16px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    z-index: 50;
    overflow: hidden;
  }

  .tab-bar {
    display: flex;
    gap: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    overflow-x: auto;
    scrollbar-width: none;
  }

  .tab-bar::-webkit-scrollbar {
    display: none;
  }

  .tab-btn {
    flex: 0 0 auto;
    padding: 8px 14px;
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.4);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: color 0.15s ease;
    white-space: nowrap;
  }

  .tab-btn:hover {
    color: rgba(255, 255, 255, 0.7);
  }

  .tab-btn.active {
    color: rgba(255, 255, 255, 0.95);
    box-shadow: inset 0 -2px 0 #8b8bff;
  }

  .tab-panel {
    padding: 12px;
  }
</style>
