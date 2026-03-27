<!--
  RetroModule.svelte — Top-level retro module with 3 tabs.

  Graduated from Lab. Contains:
  - TKA-OS: Win95 desktop parody
  - ASCII Pictograph: DOS terminal pictograph renderer
  - Pixel Pictograph: Win95 16-color dithered pictograph renderer
-->
<script lang="ts">
  const tabs = [
    { id: "desktop", label: "TKA-OS", icon: "fa-desktop" },
    { id: "ascii", label: "ASCII Pictograph", icon: "fa-terminal" },
    { id: "pixel", label: "Pixel Pictograph", icon: "fa-th" },
  ] as const;

  type TabId = (typeof tabs)[number]["id"];

  let activeTab = $state<TabId>("desktop");

  const tabComponents: Record<TabId, () => Promise<{ default: any }>> = {
    desktop: () => import("./win95/components/RetroLab.svelte"),
    ascii: () => import("./labs/AsciiPictographLab.svelte"),
    pixel: () => import("./labs/RetroPictographLab.svelte"),
  };

  let TabComponent = $state<any>(null);

  $effect(() => {
    const loader = tabComponents[activeTab];
    if (loader) {
      loader().then((mod) => {
        TabComponent = mod.default;
      });
    }
  });
</script>

<div class="retro-module">
  <div class="tab-bar">
    {#each tabs as tab}
      <button
        class="tab-btn"
        class:active={activeTab === tab.id}
        onclick={() => (activeTab = tab.id)}
      >
        <i class="fas {tab.icon}" aria-hidden="true"></i>
        <span>{tab.label}</span>
      </button>
    {/each}
  </div>

  <div class="tab-content">
    {#if TabComponent}
      <TabComponent />
    {/if}
  </div>
</div>

<style>
  .retro-module {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .tab-bar {
    display: flex;
    gap: 2px;
    padding: 0.5rem 0.75rem;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
  }

  .tab-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-sm, 0.875rem);
    cursor: pointer;
    min-height: 44px;
  }

  .tab-btn:hover {
    color: var(--theme-text, #fff);
    background: rgba(255, 255, 255, 0.06);
  }

  .tab-btn.active {
    color: #008080;
    background: rgba(0, 128, 128, 0.15);
    font-weight: 600;
  }

  .tab-content {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
</style>
