<!--
  SettingsTabContent.svelte

  Renders the appropriate settings tab based on activeTab.
  Uses lazy loading to only load tab components when needed.
-->
<script lang="ts">
  import type { AppSettings } from "../domain/AppSettings";
  import type { Component } from "svelte";

  interface Props {
    activeTab: string;
    settings: AppSettings;
    onSettingUpdate: (event: { key: string; value: unknown }) => void;
  }

  let { activeTab, settings, onSettingUpdate }: Props = $props();

  // Tab loader functions for lazy loading
  const tabLoaders: Record<string, () => Promise<{ default: Component<any> }>> =
    {
      Profile: () => import("./tabs/ProfileTab.svelte"),
      ReleaseNotes: () => import("./tabs/ReleaseNotesTab.svelte"),
      PropType: () => import("./tabs/PropTypeTab.svelte"),
      Theme: () => import("./tabs/background/BackgroundTab.svelte"),
      Visibility: () => import("./tabs/VisibilityTab.svelte"),
      Keyboard: () =>
        import("$lib/shared/keyboard/components/settings/KeyboardShortcutsTab.svelte"),
      Language: () => import("./tabs/LanguageTab.svelte"),
    };

  // Cache for loaded tab components
  const tabCache = new Map<string, Component<any>>();

  async function loadTab(tabName: string): Promise<Component<any> | null> {
    if (!tabLoaders[tabName]) return null;

    if (tabCache.has(tabName)) {
      return tabCache.get(tabName)!;
    }

    const { default: TabComponent } = await tabLoaders[tabName]();
    tabCache.set(tabName, TabComponent);
    return TabComponent;
  }

  let tabPromise = $derived(
    activeTab ? loadTab(activeTab) : Promise.resolve(null)
  );
</script>

<div class="settings-tab-wrapper">
  {#await tabPromise}
    <div class="tab-loading">
      <div class="loading-spinner"></div>
    </div>
  {:then LoadedTab}
    {#if LoadedTab}
      {#if activeTab === "Profile"}
        <LoadedTab currentSettings={settings} {onSettingUpdate} />
      {:else if activeTab === "ReleaseNotes"}
        <LoadedTab />
      {:else if activeTab === "PropType"}
        <LoadedTab {settings} onUpdate={onSettingUpdate} />
      {:else if activeTab === "Theme"}
        <LoadedTab {settings} onUpdate={onSettingUpdate} />
      {:else if activeTab === "Visibility"}
        <LoadedTab currentSettings={settings} {onSettingUpdate} />
      {:else if activeTab === "Keyboard"}
        <LoadedTab currentSettings={settings} {onSettingUpdate} />
      {:else if activeTab === "Language"}
        <LoadedTab />
      {/if}
    {/if}
  {:catch}
    <div class="tab-error">Failed to load settings tab</div>
  {/await}
</div>

<style>
  .settings-tab-wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .tab-loading {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 200px;
  }

  .loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border-color, #e0e0e0);
    border-top: 3px solid var(--primary-color, #007bff);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .tab-error {
    color: var(--error-color, #dc3545);
    text-align: center;
    padding: 20px;
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .loading-spinner {
      animation: none;
    }
  }
</style>
