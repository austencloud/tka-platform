<!--
NavigationDropdown - Sort & Jump Navigation
Provides unified dropdown for:
1. Sort method selection (Alphabetical, Length, Date)
2. Quick navigation to sections (dynamic based on sort method)
- Opens/closes via button click
- Stays open after clicking navigation items
- Click outside or button to dismiss

Responsive behavior:
- Desktop: Dropdown menu
- Mobile: Bottom sheet modal
-->
<script lang="ts">
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { IDeviceDetector } from "$lib/shared/device/services/contracts/IDeviceDetector";
  import { resolve } from "$lib/shared/inversify/di";
  import { TYPES } from "$lib/shared/inversify/types";
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import { onMount } from "svelte";
  import type { ResponsiveSettings } from "$lib/shared/device/domain/models/device-models";
  import { ExploreSortMethod } from "$lib/features/discover/shared/domain/enums/discover-enums";

  let hapticService: IHapticFeedback;
  let deviceDetector: IDeviceDetector | null = null;
  let responsiveSettings = $state<ResponsiveSettings | null>(null);

  // Determine if we should use mobile pattern
  const isMobile = $derived(responsiveSettings?.isMobile || false);

  // ✅ PURE RUNES: Props using modern Svelte 5 runes
  const {
    currentSortMethod = "ALPHABETICAL",
    availableSections = [],
    onSectionClick = () => {},
    onSortMethodChange = () => {},
  } = $props<{
    currentSortMethod?: ExploreSortMethod;
    availableSections?: string[];
    onSectionClick?: (section: string) => void;
    onSortMethodChange?: (method: ExploreSortMethod) => void;
  }>();

  // Available sort methods
  const sortMethods = [
    {
      value: ExploreSortMethod.ALPHABETICAL,
      label: "Letter",
      icon: "fa-font",
    },
    {
      value: ExploreSortMethod.SEQUENCE_LENGTH,
      label: "Length",
      icon: "fa-ruler-horizontal",
    },
    {
      value: ExploreSortMethod.DATE_ADDED,
      label: "Date",
      icon: "fa-calendar",
    },
  ];

  // Dropdown state
  let isOpen = $state<boolean>(false);
  let dropdownRef = $state<HTMLDivElement | null>(null);

  // Get header text based on sort method
  function getHeaderText(sortMethod: ExploreSortMethod): string {
    switch (sortMethod) {
      case ExploreSortMethod.ALPHABETICAL:
        return "Jump to Letter";
      case ExploreSortMethod.DIFFICULTY_LEVEL:
        return "Jump to Level";
      case ExploreSortMethod.SEQUENCE_LENGTH:
        return "Jump to Length";
      case ExploreSortMethod.DATE_ADDED:
        return "Jump to Date";
      default:
        return "Quick Navigation";
    }
  }

  // Get button label - simplified
  function getButtonLabel(sortMethod: ExploreSortMethod): string {
    const method = sortMethods.find((m) => m.value === sortMethod);
    return `Sort: ${method?.label || "Letter"}`;
  }

  // Handle sort method change
  function handleSortMethodChange(method: ExploreSortMethod) {
    hapticService?.trigger("selection");
    onSortMethodChange(method);
    // Keep dropdown open so user can then navigate to a section
  }

  // Handle section button click - STAYS OPEN after clicking
  function handleSectionClick(section: string) {
    hapticService?.trigger("selection");
    onSectionClick(section);
    // NOTE: We do NOT close the dropdown here - user can navigate multiple times
  }

  // Toggle dropdown
  function toggleDropdown() {
    hapticService?.trigger("selection");
    isOpen = !isOpen;
  }

  // Close dropdown
  function closeDropdown() {
    isOpen = false;
  }

  // Handle click outside
  function handleClickOutside(event: MouseEvent) {
    if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
      closeDropdown();
    }
  }

  // Get display text for section button
  function getSectionDisplayText(
    section: string,
    sortMethod: ExploreSortMethod
  ): string {
    let cleanText = section.replace(/\s*\(\d+\s+sequences?\)$/, "");

    if (
      sortMethod === ExploreSortMethod.DIFFICULTY_LEVEL &&
      cleanText.startsWith("Level ")
    ) {
      return cleanText.replace("Level ", "");
    }

    if (sortMethod === ExploreSortMethod.ALPHABETICAL) {
      const parts = cleanText.split(" - ");
      if (parts.length > 1 && parts[0]) {
        return parts[0].trim();
      }
      const match = cleanText.match(/([A-Z\u0370-\u03FF\u0400-\u04FF])/i);
      return match ? match[1] || cleanText : cleanText;
    }

    if (sortMethod === ExploreSortMethod.DIFFICULTY_LEVEL) {
      cleanText = cleanText.replace(/^[🟢🟡🔴⚪]\s*/, "");
    } else if (sortMethod === ExploreSortMethod.AUTHOR) {
      cleanText = cleanText.replace(/^👤\s*/, "");
    } else if (sortMethod === ExploreSortMethod.DATE_ADDED) {
      cleanText = cleanText.replace(/^📅\s*/, "");
    }

    return cleanText;
  }

  // Deduplicate sections when sorting alphabetically
  const uniqueSections = $derived(() => {
    if (currentSortMethod === ExploreSortMethod.ALPHABETICAL) {
      const seen = new Set<string>();
      return availableSections.filter((section: string) => {
        const letter = getSectionDisplayText(section, currentSortMethod);
        if (seen.has(letter)) {
          return false;
        }
        seen.add(letter);
        return true;
      });
    }
    return availableSections;
  });

  onMount(() => {
    hapticService = resolve<IHapticFeedback>(TYPES.IHapticFeedback);

    // Initialize DeviceDetector
    let cleanup: (() => void) | undefined;
    try {
      deviceDetector = resolve<IDeviceDetector>(TYPES.IDeviceDetector);
      responsiveSettings = deviceDetector.getResponsiveSettings();

      cleanup = deviceDetector.onCapabilitiesChanged(() => {
        responsiveSettings = deviceDetector!.getResponsiveSettings();
      });
    } catch (error) {
      console.warn(
        "NavigationDropdown: Failed to resolve DeviceDetector",
        error
      );
    }

    // Add click outside listener (desktop only)
    document.addEventListener("click", handleClickOutside);

    return () => {
      document.removeEventListener("click", handleClickOutside);
      cleanup?.();
    };
  });
</script>

<div class="navigation-dropdown" bind:this={dropdownRef}>
  <!-- Dropdown Toggle Button -->
  <button
    class="dropdown-toggle"
    class:active={isOpen}
    onclick={toggleDropdown}
    type="button"
    aria-label={getHeaderText(currentSortMethod)}
    aria-expanded={isOpen}
    aria-controls="navigation-dropdown-menu"
  >
    <i class="fas fa-bars" aria-hidden="true"></i>
    <span class="toggle-label">{getButtonLabel(currentSortMethod)}</span>
    <i
      class="fas fa-chevron-{isOpen ? 'up' : 'down'} chevron-icon"
      aria-hidden="true"
    ></i>
  </button>

  <!-- Desktop: Dropdown Menu -->
  {#if isOpen && !isMobile}
    <div class="dropdown-menu" id="navigation-dropdown-menu">
      <!-- Sort Method Section -->
      <div class="menu-section">
        <div class="section-header">Sort By</div>
        <div class="sort-methods">
          {#each sortMethods as method (method.value)}
            <button
              class="sort-method-button"
              class:active={currentSortMethod === method.value}
              onclick={() => handleSortMethodChange(method.value)}
              type="button"
            >
              <i class="fas {method.icon}" aria-hidden="true"></i>
              <span>{method.label}</span>
              {#if currentSortMethod === method.value}
                <i class="fas fa-check check-icon" aria-hidden="true"></i>
              {/if}
            </button>
          {/each}
        </div>
      </div>

      <!-- Divider -->
      <div class="divider"></div>

      <!-- Jump To Section -->
      <div class="menu-section">
        <div class="section-header">
          {getHeaderText(currentSortMethod)}
        </div>
        <div class="menu-items">
          {#each uniqueSections() as section (section)}
            <button
              class="menu-item"
              onclick={() => handleSectionClick(section)}
              type="button"
            >
              {getSectionDisplayText(section, currentSortMethod)}
            </button>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- Mobile: Drawer Sheet -->
{#if isMobile}
  <Drawer bind:isOpen placement="bottom" ariaLabel="Sort & Jump">
    <!-- Sort Method Section -->
    <div class="mobile-section">
      <div class="mobile-section-header">Sort By</div>
      <div class="mobile-sort-methods">
        {#each sortMethods as method (method.value)}
          <button
            class="mobile-sort-button"
            class:active={currentSortMethod === method.value}
            onclick={() => handleSortMethodChange(method.value)}
            type="button"
          >
            <i class="fas {method.icon}" aria-hidden="true"></i>
            <span>{method.label}</span>
            {#if currentSortMethod === method.value}
              <i class="fas fa-check check-icon" aria-hidden="true"></i>
            {/if}
          </button>
        {/each}
      </div>
    </div>

    <!-- Divider -->
    <div class="mobile-divider"></div>

    <!-- Jump To Section -->
    <div class="mobile-section">
      <div class="mobile-section-header">
        {getHeaderText(currentSortMethod)}
      </div>
      <div class="mobile-menu-items">
        {#each uniqueSections() as section (section)}
          <button
            class="mobile-menu-item"
            onclick={() => handleSectionClick(section)}
            type="button"
          >
            {getSectionDisplayText(section, currentSortMethod)}
          </button>
        {/each}
      </div>
    </div>
  </Drawer>
{/if}

<style>
  .navigation-dropdown {
    position: relative;
  }

  /* Dropdown Toggle Button */
  .dropdown-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: color-mix(in srgb, var(--theme-text, white) 10%, transparent);
    border: 1px solid
      color-mix(in srgb, var(--theme-text, white) 30%, transparent);
    border-radius: 8px;
    color: color-mix(in srgb, var(--theme-text, white) 90%, transparent);
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .dropdown-toggle:hover {
    background: color-mix(in srgb, var(--theme-text, white) 15%, transparent);
    border-color: color-mix(in srgb, var(--theme-text, white) 40%, transparent);
  }

  .dropdown-toggle.active {
    background: color-mix(in srgb, var(--theme-text, white) 20%, transparent);
    border-color: color-mix(in srgb, var(--theme-text, white) 50%, transparent);
  }

  .toggle-label {
    font-size: 0.95rem;
  }

  .chevron-icon {
    font-size: 0.75rem;
    opacity: 0.7;
    transition: transform 0.2s ease;
  }

  /* Dropdown Menu */
  .dropdown-menu {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    min-width: 280px;
    max-width: 360px;
    max-height: 500px;
    background: color-mix(in srgb, var(--theme-panel-bg) 95%, transparent);
    border: 1px solid var(--theme-stroke-strong);
    border-radius: 12px;
    box-shadow: 0 8px 32px var(--theme-shadow);
    z-index: 10000;
    overflow: hidden;
    animation: slideDown 0.2s ease;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Menu Sections */
  .menu-section {
    padding: 8px;
  }

  .section-header {
    padding: 8px 8px 4px 8px;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--theme-text-dim, var(--theme-text-dim));
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .divider {
    height: 1px;
    background: var(--theme-stroke);
    margin: 4px 0;
  }

  /* Sort Method Buttons */
  .sort-methods {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .sort-method-button {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: color-mix(in srgb, var(--theme-text, white) 90%, transparent);
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
  }

  .sort-method-button:hover {
    background: var(--theme-card-bg);
  }

  .sort-method-button.active {
    background: var(--theme-card-hover-bg, var(--theme-card-hover-bg));
    font-weight: 600;
  }

  .sort-method-button i:first-child {
    width: 18px;
    text-align: center;
    flex-shrink: 0;
  }

  .sort-method-button span {
    flex: 1;
  }

  .check-icon {
    color: var(--semantic-success);
    font-size: 0.875rem;
    flex-shrink: 0;
  }

  .menu-items {
    padding: 8px;
    max-height: 340px;
    overflow-y: auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
    gap: 6px;
  }

  /* Custom scrollbar */
  .menu-items::-webkit-scrollbar {
    width: 6px;
  }

  .menu-items::-webkit-scrollbar-track {
    background: var(--theme-card-bg);
    border-radius: 3px;
  }

  .menu-items::-webkit-scrollbar-thumb {
    background: var(--theme-stroke-strong);
    border-radius: 3px;
  }

  .menu-items::-webkit-scrollbar-thumb:hover {
    background: color-mix(in srgb, var(--theme-text, white) 30%, transparent);
  }

  .menu-item {
    padding: 10px 12px;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke-strong);
    border-radius: 8px;
    color: color-mix(in srgb, var(--theme-text, white) 90%, transparent);
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: center;
  }

  .menu-item:hover {
    background: var(--theme-card-hover-bg);
    border-color: color-mix(in srgb, var(--theme-text, white) 40%, transparent);
    transform: translateY(-1px);
  }

  .menu-item:active {
    transform: translateY(0);
  }

  /* Mobile responsiveness */
  @media (max-width: 480px) {
    .dropdown-toggle {
      padding: 8px 12px;
      font-size: 0.875rem;
    }

    .toggle-label {
      font-size: 0.875rem;
    }

    .dropdown-menu {
      min-width: 200px;
      max-height: 320px;
    }

    .menu-items {
      max-height: 260px;
      grid-template-columns: repeat(auto-fill, minmax(45px, 1fr));
    }

    .menu-item {
      padding: 8px 10px;
      font-size: 0.95rem;
    }
  }

  /* Mobile Bottom Sheet Styles */
  .mobile-section {
    margin-bottom: 24px;
  }

  .mobile-section-header {
    padding: 0 0 12px 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--theme-text-dim, var(--theme-text-dim));
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .mobile-sort-methods {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .mobile-sort-button {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 20px;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 12px;
    color: color-mix(in srgb, var(--theme-text, white) 90%, transparent);
    font-size: 1.1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
  }

  .mobile-sort-button:active {
    background: var(--theme-card-hover-bg);
    transform: scale(0.98);
  }

  .mobile-sort-button.active {
    background: var(--theme-card-hover-bg, var(--theme-card-hover-bg));
    border-color: var(--theme-stroke-strong);
    font-weight: 600;
  }

  .mobile-sort-button i:first-child {
    width: 24px;
    text-align: center;
    flex-shrink: 0;
  }

  .mobile-sort-button span {
    flex: 1;
  }

  .mobile-sort-button .check-icon {
    color: var(--semantic-success);
    font-size: 1rem;
    flex-shrink: 0;
  }

  .mobile-divider {
    height: 1px;
    background: var(--theme-stroke);
    margin: 20px 0;
  }

  .mobile-menu-items {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
    gap: 8px;
  }

  .mobile-menu-item {
    padding: 16px 12px;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke-strong);
    border-radius: 12px;
    color: color-mix(in srgb, var(--theme-text, white) 90%, transparent);
    font-size: 1.1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: center;
  }

  .mobile-menu-item:active {
    background: var(--theme-card-hover-bg);
    border-color: color-mix(in srgb, var(--theme-text, white) 40%, transparent);
    transform: scale(0.96);
  }
</style>
