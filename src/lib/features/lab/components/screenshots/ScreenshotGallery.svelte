<!--
  ScreenshotGallery — Orchestrator for the module-organized gallery.

  Subscribes to Firestore via ScreenshotLoader for real-time updates.
  Features:
  - Tag sidebar (right) with TagTreeView for filtering
  - Batch selection mode with bulk tagging via TagPickerPanel
  - Context menu / long-press tagging on individual cards
-->
<script lang="ts">
  import type { DeviceCategory } from "../../services/contracts/IScreenshotOrchestrator";
  import type { ScreenshotMetadata } from "../../services/contracts/IScreenshotUploader";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";
  import type { IScreenshotTagController } from "../../services/contracts/IScreenshotTagController";
  import type { GalleryItem } from "../../services/contracts/IGalleryItemAdapter";
  import type { MediaTag, TagColor } from "@austencloud/media-tagging-types";
  import { container } from "$lib/shared/di";
  import { onMount } from "svelte";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { MediaSpotlight, type MediaItem as SpotlightMediaItem, type SpotlightConfig } from "@austencloud/media-spotlight";
  import { TagCreatorModal, TagPickerPanel } from "@austencloud/media-tagging-ui";
  import { GalleryItemAdapter } from "../../services/implementations/GalleryItemAdapter";
  import GalleryGrid from "./GalleryGrid.svelte";
  import SelectionToolbar from "./SelectionToolbar.svelte";
  import TagSidebar from "./TagSidebar.svelte";
  import TagContextPanel from "./TagContextPanel.svelte";

  let hapticService: IHapticFeedback;
  let tagController: IScreenshotTagController;
  const adapter = new GalleryItemAdapter();

  onMount(() => {
    hapticService = container.items.hapticFeedback;
    tagController = container.items.screenshotTagController;
  });

  // Subscribe to Firestore only when the user is authenticated.
  // This prevents permission-denied errors from firing before auth completes.
  $effect(() => {
    const user = authState.user;
    const initialized = authState.initialized;

    if (!initialized || !user) {
      // Auth not ready or user signed out — clear data and unsubscribe
      screenshotUnsubscribe?.();
      screenshotUnsubscribe = null;
      tagUnsubscribe?.();
      tagUnsubscribe = null;
      screenshots = [];
      allTags = [];
      isLoading = !initialized; // show loading until auth resolves
      return;
    }

    // User is authenticated — subscribe to Firestore
    loadScreenshots();
    loadTags();
  });

  // ─── Tag state ──────────────────────────────────────────────────────────────

  let allTags = $state<MediaTag[]>([]);
  let tagUnsubscribe: (() => void) | null = null;
  let activeTagIds = $state<Set<string>>(new Set());
  let excludeTagIds = $state<Set<string>>(new Set());
  let tagMode = $state<"and" | "or">("or");
  let untaggedOnly = $state(false);
  let tagPanelTarget = $state<GalleryItem | null>(null);
  let tagPanelPosition = $state<{ x: number; y: number }>({ x: 0, y: 0 });
  let showTagCreator = $state(false);
  let sidebarOpen = $state(false);
  let showTagPicker = $state(false);

  // Long-press for mobile tagging
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  const LONG_PRESS_MS = 500;

  function loadTags() {
    tagUnsubscribe?.();
    tagUnsubscribe = tagController?.subscribeTags((tags) => {
      allTags = tags;
    }) ?? null;
  }

  function getTagById(tagId: string): MediaTag | undefined {
    return allTags.find((t) => t.id === tagId);
  }

  async function handleToggleTagOnScreenshot(tagId: string) {
    if (!tagPanelTarget) return;
    await tagController.toggleTagOnScreenshot(tagId, tagPanelTarget.id);
  }

  async function handleCreateTag(name: string, color: TagColor, category: string) {
    await tagController.createTag(name, color, category);
  }

  function openTagPanel(item: GalleryItem, e: MouseEvent | TouchEvent) {
    e.preventDefault();
    e.stopPropagation();

    if ("clientX" in e) {
      tagPanelTarget = item;
      tagPanelPosition = { x: e.clientX, y: e.clientY };
    } else {
      const touch = (e as TouchEvent).touches?.[0];
      if (touch) {
        tagPanelTarget = item;
        tagPanelPosition = { x: touch.clientX, y: touch.clientY };
      }
    }
  }

  function closeTagPanel() {
    tagPanelTarget = null;
  }

  function startLongPress(item: GalleryItem, e: TouchEvent) {
    longPressTimer = setTimeout(() => {
      openTagPanel(item, e);
      longPressTimer = null;
    }, LONG_PRESS_MS);
  }

  function cancelLongPress() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  // ─── Tag filtering callbacks ────────────────────────────────────────────────

  function handleToggleTag(tagId: string) {
    const next = new Set(activeTagIds);
    if (next.has(tagId)) {
      next.delete(tagId);
    } else {
      next.add(tagId);
    }
    activeTagIds = next;
    untaggedOnly = false;
    hapticService?.trigger("selection");
  }

  function handleExcludeTag(tagId: string) {
    const next = new Set(excludeTagIds);
    if (next.has(tagId)) {
      next.delete(tagId);
    } else {
      next.add(tagId);
    }
    excludeTagIds = next;
    hapticService?.trigger("selection");
  }

  function handleSetTagMode(mode: "and" | "or") {
    tagMode = mode;
    hapticService?.trigger("selection");
  }

  function handleSetUntaggedOnly(value: boolean) {
    untaggedOnly = value;
    if (value) {
      activeTagIds = new Set();
      excludeTagIds = new Set();
    }
    hapticService?.trigger("selection");
  }

  function handleClearTags() {
    activeTagIds = new Set();
    excludeTagIds = new Set();
    untaggedOnly = false;
    hapticService?.trigger("selection");
  }

  function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
    hapticService?.trigger("selection");
  }

  // ─── Selection mode ─────────────────────────────────────────────────────────

  let selectionMode = $state(false);
  let selectedIds = $state<Set<string>>(new Set());

  function enterSelectionMode() {
    selectionMode = true;
    hapticService?.trigger("selection");
  }

  function exitSelectionMode() {
    selectionMode = false;
    selectedIds = new Set();
    hapticService?.trigger("selection");
  }

  function toggleSelection(itemId: string) {
    const next = new Set(selectedIds);
    if (next.has(itemId)) {
      next.delete(itemId);
    } else {
      next.add(itemId);
    }
    selectedIds = next;
  }

  function selectAll() {
    selectedIds = new Set(flatItems.map((item) => item.id));
  }

  function clearSelection() {
    selectedIds = new Set();
  }

  function openTagPicker() {
    showTagPicker = true;
  }

  function closeTagPicker() {
    showTagPicker = false;
  }

  async function handleBulkApplyTag(tag: MediaTag) {
    const ids = [...selectedIds];
    await tagController.addTagToScreenshots(tag.id, ids);
  }

  async function handleBulkRemoveTag(tag: MediaTag) {
    const ids = [...selectedIds];
    await tagController.removeTagFromScreenshots(tag.id, ids);
  }

  // ─── Cloud state ────────────────────────────────────────────────────────────

  let screenshots = $state<ScreenshotMetadata[]>([]);
  let isLoading = $state(true);
  let errorMessage = $state<string | null>(null);
  let screenshotUnsubscribe: (() => void) | null = null;

  // ─── Shared state ─────────────────────────────────────────────────────────

  type FilterCategory = "all" | DeviceCategory;

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

  /** Convert cloud ScreenshotMetadata to GalleryItem */
  function toGalleryItem(s: ScreenshotMetadata): GalleryItem {
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

  /** All gallery items */
  const galleryItems = $derived(screenshots.map(toGalleryItem));
  const hasItems = $derived(galleryItems.length > 0);

  // ─── Grouping & filtering ─────────────────────────────────────────────────

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

  /** Apply tag filtering on top of device filter */
  const tagFilteredModuleGroups = $derived.by(() => {
    const hasTagFilters = activeTagIds.size > 0 || excludeTagIds.size > 0 || untaggedOnly;
    if (!hasTagFilters) return filteredModuleGroups;

    const filtered = new Map<string, Map<string, GalleryItem[]>>();
    for (const [moduleId, routeMap] of filteredModuleGroups) {
      const filteredRoutes = new Map<string, GalleryItem[]>();
      for (const [route, items] of routeMap) {
        const matching = items.filter((item) => {
          if (untaggedOnly) return item.tagIds.length === 0;

          if (excludeTagIds.size > 0) {
            for (const exId of excludeTagIds) {
              if (item.tagIds.includes(exId)) return false;
            }
          }

          if (activeTagIds.size === 0) return true;

          if (tagMode === "and") {
            for (const tagId of activeTagIds) {
              if (!item.tagIds.includes(tagId)) return false;
            }
            return true;
          } else {
            for (const tagId of activeTagIds) {
              if (item.tagIds.includes(tagId)) return true;
            }
            return false;
          }
        });
        if (matching.length > 0) filteredRoutes.set(route, matching);
      }
      if (filteredRoutes.size > 0) filtered.set(moduleId, filteredRoutes);
    }
    return filtered;
  });

  const flatItems = $derived.by(() => {
    const result: GalleryItem[] = [];
    for (const [, routeMap] of tagFilteredModuleGroups) {
      for (const [, items] of routeMap) {
        result.push(...items);
      }
    }
    return result;
  });

  /** MediaItems for the shared TagTreeView and TagPickerPanel */
  const mediaItems = $derived(adapter.toMediaItems(galleryItems));
  const filteredMediaItems = $derived(adapter.toMediaItems(flatItems));

  /** MediaItems for batch tag picker (selected items only) */
  const selectedMediaItems = $derived(
    adapter.toMediaItems(flatItems.filter((item) => selectedIds.has(item.id)))
  );

  const spotlightItems: SpotlightMediaItem[] = $derived(
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

  const FILTERS: { value: FilterCategory; label: string }[] = [
    { value: "all", label: "All" },
    { value: "phone", label: "Phone" },
    { value: "tablet", label: "Tablet" },
    { value: "desktop", label: "Desktop" },
  ];

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function formatRouteLabel(label: string): string {
    return label.replace(/--/g, " / ").replace(/(^|\s)\w/g, (c) => c.toUpperCase());
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

  // ─── Keyboard shortcuts ─────────────────────────────────────────────────────

  function handleGlobalKeydown(e: KeyboardEvent) {
    // Ctrl+T: toggle sidebar
    if ((e.ctrlKey || e.metaKey) && e.key === "t") {
      e.preventDefault();
      toggleSidebar();
      return;
    }

    // Ctrl+A: select all (selection mode only)
    if ((e.ctrlKey || e.metaKey) && e.key === "a" && selectionMode) {
      e.preventDefault();
      selectAll();
      return;
    }

    // Escape: exit selection / close tag picker
    if (e.key === "Escape") {
      if (showTagPicker) {
        closeTagPicker();
      } else if (selectionMode) {
        exitSelectionMode();
      }
    }
  }

  // ─── Cloud Firestore loading ──────────────────────────────────────────────

  function loadScreenshots() {
    screenshotUnsubscribe?.();
    screenshotUnsubscribe = null;
    isLoading = true;
    errorMessage = null;

    try {
      const loader = container.items.screenshotLoader;
      screenshotUnsubscribe = loader.subscribeToScreenshots((data: ScreenshotMetadata[]) => {
        screenshots = data;
        isLoading = false;
      });
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : String(err);
      isLoading = false;
    }
  }

  // ─── Lifecycle cleanup ──────────────────────────────────────────────────────

  $effect(() => {
    return () => {
      cancelLongPress();
    };
  });
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="gallery-layout"
  class:sidebar-open={sidebarOpen}
  bind:this={galleryElement}
  onwheel={handleWheel}
>
  <!-- Main gallery content -->
  <div class="gallery-main">
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
        <!-- Selection mode toggle -->
        {#if hasItems && !isLoading}
          <button
            class="header-btn"
            class:active={selectionMode}
            onclick={selectionMode ? exitSelectionMode : enterSelectionMode}
          >
            <i class="fas fa-check-square"></i>
            {selectionMode ? "Exit Select" : "Select"}
          </button>
        {/if}

        <!-- Sidebar toggle -->
        <button
          class="header-btn"
          class:active={sidebarOpen}
          onclick={toggleSidebar}
          title="Toggle tag sidebar (Ctrl+T)"
        >
          <i class="fas fa-tags"></i>
          Tags
        </button>
      </div>
    </header>

    <!-- Selection Toolbar -->
    {#if selectionMode}
      <SelectionToolbar
        selectedCount={selectedIds.size}
        totalCount={flatItems.length}
        onTag={openTagPicker}
        onSelectAll={selectAll}
        onClearSelection={clearSelection}
        onExitSelection={exitSelectionMode}
      />
    {/if}

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
        <span>Loading screenshots...</span>
      </div>
    {:else if errorMessage}
      <div class="state-message error">
        <i class="fas fa-exclamation-triangle"></i>
        <span>Failed to load screenshots: {errorMessage}</span>
      </div>
    {:else if !hasItems}
      <div class="state-message empty">
        <i class="fas fa-camera"></i>
        <h4>No screenshots in cloud storage</h4>
        <p>Run the migration script or capture new screenshots to populate cloud storage.</p>
      </div>
    {:else if tagFilteredModuleGroups.size === 0}
      <div class="state-message empty">
        <i class="fas fa-filter"></i>
        <h4>No matches</h4>
        <p>No screenshots match the current tag filters.</p>
        <button class="clear-filters-btn" onclick={handleClearTags}>
          Clear filters
        </button>
      </div>
    {:else}
      <GalleryGrid
        moduleGroups={tagFilteredModuleGroups}
        {collapsedModules}
        {columnMin}
        {allTags}
        {selectionMode}
        {selectedIds}
        onOpenSpotlight={openSpotlight}
        onOpenTagPanel={openTagPanel}
        onToggleModuleCollapse={toggleModuleCollapse}
        onToggleSelection={toggleSelection}
        onStartLongPress={startLongPress}
        onCancelLongPress={cancelLongPress}
      />
    {/if}
  </div>

  <!-- Tag Sidebar -->
  <TagSidebar
    open={sidebarOpen}
    tags={allTags}
    {mediaItems}
    filteredMediaItems={filteredMediaItems}
    {activeTagIds}
    {excludeTagIds}
    {tagMode}
    {untaggedOnly}
    onToggle={toggleSidebar}
    onToggleTag={handleToggleTag}
    onExcludeTag={handleExcludeTag}
    onSetTagMode={handleSetTagMode}
    onSetUntaggedOnly={handleSetUntaggedOnly}
    onClearTags={handleClearTags}
    onCreateTag={() => { showTagCreator = true; }}
  />
</div>

<!-- Tag context panel (right-click on card) -->
{#if tagPanelTarget}
  <TagContextPanel
    target={tagPanelTarget}
    {allTags}
    position={tagPanelPosition}
    onToggleTag={handleToggleTagOnScreenshot}
    onCreateTag={() => { showTagCreator = true; }}
    onClose={closeTagPanel}
  />
{/if}

<!-- Tag Picker Panel (batch tagging modal) -->
{#if showTagPicker}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="tag-picker-backdrop" onclick={closeTagPicker}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="tag-picker-container" onclick={(e) => e.stopPropagation()}>
      <TagPickerPanel
        {allTags}
        selectedItems={selectedMediaItems}
        onApplyTag={handleBulkApplyTag}
        onRemoveTag={handleBulkRemoveTag}
        onClose={closeTagPicker}
      />
    </div>
  </div>
{/if}

<!-- Tag creator modal -->
{#if showTagCreator}
  <TagCreatorModal
    tags={allTags}
    categoryLabels={{}}
    onCreate={handleCreateTag}
    onClose={() => { showTagCreator = false; }}
  />
{/if}

<!-- MediaSpotlight Viewer -->
<MediaSpotlight
  items={spotlightItems}
  bind:currentIndex={spotlightIndex}
  bind:open={spotlightOpen}
  config={spotlightConfig}
  callbacks={{ onclose: () => { spotlightOpen = false; } }}
/>

<style>
  /* Layout: gallery + sidebar */
  .gallery-layout {
    display: grid;
    grid-template-columns: 1fr 0px;
    width: 100%;
    height: 100%;
    overflow: hidden;
    transition: grid-template-columns 300ms var(--ease-out, ease-out);
  }

  .gallery-layout.sidebar-open {
    grid-template-columns: 1fr 280px;
  }

  .gallery-main {
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
    padding: 16px;
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
    gap: 8px;
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

  /* Header buttons */
  .header-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    min-height: 32px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-compact, 12px);
    font-family: inherit;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) var(--ease-out, ease-out);
  }

  .header-btn i {
    font-size: 10px;
  }

  .header-btn:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    color: var(--theme-text, #fff);
    background: rgba(255, 255, 255, 0.06);
  }

  .header-btn.active {
    background: color-mix(in srgb, var(--theme-accent, #3b82f6) 20%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #3b82f6) 40%, transparent);
    color: var(--theme-text, #fff);
  }

  .header-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #3b82f6);
    outline-offset: 2px;
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

  .clear-filters-btn {
    padding: 8px 16px;
    border-radius: 8px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #fff);
    font-size: var(--font-size-compact, 12px);
    font-family: inherit;
    cursor: pointer;
    transition: all var(--duration-fast, 150ms) var(--ease-out, ease-out);
  }

  .clear-filters-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
  }

  /* Tag Picker Modal */
  .tag-picker-backdrop {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .tag-picker-container {
    width: 100%;
    max-width: 600px;
  }

  /* Mobile adjustments */
  @media (max-width: 768px) {
    .gallery-layout,
    .gallery-layout.sidebar-open {
      grid-template-columns: 1fr;
    }

    .gallery-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .header-right {
      width: 100%;
      justify-content: flex-start;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .gallery-layout {
      transition: none;
    }
    .chip,
    .size-pill,
    .header-btn,
    .clear-filters-btn {
      transition: none;
    }
    .chip:active,
    .size-pill:active {
      transform: none;
    }
  }
</style>
