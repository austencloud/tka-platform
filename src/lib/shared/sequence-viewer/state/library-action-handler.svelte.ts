import {
  isFavorite as checkIsFavorite,
  toggleFavorite as doToggleFavorite,
} from "$lib/shared/library/services/collection-manager";
import { getLibraryRepository } from "$lib/shared/library/get-library-repository";
import { getVisualSequenceSaveCoordinator } from "$lib/shared/library/get-visual-sequence-save-coordinator";
import type { LibraryRepository } from "$lib/shared/library/services/library-repository";
import type { LibrarySequence } from "$lib/shared/library/domain/models/library-sequence";
import { computeHash } from "$lib/shared/library/services/sequence-content-hasher";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
import { authState } from "$lib/shared/auth/state/auth-state.svelte";
import { showToast } from "$lib/shared/toast/state/toast-state.svelte";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
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
  let isSaving = $state(false);
  let isFavorite = $state(false);
  let isOwnedLibraryRecord = $state(false);

  const savedHashCache = new Map<string, boolean>();
  let savedStateRevision = 0;

  function syncSavedState(sequence: SequenceData | null) {
    const revision = ++savedStateRevision;
    const seq = sequence as LibrarySequence | null;
    isOwnedLibraryRecord = false;
    if (!seq || !authState.user?.uid) {
      isSaved = !(deps.getIsOwned() && seq && !seq.contentHash);
      return;
    }

    if (!seq.contentHash && deps.getIsOwned()) isSaved = false;

    const repo = getLibraryRepository() as LibraryRepository;
    if (deps.getIsOwned()) {
      repo
        .getSequence(seq.id)
        .then((record) => {
          if (
            revision === savedStateRevision &&
            deps.getSequence()?.id === seq.id
          ) {
            isOwnedLibraryRecord = record !== null;
          }
        })
        .catch(() => {});
    }

    Promise.resolve(seq.contentHash ?? computeHash(seq))
      .then(async (hash) => {
        if (savedHashCache.has(hash)) return savedHashCache.get(hash)!;
        const found = await repo.hasMatchingContent(hash);
        savedHashCache.set(hash, found);
        return found;
      })
      .then((found) => {
        if (
          revision === savedStateRevision &&
          deps.getSequence()?.id === seq.id
        ) {
          isSaved = found;
        }
      })
      .catch(() => {});
  }

  function syncFavoriteState(sequence: SequenceData | null) {
    if (!sequence) {
      isFavorite = false;
      return;
    }

    checkIsFavorite(sequence.id)
      .then((fav) => {
        if (deps.getSequence()?.id === sequence.id) isFavorite = fav;
      })
      .catch(() => {});
  }

  function handleFavoriteToggle() {
    const sequence = deps.getSequence();
    if (!sequence) return;
    isFavorite = !isFavorite;
    doToggleFavorite(sequence.id).catch(() => {
      isFavorite = !isFavorite;
    });
  }

  async function handlePublishAction() {
    const sequence = deps.getSequence();
    if (!sequence || !isOwnedLibraryRecord) return;
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
    if (!sequence || !isOwnedLibraryRecord) return;
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
    if (!sequence) {
      showToast("No sequence to save", "info");
      return;
    }
    if (isSaving) return;

    savedStateRevision += 1;
    isSaving = true;

    try {
      const coordinator = await getVisualSequenceSaveCoordinator();
      const outcome = await coordinator.save(sequence, {
        bluePropType: deps.getBluePropType(),
        redPropType: deps.getRedPropType(),
        catDogModeEnabled: deps.getCatDogModeEnabled(),
        pathShape: getAnimationVisibilityManager().getPathShape(),
      });
      if (outcome.status === "failed") return;

      isSaved = true;
      savedHashCache.set(outcome.contentHash, true);
      if (outcome.status === "saved") {
        isOwnedLibraryRecord =
          outcome.result.persisted && outcome.result.sequenceId === sequence.id;
      }
    } finally {
      isSaving = false;
    }
  }

  async function handleDelete() {
    const sequence = deps.getSequence();
    if (!sequence || !isOwnedLibraryRecord) return;
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
    get isSaved() {
      return isSaved;
    },
    get isSaving() {
      return isSaving;
    },
    get isFavorite() {
      return isFavorite;
    },
    get isOwnedLibraryRecord() {
      return isOwnedLibraryRecord;
    },
    syncSavedState,
    syncFavoriteState,
    handleFavoriteToggle,
    handlePublishAction,
    handleUnpublishAction,
    handleSave,
    handleDelete,
  };
}
