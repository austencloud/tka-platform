<script lang="ts">
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import { releaseNotesDrawerState } from "../state/release-notes-drawer-state.svelte";
  import { versionService } from "$lib/features/feedback/services/implementations/VersionManager";
  import { handleModuleChange } from "$lib/shared/navigation-coordinator/navigation-coordinator.svelte";

  // Load version data when drawer opens
  $effect(() => {
    if (releaseNotesDrawerState.isOpen && !releaseNotesDrawerState.version) {
      loadCurrentVersion();
    }
  });

  async function loadCurrentVersion() {
    releaseNotesDrawerState.setLoading(true);
    releaseNotesDrawerState.setError(null);
    try {
      const versions = await versionService.getVersions();
      // Find the current version in the list
      const currentVersion = versions.find(
        (v) => v.version === __APP_VERSION__
      );
      releaseNotesDrawerState.setVersion(currentVersion || null);
    } catch (err) {
      releaseNotesDrawerState.setError("Failed to load release notes");
      console.error("Failed to load version:", err);
    } finally {
      releaseNotesDrawerState.setLoading(false);
    }
  }

  async function handleViewAllReleases() {
    releaseNotesDrawerState.close();
    // Navigate to settings module with release-notes tab
    await handleModuleChange("settings", "release-notes");
  }

  async function handleSubmitFeedback() {
    releaseNotesDrawerState.close();
    // Navigate to feedback module with submit tab
    await handleModuleChange("feedback", "submit");
  }

  // Detect if user is on desktop (has mouse/keyboard)
  const isDesktop = $derived(
    typeof window !== "undefined" &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches
  );

  function handleClose() {
    releaseNotesDrawerState.close();
  }

  // Derived helpers
  const version = $derived(releaseNotesDrawerState.version);
  const isLoading = $derived(releaseNotesDrawerState.isLoading);
  const error = $derived(releaseNotesDrawerState.error);

  const groupedChangelog = $derived.by(() => {
    if (!version?.changelogEntries)
      return { fixed: [], added: [], improved: [] };
    return {
      fixed: version.changelogEntries.filter((e) => e.category === "fixed"),
      added: version.changelogEntries.filter((e) => e.category === "added"),
      improved: version.changelogEntries.filter(
        (e) => e.category === "improved"
      ),
    };
  });
</script>

<Drawer
  bind:isOpen={releaseNotesDrawerState.isOpen}
  placement="right"
  showHandle={true}
  ariaLabel="Release Notes"
  class="release-notes-drawer"
>
  <div class="drawer-content-wrapper">
    <header class="drawer-header">
      <div class="header-content">
        <i class="fas fa-gift" aria-hidden="true"></i>
        <h2>What's New in v{__APP_VERSION__}</h2>
      </div>
      <button class="close-btn" onclick={handleClose} aria-label="Close">
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </header>

    <div class="drawer-body">
      {#if isLoading}
        <div class="loading-state">
          <div class="skeleton"></div>
          <div class="skeleton"></div>
        </div>
      {:else if error}
        <div class="error-state">
          <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
          <p>{error}</p>
        </div>
      {:else if version}
        {#if version.releaseNotes}
          <p class="release-notes-text">{version.releaseNotes}</p>
        {/if}

        {#if version.changelogEntries && version.changelogEntries.length > 0}
          {#each [{ key: "added" as const, label: "Added", icon: "fa-plus", color: "var(--semantic-success)" }, { key: "improved" as const, label: "Improved", icon: "fa-arrow-up", color: "var(--semantic-info)" }, { key: "fixed" as const, label: "Fixed", icon: "fa-wrench", color: "var(--semantic-warning)" }] as cat}
            {#if groupedChangelog[cat.key].length > 0}
              <section class="changelog-section">
                <h3 style="--cat-color: {cat.color}">
                  <i class="fas {cat.icon}" aria-hidden="true"></i>
                  {cat.label}
                </h3>
                <ul>
                  {#each groupedChangelog[cat.key] as entry}
                    <li>{entry.text}</li>
                  {/each}
                </ul>
              </section>
            {/if}
          {/each}
        {:else}
          <p class="no-changelog">
            No detailed changelog available for this version.
          </p>
        {/if}
      {:else}
        <p class="no-version">Version information not available.</p>
      {/if}
    </div>

    <div class="feedback-reminder">
      <div class="reminder-icon">
        <i class="fas fa-lightbulb" aria-hidden="true"></i>
      </div>
      <div class="reminder-content">
        <p class="reminder-heading">Have ideas or found a bug?</p>
        <p class="reminder-subtext">
          Your feedback shapes TKA Scribe. I read every submission!
        </p>
      </div>
      <button class="feedback-btn" onclick={handleSubmitFeedback}>
        Submit Feedback
        <i class="fas fa-arrow-right" aria-hidden="true"></i>
      </button>
      {#if isDesktop}
        <p class="keyboard-hint">
          <kbd>F</kbd> for quick feedback anytime
        </p>
      {/if}
    </div>

    <footer class="drawer-footer">
      <button class="view-all-btn" onclick={handleViewAllReleases}>
        <i class="fas fa-history" aria-hidden="true"></i>
        View All Releases
      </button>
    </footer>
  </div>
</Drawer>

<style>
  /* Solid opaque panel background - no blur, no transparency */
  :global(.drawer-content.release-notes-drawer) {
    --sheet-bg: rgb(15, 15, 20);
    --sheet-width: min(420px, 90vw);
    background: rgb(15, 15, 20) !important;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    opacity: 1;
  }

  .drawer-content-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid var(--theme-stroke);
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .header-content i {
    font-size: var(--font-size-xl);
    color: var(--theme-accent);
  }

  .header-content h2 {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: 600;
    color: var(--theme-text);
  }

  .close-btn {
    width: 48px; /* WCAG AAA touch target */
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--theme-text-dim, var(--theme-text-dim));
    cursor: pointer;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: var(--theme-card-bg);
    color: var(--theme-text, var(--theme-text));
  }

  .drawer-body {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
  }

  .release-notes-text {
    margin: 0 0 24px 0;
    font-size: var(--font-size-sm);
    line-height: 1.6;
    color: var(--theme-text);
  }

  .changelog-section {
    margin-bottom: 20px;
  }

  .changelog-section h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 12px 0;
    font-size: var(--font-size-compact);
    font-weight: 600;
    color: var(--cat-color);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .changelog-section ul {
    margin: 0;
    padding-left: 20px;
    list-style: disc;
  }

  .changelog-section li {
    margin-bottom: 8px;
    font-size: var(--font-size-sm);
    line-height: 1.5;
    color: var(--theme-text);
  }

  .no-changelog,
  .no-version {
    text-align: center;
    color: var(--theme-text-dim, var(--theme-text-dim));
    font-style: italic;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .skeleton {
    height: 60px;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border-radius: 8px;
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

  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 40px;
    text-align: center;
  }

  .error-state i {
    font-size: var(--font-size-3xl);
    color: var(--semantic-error);
    margin-bottom: 12px;
  }

  /* Feedback reminder section */
  .feedback-reminder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    margin: 0 24px;
    padding: 20px;
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--theme-accent) 8%, transparent),
      color-mix(in srgb, var(--theme-accent) 4%, transparent)
    );
    border: 1px solid color-mix(in srgb, var(--theme-accent) 20%, transparent);
    border-radius: 12px;
  }

  .reminder-icon {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--theme-accent) 15%, transparent);
    border-radius: 50%;
  }

  .reminder-icon i {
    font-size: var(--font-size-lg);
    color: var(--theme-accent);
  }

  .reminder-content {
    text-align: center;
  }

  .reminder-heading {
    margin: 0 0 4px 0;
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--theme-text);
  }

  .reminder-subtext {
    margin: 0;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    line-height: 1.4;
  }

  .feedback-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 20px;
    background: var(--theme-accent);
    border: none;
    border-radius: 8px;
    color: white;
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .feedback-btn:hover {
    filter: brightness(1.1);
    transform: translateY(-1px);
  }

  .feedback-btn:active {
    transform: translateY(0);
  }

  .feedback-btn i {
    font-size: var(--font-size-xs);
    transition: transform 0.2s;
  }

  .feedback-btn:hover i {
    transform: translateX(3px);
  }

  .keyboard-hint {
    margin: 4px 0 0 0;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .keyboard-hint kbd {
    display: inline-block;
    padding: 2px 6px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.1));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    border-radius: 4px;
    font-family: inherit;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text, #fff);
  }

  .drawer-footer {
    padding: 16px 24px;
    border-top: 1px solid var(--theme-stroke);
  }

  .view-all-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 16px;
    background: var(--theme-card-bg, var(--theme-card-bg));
    border: 1px solid var(--theme-stroke, var(--theme-stroke));
    border-radius: 10px;
    color: var(--theme-text, var(--theme-text));
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .view-all-btn:hover {
    background: var(--theme-card-hover-bg);
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .skeleton {
      animation: none;
    }
  }
</style>
