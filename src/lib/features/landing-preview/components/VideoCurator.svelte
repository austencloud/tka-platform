<script lang="ts">
  /**
   * VideoCurator
   *
   * Admin UI for browsing, tagging, and selecting Instagram showcase videos.
   * Orchestrates extracted services and components.
   */
  import { onMount } from "svelte";
  import { container } from "$lib/shared/di";
  import { getVideoCache } from "$lib/shared/video";
  import CurationModeOverlay from "./CurationModeOverlay.svelte";
  import LinkingModeOverlay from "./LinkingModeOverlay.svelte";
  import VideoPreviewModal from "./VideoPreviewModal.svelte";
  import VideoEditModal from "./VideoEditModal.svelte";
  import VideoFilterBar from "./VideoFilterBar.svelte";
  import type {
    ShowcaseVideo,
    VideoCategory,
    UserProfile,
    MatchedSequence,
    VideoPerformer,
  } from "../types";

  // Services from DI container
  const loader = container.items.videoCuratorLoader;
  const persister = container.items.videoCuratorPersister;
  const sequenceMatcher = container.items.sequenceMatcher;

  // Video cache for instant playback
  const videoCache = getVideoCache();

  // === CORE STATE ===
  let videos = $state<ShowcaseVideo[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let categories = $state<VideoCategory[]>([]);
  let quickPerformers = $state<UserProfile[]>([]);
  let cacheStats = $state({ count: 0, totalSize: 0 });

  // === FILTER STATE ===
  let filterCategory = $state<string>("all");
  let filterPerformer = $state<string>("all");
  let filterHasWord = $state<string>("all");
  let filterFeatured = $state<boolean | null>(null);
  let searchQuery = $state("");
  let showAddCategory = $state(false);
  let newCategoryLabel = $state("");
  let newCategoryColor = $state("#6366f1");

  // === PREVIEW MODAL STATE ===
  let selectedVideo = $state<ShowcaseVideo | null>(null);
  let selectedVideoUrl = $state<string | null>(null);
  let showUserSearch = $state(false);

  // === EDIT MODAL STATE ===
  let editingVideo = $state<ShowcaseVideo | null>(null);
  let editTitle = $state("");
  let editCategory = $state("");
  let editTags = $state("");
  let saving = $state(false);

  // === CURATION MODE STATE ===
  let curationMode = $state(false);
  let curationIndex = $state(0);
  let curationVideoShortcode = $state<string | null>(null); // Track by shortcode, not index
  let curationSaving = $state(false);
  let curationVideoUrl = $state<string | null>(null);
  let showAddPerformer = $state(false);
  const PERFORMER_KEYS = "asdfgh";

  // === LINKING MODE STATE ===
  let linkingMode = $state(false);
  let linkingIndex = $state(0);
  let linkingSearching = $state(false);
  let linkingSaving = $state(false);
  let matchedSequences = $state<MatchedSequence[]>([]);
  let selectedSequenceForLink = $state<MatchedSequence | null>(null);

  // === DERIVED STATE ===
  const uncuratedVideos = $derived.by(() =>
    videos.filter((v) => !v.excluded && (!v.category || v.performers.length === 0))
  );

  const unlinkableVideos = $derived.by(() =>
    videos.filter((v) => v.title && v.title.length > 0 && !v.sequenceId)
  );

  const currentCurationVideo = $derived.by(() => {
    if (!curationMode) return null;
    // If we have a locked shortcode, find that video (even if it's now "curated")
    if (curationVideoShortcode) {
      const lockedVideo = videos.find((v) => v.shortcode === curationVideoShortcode);
      if (lockedVideo) return lockedVideo;
    }
    // Otherwise fall back to index in uncurated list
    if (uncuratedVideos.length === 0) return null;
    return uncuratedVideos[Math.min(curationIndex, uncuratedVideos.length - 1)] || null;
  });

  const currentLinkingVideo = $derived.by(() => {
    if (!linkingMode || unlinkableVideos.length === 0) return null;
    return unlinkableVideos[Math.min(linkingIndex, unlinkableVideos.length - 1)] || null;
  });

  const curationProgress = $derived({
    current: curationIndex + 1,
    total: uncuratedVideos.length,
    done: videos.length - uncuratedVideos.length,
  });

  const linkingProgress = $derived({
    current: linkingIndex + 1,
    total: unlinkableVideos.length,
    linked: videos.filter((v) => v.sequenceId).length,
  });

  const filteredVideos = $derived.by(() => {
    let result = videos;
    if (filterCategory !== "all") {
      result = result.filter((v) => v.category === filterCategory);
    }
    if (filterFeatured !== null) {
      result = result.filter((v) => v.featured === filterFeatured);
    }
    if (filterPerformer !== "all") {
      result = result.filter((v) => v.performers.some((p) => p.id === filterPerformer));
    }
    if (filterHasWord === "yes") {
      result = result.filter((v) => v.title && v.title.length > 0);
    } else if (filterHasWord === "no") {
      result = result.filter((v) => !v.title);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (v) =>
          v.shortcode.toLowerCase().includes(query) ||
          v.title?.toLowerCase().includes(query) ||
          v.sequenceWord?.toLowerCase().includes(query) ||
          v.performers.some((p) => p.displayName.toLowerCase().includes(query)) ||
          v.tags.some((t) => t.toLowerCase().includes(query))
      );
    }
    return result;
  });

  const performers = $derived.by(() => {
    const map = new Map<string, string>();
    for (const v of videos) {
      for (const p of v.performers) {
        map.set(p.id, p.displayName);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  });

  const stats = $derived({
    total: videos.length,
    featured: videos.filter((v) => v.featured).length,
    categorized: videos.filter((v) => v.category).length,
    uncategorized: videos.filter((v) => !v.category).length,
    withWord: videos.filter((v) => v.title && v.title.length > 0).length,
  });

  // === DATA LOADING ===
  async function loadVideos() {
    loading = true;
    error = null;
    try {
      videos = await loader.loadVideos();
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to load videos";
    } finally {
      loading = false;
    }
  }

  // === CURATION MODE ===
  function enterCurationMode() {
    curationMode = true;
    curationIndex = 0;
    // Lock to first uncurated video
    curationVideoShortcode = uncuratedVideos[0]?.shortcode || null;
  }

  function exitCurationMode() {
    curationMode = false;
    curationVideoShortcode = null;
  }

  function nextCurationVideo() {
    // Find current position in uncurated list and move forward
    const currentIdx = uncuratedVideos.findIndex((v) => v.shortcode === curationVideoShortcode);
    if (currentIdx < uncuratedVideos.length - 1) {
      curationIndex = currentIdx + 1;
      curationVideoShortcode = uncuratedVideos[curationIndex]?.shortcode || null;
    } else if (uncuratedVideos.length > 0) {
      // Current video might be curated now, just go to first uncurated
      curationIndex = 0;
      curationVideoShortcode = uncuratedVideos[0]?.shortcode || null;
    }
  }

  function prevCurationVideo() {
    const currentIdx = uncuratedVideos.findIndex((v) => v.shortcode === curationVideoShortcode);
    if (currentIdx > 0) {
      curationIndex = currentIdx - 1;
      curationVideoShortcode = uncuratedVideos[curationIndex]?.shortcode || null;
    }
  }

  async function setCurationCategory(categoryId: string) {
    const video = currentCurationVideo;
    if (!video || curationSaving) return;
    curationSaving = true;
    try {
      await persister.updateVideo(video.shortcode, { category: categoryId });
      updateLocalVideo(video.shortcode, { category: categoryId });
      // Don't auto-advance - let user control when to move on
    } catch (e) {
      console.error("Failed to set category:", e);
    } finally {
      curationSaving = false;
    }
  }

  async function toggleCurationPerformer(user: UserProfile) {
    const video = currentCurationVideo;
    if (!video || curationSaving) return;
    curationSaving = true;
    try {
      const existingIndex = video.performers.findIndex((p) => p.id === user.id);
      let newPerformers: VideoPerformer[];
      if (existingIndex >= 0) {
        // Remove performer if already tagged
        newPerformers = video.performers.filter((p) => p.id !== user.id);
      } else {
        // Add performer
        newPerformers = [...video.performers, { id: user.id, displayName: user.displayName }];
      }
      await persister.updateVideo(video.shortcode, { performers: newPerformers });
      updateLocalVideo(video.shortcode, { performers: newPerformers });
      // Don't auto-advance when toggling performers - user may want to add multiple
    } catch (e) {
      console.error("Failed to toggle performer:", e);
    } finally {
      curationSaving = false;
    }
  }

  function skipCurationVideo() {
    nextCurationVideo();
  }

  async function excludeCurationVideo() {
    const video = currentCurationVideo;
    if (!video || curationSaving) return;
    curationSaving = true;
    try {
      await persister.updateVideo(video.shortcode, { excluded: true });
      updateLocalVideo(video.shortcode, { excluded: true });
      // Move to next video after excluding
      nextCurationVideo();
    } catch (e) {
      console.error("Failed to exclude video:", e);
    } finally {
      curationSaving = false;
    }
  }

  async function addCategory() {
    if (!newCategoryLabel.trim()) return;
    const id = newCategoryLabel.toLowerCase().replace(/\s+/g, "-");
    const newCategory: VideoCategory = {
      id,
      label: newCategoryLabel.trim(),
      color: newCategoryColor,
    };
    categories = [...categories, newCategory];
    await persister.saveCategories(categories);
    newCategoryLabel = "";
    newCategoryColor = "#6366f1";
    showAddCategory = false;
  }

  async function addQuickPerformer(user: { uid: string; displayName: string }) {
    console.log("[VideoCurator] addQuickPerformer called with:", user);
    if (quickPerformers.some((p) => p.id === user.uid)) {
      console.log("[VideoCurator] Performer already exists, skipping");
      showAddPerformer = false;
      return;
    }
    quickPerformers = [...quickPerformers, { id: user.uid, displayName: user.displayName }];
    console.log("[VideoCurator] Updated quickPerformers:", quickPerformers);
    try {
      await persister.saveQuickPerformers(quickPerformers);
      console.log("[VideoCurator] Save completed successfully");
    } catch (e) {
      console.error("[VideoCurator] Failed to save quick performers:", e);
    }
    showAddPerformer = false;
  }

  async function removeQuickPerformer(id: string) {
    console.log("[VideoCurator] removeQuickPerformer called for:", id);
    quickPerformers = quickPerformers.filter((p) => p.id !== id);
    try {
      await persister.saveQuickPerformers(quickPerformers);
      console.log("[VideoCurator] Remove save completed successfully");
    } catch (e) {
      console.error("[VideoCurator] Failed to save after remove:", e);
    }
  }

  // === LINKING MODE ===
  function enterLinkingMode() {
    linkingMode = true;
    linkingIndex = 0;
    matchedSequences = [];
    selectedSequenceForLink = null;
    if (unlinkableVideos.length > 0) searchSequencesForCurrentVideo();
  }

  function exitLinkingMode() {
    linkingMode = false;
    matchedSequences = [];
    selectedSequenceForLink = null;
  }

  function nextLinkingVideo() {
    if (linkingIndex < unlinkableVideos.length - 1) {
      linkingIndex++;
      matchedSequences = [];
      selectedSequenceForLink = null;
      searchSequencesForCurrentVideo();
    }
  }

  function prevLinkingVideo() {
    if (linkingIndex > 0) {
      linkingIndex--;
      matchedSequences = [];
      selectedSequenceForLink = null;
      searchSequencesForCurrentVideo();
    }
  }

  async function searchSequencesForCurrentVideo() {
    const video = currentLinkingVideo;
    if (!video || !video.title) return;
    linkingSearching = true;
    matchedSequences = [];
    try {
      const results = await sequenceMatcher.searchByWord(video.title);
      matchedSequences = results;
      if (results.length === 1) selectedSequenceForLink = results[0];
    } catch (e) {
      console.error("Failed to search sequences:", e);
    } finally {
      linkingSearching = false;
    }
  }

  async function linkVideoToSequence() {
    const video = currentLinkingVideo;
    if (!video || !selectedSequenceForLink || linkingSaving) return;
    linkingSaving = true;
    try {
      const updates = {
        sequenceId: selectedSequenceForLink.id,
        sequenceWord: selectedSequenceForLink.word,
      };
      await persister.updateVideo(video.shortcode, updates);
      updateLocalVideo(video.shortcode, updates);
      setTimeout(() => {
        matchedSequences = [];
        selectedSequenceForLink = null;
        if (unlinkableVideos.length > 0) searchSequencesForCurrentVideo();
      }, 300);
    } catch (e) {
      console.error("Failed to link video:", e);
    } finally {
      linkingSaving = false;
    }
  }

  function skipLinkingVideo() {
    nextLinkingVideo();
  }

  // === VIDEO SELECTION & EDITING ===
  async function selectVideo(video: ShowcaseVideo) {
    selectedVideo = video;
    selectedVideoUrl = null;
    const cachedUrl = await videoCache.getVideoUrl(video.videoUrl, {
      cacheIfMissing: true,
      priority: 100,
    });
    selectedVideoUrl = cachedUrl;
  }

  function closePreview() {
    selectedVideo = null;
    selectedVideoUrl = null;
    showUserSearch = false;
  }

  function startEdit(video: ShowcaseVideo) {
    editingVideo = video;
    editTitle = video.title || "";
    editCategory = video.category || "";
    editTags = video.tags.join(", ");
  }

  function cancelEdit() {
    editingVideo = null;
  }

  async function saveEdit() {
    if (!editingVideo) return;
    saving = true;
    try {
      const updates = {
        title: editTitle.trim() || null,
        category: editCategory || null,
        tags: editTags.split(",").map((t) => t.trim()).filter(Boolean),
      };
      await persister.updateVideo(editingVideo.shortcode, updates);
      updateLocalVideo(editingVideo.shortcode, updates);
      editingVideo = null;
    } catch (e) {
      console.error("Failed to save:", e);
    } finally {
      saving = false;
    }
  }

  async function toggleFeatured(video: ShowcaseVideo) {
    try {
      const newValue = !video.featured;
      await persister.toggleFeatured(video.shortcode, newValue);
      updateLocalVideo(video.shortcode, { featured: newValue });
    } catch (e) {
      console.error("Failed to toggle featured:", e);
    }
  }

  async function setCategory(video: ShowcaseVideo, category: string) {
    try {
      await persister.updateVideo(video.shortcode, { category });
      updateLocalVideo(video.shortcode, { category });
    } catch (e) {
      console.error("Failed to set category:", e);
    }
  }

  async function addPerformerToVideo(video: ShowcaseVideo, user: UserProfile) {
    try {
      if (video.performers.some((p) => p.id === user.id)) return; // Already tagged
      const newPerformers = [...video.performers, { id: user.id, displayName: user.displayName }];
      await persister.updateVideo(video.shortcode, { performers: newPerformers });
      updateLocalVideo(video.shortcode, { performers: newPerformers });
      if (selectedVideo?.shortcode === video.shortcode) {
        selectedVideo = { ...selectedVideo, performers: newPerformers };
      }
      showUserSearch = false;
    } catch (e) {
      console.error("Failed to add performer:", e);
    }
  }

  async function removePerformerFromVideo(video: ShowcaseVideo, performerId: string) {
    try {
      const newPerformers = video.performers.filter((p) => p.id !== performerId);
      await persister.updateVideo(video.shortcode, { performers: newPerformers });
      updateLocalVideo(video.shortcode, { performers: newPerformers });
      if (selectedVideo?.shortcode === video.shortcode) {
        selectedVideo = { ...selectedVideo, performers: newPerformers };
      }
    } catch (e) {
      console.error("Failed to remove performer:", e);
    }
  }

  // === UTILITY ===
  function updateLocalVideo(shortcode: string, updates: Partial<ShowcaseVideo>) {
    const index = videos.findIndex((v) => v.shortcode === shortcode);
    if (index !== -1) {
      videos[index] = { ...videos[index], ...updates };
      videos = [...videos];
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function formatDate(date: Date | null): string {
    if (!date) return "Unknown";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function clearFilters() {
    filterCategory = "all";
    filterPerformer = "all";
    filterHasWord = "all";
    filterFeatured = null;
    searchQuery = "";
  }

  // === KEYBOARD SHORTCUTS ===
  function isTypingInInput(): boolean {
    const active = document.activeElement;
    if (!active) return false;
    const tagName = active.tagName.toLowerCase();
    return tagName === "input" || tagName === "textarea" || (active as HTMLElement).isContentEditable;
  }

  function handleCurationKeydown(e: KeyboardEvent) {
    if (!curationMode || curationSaving) return;
    // Don't intercept keys when user is typing in an input field
    if (isTypingInInput()) return;
    const num = parseInt(e.key);
    if (num >= 1 && num <= categories.length) {
      e.preventDefault();
      setCurationCategory(categories[num - 1].id);
      return;
    }
    const letterIndex = PERFORMER_KEYS.indexOf(e.key.toLowerCase());
    if (letterIndex >= 0 && letterIndex < quickPerformers.length) {
      e.preventDefault();
      toggleCurationPerformer(quickPerformers[letterIndex]);
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "h") {
      e.preventDefault();
      prevCurationVideo();
    } else if (e.key === "ArrowRight" || e.key === "l") {
      e.preventDefault();
      nextCurationVideo();
    } else if (e.key === "x") {
      e.preventDefault();
      skipCurationVideo();
    } else if (e.key === "Escape") {
      exitCurationMode();
    }
  }

  function handleLinkingKeydown(e: KeyboardEvent) {
    if (!linkingMode || linkingSaving || linkingSearching) return;
    // Don't intercept keys when user is typing in an input field
    if (isTypingInInput()) return;
    const num = parseInt(e.key);
    if (num >= 1 && num <= matchedSequences.length) {
      e.preventDefault();
      selectedSequenceForLink = matchedSequences[num - 1];
      return;
    }
    if (e.key === "Enter" && selectedSequenceForLink) {
      e.preventDefault();
      linkVideoToSequence();
    } else if (e.key === "ArrowLeft" || e.key === "h") {
      e.preventDefault();
      prevLinkingVideo();
    } else if (e.key === "ArrowRight" || e.key === "l") {
      e.preventDefault();
      nextLinkingVideo();
    } else if (e.key === "x") {
      e.preventDefault();
      skipLinkingVideo();
    } else if (e.key === "Escape") {
      exitLinkingMode();
    }
  }

  // === LIFECYCLE ===
  onMount(async () => {
    console.log("[VideoCurator] onMount - loading categories and performers");
    const [loadedCategories, loadedPerformers] = await Promise.all([
      loader.loadCategories(),
      loader.loadQuickPerformers(),
    ]);
    console.log("[VideoCurator] Loaded categories:", loadedCategories);
    console.log("[VideoCurator] Loaded performers:", loadedPerformers);
    categories = loadedCategories;
    quickPerformers = loadedPerformers;
    await loadVideos();
    const stats = await videoCache.getStats();
    cacheStats = { count: stats.count, totalSize: stats.totalSize };
    if (videos.length > 0) {
      const preloadUrls = videos.slice(0, 12).map((v) => v.videoUrl);
      videoCache.preload(preloadUrls);
    }
  });

  $effect(() => {
    if (filteredVideos.length > 0) {
      const preloadUrls = filteredVideos.slice(0, 8).map((v) => v.videoUrl);
      videoCache.preload(preloadUrls);
    }
  });

  $effect(() => {
    if (!curationMode) return;
    window.addEventListener("keydown", handleCurationKeydown);
    return () => window.removeEventListener("keydown", handleCurationKeydown);
  });

  $effect(() => {
    if (currentCurationVideo) {
      curationVideoUrl = null; // Reset while loading
      videoCache.getVideoUrl(currentCurationVideo.videoUrl, {
        cacheIfMissing: true,
        priority: 100,
      }).then((url) => {
        curationVideoUrl = url;
      });
    } else {
      curationVideoUrl = null;
    }
  });

  $effect(() => {
    if (!linkingMode) return;
    window.addEventListener("keydown", handleLinkingKeydown);
    return () => window.removeEventListener("keydown", handleLinkingKeydown);
  });

  $effect(() => {
    if (currentLinkingVideo) {
      videoCache.getVideoUrl(currentLinkingVideo.videoUrl, {
        cacheIfMissing: true,
        priority: 100,
      });
    }
  });
</script>

<div class="video-curator">
  <!-- Header with stats -->
  <header class="curator-header">
    <div class="header-content">
      <h1>Video Curator</h1>
      <p>Tag, categorize, and select videos for the landing page</p>
    </div>
    <div class="stats-bar">
      <div class="stat">
        <span class="stat-value">{stats.total}</span>
        <span class="stat-label">Total</span>
      </div>
      <div class="stat featured">
        <span class="stat-value">{stats.featured}</span>
        <span class="stat-label">Featured</span>
      </div>
      <div class="stat">
        <span class="stat-value">{stats.categorized}</span>
        <span class="stat-label">Categorized</span>
      </div>
      <div class="stat uncategorized">
        <span class="stat-value">{stats.uncategorized}</span>
        <span class="stat-label">Uncategorized</span>
      </div>
      <div class="stat with-word">
        <span class="stat-value">{stats.withWord}</span>
        <span class="stat-label">Has TKA Word</span>
      </div>
      <div class="stat linked">
        <span class="stat-value">{linkingProgress.linked}</span>
        <span class="stat-label">Linked</span>
      </div>
      {#if cacheStats.count > 0}
        <div class="stat cached">
          <span class="stat-value">{cacheStats.count}</span>
          <span class="stat-label">Cached ({formatFileSize(cacheStats.totalSize)})</span>
        </div>
      {/if}
    </div>
  </header>

  <!-- Filter bar -->
  <VideoFilterBar
    {searchQuery}
    {filterCategory}
    {filterPerformer}
    {filterHasWord}
    {filterFeatured}
    {categories}
    {performers}
    {loading}
    uncuratedCount={uncuratedVideos.length}
    unlinkableCount={unlinkableVideos.length}
    filteredCount={filteredVideos.length}
    totalCount={videos.length}
    {showAddCategory}
    {newCategoryLabel}
    {newCategoryColor}
    onSearchChange={(q) => (searchQuery = q)}
    onCategoryChange={(c) => (filterCategory = c)}
    onPerformerChange={(p) => (filterPerformer = p)}
    onHasWordChange={(v) => (filterHasWord = v)}
    onFeaturedChange={(v) => (filterFeatured = v)}
    onRefresh={loadVideos}
    onEnterCurationMode={enterCurationMode}
    onEnterLinkingMode={enterLinkingMode}
    onToggleAddCategory={(show) => (showAddCategory = show)}
    onAddCategory={addCategory}
    onUpdateCategoryLabel={(label) => (newCategoryLabel = label)}
    onUpdateCategoryColor={(color) => (newCategoryColor = color)}
    onClearFilters={clearFilters}
  />

  <!-- Video grid -->
  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <span>Loading videos...</span>
    </div>
  {:else if error}
    <div class="error-state">
      <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
      <span>{error}</span>
      <button onclick={loadVideos}>Retry</button>
    </div>
  {:else if filteredVideos.length === 0}
    <div class="empty-state">
      <i class="fas fa-film" aria-hidden="true"></i>
      <span>No videos found</span>
      {#if videos.length === 0}
        <p>Upload videos using the batch upload script first.</p>
      {/if}
    </div>
  {:else}
    <div class="video-grid">
      {#each filteredVideos as video (video.shortcode)}
        <div
          class="video-card"
          class:featured={video.featured}
          onclick={() => selectVideo(video)}
          role="button"
          tabindex="0"
          onkeydown={(e) => e.key === "Enter" && selectVideo(video)}
        >
          <div class="video-thumbnail">
            <video src={video.videoUrl} preload="metadata" muted>
              <track kind="captions" />
            </video>
            {#if video.featured}
              <div class="featured-badge">
                <i class="fas fa-star" aria-hidden="true"></i>
              </div>
            {/if}
            {#if video.category}
              {@const cat = categories.find((c) => c.id === video.category)}
              {#if cat}
                <div class="category-badge" style="background: {cat.color}">
                  {cat.label}
                </div>
              {/if}
            {/if}
            {#if video.performers.length > 0}
              <div class="performer-badge">
                <i class="fas fa-user" aria-hidden="true"></i>
                {video.performers.length === 1
                  ? video.performers[0].displayName
                  : `${video.performers.length} performers`}
              </div>
            {/if}
          </div>
          <div class="video-info">
            <span class="video-title">{video.title || video.shortcode}</span>
            <span class="video-meta">
              {formatDate(video.instagramDate)} · {formatFileSize(video.fileSize)}
            </span>
          </div>
          <div class="quick-actions">
            <button
              class="action-btn"
              class:active={video.featured}
              onclick={(e) => {
                e.stopPropagation();
                toggleFeatured(video);
              }}
              title={video.featured ? "Remove from featured" : "Add to featured"}
            >
              <i class="fas fa-star" aria-hidden="true"></i>
            </button>
            <button
              class="action-btn"
              onclick={(e) => {
                e.stopPropagation();
                startEdit(video);
              }}
              title="Edit"
            >
              <i class="fas fa-edit" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Video preview modal -->
{#if selectedVideo}
  <VideoPreviewModal
    video={selectedVideo}
    videoUrl={selectedVideoUrl}
    {categories}
    {showUserSearch}
    onClose={closePreview}
    onSetCategory={(catId) => setCategory(selectedVideo!, catId)}
    onToggleFeatured={() => toggleFeatured(selectedVideo!)}
    onAddPerformer={(user) => addPerformerToVideo(selectedVideo!, user)}
    onRemovePerformer={(performerId) => removePerformerFromVideo(selectedVideo!, performerId)}
    onToggleUserSearch={(show) => (showUserSearch = show)}
    {formatDate}
    {formatFileSize}
  />
{/if}

<!-- Edit modal -->
{#if editingVideo}
  <VideoEditModal
    video={editingVideo}
    {categories}
    {editTitle}
    {editCategory}
    {editTags}
    {saving}
    onSave={saveEdit}
    onCancel={cancelEdit}
    onUpdateTitle={(t) => (editTitle = t)}
    onUpdateCategory={(c) => (editCategory = c)}
    onUpdateTags={(t) => (editTags = t)}
  />
{/if}

<!-- Curation mode overlay -->
{#if curationMode && currentCurationVideo}
  <CurationModeOverlay
    currentVideo={currentCurationVideo}
    videoUrl={curationVideoUrl}
    {categories}
    {quickPerformers}
    progress={curationProgress}
    {stats}
    {curationIndex}
    uncuratedCount={uncuratedVideos.length}
    saving={curationSaving}
    {showAddCategory}
    {showAddPerformer}
    {newCategoryLabel}
    {newCategoryColor}
    performerKeys={PERFORMER_KEYS}
    onExit={exitCurationMode}
    onPrev={prevCurationVideo}
    onNext={nextCurationVideo}
    onSetCategory={setCurationCategory}
    onTogglePerformer={toggleCurationPerformer}
    onSkip={skipCurationVideo}
    onExclude={excludeCurationVideo}
    onAddCategory={addCategory}
    onAddPerformer={addQuickPerformer}
    onRemovePerformer={removeQuickPerformer}
    onToggleAddCategory={(show) => (showAddCategory = show)}
    onToggleAddPerformer={(show) => (showAddPerformer = show)}
    onUpdateCategoryLabel={(label) => (newCategoryLabel = label)}
    onUpdateCategoryColor={(color) => (newCategoryColor = color)}
    {formatDate}
  />
{/if}

<!-- Sequence Linking mode overlay -->
{#if linkingMode && currentLinkingVideo}
  <LinkingModeOverlay
    currentVideo={currentLinkingVideo}
    {matchedSequences}
    selectedSequence={selectedSequenceForLink}
    progress={linkingProgress}
    {stats}
    {linkingIndex}
    unlinkableCount={unlinkableVideos.length}
    searching={linkingSearching}
    saving={linkingSaving}
    onExit={exitLinkingMode}
    onPrev={prevLinkingVideo}
    onNext={nextLinkingVideo}
    onSelectSequence={(seq) => (selectedSequenceForLink = seq)}
    onConfirmLink={linkVideoToSequence}
    onSkip={skipLinkingVideo}
    {formatDate}
  />
{/if}

<style>
  .video-curator {
    padding: 24px;
    max-width: 1400px;
    margin: 0 auto;
  }

  .curator-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 24px;
    flex-wrap: wrap;
    gap: 16px;
  }

  .header-content h1 {
    font-size: 1.75rem;
    margin: 0 0 4px 0;
  }

  .header-content p {
    color: var(--theme-text-dim);
    margin: 0;
  }

  .stats-bar {
    display: flex;
    gap: 16px;
  }

  .stat {
    text-align: center;
    padding: 8px 16px;
    background: var(--theme-card-bg);
    border-radius: 8px;
    border: 1px solid var(--theme-stroke);
  }

  .stat-value {
    display: block;
    font-size: 1.5rem;
    font-weight: 700;
  }

  .stat-label {
    font-size: 12px;
    color: var(--theme-text-dim);
  }

  .stat.featured .stat-value {
    color: #f59e0b;
  }

  .stat.uncategorized .stat-value {
    color: #ef4444;
  }

  .stat.cached .stat-value {
    color: #10b981;
  }

  .stat.with-word .stat-value {
    color: #06b6d4;
  }

  /* Video grid */
  .video-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 16px;
  }

  .video-card {
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
  }

  .video-card:hover {
    border-color: var(--theme-accent);
    transform: translateY(-2px);
  }

  .video-card.featured {
    border-color: #f59e0b;
    box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.3);
  }

  .video-thumbnail {
    position: relative;
    aspect-ratio: 9 / 16;
    background: #000;
  }

  .video-thumbnail video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .featured-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #f59e0b;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
  }

  .category-badge {
    position: absolute;
    bottom: 8px;
    left: 8px;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    color: white;
  }

  .performer-badge {
    position: absolute;
    bottom: 8px;
    right: 8px;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    color: white;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .performer-badge i {
    font-size: 10px;
  }

  .video-info {
    padding: 12px;
  }

  .video-title {
    display: block;
    font-weight: 600;
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .video-meta {
    display: block;
    font-size: 11px;
    color: var(--theme-text-dim);
    margin-top: 4px;
  }

  .quick-actions {
    position: absolute;
    top: 8px;
    left: 8px;
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .video-card:hover .quick-actions {
    opacity: 1;
  }

  .action-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: rgba(0, 0, 0, 0.6);
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .action-btn:hover {
    background: rgba(0, 0, 0, 0.8);
  }

  .action-btn.active {
    background: #f59e0b;
  }

  /* Loading/Error/Empty states */
  .loading-state,
  .error-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 64px;
    color: var(--theme-text-dim);
  }

  .error-state i,
  .empty-state i {
    font-size: 48px;
    opacity: 0.5;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--theme-stroke);
    border-top-color: var(--theme-accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 600px) {
    .video-curator {
      padding: 16px;
    }

    .video-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }

    .stats-bar {
      gap: 8px;
    }

    .stat {
      padding: 6px 12px;
    }
  }
</style>
