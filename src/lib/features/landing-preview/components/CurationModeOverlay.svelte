<script lang="ts">
  import UserSearchInput from "$lib/shared/user-search/UserSearchInput.svelte";
  import type {
    ShowcaseVideo,
    VideoCategory,
    UserProfile,
    CurationProgress,
    VideoStats,
  } from "../types";

  interface Props {
    currentVideo: ShowcaseVideo;
    categories: VideoCategory[];
    quickPerformers: UserProfile[];
    progress: CurationProgress;
    stats: VideoStats;
    curationIndex: number;
    uncuratedCount: number;
    saving: boolean;
    showAddCategory: boolean;
    showAddPerformer: boolean;
    newCategoryLabel: string;
    newCategoryColor: string;
    performerKeys: string;
    onExit: () => void;
    onPrev: () => void;
    onNext: () => void;
    onSetCategory: (categoryId: string) => void;
    onSetPerformer: (performer: UserProfile) => void;
    onSkip: () => void;
    onAddCategory: () => void;
    onAddPerformer: (user: { uid: string; displayName: string }) => void;
    onRemovePerformer: (id: string) => void;
    onToggleAddCategory: (show: boolean) => void;
    onToggleAddPerformer: (show: boolean) => void;
    onUpdateCategoryLabel: (label: string) => void;
    onUpdateCategoryColor: (color: string) => void;
    formatDate: (date: Date | null) => string;
  }

  let {
    currentVideo,
    categories,
    quickPerformers,
    progress,
    stats,
    curationIndex,
    uncuratedCount,
    saving,
    showAddCategory,
    showAddPerformer,
    newCategoryLabel,
    newCategoryColor,
    performerKeys,
    onExit,
    onPrev,
    onNext,
    onSetCategory,
    onSetPerformer,
    onSkip,
    onAddCategory,
    onAddPerformer,
    onRemovePerformer,
    onToggleAddCategory,
    onToggleAddPerformer,
    onUpdateCategoryLabel,
    onUpdateCategoryColor,
    formatDate,
  }: Props = $props();
</script>

<div class="curation-overlay">
  <div class="curation-header">
    <div class="curation-progress">
      <span class="progress-text">
        {progress.current} / {progress.total} uncurated
        <span class="done-count">({progress.done} done)</span>
      </span>
      <div class="progress-bar">
        <div
          class="progress-fill"
          style="width: {(progress.done / stats.total) * 100}%"
        ></div>
      </div>
    </div>
    <button class="exit-btn" onclick={onExit}>
      <i class="fas fa-times" aria-hidden="true"></i>
      Exit (Esc)
    </button>
  </div>

  <div class="curation-main">
    <!-- Navigation arrow left -->
    <button
      class="nav-arrow left"
      onclick={onPrev}
      disabled={curationIndex === 0}
    >
      <i class="fas fa-chevron-left" aria-hidden="true"></i>
    </button>

    <!-- Video display -->
    <div class="curation-video-container">
      <div class="video-wrapper">
        <!-- svelte-ignore a11y_media_has_caption -->
        <video
          src={currentVideo.videoUrl}
          controls
          autoplay
          loop
          playsinline
        ></video>
      </div>

      <div class="video-title-bar">
        <span class="title">{currentVideo.title || currentVideo.shortcode}</span>
        <span class="date">{formatDate(currentVideo.instagramDate)}</span>
      </div>

      <!-- Current state indicators -->
      <div class="current-state">
        {#if currentVideo.category}
          {@const cat = categories.find(c => c.id === currentVideo.category)}
          <span class="state-badge category" style="background: {cat?.color || '#666'}">
            {cat?.label || currentVideo.category}
          </span>
        {:else}
          <span class="state-badge empty">No category</span>
        {/if}

        {#if currentVideo.performerName}
          <span class="state-badge performer">
            <i class="fas fa-user" aria-hidden="true"></i>
            {currentVideo.performerName}
          </span>
        {:else}
          <span class="state-badge empty">No performer</span>
        {/if}
      </div>
    </div>

    <!-- Navigation arrow right -->
    <button
      class="nav-arrow right"
      onclick={onNext}
      disabled={curationIndex >= uncuratedCount - 1}
    >
      <i class="fas fa-chevron-right" aria-hidden="true"></i>
    </button>
  </div>

  <!-- Quick action buttons -->
  <div class="curation-actions">
    <!-- Category buttons -->
    <div class="action-section">
      <span class="section-label">Category</span>
      <div class="action-buttons">
        {#each categories as cat, i}
          <button
            class="action-btn category-action"
            class:active={currentVideo.category === cat.id}
            style="--cat-color: {cat.color}"
            onclick={() => onSetCategory(cat.id)}
            disabled={saving}
          >
            <span class="key-hint">{i + 1}</span>
            {cat.label}
          </button>
        {/each}
        {#if !showAddCategory}
          <button
            class="action-btn add-btn"
            type="button"
            onclick={() => onToggleAddCategory(true)}
            title="Add category"
          >
            <i class="fas fa-plus" aria-hidden="true"></i>
          </button>
        {/if}
      </div>
      {#if showAddCategory}
        <div class="add-category-inline">
          <input
            type="text"
            placeholder="Category name..."
            value={newCategoryLabel}
            oninput={(e) => onUpdateCategoryLabel((e.target as HTMLInputElement).value)}
            onkeydown={(e) => e.key === "Enter" && onAddCategory()}
          />
          <input
            type="color"
            value={newCategoryColor}
            oninput={(e) => onUpdateCategoryColor((e.target as HTMLInputElement).value)}
            title="Category color"
          />
          <button class="save-btn" onclick={onAddCategory} disabled={!newCategoryLabel.trim()}>
            Add
          </button>
          <button class="cancel-btn" onclick={() => onToggleAddCategory(false)}>
            Cancel
          </button>
        </div>
      {/if}
    </div>

    <!-- Performer buttons -->
    <div class="action-section">
      <span class="section-label">Performer</span>
      <div class="action-buttons">
        {#each quickPerformers as performer, i}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="action-btn performer-action"
            class:active={currentVideo.performerId === performer.id}
            role="button"
            tabindex="0"
            onclick={() => !saving && onSetPerformer(performer)}
            onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && !saving && onSetPerformer(performer)}
          >
            <span class="key-hint">{performerKeys[i]?.toUpperCase() || ''}</span>
            {performer.displayName}
            <button
              class="remove-performer-btn"
              type="button"
              onclick={(e) => { e.stopPropagation(); onRemovePerformer(performer.id); }}
              title="Remove performer"
            >
              <i class="fas fa-times" aria-hidden="true"></i>
            </button>
          </div>
        {/each}
        {#if !showAddPerformer}
          <button
            class="action-btn add-btn"
            type="button"
            onclick={() => onToggleAddPerformer(true)}
            title="Add performer"
          >
            <i class="fas fa-plus" aria-hidden="true"></i>
          </button>
        {/if}
      </div>
      {#if showAddPerformer}
        <div class="add-performer-inline">
          <UserSearchInput
            onSelect={(user) => onAddPerformer(user)}
            placeholder="Search user..."
            autofocus={true}
            inlineResults={true}
            excludeUserIds={quickPerformers.map(p => p.id)}
          />
          <button
            class="cancel-add-btn"
            type="button"
            onclick={() => onToggleAddPerformer(false)}
          >
            Cancel
          </button>
        </div>
      {/if}
    </div>

    <!-- Skip button -->
    <div class="action-section skip-section">
      <button
        class="skip-btn"
        onclick={onSkip}
        disabled={saving}
      >
        <span class="key-hint">X</span>
        Skip
      </button>
    </div>
  </div>

  {#if saving}
    <div class="saving-indicator">
      <div class="spinner small"></div>
      Saving...
    </div>
  {/if}
</div>

<style>
  .curation-overlay {
    position: fixed;
    inset: 0;
    z-index: 2000;
    background: #0a0a12;
    display: flex;
    flex-direction: column;
    padding: 16px;
  }

  .curation-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--theme-stroke);
  }

  .curation-progress {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .progress-text {
    font-size: 16px;
    font-weight: 600;
  }

  .done-count {
    color: var(--theme-text-dim);
    font-weight: 400;
    font-size: 14px;
  }

  .progress-bar {
    width: 200px;
    height: 6px;
    background: var(--theme-card-bg);
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #10b981, #06b6d4);
    transition: width 0.3s ease;
  }

  .exit-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-radius: 8px;
    border: 1px solid var(--theme-stroke);
    background: transparent;
    color: var(--theme-text);
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;
  }

  .exit-btn:hover {
    background: rgba(239, 68, 68, 0.1);
    border-color: #ef4444;
    color: #ef4444;
  }

  .curation-main {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 24px;
    padding: 24px 0;
    min-height: 0;
  }

  .nav-arrow {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 1px solid var(--theme-stroke);
    background: var(--theme-card-bg);
    color: var(--theme-text);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .nav-arrow:hover:not(:disabled) {
    background: var(--theme-accent);
    border-color: var(--theme-accent);
  }

  .nav-arrow:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .curation-video-container {
    flex: 1;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .video-wrapper {
    width: 100%;
    aspect-ratio: 9 / 16;
    max-height: calc(100vh - 380px);
    background: #000;
    border-radius: 12px;
    overflow: hidden;
  }

  .video-wrapper video {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .video-title-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 8px 0;
  }

  .video-title-bar .title {
    font-weight: 600;
    font-size: 16px;
  }

  .video-title-bar .date {
    color: var(--theme-text-dim);
    font-size: 13px;
  }

  .current-state {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .state-badge {
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .state-badge.category {
    color: white;
  }

  .state-badge.performer {
    background: rgba(99, 102, 241, 0.2);
    color: #a5b4fc;
  }

  .state-badge.empty {
    background: rgba(255, 255, 255, 0.05);
    color: var(--theme-text-dim);
    border: 1px dashed var(--theme-stroke);
  }

  .curation-actions {
    display: flex;
    justify-content: center;
    gap: 32px;
    padding-top: 16px;
    border-top: 1px solid var(--theme-stroke);
    flex-wrap: wrap;
  }

  .action-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
  }

  .section-label {
    font-size: 12px;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .action-buttons {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .action-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 12px 16px;
    border-radius: 8px;
    border: 1px solid var(--theme-stroke);
    background: var(--theme-card-bg);
    color: var(--theme-text);
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    min-width: 80px;
    transition: all 0.2s;
  }

  .action-btn:hover:not(:disabled) {
    border-color: var(--cat-color, var(--theme-accent));
    background: rgba(255, 255, 255, 0.05);
  }

  .action-btn.active {
    background: var(--cat-color, var(--theme-accent));
    border-color: var(--cat-color, var(--theme-accent));
    color: white;
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-btn .key-hint {
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.1);
    font-family: monospace;
  }

  .action-btn.active .key-hint {
    background: rgba(0, 0, 0, 0.2);
  }

  .performer-action {
    --cat-color: #6366f1;
  }

  .add-btn {
    min-width: auto;
    padding: 12px;
  }

  .remove-performer-btn {
    position: absolute;
    top: -6px;
    right: -6px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: none;
    background: rgba(239, 68, 68, 0.8);
    color: white;
    cursor: pointer;
    display: none;
    align-items: center;
    justify-content: center;
    font-size: 10px;
  }

  .action-btn:hover .remove-performer-btn {
    display: flex;
  }

  .performer-action {
    position: relative;
  }

  .add-category-inline,
  .add-performer-inline {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-top: 8px;
  }

  .add-category-inline input[type="text"],
  .add-performer-inline input[type="text"] {
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid var(--theme-stroke);
    background: var(--theme-panel-bg);
    color: var(--theme-text);
    font-size: 13px;
  }

  .add-category-inline input[type="color"] {
    width: 32px;
    height: 32px;
    padding: 0;
    border: 1px solid var(--theme-stroke);
    border-radius: 6px;
    cursor: pointer;
  }

  .add-category-inline .save-btn,
  .add-category-inline .cancel-btn {
    padding: 8px 12px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    font-size: 13px;
  }

  .add-category-inline .save-btn {
    background: var(--theme-accent);
    color: white;
  }

  .add-category-inline .save-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .add-category-inline .cancel-btn {
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    color: var(--theme-text);
  }

  .cancel-add-btn {
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid var(--theme-stroke);
    background: transparent;
    color: var(--theme-text-dim);
    cursor: pointer;
    font-size: 13px;
  }

  .skip-section {
    align-self: center;
  }

  .skip-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border-radius: 8px;
    border: 1px solid var(--theme-stroke);
    background: transparent;
    color: var(--theme-text-dim);
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
  }

  .skip-btn:hover:not(:disabled) {
    border-color: rgba(239, 68, 68, 0.5);
    color: #ef4444;
  }

  .skip-btn .key-hint {
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.1);
    font-family: monospace;
  }

  .saving-indicator {
    position: absolute;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: var(--theme-card-bg);
    border-radius: 8px;
    font-size: 13px;
    color: var(--theme-text-dim);
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--theme-stroke);
    border-top-color: var(--theme-accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .spinner.small {
    width: 16px;
    height: 16px;
    border-width: 2px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 600px) {
    .curation-actions {
      gap: 16px;
    }

    .action-btn {
      min-width: 60px;
      padding: 10px 12px;
      font-size: 12px;
    }

    .nav-arrow {
      width: 40px;
      height: 40px;
    }
  }
</style>
