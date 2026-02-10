<!--
  ScreenshotGallery — Module-organized gallery with collapsible sections,
  "not captured" placeholders, device filter chips, Ctrl+Scroll zoom, S/M/L presets,
  and MediaSpotlight viewer.

  Supports two source modes:
  - Local: fetches manifest from Vite dev server at /screenshots/manifest.json
  - Cloud: subscribes to Firestore via ScreenshotLoader for real-time updates
-->
<script lang="ts">
  import { untrack } from "svelte";
  import type { DeviceCategory } from "../../services/contracts/IScreenshotOrchestrator";
  import type { ScreenshotMetadata } from "../../services/contracts/IScreenshotUploader";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";
  import { MediaSpotlight, type MediaItem, type SpotlightConfig } from "@austencloud/media-spotlight";

  interface Props {
    /** Incremented externally to force a manifest refresh (e.g. after capture) */
    refreshToken?: number;
  }

  let { refreshToken = 0 }: Props = $props();

  let hapticService: IHapticFeedback;

  onMount(() => {
    hapticService = container.items.hapticFeedback;
  });

  // ─── Source mode ───────────────────────────────────────────────────────────

  type SourceMode = "local" | "cloud";

  let sourceMode = $state<SourceMode>("local");
  let cloudUnsubscribe: (() => void) | null = null;

  function setSourceMode(mode: SourceMode) {
    if (mode === sourceMode) return;
    hapticService?.trigger("selection");

    // Clean up previous cloud subscription
    if (cloudUnsubscribe) {
      cloudUnsubscribe();
      cloudUnsubscribe = null;
    }

    sourceMode = mode;

    if (mode === "cloud") {
      loadCloudScreenshots();
    } else {
      cloudScreenshots = [];
      cloudError = null;
      fetchManifest();
    }
  }

  // ─── Local mode state ─────────────────────────────────────────────────────

  interface CaptureInfo {
    filename: string;
    routeLabel: string;
    deviceSlug: string;
    hasBaseline: boolean;
  }

  interface ManifestResponse {
    captures: CaptureInfo[];
    timestamp: string | null;
  }

  let captures = $state<CaptureInfo[]>([]);
  let timestamp = $state<string | null>(null);
  let loading = $state(true);
  let fetchError = $state<string | null>(null);

  // ─── Cloud mode state ─────────────────────────────────────────────────────

  let cloudScreenshots = $state<ScreenshotMetadata[]>([]);
  let cloudLoading = $state(false);
  let cloudError = $state<string | null>(null);

  // ─── Shared state ─────────────────────────────────────────────────────────

  type FilterCategory = "all" | DeviceCategory;

  // Device dimensions lookup
  const DEVICE_MAP: Record<
    string,
    { name: string; w: number; h: number; category: DeviceCategory }
  > = {
    "iphone-se": { name: "iPhone SE", w: 375, h: 667, category: "phone" },
    "iphone-16-pro": { name: "iPhone 16 Pro", w: 393, h: 852, category: "phone" },
    "iphone-16-pro-max": { name: "iPhone 16 Pro Max", w: 430, h: 932, category: "phone" },
    "galaxy-s24": { name: "Galaxy S24", w: 360, h: 780, category: "phone" },
    "galaxy-s24-ultra": { name: "Galaxy S24 Ultra", w: 412, h: 915, category: "phone" },
    "ipad-mini": { name: "iPad Mini", w: 768, h: 1024, category: "tablet" },
    "ipad-air": { name: "iPad Air", w: 820, h: 1180, category: "tablet" },
    "desktop-hd": { name: "Desktop HD", w: 1366, h: 768, category: "desktop" },
    "desktop-fhd": { name: "Desktop FHD", w: 1920, h: 1080, category: "desktop" },
  };

  const ALL_DEVICE_SLUGS = Object.keys(DEVICE_MAP);

  const MODULE_NAMES: Record<string, string> = {
    public: "Public Pages",
    create: "Create",
    browse: "Browse",
    compose: "Compose",
    learn: "Learn",
    train: "Train",
    settings: "Settings",
    feedback: "Feedback",
  };

  const SIZE_PRESETS = [
    { label: "S", value: 200 },
    { label: "M", value: 340 },
    { label: "L", value: 520 },
  ] as const;

  let activeFilter = $state<FilterCategory>("all");
  let columnMin = $state(280);
  let collapsedModules = $state<Record<string, boolean>>({});
  let spotlightOpen = $state(false);
  let spotlightIndex = $state(0);
  let galleryElement = $state<HTMLDivElement | null>(null);

  const activePreset = $derived.by(() => {
    for (const preset of SIZE_PRESETS) {
      if (Math.abs(columnMin - preset.value) <= 30) return preset.label;
    }
    return null;
  });

  // ─── Unified data model ───────────────────────────────────────────────────

  /** Normalized capture item used for display in both modes */
  interface GalleryItem {
    id: string;
    filename: string;
    routeLabel: string;
    module: string;
    deviceSlug: string;
    deviceCategory: DeviceCategory;
    deviceName: string;
    width: number;
    height: number;
    imageUrl: string;
    tagIds: string[];
    capturedAt: Date | null;
  }

  /** Convert local CaptureInfo to GalleryItem */
  function localToGalleryItem(c: CaptureInfo): GalleryItem {
    const device = DEVICE_MAP[c.deviceSlug];
    return {
      id: c.filename,
      filename: c.filename,
      routeLabel: c.routeLabel,
      module: getModuleFromLabel(c.routeLabel),
      deviceSlug: c.deviceSlug,
      deviceCategory: device?.category ?? "desktop",
      deviceName: device?.name ?? c.deviceSlug,
      width: device?.w ?? 0,
      height: device?.h ?? 0,
      imageUrl: `/screenshots/captures/${c.filename}`,
      tagIds: [],
      capturedAt: null,
    };
  }

  /** Convert cloud ScreenshotMetadata to GalleryItem */
  function cloudToGalleryItem(s: ScreenshotMetadata): GalleryItem {
    return {
      id: s.id,
      filename: s.filename,
      routeLabel: s.routeLabel,
      module: s.module,
      deviceSlug: s.deviceSlug,
      deviceCategory: s.deviceCategory,
      deviceName: s.deviceName,
      width: s.width,
      height: s.height,
      imageUrl: s.downloadUrl,
      tagIds: s.tagIds,
      capturedAt: s.capturedAt,
    };
  }

  /** All gallery items from the active source */
  const galleryItems = $derived.by(() => {
    if (sourceMode === "cloud") {
      return cloudScreenshots.map(cloudToGalleryItem);
    }
    return captures.map(localToGalleryItem);
  });

  const isLoading = $derived(sourceMode === "local" ? loading : cloudLoading);
  const errorMessage = $derived(sourceMode === "local" ? fetchError : cloudError);
  const hasItems = $derived(galleryItems.length > 0);

  // ─── Grouping & filtering ─────────────────────────────────────────────────

  function getModuleFromLabel(label: string): string {
    const dashIdx = label.indexOf("--");
    if (dashIdx > 0) return label.substring(0, dashIdx);
    const publicLabels = ["landing", "about", "privacy", "terms", "roots"];
    if (publicLabels.includes(label)) return "public";
    return label;
  }

  const moduleGroups = $derived.by(() => {
    const groups = new Map<string, Map<string, GalleryItem[]>>();
    for (const item of galleryItems) {
      if (!groups.has(item.module)) groups.set(item.module, new Map());
      const routeMap = groups.get(item.module)!;
      if (!routeMap.has(item.routeLabel)) routeMap.set(item.routeLabel, []);
      routeMap.get(item.routeLabel)!.push(item);
    }
    return groups;
  });

  const filteredModuleGroups = $derived.by(() => {
    if (activeFilter === "all") return moduleGroups;

    const filtered = new Map<string, Map<string, GalleryItem[]>>();
    for (const [moduleId, routeMap] of moduleGroups) {
      const filteredRoutes = new Map<string, GalleryItem[]>();
      for (const [route, items] of routeMap) {
        const matching = items.filter((c) => c.deviceCategory === activeFilter);
        if (matching.length > 0) filteredRoutes.set(route, matching);
      }
      if (filteredRoutes.size > 0) filtered.set(moduleId, filteredRoutes);
    }
    return filtered;
  });

  const flatItems = $derived.by(() => {
    const result: GalleryItem[] = [];
    for (const [, routeMap] of filteredModuleGroups) {
      for (const [, items] of routeMap) {
        result.push(...items);
      }
    }
    return result;
  });

  const spotlightItems: MediaItem[] = $derived(
    flatItems.map((item) => ({
      id: item.id,
      url: item.imageUrl,
      type: "image" as const,
      alt: `${formatRouteLabel(item.routeLabel)} on ${item.deviceName}`,
      name: `${item.deviceName} — ${formatRouteLabel(item.routeLabel)}`,
      width: item.width || undefined,
      height: item.height || undefined,
    }))
  );

  const spotlightConfig: SpotlightConfig = {
    showFilmstrip: true,
    showArrows: true,
    showClose: true,
    enableSwipeNav: true,
    enableSwipeDismiss: true,
    enablePinchZoom: true,
    enableDoubleTapZoom: true,
    loop: false,
  };

  const stats = $derived({
    totalScreenshots: galleryItems.length,
    routeCount: new Set(galleryItems.map((c) => c.routeLabel)).size,
    deviceCount: new Set(galleryItems.map((c) => c.deviceSlug)).size,
  });

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function getAspectRatio(slug: string): number {
    const d = DEVICE_MAP[slug];
    return d ? d.w / d.h : 0.5;
  }

  function getDeviceName(slug: string): string {
    return DEVICE_MAP[slug]?.name ?? slug;
  }

  function getDeviceDims(slug: string): string {
    const d = DEVICE_MAP[slug];
    return d ? `${d.w}\u00D7${d.h}` : "";
  }

  function getCategoryColor(slug: string): string {
    const cat = DEVICE_MAP[slug]?.category;
    if (cat === "phone") return "#22c55e";
    if (cat === "tablet") return "#f59e0b";
    if (cat === "desktop") return "#3b82f6";
    return "#94a3b8";
  }

  function getCategoryLabel(slug: string): string {
    const cat = DEVICE_MAP[slug]?.category;
    if (cat === "phone") return "Phone";
    if (cat === "tablet") return "Tablet";
    if (cat === "desktop") return "Desktop";
    return "Unknown";
  }

  function formatRouteLabel(label: string): string {
    return label.replace(/--/g, " / ").replace(/(^|\s)\w/g, (c) => c.toUpperCase());
  }

  function formatTimestamp(iso: string): string {
    return new Date(iso).toLocaleString();
  }

  function openSpotlight(item: GalleryItem) {
    const idx = flatItems.findIndex((c) => c.id === item.id);
    spotlightIndex = idx >= 0 ? idx : 0;
    spotlightOpen = true;
  }

  function handleWheel(e: WheelEvent) {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 20 : -20;
    columnMin = Math.max(180, Math.min(600, columnMin + delta));
  }

  function setPreset(value: number) {
    hapticService?.trigger("selection");
    columnMin = value;
  }

  function toggleModuleCollapse(moduleId: string) {
    collapsedModules = {
      ...collapsedModules,
      [moduleId]: !collapsedModules[moduleId],
    };
  }

  function getMissingDevices(routeItems: GalleryItem[]): string[] {
    if (sourceMode === "cloud") return []; // Cloud mode doesn't track missing devices
    const capturedSlugs = new Set(routeItems.map((c) => c.deviceSlug));
    return ALL_DEVICE_SLUGS.filter((slug) => {
      if (!capturedSlugs.has(slug)) {
        if (activeFilter === "all") return true;
        return DEVICE_MAP[slug]?.category === activeFilter;
      }
      return false;
    });
  }

  const FILTERS: { value: FilterCategory; label: string }[] = [
    { value: "all", label: "All" },
    { value: "phone", label: "Phone" },
    { value: "tablet", label: "Tablet" },
    { value: "desktop", label: "Desktop" },
  ];

  // ─── Local manifest fetching ──────────────────────────────────────────────

  async function fetchManifest() {
    loading = true;
    fetchError = null;

    try {
      const res = await fetch("/screenshots/manifest.json");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ManifestResponse;
      captures = data.captures;
      timestamp = data.timestamp;
    } catch (err) {
      fetchError = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  }

  // ─── Cloud Firestore loading ──────────────────────────────────────────────

  function loadCloudScreenshots() {
    cloudLoading = true;
    cloudError = null;

    try {
      const loader = container.items.screenshotLoader;
      cloudUnsubscribe = loader.subscribeToScreenshots((screenshots: ScreenshotMetadata[]) => {
        cloudScreenshots = screenshots;
        cloudLoading = false;
      });
    } catch (err) {
      cloudError = err instanceof Error ? err.message : String(err);
      cloudLoading = false;
    }
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  // Fetch local manifest on mount (default mode)
  $effect(() => {
    untrack(() => {
      if (sourceMode === "local") fetchManifest();
    });
  });

  // Re-fetch when refreshToken changes (local mode only)
  $effect(() => {
    const _ = refreshToken;
    if (_ > 0 && sourceMode === "local") {
      untrack(() => fetchManifest());
    }
  });

  // Cleanup cloud subscription on unmount
  $effect(() => {
    return () => {
      if (cloudUnsubscribe) {
        cloudUnsubscribe();
        cloudUnsubscribe = null;
      }
    };
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="gallery"
  bind:this={galleryElement}
  onwheel={handleWheel}
>
  <!-- Header -->
  <header class="gallery-header">
    <div class="header-left">
      <h3>Gallery</h3>
      {#if !isLoading && hasItems}
        <span class="stats">
          {stats.totalScreenshots} screenshots, {stats.routeCount} routes, {stats.deviceCount} devices
        </span>
      {/if}
    </div>

    <div class="header-right">
      <!-- Source mode toggle -->
      <div class="source-toggle" role="radiogroup" aria-label="Screenshot source">
        <button
          class="source-btn"
          class:active={sourceMode === "local"}
          role="radio"
          aria-checked={sourceMode === "local"}
          onclick={() => setSourceMode("local")}
        >
          <i class="fas fa-folder"></i>
          Local
        </button>
        <button
          class="source-btn"
          class:active={sourceMode === "cloud"}
          role="radio"
          aria-checked={sourceMode === "cloud"}
          onclick={() => setSourceMode("cloud")}
        >
          <i class="fas fa-cloud"></i>
          Cloud
        </button>
      </div>

      {#if sourceMode === "local" && timestamp}
        <span class="timestamp">Last capture: {formatTimestamp(timestamp)}</span>
      {/if}
    </div>
  </header>

  <!-- Controls -->
  {#if !isLoading && hasItems}
    <div class="controls">
      <div class="filter-chips" role="radiogroup" aria-label="Filter by device category">
        {#each FILTERS as filter}
          <button
            class="chip"
            class:active={activeFilter === filter.value}
            role="radio"
            aria-checked={activeFilter === filter.value}
            onclick={() => { hapticService?.trigger("selection"); activeFilter = filter.value; }}
          >
            {filter.label}
          </button>
        {/each}
      </div>

      <div class="size-presets" role="radiogroup" aria-label="Card size preset">
        {#each SIZE_PRESETS as preset}
          <button
            class="size-pill"
            class:active={activePreset === preset.label}
            role="radio"
            aria-checked={activePreset === preset.label}
            onclick={() => setPreset(preset.value)}
          >
            {preset.label}
          </button>
        {/each}
        <span class="size-hint" title="Ctrl+Scroll to fine-tune">
          {columnMin}px
        </span>
      </div>
    </div>
  {/if}

  <!-- Content -->
  {#if isLoading}
    <div class="state-message">
      <i class="fas fa-circle-notch fa-spin"></i>
      <span>Loading screenshots{sourceMode === "cloud" ? " from cloud" : ""}...</span>
    </div>
  {:else if errorMessage}
    <div class="state-message error">
      <i class="fas fa-exclamation-triangle"></i>
      <span>
        {#if sourceMode === "cloud"}
          Failed to load cloud screenshots: {errorMessage}
        {:else}
          Failed to load manifest: {errorMessage}
        {/if}
      </span>
    </div>
  {:else if !hasItems}
    <div class="state-message empty">
      <i class="fas fa-camera"></i>
      <h4>No screenshots {sourceMode === "cloud" ? "in cloud storage" : "captured yet"}</h4>
      <p>
        {#if sourceMode === "cloud"}
          Run the migration script or capture new screenshots to populate cloud storage.
        {:else}
          Select routes and devices above, then click Capture.
        {/if}
      </p>
    </div>
  {:else}
    <div class="module-sections">
      {#each [...filteredModuleGroups.entries()] as [moduleId, routeMap], sectionIdx (moduleId)}
        {@const isCollapsed = collapsedModules[moduleId] ?? false}
        {@const routeCount = routeMap.size}
        {@const captureCount = [...routeMap.values()].reduce((sum, arr) => sum + arr.length, 0)}

        <section class="module-section" style="--section-i: {sectionIdx};">
          <button
            class="module-header"
            onclick={() => toggleModuleCollapse(moduleId)}
            aria-expanded={!isCollapsed}
          >
            <i class="fas fa-chevron-right" class:expanded={!isCollapsed}></i>
            <span class="module-name">{MODULE_NAMES[moduleId] ?? moduleId}</span>
            <span class="module-stats">{captureCount} captures, {routeCount} routes</span>
          </button>

          {#if !isCollapsed}
            <div class="route-sections">
              {#each [...routeMap.entries()] as [routeLabel, items] (routeLabel)}
                {@const missing = getMissingDevices(items)}

                <div class="route-section">
                  <h4 class="route-label">{formatRouteLabel(routeLabel)}</h4>
                  <div
                    class="device-row"
                    style="grid-template-columns: repeat(auto-fill, minmax(min({columnMin}px, 100%), 1fr));"
                  >
                    {#each items as item, cardIdx (item.id)}
                      {@const aspect = getAspectRatio(item.deviceSlug)}
                      <button
                        class="capture-card"
                        style="--aspect: {aspect}; --card-i: {cardIdx};"
                        onclick={() => openSpotlight(item)}
                        aria-label="View {item.deviceName} screenshot of {formatRouteLabel(item.routeLabel)}"
                      >
                        <div class="screenshot-frame">
                          <img
                            src={item.imageUrl}
                            alt="{formatRouteLabel(item.routeLabel)} on {item.deviceName}"
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                        <div class="card-footer">
                          <span
                            class="device-badge"
                            style="--badge-color: {getCategoryColor(item.deviceSlug)}"
                          >
                            {getCategoryLabel(item.deviceSlug)}
                          </span>
                          <span class="device-name">{item.deviceName}</span>
                          <span class="device-dims">{getDeviceDims(item.deviceSlug)}</span>
                        </div>
                        {#if item.tagIds.length > 0}
                          <div class="tag-indicator">
                            <i class="fas fa-tags"></i>
                            <span>{item.tagIds.length}</span>
                          </div>
                        {/if}
                      </button>
                    {/each}

                    <!-- "Not captured" placeholders (local mode only) -->
                    {#each missing as slug (slug)}
                      {@const aspect = getAspectRatio(slug)}
                      <div class="capture-card placeholder" style="--aspect: {aspect};">
                        <div class="screenshot-frame placeholder-frame">
                          <i class="fas fa-camera-retro shimmer-icon"></i>
                          <span>Not captured</span>
                        </div>
                        <div class="card-footer">
                          <span
                            class="device-badge"
                            style="--badge-color: {getCategoryColor(slug)}"
                          >
                            {getCategoryLabel(slug)}
                          </span>
                          <span class="device-name">{getDeviceName(slug)}</span>
                          <span class="device-dims">{getDeviceDims(slug)}</span>
                        </div>
                      </div>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </section>
      {/each}
    </div>
  {/if}
</div>

<!-- MediaSpotlight Viewer -->
<MediaSpotlight
  items={spotlightItems}
  bind:currentIndex={spotlightIndex}
  bind:open={spotlightOpen}
  config={spotlightConfig}
  callbacks={{ onclose: () => { spotlightOpen = false; } }}
/>

<style>
  .gallery {
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex: 1;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  }

  /* Header */
  .gallery-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 8px;
  }

  .header-left {
    display: flex;
    align-items: baseline;
    gap: 12px;
    flex-wrap: wrap;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .gallery-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--theme-text, #fff);
  }

  .stats {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  .timestamp {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  /* Source toggle */
  .source-toggle {
    display: flex;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    overflow: hidden;
  }

  .source-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    border: none;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
    font-family: inherit;
    cursor: pointer;
    transition:
      background var(--duration-fast, 150ms) var(--ease-out, ease-out),
      color var(--duration-fast, 150ms) var(--ease-out, ease-out);
  }

  .source-btn:first-child {
    border-right: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .source-btn:hover {
    color: var(--theme-text, #fff);
    background: rgba(255, 255, 255, 0.06);
  }

  .source-btn.active {
    background: color-mix(in srgb, var(--theme-accent, #3b82f6) 20%, transparent);
    color: var(--theme-text, #fff);
  }

  .source-btn i {
    font-size: 10px;
  }

  /* Controls */
  .controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
  }

  .filter-chips {
    display: flex;
    gap: 6px;
  }

  .chip {
    padding: 5px 12px;
    border-radius: 20px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    cursor: pointer;
    transition:
      transform var(--duration-instant, 100ms) var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)),
      all var(--duration-fast, 150ms) var(--ease-out, ease-out);
    font-family: inherit;
  }

  .chip:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, #fff);
  }

  .chip:active {
    transform: scale(var(--active-scale, 0.98));
  }

  .chip.active {
    background: var(--theme-accent, #3b82f6);
    border-color: var(--theme-accent, #3b82f6);
    color: #fff;
  }

  /* Size presets */
  .size-presets {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .size-pill {
    padding: 4px 10px;
    border-radius: 16px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    min-width: 32px;
    transition:
      transform var(--duration-instant, 100ms) var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)),
      background var(--duration-fast, 150ms) var(--ease-out, ease-out),
      border-color var(--duration-fast, 150ms) var(--ease-out, ease-out),
      color var(--duration-fast, 150ms) var(--ease-out, ease-out);
  }

  .size-pill:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, #fff);
  }

  .size-pill:active {
    transform: scale(var(--active-scale, 0.98));
  }

  .size-pill.active {
    background: color-mix(in srgb, var(--theme-accent, #3b82f6) 20%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #3b82f6) 50%, transparent);
    color: var(--theme-text, #fff);
  }

  .size-hint {
    font-size: 10px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.3));
    margin-left: 4px;
    font-variant-numeric: tabular-nums;
    cursor: help;
  }

  /* Module sections */
  .module-sections {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .module-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    animation: slideUp var(--duration-normal, 200ms) var(--ease-out, ease-out) both;
    animation-delay: calc(var(--stagger-normal, 50ms) * var(--section-i, 0));
  }

  .module-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 8px;
    cursor: pointer;
    color: var(--theme-text, #fff);
    font-family: inherit;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    text-align: left;
    width: 100%;
    transition:
      transform var(--duration-instant, 100ms) var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)),
      background var(--duration-fast, 150ms) var(--ease-out, ease-out);
  }

  .module-header:hover {
    transform: scale(var(--hover-scale-sm, 1.01));
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.06));
  }

  .module-header:active {
    transform: scale(var(--active-scale, 0.98));
  }

  .module-header i {
    font-size: 10px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    transition: transform var(--duration-fast, 150ms) var(--ease-out, ease-out);
  }

  .module-header i.expanded {
    transform: rotate(90deg);
  }

  .module-header:focus-visible {
    outline: 2px solid var(--theme-accent, #3b82f6);
    outline-offset: 2px;
  }

  .module-stats {
    margin-left: auto;
    font-size: var(--font-size-compact, 12px);
    font-weight: 400;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
  }

  /* Route sections */
  .route-sections {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-left: 12px;
  }

  .route-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .route-label {
    margin: 0;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text, #fff);
    padding-bottom: 4px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
  }

  .device-row {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(280px, 100%), 1fr));
    gap: 10px;
    transition: grid-template-columns var(--duration-normal, 200ms) var(--ease-out, ease-out);
  }

  /* Capture cards */
  .capture-card {
    position: relative;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    overflow: hidden;
    cursor: pointer;
    transition:
      transform var(--duration-instant, 100ms) var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)),
      border-color var(--duration-fast, 150ms) var(--ease-out, ease-out),
      box-shadow var(--duration-fast, 150ms) var(--ease-out, ease-out);
    padding: 0;
    font-family: inherit;
    color: inherit;
    text-align: left;
    animation: popIn var(--duration-emphasis, 280ms) var(--ease-spring, cubic-bezier(0.34, 1.56, 0.64, 1)) both;
    animation-delay: calc(var(--stagger-micro, 30ms) * var(--card-i, 0));
  }

  .capture-card:hover {
    transform: scale(var(--hover-scale-md, 1.02)) translateY(var(--hover-lift-sm, -1px));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  }

  .capture-card:active {
    transform: scale(var(--active-scale, 0.98));
  }

  .capture-card.placeholder {
    cursor: default;
    opacity: 0.5;
    animation: none;
  }

  .capture-card.placeholder:hover {
    transform: none;
    border-color: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    box-shadow: none;
  }

  .screenshot-frame {
    aspect-ratio: var(--aspect);
    overflow: hidden;
    background: #0a0a0f;
  }

  .screenshot-frame img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top center;
    display: block;
  }

  .placeholder-frame {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.3));
    font-size: var(--font-size-compact, 12px);
  }

  .shimmer-icon {
    font-size: 20px;
    animation: pulse 2s ease-in-out infinite;
  }

  .card-footer {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    font-size: var(--font-size-compact, 12px);
  }

  .device-badge {
    padding: 2px 7px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--badge-color) 20%, transparent);
    color: var(--badge-color);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .device-name {
    color: var(--theme-text, #fff);
    font-weight: 500;
  }

  .device-dims {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.4));
    margin-left: auto;
  }

  /* Tag indicator */
  .tag-indicator {
    position: absolute;
    top: 6px;
    right: 6px;
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 2px 6px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.7);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
    font-size: 10px;
    pointer-events: none;
  }

  .tag-indicator i {
    font-size: 9px;
  }

  /* State messages */
  .state-message {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: 200px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-min, 14px);
  }

  .state-message i {
    font-size: 28px;
  }

  .state-message.error {
    color: var(--semantic-error, #ef4444);
  }

  .state-message.empty h4 {
    margin: 0;
    font-size: 14px;
    color: var(--theme-text, #fff);
  }

  .state-message.empty p {
    margin: 0;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    font-size: var(--font-size-compact, 12px);
  }

  @media (prefers-reduced-motion: reduce) {
    .capture-card,
    .module-section {
      animation: none;
    }
    .capture-card,
    .chip,
    .size-pill,
    .module-header,
    .module-header i,
    .source-btn {
      transition: none;
    }
    .capture-card:hover,
    .capture-card:active,
    .chip:active,
    .size-pill:active,
    .module-header:hover,
    .module-header:active {
      transform: none;
    }
    .shimmer-icon {
      animation: none;
    }
  }
</style>
