<script lang="ts">
  /**
   * VideoCurator
   *
   * Admin UI for browsing, tagging, and selecting Instagram showcase videos.
   * Features:
   * - Grid view of all uploaded videos
   * - Click to preview/play
   * - Tag videos with categories (tutorial, performance, showcase)
   * - Link to sequences
   * - Mark as featured for landing page
   * - Filter and search
   */
  import { onMount } from "svelte";
  import { getFirestoreInstance } from "$lib/shared/auth/firebase";
  import { getVideoCache } from "$lib/shared/video";

  // Video cache for instant playback
  const videoCache = getVideoCache();

  interface ShowcaseVideo {
    shortcode: string;
    videoUrl: string;
    instagramDate: Date | null;
    fileSize: number;
    category: string | null;
    tags: string[];
    featured: boolean;
    approved: boolean;
    sequenceId: string | null;
    sequenceWord: string | null;
    title: string | null;
    description: string | null;
    performerId: string | null; // User ID of the performer
    performerName: string | null; // Display name for quick reference
  }

  interface VideoCategory {
    id: string;
    label: string;
    color: string;
  }

  interface UserProfile {
    id: string;
    displayName: string;
    avatarUrl?: string;
  }

  let videos = $state<ShowcaseVideo[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Filters
  let filterCategory = $state<string>("all");
  let filterFeatured = $state<boolean | null>(null);
  let searchQuery = $state("");

  // Selected video for detail view
  let selectedVideo = $state<ShowcaseVideo | null>(null);
  let selectedVideoUrl = $state<string | null>(null); // Cached URL for playback
  let isPlaying = $state(false);

  // Cache stats
  let cacheStats = $state({ count: 0, totalSize: 0 });

  // Editing state
  let editingVideo = $state<ShowcaseVideo | null>(null);
  let editTitle = $state("");
  let editCategory = $state("");
  let editTags = $state("");
  let editPerformerId = $state<string | null>(null);
  let saving = $state(false);

  // Dynamic categories (stored in Firestore, loaded on mount)
  const DEFAULT_CATEGORIES: VideoCategory[] = [
    { id: "tutorial", label: "Tutorial", color: "#3b82f6" },
    { id: "performance", label: "Performance", color: "#10b981" },
    { id: "showcase", label: "Showcase", color: "#f59e0b" },
    { id: "practice", label: "Practice", color: "#8b5cf6" },
  ];
  let categories = $state<VideoCategory[]>(DEFAULT_CATEGORIES);
  let showAddCategory = $state(false);
  let newCategoryLabel = $state("");
  let newCategoryColor = $state("#6366f1");

  // User profiles for performer assignment
  let userProfiles = $state<UserProfile[]>([]);
  let userSearchQuery = $state("");
  let showUserSearch = $state(false);
  let loadingUsers = $state(false);

  // Filter by performer
  let filterPerformer = $state<string>("all");

  // Filtered videos
  const filteredVideos = $derived.by(() => {
    let result = videos;

    // Category filter
    if (filterCategory !== "all") {
      result = result.filter(v => v.category === filterCategory);
    }

    // Featured filter
    if (filterFeatured !== null) {
      result = result.filter(v => v.featured === filterFeatured);
    }

    // Performer filter
    if (filterPerformer !== "all") {
      result = result.filter(v => v.performerId === filterPerformer);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(v =>
        v.shortcode.toLowerCase().includes(query) ||
        v.title?.toLowerCase().includes(query) ||
        v.sequenceWord?.toLowerCase().includes(query) ||
        v.performerName?.toLowerCase().includes(query) ||
        v.tags.some(t => t.toLowerCase().includes(query))
      );
    }

    return result;
  });

  // Unique performers from videos (for filter dropdown)
  const performers = $derived.by(() => {
    const map = new Map<string, string>();
    for (const v of videos) {
      if (v.performerId && v.performerName) {
        map.set(v.performerId, v.performerName);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  });

  // Stats
  const stats = $derived({
    total: videos.length,
    featured: videos.filter(v => v.featured).length,
    categorized: videos.filter(v => v.category).length,
    uncategorized: videos.filter(v => !v.category).length,
  });

  async function loadVideos() {
    loading = true;
    error = null;

    try {
      const { collection, getDocs, orderBy, query } = await import("firebase/firestore");
      const db = await getFirestoreInstance();

      const q = query(
        collection(db, "showcaseVideos"),
        orderBy("instagramDate", "desc")
      );

      const snapshot = await getDocs(q);
      videos = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          shortcode: doc.id,
          videoUrl: data.videoUrl,
          instagramDate: data.instagramDate?.toDate() || null,
          fileSize: data.fileSize || 0,
          category: data.category || null,
          tags: data.tags || [],
          featured: data.featured || false,
          approved: data.approved || false,
          sequenceId: data.sequenceId || null,
          sequenceWord: data.sequenceWord || null,
          title: data.title || null,
          description: data.description || null,
          performerId: data.performerId || null,
          performerName: data.performerName || null,
        } as ShowcaseVideo;
      });
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to load videos";
      console.error("Failed to load videos:", e);
    } finally {
      loading = false;
    }
  }

  async function loadCategories() {
    try {
      const { doc, getDoc } = await import("firebase/firestore");
      const db = await getFirestoreInstance();

      const docRef = doc(db, "config", "videoCategories");
      const snapshot = await getDoc(docRef);

      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.categories && Array.isArray(data.categories)) {
          categories = data.categories;
        }
      }
    } catch (e) {
      console.warn("Failed to load categories, using defaults:", e);
    }
  }

  async function saveCategories() {
    try {
      const { doc, setDoc } = await import("firebase/firestore");
      const db = await getFirestoreInstance();

      await setDoc(doc(db, "config", "videoCategories"), {
        categories,
        updatedAt: new Date(),
      });
    } catch (e) {
      console.error("Failed to save categories:", e);
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
    await saveCategories();

    newCategoryLabel = "";
    newCategoryColor = "#6366f1";
    showAddCategory = false;
  }

  async function searchUsers(query: string) {
    if (!query.trim() || query.length < 2) {
      userProfiles = [];
      return;
    }

    loadingUsers = true;
    try {
      const { collection, getDocs, query: firestoreQuery, where, limit, orderBy } = await import("firebase/firestore");
      const db = await getFirestoreInstance();

      // Search by displayName (case-insensitive prefix search)
      const q = firestoreQuery(
        collection(db, "users"),
        orderBy("displayName"),
        where("displayName", ">=", query),
        where("displayName", "<=", query + "\uf8ff"),
        limit(10)
      );

      const snapshot = await getDocs(q);
      userProfiles = snapshot.docs.map(doc => ({
        id: doc.id,
        displayName: doc.data().displayName || "Unknown",
        avatarUrl: doc.data().avatarUrl,
      }));
    } catch (e) {
      console.error("Failed to search users:", e);
      userProfiles = [];
    } finally {
      loadingUsers = false;
    }
  }

  async function assignPerformer(video: ShowcaseVideo, user: UserProfile | null) {
    try {
      const { doc, updateDoc } = await import("firebase/firestore");
      const db = await getFirestoreInstance();

      const updates = {
        performerId: user?.id || null,
        performerName: user?.displayName || null,
      };

      await updateDoc(doc(db, "showcaseVideos", video.shortcode), updates);

      // Update local state
      const index = videos.findIndex(v => v.shortcode === video.shortcode);
      if (index !== -1) {
        videos[index] = { ...videos[index], ...updates };
        videos = [...videos];
      }

      // Update selected video if it's the same
      if (selectedVideo?.shortcode === video.shortcode) {
        selectedVideo = { ...selectedVideo, ...updates };
      }

      showUserSearch = false;
      userSearchQuery = "";
      userProfiles = [];
    } catch (e) {
      console.error("Failed to assign performer:", e);
    }
  }

  async function selectVideo(video: ShowcaseVideo) {
    selectedVideo = video;
    selectedVideoUrl = null; // Reset while loading
    isPlaying = false;

    // Get cached URL (or original if not cached yet)
    const cachedUrl = await videoCache.getVideoUrl(video.videoUrl, {
      cacheIfMissing: true,
      priority: 100, // High priority for user-selected video
    });
    selectedVideoUrl = cachedUrl;
  }

  function closePreview() {
    selectedVideo = null;
    selectedVideoUrl = null;
    isPlaying = false;
  }

  function startEdit(video: ShowcaseVideo) {
    editingVideo = video;
    editTitle = video.title || "";
    editCategory = video.category || "";
    editTags = video.tags.join(", ");
    editPerformerId = video.performerId;
  }

  function cancelEdit() {
    editingVideo = null;
  }

  async function saveEdit() {
    if (!editingVideo) return;
    saving = true;

    try {
      const { doc, updateDoc } = await import("firebase/firestore");
      const db = await getFirestoreInstance();

      const updates = {
        title: editTitle.trim() || null,
        category: editCategory || null,
        tags: editTags.split(",").map(t => t.trim()).filter(Boolean),
      };

      await updateDoc(doc(db, "showcaseVideos", editingVideo.shortcode), updates);

      // Update local state
      const index = videos.findIndex(v => v.shortcode === editingVideo!.shortcode);
      if (index !== -1) {
        videos[index] = { ...videos[index], ...updates };
        videos = [...videos]; // Trigger reactivity
      }

      editingVideo = null;
    } catch (e) {
      console.error("Failed to save:", e);
    } finally {
      saving = false;
    }
  }

  async function toggleFeatured(video: ShowcaseVideo) {
    try {
      const { doc, updateDoc } = await import("firebase/firestore");
      const db = await getFirestoreInstance();

      const newValue = !video.featured;
      await updateDoc(doc(db, "showcaseVideos", video.shortcode), {
        featured: newValue,
      });

      // Update local state
      const index = videos.findIndex(v => v.shortcode === video.shortcode);
      if (index !== -1) {
        videos[index] = { ...videos[index], featured: newValue };
        videos = [...videos];
      }
    } catch (e) {
      console.error("Failed to toggle featured:", e);
    }
  }

  async function setCategory(video: ShowcaseVideo, category: string) {
    try {
      const { doc, updateDoc } = await import("firebase/firestore");
      const db = await getFirestoreInstance();

      await updateDoc(doc(db, "showcaseVideos", video.shortcode), { category });

      const index = videos.findIndex(v => v.shortcode === video.shortcode);
      if (index !== -1) {
        videos[index] = { ...videos[index], category };
        videos = [...videos];
      }
    } catch (e) {
      console.error("Failed to set category:", e);
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

  onMount(async () => {
    // Load categories first (for filter dropdowns)
    await loadCategories();

    await loadVideos();

    // Load cache stats
    const stats = await videoCache.getStats();
    cacheStats = { count: stats.count, totalSize: stats.totalSize };

    // Preload first batch of videos (visible in viewport)
    if (videos.length > 0) {
      const preloadUrls = videos.slice(0, 12).map((v) => v.videoUrl);
      videoCache.preload(preloadUrls);
    }
  });

  // Preload more videos when filtered list changes
  $effect(() => {
    if (filteredVideos.length > 0) {
      const preloadUrls = filteredVideos.slice(0, 8).map((v) => v.videoUrl);
      videoCache.preload(preloadUrls);
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
      {#if cacheStats.count > 0}
        <div class="stat cached">
          <span class="stat-value">{cacheStats.count}</span>
          <span class="stat-label">Cached ({formatFileSize(cacheStats.totalSize)})</span>
        </div>
      {/if}
    </div>
  </header>

  <!-- Filters -->
  <div class="filters-bar">
    <div class="filter-group">
      <label for="category-filter">Category:</label>
      <select id="category-filter" bind:value={filterCategory}>
        <option value="all">All</option>
        <option value="">Uncategorized</option>
        {#each CATEGORIES as cat}
          <option value={cat.id}>{cat.label}</option>
        {/each}
      </select>
    </div>

    <div class="filter-group">
      <label for="featured-filter">Featured:</label>
      <select id="featured-filter" bind:value={filterFeatured}>
        <option value={null}>All</option>
        <option value={true}>Featured only</option>
        <option value={false}>Not featured</option>
      </select>
    </div>

    <div class="filter-group search">
      <input
        type="search"
        placeholder="Search videos..."
        bind:value={searchQuery}
      />
    </div>

    <button class="refresh-btn" onclick={loadVideos} disabled={loading}>
      <i class="fas fa-sync-alt" class:fa-spin={loading} aria-hidden="true"></i>
      Refresh
    </button>
  </div>

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
          <!-- Video thumbnail (using video element with poster) -->
          <div class="video-thumbnail">
            <video
              src={video.videoUrl}
              preload="metadata"
              muted
            >
              <track kind="captions" />
            </video>
            {#if video.featured}
              <div class="featured-badge">
                <i class="fas fa-star" aria-hidden="true"></i>
              </div>
            {/if}
            {#if video.category}
              {@const cat = CATEGORIES.find(c => c.id === video.category)}
              <div class="category-badge" style="background: {cat?.color || '#666'}">
                {cat?.label || video.category}
              </div>
            {/if}
          </div>

          <!-- Video info -->
          <div class="video-info">
            <span class="video-title">{video.title || video.shortcode}</span>
            <span class="video-meta">
              {formatDate(video.instagramDate)} · {formatFileSize(video.fileSize)}
            </span>
          </div>

          <!-- Quick actions -->
          <div class="quick-actions">
            <button
              class="action-btn"
              class:active={video.featured}
              onclick={(e) => { e.stopPropagation(); toggleFeatured(video); }}
              title={video.featured ? "Remove from featured" : "Add to featured"}
            >
              <i class="fas fa-star" aria-hidden="true"></i>
            </button>
            <button
              class="action-btn"
              onclick={(e) => { e.stopPropagation(); startEdit(video); }}
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
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="preview-modal" onclick={closePreview} onkeydown={(e) => e.key === "Escape" && closePreview()}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="preview-content" onclick={(e) => e.stopPropagation()}>
      <button class="close-btn" onclick={closePreview}>
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>

      <div class="preview-video">
        {#if selectedVideoUrl}
          <!-- svelte-ignore a11y_media_has_caption -->
          <video
            src={selectedVideoUrl}
            controls
            autoplay
            playsinline
          ></video>
        {:else}
          <div class="video-loading">
            <div class="spinner"></div>
            <span>Loading video...</span>
          </div>
        {/if}
      </div>

      <div class="preview-details">
        <h2>{selectedVideo.title || selectedVideo.shortcode}</h2>
        <p class="preview-meta">
          {formatDate(selectedVideo.instagramDate)} · {formatFileSize(selectedVideo.fileSize)}
        </p>

        <div class="category-selector">
          <span class="label">Category:</span>
          <div class="category-buttons">
            {#each CATEGORIES as cat}
              <button
                class="cat-btn"
                class:active={selectedVideo.category === cat.id}
                style="--cat-color: {cat.color}"
                onclick={() => setCategory(selectedVideo!, cat.id)}
              >
                {cat.label}
              </button>
            {/each}
          </div>
        </div>

        <div class="featured-toggle">
          <button
            class="feature-btn"
            class:active={selectedVideo.featured}
            onclick={() => toggleFeatured(selectedVideo!)}
          >
            <i class="fas fa-star" aria-hidden="true"></i>
            {selectedVideo.featured ? "Featured" : "Mark as Featured"}
          </button>
        </div>

        <div class="video-url">
          <input type="text" value={selectedVideo.videoUrl} readonly />
          <button onclick={() => navigator.clipboard.writeText(selectedVideo!.videoUrl)}>
            <i class="fas fa-copy" aria-hidden="true"></i>
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Edit modal -->
{#if editingVideo}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="edit-modal" onclick={cancelEdit}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="edit-content" onclick={(e) => e.stopPropagation()}>
      <h2>Edit Video</h2>

      <div class="form-group">
        <label for="edit-title">Title</label>
        <input id="edit-title" type="text" bind:value={editTitle} placeholder="Enter a title..." />
      </div>

      <div class="form-group">
        <label for="edit-category">Category</label>
        <select id="edit-category" bind:value={editCategory}>
          <option value="">None</option>
          {#each CATEGORIES as cat}
            <option value={cat.id}>{cat.label}</option>
          {/each}
        </select>
      </div>

      <div class="form-group">
        <label for="edit-tags">Tags (comma-separated)</label>
        <input id="edit-tags" type="text" bind:value={editTags} placeholder="tag1, tag2, tag3" />
      </div>

      <div class="form-actions">
        <button class="cancel-btn" onclick={cancelEdit} disabled={saving}>Cancel</button>
        <button class="save-btn" onclick={saveEdit} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .video-curator {
    padding: 24px;
    max-width: 1400px;
    margin: 0 auto;
  }

  /* Header */
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

  /* Filters */
  .filters-bar {
    display: flex;
    gap: 16px;
    margin-bottom: 24px;
    flex-wrap: wrap;
    align-items: center;
  }

  .filter-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .filter-group label {
    font-size: 14px;
    color: var(--theme-text-dim);
  }

  .filter-group select,
  .filter-group input {
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid var(--theme-stroke);
    background: var(--theme-card-bg);
    color: var(--theme-text);
    font-size: 14px;
  }

  .filter-group.search {
    flex: 1;
    min-width: 200px;
  }

  .filter-group.search input {
    width: 100%;
  }

  .refresh-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-radius: 8px;
    border: 1px solid var(--theme-stroke);
    background: var(--theme-card-bg);
    color: var(--theme-text);
    cursor: pointer;
    transition: all 0.2s;
  }

  .refresh-btn:hover:not(:disabled) {
    background: var(--theme-accent);
    border-color: var(--theme-accent);
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

  .loading-state i,
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
    to { transform: rotate(360deg); }
  }

  /* Preview modal */
  .preview-modal,
  .edit-modal {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .preview-content {
    background: var(--theme-panel-bg);
    border-radius: 16px;
    max-width: 500px;
    width: 100%;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .close-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 10;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    background: rgba(0, 0, 0, 0.5);
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .preview-video {
    aspect-ratio: 9 / 16;
    max-height: 50vh;
    background: #000;
  }

  .preview-video video {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .video-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 12px;
    color: var(--theme-text-dim);
  }

  .preview-details {
    padding: 20px;
  }

  .preview-details h2 {
    margin: 0 0 8px 0;
    font-size: 1.25rem;
  }

  .preview-meta {
    color: var(--theme-text-dim);
    font-size: 14px;
    margin-bottom: 16px;
  }

  .category-selector {
    margin-bottom: 16px;
  }

  .category-selector .label {
    display: block;
    font-size: 12px;
    color: var(--theme-text-dim);
    margin-bottom: 8px;
  }

  .category-buttons {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .cat-btn {
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid var(--theme-stroke);
    background: var(--theme-card-bg);
    color: var(--theme-text);
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
  }

  .cat-btn:hover {
    border-color: var(--cat-color);
  }

  .cat-btn.active {
    background: var(--cat-color);
    border-color: var(--cat-color);
    color: white;
  }

  .feature-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-radius: 8px;
    border: 1px solid var(--theme-stroke);
    background: var(--theme-card-bg);
    color: var(--theme-text);
    cursor: pointer;
    font-size: 14px;
    width: 100%;
    justify-content: center;
    margin-bottom: 16px;
    transition: all 0.2s;
  }

  .feature-btn:hover {
    border-color: #f59e0b;
  }

  .feature-btn.active {
    background: #f59e0b;
    border-color: #f59e0b;
    color: white;
  }

  .video-url {
    display: flex;
    gap: 8px;
  }

  .video-url input {
    flex: 1;
    padding: 8px;
    border-radius: 6px;
    border: 1px solid var(--theme-stroke);
    background: var(--theme-card-bg);
    color: var(--theme-text);
    font-size: 12px;
  }

  .video-url button {
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid var(--theme-stroke);
    background: var(--theme-card-bg);
    color: var(--theme-text);
    cursor: pointer;
  }

  /* Edit modal */
  .edit-content {
    background: var(--theme-panel-bg);
    border-radius: 16px;
    padding: 24px;
    max-width: 400px;
    width: 100%;
  }

  .edit-content h2 {
    margin: 0 0 20px 0;
  }

  .form-group {
    margin-bottom: 16px;
  }

  .form-group label {
    display: block;
    font-size: 13px;
    color: var(--theme-text-dim);
    margin-bottom: 6px;
  }

  .form-group input,
  .form-group select {
    width: 100%;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid var(--theme-stroke);
    background: var(--theme-card-bg);
    color: var(--theme-text);
    font-size: 14px;
  }

  .form-actions {
    display: flex;
    gap: 12px;
    margin-top: 24px;
  }

  .cancel-btn,
  .save-btn {
    flex: 1;
    padding: 12px;
    border-radius: 8px;
    border: none;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .cancel-btn {
    background: var(--theme-card-bg);
    color: var(--theme-text);
  }

  .save-btn {
    background: var(--theme-accent);
    color: white;
  }

  .save-btn:disabled,
  .cancel-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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
