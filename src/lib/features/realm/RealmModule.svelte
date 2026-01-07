<script lang="ts">
  /**
   * RealmModule
   *
   * Container for 3D experiences - Stage (avatar viewer) and Museum (gallery walkthrough).
   * Handles tab navigation between the two experiences.
   */

  import { navigationState } from "$lib/shared/navigation/state/navigation-state.svelte";
  import { REALM_TABS } from "$lib/shared/navigation/config/tab-definitions";

  // Lazy load the tab content
  const tabLoaders = {
    stage: () => import("$lib/shared/3d-animation/Viewer3DModule.svelte"),
    museum: () => import("../gallery/GalleryModule.svelte"),
  };

  // Get current tab, default to stage
  let currentTab = $derived(navigationState.activeTab || "stage");

  // Load the active tab component
  let tabPromise = $derived(
    tabLoaders[currentTab as keyof typeof tabLoaders]?.() ||
      tabLoaders.stage()
  );
</script>

<div class="realm-module">
  {#key currentTab}
    {#await tabPromise}
      <div class="loading">
        <div class="spinner"></div>
        <p>Loading {currentTab}...</p>
      </div>
    {:then module}
      <svelte:component this={module.default} />
    {:catch error}
      <div class="error">
        <p>Failed to load {currentTab}</p>
        <p class="details">{error?.message}</p>
      </div>
    {/await}
  {/key}
</div>

<style>
  .realm-module {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--theme-panel-bg, #12121c);
  }

  .loading,
  .error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 3px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-top-color: var(--theme-accent, #06b6d4);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 16px;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error {
    color: var(--semantic-error, #ef4444);
  }

  .details {
    font-size: var(--font-size-compact, 12px);
    opacity: 0.7;
  }
</style>
