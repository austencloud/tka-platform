<script lang="ts">
  /**
   * LandingPreviewModule
   *
   * Admin-only module for previewing and iterating on public pages.
   * Each tab corresponds to an actual public route: /landing, /about, /terms, etc.
   *
   * Now embedded as a Lab tab, this module manages its own internal tab navigation
   * since the sidebar tabs are LAB_TABS, not our internal page tabs.
   *
   * Link interception: Clicks on internal links (back buttons, CTAs pointing to
   * other public pages) are intercepted and mapped to tab navigation instead of
   * actual route navigation. This keeps the user inside the preview module.
   */
  import { onMount } from "svelte";
  import { BackgroundType } from "@austencloud/backgrounds";
  import ProgressRing from "$lib/shared/components/loading/ProgressRing.svelte";
  import { applyThemeForBackground } from "$lib/shared/settings/utils/background-theme-calculator";

  // Internal tabs - these are NOT sidebar tabs, they're internal to this module
  const INTERNAL_TABS = [
    { id: "landing", label: "Landing", icon: "fa-rocket" },
    { id: "videos", label: "Videos", icon: "fa-film" },
    { id: "about", label: "About", icon: "fa-info-circle" },
    { id: "notation", label: "Notation", icon: "fa-language" },
    { id: "terms", label: "Terms", icon: "fa-file-contract" },
    { id: "privacy", label: "Privacy", icon: "fa-shield-alt" },
    { id: "curator", label: "Curator", icon: "fa-video" },
  ];

  // Lazy-load the public page content components
  // These are the actual route components - we embed them directly.
  // The landing route was removed; its loader resolves to a typed `null`
  // component so the tab renders the "Failed to load page" fallback instead of
  // crashing — no `as any` suppression hiding the missing route.
  const pageLoaders = {
    landing: (): Promise<{ default: null }> =>
      Promise.resolve({ default: null }),
    about: () => import("../../../routes/(public)/about/+page.svelte"),
    notation: () => import("../../../routes/(public)/notation/+page.svelte"),
    terms: () => import("../../../routes/(public)/terms/+page.svelte"),
    privacy: () => import("../../../routes/(public)/privacy/+page.svelte"),
  };

  // Map routes to tab IDs
  const routeToTab: Record<string, string> = {
    "/": "landing",
    "/landing": "landing",
    "/about": "about",
    "/notation": "notation",
    "/terms": "terms",
    "/privacy": "privacy",
  };

  // Dev-only components (not public pages)
  import VideoGalleryPrototypes from "./components/VideoGalleryPrototypes.svelte";
  import VideoCurator from "./components/VideoCurator.svelte";

  const STORAGE_KEY = "tka-landing-theme";
  const DEFAULT_BACKGROUND = BackgroundType.COSMIC;

  let currentBackground = $state<BackgroundType>(DEFAULT_BACKGROUND);
  let mounted = $state(false);
  let loadedPage = $state<any>(null);
  let isLoading = $state(false);
  let contentArea = $state<HTMLDivElement | null>(null);

  // Internal tab state (not connected to sidebar navigation)
  let currentTab = $state("landing");

  // Dev-only tabs that don't load a public page component
  const devOnlyTabs = ["videos", "curator"];

  // Load page component when tab changes
  $effect(() => {
    const tab = currentTab;
    if (devOnlyTabs.includes(tab)) {
      loadedPage = null;
      return;
    }

    const loader = pageLoaders[tab as keyof typeof pageLoaders];
    if (loader) {
      isLoading = true;
      loader()
        .then((module) => {
          loadedPage = module.default;
          isLoading = false;
        })
        .catch(() => {
          loadedPage = null;
          isLoading = false;
        });
    }
  });

  /**
   * Intercept link clicks within embedded pages.
   * Maps internal routes to tab navigation instead of actual page navigation.
   */
  function handleLinkClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const anchor = target.closest("a");
    if (!anchor) return;

    const href = anchor.getAttribute("href");
    if (!href) return;

    // Check if this is an internal route we can map to a tab
    const tabId = routeToTab[href];
    if (tabId) {
      event.preventDefault();
      event.stopPropagation();
      currentTab = tabId;
      return;
    }

    // For external links (like app.tkanotation.com), let them proceed normally
    // but only if they have target="_blank" or are truly external
    if (href.startsWith("http") || anchor.getAttribute("target") === "_blank") {
      return; // Allow external links
    }

    // Block any other internal navigation that would leave the preview
    if (href.startsWith("/") && !routeToTab[href]) {
      event.preventDefault();
      console.warn(
        `Landing Preview: Blocked navigation to ${href} (not a previewable route)`
      );
    }
  }

  onMount(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (
      saved &&
      Object.values(BackgroundType).includes(saved as BackgroundType)
    ) {
      currentBackground = saved as BackgroundType;
    }
    applyThemeForBackground(currentBackground);
    mounted = true;
  });

  // Route path for current tab
  const routePath = $derived(
    devOnlyTabs.includes(currentTab)
      ? "(dev only)"
      : currentTab === "landing"
        ? "/landing"
        : `/${currentTab}`
  );
</script>

<div class="landing-preview-module">
  <!-- Internal tab bar (since we're now embedded in Lab) -->
  <div class="internal-tabs" role="tablist">
    {#each INTERNAL_TABS as tab}
      <button
        class="internal-tab"
        class:active={currentTab === tab.id}
        onclick={() => (currentTab = tab.id)}
        role="tab"
        aria-selected={currentTab === tab.id}
      >
        <i class="fas {tab.icon}" aria-hidden="true"></i>
        <span>{tab.label}</span>
      </button>
    {/each}
  </div>

  <!-- Info bar showing which route this corresponds to -->
  <div class="route-info-bar">
    <span class="route-label">
      <i class="fas fa-link" aria-hidden="true"></i>
      Route: <code>{routePath}</code>
    </span>
    {#if !devOnlyTabs.includes(currentTab)}
      <a href={routePath} target="_blank" rel="noopener" class="open-link">
        Open in new tab
        <i class="fas fa-external-link-alt" aria-hidden="true"></i>
      </a>
    {/if}
  </div>

  <!-- Content area with link interception -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="content-area"
    bind:this={contentArea}
    onclick={handleLinkClick}
    role="main"
  >
    {#if currentTab === "videos"}
      <VideoGalleryPrototypes />
    {:else if currentTab === "curator"}
      <VideoCurator />
    {:else if isLoading}
      <div class="loading-state">
        <ProgressRing percent={-1} size={32} strokeWidth={3} />
        <span>Loading {currentTab}...</span>
      </div>
    {:else if loadedPage}
      <!-- Render the actual public page component -->
      <div class="page-embed">
        {#if loadedPage}
          {@const PageComponent = loadedPage}
          <PageComponent />
        {/if}
      </div>
    {:else}
      <div class="error-state">
        <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
        <span>Failed to load page</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .landing-preview-module {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  /* Internal tabs (since we're embedded in Lab) */
  .internal-tabs {
    display: flex;
    gap: 4px;
    padding: 8px 12px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    overflow-x: auto;
    flex-shrink: 0;
  }

  .internal-tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    min-height: 36px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-sm, 14px);
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }

  .internal-tab:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    color: var(--theme-text, white);
  }

  .internal-tab.active {
    background: var(--theme-accent, #6366f1);
    color: white;
  }

  .internal-tab i {
    font-size: 12px;
  }

  /* Route info bar */
  .route-info-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.95));
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    flex-shrink: 0;
  }

  .route-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .route-label i {
    color: var(--theme-accent, #6366f1);
  }

  .route-label code {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    padding: 2px 8px;
    border-radius: 4px;
    font-family: monospace;
    color: var(--theme-text, white);
  }

  .open-link {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 6px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    text-decoration: none;
    font-size: var(--font-size-sm, 14px);
    transition: all 0.2s ease;
  }

  .open-link:hover {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.1));
    color: var(--theme-text, white);
  }

  /* Content area */
  .content-area {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    position: relative;
  }

  .page-embed {
    min-height: 100%;
    position: relative;
  }

  /*
   * Override position: fixed in embedded pages.
   * Public pages like /landing use position: fixed for backgrounds,
   * which breaks out of containers. We convert to absolute positioning
   * to keep them contained within the preview area.
   */
  .page-embed :global(.background-layer) {
    position: absolute !important;
  }

  .page-embed :global(.landing-page) {
    min-height: 100%;
    overflow: visible;
  }

  /* Loading state */
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    height: 100%;
    min-height: 300px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  /* Error state */
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    height: 100%;
    min-height: 300px;
    color: var(--semantic-error, #ef4444);
  }

  .error-state i {
    font-size: 32px;
  }
</style>
