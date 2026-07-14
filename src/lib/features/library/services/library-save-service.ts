/**
 * LibrarySaveService - Orchestrates saving sequences to library
 *
 * Handles the multi-step process of saving a sequence:
 * 1. Generate thumbnail image (with caching optimization)
 * 2. Optimistic save to Dexie (instant, works offline)
 * 3. Create any new tags that don't exist
 * 4. Background Firestore sync (non-blocking)
 * 5. Refresh library state
 *
 * The Dexie write in step 2 makes saving work offline. Firestore syncs
 * in the background and fails gracefully if the user is offline - the
 * sequence is already safe in local storage.
 */

import { getErrorHandler } from "$lib/shared/application/get-error-handler";
import { warmSequenceCells } from "./warm-sequence-cells";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { SequenceVisibility } from "$lib/shared/library/domain/models/library-sequence";
import { findTagByName, createUserTag } from "./tag-manager";
import type { ArtifactExtractor } from "./artifact-extractor";
import { TAG_COLORS } from "../domain/models/tag";
import { getImageCompositionManager } from "$lib/shared/share/state/image-composition-state.svelte.ts";
import type {
  SaveToLibraryOptions, SaveProgress, SaveResult } from "./types";
import type { ErrorHandler } from '$lib/shared/application/services/error-handler'
import { LibraryError } from "$lib/shared/library/domain/library-error";
import { isEmptySequence, meetsCommunityMinimum, MIN_COMMUNITY_STEPS } from "$lib/shared/library/domain/sequence-min-length";
import { toast } from "$lib/shared/toast/state/toast-state.svelte.ts";
import { db } from "$lib/shared/persistence/database/tka-database";
import { authState } from "$lib/shared/auth/state/auth-state.svelte";
import { isFullAccountUser } from "$lib/shared/auth/domain/access-tier";
import { ensureGuestIdentity } from "$lib/shared/auth/services/guest-identity";
import { GUEST_SAVE_CAP } from "$lib/shared/auth/domain/guest-access-config";
import { openAuthDialog } from "$lib/shared/auth/state/auth-ui-state.svelte";
import type { Sharer } from "../../../shared/share/services/sharer";
import type { R2VideoUploader } from "../../../shared/share/services/r2-video-uploader";
import type { LibraryRepository } from "$lib/shared/library/services/library-repository";

/** How long the "Saved!" success state lingers before the overlay dismisses. */
const SUCCESS_STATE_LINGER_MS = 800;

/** localStorage flag so the guest "save → create an account" nudge fires once. */
const GUEST_SAVE_NUDGE_SEEN_KEY = "tka-guest-save-nudge-seen";

// NOTE: The 'Service' suffix violates the service-naming rule (should be e.g.
// LibrarySaveCoordinator). Rename deferred: this class is imported as a type by
// out-of-scope files (features/create/shared/state/save-panel-state.svelte.ts,
// SaveToLibraryPanel.svelte) and referenced in the shared library contract.
// Renaming would force cross-scope churn into parallel-session areas.
export class LibrarySaveService {
  private readonly shareService: Sharer | null;
  private readonly uploadService: R2VideoUploader | null;
  private readonly libraryRepository: LibraryRepository;
  private readonly artifactExtractor: ArtifactExtractor | null;

  constructor(
    shareService: Sharer | null,
    uploadService: R2VideoUploader | null,
    libraryRepository: LibraryRepository,
    artifactExtractor?: ArtifactExtractor | null
  ) {
    this.shareService = shareService ?? null;
    this.uploadService = uploadService ?? null;
    this.libraryRepository = libraryRepository;
    this.artifactExtractor = artifactExtractor ?? null;
  }

  async saveSequence(
    sequence: SequenceData,
    options: SaveToLibraryOptions,
    onProgress?: (progress: SaveProgress) => void
  ): Promise<SaveResult> {
    // Guests can save: ensure an (anonymous) identity exists so the Firestore
    // sync and thumbnail upload have a uid, regardless of how the user entered
    // Create (Construct already provisions on start-position select; Generate /
    // import do not). Best-effort — ensureGuestIdentity() swallows failures
    // (anon provider disabled, offline), and the Dexie write below keeps the
    // save working even when no identity could be provisioned.
    await ensureGuestIdentity();

    if (isEmptySequence(sequence)) {
      throw new LibraryError(
        "Nothing to save — this sequence has no steps.",
        "INVALID_DATA",
        sequence.id
      );
    }

    const { name, displayName, tags, notes } = options;
    // Community gate: under the minimum, a sequence can still be saved to the
    // user's own library — just not posted to the community gallery. Degrade the
    // requested visibility and tell them, rather than failing the save. The
    // repository + syncer enforce the same invariant as a backstop.
    let visibility = options.visibility;
    if (visibility === "public" && !meetsCommunityMinimum(sequence)) {
      visibility = "private";
      toast.info(
        `Needs at least ${MIN_COMMUNITY_STEPS} steps to post to the community gallery. Saved to your library.`
      );
    }

    const emitProgress = (
      step: number,
      renderProgress?: { current: number; total: number }
    ) => {
      onProgress?.({
        step,
        stepLabel: this.getStepLabel(step, renderProgress),
        renderProgress,
      });
    };

    // Resolve the sequence id ONCE up front so the thumbnail upload, the Dexie
    // row, the Firestore doc, and the returned id all reference the same
    // sequence. Previously the thumbnail + Firestore sync received the original
    // (often id-less) `sequence`, so LibraryRepository minted a *different* UUID
    // for the cloud copy — duplicating the cloud doc and orphaning the Dexie row.
    const resolvedSequence: SequenceData = {
      ...sequence,
      id: sequence.id || crypto.randomUUID(),
    };

    // Guest save cap: a guest may keep up to GUEST_SAVE_CAP sequences on this
    // device. Re-saving one already in the library is an update, not a new save,
    // so it's always allowed. A brand-new save past the cap is blocked and routes
    // the guest to sign up. Full accounts are never capped. Gated here (before the
    // expensive thumbnail render) so all callers of saveSequence share the limit.
    const isFullAccount = isFullAccountUser(
      authState.isAuthenticated,
      authState.isAnonymous
    );
    if (!isFullAccount) {
      const alreadySaved = await db.sequences.get(resolvedSequence.id);
      if (!alreadySaved) {
        const guestCount = await db.sequences.count();
        if (guestCount >= GUEST_SAVE_CAP) {
          toast.info(
            `Guests can save ${GUEST_SAVE_CAP}. Create a free account to save more.`,
            6000
          );
          openAuthDialog();
          throw new LibraryError(
            `Guest save limit reached (${GUEST_SAVE_CAP}).`,
            "GUEST_CAP",
            resolvedSequence.id
          );
        }
      }
    }

    // Step 1: Generate thumbnail image
    emitProgress(1);
    const thumbnailUrl = await this.generateAndUploadThumbnail(
      resolvedSequence,
      emitProgress
    );

    // Step 2: Optimistic save to Dexie (instant, works offline)
    // The sequence is safe in local storage before we ever touch Firestore.
    emitProgress(2);
    const sequenceToSave: SequenceData = {
      ...resolvedSequence,
      name,
      displayName: displayName || undefined,
      tags: [...tags],
      thumbnails: thumbnailUrl ? [thumbnailUrl] : [...(sequence.thumbnails ?? [])],
      isFavorite: false,
    };
    try {
      // JSON round-trip strips Firestore Timestamps and other non-cloneable objects
      const cloneable = JSON.parse(JSON.stringify(sequenceToSave));
      await db.sequences.put(cloneable);
    } catch (dexieError) {
      // Dexie is the guaranteed-persistence layer ("safe in local storage
      // before we ever touch Firestore"). If it fails, that guarantee is void —
      // surface it instead of swallowing, so the user isn't shown "Saved!" for a
      // sequence that may exist nowhere (the Firestore sync below is
      // fire-and-forget and may be offline).
      console.warn("[LibrarySaveService] Dexie optimistic save failed:", dexieError);
      const errorHandler = getErrorHandler() as ErrorHandler;
      errorHandler.showUserError({
        message:
          "Couldn't save a local copy — this sequence may not be available offline",
        technicalDetails:
          dexieError instanceof Error ? dexieError.message : String(dexieError),
        error:
          dexieError instanceof Error ? dexieError : new Error(String(dexieError)),
        severity: "warning",
        context: { module: "library", action: "save-to-library" },
      });
    }

    const sequenceId = sequenceToSave.id;

    // Step 3: Create any new tags
    emitProgress(3);
    await this.createNewTags(tags);

    // Step 4: Background Firestore sync (non-blocking)
    // If offline, the sequence is already in Dexie and the user sees success.
    emitProgress(4);
    this.syncToFirestore(resolvedSequence, { name, displayName, visibility, tags, notes: notes ?? "", thumbnailUrl })
      .catch(err => console.warn("[LibrarySaveService] Firestore sync pending:", err));

    // Fire-and-forget: pre-render this sequence's pictograph cells to the cloud
    // store (canonical visibility + intendedProp) so the first person to scan
    // its QR downloads images instead of rendering them on their phone. Never
    // blocks or fails the save.
    if (typeof window !== "undefined") {
      const ip = sequenceToSave.intendedProp;
      void warmSequenceCells(sequenceToSave, {
        isDark: true,
        bluePropType: ip?.bluePropType,
        redPropType: ip?.redPropType,
        catDogMode: ip?.catDogMode ?? false,
      }).catch(() => {});
    }

    // Fire-and-forget: decompose the sequence into hand paths and solo props
    // so they're independently queryable in the user's artifact repositories.
    const currentUserId = authState.effectiveUserId;
    if (this.artifactExtractor && currentUserId && sequenceToSave.blueSoloProp && sequenceToSave.redSoloProp) {
      this.artifactExtractor.extract(sequenceToSave, currentUserId).catch((err) =>
        console.error("Artifact extraction failed (non-blocking):", err)
      );
    }

    // Step 5: Refresh library state
    emitProgress(5);
    await this.refreshLibraryState();

    // Step 6: Complete
    emitProgress(6);

    // Value-moment nudge: a guest just saved successfully. Encourage account
    // creation once per device. Members (full accounts) never see this.
    this.maybeNudgeGuestToSignUp();

    // Brief pause to show success state
    await new Promise((resolve) => setTimeout(resolve, SUCCESS_STATE_LINGER_MS));

    return { sequenceId, thumbnailUrl };
  }

  /**
   * One gentle, non-blocking account nudge after a guest's first successful
   * save. Guarded to guests (anon / unauthenticated) and once per device.
   */
  private maybeNudgeGuestToSignUp(): void {
    if (typeof window === "undefined") return;
    const isFullAccount = isFullAccountUser(
      authState.isAuthenticated,
      authState.isAnonymous
    );
    if (isFullAccount) return;
    try {
      if (localStorage.getItem(GUEST_SAVE_NUDGE_SEEN_KEY) === "true") return;
      localStorage.setItem(GUEST_SAVE_NUDGE_SEEN_KEY, "true");
    } catch {
      return; // Private browsing — skip rather than nag every save.
    }
    toast.info(
      "Saved on this device. Create a free account to keep it anywhere.",
      6000
    );
  }

  getStepLabel(
    step: number,
    renderProgress?: { current: number; total: number }
  ): string {
    const labels: Record<number, string> = {
      1: "Creating thumbnail",
      2: "Saving locally",
      3: "Creating tags",
      4: "Syncing to cloud",
      5: "Refreshing library",
      6: "Complete",
    };

    // Dynamic label for step 1 with render progress
    // Uses "frame" instead of "beat" since total includes start position
    if (step === 1 && renderProgress && renderProgress.total > 0) {
      return `Rendering frame ${renderProgress.current} of ${renderProgress.total}`;
    }

    return labels[step] || "Processing...";
  }

  /**
   * Fire-and-forget Firestore sync. Runs after the local Dexie save succeeds,
   * so if this fails (e.g. offline) the sequence is already safe locally.
   */
  private async syncToFirestore(
    sequence: SequenceData,
    metadata: {
      name: string;
      displayName?: string;
      visibility: SequenceVisibility;
      tags: string[];
      notes: string;
      thumbnailUrl?: string;
    }
  ): Promise<void> {
    try {
      await this.libraryRepository.saveSequenceWithMetadata(sequence, metadata);
    } catch (error) {
      if (error instanceof LibraryError && error.code === "ALREADY_EXISTS") {
        toast.info("This exact sequence is already in your library.");
      } else {
        console.warn("[LibrarySaveService] Firestore sync failed (data safe in Dexie):", error);
      }
    }
  }

  /**
   * Generate thumbnail and upload to storage
   * Returns thumbnail URL or undefined if generation/upload fails
   */
  private async generateAndUploadThumbnail(
    sequence: SequenceData,
    emitProgress: (
      step: number,
      renderProgress?: { current: number; total: number }
    ) => void
  ): Promise<string | undefined> {
    if (!this.shareService || !this.uploadService) {
      console.warn(
        "[LibrarySaveService] Share or upload service not available, skipping thumbnail"
      );
      return undefined;
    }

    try {
      // Build the saved thumbnail through the one canonical card-render builder
      // (buildCardRenderOptions, via Sharer.getCardImageBlob) so the saved PNG
      // matches the viewer card AND the save-panel preview — prop type, QR,
      // mandala, LOOP glyph, columns, start-layout and footer all come from the
      // user's composition settings. The old path hand-built a ShareOptions
      // subset that dropped QR + mandala and never read the selected prop.
      const imageCompositionManager = getImageCompositionManager();
      const userName = authState.user?.displayName || "";

      const imageBlob = await this.shareService.getCardImageBlob(
        sequence,
        { darkMode: imageCompositionManager.darkMode, userName },
        (progress: { current: number; total: number; stage: string }) => {
          emitProgress(1, {
            current: progress.current,
            total: progress.total,
          });
        }
      );

      // Step 2: Upload thumbnail
      emitProgress(2);
      const uploadResult = await this.uploadService.uploadSequenceThumbnail(
        sequence.id,
        imageBlob,
        "png"
      );

      return uploadResult.url;
    } catch (error) {
      // Don't fail the entire save if thumbnail generation fails - show a warning instead
      console.error(
        "[LibrarySaveService] Failed to generate/upload thumbnail:",
        error
      );
      const errorHandler = getErrorHandler() as ErrorHandler;
      errorHandler.showUserError({
        message: "Sequence saved, but the thumbnail didn't generate",
        technicalDetails: error instanceof Error ? error.message : String(error),
        error: error instanceof Error ? error : new Error(String(error)),
        severity: "warning",
        context: {
          module: "library",
          action: "save-to-library",
        },
      });
      return undefined;
    }
  }

  /**
   * Create any new tags that don't exist in the system
   */
  private async createNewTags(tags: string[]): Promise<void> {
    if (tags.length === 0) {
      return;
    }

    try {
      for (const tagName of tags) {
        const normalized = tagName.toLowerCase().trim();
        const existing = await findTagByName(normalized);

        if (!existing) {
          // Create new tag with random color
          const randomColor =
            TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
          await createUserTag(normalized, { color: randomColor });
        }
      }
    } catch (error) {
      // Don't fail the save if tag creation fails
      console.error("[LibrarySaveService] Failed to create tags:", error);
    }
  }

  /**
   * Refresh library state after saving
   */
  private async refreshLibraryState(): Promise<void> {
    try {
      const { libraryState } =
        await import("$lib/features/library/state/library-state.svelte.ts");
      if (libraryState) {
        await libraryState.loadSequences();
      }
    } catch (error) {
      console.warn(
        "[LibrarySaveService] Could not refresh library state:",
        error
      );
    }
  }
}
