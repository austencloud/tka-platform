<!--
  Tab Persistence Example

  This shows you how to implement tab persistence in your actual TKA Scribe app.
  This is the FIRST thing you should implement - it's simple and immediately useful.
-->

<script lang="ts">
  import type { TabId } from "../../navigation/domain/types";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";

  // ============================================================================
  // SERVICE INJECTION
  // ============================================================================

  const persistenceService = container.items.persistenceService;

  // ============================================================================
  // REACTIVE STATE
  // ============================================================================

  let currentTab = $state<TabId>("construct"); // Default tab
  let status = $state("Initializing...");

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  onMount(async () => {
    try {
      // Initialize persistence
      await persistenceService.initialize();

      // Restore the last active tab
      const savedTab = await persistenceService.getActiveTab();
      if (savedTab) {
        currentTab = savedTab;
        status = `Restored tab: ${savedTab}`;
      } else {
        status = "No saved tab found, using default";
      }
    } catch (error) {
      console.error("Failed to initialize tab persistence:", error);
      status = `Error: ${error}`;
    }
  });

  // ============================================================================
  // METHODS
  // ============================================================================

  async function switchTab(newTab: TabId) {
    try {
      currentTab = newTab;
      await persistenceService.saveActiveTab(newTab);
      status = `Switched to ${newTab} (saved)`;
    } catch (error) {
      console.error("Failed to save tab:", error);
      status = `Error saving tab: ${error}`;
    }
  }

  async function clearTabHistory() {
    try {
      // This would require a method to clear specific user work data
      // For now, just reset to default
      currentTab = "construct";
      await persistenceService.saveActiveTab("construct");
      status = "Tab history cleared, reset to default";
    } catch (error) {
      console.error("Failed to clear tab history:", error);
      status = `Error clearing history: ${error}`;
    }
  }
</script>

<!-- ============================================================================ -->
<!-- TEMPLATE -->
<!-- ============================================================================ -->

<div class="tab-persistence-example">
  <h2>📑 Tab Persistence Example</h2>

  <div class="status">
    <strong>Status:</strong>
    {status}
  </div>

  <div class="current-tab">
    <h3>Current Tab: <span class="tab-name">{currentTab}</span></h3>
    <p>This tab will be remembered when you reload the page!</p>
  </div>

  <div class="tab-buttons">
    <h4>Switch Tabs:</h4>
    <button
      onclick={() => switchTab("construct")}
      class:active={currentTab === "construct"}
    >
      🔨 Build
    </button>
    <button
      onclick={() => switchTab("browse")}
      class:active={currentTab === "browse"}
    >
      📚 Browse
    </button>
    <button
      onclick={() => switchTab("learn")}
      class:active={currentTab === "learn"}
    >
      🎓 Learn
    </button>
    <button
      onclick={() => switchTab("about")}
      class:active={currentTab === "about"}
    >
      ℹ️ About
    </button>
  </div>

  <div class="actions">
    <button onclick={clearTabHistory} class="secondary">
      Clear Tab History
    </button>
  </div>

  <div class="instructions">
    <h4>🧪 Test Instructions:</h4>
    <ol>
      <li>Click different tabs above</li>
      <li>Refresh the page (F5)</li>
      <li>Notice your last tab is remembered!</li>
      <li>Open DevTools → Application → IndexedDB → TKADatabase → userWork</li>
      <li>See your tab data stored in the browser</li>
    </ol>
  </div>

  <div class="integration-code">
    <h4>🔧 How to Integrate This:</h4>
    <pre><code
        >{`// In your main app component:
import { container } from '$lib/shared/di';

const persistenceService = container.items.persistenceService;

onMount(async () => {
  await persistenceService.initialize();
  const savedTab = await persistenceService.getActiveTab();
  if (savedTab) {
    // Navigate to saved tab
    goto(\`/\${savedTab}\`);
  }
});

// When user clicks a tab:
async function handleTabClick(tabId) {
  await persistenceService.saveActiveTab(tabId);
  goto(\`/\${tabId}\`);
}`}</code
      ></pre>
  </div>
</div>

<style>
  .tab-persistence-example {
    padding: 20px;
    max-width: 800px;
    margin: 0 auto;
    font-family: system-ui, sans-serif;
  }

  .status {
    background: #e3f2fd;
    border: 1px solid #2196f3;
    padding: 12px;
    border-radius: 6px;
    margin-bottom: 20px;
  }

  .current-tab {
    background: #f5f5f5;
    padding: 15px;
    border-radius: 8px;
    margin-bottom: 20px;
    text-align: center;
  }

  .tab-name {
    color: #1976d2;
    font-weight: bold;
    text-transform: uppercase;
  }

  .tab-buttons {
    margin-bottom: 20px;
  }

  .tab-buttons h4 {
    margin-bottom: 10px;
  }

  .tab-buttons button {
    margin: 5px;
    padding: 12px 20px;
    border: 2px solid #ddd;
    border-radius: 6px;
    background: white;
    cursor: pointer;
    font-size: var(--font-size-sm);
    transition: all var(--duration-normal);
  }

  .tab-buttons button:hover {
    border-color: #2196f3;
    background: #f0f8ff;
  }

  .tab-buttons button.active {
    border-color: #2196f3;
    background: #2196f3;
    color: white;
  }

  .actions {
    margin-bottom: 30px;
  }

  .actions button {
    padding: 10px 15px;
    border: 1px solid #666;
    border-radius: 4px;
    background: #f5f5f5;
    cursor: pointer;
  }

  .actions button:hover {
    background: #e0e0e0;
  }

  .instructions {
    background: #fff3e0;
    border: 1px solid #ff9800;
    padding: 15px;
    border-radius: 6px;
    margin-bottom: 20px;
  }

  .instructions h4 {
    margin-top: 0;
    color: #f57c00;
  }

  .instructions ol {
    margin-bottom: 0;
  }

  .integration-code {
    background: #f8f8f8;
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 15px;
  }

  .integration-code h4 {
    margin-top: 0;
    color: #333;
  }

  .integration-code pre {
    background: #2d2d2d;
    color: #f8f8f2;
    padding: 15px;
    border-radius: 4px;
    overflow-x: auto;
    font-size: var(--font-size-compact);
    line-height: 1.4;
  }

  .integration-code code {
    font-family: "Consolas", "Monaco", "Courier New", monospace;
  }
</style>
