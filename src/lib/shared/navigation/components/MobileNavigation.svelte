<!-- Mobile Navigation - Responsive Bottom/Side Navigation Orchestrator -->
<!-- Automatically adapts between bottom (portrait) and side (landscape) layouts -->
<script lang="ts">
  import { container } from "../../di";
  import type { IDeviceDetector } from "../../device/services/contracts/IDeviceDetector";
  import type { ResponsiveSettings } from "../../device/domain/models/device-models";
  import { onMount } from "svelte";
  import type { Section, ModuleId } from "../domain/types";
  import { navigationState } from "../state/navigation-state.svelte";
  import { handleModuleChange } from "../../navigation-coordinator/navigation-coordinator.svelte";
  import BottomNavigation from "./layouts/BottomNavigation.svelte";
  import SideNavigation from "./layouts/SideNavigation.svelte";

  let {
    sections = [],
    currentSection,
    onSectionChange,
    onModuleSwitcherTap,
    onLayoutChange,
    onHeightChange,
    showModuleSwitcher = true,
    showSettings = true,
    isUIVisible = true,
    onRevealNav = () => {},
    isDashboard = false,
  } = $props<{
    sections: Section[];
    currentSection: string;
    onSectionChange?: (sectionId: string) => void;
    onModuleSwitcherTap?: () => void;
    onLayoutChange?: (isLandscape: boolean) => void;
    onHeightChange?: (height: number) => void;
    showModuleSwitcher?: boolean;
    showSettings?: boolean;
    isUIVisible?: boolean;
    onRevealNav?: () => void;
    isDashboard?: boolean;
  }>();

  // Services
  let deviceDetector: IDeviceDetector | null = null;

  // Responsive settings from DeviceDetector (single source of truth)
  let responsiveSettings = $state<ResponsiveSettings | null>(null);

  // Layout state - use DeviceDetector instead of duplicating logic
  let isLandscape = $derived(responsiveSettings?.isLandscapeMobile ?? false);

  // Settings module active state
  let isSettingsActive = $derived(navigationState.currentModule === "settings");

  async function handleSettingsTap() {
    // Toggle behavior: if in settings, go back to previous module
    if (navigationState.currentModule === "settings") {
      const previousModule = navigationState.previousModule || "dashboard";
      await handleModuleChange(previousModule as ModuleId);
    } else {
      await handleModuleChange("settings" as ModuleId);
    }
  }

  // Notify parent when layout changes (reactive to isLandscape derived value)
  $effect(() => {
    // Notify parent of current layout state when it changes
    onLayoutChange?.(isLandscape);
    return undefined;
  });

  onMount(() => {
    // Resolve DeviceDetector service
    let deviceCleanup: (() => void) | undefined;
    try {
      deviceDetector = container.items.deviceDetector;

      // Get initial responsive settings
      responsiveSettings = deviceDetector.getResponsiveSettings();

      // Return cleanup function from onCapabilitiesChanged
      deviceCleanup = deviceDetector.onCapabilitiesChanged(() => {
        responsiveSettings = deviceDetector!.getResponsiveSettings();
      });
    } catch (error) {
      console.warn("MobileNavigation: Failed to resolve DeviceDetector", error);
    }

    // Return cleanup function
    return () => {
      deviceCleanup?.();
    };
  });
</script>

{#if isLandscape}
  <SideNavigation
    {sections}
    {currentSection}
    {onSectionChange}
    {onModuleSwitcherTap}
    onSettingsTap={handleSettingsTap}
    {showModuleSwitcher}
    {showSettings}
    {isSettingsActive}
    {isUIVisible}
  />
{:else}
  <BottomNavigation
    {sections}
    {currentSection}
    {onSectionChange}
    {onModuleSwitcherTap}
    onSettingsTap={handleSettingsTap}
    {onHeightChange}
    {showModuleSwitcher}
    {showSettings}
    {isSettingsActive}
    {isUIVisible}
    {onRevealNav}
    {isDashboard}
  />
{/if}
