<!--
  FlameLabModule.svelte

  Dedicated lab for developing and tuning the WebGL fire shader overlay.
  Tab shell: "Tuning" for physics/playback, "Fire Points" for visual placement editor.
-->
<script lang="ts">
  import FlameLabTuningTab from "./components/FlameLabTuningTab.svelte";
  import FirePointEditorTab from "./components/FirePointEditorTab.svelte";

  const TAB_STORAGE_KEY = "flame-lab-active-tab";
  type FlameLabTab = "tuning" | "fire-points";

  function loadTab(): FlameLabTab {
    try {
      const raw = sessionStorage.getItem(TAB_STORAGE_KEY);
      if (raw === "tuning" || raw === "fire-points") return raw;
    } catch { /* ignore */ }
    return "tuning";
  }

  let activeTab = $state<FlameLabTab>(loadTab());

  function setTab(tab: FlameLabTab) {
    activeTab = tab;
    try { sessionStorage.setItem(TAB_STORAGE_KEY, tab); } catch { /* ignore */ }
  }
</script>

<div class="flame-lab">
  <header class="header">
    <div class="title-row">
      <h1>
        <i class="fas fa-fire" aria-hidden="true"></i>
        Flame Lab
      </h1>
      <span class="badge">Experimental</span>
    </div>
    <div class="tab-bar" role="tablist">
      <button
        role="tab"
        class="tab"
        class:active={activeTab === "tuning"}
        aria-selected={activeTab === "tuning"}
        aria-label="Tuning tab — physics and playback controls"
        onclick={() => setTab("tuning")}
      >
        <i class="fas fa-sliders-h" aria-hidden="true"></i>
        Tuning
      </button>
      <button
        role="tab"
        class="tab"
        class:active={activeTab === "fire-points"}
        aria-selected={activeTab === "fire-points"}
        aria-label="Fire Points tab — visual placement editor"
        onclick={() => setTab("fire-points")}
      >
        <i class="fas fa-crosshairs" aria-hidden="true"></i>
        Fire Points
      </button>
    </div>
  </header>

  <div class="tab-content" role="tabpanel">
    {#if activeTab === "tuning"}
      <FlameLabTuningTab />
    {:else}
      <FirePointEditorTab />
    {/if}
  </div>
</div>

<style>
  .flame-lab {
    /* Flame Lab domain color tokens */
    --flame-orange: #f97316;
    --flame-orange-mid: rgba(249, 115, 22, 0.15);
    --flame-orange-border: rgba(249, 115, 22, 0.3);

    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
  }

  .header {
    flex-shrink: 0;
    padding: var(--spacing-md, 16px) var(--spacing-lg, 24px) 0;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .title-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm, 8px);
    margin-bottom: var(--spacing-sm, 8px);
  }

  .title-row h1 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--theme-text, white);
    display: flex;
    align-items: center;
    gap: var(--spacing-xs, 4px);
  }

  .title-row h1 i {
    color: var(--flame-orange, #f97316);
  }

  .badge {
    padding: 2px 8px;
    border-radius: 9999px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    background: var(--flame-orange-mid, rgba(249, 115, 22, 0.15));
    color: var(--flame-orange, #f97316);
    border: 1px solid var(--flame-orange-border, rgba(249, 115, 22, 0.3));
  }

  .tab-bar {
    display: flex;
    gap: var(--spacing-xs, 4px);
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 10px 20px;
    border: none;
    border-bottom: 2px solid transparent;
    background: none;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: color 150ms ease, border-color 150ms ease;
  }

  .tab:hover {
    color: var(--theme-text, white);
  }

  .tab.active {
    color: var(--flame-orange, #f97316);
    border-bottom-color: var(--flame-orange, #f97316);
  }

  .tab:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: -2px;
  }

  .tab-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  @media (prefers-reduced-motion: reduce) {
    .tab {
      transition: none;
    }
  }
</style>
