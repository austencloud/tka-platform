<!--
  SaveToLibraryPanel.svelte

  Side panel (desktop) / bottom sheet (mobile) for saving sequences to library.
  Uses CreatePanelDrawer for responsive layout matching other Create panels.
-->
<script lang="ts" module>
  export interface SaveMetadata {
    name: string;
    tags: string[];
    collectionIds: string[];
    notes: string;
  }
</script>

<script lang="ts">
  import CreatePanelDrawer from "./CreatePanelDrawer.svelte";
  import SheetDragHandle from "$lib/shared/foundation/ui/SheetDragHandle.svelte";
  import TagAutocompleteInput from "$lib/features/library/components/tags/TagAutocompleteInput.svelte";
  import SaveProgressOverlay from "$lib/features/library/components/SaveProgressOverlay.svelte";
  import ExpandableField from "$lib/features/library/components/ExpandableField.svelte";
  import ContentAppealModal from "$lib/features/moderation/components/ContentAppealModal.svelte";
  import HallOfShameGate from "$lib/features/hall-of-shame/components/HallOfShameGate.svelte";
  import type { IHallOfShameSubmitter } from "$lib/features/hall-of-shame/services/contracts/IHallOfShameSubmitter";
  import type { ShameCategory } from "$lib/features/hall-of-shame/domain/models/hall-of-shame-models";
  import { authState } from "$lib/shared/auth/state/authState.svelte";
  import { getCreateModuleContext } from "../context/create-module-context";
  import { createComponentLogger } from "$lib/shared/utils/debug-logger";
  import { container } from "$lib/shared/di";
  import type { ILibrarySaveService } from "$lib/features/library/services/contracts/ILibrarySaveService";
  import type { IContentModerator } from "$lib/features/moderation/services/contracts/IContentModerator";
  import type { ContentModerationResult } from "$lib/features/moderation/domain/models/content-moderation-models";
  import { simplifyAndTruncate } from "../workspace-panel/shared/utils/word-simplifier";
  import { libraryState } from "$lib/features/library/state/library-state.svelte";

  interface Props {
    show: boolean;
    word?: string;
    /** When true, shows context that saving is needed before sharing */
    showShareContext?: boolean;
    onClose?: () => void;
    onSaveComplete?: (sequenceId: string) => void;
  }

  let {
    show,
    word = "",
    showShareContext = false,
    onClose,
    onSaveComplete,
  }: Props = $props();

  const logger = createComponentLogger("SaveToLibraryPanel");

  // Context
  const ctx = getCreateModuleContext();
  const { CreateModuleState } = ctx;

  // Get current sequence
  // Use $derived.by() to ensure reactive property tracking through function calls
  const activeSequenceState = $derived.by(() =>
    CreateModuleState.getActiveTabSequenceState()
  );
  const sequence = $derived.by(() => activeSequenceState.currentSequence);

  // Local state - initialized with default, $effect below syncs from prop
  let isOpen = $state(false);
  let isSaving = $state(false);
  let saveStep = $state(0);
  let renderProgress = $state({ current: 0, total: 0 });

  // Get the save service
  let librarySaveService: ILibrarySaveService | null = null;
  try {
    librarySaveService = container.items.librarySaveService;
  } catch (error) {
    console.warn("Failed to resolve librarySaveService:", error);
  }

  // Get the content moderator
  let contentModerator: IContentModerator | null = null;
  try {
    contentModerator = container.items.contentModerator;
  } catch (error) {
    console.warn("Failed to resolve contentModerator:", error);
  }

  // Save steps definition
  const saveSteps = [
    { icon: "fa-image", label: "Creating thumbnail" },
    { icon: "fa-cloud-upload-alt", label: "Uploading preview" },
    { icon: "fa-tags", label: "Creating tags" },
    { icon: "fa-save", label: "Saving to library" },
    { icon: "fa-sync", label: "Syncing data" },
  ];

  // Dynamic label for step 1 showing render progress
  // Uses "frame" instead of "beat" since total includes start position
  const step1Label = $derived(
    saveStep === 1 && renderProgress.total > 0
      ? `Rendering frame ${renderProgress.current} of ${renderProgress.total}`
      : "Creating thumbnail"
  );

  // Form state
  let customDisplayName = $state("");
  let tags = $state<string[]>([]);
  let notes = $state("");
  let tagResetTrigger = $state(0);

  // Expandable sections
  let showDisplayName = $state(false);
  let showNotes = $state(false);
  let showTags = $state(false);

  // Content moderation state
  let moderationResult = $state<ContentModerationResult | null>(null);
  let showAppealModal = $state(false);
  let savedSequenceIdForAppeal = $state<string | null>(null);

  // Hall of Shame state
  let showShameGate = $state(false);
  let isSubmittingToShame = $state(false);
  let shameSubmitError = $state<string | null>(null);

  // Get the Hall of Shame submitter
  let hallOfShameSubmitter: IHallOfShameSubmitter | null = null;
  try {
    hallOfShameSubmitter = container.items.hallOfShameSubmitter;
  } catch (error) {
    console.warn("Failed to resolve hallOfShameSubmitter:", error);
  }

  // Derive TKA name from word prop, sequence word, or compute from beat letters
  const derivedWord = $derived.by(() => {
    // First try props and sequence.word
    if (word) return word;
    if (sequence?.word) return sequence.word;

    // If no word available, derive from beat letters
    if (sequence?.steps && sequence.steps.length > 0) {
      const letters = sequence.steps
        .map((beat) => beat?.letter || "")
        .filter(Boolean)
        .join("");
      return letters || "";
    }

    return "";
  });

  const tkaName = $derived(derivedWord);
  const displayTkaName = $derived(simplifyAndTruncate(tkaName, 8));
  const currentUser = $derived(authState.user);
  const creatorName = $derived(
    currentUser?.displayName || currentUser?.email || "Anonymous"
  );

  // Check content moderation when word changes
  const isFlagged = $derived(moderationResult !== null && !moderationResult.isAllowed);

  // Duplicate detection - check if this word already exists in library
  const duplicateCheck = $derived.by(() => {
    if (!tkaName || !show) return { hasDuplicate: false, existingSequences: [] };
    return libraryState.checkForDuplicate(tkaName);
  });
  const hasDuplicate = $derived(duplicateCheck.hasDuplicate);
  const duplicateCount = $derived(duplicateCheck.existingSequences.length);
  let acknowledgedDuplicate = $state(false);

  // Dynamic header content based on context
  const headerTitle = $derived(
    showShareContext ? "Add to Gallery" : "Add to Gallery"
  );
  const headerSubtitle = $derived(
    showShareContext
      ? "Add your sequence to the gallery to share it"
      : "Publish this sequence to the gallery"
  );

  // Sync isOpen with show prop
  $effect(() => {
    isOpen = show;
  });

  // Run content moderation when tkaName changes
  $effect(() => {
    if (tkaName && contentModerator && show) {
      moderationResult = contentModerator.checkWord(tkaName);
    } else {
      moderationResult = null;
    }
  });

  // Reset form when sequence changes or panel opens
  $effect(() => {
    if (sequence && show) {
      customDisplayName = sequence.displayName || "";
      tags = [];
      notes = "";
      showDisplayName = !!sequence.displayName;
      showNotes = false;
      showTags = false;
      acknowledgedDuplicate = false; // Reset duplicate acknowledgment
    }
  });

  function handleTagsChange(newTags: string[]) {
    tags = newTags;
  }

  async function handleSave() {
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
        customDisplayName: customDisplayName.trim() || "(none)",
      });

      const result = await librarySaveService.saveSequence(
        sequence,
        {
          name: tkaName,
          displayName: customDisplayName.trim() || undefined,
          visibility: "public", // All sequences are public
          tags,
          notes: notes.trim(),
        },
        (progress) => {
          saveStep = progress.step;
          if (progress.renderProgress) {
            renderProgress = progress.renderProgress;
          }
        }
      );

      logger.success("Sequence saved to library with ID:", result.sequenceId);

      if (ctx.sessionManager) {
        await ctx.sessionManager.markAsSaved(result.sequenceId);
      }

      onSaveComplete?.(result.sequenceId);
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
    tagResetTrigger++;
    isOpen = false;
    onClose?.();
  }

  function handleOpenAppeal() {
    showAppealModal = true;
  }

  function handleCloseAppeal() {
    showAppealModal = false;
  }

  function handleAppealSubmitted() {
    // Appeal was submitted - could show a success message
    // For now, just close the appeal modal
    showAppealModal = false;
  }

  function handleSubmitToShame() {
    // Show the age verification gate first
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
      // Derive category from flagged terms
      const flaggedCategories = moderationResult?.flaggedTerms?.map(t => t.category) || [];
      const category: ShameCategory = flaggedCategories.includes('sexual') ? 'sexual'
        : flaggedCategories.includes('profanity') ? 'profanity'
        : 'creative';

      await hallOfShameSubmitter.submit({
        sourceSequenceId: sequence.id || `temp-${Date.now()}`,
        userId: currentUser.uid,
        word: tkaName,
        thumbnails: sequence.thumbnails || [],
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
      shameSubmitError = error instanceof Error ? error.message : "Failed to submit. Please try again.";
    } finally {
      isSubmittingToShame = false;
    }
  }

  function handleShameCanceled() {
    showShameGate = false;
  }
</script>

<CreatePanelDrawer
  bind:isOpen
  panelName="save-library"
  fullHeightOnMobile={true}
  showHandle={true}
  closeOnBackdrop={true}
  onClose={handleClose}
  ariaLabel="Add to Gallery"
>
  <div class="panel-inner">
    <SheetDragHandle />

    {#if isSaving}
      <SaveProgressOverlay
        currentStep={saveStep}
        steps={saveSteps}
        {renderProgress}
        {step1Label}
      />
    {/if}

    <button
      class="close-button"
      onclick={handleClose}
      aria-label="Close panel"
      disabled={isSaving}
    >
      <i class="fas fa-times" aria-hidden="true"></i>
    </button>

    <div class="panel-header">
      <h2>{headerTitle}</h2>
      <p class="subtitle">{headerSubtitle}</p>
    </div>

    <div class="panel-body">
      <!-- TKA Name (read-only) -->
      <div class="form-group">
        <span class="form-label">TKA Name</span>
        <div class="tka-name-display">
          <span class="tka-badge">{displayTkaName || "..."}</span>
          <span class="tka-hint">Auto-generated from sequence letters</span>
        </div>
      </div>

      <!-- Content Moderation Warning -->
      {#if isFlagged && moderationResult}
        <div class="moderation-warning">
          <div class="warning-header">
            <i class="fas fa-shield-alt" aria-hidden="true"></i>
            <span>Content flagged by moderation</span>
          </div>
          <p class="warning-text">
            This sequence contains content that cannot be published to the public gallery.
            You can still save it privately or share via link.
          </p>
          <div class="flagged-terms">
            {#each moderationResult.flaggedTerms as term}
              <span class="flagged-term">
                {term.category}: "{term.matchedPattern}"
              </span>
            {/each}
          </div>
          <div class="moderation-actions">
            <button
              type="button"
              class="appeal-button"
              onclick={handleOpenAppeal}
            >
              <i class="fas fa-gavel" aria-hidden="true"></i>
              Appeal
            </button>
            <button
              type="button"
              class="shame-button"
              onclick={handleSubmitToShame}
              disabled={isSubmittingToShame}
            >
              {#if isSubmittingToShame}
                <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
                Submitting...
              {:else}
                <i class="fas fa-skull" aria-hidden="true"></i>
                Hall of Shame
              {/if}
            </button>
          </div>
          {#if shameSubmitError}
            <div class="shame-error" role="alert">
              <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
              <span>{shameSubmitError}</span>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Duplicate Warning -->
      {#if hasDuplicate && !isFlagged}
        <div class="duplicate-warning">
          <div class="warning-header">
            <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
            <span>
              {duplicateCount === 1
                ? "You already have a sequence with this name"
                : `You have ${duplicateCount} sequences with this name`}
            </span>
          </div>
          <p class="warning-text">
            Saving will create another variation. Consider using a unique display name to differentiate.
          </p>
          <label class="acknowledge-checkbox">
            <input
              type="checkbox"
              bind:checked={acknowledgedDuplicate}
            />
            <span>I understand, save as a new variation</span>
          </label>
        </div>
      {/if}

      <!-- Creator Attribution -->
      <div class="creator-section">
        <i class="fas fa-user" aria-hidden="true"></i>
        <span>By {creatorName}</span>
      </div>

      <!-- Optional Fields -->
      <div class="optional-section">
        <ExpandableField
          label="Display Name"
          expanded={showDisplayName}
          onExpandedChange={(v) => (showDisplayName = v)}
          onCollapse={() => (customDisplayName = "")}
        >
          <input
            id="display-name"
            type="text"
            bind:value={customDisplayName}
            placeholder="e.g., Fire Spin Intro"
            class="input-field"
            maxlength="100"
          />
        </ExpandableField>

        <ExpandableField
          label="Tags"
          expanded={showTags}
          onExpandedChange={(v) => (showTags = v)}
          onCollapse={() => {
            tags = [];
            tagResetTrigger++;
          }}
        >
          <TagAutocompleteInput
            selectedTags={tags}
            onTagsChange={handleTagsChange}
            placeholder="Search or create tags..."
            maxTags={10}
            resetTrigger={tagResetTrigger}
          />
        </ExpandableField>

        <ExpandableField
          label="Notes"
          expanded={showNotes}
          onExpandedChange={(v) => (showNotes = v)}
          onCollapse={() => (notes = "")}
        >
          <textarea
            id="notes"
            bind:value={notes}
            placeholder="Add personal notes about this sequence"
            class="textarea-field"
            rows="3"
            maxlength="500"
          ></textarea>
        </ExpandableField>
      </div>
    </div>

    <div class="panel-footer">
      <button
        type="button"
        class="button button-secondary"
        onclick={handleClose}
      >
        Cancel
      </button>
      <button
        type="button"
        class="button button-primary"
        onclick={handleSave}
        disabled={!tkaName || isSaving || (hasDuplicate && !acknowledgedDuplicate) || isFlagged}
      >
        {#if isSaving}
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          Publishing...
        {:else if isFlagged}
          <i class="fas fa-ban" aria-hidden="true"></i>
          Cannot Publish
        {:else}
          <i class="fas fa-globe" aria-hidden="true"></i>
          Add to Gallery
        {/if}
      </button>
    </div>
  </div>
</CreatePanelDrawer>

<!-- Content Appeal Modal -->
{#if showAppealModal && moderationResult && tkaName}
  <ContentAppealModal
    word={tkaName}
    contentId={savedSequenceIdForAppeal || "pending"}
    contentType="sequence"
    flaggedTerms={moderationResult.flaggedTerms}
    onClose={handleCloseAppeal}
    onAppealSubmitted={handleAppealSubmitted}
  />
{/if}

<!-- Hall of Shame Age Gate -->
{#if showShameGate}
  <HallOfShameGate
    onVerified={handleShameVerified}
    onCancel={handleShameCanceled}
  />
{/if}

<style>
  .panel-inner {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    padding-bottom: env(safe-area-inset-bottom);
    overflow: hidden;
  }

  .close-button {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 48px;
    height: 48px;
    border: none;
    border-radius: 50%;
    background: var(--theme-card-bg);
    color: var(--theme-text);
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-base);
    z-index: 10;
  }

  .close-button:hover {
    background: var(--theme-card-hover-bg);
    transform: scale(1.05);
  }

  .close-button:active {
    transform: scale(0.95);
  }

  .close-button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
    pointer-events: none;
  }

  /* Header - compact, informational */
  .panel-header {
    padding: 32px 32px 24px;
    flex-shrink: 0;
    text-align: center;
  }

  .panel-header h2 {
    margin: 0;
    font-size: var(--font-size-2xl, 1.5rem);
    font-weight: 600;
    color: var(--theme-text);
  }

  .subtitle {
    margin: 8px 0 0;
    font-size: var(--font-size-base, 16px);
    color: var(--theme-text-dim);
    line-height: 1.5;
  }

  /* Body - uses flex to distribute space and center content */
  .panel-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center; /* Vertical centering */
    padding: 24px 32px;
    overflow-y: auto;
    overscroll-behavior: contain;
    gap: 32px;
  }

  /* TKA Name - the hero element, draws the eye */
  .form-group {
    margin: 0;
  }

  .form-label {
    display: block;
    margin-bottom: 12px;
    font-size: var(--font-size-base, 16px);
    font-weight: 600;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 1.5px;
    text-align: center;
  }

  .tka-name-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 32px 24px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 16px;
  }

  .tka-badge {
    font-size: clamp(2rem, 8vw, 3rem);
    font-weight: 700;
    color: var(--theme-text);
    letter-spacing: 2px;
    font-family: var(--font-mono, monospace);
    text-align: center;
    word-break: break-all;
  }

  .tka-hint {
    font-size: var(--font-size-base, 16px);
    color: var(--theme-text-dim);
    text-align: center;
  }

  /* Content Moderation Warning */
  .moderation-warning {
    padding: 16px;
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 15%, transparent);
    border: 1.5px solid color-mix(in srgb, var(--semantic-error, #ef4444) 40%, transparent);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .moderation-warning .warning-header {
    color: var(--semantic-error, #ef4444);
  }

  .flagged-terms {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .flagged-term {
    padding: 4px 10px;
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 20%, transparent);
    border-radius: 6px;
    font-size: var(--font-size-compact, 12px);
    font-family: var(--font-mono, monospace);
    color: var(--theme-text-dim);
  }

  .moderation-actions {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }

  .appeal-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: transparent;
    border: 1.5px solid color-mix(in srgb, var(--semantic-error, #ef4444) 50%, transparent);
    border-radius: 8px;
    color: var(--theme-text);
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .appeal-button:hover {
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 15%, transparent);
    border-color: var(--semantic-error, #ef4444);
  }

  .appeal-button i {
    color: var(--semantic-error, #ef4444);
  }

  .shame-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 20%, transparent);
    border: 1.5px solid color-mix(in srgb, var(--semantic-error, #ef4444) 50%, transparent);
    border-radius: 8px;
    color: var(--theme-text);
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
  }

  .shame-button:hover:not(:disabled) {
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 30%, transparent);
    border-color: var(--semantic-error, #ef4444);
  }

  .shame-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .shame-button i {
    color: var(--semantic-error, #ef4444);
  }

  .shame-error {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    font-size: var(--font-size-sm, 14px);
    color: #fca5a5;
  }

  .shame-error i {
    color: var(--semantic-error, #ef4444);
  }

  /* Duplicate Warning */
  .duplicate-warning {
    padding: 16px;
    background: color-mix(in srgb, var(--semantic-warning) 15%, transparent);
    border: 1.5px solid color-mix(in srgb, var(--semantic-warning) 40%, transparent);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .warning-header {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--semantic-warning, #f59e0b);
    font-weight: 600;
    font-size: var(--font-size-base, 16px);
  }

  .warning-header i {
    font-size: 1.2em;
  }

  .warning-text {
    margin: 0;
    color: var(--theme-text-dim);
    font-size: var(--font-size-sm, 14px);
    line-height: 1.5;
  }

  .acknowledge-checkbox {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text);
    padding: 8px 0;
  }

  .acknowledge-checkbox input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: var(--semantic-warning, #f59e0b);
  }

  .acknowledge-checkbox span {
    flex: 1;
  }

  /* Creator Attribution */
  .creator-section {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: var(--theme-text-dim);
    font-size: var(--font-size-base, 16px);
  }

  .creator-section i {
    opacity: 0.6;
  }

  /* Optional fields - secondary, collapsed by default */
  .optional-section {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  }

  .input-field,
  .textarea-field {
    width: 100%;
    padding: 14px 18px;
    background: var(--theme-card-bg);
    border: 1.5px solid var(--theme-stroke);
    border-radius: 12px;
    color: var(--theme-text);
    font-size: var(--font-size-base, 16px);
    font-family: inherit;
    transition: all var(--duration-normal) ease;
    box-sizing: border-box;
  }

  .input-field:focus,
  .textarea-field:focus {
    outline: none;
    background: var(--theme-card-hover-bg, var(--theme-card-bg));
    border-color: color-mix(in srgb, var(--theme-accent) 50%, transparent);
    box-shadow: 0 0 0 3px
      color-mix(in srgb, var(--theme-accent) 15%, transparent);
  }

  .input-field::placeholder,
  .textarea-field::placeholder {
    color: color-mix(in srgb, var(--theme-text-dim) 70%, transparent);
  }

  .textarea-field {
    resize: vertical;
    min-height: 80px;
  }

  /* Footer - anchored at bottom with breathing room */
  .panel-footer {
    display: flex;
    gap: 12px;
    padding: 24px 32px;
    flex-shrink: 0;
  }

  .button {
    flex: 1;
    min-height: 56px; /* Slightly larger for prominence */
    padding: 16px 24px;
    border: none;
    border-radius: 14px;
    font-size: var(--font-size-lg, 18px);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }

  .button-secondary {
    background: var(--theme-card-bg);
    color: var(--theme-text-dim);
    border: 1.5px solid var(--theme-stroke);
  }

  .button-secondary:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text);
  }

  .button-primary {
    background: linear-gradient(
      135deg,
      var(--theme-accent-strong) 0%,
      color-mix(in srgb, var(--theme-accent-strong) 80%, #000) 100%
    );
    color: white;
    box-shadow: 0 6px 20px
      color-mix(in srgb, var(--theme-accent-strong) 50%, transparent);
  }

  .button-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px
      color-mix(in srgb, var(--theme-accent-strong) 60%, transparent);
  }

  .button-primary:active:not(:disabled) {
    transform: translateY(0);
  }

  .button-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  /* Mobile adjustments */
  @media (max-width: 640px) {
    .panel-header {
      padding: 24px 24px 16px;
    }

    .panel-header h2 {
      font-size: var(--font-size-xl, 1.25rem);
    }

    .panel-body {
      padding: 20px 24px;
      gap: 24px;
    }

    .tka-name-display {
      padding: 24px 20px;
    }

    .panel-footer {
      padding: 20px 24px;
    }

    .button {
      min-height: 52px;
      font-size: var(--font-size-base, 16px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .button,
    .input-field,
    .textarea-field,
    .close-button {
      transition: none;
    }
  }
</style>
