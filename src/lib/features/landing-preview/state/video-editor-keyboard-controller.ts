import type { VideoEditorCurationController } from "./video-editor-curation-controller";
import type { VideoEditorLinkingController } from "./video-editor-linking-controller.svelte";
import type { VideoEditorMetadataController } from "./video-editor-metadata-controller.svelte";
import type { VideoEditorNavigationController } from "./video-editor-navigation-controller";
import type { VideoEditorSessionState } from "./video-editor-session-state.svelte";

export const VIDEO_EDITOR_PERFORMER_KEYS = "asdfgh";

export function createVideoEditorKeyboardController(
  session: VideoEditorSessionState,
  navigation: VideoEditorNavigationController,
  metadata: VideoEditorMetadataController,
  linking: VideoEditorLinkingController,
  curation: VideoEditorCurationController
): (event: KeyboardEvent) => void {
  return function handleKeydown(event: KeyboardEvent): void {
    if (session.mode === "closed" || session.saving) return;

    const active = document.activeElement;
    if (active) {
      const tagName = active.tagName.toLowerCase();
      if (
        tagName === "input" ||
        tagName === "textarea" ||
        (active as HTMLElement).isContentEditable
      ) {
        return;
      }
    }

    const numberKey = Number.parseInt(event.key);
    if (
      numberKey >= 1 &&
      numberKey <= session.categories.length &&
      session.mode !== "link"
    ) {
      event.preventDefault();
      const category = session.categories[numberKey - 1];
      if (category) void metadata.setCategory(category.id);
      return;
    }

    if (
      session.mode === "link" &&
      numberKey >= 1 &&
      numberKey <= linking.matchedSequences.length
    ) {
      event.preventDefault();
      const sequence = linking.matchedSequences[numberKey - 1];
      if (sequence) linking.selectSequenceForLink(sequence);
      return;
    }

    if (session.mode !== "link") {
      const performerIndex = VIDEO_EDITOR_PERFORMER_KEYS.indexOf(
        event.key.toLowerCase()
      );
      if (
        performerIndex >= 0 &&
        performerIndex < session.quickPerformers.length
      ) {
        event.preventDefault();
        const performer = session.quickPerformers[performerIndex];
        if (performer) void metadata.togglePerformer(performer);
        return;
      }
    }

    if (event.key === "ArrowLeft" || event.key === "h") {
      if (session.mode !== "browse") {
        event.preventDefault();
        navigation.goPrev();
      }
    } else if (event.key === "ArrowRight" || event.key === "l") {
      if (session.mode !== "browse") {
        event.preventDefault();
        navigation.goNext();
      }
    } else if (event.key === "x") {
      event.preventDefault();
      navigation.skip();
    } else if (event.key === "e" && session.mode === "curate") {
      event.preventDefault();
      void curation.excludeVideo();
    } else if (
      event.key === "Enter" &&
      session.mode === "link" &&
      linking.selectedSequenceForLink
    ) {
      event.preventDefault();
      void linking.confirmLink();
    } else if (event.key === "Escape") {
      navigation.close();
    }
  };
}
