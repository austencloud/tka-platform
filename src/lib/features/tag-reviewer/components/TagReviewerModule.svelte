<!--
  Tag Reviewer Module

  Main component for reviewing and managing auto-generated tags.
  Uses shared sequence-review primitives.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { container } from "$lib/shared/di";
  import type { IStepDataConverter } from "$lib/features/loop-labeler/services/contracts/IStepDataConverter";
  import { tagReviewerState } from "../state/tag-reviewer-state.svelte";

  // Shared components
  import SequenceBrowserSidebar from "$lib/shared/sequence-review/components/SequenceBrowserSidebar.svelte";
  import SequencePreviewPanel from "$lib/shared/sequence-review/components/SequencePreviewPanel.svelte";
  import ReviewNavigationBar from "$lib/shared/sequence-review/components/ReviewNavigationBar.svelte";
  import ReviewHeader from "$lib/shared/sequence-review/components/ReviewHeader.svelte";
  import NotesInput from "$lib/shared/sequence-review/components/NotesInput.svelte";
  import type {
    FilterOption,
    ReviewStatus,
    BaseSequenceEntry,
  } from "$lib/shared/sequence-review/domain/models/review-models";

  // Tag-specific components
  import TagSuggestionPanel from "./TagSuggestionPanel.svelte";
  import type { TaggedSequenceEntry } from "../domain/models/tag-review-models";

  // Lifecycle
  let isReady = $state(false);
  let showStartPosition = $state(true);
  let manualColumnCount = $state<number | null>(null);
  let copiedToast = $state(false);

  // Generate tags when current sequence changes
  $effect(() => {
    if (isReady && tagReviewerState.currentSequence) {
      tagReviewerState.ensureTagsGenerated();
    }
  });

  // Copy sequence data for AI review
  function handleCopyForReview() {
    const seq = tagReviewerState.currentSequence;
    const review = tagReviewerState.currentReview;
    if (!seq) return;

    // Build a comprehensive summary for AI review
    const summary = {
      // Sequence metadata
      sequence: {
        word: seq.word,
        gridMode: seq.gridMode,
        isCircular: seq.isCircular,
        sequenceLength: seq.sequenceLength,
        loopType: seq.loopType,
      },
      // Tag review status
      tagReview: {
        suggestedTags:
          review?.suggestedTags.map((tag) => ({
            tag: tag.tag,
            category: tag.category,
            confidence: Math.round(tag.confidence * 100) + "%",
            reason: tag.reason,
            status: tag.reviewState,
          })) ?? [],
        customTags: review?.customTags ?? [],
        isFullyReviewed: review?.isFullyReviewed ?? false,
      },
      // Current notes
      notes: tagReviewerState.notes || "(no notes)",
      // Raw beat data for context
      steps: seq.fullMetadata?.sequence ?? [],
    };

    const text = `## Tag Review: "${seq.word}"

### Sequence Info
- **Word:** ${seq.word}
- **Grid Mode:** ${seq.gridMode}
- **Circular:** ${seq.isCircular}
- **Length:** ${seq.sequenceLength} steps
- **LOOP Type:** ${seq.loopType ?? "not labeled"}

### Suggested Tags
${
  review?.suggestedTags
    .map(
      (t) =>
        `- [${t.reviewState.toUpperCase()}] **${t.tag}** (${t.category}, ${Math.round(t.confidence * 100)}%)${t.reason ? ` - ${t.reason}` : ""}`
    )
    .join("\n") || "(none)"
}

### Custom Tags
${review?.customTags.length ? review.customTags.map((t) => `- ${t}`).join("\n") : "(none)"}

### Notes
${tagReviewerState.notes || "(no notes)"}

### Raw Data
\`\`\`json
${JSON.stringify(summary, null, 2)}
\`\`\`
`;

    navigator.clipboard.writeText(text).then(() => {
      copiedToast = true;
      setTimeout(() => {
        copiedToast = false;
      }, 2000);
    });
  }

  onMount(() => {
    (async () => {
      // Services available synchronously via ITI
      await tagReviewerState.initialize();
      isReady = true;
    })();

    return () => {
      tagReviewerState.dispose();
    };
  });

  // Services for beat parsing
  const conversionService = $derived(
    container.items.stepDataConverter as IStepDataConverter | null
  );

  // Parse steps for current sequence
  const parsedData = $derived.by(() => {
    const seq = tagReviewerState.currentSequence;
    if (!seq?.fullMetadata?.sequence || !conversionService) {
      return { steps: [], startPosition: null };
    }

    const gridMode = conversionService.getAuthoritativeGridMode(seq as any);
    return conversionService.convertRawToBeats(
      seq.word,
      seq.fullMetadata.sequence as any[],
      gridMode
    );
  });

  // Filter options
  const filterOptions: FilterOption[] = [
    { id: "all", label: "All", icon: "layer-group" },
    { id: "pending", label: "Pending", icon: "clock" },
    { id: "reviewed", label: "Reviewed", icon: "circle-check" },
    { id: "hasRejected", label: "Has Rejected", icon: "circle-xmark" },
  ];

  // Get status for sidebar
  function getStatus(seq: BaseSequenceEntry): ReviewStatus {
    const review = tagReviewerState.reviews.get(seq.word);

    if (!review) {
      return { type: "unreviewed", icon: "circle", color: "#6b7280" };
    }

    if (review.isFullyReviewed) {
      const hasRejected = review.suggestedTags.some(
        (t) => t.reviewState === "rejected"
      );
      if (hasRejected) {
        return {
          type: "hasRejected",
          icon: "circle-exclamation",
          color: "#eab308",
        };
      }
      return {
        type: "reviewed",
        icon: "circle-check",
        color: "var(--semantic-success)",
      };
    }

    return {
      type: "partial",
      icon: "circle-half-stroke",
      color: "var(--semantic-info)",
    };
  }

  // Get secondary label for sidebar
  function getSecondaryLabel(seq: BaseSequenceEntry): string {
    const review = tagReviewerState.reviews.get(seq.word);
    if (!review) return "No tags";

    const confirmed = review.suggestedTags.filter(
      (t) => t.reviewState === "confirmed"
    ).length;
    const total = review.suggestedTags.length;

    return `${confirmed}/${total} confirmed`;
  }

  // Convert stats to ReviewStats format
  const reviewStats = $derived({
    total: tagReviewerState.stats.totalSequences,
    reviewed: tagReviewerState.stats.reviewedSequences,
    pending: tagReviewerState.stats.pendingSequences,
    percentComplete: tagReviewerState.stats.percentComplete,
  });
</script>

{#if !isReady || tagReviewerState.loading}
  <div class="loading">
    <div class="spinner"></div>
    <p>Loading Tag Reviewer...</p>
  </div>
{:else if tagReviewerState.filteredSequences.length === 0}
  <div class="empty-state">
    <p>No sequences match the current filter.</p>
    <button onclick={() => tagReviewerState.setFilterMode("all")}>
      Show All Sequences
    </button>
  </div>
{:else}
  <div class="tag-reviewer-module">
    <div class="layout-container">
      <!-- Left sidebar -->
      <SequenceBrowserSidebar
        sequences={tagReviewerState.filteredSequences}
        currentSequenceId={tagReviewerState.currentSequence?.id ?? null}
        filterMode={tagReviewerState.filterMode}
        {filterOptions}
        onSelectSequence={(id) => tagReviewerState.jumpToSequence(id)}
        onFilterChange={(mode) => tagReviewerState.setFilterMode(mode as any)}
        {getStatus}
        {getSecondaryLabel}
        title="Tag Review"
        emptyMessage="No sequences to review"
      />

      <!-- Main content area -->
      <div class="main-area">
        <ReviewHeader
          title="Tag Reviewer"
          stats={reviewStats}
          filterMode={tagReviewerState.filterMode}
          {filterOptions}
          onFilterChange={(mode) => tagReviewerState.setFilterMode(mode as any)}
        />

        <div class="main-content">
          <!-- Sequence preview -->
          <SequencePreviewPanel
            sequence={tagReviewerState.currentSequence}
            parsedSteps={parsedData.steps}
            startPosition={parsedData.startPosition}
            {showStartPosition}
            {manualColumnCount}
            onShowStartPositionChange={(val) => (showStartPosition = val)}
            onColumnCountChange={(val) => (manualColumnCount = val)}
            onCopyJson={handleCopyForReview}
            {copiedToast}
          />

          <!-- Tag panel -->
          <div class="review-panel">
            <TagSuggestionPanel
              review={tagReviewerState.currentReview}
              onConfirmTag={(idx) => tagReviewerState.confirmTag(idx)}
              onRejectTag={(idx) => tagReviewerState.rejectTag(idx)}
              onResetTag={(idx) => tagReviewerState.resetTag(idx)}
              onConfirmAll={() => tagReviewerState.confirmAllTags()}
              onAddCustomTag={(tag, cat) =>
                tagReviewerState.addCustomTag(tag, cat)}
              onRemoveCustomTag={(tag) => tagReviewerState.removeCustomTag(tag)}
            />

            <NotesInput
              value={tagReviewerState.notes}
              onInput={(val) => tagReviewerState.setNotes(val)}
              placeholder="Notes about tag accuracy..."
              label="Review Notes"
            />
          </div>
        </div>

        <ReviewNavigationBar
          currentIndex={tagReviewerState.currentIndex}
          totalCount={tagReviewerState.filteredSequences.length}
          onPrevious={() => tagReviewerState.previousSequence()}
          onNext={() => tagReviewerState.nextSequence()}
          onSkip={() => tagReviewerState.skipSequence()}
        />
      </div>
    </div>
  </div>
{/if}

<style>
  .tag-reviewer-module {
    width: 100%;
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--background);
    color: var(--foreground);
    overflow: hidden;
  }

  .layout-container {
    display: grid;
    grid-template-columns: 320px 1fr;
    flex: 1;
    overflow: hidden;
    width: 100%;
  }

  @media (max-width: 1200px) {
    .layout-container {
      grid-template-columns: 1fr;
    }

    .layout-container > :first-child {
      display: none;
    }
  }

  .main-area {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    width: 100%;
  }

  .loading,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-lg);
    height: 100vh;
    font-size: var(--font-size-lg);
    color: var(--muted);
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid var(--theme-stroke, var(--theme-stroke));
    border-top-color: var(--primary-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .empty-state button {
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--gradient-primary);
    color: var(--foreground);
    border: none;
    border-radius: 8px;
    font-size: var(--font-size-sm);
    font-weight: 600;
    cursor: pointer;
    transition: var(--transition-fast);
    min-height: var(--min-touch-target);
  }

  .main-content {
    display: grid;
    grid-template-columns: 1fr 400px;
    gap: var(--spacing-lg);
    padding: var(--spacing-lg);
    flex: 1;
    overflow: hidden;
  }

  .review-panel {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    overflow-y: auto;
  }

  @media (max-width: 1024px) {
    .main-content {
      grid-template-columns: 1fr;
      grid-template-rows: auto 1fr;
    }

    .review-panel {
      max-height: 400px;
    }
  }
</style>
