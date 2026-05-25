<script lang="ts">
  /**
   * Admin Dashboard
   *
   * Main admin interface for managing TKA system
   */

  import DailyChallengeScheduler from "./DailyChallengeScheduler.svelte";
  import TrainChallengeManager from "./TrainChallengeManager.svelte";
  import UsersDashboard from "./UsersDashboard.svelte";
  import FeatureFlagManagement from "./FeatureFlagManagement.svelte";
  import AnnouncementManagement from "./AnnouncementManagement.svelte";
  import ShameQueuePanel from "./ShameQueuePanel.svelte";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";

  // Lazy load LOOP Labeler to avoid blocking admin dashboard if it fails
  let LOOPLabelerModule: typeof import("$lib/features/loop-labeler/components/LOOPLabelerModule.svelte").default | null =
    $state(null);

  // Lazy load PostHog Analytics Dashboard
  let PostHogDashboard: typeof import("./analytics/PostHogDashboard.svelte").default | null =
    $state(null);

  $effect(() => {
    if (activeSection === "loop-labeler" && !LOOPLabelerModule) {
      import("$lib/features/loop-labeler/components/LOOPLabelerModule.svelte")
        .then((mod) => {
          LOOPLabelerModule = mod.default;
        })
        .catch((err) => {
          console.error("Failed to load LOOP Labeler:", err);
        });
    }

    if (activeSection === "analytics" && !PostHogDashboard) {
      import("./analytics/PostHogDashboard.svelte")
        .then((mod) => {
          PostHogDashboard = mod.default;
        })
        .catch((err) => {
          console.error("Failed to load PostHog Dashboard:", err);
        });
    }

  });

  // State
  let isLoading = $state(false);

  // Get current section from navigation coordinator
  const activeSection = $derived(navigationState.currentSection);
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
      {#if !activeSection || activeSection === "users"}
        <div
          id="users-panel"
          role="tabpanel"
          aria-labelledby="users-tab"
        >
          <UsersDashboard />
        </div>
      {:else if activeSection === "challenges"}
        <div
          id="challenges-panel"
          role="tabpanel"
          aria-labelledby="challenges-tab"
        >
          <DailyChallengeScheduler />
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
      {:else if activeSection === "loop-labeler"}
        <div
          id="loop-labeler-panel"
          role="tabpanel"
          aria-labelledby="loop-labeler-tab"
        >
          {#if LOOPLabelerModule}
            <LOOPLabelerModule />
          {:else}
            <div class="loading-state">
              <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
              <p>Loading LOOP Labeler...</p>
            </div>
          {/if}
        </div>
      {:else if activeSection === "analytics"}
        <div
          id="analytics-panel"
          role="tabpanel"
          aria-labelledby="analytics-tab"
        >
          {#if PostHogDashboard}
            <PostHogDashboard />
          {:else}
            <div class="loading-state">
              <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
              <p>Loading Analytics...</p>
            </div>
          {/if}
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

  /* Loop Labeler needs full width - it has its own sidebar + multi-panel layout */
  .admin-content:has(#loop-labeler-panel) {
    max-width: none;
    overflow: hidden;
  }

  #loop-labeler-panel {
    height: 100%;
  }
</style>
