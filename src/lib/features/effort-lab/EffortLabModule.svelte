<!--
  EffortLabModule.svelte

  Effort Lab: explore movement quality through easing curves.
  Two tabs:
  - Efforts: 7 discrete effort qualities compared side by side
  - Laban: 2×2 matrix of Weight×Time compound actions from Laban Movement Analysis
-->
<script lang="ts">
  import EffortLabPlaybackHost from "./components/EffortLabPlaybackHost.svelte";
  import LabanTab from "./components/LabanTab.svelte";

  const TAB_KEY = "effort-lab-active-tab";

  function loadTab(): "efforts" | "laban" {
    try {
      const saved = localStorage.getItem(TAB_KEY);
      if (saved === "efforts" || saved === "laban") return saved;
    } catch { /* ignore */ }
    return "efforts";
  }

  let activeTab = $state(loadTab());

  $effect(() => {
    try { localStorage.setItem(TAB_KEY, activeTab); } catch { /* ignore */ }
  });
</script>

<div class="effort-lab">
  <header class="effort-lab-header">
    <h2 class="effort-lab-title">Effort Lab</h2>
    <span class="experiment-badge">Experimental</span>
    <nav class="tab-bar" role="tablist">
      <button
        class="tab"
        class:active={activeTab === "efforts"}
        role="tab"
        aria-selected={activeTab === "efforts"}
        onclick={() => (activeTab = "efforts")}
      >
        Efforts
      </button>
      <button
        class="tab"
        class:active={activeTab === "laban"}
        role="tab"
        aria-selected={activeTab === "laban"}
        onclick={() => (activeTab = "laban")}
      >
        Laban
      </button>
    </nav>
  </header>

  {#if activeTab === "efforts"}
    <EffortLabPlaybackHost />
  {:else}
    <LabanTab />
  {/if}
</div>

<style>
  .effort-lab {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
  }

  .effort-lab-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: var(--spacing-sm, 8px) var(--spacing-md, 16px);
    flex-shrink: 0;
  }

  .effort-lab-title {
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
    margin: 0;
  }

  .experiment-badge {
    font-size: var(--font-size-xs, 10px);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 2px 8px;
    border-radius: 4px;
    background: rgba(139, 92, 246, 0.2);
    color: #a78bfa;
    border: 1px solid rgba(139, 92, 246, 0.3);
  }

  .tab-bar {
    display: flex;
    gap: 2px;
    margin-left: auto;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 8px;
    padding: 2px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .tab {
    padding: 4px 14px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .tab:hover {
    color: var(--theme-text, #ffffff);
    background: rgba(255, 255, 255, 0.06);
  }

  .tab.active {
    color: var(--theme-text, #ffffff);
    background: rgba(139, 92, 246, 0.2);
    font-weight: 600;
  }
</style>
