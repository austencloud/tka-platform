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
  import UserSearchInput from "$lib/shared/user-search/UserSearchInput.svelte";

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

  interface MatchedSequence {
    id: string;
    word: string;
    name: string;
    ownerId: string;
    ownerName: string;
    thumbnail: string | null;
    isPublic: boolean;
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
    { id: "demonstration", label: "Demonstration", color: "#06b6d4" }, // Clean execution of a single sequence
    { id: "tutorial", label: "Tutorial", color: "#3b82f6" }, // Educational content teaching technique
    { id: "composition", label: "Composition", color: "#10b981" }, // Sequence combined/transformed with itself or others
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

  // Filter by TKA word presence
  let filterHasWord = $state<string>("all"); // "all", "yes", "no"

  // === CURATION MODE ===
  // Focused mode for quickly going through videos one by one
  let curationMode = $state(false);
  let curationIndex = $state(0);
  let curationSaving = $state(false);

  // Quick performers (pinned for fast access, stored in Firestore)
  const DEFAULT_QUICK_PERFORMERS: UserProfile[] = [
    { id: "PBp3GSBO6igCKPwJyLZNmVEmamI3", displayName: "Austen" },
    { id: "40ovmSoxdRNouOIeQrhDFSwkDEX2", displayName: "Skylar" },
  ];
  let quickPerformers = $state<UserProfile[]>([...DEFAULT_QUICK_PERFORMERS]);
  let showAddPerformer = $state(false);

  // Keyboard shortcut letters for performers (dynamic based on list)
  const PERFORMER_KEYS = 'asdfgh';

  // === SEQUENCE LINKING ===
  let linkingMode = $state(false);
  let linkingIndex = $state(0);
  let linkingSearching = $state(false);
  let linkingSaving = $state(false);
  let matchedSequences = $state<MatchedSequence[]>([]);
  let selectedSequenceForLink = $state<MatchedSequence | null>(null);

  // Videos with TKA words that aren't linked to sequences yet
  const unlinkableVideos = $derived.by(() => {
    return videos.filter(v => v.title && v.title.length > 0 && !v.sequenceId);
  });

  // Current video in linking mode
  const currentLinkingVideo = $derived.by(() => {
    if (!linkingMode || unlinkableVideos.length === 0) return null;
    return unlinkableVideos[Math.min(linkingIndex, unlinkableVideos.length - 1)] || null;
  });

  // Progress in linking
  const linkingProgress = $derived({
    current: linkingIndex + 1,
    total: unlinkableVideos.length,
    linked: videos.filter(v => v.sequenceId).length,
  });

  // Videos that need curation (no category or no performer)
  const uncuratedVideos = $derived.by(() => {
    return videos.filter(v => !v.category || !v.performerId);
  });

  // Current video in curation mode
  const currentCurationVideo = $derived.by(() => {
    if (!curationMode || uncuratedVideos.length === 0) return null;
    return uncuratedVideos[Math.min(curationIndex, uncuratedVideos.length - 1)] || null;
  });

  // Progress in curation
  const curationProgress = $derived({
    current: curationIndex + 1,
    total: uncuratedVideos.length,
    done: videos.length - uncuratedVideos.length,
  });

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

    // TKA word filter
    if (filterHasWord === "yes") {
      result = result.filter(v => v.title && v.title.length > 0);
    } else if (filterHasWord === "no") {
      result = result.filter(v => !v.title);
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
    withWord: videos.filter(v => v.title && v.title.length > 0).length,
  });

  // === CURATION MODE FUNCTIONS ===

  function enterCurationMode() {
    curationMode = true;
    curationIndex = 0;
  }

  function exitCurationMode() {
    curationMode = false;
  }

  function nextCurationVideo() {
    if (curationIndex < uncuratedVideos.length - 1) {
      curationIndex++;
    }
  }

  function prevCurationVideo() {
    if (curationIndex > 0) {
      curationIndex--;
    }
  }

  async function setCurationCategory(categoryId: string) {
    const video = currentCurationVideo;
    if (!video || curationSaving) return;

    curationSaving = true;
    try {
      const { doc, updateDoc } = await import("firebase/firestore");
      const db = await getFirestoreInstance();

      await updateDoc(doc(db, "showcaseVideos", video.shortcode), { category: categoryId });

      // Update local state
      const index = videos.findIndex(v => v.shortcode === video.shortcode);
      if (index !== -1) {
        videos[index] = { ...videos[index], category: categoryId };
        videos = [...videos];
      }

      // If video now has both category and performer, it's curated - auto-advance
      if (video.performerId) {
        // Small delay so user sees the update before advancing
        setTimeout(() => nextCurationVideo(), 200);
      }
    } catch (e) {
      console.error("Failed to set category:", e);
    } finally {
      curationSaving = false;
    }
  }

  async function setCurationPerformer(user: UserProfile) {
    const video = currentCurationVideo;
    if (!video || curationSaving) return;

    curationSaving = true;
    try {
      const { doc, updateDoc } = await import("firebase/firestore");
      const db = await getFirestoreInstance();

      const updates = {
        performerId: user.id,
        performerName: user.displayName,
      };

      await updateDoc(doc(db, "showcaseVideos", video.shortcode), updates);

      // Update local state
      const index = videos.findIndex(v => v.shortcode === video.shortcode);
      if (index !== -1) {
        videos[index] = { ...videos[index], ...updates };
        videos = [...videos];
      }

      // If video now has both category and performer, it's curated - auto-advance
      if (video.category) {
        setTimeout(() => nextCurationVideo(), 200);
      }
    } catch (e) {
      console.error("Failed to set performer:", e);
    } finally {
      curationSaving = false;
    }
  }

  async function skipCurationVideo() {
    // Mark as skipped (we'll use a special category or just advance)
    nextCurationVideo();
  }

  function handleCurationKeydown(e: KeyboardEvent) {
    if (!curationMode || curationSaving) return;

    // Number keys 1-N for categories (dynamic based on categories.length)
    const num = parseInt(e.key);
    if (num >= 1 && num <= categories.length) {
      e.preventDefault();
      setCurationCategory(categories[num - 1].id);
      return;
    }

    // Letter shortcuts for quick performers (A, S, D, F, G, H...)
    const letterIndex = PERFORMER_KEYS.indexOf(e.key.toLowerCase());
    if (letterIndex >= 0 && letterIndex < quickPerformers.length) {
      e.preventDefault();
      setCurationPerformer(quickPerformers[letterIndex]);
      return;
    }

    // Navigation
    if (e.key === "ArrowLeft" || e.key === "h") {
      e.preventDefault();
      prevCurationVideo();
      return;
    }
    if (e.key === "ArrowRight" || e.key === "l") {
      e.preventDefault();
      nextCurationVideo();
      return;
    }

    // Skip
    if (e.key === "x" || e.key === "Escape") {
      if (e.key === "Escape") {
        exitCurationMode();
      } else {
        skipCurationVideo();
      }
      return;
    }
  }

  // === SEQUENCE LINKING FUNCTIONS ===

  function enterLinkingMode() {
    linkingMode = true;
    linkingIndex = 0;
    matchedSequences = [];
    selectedSequenceForLink = null;
    // Auto-search for the first video
    if (unlinkableVideos.length > 0) {
      searchSequencesForCurrentVideo();
    }
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
      const { collection, getDocs, query, where } = await import("firebase/firestore");
      const db = await getFirestoreInstance();

      const word = video.title.toUpperCase();
      const results: MatchedSequence[] = [];

      // Search in publicSequences (has open read access)
      const publicQuery = query(
        collection(db, "publicSequences"),
        where("word", "==", word)
      );
      const publicSnapshot = await getDocs(publicQuery);

      for (const doc of publicSnapshot.docs) {
        const data = doc.data();
        results.push({
          id: doc.id,
          word: data.word || "",
          name: data.name || data.word || "Untitled",
          ownerId: data.ownerId || "",
          ownerName: data.author || data.ownerName || "Unknown",
          thumbnail: data.thumbnails?.[0] || null,
          isPublic: true,
        });
      }

      // Also search Austen's sequences directly (known user ID)
      const austenId = "PBp3GSBO6igCKPwJyLZNmVEmamI3";
      const austenQuery = query(
        collection(db, `users/${austenId}/sequences`),
        where("word", "==", word)
      );
      const austenSnapshot = await getDocs(austenQuery);

      for (const doc of austenSnapshot.docs) {
        const data = doc.data();
        // Avoid duplicates
        if (!results.some(r => r.id === doc.id)) {
          results.push({
            id: doc.id,
            word: data.word || "",
            name: data.name || data.word || "Untitled",
            ownerId: austenId,
            ownerName: data.author || "Austen",
            thumbnail: data.thumbnails?.[0] || null,
            isPublic: data.visibility === "public",
          });
        }
      }

      matchedSequences = results;

      // If exactly one match, pre-select it
      if (results.length === 1) {
        selectedSequenceForLink = results[0];
      }
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
      const { doc, updateDoc } = await import("firebase/firestore");
      const db = await getFirestoreInstance();

      const updates = {
        sequenceId: selectedSequenceForLink.id,
        sequenceWord: selectedSequenceForLink.word,
      };

      await updateDoc(doc(db, "showcaseVideos", video.shortcode), updates);

      // Update local state
      const index = videos.findIndex(v => v.shortcode === video.shortcode);
      if (index !== -1) {
        videos[index] = { ...videos[index], ...updates };
        videos = [...videos];
      }

      // Move to next unlinked video
      setTimeout(() => {
        // Index doesn't change because the current video is removed from unlinkableVideos
        matchedSequences = [];
        selectedSequenceForLink = null;
        if (unlinkableVideos.length > 0) {
          searchSequencesForCurrentVideo();
        }
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

  function handleLinkingKeydown(e: KeyboardEvent) {
    if (!linkingMode || linkingSaving || linkingSearching) return;

    // Number keys to select a sequence
    const num = parseInt(e.key);
    if (num >= 1 && num <= matchedSequences.length) {
      e.preventDefault();
      selectedSequenceForLink = matchedSequences[num - 1];
      return;
    }

    // Enter to confirm link
    if (e.key === "Enter" && selectedSequenceForLink) {
      e.preventDefault();
      linkVideoToSequence();
      return;
    }

    // Navigation
    if (e.key === "ArrowLeft" || e.key === "h") {
      e.preventDefault();
      prevLinkingVideo();
      return;
    }
    if (e.key === "ArrowRight" || e.key === "l") {
      e.preventDefault();
      nextLinkingVideo();
      return;
    }

    // Skip
    if (e.key === "x") {
      e.preventDefault();
      skipLinkingVideo();
      return;
    }

    // Exit
    if (e.key === "Escape") {
      e.preventDefault();
      exitLinkingMode();
      return;
    }
  }

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

  // === QUICK PERFORMERS FIRESTORE ===

  async function loadQuickPerformers() {
    try {
      const { doc, getDoc } = await import("firebase/firestore");
      const db = await getFirestoreInstance();

      const docRef = doc(db, "config", "quickPerformers");
      const snapshot = await getDoc(docRef);

      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.performers && Array.isArray(data.performers)) {
          quickPerformers = data.performers;
        }
      }
    } catch (e) {
      console.warn("Failed to load quick performers, using defaults:", e);
    }
  }

  async function saveQuickPerformers() {
    try {
      const { doc, setDoc } = await import("firebase/firestore");
      const db = await getFirestoreInstance();

      await setDoc(doc(db, "config", "quickPerformers"), {
        performers: quickPerformers.map(p => ({ id: p.id, displayName: p.displayName })),
        updatedAt: new Date(),
      });
    } catch (e) {
      console.error("Failed to save quick performers:", e);
    }
  }

  async function addQuickPerformer(user: { uid: string; displayName: string }) {
    // Don't add duplicates
    if (quickPerformers.some(p => p.id === user.uid)) {
      showAddPerformer = false;
      return;
    }

    quickPerformers = [...quickPerformers, { id: user.uid, displayName: user.displayName }];
    await saveQuickPerformers();
    showAddPerformer = false;
  }

  async function removeQuickPerformer(id: string) {
    quickPerformers = quickPerformers.filter(p => p.id !== id);
    await saveQuickPerformers();
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
    // Load categories and quick performers (for filter dropdowns and curation)
    await Promise.all([loadCategories(), loadQuickPerformers()]);

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

  // Keyboard shortcuts for curation mode
  $effect(() => {
    if (!curationMode) return;

    window.addEventListener("keydown", handleCurationKeydown);
    return () => window.removeEventListener("keydown", handleCurationKeydown);
  });

  // Preload current curation video
  $effect(() => {
    if (currentCurationVideo) {
      videoCache.getVideoUrl(currentCurationVideo.videoUrl, {
        cacheIfMissing: true,
        priority: 100,
      });
    }
  });

  // Keyboard shortcuts for linking mode
  $effect(() => {
    if (!linkingMode) return;

    window.addEventListener("keydown", handleLinkingKeydown);
    return () => window.removeEventListener("keydown", handleLinkingKeydown);
  });

  // Preload current linking video
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

  <!-- Modern Filter Bar -->
  <div class="modern-filters">
    <!-- Search -->
    <div class="search-container">
      <i class="fas fa-search search-icon" aria-hidden="true"></i>
      <input
        type="search"
        placeholder="Search videos..."
        bind:value={searchQuery}
        class="search-input"
      />
      {#if searchQuery}
        <button class="clear-search" onclick={() => searchQuery = ""}>
          <i class="fas fa-times" aria-hidden="true"></i>
        </button>
      {/if}
    </div>

    <!-- Action buttons -->
    <div class="action-buttons-row">
      <button class="icon-btn" onclick={loadVideos} disabled={loading} title="Refresh">
        <i class="fas fa-sync-alt" class:fa-spin={loading} aria-hidden="true"></i>
      </button>

      {#if uncuratedVideos.length > 0}
        <button class="action-pill curate" onclick={enterCurationMode}>
          <i class="fas fa-magic" aria-hidden="true"></i>
          <span>Curate</span>
          <span class="count">{uncuratedVideos.length}</span>
        </button>
      {/if}

      {#if unlinkableVideos.length > 0}
        <button class="action-pill link" onclick={enterLinkingMode}>
          <i class="fas fa-link" aria-hidden="true"></i>
          <span>Link</span>
          <span class="count">{unlinkableVideos.length}</span>
        </button>
      {/if}
    </div>
  </div>

  <!-- Filter chips -->
  <div class="filter-chips-container">
    <!-- Category chips -->
    <div class="chip-group">
      <span class="chip-label">Category</span>
      <div class="chips">
        <button
          class="chip"
          class:active={filterCategory === "all"}
          onclick={() => filterCategory = "all"}
        >
          All
        </button>
        <button
          class="chip"
          class:active={filterCategory === ""}
          onclick={() => filterCategory = ""}
        >
          <i class="fas fa-question-circle" aria-hidden="true"></i>
          None
        </button>
        {#each categories as cat}
          <button
            class="chip"
            class:active={filterCategory === cat.id}
            style="--chip-color: {cat.color}"
            onclick={() => filterCategory = cat.id}
          >
            {cat.label}
          </button>
        {/each}
        <button
          class="chip add-chip"
          onclick={() => showAddCategory = !showAddCategory}
          title="Add category"
        >
          <i class="fas fa-plus" aria-hidden="true"></i>
        </button>
      </div>
    </div>

    <!-- Performer chips -->
    <div class="chip-group">
      <span class="chip-label">Performer</span>
      <div class="chips">
        <button
          class="chip"
          class:active={filterPerformer === "all"}
          onclick={() => filterPerformer = "all"}
        >
          All
        </button>
        <button
          class="chip"
          class:active={filterPerformer === ""}
          onclick={() => filterPerformer = ""}
        >
          <i class="fas fa-user-slash" aria-hidden="true"></i>
          Unassigned
        </button>
        {#each performers as p}
          <button
            class="chip performer-chip"
            class:active={filterPerformer === p.id}
            onclick={() => filterPerformer = p.id}
          >
            {p.name}
          </button>
        {/each}
      </div>
    </div>

    <!-- Toggle chips row -->
    <div class="chip-group toggles">
      <div class="chips">
        <!-- TKA Word filter -->
        <button
          class="chip toggle-chip"
          class:active={filterHasWord === "yes"}
          onclick={() => filterHasWord = filterHasWord === "yes" ? "all" : "yes"}
        >
          <i class="fas fa-font" aria-hidden="true"></i>
          Has Word
        </button>
        <button
          class="chip toggle-chip"
          class:active={filterHasWord === "no"}
          onclick={() => filterHasWord = filterHasWord === "no" ? "all" : "no"}
        >
          <i class="fas fa-font" style="opacity: 0.4" aria-hidden="true"></i>
          No Word
        </button>

        <!-- Featured filter -->
        <button
          class="chip toggle-chip featured-chip"
          class:active={filterFeatured === true}
          onclick={() => filterFeatured = filterFeatured === true ? null : true}
        >
          <i class="fas fa-star" aria-hidden="true"></i>
          Featured
        </button>
        <button
          class="chip toggle-chip"
          class:active={filterFeatured === false}
          onclick={() => filterFeatured = filterFeatured === false ? null : false}
        >
          <i class="far fa-star" aria-hidden="true"></i>
          Not Featured
        </button>
      </div>
    </div>

    <!-- Active filter summary -->
    {#if filterCategory !== "all" || filterPerformer !== "all" || filterHasWord !== "all" || filterFeatured !== null || searchQuery}
      <div class="active-filters">
        <span class="filter-count">{filteredVideos.length} of {videos.length}</span>
        <button class="clear-all" onclick={() => {
          filterCategory = "all";
          filterPerformer = "all";
          filterHasWord = "all";
          filterFeatured = null;
          searchQuery = "";
        }}>
          <i class="fas fa-times" aria-hidden="true"></i>
          Clear filters
        </button>
      </div>
    {/if}
  </div>

  <!-- Add category popup -->
  {#if showAddCategory}
    <div class="add-category-popup">
      <input
        type="text"
        placeholder="Category name..."
        bind:value={newCategoryLabel}
        onkeydown={(e) => e.key === "Enter" && addCategory()}
      />
      <input
        type="color"
        bind:value={newCategoryColor}
        title="Category color"
      />
      <button class="save-btn" onclick={addCategory} disabled={!newCategoryLabel.trim()}>
        Add
      </button>
      <button class="cancel-btn" onclick={() => showAddCategory = false}>
        Cancel
      </button>
    </div>
  {/if}

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
              {@const cat = categories.find(c => c.id === video.category)}
              <div class="category-badge" style="background: {cat?.color || '#666'}">
                {cat?.label || video.category}
              </div>
            {/if}
            {#if video.performerName}
              <div class="performer-badge">
                <i class="fas fa-user" aria-hidden="true"></i>
                {video.performerName}
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
            {#each categories as cat}
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

        <!-- Performer assignment -->
        <div class="performer-selector">
          <span class="label">Performer:</span>
          {#if selectedVideo.performerName}
            <div class="current-performer">
              <span>{selectedVideo.performerName}</span>
              <button class="remove-btn" onclick={() => assignPerformer(selectedVideo!, null)} title="Remove performer">
                <i class="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>
          {:else}
            <button class="assign-btn" onclick={() => showUserSearch = true}>
              <i class="fas fa-user-plus" aria-hidden="true"></i>
              Assign Performer
            </button>
          {/if}

          {#if showUserSearch}
            <div class="user-search-popup">
              <input
                type="text"
                placeholder="Search users..."
                bind:value={userSearchQuery}
                oninput={(e) => searchUsers((e.target as HTMLInputElement).value)}
              />
              {#if loadingUsers}
                <div class="search-loading">Searching...</div>
              {:else if userProfiles.length > 0}
                <div class="user-results">
                  {#each userProfiles as user}
                    <button class="user-result" onclick={() => assignPerformer(selectedVideo!, user)}>
                      {#if user.avatarUrl}
                        <img src={user.avatarUrl} alt="" class="user-avatar" />
                      {:else}
                        <div class="user-avatar-placeholder">
                          <i class="fas fa-user" aria-hidden="true"></i>
                        </div>
                      {/if}
                      <span class="user-name">{user.displayName}</span>
                    </button>
                  {/each}
                </div>
              {:else if userSearchQuery.length >= 2}
                <div class="no-results">No users found</div>
              {/if}
              <button class="cancel-search" onclick={() => { showUserSearch = false; userSearchQuery = ""; userProfiles = []; }}>
                Cancel
              </button>
            </div>
          {/if}
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
          {#each categories as cat}
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

<!-- Curation mode overlay -->
{#if curationMode && currentCurationVideo}
  <div class="curation-overlay">
    <div class="curation-header">
      <div class="curation-progress">
        <span class="progress-text">
          {curationProgress.current} / {curationProgress.total} uncurated
          <span class="done-count">({curationProgress.done} done)</span>
        </span>
        <div class="progress-bar">
          <div
            class="progress-fill"
            style="width: {(curationProgress.done / stats.total) * 100}%"
          ></div>
        </div>
      </div>
      <button class="exit-btn" onclick={exitCurationMode}>
        <i class="fas fa-times" aria-hidden="true"></i>
        Exit (Esc)
      </button>
    </div>

    <div class="curation-main">
      <!-- Navigation arrow left -->
      <button
        class="nav-arrow left"
        onclick={prevCurationVideo}
        disabled={curationIndex === 0}
      >
        <i class="fas fa-chevron-left" aria-hidden="true"></i>
      </button>

      <!-- Video display -->
      <div class="curation-video-container">
        <div class="video-wrapper">
          <!-- svelte-ignore a11y_media_has_caption -->
          <video
            src={currentCurationVideo.videoUrl}
            controls
            autoplay
            loop
            playsinline
          ></video>
        </div>

        <div class="video-title-bar">
          <span class="title">{currentCurationVideo.title || currentCurationVideo.shortcode}</span>
          <span class="date">{formatDate(currentCurationVideo.instagramDate)}</span>
        </div>

        <!-- Current state indicators -->
        <div class="current-state">
          {#if currentCurationVideo.category}
            {@const cat = categories.find(c => c.id === currentCurationVideo.category)}
            <span class="state-badge category" style="background: {cat?.color || '#666'}">
              {cat?.label || currentCurationVideo.category}
            </span>
          {:else}
            <span class="state-badge empty">No category</span>
          {/if}

          {#if currentCurationVideo.performerName}
            <span class="state-badge performer">
              <i class="fas fa-user" aria-hidden="true"></i>
              {currentCurationVideo.performerName}
            </span>
          {:else}
            <span class="state-badge empty">No performer</span>
          {/if}
        </div>
      </div>

      <!-- Navigation arrow right -->
      <button
        class="nav-arrow right"
        onclick={nextCurationVideo}
        disabled={curationIndex >= uncuratedVideos.length - 1}
      >
        <i class="fas fa-chevron-right" aria-hidden="true"></i>
      </button>
    </div>

    <!-- Quick action buttons -->
    <div class="curation-actions">
      <!-- Category buttons -->
      <div class="action-section">
        <span class="section-label">Category</span>
        <div class="action-buttons">
          {#each categories as cat, i}
            <button
              class="action-btn category-action"
              class:active={currentCurationVideo.category === cat.id}
              style="--cat-color: {cat.color}"
              onclick={() => setCurationCategory(cat.id)}
              disabled={curationSaving}
            >
              <span class="key-hint">{i + 1}</span>
              {cat.label}
            </button>
          {/each}
          {#if !showAddCategory}
            <button
              class="action-btn add-btn"
              type="button"
              onclick={() => showAddCategory = true}
              title="Add category"
            >
              <i class="fas fa-plus" aria-hidden="true"></i>
            </button>
          {/if}
        </div>
        {#if showAddCategory}
          <div class="add-category-inline">
            <input
              type="text"
              placeholder="Category name..."
              bind:value={newCategoryLabel}
              onkeydown={(e) => e.key === "Enter" && addCategory()}
            />
            <input
              type="color"
              bind:value={newCategoryColor}
              title="Category color"
            />
            <button class="save-btn" onclick={addCategory} disabled={!newCategoryLabel.trim()}>
              Add
            </button>
            <button class="cancel-btn" onclick={() => showAddCategory = false}>
              Cancel
            </button>
          </div>
        {/if}
      </div>

      <!-- Performer buttons -->
      <div class="action-section">
        <span class="section-label">Performer</span>
        <div class="action-buttons">
          {#each quickPerformers as performer, i}
            <button
              class="action-btn performer-action"
              class:active={currentCurationVideo.performerId === performer.id}
              onclick={() => setCurationPerformer(performer)}
              disabled={curationSaving}
            >
              <span class="key-hint">{PERFORMER_KEYS[i]?.toUpperCase() || ''}</span>
              {performer.displayName}
              <button
                class="remove-performer-btn"
                type="button"
                onclick={(e) => { e.stopPropagation(); removeQuickPerformer(performer.id); }}
                title="Remove performer"
              >
                <i class="fas fa-times" aria-hidden="true"></i>
              </button>
            </button>
          {/each}
          {#if !showAddPerformer}
            <button
              class="action-btn add-btn"
              type="button"
              onclick={() => showAddPerformer = true}
              title="Add performer"
            >
              <i class="fas fa-plus" aria-hidden="true"></i>
            </button>
          {/if}
        </div>
        {#if showAddPerformer}
          <div class="add-performer-inline">
            <UserSearchInput
              onSelect={(user) => addQuickPerformer(user)}
              placeholder="Search user..."
              autofocus={true}
              inlineResults={true}
              excludeUserIds={quickPerformers.map(p => p.id)}
            />
            <button
              class="cancel-add-btn"
              type="button"
              onclick={() => showAddPerformer = false}
            >
              Cancel
            </button>
          </div>
        {/if}
      </div>

      <!-- Skip button -->
      <div class="action-section skip-section">
        <button
          class="skip-btn"
          onclick={skipCurationVideo}
          disabled={curationSaving}
        >
          <span class="key-hint">X</span>
          Skip
        </button>
      </div>
    </div>

    {#if curationSaving}
      <div class="saving-indicator">
        <div class="spinner small"></div>
        Saving...
      </div>
    {/if}
  </div>
{/if}

<!-- Sequence Linking mode overlay -->
{#if linkingMode && currentLinkingVideo}
  <div class="linking-overlay">
    <div class="linking-header">
      <div class="linking-progress">
        <span class="progress-text">
          {linkingProgress.current} / {linkingProgress.total} to link
          <span class="done-count">({linkingProgress.linked} linked)</span>
        </span>
        <div class="progress-bar">
          <div
            class="progress-fill"
            style="width: {(linkingProgress.linked / stats.withWord) * 100}%"
          ></div>
        </div>
      </div>
      <button class="exit-btn" onclick={exitLinkingMode}>
        <i class="fas fa-times" aria-hidden="true"></i>
        Exit (Esc)
      </button>
    </div>

    <div class="linking-main">
      <!-- Navigation arrow left -->
      <button
        class="nav-arrow left"
        onclick={prevLinkingVideo}
        disabled={linkingIndex === 0}
      >
        <i class="fas fa-chevron-left" aria-hidden="true"></i>
      </button>

      <!-- Video and sequence side by side -->
      <div class="linking-content">
        <!-- Video panel -->
        <div class="linking-video-panel">
          <div class="panel-header">
            <span class="panel-title">Video</span>
            <span class="tka-word">{currentLinkingVideo.title}</span>
          </div>
          <div class="video-wrapper">
            <!-- svelte-ignore a11y_media_has_caption -->
            <video
              src={currentLinkingVideo.videoUrl}
              controls
              autoplay
              loop
              playsinline
            ></video>
          </div>
          <div class="video-meta">
            <span>{formatDate(currentLinkingVideo.instagramDate)}</span>
            {#if currentLinkingVideo.performerName}
              <span class="performer-tag">
                <i class="fas fa-user" aria-hidden="true"></i>
                {currentLinkingVideo.performerName}
              </span>
            {/if}
          </div>
        </div>

        <!-- Sequence matches panel -->
        <div class="linking-sequences-panel">
          <div class="panel-header">
            <span class="panel-title">Matching Sequences</span>
            {#if linkingSearching}
              <div class="spinner small"></div>
            {/if}
          </div>

          {#if linkingSearching}
            <div class="sequences-loading">
              <div class="spinner"></div>
              <span>Searching for "{currentLinkingVideo.title}"...</span>
            </div>
          {:else if matchedSequences.length === 0}
            <div class="sequences-empty">
              <i class="fas fa-search" aria-hidden="true"></i>
              <span>No sequences found matching "{currentLinkingVideo.title}"</span>
              <p>The sequence may not exist yet, or use a different word.</p>
            </div>
          {:else}
            <div class="sequences-list">
              {#each matchedSequences as seq, i}
                <button
                  class="sequence-card"
                  class:selected={selectedSequenceForLink?.id === seq.id}
                  onclick={() => selectedSequenceForLink = seq}
                >
                  <span class="key-hint">{i + 1}</span>
                  <div class="sequence-thumbnail">
                    {#if seq.thumbnail}
                      <img src={seq.thumbnail} alt={seq.word} />
                    {:else}
                      <div class="no-thumbnail">
                        <i class="fas fa-image" aria-hidden="true"></i>
                      </div>
                    {/if}
                  </div>
                  <div class="sequence-info">
                    <span class="sequence-word">{seq.word}</span>
                    <span class="sequence-name">{seq.name}</span>
                    <span class="sequence-owner">
                      <i class="fas fa-user" aria-hidden="true"></i>
                      {seq.ownerName}
                      {#if seq.isPublic}
                        <span class="public-badge">Public</span>
                      {/if}
                    </span>
                  </div>
                  {#if selectedSequenceForLink?.id === seq.id}
                    <div class="selected-check">
                      <i class="fas fa-check" aria-hidden="true"></i>
                    </div>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <!-- Navigation arrow right -->
      <button
        class="nav-arrow right"
        onclick={nextLinkingVideo}
        disabled={linkingIndex >= unlinkableVideos.length - 1}
      >
        <i class="fas fa-chevron-right" aria-hidden="true"></i>
      </button>
    </div>

    <!-- Action buttons -->
    <div class="linking-actions">
      {#if selectedSequenceForLink}
        <div class="link-confirm">
          <span class="confirm-text">
            Link video to <strong>{selectedSequenceForLink.word}</strong> by {selectedSequenceForLink.ownerName}?
          </span>
          <button
            class="confirm-btn"
            onclick={linkVideoToSequence}
            disabled={linkingSaving}
          >
            <span class="key-hint">Enter</span>
            Confirm Link
          </button>
        </div>
      {:else if matchedSequences.length > 0}
        <span class="select-prompt">Select a sequence above (1-{matchedSequences.length})</span>
      {/if}

      <button
        class="skip-btn"
        onclick={skipLinkingVideo}
        disabled={linkingSaving}
      >
        <span class="key-hint">X</span>
        Skip
      </button>
    </div>

    {#if linkingSaving}
      <div class="saving-indicator">
        <div class="spinner small"></div>
        Linking...
      </div>
    {/if}
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

  .stat.with-word .stat-value {
    color: #06b6d4;
  }

  /* Modern Filters */
  .modern-filters {
    display: flex;
    gap: 16px;
    margin-bottom: 16px;
    align-items: center;
  }

  .search-container {
    flex: 1;
    max-width: 400px;
    position: relative;
  }

  .search-icon {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--theme-text-dim);
    font-size: 14px;
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 12px 40px 12px 42px;
    border-radius: 12px;
    border: 1px solid var(--theme-stroke);
    background: var(--theme-card-bg);
    color: var(--theme-text);
    font-size: 14px;
    transition: all 0.2s;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--theme-accent);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }

  .search-input::placeholder {
    color: var(--theme-text-dim);
  }

  .clear-search {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: none;
    background: transparent;
    color: var(--theme-text-dim);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .clear-search:hover {
    background: rgba(255, 255, 255, 0.1);
    color: var(--theme-text);
  }

  .action-buttons-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .icon-btn {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    border: 1px solid var(--theme-stroke);
    background: var(--theme-card-bg);
    color: var(--theme-text);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    transition: all 0.2s;
  }

  .icon-btn:hover:not(:disabled) {
    background: var(--theme-accent);
    border-color: var(--theme-accent);
    color: white;
  }

  .icon-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-radius: 24px;
    border: none;
    color: white;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    transition: all 0.2s;
  }

  .action-pill.curate {
    background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
  }

  .action-pill.curate:hover {
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
    transform: translateY(-1px);
  }

  .action-pill.link {
    background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%);
  }

  .action-pill.link:hover {
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
    transform: translateY(-1px);
  }

  .action-pill .count {
    padding: 2px 8px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.2);
    font-size: 12px;
  }

  /* Filter Chips */
  .filter-chips-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 24px;
  }

  .chip-group {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .chip-group.toggles {
    padding-top: 8px;
    border-top: 1px solid var(--theme-stroke);
  }

  .chip-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    min-width: 70px;
  }

  .chips {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 20px;
    border: 1px solid var(--theme-stroke);
    background: transparent;
    color: var(--theme-text-dim);
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .chip:hover {
    border-color: var(--chip-color, var(--theme-accent));
    color: var(--theme-text);
    background: rgba(255, 255, 255, 0.03);
  }

  .chip.active {
    background: var(--chip-color, var(--theme-accent));
    border-color: var(--chip-color, var(--theme-accent));
    color: white;
  }

  .chip i {
    font-size: 12px;
  }

  .chip.add-chip {
    border-style: dashed;
    padding: 8px 12px;
  }

  .chip.add-chip:hover {
    border-style: solid;
  }

  .chip.toggle-chip {
    --chip-color: #6366f1;
  }

  .chip.featured-chip {
    --chip-color: #f59e0b;
  }

  .performer-chip {
    --chip-color: #8b5cf6;
  }

  .active-filters {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 10px 16px;
    background: rgba(99, 102, 241, 0.1);
    border-radius: 10px;
    border: 1px solid rgba(99, 102, 241, 0.2);
  }

  .filter-count {
    font-size: 14px;
    font-weight: 600;
    color: var(--theme-accent);
  }

  .clear-all {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: var(--theme-text-dim);
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
  }

  .clear-all:hover {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }

  /* Add category popup */
  .add-category-popup {
    display: flex;
    gap: 8px;
    padding: 12px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    margin-bottom: 16px;
    align-items: center;
  }

  .add-category-popup input[type="text"] {
    flex: 1;
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid var(--theme-stroke);
    background: var(--theme-panel-bg);
    color: var(--theme-text);
  }

  .add-category-popup input[type="color"] {
    width: 40px;
    height: 32px;
    padding: 0;
    border: 1px solid var(--theme-stroke);
    border-radius: 6px;
    cursor: pointer;
  }

  .add-category-popup .save-btn,
  .add-category-popup .cancel-btn {
    padding: 8px 16px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
  }

  .add-category-popup .save-btn {
    background: var(--theme-accent);
    color: white;
  }

  .add-category-popup .save-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .add-category-popup .cancel-btn {
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    color: var(--theme-text);
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

  /* Performer selector */
  .performer-selector {
    margin-bottom: 16px;
  }

  .performer-selector .label {
    display: block;
    font-size: 12px;
    color: var(--theme-text-dim);
    margin-bottom: 8px;
  }

  .current-performer {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 6px;
  }

  .current-performer span {
    flex: 1;
    font-size: 14px;
  }

  .current-performer .remove-btn {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: none;
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .current-performer .remove-btn:hover {
    background: #ef4444;
    color: white;
  }

  .assign-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px dashed var(--theme-stroke);
    background: transparent;
    color: var(--theme-text-dim);
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
  }

  .assign-btn:hover {
    border-color: var(--theme-accent);
    color: var(--theme-accent);
  }

  .user-search-popup {
    margin-top: 8px;
    padding: 12px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
  }

  .user-search-popup input {
    width: 100%;
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid var(--theme-stroke);
    background: var(--theme-panel-bg);
    color: var(--theme-text);
    margin-bottom: 8px;
  }

  .user-results {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 150px;
    overflow-y: auto;
  }

  .user-result {
    padding: 8px 12px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: var(--theme-text);
    cursor: pointer;
    text-align: left;
    font-size: 14px;
    transition: background 0.15s;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .user-result:hover {
    background: var(--theme-accent);
  }

  .user-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
  }

  .user-avatar-placeholder {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--theme-text-dim);
    font-size: 12px;
  }

  .user-name {
    flex: 1;
  }

  .search-loading,
  .no-results {
    padding: 8px;
    text-align: center;
    color: var(--theme-text-dim);
    font-size: 13px;
  }

  .cancel-search {
    width: 100%;
    margin-top: 8px;
    padding: 8px;
    border-radius: 6px;
    border: 1px solid var(--theme-stroke);
    background: transparent;
    color: var(--theme-text-dim);
    cursor: pointer;
  }

  .cancel-search:hover {
    background: var(--theme-card-bg);
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

  /* Curation mode overlay */
  .curation-overlay {
    position: fixed;
    inset: 0;
    z-index: 2000;
    background: #0a0a12; /* Solid, no transparency */
    display: flex;
    flex-direction: column;
    padding: 16px;
  }

  .curation-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--theme-stroke);
  }

  .curation-progress {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .progress-text {
    font-size: 16px;
    font-weight: 600;
  }

  .done-count {
    color: var(--theme-text-dim);
    font-weight: 400;
    font-size: 14px;
  }

  .progress-bar {
    width: 200px;
    height: 6px;
    background: var(--theme-card-bg);
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #10b981, #06b6d4);
    transition: width 0.3s ease;
  }

  .exit-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-radius: 8px;
    border: 1px solid var(--theme-stroke);
    background: transparent;
    color: var(--theme-text);
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;
  }

  .exit-btn:hover {
    background: rgba(239, 68, 68, 0.1);
    border-color: #ef4444;
    color: #ef4444;
  }

  .curation-main {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 24px;
    padding: 24px 0;
    min-height: 0;
  }

  .nav-arrow {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 1px solid var(--theme-stroke);
    background: var(--theme-card-bg);
    color: var(--theme-text);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .nav-arrow:hover:not(:disabled) {
    background: var(--theme-accent);
    border-color: var(--theme-accent);
  }

  .nav-arrow:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .curation-video-container {
    flex: 1;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .video-wrapper {
    width: 100%;
    aspect-ratio: 9 / 16;
    max-height: calc(100vh - 380px);
    background: #000;
    border-radius: 12px;
    overflow: hidden;
  }

  .video-wrapper video {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .video-title-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 8px 0;
  }

  .video-title-bar .title {
    font-weight: 600;
    font-size: 16px;
  }

  .video-title-bar .date {
    color: var(--theme-text-dim);
    font-size: 13px;
  }

  .current-state {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .state-badge {
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .state-badge.category {
    color: white;
  }

  .state-badge.performer {
    background: rgba(99, 102, 241, 0.2);
    color: #a5b4fc;
  }

  .state-badge.empty {
    background: rgba(255, 255, 255, 0.05);
    color: var(--theme-text-dim);
    border: 1px dashed var(--theme-stroke);
  }

  .curation-actions {
    display: flex;
    justify-content: center;
    gap: 32px;
    padding-top: 16px;
    border-top: 1px solid var(--theme-stroke);
    flex-wrap: wrap;
  }

  .action-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
  }

  .section-label {
    font-size: 12px;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .action-buttons {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .action-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px 16px;
    border-radius: 8px;
    border: 1px solid var(--theme-stroke);
    background: var(--theme-card-bg);
    color: var(--theme-text);
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    min-width: 80px;
    transition: all 0.2s;
  }

  .action-btn:hover:not(:disabled) {
    border-color: var(--cat-color, var(--theme-accent));
    background: rgba(255, 255, 255, 0.05);
  }

  .action-btn.active {
    background: var(--cat-color, var(--theme-accent));
    border-color: var(--cat-color, var(--theme-accent));
    color: white;
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-btn .key-hint {
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.1);
    font-family: monospace;
  }

  .action-btn.active .key-hint {
    background: rgba(0, 0, 0, 0.2);
  }

  .performer-action {
    --cat-color: #6366f1;
  }

  .skip-section {
    align-self: center;
  }

  .skip-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border-radius: 8px;
    border: 1px solid var(--theme-stroke);
    background: transparent;
    color: var(--theme-text-dim);
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
  }

  .skip-btn:hover:not(:disabled) {
    border-color: rgba(239, 68, 68, 0.5);
    color: #ef4444;
  }

  .skip-btn .key-hint {
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.1);
    font-family: monospace;
  }

  .saving-indicator {
    position: absolute;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: var(--theme-card-bg);
    border-radius: 8px;
    font-size: 13px;
    color: var(--theme-text-dim);
  }

  .spinner.small {
    width: 16px;
    height: 16px;
    border-width: 2px;
  }

  /* Add/Remove buttons for curation */
  .action-btn.add-btn {
    min-width: 48px;
    padding: 12px;
    background: transparent;
    border-style: dashed;
  }

  .action-btn.add-btn:hover {
    border-style: solid;
    border-color: var(--theme-accent);
    color: var(--theme-accent);
  }

  .performer-action {
    position: relative;
  }

  .remove-performer-btn {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: none;
    background: rgba(239, 68, 68, 0.8);
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .performer-action:hover .remove-performer-btn {
    opacity: 1;
  }

  .remove-performer-btn:hover {
    background: #ef4444;
  }

  /* Inline add forms for curation */
  .add-performer-inline,
  .add-category-inline {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
    padding: 12px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
    max-width: 300px;
  }

  .add-category-inline {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }

  .add-category-inline input[type="text"] {
    flex: 1;
    min-width: 120px;
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid var(--theme-stroke);
    background: var(--theme-panel-bg);
    color: var(--theme-text);
    font-size: 13px;
  }

  .add-category-inline input[type="color"] {
    width: 36px;
    height: 36px;
    border-radius: 6px;
    border: 1px solid var(--theme-stroke);
    cursor: pointer;
    padding: 2px;
  }

  .add-category-inline .save-btn,
  .add-category-inline .cancel-btn {
    padding: 8px 12px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
  }

  .add-category-inline .save-btn {
    background: var(--theme-accent);
    color: white;
  }

  .add-category-inline .save-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .add-category-inline .cancel-btn {
    background: transparent;
    color: var(--theme-text-dim);
    border: 1px solid var(--theme-stroke);
  }

  .add-performer-inline .cancel-add-btn {
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid var(--theme-stroke);
    background: transparent;
    color: var(--theme-text-dim);
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
  }

  .add-performer-inline .cancel-add-btn:hover {
    border-color: var(--theme-text-dim);
    color: var(--theme-text);
  }

  @media (max-width: 600px) {
    .curation-actions {
      gap: 16px;
    }

    .action-btn {
      min-width: 60px;
      padding: 10px 12px;
      font-size: 12px;
    }

    .nav-arrow {
      width: 40px;
      height: 40px;
    }
  }

  /* Linking mode overlay */
  .linking-overlay {
    position: fixed;
    inset: 0;
    z-index: 2000;
    background: var(--theme-panel-bg, #0a0a12);
    display: flex;
    flex-direction: column;
    padding: 16px;
  }

  .linking-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--theme-stroke);
  }

  .linking-progress {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .linking-main {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 24px;
    padding: 24px 0;
    min-height: 0;
    overflow: hidden;
  }

  .linking-content {
    flex: 1;
    max-width: 1000px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    height: 100%;
    max-height: calc(100vh - 250px);
  }

  .linking-video-panel,
  .linking-sequences-panel {
    display: flex;
    flex-direction: column;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--theme-stroke);
    background: rgba(255, 255, 255, 0.02);
  }

  .panel-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .tka-word {
    font-size: 18px;
    font-weight: 700;
    color: #06b6d4;
    font-family: monospace;
  }

  .linking-video-panel .video-wrapper {
    flex: 1;
    max-height: none;
    border-radius: 0;
  }

  .video-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-top: 1px solid var(--theme-stroke);
    font-size: 13px;
    color: var(--theme-text-dim);
  }

  .performer-tag {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    background: rgba(99, 102, 241, 0.2);
    border-radius: 4px;
    color: #a5b4fc;
  }

  .performer-tag i {
    font-size: 11px;
  }

  .linking-sequences-panel {
    overflow: hidden;
  }

  .sequences-loading,
  .sequences-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 24px;
    color: var(--theme-text-dim);
    text-align: center;
  }

  .sequences-empty i {
    font-size: 32px;
    opacity: 0.5;
  }

  .sequences-empty p {
    font-size: 13px;
    opacity: 0.7;
    margin: 0;
  }

  .sequences-list {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .sequence-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-radius: 8px;
    border: 2px solid var(--theme-stroke);
    background: var(--theme-panel-bg);
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
  }

  .sequence-card:hover {
    border-color: #10b981;
    background: rgba(16, 185, 129, 0.05);
  }

  .sequence-card.selected {
    border-color: #10b981;
    background: rgba(16, 185, 129, 0.1);
  }

  .sequence-card .key-hint {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.1);
    font-family: monospace;
    font-size: 12px;
    color: var(--theme-text-dim);
    flex-shrink: 0;
  }

  .sequence-card.selected .key-hint {
    background: #10b981;
    color: white;
  }

  .sequence-thumbnail {
    width: 60px;
    height: 60px;
    border-radius: 6px;
    overflow: hidden;
    background: var(--theme-card-bg);
    flex-shrink: 0;
  }

  .sequence-thumbnail img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .no-thumbnail {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--theme-text-dim);
    font-size: 20px;
  }

  .sequence-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .sequence-word {
    font-size: 16px;
    font-weight: 700;
    font-family: monospace;
    color: var(--theme-text);
  }

  .sequence-name {
    font-size: 13px;
    color: var(--theme-text-dim);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sequence-owner {
    font-size: 12px;
    color: var(--theme-text-dim);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .sequence-owner i {
    font-size: 10px;
  }

  .public-badge {
    padding: 2px 6px;
    border-radius: 3px;
    background: rgba(16, 185, 129, 0.2);
    color: #10b981;
    font-size: 10px;
    font-weight: 600;
  }

  .selected-check {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #10b981;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .linking-actions {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 24px;
    padding-top: 16px;
    border-top: 1px solid var(--theme-stroke);
  }

  .link-confirm {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .confirm-text {
    font-size: 14px;
    color: var(--theme-text-dim);
  }

  .confirm-text strong {
    color: #10b981;
    font-family: monospace;
  }

  .confirm-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border-radius: 8px;
    border: none;
    background: #10b981;
    color: white;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    transition: all 0.2s;
  }

  .confirm-btn:hover:not(:disabled) {
    background: #059669;
  }

  .confirm-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .confirm-btn .key-hint {
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.2);
    font-family: monospace;
    font-size: 11px;
  }

  .select-prompt {
    font-size: 14px;
    color: var(--theme-text-dim);
  }

  @media (max-width: 800px) {
    .linking-content {
      grid-template-columns: 1fr;
      max-height: calc(100vh - 200px);
    }

    .linking-video-panel {
      max-height: 40vh;
    }

    .linking-video-panel .video-wrapper {
      flex: 1;
      min-height: 0;
    }
  }
</style>
