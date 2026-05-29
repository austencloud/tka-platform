/**
 * VideoEditorController
 *
 * State machine for the unified video editor overlay.
 * Manages mode transitions, video navigation, and all editing operations.
 */
import type {
  ShowcaseVideo,
  VideoCategory,
  UserProfile,
  MatchedSequence,
  VideoPerformer,
  LinkedSequence,
  VideoCropData,
  VideoSnipData,
  CurationProgress,
  LinkingProgress,
  VideoStats,
} from "../types";
import type * as videoCuratorPersisterModule from "../services/video-curator-persister";
type VideoCuratorPersister = typeof videoCuratorPersisterModule;
import type { SequenceMatcher } from "../services/sequence-matcher";
import type { VideoCache } from "$lib/shared/video/services/implementations/VideoCache";

export type VideoEditorMode = "closed" | "browse" | "curate" | "link" | "rename";

export interface VideoEditorState {
  mode: VideoEditorMode;
  currentVideo: ShowcaseVideo | null;
  videoUrl: string | null;
  currentIndex: number;
  saving: boolean;

  // Category form state
  showAddCategory: boolean;
  newCategoryLabel: string;
  newCategoryColor: string;

  // Performer form state
  showAddPerformer: boolean;

  // Sequence search state
  sequenceSearchQuery: string;
  matchedSequences: MatchedSequence[];
  sequenceSearching: boolean;
  selectedSequenceForLink: MatchedSequence | null;
}

export interface VideoEditorControllerOptions {
  videos: ShowcaseVideo[];
  categories: VideoCategory[];
  quickPerformers: UserProfile[];
  persister: VideoCuratorPersister;
  sequenceMatcher: SequenceMatcher;
  videoCache: VideoCache;
  onVideosUpdate: (videos: ShowcaseVideo[]) => void;
}

const PERFORMER_KEYS = "asdfgh";

/**
 * Creates a reactive video editor controller
 */
export function createVideoEditorController(options: VideoEditorControllerOptions) {
  const { persister, sequenceMatcher, videoCache, onVideosUpdate } = options;

  // Reactive state
  let videos = $state(options.videos);
  let categories = $state(options.categories);
  let quickPerformers = $state(options.quickPerformers);

  let mode = $state<VideoEditorMode>("closed");
  let currentVideoShortcode = $state<string | null>(null);
  let videoUrl = $state<string | null>(null);
  let currentIndex = $state(0);
  let saving = $state(false);

  // Form state
  let showAddCategory = $state(false);
  let newCategoryLabel = $state("");
  let newCategoryColor = $state("#6366f1");
  let showAddPerformer = $state(false);

  // Sequence search state
  let sequenceSearchQuery = $state("");
  let matchedSequences = $state<MatchedSequence[]>([]);
  let sequenceSearching = $state(false);
  let selectedSequenceForLink = $state<MatchedSequence | null>(null);

  // Video loading race condition prevention
  let expectedVideoUrl = $state<string | null>(null);

  // Derived: uncurated videos (for curate mode)
  const uncuratedVideos = $derived.by(() =>
    videos.filter((v) => !v.excluded && (!v.category || v.performers.length === 0))
  );

  // Derived: unlinkable videos (for link mode)
  const unlinkableVideos = $derived.by(() =>
    videos.filter((v) => v.title && v.title.length > 0 && v.linkedSequences.length === 0)
  );

  // Derived: unnamed videos (for rename mode)
  // These are videos that still have their Instagram shortcode as the title
  // (no title set, or title looks like a shortcode - alphanumeric, no spaces)
  const unnamedVideos = $derived.by(() =>
    videos.filter((v) => {
      if (v.excluded) return false;
      // No title at all
      if (!v.title) return true;
      // Title is exactly the shortcode
      if (v.title === v.shortcode) return true;
      // Title looks like a shortcode (alphanumeric with underscores, no spaces, 8+ chars)
      const looksLikeShortcode = /^[A-Za-z0-9_-]{8,}$/.test(v.title);
      return looksLikeShortcode;
    })
  );

  // Derived: current video based on mode
  const currentVideo = $derived.by((): ShowcaseVideo | null => {
    if (mode === "closed") return null;

    // If we have a locked shortcode, find that video
    if (currentVideoShortcode) {
      return videos.find((v) => v.shortcode === currentVideoShortcode) || null;
    }

    // For curate/link/rename modes, fall back to index in filtered list
    if (mode === "curate") {
      if (uncuratedVideos.length === 0) return null;
      return uncuratedVideos[Math.min(currentIndex, uncuratedVideos.length - 1)] || null;
    }

    if (mode === "link") {
      if (unlinkableVideos.length === 0) return null;
      return unlinkableVideos[Math.min(currentIndex, unlinkableVideos.length - 1)] || null;
    }

    if (mode === "rename") {
      if (unnamedVideos.length === 0) return null;
      return unnamedVideos[Math.min(currentIndex, unnamedVideos.length - 1)] || null;
    }

    return null;
  });

  // Derived: curation progress
  const curationProgress = $derived<CurationProgress>({
    current: currentIndex + 1,
    total: uncuratedVideos.length,
    done: videos.length - uncuratedVideos.length,
  });

  // Derived: linking progress
  const linkingProgress = $derived<LinkingProgress>({
    current: currentIndex + 1,
    total: unlinkableVideos.length,
    linked: videos.filter((v) => v.linkedSequences.length > 0).length,
  });

  // Derived: renaming progress
  const renamingProgress = $derived({
    current: currentIndex + 1,
    total: unnamedVideos.length,
    named: videos.filter((v) => v.title && !/^[A-Za-z0-9_-]{8,}$/.test(v.title)).length,
  });

  // Derived: stats
  const stats = $derived<VideoStats>({
    total: videos.length,
    featured: videos.filter((v) => v.featured).length,
    categorized: videos.filter((v) => v.category).length,
    uncategorized: videos.filter((v) => !v.category).length,
    withWord: videos.filter((v) => v.title && v.title.length > 0).length,
  });

  // Derived: max links for current video's category
  const maxLinks = $derived.by(() => {
    // Demonstrations can only link to 1 sequence
    if (currentVideo?.category === "demonstration") return 1;
    // All other categories (or no category) can link to multiple
    return Infinity;
  });

  const canAddMoreLinks = $derived(
    maxLinks > 0 && (currentVideo?.linkedSequences.length ?? 0) < maxLinks
  );

  const showLinkingSection = $derived(maxLinks > 0);

  // Load video URL when current video changes
  $effect(() => {
    if (currentVideo) {
      const targetUrl = currentVideo.videoUrl;
      expectedVideoUrl = targetUrl;
      videoUrl = null;

      videoCache
        .getVideoUrl(targetUrl, { cacheIfMissing: true, priority: 100 })
        .then((url) => {
          if (expectedVideoUrl === targetUrl) {
            videoUrl = url;
          }
        });
    } else {
      expectedVideoUrl = null;
      videoUrl = null;
    }
  });

  // Utility to update local video state
  function updateLocalVideo(shortcode: string, updates: Partial<ShowcaseVideo>) {
    const index = videos.findIndex((v) => v.shortcode === shortcode);
    if (index !== -1) {
      const existingVideo = videos[index];
      if (existingVideo) {
        videos[index] = { ...existingVideo, ...updates };
        videos = [...videos];
        onVideosUpdate(videos);
      }
    }
  }

  // === MODE TRANSITIONS ===

  function openBrowse(video: ShowcaseVideo) {
    mode = "browse";
    currentVideoShortcode = video.shortcode;
    currentIndex = 0;
    resetFormState();
  }

  function openCurate() {
    mode = "curate";
    currentIndex = 0;
    currentVideoShortcode = uncuratedVideos[0]?.shortcode || null;
    resetFormState();
    // Auto-search for sequence if video has a title
    if (uncuratedVideos[0]?.title) {
      searchSequencesForCurrentVideo();
    }
  }

  function openLink() {
    mode = "link";
    currentIndex = 0;
    currentVideoShortcode = null;
    resetFormState();
    // Auto-search for current video
    if (unlinkableVideos.length > 0) {
      searchSequencesForCurrentVideo();
    }
  }

  function openRename() {
    mode = "rename";
    currentIndex = 0;
    currentVideoShortcode = unnamedVideos[0]?.shortcode || null;
    resetFormState();
  }

  function close() {
    mode = "closed";
    currentVideoShortcode = null;
    videoUrl = null;
    currentIndex = 0;
    resetFormState();
  }

  function resetFormState() {
    showAddCategory = false;
    newCategoryLabel = "";
    newCategoryColor = "#6366f1";
    showAddPerformer = false;
    sequenceSearchQuery = "";
    matchedSequences = [];
    sequenceSearching = false;
    selectedSequenceForLink = null;
  }

  // === NAVIGATION ===

  function getVideoList(): ShowcaseVideo[] {
    if (mode === "curate") return uncuratedVideos;
    if (mode === "link") return unlinkableVideos;
    if (mode === "rename") return unnamedVideos;
    return [];
  }

  function goNext() {
    const list = getVideoList();
    if (currentIndex < list.length - 1) {
      currentIndex++;
      currentVideoShortcode = list[currentIndex]?.shortcode || null;
      if (mode === "link" || mode === "curate") {
        resetLinkingState();
        searchSequencesForCurrentVideo();
      }
    }
  }

  function goPrev() {
    const list = getVideoList();
    if (currentIndex > 0) {
      currentIndex--;
      currentVideoShortcode = list[currentIndex]?.shortcode || null;
      if (mode === "link" || mode === "curate") {
        resetLinkingState();
        searchSequencesForCurrentVideo();
      }
    }
  }

  /** Go to next video (for rename mode - continues even after renaming current) */
  function goNextInRenameMode() {
    // In rename mode, after renaming a video it's no longer "unnamed",
    // so we just need to navigate to the first unnamed video at current index
    // (which will be the next one since current was removed from list)
    const list = unnamedVideos;
    if (list.length === 0) {
      close();
      return;
    }
    // Stay at same index (list shifted) or go to last item if index exceeds
    const newIndex = Math.min(currentIndex, list.length - 1);
    currentIndex = newIndex;
    currentVideoShortcode = list[newIndex]?.shortcode || null;
  }

  function skip() {
    goNext();
  }

  function resetLinkingState() {
    matchedSequences = [];
    selectedSequenceForLink = null;
    sequenceSearchQuery = "";
  }

  // === CATEGORY OPERATIONS ===

  async function setCategory(categoryId: string) {
    if (!currentVideo || saving) return;
    saving = true;
    try {
      await persister.updateVideo(currentVideo.shortcode, { category: categoryId });
      updateLocalVideo(currentVideo.shortcode, { category: categoryId });
      // Auto-search for sequence when category is set (enables linking section)
      if (currentVideo.title && matchedSequences.length === 0) {
        searchSequencesForCurrentVideo();
      }
    } catch (e) {
      console.error("Failed to set category:", e);
    } finally {
      saving = false;
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

  function toggleAddCategoryForm(show: boolean) {
    showAddCategory = show;
  }

  function updateCategoryLabel(label: string) {
    newCategoryLabel = label;
  }

  function updateCategoryColor(color: string) {
    newCategoryColor = color;
  }

  // === PERFORMER OPERATIONS ===

  async function togglePerformer(user: UserProfile) {
    if (!currentVideo || saving) return;
    saving = true;
    try {
      const existingIndex = currentVideo.performers.findIndex((p) => p.id === user.id);
      let newPerformers: VideoPerformer[];
      if (existingIndex >= 0) {
        newPerformers = currentVideo.performers.filter((p) => p.id !== user.id);
      } else {
        newPerformers = [...currentVideo.performers, { id: user.id, displayName: user.displayName }];
      }
      await persister.updateVideo(currentVideo.shortcode, { performers: newPerformers });
      updateLocalVideo(currentVideo.shortcode, { performers: newPerformers });
    } catch (e) {
      console.error("Failed to toggle performer:", e);
    } finally {
      saving = false;
    }
  }

  async function addQuickPerformer(performer: VideoPerformer) {
    if (quickPerformers.some((p) => p.id === performer.id)) {
      showAddPerformer = false;
      return;
    }
    const newPerformer: UserProfile = {
      id: performer.id,
      displayName: performer.displayName,
    };
    quickPerformers = [...quickPerformers, newPerformer];
    try {
      await persister.saveQuickPerformers(quickPerformers);
    } catch (e) {
      console.error("Failed to save quick performers:", e);
    }
    showAddPerformer = false;
  }

  async function removeQuickPerformer(id: string) {
    quickPerformers = quickPerformers.filter((p) => p.id !== id);
    try {
      await persister.saveQuickPerformers(quickPerformers);
    } catch (e) {
      console.error("Failed to remove quick performer:", e);
    }
  }

  function toggleAddPerformerForm(show: boolean) {
    showAddPerformer = show;
  }

  function isPerformerSelected(id: string): boolean {
    return currentVideo?.performers.some((p) => p.id === id) ?? false;
  }

  // === SEQUENCE LINKING ===

  async function searchSequences(query: string) {
    sequenceSearchQuery = query;
    if (!query || query.length < 2) {
      matchedSequences = [];
      return;
    }
    sequenceSearching = true;
    try {
      const results = await sequenceMatcher.searchByWord(query);
      matchedSequences = results;
    } catch (e) {
      console.error("Failed to search sequences:", e);
      matchedSequences = [];
    } finally {
      sequenceSearching = false;
    }
  }

  async function searchSequencesForCurrentVideo() {
    const video = currentVideo;
    if (!video?.title) return;
    sequenceSearching = true;
    matchedSequences = [];
    try {
      const results = await sequenceMatcher.searchByWord(video.title);
      matchedSequences = results;
      if (results.length === 1) {
        selectedSequenceForLink = results[0] ?? null;
      }
    } catch (e) {
      console.error("Failed to search sequences:", e);
    } finally {
      sequenceSearching = false;
    }
  }

  /**
   * Search sequences by query and return results directly (for title suggestions).
   * Does not modify controller state - caller manages their own UI state.
   */
  async function searchSequencesForTitle(query: string): Promise<MatchedSequence[]> {
    if (!query || query.length < 2) {
      return [];
    }
    try {
      return await sequenceMatcher.searchByWord(query);
    } catch (e) {
      console.error("Failed to search sequences for title:", e);
      return [];
    }
  }

  async function linkSequence(seq: MatchedSequence) {
    if (!currentVideo || saving) return;
    if (maxLinks === 0) return;

    saving = true;
    try {
      const newLinked: LinkedSequence = {
        id: seq.id,
        word: seq.word,
        thumbnail: seq.thumbnail,
        ownerName: seq.ownerName,
      };

      let updatedLinks: LinkedSequence[];
      if (maxLinks === 1) {
        updatedLinks = [newLinked];
      } else {
        if (currentVideo.linkedSequences.some((l) => l.id === seq.id)) {
          saving = false;
          return;
        }
        updatedLinks = [...currentVideo.linkedSequences, newLinked];
      }

      await persister.updateVideo(currentVideo.shortcode, { linkedSequences: updatedLinks });
      updateLocalVideo(currentVideo.shortcode, { linkedSequences: updatedLinks });

      // Clear search
      sequenceSearchQuery = "";
      matchedSequences = [];
    } catch (e) {
      console.error("Failed to link sequence:", e);
    } finally {
      saving = false;
    }
  }

  async function unlinkSequence(sequenceId: string) {
    if (!currentVideo || saving) return;
    saving = true;
    try {
      const updatedLinks = currentVideo.linkedSequences.filter((l) => l.id !== sequenceId);
      await persister.updateVideo(currentVideo.shortcode, { linkedSequences: updatedLinks });
      updateLocalVideo(currentVideo.shortcode, { linkedSequences: updatedLinks });
    } catch (e) {
      console.error("Failed to unlink sequence:", e);
    } finally {
      saving = false;
    }
  }

  function selectSequenceForLink(seq: MatchedSequence) {
    selectedSequenceForLink = seq;
  }

  async function confirmLink() {
    if (selectedSequenceForLink) {
      await linkSequence(selectedSequenceForLink);
      selectedSequenceForLink = null;
      // Auto-advance in link mode after successful link
      if (mode === "link") {
        setTimeout(() => {
          if (unlinkableVideos.length > 0) {
            searchSequencesForCurrentVideo();
          }
        }, 300);
      }
    }
  }

  // === CURATION ACTIONS ===

  async function updateTitle(newTitle: string) {
    if (!currentVideo || saving) return;
    const trimmedTitle = newTitle.trim() || undefined;
    // Optimistic update for responsiveness
    updateLocalVideo(currentVideo.shortcode, { title: trimmedTitle });
    try {
      await persister.updateVideo(currentVideo.shortcode, { title: trimmedTitle });
      // Re-search sequences with the new title
      if (trimmedTitle) {
        searchSequencesForCurrentVideo();
      }
    } catch (e) {
      console.error("Failed to update title:", e);
    }
  }

  async function excludeVideo() {
    if (!currentVideo || saving) return;
    saving = true;
    try {
      await persister.updateVideo(currentVideo.shortcode, { excluded: true });
      updateLocalVideo(currentVideo.shortcode, { excluded: true });
      goNext();
    } catch (e) {
      console.error("Failed to exclude video:", e);
    } finally {
      saving = false;
    }
  }

  // === CROP & SNIP ===

  let cropModeActive = $state(false);
  let snipModeActive = $state(false);

  function openCropMode() {
    cropModeActive = true;
  }

  function closeCropMode() {
    cropModeActive = false;
  }

  async function applyCrop(cropData: VideoCropData) {
    if (!currentVideo) return;
    saving = true;
    try {
      await persister.updateVideo(currentVideo.shortcode, { crop: cropData });
      updateLocalVideo(currentVideo.shortcode, { crop: cropData });
      closeCropMode();
    } catch (e) {
      console.error("Failed to save crop:", e);
    } finally {
      saving = false;
    }
  }

  async function clearCrop() {
    if (!currentVideo) return;
    saving = true;
    try {
      await persister.updateVideo(currentVideo.shortcode, { crop: undefined });
      updateLocalVideo(currentVideo.shortcode, { crop: undefined });
    } catch (e) {
      console.error("Failed to clear crop:", e);
    } finally {
      saving = false;
    }
  }

  function openSnipMode() {
    snipModeActive = true;
  }

  function closeSnipMode() {
    snipModeActive = false;
  }

  async function applySnip(snipData: VideoSnipData) {
    if (!currentVideo) return;
    saving = true;
    try {
      await persister.updateVideo(currentVideo.shortcode, { snip: snipData });
      updateLocalVideo(currentVideo.shortcode, { snip: snipData });
      closeSnipMode();
    } catch (e) {
      console.error("Failed to save snip:", e);
    } finally {
      saving = false;
    }
  }

  async function clearSnip() {
    if (!currentVideo) return;
    saving = true;
    try {
      await persister.updateVideo(currentVideo.shortcode, { snip: undefined });
      updateLocalVideo(currentVideo.shortcode, { snip: undefined });
    } catch (e) {
      console.error("Failed to clear snip:", e);
    } finally {
      saving = false;
    }
  }

  // === KEYBOARD SHORTCUTS ===

  function handleKeydown(e: KeyboardEvent) {
    if (mode === "closed" || saving) return;

    // Don't intercept when typing in input
    const active = document.activeElement;
    if (active) {
      const tagName = active.tagName.toLowerCase();
      if (tagName === "input" || tagName === "textarea" || (active as HTMLElement).isContentEditable) {
        return;
      }
    }

    // Number keys for categories
    const num = parseInt(e.key);
    if (num >= 1 && num <= categories.length && mode !== "link") {
      e.preventDefault();
      const category = categories[num - 1];
      if (category) {
        setCategory(category.id);
      }
      return;
    }

    // In link mode, number keys select sequence
    if (mode === "link" && num >= 1 && num <= matchedSequences.length) {
      e.preventDefault();
      selectedSequenceForLink = matchedSequences[num - 1] ?? null;
      return;
    }

    // Letter keys for performers (in browse/curate modes)
    if (mode !== "link") {
      const letterIndex = PERFORMER_KEYS.indexOf(e.key.toLowerCase());
      if (letterIndex >= 0 && letterIndex < quickPerformers.length) {
        e.preventDefault();
        const performer = quickPerformers[letterIndex];
        if (performer) {
          togglePerformer(performer);
        }
        return;
      }
    }

    // Navigation
    if (e.key === "ArrowLeft" || e.key === "h") {
      if (mode !== "browse") {
        e.preventDefault();
        goPrev();
      }
    } else if (e.key === "ArrowRight" || e.key === "l") {
      if (mode !== "browse") {
        e.preventDefault();
        goNext();
      }
    } else if (e.key === "x") {
      e.preventDefault();
      skip();
    } else if (e.key === "e" && mode === "curate") {
      e.preventDefault();
      excludeVideo();
    } else if (e.key === "Enter" && mode === "link" && selectedSequenceForLink) {
      e.preventDefault();
      confirmLink();
    } else if (e.key === "Escape") {
      close();
    }
  }

  // Sync external state updates
  function syncVideos(newVideos: ShowcaseVideo[]) {
    videos = newVideos;
  }

  function syncCategories(newCategories: VideoCategory[]) {
    categories = newCategories;
  }

  function syncQuickPerformers(newPerformers: UserProfile[]) {
    quickPerformers = newPerformers;
  }

  return {
    // State (readonly getters)
    get mode() { return mode; },
    get currentVideo() { return currentVideo; },
    get videoUrl() { return videoUrl; },
    get currentIndex() { return currentIndex; },
    get saving() { return saving; },
    get showAddCategory() { return showAddCategory; },
    get newCategoryLabel() { return newCategoryLabel; },
    get newCategoryColor() { return newCategoryColor; },
    get showAddPerformer() { return showAddPerformer; },
    get sequenceSearchQuery() { return sequenceSearchQuery; },
    get matchedSequences() { return matchedSequences; },
    get sequenceSearching() { return sequenceSearching; },
    get selectedSequenceForLink() { return selectedSequenceForLink; },
    get cropModeActive() { return cropModeActive; },
    get snipModeActive() { return snipModeActive; },

    // Derived state
    get categories() { return categories; },
    get quickPerformers() { return quickPerformers; },
    get uncuratedVideos() { return uncuratedVideos; },
    get unlinkableVideos() { return unlinkableVideos; },
    get unnamedVideos() { return unnamedVideos; },
    get curationProgress() { return curationProgress; },
    get linkingProgress() { return linkingProgress; },
    get renamingProgress() { return renamingProgress; },
    get stats() { return stats; },
    get maxLinks() { return maxLinks; },
    get canAddMoreLinks() { return canAddMoreLinks; },
    get showLinkingSection() { return showLinkingSection; },

    // Constants
    performerKeys: PERFORMER_KEYS,

    // Mode transitions
    openBrowse,
    openCurate,
    openLink,
    openRename,
    close,

    // Navigation
    goNext,
    goPrev,
    goNextInRenameMode,
    skip,

    // Category operations
    setCategory,
    addCategory,
    toggleAddCategoryForm,
    updateCategoryLabel,
    updateCategoryColor,

    // Performer operations
    togglePerformer,
    addQuickPerformer,
    removeQuickPerformer,
    toggleAddPerformerForm,
    isPerformerSelected,

    // Sequence linking
    searchSequences,
    searchSequencesForTitle,
    linkSequence,
    unlinkSequence,
    selectSequenceForLink,
    confirmLink,

    // Curation actions
    updateTitle,
    excludeVideo,

    // Crop & Snip
    openCropMode,
    closeCropMode,
    applyCrop,
    clearCrop,
    openSnipMode,
    closeSnipMode,
    applySnip,
    clearSnip,

    // Keyboard
    handleKeydown,

    // Sync
    syncVideos,
    syncCategories,
    syncQuickPerformers,
  };
}

export type VideoEditorController = ReturnType<typeof createVideoEditorController>;
