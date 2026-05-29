<script lang="ts">
  /**
   * ChallengesPanel
   * Main panel for the Challenges tab in the Community module.
   * Shows Daily Challenges, Weekly Challenges, and Skill Progressions.
   */

  import { onMount } from "svelte";
  import { getChallengeCoordinator } from "$lib/shared/gamification/get-challenge-coordinator";
  import type { ChallengeDashboard } from "$lib/shared/gamification/domain/models/challenge-models";
  import PanelHeader from "$lib/shared/components/panel/PanelHeader.svelte";
  import PanelContent from "$lib/shared/components/panel/PanelContent.svelte";
  import PanelState from "$lib/shared/components/panel/PanelState.svelte";
  import PanelTabs from "$lib/shared/components/panel/PanelTabs.svelte";
  import DailyChallengeCard from "./DailyChallengeCard.svelte";
  import WeeklyChallengeCard from "./WeeklyChallengeCard.svelte";
  import SkillProgressionList from "./SkillProgressionList.svelte";
  import ChallengeStats from "./ChallengeStats.svelte";

  // State
  let isLoading = $state(true);
  let error = $state<string | null>(null);
  let dashboard = $state<ChallengeDashboard | null>(null);
  let activeTab = $state<"overview" | "daily" | "weekly" | "skills">(
    "overview"
  );

  // Service
  const coordinator = getChallengeCoordinator();

  // Tab configuration
  const tabs = [
    { value: "overview", label: "Overview", icon: "fa-chart-pie" },
    { value: "daily", label: "Daily", icon: "fa-sun" },
    { value: "weekly", label: "Weekly", icon: "fa-calendar-week" },
    { value: "skills", label: "Skills", icon: "fa-medal" },
  ];

  onMount(async () => {
    try {
      await coordinator.initialize();
      dashboard = await coordinator.getDashboard();
      isLoading = false;
    } catch (err) {
      console.error("[ChallengesPanel] Error loading challenges:", err);
      error = err instanceof Error ? err.message : "Failed to load challenges";
      isLoading = false;
    }
  });

  async function refreshDashboard() {
    if (!coordinator) return;
    try {
      dashboard = await coordinator.getDashboard();
    } catch (err) {
      console.error("[ChallengesPanel] Error refreshing:", err);
    }
  }
</script>

<div class="challenges-panel">
  <PanelHeader
    title="Challenges"
    subtitle="Complete challenges to earn XP and level up"
    icon="fa-bolt"
  />

  <PanelTabs
    {tabs}
    {activeTab}
    onchange={(value: string) => (activeTab = value as typeof activeTab)}
  />

  <PanelContent>
    {#if error}
      <PanelState type="error" title="Error" message={error} />
    {:else if isLoading}
      <PanelState type="loading" message="Loading challenges..." />
    {:else if dashboard}
      {#if activeTab === "overview"}
        <!-- Overview Tab -->
        <div class="overview-grid">
          <!-- Stats Summary -->
          <ChallengeStats {dashboard} />

          <!-- Daily Challenge Preview -->
          <div class="challenge-section">
            <div class="section-header">
              <i class="fas fa-sun" aria-hidden="true"></i>
              <h3>Today's Challenge</h3>
            </div>
            {#if dashboard.daily.challenge}
              <DailyChallengeCard
                challenge={dashboard.daily.challenge}
                progress={dashboard.daily.progress}
                compact
              />
            {:else}
              <div class="no-challenge">
                <i class="fas fa-check-circle" aria-hidden="true"></i>
                <p>No daily challenge available</p>
              </div>
            {/if}
          </div>

          <!-- Weekly Challenge Preview -->
          <div class="challenge-section">
            <div class="section-header">
              <i class="fas fa-calendar-week" aria-hidden="true"></i>
              <h3>This Week's Challenge</h3>
            </div>
            {#if dashboard.weekly.challenge}
              <WeeklyChallengeCard
                challenge={dashboard.weekly.challenge}
                progress={dashboard.weekly.progress}
                compact
              />
            {:else}
              <div class="no-challenge">
                <i class="fas fa-calendar-times" aria-hidden="true"></i>
                <p>No weekly challenge available</p>
              </div>
            {/if}
          </div>

          <!-- Skills in Progress -->
          <div class="challenge-section">
            <div class="section-header">
              <i class="fas fa-medal" aria-hidden="true"></i>
              <h3>Skills in Progress</h3>
            </div>
            {#if dashboard.skills.inProgressSkills.length > 0}
              <SkillProgressionList
                skills={dashboard.skills.inProgressSkills.slice(0, 3)}
                progressMap={dashboard.skills.userProgress}
                compact
              />
            {:else}
              <div class="no-challenge">
                <i class="fas fa-star" aria-hidden="true"></i>
                <p>Start a skill to track your progress</p>
              </div>
            {/if}
          </div>
        </div>
      {:else if activeTab === "daily"}
        <!-- Daily Tab -->
        <div class="challenge-detail">
          {#if dashboard.daily.challenge}
            <DailyChallengeCard
              challenge={dashboard.daily.challenge}
              progress={dashboard.daily.progress}
              onComplete={refreshDashboard}
            />
          {:else}
            <PanelState
              type="empty"
              icon="fa-sun"
              title="No Daily Challenge"
              message="Check back later for today's challenge"
            />
          {/if}
        </div>
      {:else if activeTab === "weekly"}
        <!-- Weekly Tab -->
        <div class="challenge-detail">
          {#if dashboard.weekly.challenge}
            <WeeklyChallengeCard
              challenge={dashboard.weekly.challenge}
              progress={dashboard.weekly.progress}
              onComplete={refreshDashboard}
            />
          {:else}
            <PanelState
              type="empty"
              icon="fa-calendar-week"
              title="No Weekly Challenge"
              message="Check back for this week's challenge"
            />
          {/if}
        </div>
      {:else if activeTab === "skills"}
        <!-- Skills Tab -->
        <SkillProgressionList
          skills={[
            ...dashboard.skills.inProgressSkills,
            ...dashboard.skills.recentlyCompleted,
          ]}
          progressMap={dashboard.skills.userProgress}
          onSkillSelect={refreshDashboard}
        />
      {/if}
    {:else}
      <PanelState
        type="empty"
        icon="fa-bolt"
        title="No Challenges"
        message="Challenges will appear here when available"
      />
    {/if}
  </PanelContent>
</div>

<style>
  .challenges-panel {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  /* ============================================================================
     OVERVIEW GRID - Responsive Layout
     ============================================================================ */
  .overview-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-bottom: 16px;
  }

  .challenge-detail {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .challenge-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .section-header i {
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim);
  }

  .section-header h3 {
    margin: 0;
    font-size: var(--font-size-compact);
    font-weight: 600;
    color: var(--theme-text);
  }

  .no-challenge {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 20px 12px;
    text-align: center;
    color: var(--theme-text-dim);
  }

  .no-challenge i {
    font-size: var(--font-size-2xl);
    opacity: 0.5;
  }

  .no-challenge p {
    margin: 0;
    font-size: var(--font-size-compact);
  }

  /* ============================================================================
     RESPONSIVE BREAKPOINTS
     ============================================================================ */

  /* Large Mobile (481px+) */
  @media (min-width: 481px) {
    .challenges-panel {
      gap: 20px;
    }

    .overview-grid {
      gap: 16px;
    }

    .challenge-section {
      padding: 16px;
      gap: 12px;
      border-radius: 16px;
    }

    .section-header {
      gap: 10px;
      padding-bottom: 12px;
    }

    .section-header i {
      font-size: var(--font-size-base);
    }

    .section-header h3 {
      font-size: var(--font-size-sm);
    }

    .no-challenge {
      padding: 32px 20px;
      gap: 12px;
    }

    .no-challenge i {
      font-size: var(--font-size-3xl);
    }

    .no-challenge p {
      font-size: var(--font-size-sm);
    }
  }

  /* Tablet (641px+) - Two column layout */
  @media (min-width: 641px) {
    .overview-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
    }

    /* Stats section spans full width */
    .overview-grid > :first-child {
      grid-column: 1 / -1;
    }
  }

  /* Desktop (1025px+) - Three column layout */
  @media (min-width: 1025px) {
    .overview-grid {
      grid-template-columns: repeat(3, 1fr);
    }

    /* Stats section spans full width */
    .overview-grid > :first-child {
      grid-column: 1 / -1;
    }
  }

  /* Large Desktop (1400px+) */
  @media (min-width: 1400px) {
    .challenge-section {
      padding: 20px;
    }
  }

  /* ============================================================================
     ACCESSIBILITY
     ============================================================================ */
  @media (prefers-reduced-motion: reduce) {
    .challenge-section {
      transition: none;
    }
  }
</style>
