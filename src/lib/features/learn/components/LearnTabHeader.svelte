<!--
LearnTabHeader - Navigation header for Learn module

Provides sub-tab navigation and quick access buttons:
- Sub-tabs: Concepts | Drills
- Codex button: Opens slide-in reference panel
- Responsive: Tabs on desktop, compact on mobile

Features:
- Syncs with navigationState for persistence
- Haptic feedback on tab switches
- Active tab indicator with slide animation
- 48px minimum touch targets
-->
<script lang="ts">
  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import { container } from "$lib/shared/di";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";

  interface Props {
    /** Currently active sub-tab */
    activeTab?: "concepts" | "drills";
    /** Callback when tab changes */
    onTabChange?: (tab: "concepts" | "drills") => void;
  }

  let { activeTab = $bindable("concepts"), onTabChange }: Props = $props();

  const hapticService = container.items.hapticFeedback;

  // Tab configuration
  const tabs = [
    { id: "concepts" as const, label: "Concepts", icon: "🎯" },
    { id: "drills" as const, label: "Drills", icon: "⚡" },
  ];

  // Handle tab click
  function handleTabClick(tabId: typeof activeTab) {
    if (tabId === activeTab) return;

    hapticService?.trigger("selection");
    activeTab = tabId;

    // Update navigation state for persistence
    navigationState.setLearnMode(tabId);

    onTabChange?.(tabId);
  }
</script>

<header class="learn-header">
  <!-- Sub-tab Navigation -->
  <div class="tab-nav" role="tablist" aria-label="Learn module navigation">
    {#each tabs as tab (tab.id)}
      <button
        id="tab-{tab.id}"
        class="tab-button"
        class:active={activeTab === tab.id}
        onclick={() => handleTabClick(tab.id)}
        role="tab"
        aria-selected={activeTab === tab.id}
        aria-controls="{tab.id}-panel"
        tabindex={activeTab === tab.id ? 0 : -1}
        type="button"
      >
        <span class="tab-icon">{tab.icon}</span>
        <span class="tab-label">{tab.label}</span>
      </button>
    {/each}

    <!-- Active indicator (underline) -->
    <div
      class="tab-indicator"
      style="transform: translateX({tabs.findIndex((t) => t.id === activeTab) *
        100}%)"
    ></div>
  </div>
</header>

<style>
  .learn-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: var(--surface, #242424);
    border-bottom: 1px solid var(--border-color, var(--theme-stroke));
    position: relative;
    z-index: 10;
  }

  /* Tab Navigation */
  .tab-nav {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    position: relative;
    flex: 1;
    max-width: 600px;
  }

  .tab-button {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    min-height: var(--min-touch-target);
    min-width: var(--min-touch-target);
    padding: 0.5rem 1rem;
    background: transparent;
    border: none;
    color: var(--foreground-muted, var(--theme-text-dim));
    cursor: pointer;
    transition: all 200ms ease;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    position: relative;
    z-index: 2;
  }

  .tab-button:hover {
    background: var(--hover-bg, rgba(255, 255, 255, 0.05));
    color: var(--foreground, #ffffff);
  }

  .tab-button:active {
    transform: scale(0.97);
  }

  .tab-button.active {
    color: var(--accent, #4a9eff);
  }

  .tab-button:focus-visible {
    outline: 2px solid var(--accent, #4a9eff);
    outline-offset: 2px;
  }

  .tab-icon {
    font-size: 1.25rem;
    line-height: 1;
  }

  .tab-label {
    font-size: 0.8125rem;
    line-height: 1;
    white-space: nowrap;
  }

  /* Active tab indicator */
  .tab-indicator {
    position: absolute;
    bottom: -1px;
    left: 0;
    width: calc(100% / 2);
    height: 2px;
    background: var(--accent, #4a9eff);
    transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1);
    z-index: 1;
    border-radius: 2px 2px 0 0;
  }

  /* Mobile responsiveness */
  @media (max-width: 768px) {
    .learn-header {
      padding: 0.5rem 0.75rem;
      gap: 0.5rem;
    }

    .tab-nav {
      gap: 0.25rem;
    }

    .tab-button {
      padding: 0.375rem 0.5rem;
      gap: 0.125rem;
    }

    .tab-icon {
      font-size: 1.125rem;
    }

    .tab-label {
      font-size: 0.75rem;
    }
  }

  @media (max-width: 480px) {
    .learn-header {
      padding: 0.5rem;
    }

    .tab-button {
      padding: 0.25rem 0.375rem;
    }

    .tab-icon {
      font-size: 1rem;
    }

    .tab-label {
      font-size: 0.6875rem;
    }
  }

  /* Accessibility - reduce motion */
  @media (prefers-reduced-motion: reduce) {
    .tab-button,
    .tab-indicator {
      transition: none;
    }
  }
</style>
