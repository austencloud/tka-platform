import { reportVideoEditError } from "./video-editor-errors";
import type { VideoEditorLinkingController } from "./video-editor-linking-controller.svelte";
import type { VideoEditorNavigationController } from "./video-editor-navigation-controller";
import type { VideoEditorSessionState } from "./video-editor-session-state.svelte";
import type { VideoCuratorPersister } from "./video-editor-types";

export interface VideoEditorCurationController {
  updateTitle(title: string): Promise<void>;
  excludeVideo(): Promise<void>;
}

export function createVideoEditorCurationController(
  session: VideoEditorSessionState,
  persister: VideoCuratorPersister,
  linking: VideoEditorLinkingController,
  navigation: VideoEditorNavigationController
): VideoEditorCurationController {
  async function updateTitle(title: string): Promise<void> {
    if (!session.currentVideo || session.saving) return;
    const trimmedTitle = title.trim() || undefined;
    session.updateLocalVideo(session.currentVideo.shortcode, {
      title: trimmedTitle,
    });
    try {
      await persister.updateVideo(session.currentVideo.shortcode, {
        title: trimmedTitle,
      });
      if (trimmedTitle) {
        void linking.searchSequencesForCurrentVideo();
      }
    } catch (error) {
      reportVideoEditError("update title", error);
    }
  }

  async function excludeVideo(): Promise<void> {
    if (!session.currentVideo || session.saving) return;
    session.setSaving(true);
    try {
      await persister.updateVideo(session.currentVideo.shortcode, {
        excluded: true,
      });
      session.updateLocalVideo(session.currentVideo.shortcode, {
        excluded: true,
      });
      navigation.goNext();
    } catch (error) {
      reportVideoEditError("exclude video", error);
    } finally {
      session.setSaving(false);
    }
  }

  return { updateTitle, excludeVideo };
}
