import { authState } from "$lib/shared/auth/state/auth-state.svelte";
import { getSettings } from "$lib/shared/application/state/app-state.svelte";
import { libraryState } from "$lib/features/library/state/library-state.svelte";
import { computeHash as computeSequenceHash } from "$lib/shared/library/services/sequence-content-hasher";
import { isEmptySequence, meetsCommunityMinimum, MIN_COMMUNITY_STEPS } from "$lib/shared/library/domain/sequence-min-length";
import type { ContentModerationResult } from "$lib/features/moderation/domain/models/content-moderation-models";
import type { ShameCategory } from "$lib/features/hall-of-shame/domain/models/hall-of-shame-models";
import type { HallOfShameSubmitter } from "$lib/features/hall-of-shame/services/hall-of-shame-submitter";
import type { LibrarySaveService } from "$lib/features/library/services/library-save-service";
import type { SaveProgress } from "$lib/shared/library/domain/library-contract-types";
import type { CreateModuleContext } from "../context/create-module-context";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";

type ContentModerator = { checkWord: (word: string) => ContentModerationResult };

export interface SavePanelDeps {
  ctx: CreateModuleContext;
  librarySaveService: LibrarySaveService | null;
  contentModerator: ContentModerator | null;
  hallOfShameSubmitter: HallOfShameSubmitter | null;
}

export interface SavePanelProps {
  show: boolean;
  word: string;
  showShareContext: boolean;
  onClose?: () => void;
  onSaveComplete?: (sequenceId: string) => void;
}

export function createSavePanelState(deps: SavePanelDeps) {
  const { ctx, librarySaveService, contentModerator, hallOfShameSubmitter } = deps;
  const { CreateModuleState } = ctx;
  const logger = createComponentLogger("SaveToLibraryPanel");

  // Save steps definition (static)
  const saveSteps = [
    { icon: "fa-image", label: "Creating thumbnail" },
    { icon: "fa-cloud-upload-alt", label: "Uploading preview" },
    { icon: "fa-tags", label: "Creating tags" },
    { icon: "fa-save", label: "Saving to library" },
    { icon: "fa-sync", label: "Syncing data" },
  ];

  const headerTitle = "Save to Library";

  // ---------------------------------------------------------------------------
  // Reactive state
  // ---------------------------------------------------------------------------

  let isOpen = $state(false);
  let isSaving = $state(false);
  let saveStep = $state(0);
  let renderProgress = $state({ current: 0, total: 0 });
  let publishToCommunity = $state(false);

  // Form state
  let notes = $state("");
  let showNotes = $state(false);

  // Responsive layout
  let panelWidth = $state(0);

  // Content moderation state
  let moderationResult = $state<ContentModerationResult | null>(null);
  let showAppealModal = $state(false);
  const savedSequenceIdForAppeal = $state<string | null>(null);

  // Hall of Shame state
  let showShameGate = $state(false);
  let isSubmittingToShame = $state(false);
  let shameSubmitError = $state<string | null>(null);

  // Exact duplicate
  let isExactDuplicate = $state(false);

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const isBottomSheet = $derived(!ctx.layout.shouldUseSideBySideLayout);

  const activeSequenceState = $derived.by(() =>
    CreateModuleState.getActiveTabSequenceState(),
  );
  const sequence = $derived.by(() => activeSequenceState.currentSequence);

  const isMobileLayout = $derived(panelWidth < 640);

  const currentUser = $derived(authState.user);
  const creatorName = $derived(
    currentUser?.displayName || currentUser?.email || "Anonymous",
  );
  const darkMode = $derived(getSettings().darkMode ?? false);

  const isFlagged = $derived(moderationResult !== null && !moderationResult.isAllowed);

  // Dynamic label for step 1 showing render progress
  const step1Label = $derived(
    saveStep === 1 && renderProgress.total > 0
      ? `Rendering frame ${renderProgress.current} of ${renderProgress.total}`
      : "Creating thumbnail",
  );

  // Props getter — allows the component to bind its reactive props into this factory.
  // Declared early because tkaName (and downstream deriveds) depend on it.
  let _propsGetter: () => SavePanelProps = () => ({
    show: false,
    word: "",
    showShareContext: false,
  });

  // Derive TKA name from word prop, sequence word, or compute from beat letters.
  const derivedWord = $derived.by(() => {
    const props = _propsGetter();
    if (props.word) return props.word;
    if (sequence?.word) return sequence.word;

    if (sequence?.steps && sequence.steps.length > 0) {
      const letters = sequence.steps
        .map((step) => step?.letter || "")
        .filter(Boolean)
        .join("");
      return letters || "";
    }

    return "";
  });

  const tkaName = $derived(derivedWord);

  // Duplicate detection
  const duplicateCheck = $derived.by(() => {
    if (!tkaName || !isOpen) return { hasDuplicate: false, existingSequences: [] as unknown[] };
    return libraryState.checkForDuplicate(tkaName);
  });
  const hasDuplicate = $derived(duplicateCheck.hasDuplicate);
  const duplicateCount = $derived(duplicateCheck.existingSequences.length);

  // Saved version of this sequence in library
  const savedSequence = $derived.by(() => {
    const id = sequence?.id;
    if (!id) return null;
    return libraryState.getSequenceById(id) ?? null;
  });

  const isAlreadyPublished = $derived(savedSequence?.visibility === "public");

  // Only a truly empty (0-step) sequence is too short to save. A 1-count is a
  // valid personal-library entry.
  const isTooShort = $derived(!!sequence && isEmptySequence(sequence));

  // The community gallery requires MIN_COMMUNITY_STEPS. Under that, the Make
  // Public toggle is disabled with a note — the sequence still saves to the
  // personal library. (Repository + syncer enforce the same floor as a backstop.)
  const canPublishToCommunity = $derived(!!sequence && meetsCommunityMinimum(sequence));

  const canSave = $derived(
    !!tkaName && !isSaving && !isFlagged && !isExactDuplicate && !isTooShort,
  );

  // ---------------------------------------------------------------------------
  // Data-logic effects (no DOM references)
  // ---------------------------------------------------------------------------

  // Sync isOpen with show prop
  $effect(() => {
    isOpen = _propsGetter().show;
  });

  // Default the community toggle to match the current published state when panel opens
  $effect(() => {
    if (_propsGetter().show) {
      publishToCommunity = isAlreadyPublished && canPublishToCommunity;
    }
  });

  // Clamp: never leave the toggle on for a sequence that can't be published
  // (e.g. the user removed steps after toggling it on).
  $effect(() => {
    if (!canPublishToCommunity && publishToCommunity) {
      publishToCommunity = false;
    }
  });

  // Run content moderation when tkaName changes
  $effect(() => {
    if (tkaName && contentModerator && _propsGetter().show) {
      moderationResult = contentModerator.checkWord(tkaName);
    } else {
      moderationResult = null;
    }
  });

  // Reset form when sequence changes or panel opens
  $effect(() => {
    if (sequence && _propsGetter().show) {
      notes = "";
      showNotes = false;
    }
  });

  // Eagerly load library sequences when panel opens so duplicate detection works
  $effect(() => {
    if (_propsGetter().show && authState.user) {
      libraryState.loadSequences();
    }
  });

  // Exact duplicate detection (async hash comparison)
  $effect(() => {
    const show = _propsGetter().show;
    if (!show || !sequence) {
      isExactDuplicate = false;
      return;
    }

    let cancelled = false;
    computeSequenceHash(sequence).then((hash) => {
      if (cancelled) return;
      const match = libraryState.findByContentHash(hash);
      isExactDuplicate = !!match && match.id !== sequence.id;
    });

    return () => {
      cancelled = true;
    };
  });

  // ---------------------------------------------------------------------------
  // Action handlers
  // ---------------------------------------------------------------------------

  async function handleSave() {
    const props = _propsGetter();
    if (!tkaName || !sequence) return;
    if (!librarySaveService) {
      logger.error("LibrarySaveService not available");
      return;
    }

    isSaving = true;
    saveStep = 1;
    renderProgress = { current: 0, total: 0 };

    try {
      logger.info("Saving sequence to library...", {
        stepCount: sequence.steps.length,
        tkaName,
      });

      const result = await librarySaveService.saveSequence(
        sequence,
        {
          name: tkaName,
          visibility: publishToCommunity && !isFlagged ? "public" : "private",
          tags: [],
          notes: notes.trim(),
        },
        (progress: SaveProgress) => {
          saveStep = progress.step;
          if (progress.renderProgress) {
            renderProgress = progress.renderProgress;
          }
        },
      );

      logger.success("Sequence saved to library with ID:", result.sequenceId);

      if (ctx.sessionManager) {
        await ctx.sessionManager.markAsSaved(result.sequenceId);
      }

      props.onSaveComplete?.(result.sequenceId);
      handleClose();
    } catch (error) {
      logger.error("Failed to save sequence:", error);
      saveStep = 0;
    } finally {
      isSaving = false;
      saveStep = 0;
    }
  }

  function handleClose() {
    isOpen = false;
    _propsGetter().onClose?.();
  }

  function handleOpenAppeal() {
    showAppealModal = true;
  }

  function handleCloseAppeal() {
    showAppealModal = false;
  }

  function handleAppealSubmitted() {
    showAppealModal = false;
  }

  function handleSubmitToShame() {
    showShameGate = true;
  }

  async function handleShameVerified() {
    showShameGate = false;

    if (!sequence || !tkaName || !currentUser) {
      shameSubmitError = "Missing required data for submission.";
      return;
    }

    if (!hallOfShameSubmitter) {
      shameSubmitError = "Hall of Shame service unavailable.";
      return;
    }

    isSubmittingToShame = true;
    shameSubmitError = null;

    try {
      const flaggedCategories =
        moderationResult?.flaggedTerms?.map((t) => t.category) || [];
      const category: ShameCategory = flaggedCategories.includes("sexual")
        ? "sexual"
        : flaggedCategories.includes("profanity")
          ? "profanity"
          : "creative";

      await hallOfShameSubmitter.submit({
        sourceSequenceId: sequence.id || `temp-${Date.now()}`,
        userId: currentUser.uid,
        word: tkaName,
        thumbnails: [...(sequence.thumbnails || [])],
        sequenceLength: sequence.steps?.length || 0,
        flaggedTerms: moderationResult?.flaggedTerms || [],
        category,
        displayName: sequence.displayName,
        difficulty: sequence.level,
      });

      logger.success("Submitted to Hall of Shame successfully");
      handleClose();
    } catch (error) {
      logger.error("Failed to submit to Hall of Shame:", error);
      shameSubmitError =
        error instanceof Error
          ? error.message
          : "Failed to submit. Please try again.";
    } finally {
      isSubmittingToShame = false;
    }
  }

  function handleShameCanceled() {
    showShameGate = false;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  return {
    // Static data
    saveSteps,
    headerTitle,

    // Read props reactively (call from component to bind props)
    setPropsGetter(getter: () => SavePanelProps) {
      _propsGetter = getter;
    },

    // Mutable state (getters + setters where component needs write access)
    get isOpen() { return isOpen; },
    set isOpen(v: boolean) { isOpen = v; },

    get isSaving() { return isSaving; },

    get saveStep() { return saveStep; },

    get renderProgress() { return renderProgress; },

    get publishToCommunity() { return publishToCommunity; },
    set publishToCommunity(v: boolean) { publishToCommunity = v; },

    get notes() { return notes; },
    set notes(v: string) { notes = v; },

    get showNotes() { return showNotes; },
    set showNotes(v: boolean) { showNotes = v; },

    get panelWidth() { return panelWidth; },
    set panelWidth(v: number) { panelWidth = v; },

    get moderationResult() { return moderationResult; },

    get showAppealModal() { return showAppealModal; },
    set showAppealModal(v: boolean) { showAppealModal = v; },

    get savedSequenceIdForAppeal() { return savedSequenceIdForAppeal; },

    get showShameGate() { return showShameGate; },

    get isSubmittingToShame() { return isSubmittingToShame; },

    get shameSubmitError() { return shameSubmitError; },

    get isExactDuplicate() { return isExactDuplicate; },

    // Derived values (read-only)
    get isBottomSheet() { return isBottomSheet; },
    get sequence() { return sequence; },
    get isMobileLayout() { return isMobileLayout; },
    get currentUser() { return currentUser; },
    get creatorName() { return creatorName; },
    get darkMode() { return darkMode; },
    get isFlagged() { return isFlagged; },
    get step1Label() { return step1Label; },
    get hasDuplicate() { return hasDuplicate; },
    get duplicateCount() { return duplicateCount; },
    get isAlreadyPublished() { return isAlreadyPublished; },
    get canPublishToCommunity() { return canPublishToCommunity; },
    get communityMinSteps() { return MIN_COMMUNITY_STEPS; },
    get canSave() { return canSave; },
    get tkaName() { return tkaName; },

    // Action handlers
    handleSave,
    handleClose,
    handleOpenAppeal,
    handleCloseAppeal,
    handleAppealSubmitted,
    handleSubmitToShame,
    handleShameVerified,
    handleShameCanceled,
  };
}

export type SavePanelState = ReturnType<typeof createSavePanelState>;
