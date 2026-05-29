<script lang="ts">
  /**
   * BrowsePanel
   *
   * Info panel content for browse mode - single video editing without navigation.
   */
  import CategoryField from "../fields/CategoryField.svelte";
  import PerformerField from "../fields/PerformerField.svelte";
  import SequenceLinkField from "../fields/SequenceLinkField.svelte";
  import type { VideoEditorController } from "../../../state/video-editor-controller.svelte";
  import type { ShowcaseVideo } from "../../../types";

  interface Props {
    video: ShowcaseVideo;
    controller: VideoEditorController;
    formatDate: (date: Date | null) => string;
  }

  let { video, controller, formatDate }: Props = $props();

  const hasCategory = $derived(!!video.category);
  const hasPerformers = $derived(video.performers.length > 0);
</script>

<div class="browse-panel">
  <!-- Video identity -->
  <div class="video-identity">
    <span class="video-word">{video.title || video.shortcode}</span>
    <span class="video-date">{formatDate(video.instagramDate)}</span>
  </div>

  <!-- Category -->
  <CategoryField
    categories={controller.categories}
    selectedCategory={video.category}
    showAddForm={controller.showAddCategory}
    newLabel={controller.newCategoryLabel}
    newColor={controller.newCategoryColor}
    disabled={controller.saving}
    onSelect={controller.setCategory}
    onToggleAddForm={controller.toggleAddCategoryForm}
    onAdd={controller.addCategory}
    onUpdateLabel={controller.updateCategoryLabel}
    onUpdateColor={controller.updateCategoryColor}
  />

  <!-- Performers -->
  <PerformerField
    quickPerformers={controller.quickPerformers}
    performerKeys={controller.performerKeys}
    showAddForm={controller.showAddPerformer}
    disabled={controller.saving}
    isSelected={controller.isPerformerSelected}
    {hasPerformers}
    onToggle={controller.togglePerformer}
    onAdd={controller.addQuickPerformer}
    onRemove={controller.removeQuickPerformer}
    onToggleAddForm={controller.toggleAddPerformerForm}
  />

  <!-- Linked Sequences -->
  <SequenceLinkField
    linkedSequences={video.linkedSequences}
    matchedSequences={controller.matchedSequences}
    searchQuery={controller.sequenceSearchQuery}
    searching={controller.sequenceSearching}
    maxLinks={controller.maxLinks}
    canAddMore={controller.canAddMoreLinks}
    showSection={controller.showLinkingSection}
    {hasCategory}
    disabled={controller.saving}
    onSearch={controller.searchSequences}
    onLink={controller.linkSequence}
    onUnlink={controller.unlinkSequence}
  />
</div>

<style>
  .browse-panel {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .video-identity {
    text-align: center;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.06));
  }

  .video-word {
    display: block;
    font-size: 24px;
    font-weight: 700;
    color: var(--theme-text, white);
    letter-spacing: -0.5px;
  }

  .video-date {
    display: block;
    font-size: 13px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    margin-top: 4px;
  }
</style>
