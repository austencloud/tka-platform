import {
  isFavorite as checkIsFavorite,
  toggleFavorite as doToggleFavorite,
} from "$lib/shared/library/services/collection-manager";
import { getLibraryRepository } from "$lib/shared/library/get-library-repository";
import { getLibrarySaveService } from "$lib/features/library/get-library-save-service";
import type { LibraryRepository } from "$lib/shared/library/services/library-repository";
import type { LibrarySequence } from "$lib/shared/library/domain/models/library-sequence";
import { LibraryError } from "$lib/shared/library/domain/library-error";
import { computeHash } from "$lib/shared/library/services/sequence-content-hasher";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { createSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
import { authState } from "$lib/shared/auth/state/auth-state.svelte";
import { ensureGuestIdentity } from "$lib/shared/auth/services/guest-identity";
import {
  removeToast,
  showToast,
} from "$lib/shared/toast/state/toast-state.svelte";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
import { postSaveActivation } from "$lib/shared/onboarding/state/post-save-activation-state.svelte";

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
    const pendingToastId = showToast({
      message: "Saving to library…",
      type: "info",
      duration: 0,
      announcement: "polite",
    });

    try {
      await ensureGuestIdentity();
      const currentPathShape = getAnimationVisibilityManager().getPathShape();
      const pathShapeMetadata =
        currentPathShape !== "arc"
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
          ...(sequence?.creatorIntent?.effortTimeline && {
            effortTimeline: sequence.creatorIntent.effortTimeline,
          }),
          ...(sequence?.effortTimeline && {
            effortTimeline: sequence.effortTimeline,
          }),
        },
        intendedProp: {
          bluePropType,
          redPropType,
          catDogMode,
        },
      });
      const name =
        sequenceWithIntent.word ||
        sequenceWithIntent.steps
          ?.map((step) => step?.letter || "")
          .filter(Boolean)
          .join("") ||
        "";
      const result = await getLibrarySaveService().saveSequence(
        sequenceWithIntent,
        {
          name,
          visibility: "public",
          tags: [],
          notes: "",
        }
      );
      isSaved = true;
      isOwnedLibraryRecord =
        result.persisted && result.sequenceId === sequence.id;
      const contentHash = (sequenceWithIntent as LibrarySequence).contentHash;
      if (contentHash) savedHashCache.set(contentHash, true);
      removeToast(pendingToastId, "programmatic");
      showToast("Saved to library", "success");

      // SP3 Part B: viewer save has no panel to close first (unlike the
      // Create Save panel), so fire straight from the result — this is the
      // root-level "no panel" case the design doc calls out.
      if (result.persisted) {
        postSaveActivation.onGuestSaveSucceeded(result.sequenceId);
      }
    } catch (error) {
      removeToast(pendingToastId, "programmatic");
      if (error instanceof LibraryError && error.code === "ALREADY_EXISTS") {
        isSaved = true;
        void computeHash(sequence)
          .then((hash) => savedHashCache.set(hash, true))
          .catch(() => {});
        showToast("Already in library", "info");
        return;
      }

      console.error("Failed to save sequence:", error);
      const msg =
        error instanceof Error ? error.message : "Failed to save sequence";
      showToast(msg, "error");
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
