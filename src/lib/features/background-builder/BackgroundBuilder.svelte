<script lang="ts">
  import FishGallery from "./components/FishGallery.svelte";

  type TabId = "fish" | "jellyfish" | "bubbles" | "light-rays" | "gradient";

  interface Tab {
    id: TabId;
    label: string;
    icon: string;
  }

  const tabs: Tab[] = [
    { id: "fish", label: "Fish", icon: "fa-fish" },
    { id: "jellyfish", label: "Jellyfish", icon: "fa-disease" },
    { id: "bubbles", label: "Bubbles", icon: "fa-circle" },
    { id: "light-rays", label: "Light Rays", icon: "fa-sun" },
    { id: "gradient", label: "Gradient", icon: "fa-fill-drip" },
  ];

  let activeTab: TabId = $state("fish");
</script>

<div class="background-builder">
  <header>
    <h1>Background Builder</h1>
    <p>Design and iterate on deep ocean background elements</p>
  </header>

  <nav class="tabs">
    {#each tabs as tab}
      <button
        class="tab"
        class:active={activeTab === tab.id}
        onclick={() => (activeTab = tab.id)}
      >
        <i class="fas {tab.icon}"></i>
        {tab.label}
      </button>
    {/each}
  </nav>

  <main class="content">
    {#if activeTab === "fish"}
      <FishGallery />
    {:else if activeTab === "jellyfish"}
      <div class="placeholder">
        <i class="fas fa-disease"></i>
        <p>Jellyfish Gallery - Coming Soon</p>
      </div>
    {:else if activeTab === "bubbles"}
      <div class="placeholder">
        <i class="fas fa-circle"></i>
        <p>Bubble Gallery - Coming Soon</p>
      </div>
    {:else if activeTab === "light-rays"}
      <div class="placeholder">
        <i class="fas fa-sun"></i>
        <p>Light Ray Gallery - Coming Soon</p>
      </div>
    {:else if activeTab === "gradient"}
      <div class="placeholder">
        <i class="fas fa-fill-drip"></i>
        <p>Gradient Gallery - Coming Soon</p>
      </div>
    {/if}
  </main>
</div>

<style>
  .background-builder {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #0a1628;
    color: #ffffff;
  }

  header {
    padding: 20px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  header h1 {
    margin: 0 0 4px 0;
    font-size: 1.5rem;
    font-weight: 600;
  }

  header p {
    margin: 0;
    color: #8899aa;
    font-size: 0.875rem;
  }

  .tabs {
    display: flex;
    gap: 4px;
    padding: 12px 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    overflow-x: auto;
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    color: #8899aa;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .tab:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #ffffff;
  }

  .tab.active {
    background: rgba(125, 211, 252, 0.15);
    border-color: rgba(125, 211, 252, 0.3);
    color: #7dd3fc;
  }

  .tab i {
    font-size: 1rem;
  }

  .content {
    flex: 1;
    overflow: auto;
    padding: 24px;
  }

  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 400px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px dashed rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    color: #556677;
  }

  .placeholder i {
    font-size: 3rem;
    margin-bottom: 16px;
    opacity: 0.5;
  }

  .placeholder p {
    font-size: 1rem;
  }
</style>
