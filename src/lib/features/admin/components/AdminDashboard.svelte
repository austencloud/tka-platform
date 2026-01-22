<script lang="ts">
  /**
   * Admin Dashboard
   *
   * Main admin interface for managing TKA system
   */

  import { onMount } from "svelte";
  import { container } from "$lib/shared/di";
  import type { IAdminChallengeManager } from "../services/contracts/IAdminChallengeManager";
  import DailyChallengeScheduler from "./DailyChallengeScheduler.svelte";
  import TrainChallengeManager from "./TrainChallengeManager.svelte";
  import AnalyticsDashboard from "./AnalyticsDashboard.svelte";
  import FeatureFlagManagement from "./FeatureFlagManagement.svelte";
  import AnnouncementManagement from "./AnnouncementManagement.svelte";
  import ShameQueuePanel from "./ShameQueuePanel.svelte";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";

  // Services
  let adminChallengeService = $state<IAdminChallengeManager | null>(null);

  // State
  let isLoading = $state(true);

  // Get current section from navigation coordinator
  const activeSection = $derived(navigationState.currentSection);

  onMount(() => {
    try {
      adminChallengeService = container.items.adminChallengeManager;
      isLoading = false;
    } catch (error) {
      console.error("❌ Failed to initialize AdminDashboard:", error);
      isLoading = false;
    }
  });
</script>

<div class="admin-dashboard">
  {#if isLoading}
    <div class="loading-state">
      <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
      <p>Loading admin tools...</p>
    </div>
  {:else}
    <!-- Content Area -->
    <main class="admin-content themed-scrollbar">
      {#if !activeSection || activeSection === "analytics"}
        <div
          id="analytics-panel"
          role="tabpanel"
          aria-labelledby="analytics-tab"
        >
          <AnalyticsDashboard />
        </div>
      {:else if activeSection === "challenges" && adminChallengeService}
        <div
          id="challenges-panel"
          role="tabpanel"
          aria-labelledby="challenges-tab"
        >
          <DailyChallengeScheduler {adminChallengeService} />
        </div>
      {:else if activeSection === "train-challenges"}
        <div
          id="train-challenges-panel"
          role="tabpanel"
          aria-labelledby="train-challenges-tab"
        >
          <TrainChallengeManager />
        </div>
      {:else if activeSection === "flags"}
        <div id="flags-panel" role="tabpanel" aria-labelledby="flags-tab">
          <FeatureFlagManagement />
        </div>
      {:else if activeSection === "announcements"}
        <div
          id="announcements-panel"
          role="tabpanel"
          aria-labelledby="announcements-tab"
        >
          <AnnouncementManagement />
        </div>
      {:else if activeSection === "hall-of-shame"}
        <div
          id="hall-of-shame-panel"
          role="tabpanel"
          aria-labelledby="hall-of-shame-tab"
        >
          <ShameQueuePanel />
        </div>
      {/if}
    </main>
  {/if}
</div>

<style>
  .admin-dashboard {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: transparent;
    color: var(--text-color, #ffffff);
    overflow: hidden;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 1rem;
    font-size: 1.2rem;
    opacity: 0.7;
  }

  .loading-state i {
    font-size: 3rem;
  }

  /* Content Area */
  .admin-content {
    flex: 1;
    min-height: 0;
    width: 100%;
    max-width: 1400px;
    margin: 0 auto;
    overflow-y: auto;
  }

  /* Tab panels need to fill available height */
  .admin-content > [role="tabpanel"] {
    min-height: min-content;
  }
</style>
