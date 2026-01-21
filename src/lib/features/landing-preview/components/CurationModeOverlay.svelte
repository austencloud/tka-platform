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
    onTogglePerformer: (performer: UserProfile) => void;
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
    onTogglePerformer,
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

  function isPerformerSelected(id: string): boolean {
    return currentVideo.performers.some((p) => p.id === id);
  }
</script>

<div class="curation-overlay">
  <!-- Compact header -->
  <header class="header">
    <div class="progress-info">
      <span class="progress-count">{progress.current}/{progress.total}</span>
      <div class="progress-bar">
        <div class="progress-fill" style="width: {(progress.done / stats.total) * 100}%"></div>
      </div>
      <span class="done-label">{progress.done} done</span>
    </div>
    <button class="exit-btn" onclick={onExit}>
      <i class="fas fa-times" aria-hidden="true"></i>
    </button>
  </header>

  <!-- Main content: video + controls side by side -->
  <main class="main-content">
    <!-- Left: Video player -->
    <div class="video-section">
      <button class="nav-btn prev" onclick={onPrev} disabled={curationIndex === 0}>
        <i class="fas fa-chevron-left" aria-hidden="true"></i>
      </button>

      <div class="video-container">
        <!-- svelte-ignore a11y_media_has_caption -->
        <video
          src={currentVideo.videoUrl}
          controls
          autoplay
          loop
          playsinline
        ></video>
        <div class="video-meta">
          <span class="video-title">{currentVideo.title || currentVideo.shortcode}</span>
          <span class="video-date">{formatDate(currentVideo.instagramDate)}</span>
        </div>
      </div>

      <button class="nav-btn next" onclick={onNext} disabled={curationIndex >= uncuratedCount - 1}>
        <i class="fas fa-chevron-right" aria-hidden="true"></i>
      </button>
    </div>

    <!-- Right: Controls panel -->
    <div class="controls-panel">
      <!-- Category section -->
      <section class="control-section">
        <h3>Category</h3>
        <div class="button-grid">
          {#each categories as cat, i}
            <button
              class="option-btn"
              class:selected={currentVideo.category === cat.id}
              style="--btn-color: {cat.color}"
              onclick={() => onSetCategory(cat.id)}
              disabled={saving}
            >
              <span class="hotkey">{i + 1}</span>
              <span class="label">{cat.label}</span>
            </button>
          {/each}
          {#if !showAddCategory}
            <button class="option-btn add-new" onclick={() => onToggleAddCategory(true)}>
              <i class="fas fa-plus" aria-hidden="true"></i>
            </button>
          {/if}
        </div>
        {#if showAddCategory}
          <div class="add-form">
            <input
              type="text"
              placeholder="Name..."
              value={newCategoryLabel}
              oninput={(e) => onUpdateCategoryLabel((e.target as HTMLInputElement).value)}
              onkeydown={(e) => e.key === "Enter" && onAddCategory()}
            />
            <input
              type="color"
              value={newCategoryColor}
              oninput={(e) => onUpdateCategoryColor((e.target as HTMLInputElement).value)}
            />
            <button class="form-btn save" onclick={onAddCategory} disabled={!newCategoryLabel.trim()}>Add</button>
            <button class="form-btn cancel" onclick={() => onToggleAddCategory(false)}>Cancel</button>
          </div>
        {/if}
      </section>

      <!-- Performer section -->
      <section class="control-section">
        <h3>Performers</h3>
        <div class="button-grid">
          {#each quickPerformers as performer, i}
            <button
              class="option-btn performer-btn"
              class:selected={isPerformerSelected(performer.id)}
              onclick={() => !saving && onTogglePerformer(performer)}
              disabled={saving}
            >
              <span class="hotkey">{performerKeys[i]?.toUpperCase() || ''}</span>
              <span class="label">{performer.displayName}</span>
              {#if isPerformerSelected(performer.id)}
                <i class="fas fa-check check-icon" aria-hidden="true"></i>
              {/if}
            </button>
          {/each}
          {#if !showAddPerformer}
            <button class="option-btn add-new" onclick={() => onToggleAddPerformer(true)}>
              <i class="fas fa-plus" aria-hidden="true"></i>
            </button>
          {/if}
        </div>
        {#if showAddPerformer}
          <div class="add-form performer-search">
            <UserSearchInput
              onSelect={(user) => onAddPerformer(user)}
              placeholder="Search user..."
              autofocus={true}
              inlineResults={true}
              excludeUserIds={quickPerformers.map(p => p.id)}
            />
            <button class="form-btn cancel" onclick={() => onToggleAddPerformer(false)}>Cancel</button>
          </div>
        {/if}

        <!-- Quick performer management -->
        {#if quickPerformers.length > 0}
          <div class="performer-management">
            <span class="management-label">Quick list:</span>
            {#each quickPerformers as performer}
              <button
                class="remove-from-list"
                onclick={() => onRemovePerformer(performer.id)}
                title="Remove {performer.displayName} from quick list"
              >
                {performer.displayName} <i class="fas fa-times" aria-hidden="true"></i>
              </button>
            {/each}
          </div>
        {/if}
      </section>

      <!-- Current selection summary -->
      <section class="selection-summary">
        <h3>Current Tags</h3>
        <div class="tags">
          {#if currentVideo.category}
            {@const cat = categories.find(c => c.id === currentVideo.category)}
            <span class="tag category-tag" style="background: {cat?.color || '#666'}">
              {cat?.label || currentVideo.category}
            </span>
          {:else}
            <span class="tag empty-tag">No category</span>
          {/if}

          {#if currentVideo.performers.length > 0}
            {#each currentVideo.performers as perf}
              <span class="tag performer-tag">{perf.displayName}</span>
            {/each}
          {:else}
            <span class="tag empty-tag">No performers</span>
          {/if}
        </div>
      </section>

      <!-- Navigation actions -->
      <div class="nav-actions">
        <button class="action-btn skip" onclick={onSkip} disabled={saving}>
          <span class="hotkey">X</span>
          Skip
        </button>
        <button
          class="action-btn next-video"
          onclick={onNext}
          disabled={curationIndex >= uncuratedCount - 1}
        >
          Next
          <i class="fas fa-arrow-right" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  </main>

  {#if saving}
    <div class="saving-toast">
      <div class="spinner"></div>
      Saving...
    </div>
  {/if}
</div>

<style>
  .curation-overlay {
    position: fixed;
    inset: 0;
    z-index: 2000;
    background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* Header */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 20px;
    background: rgba(0, 0, 0, 0.3);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .progress-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .progress-count {
    font-weight: 600;
    font-size: 14px;
    color: white;
  }

  .progress-bar {
    width: 120px;
    height: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #10b981, #06b6d4);
    transition: width 0.3s ease;
  }

  .done-label {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
  }

  .exit-btn {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: none;
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    transition: all 0.2s;
  }

  .exit-btn:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  /* Main content */
  .main-content {
    flex: 1;
    display: flex;
    gap: 24px;
    padding: 20px;
    min-height: 0;
  }

  /* Video section */
  .video-section {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .nav-btn {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: none;
    background: rgba(255, 255, 255, 0.08);
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .nav-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.15);
  }

  .nav-btn:disabled {
    opacity: 0.2;
    cursor: not-allowed;
  }

  .video-container {
    width: 280px;
    display: flex;
    flex-direction: column;
  }

  .video-container video {
    width: 100%;
    aspect-ratio: 9 / 16;
    background: #000;
    border-radius: 12px;
    object-fit: contain;
  }

  .video-meta {
    padding: 12px 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .video-title {
    font-weight: 600;
    font-size: 14px;
    color: white;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .video-date {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
  }

  /* Controls panel */
  .controls-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 20px;
    overflow-y: auto;
    padding-right: 8px;
  }

  .control-section {
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12px;
    padding: 16px;
  }

  .control-section h3 {
    margin: 0 0 12px 0;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: rgba(255, 255, 255, 0.5);
  }

  .button-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .option-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 8px;
    border: 1.5px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.85);
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: all 0.15s;
  }

  .option-btn:hover:not(:disabled) {
    border-color: var(--btn-color, rgba(99, 102, 241, 0.5));
    background: rgba(255, 255, 255, 0.08);
  }

  .option-btn.selected {
    background: var(--btn-color, #6366f1);
    border-color: var(--btn-color, #6366f1);
    color: white;
  }

  .option-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .option-btn .hotkey {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 4px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.1);
    font-size: 11px;
    font-family: monospace;
    font-weight: 600;
  }

  .option-btn.selected .hotkey {
    background: rgba(0, 0, 0, 0.2);
  }

  .option-btn .label {
    white-space: nowrap;
  }

  .option-btn .check-icon {
    margin-left: auto;
    font-size: 11px;
    opacity: 0.9;
  }

  .performer-btn {
    --btn-color: #6366f1;
  }

  .option-btn.add-new {
    border-style: dashed;
    color: rgba(255, 255, 255, 0.5);
    padding: 10px 14px;
  }

  .option-btn.add-new:hover {
    color: white;
    border-color: rgba(255, 255, 255, 0.3);
  }

  /* Add forms */
  .add-form {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .add-form input[type="text"] {
    flex: 1;
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(0, 0, 0, 0.3);
    color: white;
    font-size: 13px;
  }

  .add-form input[type="text"]::placeholder {
    color: rgba(255, 255, 255, 0.3);
  }

  .add-form input[type="color"] {
    width: 36px;
    height: 36px;
    padding: 2px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
  }

  .form-btn {
    padding: 8px 12px;
    border-radius: 6px;
    border: none;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .form-btn.save {
    background: #10b981;
    color: white;
  }

  .form-btn.save:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .form-btn.cancel {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.7);
  }

  .form-btn.cancel:hover {
    background: rgba(255, 255, 255, 0.12);
  }

  .performer-search {
    flex-direction: column;
    align-items: stretch;
  }

  .performer-search .form-btn.cancel {
    align-self: flex-start;
  }

  /* Performer management */
  .performer-management {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .management-label {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
    margin-right: 4px;
  }

  .remove-from-list {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 4px;
    border: none;
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.5);
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .remove-from-list:hover {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }

  .remove-from-list i {
    font-size: 9px;
  }

  /* Selection summary */
  .selection-summary {
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12px;
    padding: 16px;
  }

  .selection-summary h3 {
    margin: 0 0 10px 0;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: rgba(255, 255, 255, 0.5);
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .tag {
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
  }

  .category-tag {
    color: white;
  }

  .performer-tag {
    background: rgba(99, 102, 241, 0.25);
    color: #a5b4fc;
  }

  .empty-tag {
    background: transparent;
    border: 1px dashed rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.35);
  }

  /* Navigation actions */
  .nav-actions {
    display: flex;
    gap: 10px;
    margin-top: auto;
    padding-top: 16px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 20px;
    border-radius: 8px;
    border: none;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .action-btn.skip {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.6);
    flex: 0 0 auto;
  }

  .action-btn.skip:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
  }

  .action-btn.skip .hotkey {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.1);
    font-size: 10px;
    font-family: monospace;
    font-weight: 600;
  }

  .action-btn.next-video {
    flex: 1;
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
    color: white;
  }

  .action-btn.next-video:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .action-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  /* Saving toast */
  .saving-toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: rgba(0, 0, 0, 0.8);
    border-radius: 8px;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.8);
  }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Responsive */
  @media (max-width: 900px) {
    .main-content {
      flex-direction: column;
      padding: 16px;
    }

    .video-section {
      justify-content: center;
    }

    .video-container {
      width: 240px;
    }

    .controls-panel {
      padding-right: 0;
    }
  }

  @media (max-width: 600px) {
    .video-container {
      width: 200px;
    }

    .option-btn {
      padding: 8px 10px;
      font-size: 12px;
    }

    .option-btn .hotkey {
      min-width: 18px;
      height: 18px;
      font-size: 10px;
    }
  }
</style>
