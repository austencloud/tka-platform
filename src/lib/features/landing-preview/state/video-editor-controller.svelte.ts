/**
 * Public facade for the landing-preview video editor.
 *
 * The session, metadata, linking, media, navigation, and keyboard owners stay
 * independently testable while existing components keep one controller API.
 */

import { createVideoEditorCurationController } from "./video-editor-curation-controller";
import {
  createVideoEditorKeyboardController,
  VIDEO_EDITOR_PERFORMER_KEYS,
} from "./video-editor-keyboard-controller";
import { createVideoEditorLinkingController } from "./video-editor-linking-controller.svelte";
import { createVideoEditorMediaController } from "./video-editor-media-controller.svelte";
import { createVideoEditorMetadataController } from "./video-editor-metadata-controller.svelte";
import { createVideoEditorNavigationController } from "./video-editor-navigation-controller";
import { createVideoEditorSessionState } from "./video-editor-session-state.svelte";
import type { VideoEditorControllerOptions } from "./video-editor-types";

export type {
  VideoEditorControllerOptions,
  VideoEditorMode,
  VideoEditorState,
} from "./video-editor-types";

export function createVideoEditorController(
  options: VideoEditorControllerOptions
) {
  const session = createVideoEditorSessionState({
    videos: options.videos,
    categories: options.categories,
    quickPerformers: options.quickPerformers,
    videoCache: options.videoCache,
    onVideosUpdate: options.onVideosUpdate,
  });
  const linking = createVideoEditorLinkingController(
    session,
    options.persister,
    options.sequenceMatcher
  );
  const metadata = createVideoEditorMetadataController(
    session,
    options.persister,
    linking.searchSequencesForCurrentVideo,
    () => linking.matchedSequences.length > 0
  );
  const media = createVideoEditorMediaController(session, options.persister);
  const navigation = createVideoEditorNavigationController(
    session,
    metadata,
    linking
  );
  const curation = createVideoEditorCurationController(
    session,
    options.persister,
    linking,
    navigation
  );
  const handleKeydown = createVideoEditorKeyboardController(
    session,
    navigation,
    metadata,
    linking,
    curation
  );

  return {
    get mode() {
      return session.mode;
    },
    get currentVideo() {
      return session.currentVideo;
    },
    get videoUrl() {
      return session.videoUrl;
    },
    get currentIndex() {
      return session.currentIndex;
    },
    get saving() {
      return session.saving;
    },
    get showAddCategory() {
      return metadata.showAddCategory;
    },
    get newCategoryLabel() {
      return metadata.newCategoryLabel;
    },
    get newCategoryColor() {
      return metadata.newCategoryColor;
    },
    get showAddPerformer() {
      return metadata.showAddPerformer;
    },
    get sequenceSearchQuery() {
      return linking.sequenceSearchQuery;
    },
    get matchedSequences() {
      return linking.matchedSequences;
    },
    get sequenceSearching() {
      return linking.sequenceSearching;
    },
    get selectedSequenceForLink() {
      return linking.selectedSequenceForLink;
    },
    get cropModeActive() {
      return media.cropModeActive;
    },
    get snipModeActive() {
      return media.snipModeActive;
    },
    get categories() {
      return session.categories;
    },
    get quickPerformers() {
      return session.quickPerformers;
    },
    get uncuratedVideos() {
      return session.uncuratedVideos;
    },
    get unlinkableVideos() {
      return session.unlinkableVideos;
    },
    get unnamedVideos() {
      return session.unnamedVideos;
    },
    get curationProgress() {
      return session.curationProgress;
    },
    get linkingProgress() {
      return session.linkingProgress;
    },
    get renamingProgress() {
      return session.renamingProgress;
    },
    get stats() {
      return session.stats;
    },
    get maxLinks() {
      return linking.maxLinks;
    },
    get canAddMoreLinks() {
      return linking.canAddMoreLinks;
    },
    get showLinkingSection() {
      return linking.showLinkingSection;
    },
    performerKeys: VIDEO_EDITOR_PERFORMER_KEYS,
    openBrowse: navigation.openBrowse,
    openCurate: navigation.openCurate,
    openLink: navigation.openLink,
    openRename: navigation.openRename,
    close: navigation.close,
    goNext: navigation.goNext,
    goPrev: navigation.goPrev,
    goNextInRenameMode: navigation.goNextInRenameMode,
    skip: navigation.skip,
    setCategory: metadata.setCategory,
    addCategory: metadata.addCategory,
    toggleAddCategoryForm: metadata.toggleAddCategoryForm,
    updateCategoryLabel: metadata.updateCategoryLabel,
    updateCategoryColor: metadata.updateCategoryColor,
    togglePerformer: metadata.togglePerformer,
    addQuickPerformer: metadata.addQuickPerformer,
    removeQuickPerformer: metadata.removeQuickPerformer,
    toggleAddPerformerForm: metadata.toggleAddPerformerForm,
    isPerformerSelected: metadata.isPerformerSelected,
    searchSequences: linking.searchSequences,
    searchSequencesForTitle: linking.searchSequencesForTitle,
    linkSequence: linking.linkSequence,
    unlinkSequence: linking.unlinkSequence,
    selectSequenceForLink: linking.selectSequenceForLink,
    confirmLink: linking.confirmLink,
    updateTitle: curation.updateTitle,
    excludeVideo: curation.excludeVideo,
    openCropMode: media.openCropMode,
    closeCropMode: media.closeCropMode,
    applyCrop: media.applyCrop,
    clearCrop: media.clearCrop,
    openSnipMode: media.openSnipMode,
    closeSnipMode: media.closeSnipMode,
    applySnip: media.applySnip,
    clearSnip: media.clearSnip,
    handleKeydown,
    syncVideos: session.syncVideos,
    syncCategories: session.syncCategories,
    syncQuickPerformers: session.syncQuickPerformers,
  };
}

export type VideoEditorController = ReturnType<
  typeof createVideoEditorController
>;
