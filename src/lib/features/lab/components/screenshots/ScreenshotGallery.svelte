<!--
  ScreenshotGallery — Module-organized gallery with collapsible sections,
  "not captured" placeholders, device filter chips, and click-to-lightbox.

  Fetches manifest from the Vite dev server at /screenshots/manifest.json.
-->
<script lang="ts">
  import { untrack } from "svelte";
  import type { DeviceCategory } from "../../services/contracts/IScreenshotOrchestrator";

  interface Props {
    /** Incremented externally to force a manifest refresh (e.g. after capture) */
    refreshToken?: number;
  }

  let { refreshToken = 0 }: Props = $props();

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

  type FilterCategory = "all" | DeviceCategory;

  // Device dimensions lookup — hardcoded to avoid importing test files
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

  // Module display names for grouping
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

  let captures = $state<CaptureInfo[]>([]);
  let timestamp = $state<string | null>(null);
  let loading = $state(true);
  let fetchError = $state<string | null>(null);
  let activeFilter = $state<FilterCategory>("all");
  let columnMin = $state(280);
  let lightboxSrc = $state<string | null>(null);
  let lightboxCaption = $state("");
  let collapsedModules = $state<Record<string, boolean>>({});

  // Parse module from route label (e.g. "create--construct" -> "create", "landing" -> "public")
  function getModuleFromLabel(label: string): string {
    const dashIdx = label.indexOf("--");
    if (dashIdx > 0) return label.substring(0, dashIdx);
    // Public routes have no module prefix
    const publicLabels = ["landing", "about", "privacy", "terms", "roots"];
    if (publicLabels.includes(label)) return "public";
    return label;
  }

  // Group captures by module, then by route within each module
  const moduleGroups = $derived.by(() => {
    const groups = new Map<string, Map<string, CaptureInfo[]>>();

    for (const capture of captures) {
      const moduleId = getModuleFromLabel(capture.routeLabel);

      if (!groups.has(moduleId)) groups.set(moduleId, new Map());
      const routeMap = groups.get(moduleId)!;

      if (!routeMap.has(capture.routeLabel)) routeMap.set(capture.routeLabel, []);
      routeMap.get(capture.routeLabel)!.push(capture);
    }

    return groups;
  });

  // Apply device filter
  const filteredModuleGroups = $derived.by(() => {
    if (activeFilter === "all") return moduleGroups;

    const filtered = new Map<string, Map<string, CaptureInfo[]>>();
    for (const [moduleId, routeMap] of moduleGroups) {
      const filteredRoutes = new Map<string, CaptureInfo[]>();
      for (const [route, items] of routeMap) {
        const matching = items.filter((c) => DEVICE_MAP[c.deviceSlug]?.category === activeFilter);
        if (matching.length > 0) filteredRoutes.set(route, matching);
      }
      if (filteredRoutes.size > 0) filtered.set(moduleId, filteredRoutes);
    }
    return filtered;
  });

  const stats = $derived({
    totalScreenshots: captures.length,
    routeCount: new Set(captures.map((c) => c.routeLabel)).size,
    deviceCount: new Set(captures.map((c) => c.deviceSlug)).size,
  });

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

  function openLightbox(capture: CaptureInfo) {
    lightboxSrc = `/screenshots/captures/${capture.filename}`;
    const device = DEVICE_MAP[capture.deviceSlug];
    lightboxCaption = `${formatRouteLabel(capture.routeLabel)} — ${device?.name ?? capture.deviceSlug} (${getDeviceDims(capture.deviceSlug)})`;
  }

  function closeLightbox() {
    lightboxSrc = null;
    lightboxCaption = "";
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && lightboxSrc) closeLightbox();
  }

  function toggleModuleCollapse(moduleId: string) {
    collapsedModules = {
      ...collapsedModules,
      [moduleId]: !collapsedModules[moduleId],
    };
  }

  /** Get devices that are missing for a given route (not captured) */
  function getMissingDevices(routeCaptures: CaptureInfo[]): string[] {
    const capturedSlugs = new Set(routeCaptures.map((c) => c.deviceSlug));
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

  // Fetch on mount
  $effect(() => {
    untrack(() => fetchManifest());
  });

  // Re-fetch when refreshToken changes
  $effect(() => {
    // Read refreshToken to track dependency
    const _ = refreshToken;
    if (_ > 0) {
      untrack(() => fetchManifest());
    }
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="gallery">
  <!-- Header -->
  <header class="gallery-header">
    <div class="header-left">
      <h3>Gallery</h3>
      {#if !loading && captures.length > 0}
        <span class="stats">
          {stats.totalScreenshots} screenshots, {stats.routeCount} routes, {stats.deviceCount} devices
        </span>
      {/if}
    </div>
    {#if timestamp}
      <span class="timestamp">Last capture: {formatTimestamp(timestamp)}</span>
    {/if}
  </header>

  <!-- Controls -->
  {#if !loading && captures.length > 0}
    <div class="controls">
      <div class="filter-chips" role="radiogroup" aria-label="Filter by device category">
        {#each FILTERS as filter}
          <button
            class="chip"
            class:active={activeFilter === filter.value}
            role="radio"
            aria-checked={activeFilter === filter.value}
            onclick={() => (activeFilter = filter.value)}
          >
            {filter.label}
          </button>
        {/each}
      </div>

      <label class="height-control">
        <span class="height-label">Card size</span>
        <input
          type="range"
          min="180"
          max="600"
          step="20"
          bind:value={columnMin}
          aria-label="Card size"
        />
        <span class="height-value">{columnMin}px</span>
      </label>
    </div>
  {/if}

  <!-- Content -->
  {#if loading}
    <div class="state-message">
      <i class="fas fa-circle-notch fa-spin"></i>
      <span>Loading screenshots...</span>
    </div>
  {:else if fetchError}
    <div class="state-message error">
      <i class="fas fa-exclamation-triangle"></i>
      <span>Failed to load manifest: {fetchError}</span>
    </div>
  {:else if captures.length === 0}
    <div class="state-message empty">
      <i class="fas fa-camera"></i>
      <h4>No screenshots captured yet</h4>
      <p>Select routes and devices above, then click Capture.</p>
    </div>
  {:else}
    <div class="module-sections">
      {#each [...filteredModuleGroups.entries()] as [moduleId, routeMap] (moduleId)}
        {@const isCollapsed = collapsedModules[moduleId] ?? false}
        {@const routeCount = routeMap.size}
        {@const captureCount = [...routeMap.values()].reduce((sum, arr) => sum + arr.length, 0)}

        <section class="module-section">
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
                    {#each items as capture (capture.filename)}
                      {@const aspect = getAspectRatio(capture.deviceSlug)}
                      <button
                        class="capture-card"
                        style="--aspect: {aspect};"
                        onclick={() => openLightbox(capture)}
                        aria-label="View {getDeviceName(capture.deviceSlug)} screenshot of {formatRouteLabel(capture.routeLabel)}"
                      >
                        <div class="screenshot-frame">
                          <img
                            src="/screenshots/captures/{capture.filename}"
                            alt="{formatRouteLabel(capture.routeLabel)} on {getDeviceName(capture.deviceSlug)}"
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                        <div class="card-footer">
                          <span
                            class="device-badge"
                            style="--badge-color: {getCategoryColor(capture.deviceSlug)}"
                          >
                            {getCategoryLabel(capture.deviceSlug)}
                          </span>
                          <span class="device-name">{getDeviceName(capture.deviceSlug)}</span>
                          <span class="device-dims">{getDeviceDims(capture.deviceSlug)}</span>
                        </div>
                      </button>
                    {/each}

                    <!-- "Not captured" placeholders -->
                    {#each missing as slug (slug)}
                      {@const aspect = getAspectRatio(slug)}
                      <div class="capture-card placeholder" style="--aspect: {aspect};">
                        <div class="screenshot-frame placeholder-frame">
                          <i class="fas fa-camera-retro"></i>
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

<!-- Lightbox -->
{#if lightboxSrc}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="lightbox-overlay"
    onclick={closeLightbox}
    onkeydown={(e) => e.key === "Escape" && closeLightbox()}
    role="dialog"
    aria-modal="true"
    aria-label="Screenshot preview"
    tabindex="-1"
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="lightbox-content" onclick={(e) => e.stopPropagation()}>
      <img src={lightboxSrc} alt={lightboxCaption} />
      <p class="lightbox-caption">{lightboxCaption}</p>
    </div>
    <button class="lightbox-close" onclick={closeLightbox} aria-label="Close preview">
      <i class="fas fa-times"></i>
    </button>
  </div>
{/if}

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
    transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    font-family: inherit;
  }

  .chip:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    color: var(--theme-text, #fff);
  }

  .chip.active {
    background: var(--theme-accent, #3b82f6);
    border-color: var(--theme-accent, #3b82f6);
    color: #fff;
  }

  .height-control {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
  }

  .height-label {
    white-space: nowrap;
  }

  .height-control input[type="range"] {
    width: 100px;
    accent-color: var(--theme-accent, #3b82f6);
  }

  .height-value {
    min-width: 42px;
    text-align: right;
    font-variant-numeric: tabular-nums;
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
    transition: background 0.15s ease;
  }

  .module-header:hover {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.06));
  }

  .module-header i {
    font-size: 10px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
    transition: transform 0.15s ease;
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
  }

  /* Capture cards */
  .capture-card {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 10px;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
    padding: 0;
    font-family: inherit;
    color: inherit;
    text-align: left;
  }

  .capture-card:hover {
    transform: scale(1.02);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .capture-card:active {
    transform: scale(0.98);
  }

  .capture-card.placeholder {
    cursor: default;
    opacity: 0.5;
  }

  .capture-card.placeholder:hover {
    transform: none;
    border-color: var(--theme-stroke, rgba(255, 255, 255, 0.1));
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

  .placeholder-frame i {
    font-size: 20px;
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

  /* Lightbox */
  .lightbox-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
  }

  .lightbox-content {
    max-width: 90vw;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .lightbox-content img {
    max-width: 100%;
    max-height: calc(90vh - 40px);
    object-fit: contain;
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  }

  .lightbox-caption {
    color: rgba(255, 255, 255, 0.8);
    font-size: var(--font-size-min, 14px);
    margin: 0;
    text-align: center;
  }

  .lightbox-close {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: none;
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    font-size: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
  }

  .lightbox-close:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  @media (prefers-reduced-motion: reduce) {
    .capture-card {
      transition: none;
    }
    .capture-card:hover,
    .capture-card:active {
      transform: none;
    }
    .chip {
      transition: none;
    }
    .module-header,
    .module-header i {
      transition: none;
    }
  }
</style>
