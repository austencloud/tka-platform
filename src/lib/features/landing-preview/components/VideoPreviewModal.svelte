<script lang="ts">
  /**
   * VideoPreviewModal
   *
   * Full-screen modal for previewing/playing a video with category, performer,
   * and featured controls.
   */
  import type { ShowcaseVideo, VideoCategory, UserProfile } from "../types";
  import UserSearchInput from "$lib/shared/user-search/UserSearchInput.svelte";
  import type { UserSearchResult } from "$lib/shared/user-search/services/contracts/IUserSearcher";

  interface Props {
    video: ShowcaseVideo;
    videoUrl: string | null;
    categories: VideoCategory[];
    showUserSearch: boolean;
    onClose: () => void;
    onSetCategory: (categoryId: string) => void;
    onToggleFeatured: () => void;
    onAddPerformer: (user: UserProfile) => void;
    onRemovePerformer: (performerId: string) => void;
    onToggleUserSearch: (show: boolean) => void;
    formatDate: (date: Date | null) => string;
    formatFileSize: (bytes: number) => string;
  }

  let {
    video,
    videoUrl,
    categories,
    showUserSearch,
    onClose,
    onSetCategory,
    onToggleFeatured,
    onAddPerformer,
    onRemovePerformer,
    onToggleUserSearch,
    formatDate,
    formatFileSize,
  }: Props = $props();

  function handleUserSelect(user: UserSearchResult) {
    // Adapt UserSearchResult to UserProfile format
    onAddPerformer({
      id: user.uid,
      displayName: user.displayName,
      avatarUrl: user.photoURL,
    });
    onToggleUserSearch(false);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      onClose();
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="preview-modal" onclick={onClose} onkeydown={handleKeydown}>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="preview-content" onclick={(e) => e.stopPropagation()}>
    <button class="close-btn" onclick={onClose}>
      <i class="fas fa-times" aria-hidden="true"></i>
    </button>

    <div class="preview-video">
      {#if videoUrl}
        <!-- svelte-ignore a11y_media_has_caption -->
        <video
          src={videoUrl}
          controls
          autoplay
          playsinline
        ></video>
      {:else}
        <div class="video-loading">
          <div class="spinner"></div>
          <span>Loading video...</span>
        </div>
      {/if}
    </div>

    <div class="preview-details">
      <h2>{video.title || video.shortcode}</h2>
      <p class="preview-meta">
        {formatDate(video.instagramDate)} · {formatFileSize(video.fileSize)}
      </p>

      <div class="category-selector">
        <span class="label">Category:</span>
        <div class="category-buttons">
          {#each categories as cat}
            <button
              class="cat-btn"
              class:active={video.category === cat.id}
              style="--cat-color: {cat.color}"
              onclick={() => onSetCategory(cat.id)}
            >
              {cat.label}
            </button>
          {/each}
        </div>
      </div>

      <!-- Performer assignment -->
      <div class="performer-selector">
        <span class="label">Performers:</span>
        {#if video.performers.length > 0}
          <div class="current-performers">
            {#each video.performers as performer}
              <div class="performer-chip">
                <span>{performer.displayName}</span>
                <button class="remove-btn" onclick={() => onRemovePerformer(performer.id)} title="Remove performer">
                  <i class="fas fa-times" aria-hidden="true"></i>
                </button>
              </div>
            {/each}
          </div>
        {/if}

        <button class="assign-btn" onclick={() => onToggleUserSearch(true)}>
          <i class="fas fa-user-plus" aria-hidden="true"></i>
          Add Performer
        </button>

        {#if showUserSearch}
          <div class="user-search-popup">
            <UserSearchInput
              placeholder="Search users..."
              inlineResults={true}
              autofocus={true}
              onSelect={handleUserSelect}
              excludeUserIds={video.performers.map((p) => p.id)}
            />
            <button class="cancel-search" onclick={() => onToggleUserSearch(false)}>
              Cancel
            </button>
          </div>
        {/if}
      </div>

      <div class="featured-toggle">
        <button
          class="feature-btn"
          class:active={video.featured}
          onclick={onToggleFeatured}
        >
          <i class="fas fa-star" aria-hidden="true"></i>
          {video.featured ? "Featured" : "Mark as Featured"}
        </button>
      </div>

      <div class="video-url">
        <input type="text" value={video.videoUrl} readonly />
        <button onclick={() => navigator.clipboard.writeText(video.videoUrl)}>
          <i class="fas fa-copy" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .preview-modal {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .preview-content {
    background: var(--theme-panel-bg);
    border-radius: 16px;
    max-width: 500px;
    width: 100%;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .close-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 10;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    background: rgba(0, 0, 0, 0.5);
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .preview-video {
    aspect-ratio: 9 / 16;
    max-height: 50vh;
    background: #000;
  }

  .preview-video video {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .video-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 12px;
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

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .preview-details {
    padding: 20px;
  }

  .preview-details h2 {
    margin: 0 0 8px 0;
    font-size: 1.25rem;
  }

  .preview-meta {
    color: var(--theme-text-dim);
    font-size: 14px;
    margin-bottom: 16px;
  }

  .category-selector {
    margin-bottom: 16px;
  }

  .category-selector .label,
  .performer-selector .label {
    display: block;
    font-size: 12px;
    color: var(--theme-text-dim);
    margin-bottom: 8px;
  }

  .category-buttons {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .cat-btn {
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid var(--theme-stroke);
    background: var(--theme-card-bg);
    color: var(--theme-text);
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
  }

  .cat-btn:hover {
    border-color: var(--cat-color);
  }

  .cat-btn.active {
    background: var(--cat-color);
    border-color: var(--cat-color);
    color: white;
  }

  .performer-selector {
    margin-bottom: 16px;
  }

  .current-performers {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 8px;
  }

  .performer-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: rgba(99, 102, 241, 0.2);
    border: 1px solid rgba(99, 102, 241, 0.3);
    border-radius: 20px;
    font-size: 13px;
    color: #a5b4fc;
  }

  .performer-chip .remove-btn {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: none;
    background: rgba(239, 68, 68, 0.3);
    color: #ef4444;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    transition: all 0.2s;
  }

  .performer-chip .remove-btn:hover {
    background: #ef4444;
    color: white;
  }

  .assign-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px dashed var(--theme-stroke);
    background: transparent;
    color: var(--theme-text-dim);
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
  }

  .assign-btn:hover {
    border-color: var(--theme-accent);
    color: var(--theme-accent);
  }

  .user-search-popup {
    margin-top: 8px;
    padding: 12px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
  }

  .cancel-search {
    width: 100%;
    margin-top: 8px;
    padding: 8px;
    border-radius: 6px;
    border: 1px solid var(--theme-stroke);
    background: transparent;
    color: var(--theme-text-dim);
    cursor: pointer;
  }

  .cancel-search:hover {
    background: var(--theme-card-bg);
  }

  .featured-toggle {
    margin-bottom: 16px;
  }

  .feature-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-radius: 8px;
    border: 1px solid var(--theme-stroke);
    background: var(--theme-card-bg);
    color: var(--theme-text);
    cursor: pointer;
    font-size: 14px;
    width: 100%;
    justify-content: center;
    transition: all 0.2s;
  }

  .feature-btn:hover {
    border-color: #f59e0b;
  }

  .feature-btn.active {
    background: #f59e0b;
    border-color: #f59e0b;
    color: white;
  }

  .video-url {
    display: flex;
    gap: 8px;
  }

  .video-url input {
    flex: 1;
    padding: 8px;
    border-radius: 6px;
    border: 1px solid var(--theme-stroke);
    background: var(--theme-card-bg);
    color: var(--theme-text);
    font-size: 12px;
  }

  .video-url button {
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid var(--theme-stroke);
    background: var(--theme-card-bg);
    color: var(--theme-text);
    cursor: pointer;
  }
</style>
