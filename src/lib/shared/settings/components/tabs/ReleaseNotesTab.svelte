<!-- ReleaseNotesTab - Version history and release notes -->
<script lang="ts">
  import { createVersionState } from "$lib/features/feedback/state/version-state.svelte";
  import type { AppVersion } from "$lib/features/feedback/domain/models/version-models";
  import VersionCard from "./release-notes/VersionCard.svelte";
  import VersionDetailPanel from "./release-notes/VersionDetailPanel.svelte";
  import { versionService } from "$lib/features/feedback/services/implementations/VersionManager";

  // Create version state
  const versionState = createVersionState();

  // Expose seed function globally for one-time use (can be removed after seeding)
  if (typeof window !== "undefined") {
    (
      window as unknown as { seedChangelog: () => Promise<void> }
    ).seedChangelog = async () => {
      await versionService.seedV010Changelog();
      versionState.loadVersions();
    };
  }

  // Load versions on mount
  $effect(() => {
    versionState.loadVersions();
  });

  // Selected version for detail panel
  let selectedVersion = $state<AppVersion | null>(null);
  let isPanelOpen = $state(false);

  function openVersionDetail(version: AppVersion) {
    selectedVersion = version;
    isPanelOpen = true;
  }

  async function handleVersionUpdated() {
    // Reload versions to get updated changelog
    await versionState.loadVersions();
    // Update selected version with fresh data
    if (selectedVersion) {
      const updated = versionState.versions.find(
        (v) => v.version === selectedVersion?.version
      );
      if (updated) {
        selectedVersion = updated;
      }
    }
  }
</script>

<div class="release-notes-tab">
  <header class="tab-header">
    <div class="header-content">
      <h2>
        <i class="fas fa-gift" aria-hidden="true"></i>
        Release Notes
      </h2>
    </div>
  </header>

  <div class="tab-content">
    {#if versionState.isLoading && versionState.versions.length === 0}
      <div class="loading-state">
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
      </div>
    {:else if versionState.error}
      <div class="error-state">
        <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
        <p>{versionState.error}</p>
        <button type="button" onclick={() => versionState.loadVersions()}>
          Try Again
        </button>
      </div>
    {:else if versionState.versions.length === 0}
      <div class="empty-state">
        <i class="fas fa-rocket" aria-hidden="true"></i>
        <h3>No Releases Yet</h3>
        <p>Check back soon for updates!</p>
      </div>
    {:else}
      <div class="versions-list">
        {#each versionState.versions as version (version.version)}
          <VersionCard {version} onclick={() => openVersionDetail(version)} />
        {/each}
      </div>
    {/if}
  </div>

  <!-- Detail Panel -->
  <VersionDetailPanel
    version={selectedVersion}
    bind:isOpen={isPanelOpen}
    onVersionUpdated={handleVersionUpdated}
  />
</div>

<style>
  .release-notes-tab {
    display: flex;
    flex-direction: column;
    gap: 20px;
    height: 100%;
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
  }

  .tab-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--theme-stroke);
  }

  .header-content h2 {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    font-size: var(--font-size-xl);
    font-weight: 600;
    color: var(--theme-text);
  }

  .header-content h2 i {
    color: var(--theme-accent);
  }

  .tab-content {
    flex: 1;
    overflow-y: auto;
    padding-right: 4px;
  }

  .tab-content::-webkit-scrollbar {
    width: 6px;
  }

  .tab-content::-webkit-scrollbar-track {
    background: var(--scrollbar-track, transparent);
  }

  .tab-content::-webkit-scrollbar-thumb {
    background: var(--scrollbar-accent);
    border-radius: 3px;
  }

  .tab-content::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-accent-hover);
  }

  .versions-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* Loading state */
  .loading-state {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .skeleton-card {
    height: 72px;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border-radius: 12px;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  /* Error state */
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 50px 24px;
    text-align: center;
  }

  .error-state i {
    font-size: var(--font-size-3xl);
    color: var(--semantic-error);
    margin-bottom: 12px;
  }

  .error-state p {
    margin: 0 0 16px 0;
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  .error-state button {
    padding: 8px 16px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    color: var(--theme-text, var(--theme-text));
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: all var(--duration-normal);
  }

  .error-state button:hover {
    background: var(--theme-card-hover-bg);
  }

  /* Empty state */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 64px 24px;
    text-align: center;
  }

  .empty-state i {
    font-size: var(--font-size-3xl);
    color: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent-strong)) 40%,
      transparent
    );
    margin-bottom: 16px;
  }

  .empty-state h3 {
    margin: 0 0 8px 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--theme-text);
  }

  .empty-state p {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .skeleton-card {
      animation: none;
    }
  }
</style>
