import type { VideoCropData, VideoSnipData } from "../types";
import { reportVideoEditError } from "./video-editor-errors";
import type { VideoEditorSessionState } from "./video-editor-session-state.svelte";
import type { VideoCuratorPersister } from "./video-editor-types";

export interface VideoEditorMediaController {
  readonly cropModeActive: boolean;
  readonly snipModeActive: boolean;

  openCropMode(): void;
  closeCropMode(): void;
  applyCrop(cropData: VideoCropData): Promise<void>;
  clearCrop(): Promise<void>;
  openSnipMode(): void;
  closeSnipMode(): void;
  applySnip(snipData: VideoSnipData): Promise<void>;
  clearSnip(): Promise<void>;
}

export function createVideoEditorMediaController(
  session: VideoEditorSessionState,
  persister: VideoCuratorPersister
): VideoEditorMediaController {
  let cropModeActive = $state(false);
  let snipModeActive = $state(false);

  function openCropMode(): void {
    cropModeActive = true;
  }

  function closeCropMode(): void {
    cropModeActive = false;
  }

  async function applyCrop(cropData: VideoCropData): Promise<void> {
    if (!session.currentVideo) return;
    session.setSaving(true);
    try {
      await persister.updateVideo(session.currentVideo.shortcode, {
        crop: cropData,
      });
      session.updateLocalVideo(session.currentVideo.shortcode, {
        crop: cropData,
      });
      closeCropMode();
    } catch (error) {
      reportVideoEditError("save crop", error);
    } finally {
      session.setSaving(false);
    }
  }

  async function clearCrop(): Promise<void> {
    if (!session.currentVideo) return;
    session.setSaving(true);
    try {
      await persister.updateVideo(session.currentVideo.shortcode, {
        crop: undefined,
      });
      session.updateLocalVideo(session.currentVideo.shortcode, {
        crop: undefined,
      });
    } catch (error) {
      reportVideoEditError("clear crop", error);
    } finally {
      session.setSaving(false);
    }
  }

  function openSnipMode(): void {
    snipModeActive = true;
  }

  function closeSnipMode(): void {
    snipModeActive = false;
  }

  async function applySnip(snipData: VideoSnipData): Promise<void> {
    if (!session.currentVideo) return;
    session.setSaving(true);
    try {
      await persister.updateVideo(session.currentVideo.shortcode, {
        snip: snipData,
      });
      session.updateLocalVideo(session.currentVideo.shortcode, {
        snip: snipData,
      });
      closeSnipMode();
    } catch (error) {
      reportVideoEditError("save snip", error);
    } finally {
      session.setSaving(false);
    }
  }

  async function clearSnip(): Promise<void> {
    if (!session.currentVideo) return;
    session.setSaving(true);
    try {
      await persister.updateVideo(session.currentVideo.shortcode, {
        snip: undefined,
      });
      session.updateLocalVideo(session.currentVideo.shortcode, {
        snip: undefined,
      });
    } catch (error) {
      reportVideoEditError("clear snip", error);
    } finally {
      session.setSaving(false);
    }
  }

  return {
    get cropModeActive() {
      return cropModeActive;
    },
    get snipModeActive() {
      return snipModeActive;
    },
    openCropMode,
    closeCropMode,
    applyCrop,
    clearCrop,
    openSnipMode,
    closeSnipMode,
    applySnip,
    clearSnip,
  };
}
