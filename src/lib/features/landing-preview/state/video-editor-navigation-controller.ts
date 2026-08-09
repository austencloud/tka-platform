import type { ShowcaseVideo } from "../types";
import type { VideoEditorLinkingController } from "./video-editor-linking-controller.svelte";
import type { VideoEditorMetadataController } from "./video-editor-metadata-controller.svelte";
import type { VideoEditorSessionState } from "./video-editor-session-state.svelte";

export interface VideoEditorNavigationController {
  openBrowse(video: ShowcaseVideo): void;
  openCurate(): void;
  openLink(): void;
  openRename(): void;
  close(): void;
  goNext(): void;
  goPrev(): void;
  goNextInRenameMode(): void;
  skip(): void;
}

export function createVideoEditorNavigationController(
  session: VideoEditorSessionState,
  metadata: VideoEditorMetadataController,
  linking: VideoEditorLinkingController
): VideoEditorNavigationController {
  function resetFormState(): void {
    metadata.resetFormState();
    linking.resetLinkingState();
  }

  function openBrowse(video: ShowcaseVideo): void {
    session.setMode("browse");
    session.setCurrentVideoShortcode(video.shortcode);
    session.setCurrentIndex(0);
    resetFormState();
  }

  function openCurate(): void {
    session.setMode("curate");
    session.setCurrentIndex(0);
    session.setCurrentVideoShortcode(
      session.uncuratedVideos[0]?.shortcode ?? null
    );
    resetFormState();
    if (session.uncuratedVideos[0]?.title) {
      void linking.searchSequencesForCurrentVideo();
    }
  }

  function openLink(): void {
    session.setMode("link");
    session.setCurrentIndex(0);
    session.setCurrentVideoShortcode(null);
    resetFormState();
    if (session.unlinkableVideos.length > 0) {
      void linking.searchSequencesForCurrentVideo();
    }
  }

  function openRename(): void {
    session.setMode("rename");
    session.setCurrentIndex(0);
    session.setCurrentVideoShortcode(
      session.unnamedVideos[0]?.shortcode ?? null
    );
    resetFormState();
  }

  function close(): void {
    session.setMode("closed");
    session.setCurrentVideoShortcode(null);
    session.clearVideoUrl();
    session.setCurrentIndex(0);
    resetFormState();
  }

  function prepareCurrentVideo(): void {
    if (session.mode !== "link" && session.mode !== "curate") return;
    linking.resetLinkingState();
    void linking.searchSequencesForCurrentVideo();
  }

  function goNext(): void {
    const list = session.getVideoList();
    if (session.currentIndex >= list.length - 1) return;
    const nextIndex = session.currentIndex + 1;
    session.setCurrentIndex(nextIndex);
    session.setCurrentVideoShortcode(list[nextIndex]?.shortcode ?? null);
    prepareCurrentVideo();
  }

  function goPrev(): void {
    const list = session.getVideoList();
    if (session.currentIndex <= 0) return;
    const previousIndex = session.currentIndex - 1;
    session.setCurrentIndex(previousIndex);
    session.setCurrentVideoShortcode(list[previousIndex]?.shortcode ?? null);
    prepareCurrentVideo();
  }

  function goNextInRenameMode(): void {
    const list = session.unnamedVideos;
    if (list.length === 0) {
      close();
      return;
    }
    const nextIndex = Math.min(session.currentIndex, list.length - 1);
    session.setCurrentIndex(nextIndex);
    session.setCurrentVideoShortcode(list[nextIndex]?.shortcode ?? null);
  }

  function skip(): void {
    goNext();
  }

  return {
    openBrowse,
    openCurate,
    openLink,
    openRename,
    close,
    goNext,
    goPrev,
    goNextInRenameMode,
    skip,
  };
}
