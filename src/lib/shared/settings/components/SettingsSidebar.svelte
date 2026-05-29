<!-- SettingsSidebar.svelte - Improved contrast navigation sidebar -->
<script lang="ts">
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import type { HapticFeedback } from "../../application/services/haptic-feedback";
  import { onMount } from "svelte";
  import { t } from "$lib/shared/i18n/i18n.svelte";
  import type { TranslationKey } from "$lib/shared/i18n/i18n-types";
  import { getReactiveLocale } from "$lib/shared/i18n/locale-state.svelte";

  // Reactive locale for re-rendering translations
  const locale = $derived(getReactiveLocale());

  interface Tab {
    id: string;
    label: string;
    icon: string;
  }

  let { tabs, activeTab, onTabSelect } = $props<{
    tabs: Tab[];
    activeTab: string;
    onTabSelect: (tabId: string) => void;
  }>();

  // Services
  let hapticService: HapticFeedback;

  // Runes for tracking sidebar dimensions
  let sidebarElement = $state<HTMLElement | null>(null);
  let sidebarWidth = $state(200);

  // Derived values based on parent width
  const isNarrow = $derived(sidebarWidth < 200);
  const isWide = $derived(sidebarWidth >= 250);

  // Smart navigation pattern selection based on tab count
  // Show individual buttons for up to 8 tabs, dropdown only for 9+
  const shouldUseDropdown = $derived(tabs.length > 8);
  const _shouldUseIconAboveText = $derived(tabs.length <= 8);

  onMount(() => {
    hapticService = getHapticFeedback();

    // Track sidebar width changes with ResizeObserver
    if (sidebarElement) {
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          sidebarWidth = entry.contentRect.width;
        }
      });
      resizeObserver.observe(sidebarElement);

      return () => resizeObserver.disconnect();
    }
    return undefined;
  });

  function handleTabClick(tabId: string) {
    // Trigger navigation haptic feedback for tab switching
    hapticService?.trigger("selection");
    onTabSelect(tabId);
  }
</script>

<aside class="settings-sidebar" bind:this={sidebarElement}>
  <nav class="settings-sidebar-nav" class:use-dropdown={shouldUseDropdown}>
    {#if shouldUseDropdown}
      <!-- Dropdown selector pattern (6+ tabs) - Future implementation -->
      <div class="tab-dropdown">
        <button class="dropdown-trigger" aria-label="Select tab">
          <span class="dropdown-icon"
            >{@html tabs.find((t: (typeof tabs)[0]) => t.id === activeTab)
              ?.icon || ""}</span
          >
          <span class="dropdown-label"
            >{tabs.find((t: (typeof tabs)[0]) => t.id === activeTab)?.label ||
              ""}</span
          >
          <i class="fas fa-chevron-down dropdown-arrow" aria-hidden="true"></i>
        </button>
        <!-- Dropdown menu will be implemented when needed -->
      </div>
    {:else}
      <!-- Icon-above-text pattern (3-5 tabs) - Current implementation -->
      {#key locale}
      {#each tabs as tab}
        {@const translatedLabel = t(`tab_settings_${tab.id}` as TranslationKey) || tab.label}
        <button
          class="settings-sidebar-item"
          class:active={activeTab === tab.id}
          class:narrow={isNarrow}
          class:wide={isWide}
          onclick={() => handleTabClick(tab.id)}
          title={translatedLabel}
          aria-label={translatedLabel}
        >
          <span class="sidebar-icon">{@html tab.icon}</span>
          <span class="sidebar-label">{translatedLabel}</span>
        </button>
      {/each}
      {/key}
    {/if}
  </nav>
</aside>

<style>
  .settings-sidebar {
    width: var(
      --sidebar-width,
      clamp(180px, 12vw, 200px)
    ); /* Reduced max from 252px to 200px for better desktop layout */
    max-width: 200px; /* Never exceed 200px */
    background: var(--theme-card-bg);
    border-right: 1px solid var(--theme-stroke, var(--theme-stroke));
    overflow-y: auto;
    container-type: inline-size;
    display: flex;
    flex-direction: column;
  }

  .settings-sidebar-nav {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px; /* Increased gap for better visual rhythm */
    flex: 1; /* Fill available vertical space */
    justify-content: flex-start; /* Start from top, items will grow */
  }

  .settings-sidebar-item {
    display: flex;
    align-items: center;
    gap: clamp(10px, 3cqi, 14px);
    padding: 14px 16px; /* Consistent padding for predictable sizing */
    min-height: var(
      --min-touch-target
    ); /* WCAG AAA: 48px minimum, we use 48px for comfort */
    flex: 1; /* Allow items to grow and fill space evenly */
    max-height: 72px; /* Cap growth so items don't get too tall */
    background: var(--theme-card-bg);
    border: 1.5px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 12px; /* Slightly more rounded */
    color: var(--theme-text);
    cursor: pointer;
    transition: all var(--duration-normal) cubic-bezier(0.4, 0, 0.2, 1); /* Smooth easing */
    text-align: left;
    font-size: clamp(13px, 4cqi, 15px);
    font-weight: 500;
    position: relative;
    overflow: hidden;
  }

  /* Container query for sidebar responsiveness */
  @container (max-width: 160px) {
    /* Icon-only mode for very narrow sidebars */
    .settings-sidebar-item {
      justify-content: center;
      gap: 0;
      padding: 16px; /* Maintain touch target size */
      min-height: var(--min-touch-target); /* Slightly taller for icon-only */
    }

    .sidebar-label {
      display: none;
    }

    .sidebar-icon {
      font-size: var(--font-size-2xl); /* Larger icons when labels are hidden */
    }

    /* Hide chevron in icon-only mode */
    .settings-sidebar-item::after {
      display: none;
    }
  }

  @container (min-width: 161px) {
    /* Show labels when there's enough space */
    .settings-sidebar-item {
      gap: clamp(10px, 2cqi, 14px);
    }

    .sidebar-label {
      display: block;
    }
  }

  .settings-sidebar-item:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text);
    transform: translateX(3px); /* Slide right hint - "go here" */
    box-shadow: var(--theme-shadow, 0 2px 8px rgba(0, 0, 0, 0.15));
  }

  .settings-sidebar-item:active {
    transform: translateX(1px) scale(0.98); /* Press feedback */
  }

  .settings-sidebar-item.active {
    background: color-mix(in srgb, var(--theme-accent) 25%, transparent);
    color: var(--theme-text);
    border-color: color-mix(in srgb, var(--theme-accent) 60%, transparent);
    box-shadow: 0 0 12px
      color-mix(in srgb, var(--theme-accent) 30%, transparent);
    font-weight: 600; /* Emphasize active tab */
  }

  .settings-sidebar-item.active:hover {
    background: color-mix(in srgb, var(--theme-accent) 30%, transparent);
    box-shadow: 0 0 16px
      color-mix(in srgb, var(--theme-accent) 40%, transparent);
  }

  .sidebar-icon {
    font-size: var(--font-size-xl); /* Good size for touch target visibility */
    width: 24px;
    text-align: center;
    transition: transform var(--duration-normal) ease;
    flex-shrink: 0; /* Prevent icon from shrinking */
  }

  .settings-sidebar-item:hover .sidebar-icon {
    transform: scale(1.15); /* Icon emphasis on hover */
  }

  .sidebar-label {
    transition: opacity var(--duration-normal) ease;
    flex: 1; /* Allow label to take remaining space */
  }

  /* Navigation indicator - shows these are clickable destinations */
  .settings-sidebar-item::after {
    content: "\f054"; /* FontAwesome chevron-right */
    font-family: "Font Awesome 6 Free", "Font Awesome 5 Free";
    font-weight: 900;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim, var(--theme-text-dim));
    opacity: 0;
    transform: translateX(-4px);
    transition: all var(--duration-normal) ease;
    margin-left: auto;
  }

  .settings-sidebar-item:hover::after {
    opacity: 1;
    transform: translateX(0);
  }

  .settings-sidebar-item.active::after {
    opacity: 0; /* Hide chevron on active - you're already here */
  }

  /* Mobile responsive - Icon-above-text pattern (iOS/Android style) */
  @media (max-width: 768px) {
    .settings-sidebar {
      width: 100%;
      min-height: auto;
      border-right: none;
      border-bottom: 1px solid var(--theme-stroke, var(--theme-stroke));
      max-height: 90px;
      position: relative;
    }

    .settings-sidebar-nav {
      flex-direction: row;
      overflow: visible; /* No scrolling needed - all tabs fit */
      padding: 8px 8px;
      gap: 4px;
      /* Equal distribution of tabs */
      justify-content: space-between;
    }

    .settings-sidebar-item {
      /* Icon-above-text layout */
      flex-direction: column; /* Stack icon above text */
      align-items: center;
      justify-content: center;
      flex: 1; /* Equal width for all tabs */
      gap: 4px; /* Tight spacing between icon and label */
      padding: 8px 6px;
      font-size: var(--font-size-compact); /* Smaller but readable */
      min-height: 62px; /* Taller for vertical layout */
      white-space: normal; /* Allow text wrapping if needed */
      text-align: center;
      border-radius: 8px;
    }

    .sidebar-icon {
      font-size: var(
        --font-size-xl
      ); /* LARGER: Icons are the primary visual element */
      flex-shrink: 0;
      width: auto; /* Remove fixed width */
      margin: 0; /* Remove margin */
    }

    .sidebar-label {
      font-size: var(--font-size-compact); /* Compact but readable */
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%; /* Prevent overflow */
    }

    /* Hide chevron on mobile - layout is horizontal, not navigational */
    .settings-sidebar-item::after {
      display: none;
    }

    /* Mobile hover: no translateX, just subtle lift */
    .settings-sidebar-item:hover {
      transform: translateY(-2px);
    }

    .settings-sidebar-item:active {
      transform: translateY(0) scale(0.97);
    }
  }

  /* Narrow mobile screens - Maintain icon-above-text */
  @media (max-width: 480px) {
    .settings-sidebar-nav {
      padding: 6px 6px;
      gap: 3px;
    }

    .settings-sidebar-item {
      padding: 6px 4px;
      min-height: 58px;
      gap: 3px;
    }

    .sidebar-icon {
      font-size: var(--font-size-xl); /* Slightly smaller but still prominent */
    }

    .sidebar-label {
      font-size: var(--font-size-compact); /* Compact but readable */
    }
  }

  /* Ultra-narrow screens - Maintain icon-above-text with minimum sizes */
  @media (max-width: 390px) {
    .settings-sidebar-nav {
      padding: 5px 4px;
      gap: 2px;
    }

    .settings-sidebar-item {
      padding: 5px 3px;
      min-height: var(--min-touch-target);
      gap: 2px;
    }

    .sidebar-icon {
      font-size: var(--font-size-lg); /* Minimum practical icon size */
    }

    .sidebar-label {
      font-size: var(--font-size-compact); /* Minimum readable size */
    }
  }

  /* Height-constrained scenarios - Compact icon-above-text */
  @media (max-height: 600px) and (max-width: 768px) {
    .settings-sidebar {
      max-height: 60px;
    }

    .settings-sidebar-nav {
      padding: 4px 6px;
    }

    .settings-sidebar-item {
      min-height: var(--min-touch-target);
      padding: 4px 4px;
      gap: 2px;
    }

    .sidebar-icon {
      font-size: var(--font-size-lg);
    }

    .sidebar-label {
      font-size: var(--font-size-compact);
    }
  }

  /* Dropdown selector pattern (6+ tabs) - Activated automatically */
  .settings-sidebar-nav.use-dropdown {
    padding: 12px 16px;
    justify-content: center;
  }

  .tab-dropdown {
    width: 100%;
    max-width: 400px;
  }

  .dropdown-trigger {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 18px;
    background: var(--theme-card-bg);
    border: 1.5px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 10px;
    color: var(--theme-text);
    font-size: var(--font-size-base);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal) cubic-bezier(0.4, 0, 0.2, 1);
  }

  .dropdown-trigger:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
  }

  .dropdown-icon {
    font-size: var(--font-size-xl);
    flex-shrink: 0;
  }

  .dropdown-label {
    flex: 1;
    text-align: left;
  }

  .dropdown-arrow {
    font-size: var(--font-size-sm);
    transition: transform var(--duration-normal) ease;
    opacity: 0.7;
  }

  .dropdown-trigger:hover .dropdown-arrow {
    opacity: 1;
  }

  /* Mobile dropdown adjustments */
  @media (max-width: 768px) {
    .settings-sidebar-nav.use-dropdown {
      padding: 10px 14px;
    }

    .dropdown-trigger {
      padding: 12px 16px;
      font-size: var(--font-size-sm);
    }

    .dropdown-icon {
      font-size: var(--font-size-lg);
    }
  }
</style>
