import type { UserProfile, VideoPerformer } from "../types";
import { reportVideoEditError } from "./video-editor-errors";
import type { VideoEditorSessionState } from "./video-editor-session-state.svelte";
import type { VideoCuratorPersister } from "./video-editor-types";

export interface VideoEditorMetadataController {
  readonly showAddCategory: boolean;
  readonly newCategoryLabel: string;
  readonly newCategoryColor: string;
  readonly showAddPerformer: boolean;

  resetFormState(): void;
  setCategory(categoryId: string): Promise<void>;
  addCategory(): Promise<void>;
  toggleAddCategoryForm(show: boolean): void;
  updateCategoryLabel(label: string): void;
  updateCategoryColor(color: string): void;
  togglePerformer(user: UserProfile): Promise<void>;
  addQuickPerformer(performer: VideoPerformer): Promise<void>;
  removeQuickPerformer(id: string): Promise<void>;
  toggleAddPerformerForm(show: boolean): void;
  isPerformerSelected(id: string): boolean;
}

export function createVideoEditorMetadataController(
  session: VideoEditorSessionState,
  persister: VideoCuratorPersister,
  searchSequencesForCurrentVideo: () => Promise<void>,
  hasMatchedSequences: () => boolean
): VideoEditorMetadataController {
  let showAddCategory = $state(false);
  let newCategoryLabel = $state("");
  let newCategoryColor = $state("#6366f1");
  let showAddPerformer = $state(false);

  function resetFormState(): void {
    showAddCategory = false;
    newCategoryLabel = "";
    newCategoryColor = "#6366f1";
    showAddPerformer = false;
  }

  async function setCategory(categoryId: string): Promise<void> {
    if (!session.currentVideo || session.saving) return;
    session.setSaving(true);
    try {
      await persister.updateVideo(session.currentVideo.shortcode, {
        category: categoryId,
      });
      session.updateLocalVideo(session.currentVideo.shortcode, {
        category: categoryId,
      });
      if (session.currentVideo.title && !hasMatchedSequences()) {
        void searchSequencesForCurrentVideo();
      }
    } catch (error) {
      reportVideoEditError("set category", error);
    } finally {
      session.setSaving(false);
    }
  }

  async function addCategory(): Promise<void> {
    if (!newCategoryLabel.trim()) return;
    const id = newCategoryLabel.toLowerCase().replace(/\s+/g, "-");
    const nextCategories = [
      ...session.categories,
      {
        id,
        label: newCategoryLabel.trim(),
        color: newCategoryColor,
      },
    ];
    session.syncCategories(nextCategories);
    await persister.saveCategories(nextCategories);
    newCategoryLabel = "";
    newCategoryColor = "#6366f1";
    showAddCategory = false;
  }

  function toggleAddCategoryForm(show: boolean): void {
    showAddCategory = show;
  }

  function updateCategoryLabel(label: string): void {
    newCategoryLabel = label;
  }

  function updateCategoryColor(color: string): void {
    newCategoryColor = color;
  }

  async function togglePerformer(user: UserProfile): Promise<void> {
    if (!session.currentVideo || session.saving) return;
    session.setSaving(true);
    try {
      const existingIndex = session.currentVideo.performers.findIndex(
        (performer) => performer.id === user.id
      );
      const performers =
        existingIndex >= 0
          ? session.currentVideo.performers.filter(
              (performer) => performer.id !== user.id
            )
          : [
              ...session.currentVideo.performers,
              { id: user.id, displayName: user.displayName },
            ];
      await persister.updateVideo(session.currentVideo.shortcode, {
        performers,
      });
      session.updateLocalVideo(session.currentVideo.shortcode, { performers });
    } catch (error) {
      reportVideoEditError("update performers", error);
    } finally {
      session.setSaving(false);
    }
  }

  async function addQuickPerformer(performer: VideoPerformer): Promise<void> {
    if (session.quickPerformers.some((entry) => entry.id === performer.id)) {
      showAddPerformer = false;
      return;
    }
    const nextPerformers = [
      ...session.quickPerformers,
      { id: performer.id, displayName: performer.displayName },
    ];
    session.syncQuickPerformers(nextPerformers);
    try {
      await persister.saveQuickPerformers(nextPerformers);
    } catch (error) {
      reportVideoEditError("save quick performers", error);
    }
    showAddPerformer = false;
  }

  async function removeQuickPerformer(id: string): Promise<void> {
    const nextPerformers = session.quickPerformers.filter(
      (performer) => performer.id !== id
    );
    session.syncQuickPerformers(nextPerformers);
    try {
      await persister.saveQuickPerformers(nextPerformers);
    } catch (error) {
      reportVideoEditError("remove quick performer", error);
    }
  }

  function toggleAddPerformerForm(show: boolean): void {
    showAddPerformer = show;
  }

  function isPerformerSelected(id: string): boolean {
    return (
      session.currentVideo?.performers.some(
        (performer) => performer.id === id
      ) ?? false
    );
  }

  return {
    get showAddCategory() {
      return showAddCategory;
    },
    get newCategoryLabel() {
      return newCategoryLabel;
    },
    get newCategoryColor() {
      return newCategoryColor;
    },
    get showAddPerformer() {
      return showAddPerformer;
    },
    resetFormState,
    setCategory,
    addCategory,
    toggleAddCategoryForm,
    updateCategoryLabel,
    updateCategoryColor,
    togglePerformer,
    addQuickPerformer,
    removeQuickPerformer,
    toggleAddPerformerForm,
    isPerformerSelected,
  };
}
