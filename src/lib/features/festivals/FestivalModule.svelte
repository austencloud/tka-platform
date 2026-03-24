<script lang="ts">
  import { container } from "$lib/shared/di";
  import { createFestivalState, type FestivalTab } from "./state/festival-state.svelte";
  import { setFestivalContext } from "./context/festival-context";
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import { auth } from "$lib/shared/auth/firebase";
  import DiscoverTab from "./components/discover/DiscoverTab.svelte";
  import FestivalMap from "./components/map/FestivalMap.svelte";
  import FestivalDetailView from "./components/discover/FestivalDetailView.svelte";
  import FestivalCalendar from "./components/calendar/FestivalCalendar.svelte";
  import WorkshopPortfolioEditor from "./components/portfolio/WorkshopPortfolioEditor.svelte";

  const festivalState = createFestivalState(
    container.items.festivalLoader,
    container.items.festivalTrackerRepository,
    container.items.festivalAttendanceRepository,
    container.items.workshopPortfolioRepository
  );

  setFestivalContext({ state: festivalState });

  const VALID_TABS: FestivalTab[] = ["discover", "map", "calendar", "workshops"];

  const tabs: { id: FestivalTab; label: string; icon: string }[] = [
    { id: "discover", label: "Discover", icon: "fas fa-compass" },
    { id: "map", label: "Map", icon: "fas fa-globe" },
    { id: "calendar", label: "Calendar", icon: "fas fa-calendar-alt" },
    { id: "workshops", label: "My Workshops", icon: "fas fa-chalkboard-teacher" },
  ];

  // Sync sidebar navigation state → internal festival tab state
  $effect(() => {
    const navTab = navigationState.activeTab;
    if (VALID_TABS.includes(navTab as FestivalTab)) {
      festivalState.activeTab = navTab as FestivalTab;
    }
  });

  // When clicking internal tab buttons, also update global navigation state
  function switchTab(tabId: FestivalTab) {
    festivalState.activeTab = tabId;
    navigationState.setActiveTab(tabId);
  }

  $effect(() => {
    const uid = auth.currentUser?.uid;
    if (uid) {
      festivalState.loadFestivals(uid);
      festivalState.loadPortfolio(uid);
    }
  });
</script>

<div class="festival-module">
  <div class="tab-nav" role="tablist" aria-label="Festival Hub tabs">
    {#each tabs as tab}
      <button
        class="tab-button"
        class:active={festivalState.activeTab === tab.id}
        onclick={() => switchTab(tab.id)}
        role="tab"
        aria-selected={festivalState.activeTab === tab.id}
      >
        <i class={tab.icon} aria-hidden="true"></i>
        <span>{tab.label}</span>
      </button>
    {/each}
  </div>

  <div class="tab-content" role="tabpanel">
    {#if festivalState.isLoading}
      <div class="loading-state">
        <ProgressRing percent={-1} size={32} strokeWidth={3} />
        <p>Loading festivals...</p>
      </div>
    {:else if festivalState.activeTab === "discover"}
      <DiscoverTab />
    {:else if festivalState.activeTab === "map"}
      <FestivalMap />
    {:else if festivalState.activeTab === "calendar"}
      <FestivalCalendar />
    {:else if festivalState.activeTab === "workshops"}
      <WorkshopPortfolioEditor />
    {/if}
  </div>
</div>

{#if festivalState.selectedFestival}
  <FestivalDetailView
    festival={festivalState.selectedFestival}
    tracker={festivalState.trackers.get(festivalState.selectedFestival.id)}
    onclose={() => (festivalState.selectedFestival = null)}
  />
{/if}

<style>
  .festival-module {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    color: var(--theme-text, #ffffff);
  }

  .loading-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    text-align: center;
    padding: 24px;
  }

  .tab-nav {
    display: flex;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    padding: 0 16px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .tab-button {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 16px 12px;
    background: none;
    border: none;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.7));
    cursor: pointer;
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    position: relative;
    transition: color 0.2s ease;
  }

  .tab-button:hover {
    color: var(--theme-text, #ffffff);
  }

  .tab-button.active {
    color: var(--theme-accent, #6366f1);
  }

  .tab-button.active::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 16px;
    right: 16px;
    height: 2px;
    background: var(--theme-accent, #6366f1);
    border-radius: 2px 2px 0 0;
  }

  .tab-button i {
    font-size: 16px;
  }

  .tab-content {
    flex: 1;
    overflow: hidden;
  }

  @media (max-width: 600px) {
    .tab-button span {
      display: none;
    }

    .tab-button {
      padding: 16px;
    }

    .tab-button i {
      font-size: 20px;
    }
  }
</style>
