<!--
  Persistence Service Example Component
  
  This shows you exactly how to use the new Dexie persistence service
  in your Svelte components. Copy this pattern for your own components.
-->

<script lang="ts">
  import type { SequenceData } from "../../foundation/domain/models/SequenceData";
  import type { TabId } from "../../navigation/domain/types";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";
  import type { IPersistenceService } from "../services/contracts/IPersistenceService";

  // ============================================================================
  // SERVICE INJECTION
  // ============================================================================

  // Get the persistence service from the ITI container
  const persistenceService = container.items.persistenceService as IPersistenceService;

  // ============================================================================
  // REACTIVE STATE
  // ============================================================================

  let isInitialized = $state(false);
  let currentTab = $state<TabId>("construct");
  let sequences = $state<SequenceData[]>([]);
  let storageInfo = $state({
    sequences: 0,
    pictographs: 0,
    userWork: 0,
    projects: 0,
  });
  let status = $state("Ready");

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  onMount(async () => {
    try {
      // Initialize the persistence service
      await persistenceService.initialize();
      isInitialized = true;
      status = "Database initialized";

      // Load the last active tab
      const savedTab = await persistenceService.getActiveTab();
      if (savedTab) {
        currentTab = savedTab;
        status = `Restored tab: ${savedTab}`;
      }

      // Load all sequences
      await loadSequences();

      // Get storage info
      await updateStorageInfo();
    } catch (error) {
      console.error("Failed to initialize persistence:", error);
      status = `Error: ${error}`;
    }
  });

  // ============================================================================
  // METHODS
  // ============================================================================

  async function loadSequences() {
    try {
      sequences = await persistenceService.getAllSequences();
      status = `Loaded ${sequences.length} sequences`;
    } catch (error) {
      console.error("Failed to load sequences:", error);
      status = `Error loading sequences: ${error}`;
    }
  }

  async function saveCurrentTab() {
    try {
      await persistenceService.saveActiveTab(currentTab);
      status = `Saved active tab: ${currentTab}`;
    } catch (error) {
      console.error("Failed to save tab:", error);
      status = `Error saving tab: ${error}`;
    }
  }

  async function createTestSequence() {
    try {
      const testSequence: SequenceData = {
        id: crypto.randomUUID(),
        name: `Test Sequence ${Date.now()}`,
        word: "TEST",
        steps: [],
        thumbnails: [],
        isFavorite: false,
        isCircular: false,
        tags: ["test", "example"],
        metadata: { createdBy: "PersistenceExample" },
      };

      await persistenceService.saveSequence(testSequence);
      await loadSequences();
      status = `Created test sequence: ${testSequence.name}`;
    } catch (error) {
      console.error("Failed to create test sequence:", error);
      status = `Error creating sequence: ${error}`;
    }
  }

  async function clearAllData() {
    try {
      await persistenceService.clearAllData();
      sequences = [];
      await updateStorageInfo();
      status = "All data cleared";
    } catch (error) {
      console.error("Failed to clear data:", error);
      status = `Error clearing data: ${error}`;
    }
  }

  async function updateStorageInfo() {
    try {
      storageInfo = await persistenceService.getStorageInfo();
    } catch (error) {
      console.error("Failed to get storage info:", error);
    }
  }

  async function exportData() {
    try {
      const data = await persistenceService.exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tka-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      status = "Data exported successfully";
    } catch (error) {
      console.error("Failed to export data:", error);
      status = `Error exporting data: ${error}`;
    }
  }
</script>

<!-- ============================================================================ -->
<!-- TEMPLATE -->
<!-- ============================================================================ -->

<div class="persistence-example">
  <h2>🗄️ Persistence Service Example</h2>

  <div class="status">
    <strong>Status:</strong>
    {status}
  </div>

  <div class="info-grid">
    <div class="info-card">
      <h3>Database Status</h3>
      <p>Initialized: {isInitialized ? "✅" : "❌"}</p>
      <p>Available: {persistenceService.isAvailable() ? "✅" : "❌"}</p>
    </div>

    <div class="info-card">
      <h3>Storage Info</h3>
      <p>Sequences: {storageInfo.sequences}</p>
      <p>Pictographs: {storageInfo.pictographs}</p>
      <p>User Work: {storageInfo.userWork}</p>
      <p>Projects: {storageInfo.projects}</p>
    </div>

    <div class="info-card">
      <h3>Current Tab</h3>
      <select bind:value={currentTab} onchange={saveCurrentTab}>
        <option value="construct">Build</option>
        <option value="browse">Browse</option>
        <option value="learn">Learn</option>
        <option value="about">About</option>
      </select>
    </div>
  </div>

  <div class="actions">
    <button onclick={createTestSequence}>Create Test Sequence</button>
    <button onclick={loadSequences}>Reload Sequences</button>
    <button onclick={exportData}>Export Data</button>
    <button onclick={clearAllData} class="danger">Clear All Data</button>
  </div>

  <div class="sequences">
    <h3>Sequences ({sequences.length})</h3>
    {#each sequences as sequence}
      <div class="sequence-item">
        <strong>{sequence.name}</strong> - {sequence.word}
        <small>({sequence.id})</small>
      </div>
    {/each}
  </div>
</div>

<style>
  .persistence-example {
    padding: 20px;
    max-width: 800px;
    margin: 0 auto;
  }

  .status {
    background: #f0f0f0;
    padding: 10px;
    border-radius: 4px;
    margin-bottom: 20px;
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
    margin-bottom: 20px;
  }

  .info-card {
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 15px;
  }

  .info-card h3 {
    margin-top: 0;
    color: #333;
  }

  .actions {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }

  button {
    padding: 10px 15px;
    border: none;
    border-radius: 4px;
    background: #007bff;
    color: white;
    cursor: pointer;
  }

  button:hover {
    background: #0056b3;
  }

  button.danger {
    background: #dc3545;
  }

  button.danger:hover {
    background: #c82333;
  }

  .sequences {
    background: #f8f9fa;
    border-radius: 8px;
    padding: 15px;
  }

  .sequence-item {
    padding: 8px;
    border-bottom: 1px solid #eee;
  }

  .sequence-item:last-child {
    border-bottom: none;
  }

  select {
    width: 100%;
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
</style>
