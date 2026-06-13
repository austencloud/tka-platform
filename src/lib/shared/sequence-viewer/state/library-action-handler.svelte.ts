import { isFavorite as checkIsFavorite, toggleFavorite as doToggleFavorite } from "$lib/shared/library/services/collection-manager";
import { getLibraryRepository } from "$lib/shared/library/get-library-repository";
import type { LibraryRepository } from "$lib/shared/library/services/library-repository";
import type { LibrarySequence } from "$lib/shared/library/domain/models/library-sequence";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { createSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
import { authState } from "$lib/shared/auth/state/auth-state.svelte";
import { showToast } from "$lib/shared/toast/state/toast-state.svelte";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";

export interface LibraryActionHandlerDeps {
  getSequence: () => SequenceData | null;
  getIsOwned: () => boolean;
  getBluePropType: () => PropType | undefined;
  getRedPropType: () => PropType | undefined;
  getCatDogModeEnabled: () => boolean | undefined;
  getHapticService: () => HapticFeedback | null;
  onDeleteSuccess: () => void;
}

export function createLibraryActionHandler(deps: LibraryActionHandlerDeps) {
  let isSaved = $state(true);
  let isFavorite = $state(false);

  const savedHashCache = new Map<string, boolean>();

  function syncSavedState(sequence: SequenceData | null) {
    const seq = sequence as LibrarySequence | null;
    if (!seq?.contentHash || !authState.user?.uid) {
      isSaved = !(deps.getIsOwned() && seq && !seq.contentHash);
      return;
    }

    const hash = seq.contentHash;
    if (savedHashCache.has(hash)) {
      isSaved = savedHashCache.get(hash)!;
      return;
    }

    const repo = getLibraryRepository() as LibraryRepository;
    repo.hasMatchingContent(hash)
      .then((found) => {
        savedHashCache.set(hash, found);
        if (deps.getSequence()?.id === seq.id) isSaved = found;
      })
      .catch(() => {});
  }

  function syncFavoriteState(sequence: SequenceData | null) {
    if (!sequence) { isFavorite = false; return; }

    checkIsFavorite(sequence.id)
      .then((fav) => { if (deps.getSequence()?.id === sequence.id) isFavorite = fav; })
      .catch(() => {});
  }

  function handleFavoriteToggle() {
    const sequence = deps.getSequence();
    if (!sequence) return;
    isFavorite = !isFavorite;
    doToggleFavorite(sequence.id).catch(() => { isFavorite = !isFavorite; });
  }

  async function handlePublishAction() {
    const sequence = deps.getSequence();
    if (!sequence) return;
    try {
      const repo = getLibraryRepository() as LibraryRepository;
      await repo.publishSequence(sequence.id);
    } catch (e) {
      console.error("[Orchestrator] publishSequence FAILED:", e);
      showToast("Failed to publish sequence", "error");
    }
  }

  async function handleUnpublishAction() {
    const sequence = deps.getSequence();
    if (!sequence) return;
    try {
      const repo = getLibraryRepository() as LibraryRepository;
      await repo.unpublishSequence(sequence.id);
    } catch (e) {
      console.error("[Orchestrator] unpublishSequence FAILED:", e);
      showToast("Failed to unpublish sequence", "error");
    }
  }

  async function handleSave() {
    deps.getHapticService()?.trigger("selection");
    const sequence = deps.getSequence();
    if (!authState.isAuthenticated) {
      showToast("Sign in to save sequences", "info");
      return;
    }
    if (!sequence) {
      showToast("No sequence to save", "info");
      return;
    }
    try {
      const libraryRepo = getLibraryRepository();
      const currentPathShape = getAnimationVisibilityManager().getPathShape();
      const pathShapeMetadata = currentPathShape !== "arc"
        ? { ...sequence.metadata, pathShape: currentPathShape }
        : sequence.metadata;
      const bluePropType = deps.getBluePropType() ?? PropType.STAFF;
      const redPropType = deps.getRedPropType() ?? PropType.STAFF;
      const catDogMode = deps.getCatDogModeEnabled() ?? false;
      const sequenceWithIntent = createSequenceData({
        ...sequence,
        metadata: pathShapeMetadata,
        creatorIntent: {
          propConfig: {
            bluePropType,
            redPropType,
            catDogMode,
          },
          ...(sequence?.creatorIntent?.effortTimeline && { effortTimeline: sequence.creatorIntent.effortTimeline }),
          ...(sequence?.effortTimeline && { effortTimeline: sequence.effortTimeline }),
        },
        intendedProp: {
          bluePropType,
          redPropType,
          catDogMode,
        },
      });
      await libraryRepo.saveSequence(sequenceWithIntent);
      showToast("Saved to library", "success");
    } catch (error) {
      console.error("Failed to save sequence:", error);
      showToast("Failed to save sequence", "error");
    }
  }

  async function handleDelete() {
    const sequence = deps.getSequence();
    if (!sequence) return;
    deps.getHapticService()?.trigger("warning");
    try {
      const libraryRepo = getLibraryRepository();
      await libraryRepo.deleteSequence(sequence.id);
      showToast("Sequence deleted", "success");
      deps.onDeleteSuccess();
    } catch (error) {
      console.error("Failed to delete sequence:", error);
      showToast("Failed to delete sequence", "error");
    }
  }

  return {
    get isSaved() { return isSaved; },
    get isFavorite() { return isFavorite; },
    syncSavedState,
    syncFavoriteState,
    handleFavoriteToggle,
    handlePublishAction,
    handleUnpublishAction,
    handleSave,
    handleDelete,
  };
}
