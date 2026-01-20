<script lang="ts">
  import type {
    ShowcaseVideo,
    MatchedSequence,
    LinkingProgress,
    VideoStats,
  } from "../types";

  interface Props {
    currentVideo: ShowcaseVideo;
    matchedSequences: MatchedSequence[];
    selectedSequence: MatchedSequence | null;
    progress: LinkingProgress;
    stats: VideoStats;
    linkingIndex: number;
    unlinkableCount: number;
    searching: boolean;
    saving: boolean;
    onExit: () => void;
    onPrev: () => void;
    onNext: () => void;
    onSelectSequence: (sequence: MatchedSequence) => void;
    onConfirmLink: () => void;
    onSkip: () => void;
    formatDate: (date: Date | null) => string;
  }

  let {
    currentVideo,
    matchedSequences,
    selectedSequence,
    progress,
    stats,
    linkingIndex,
    unlinkableCount,
    searching,
    saving,
    onExit,
    onPrev,
    onNext,
    onSelectSequence,
    onConfirmLink,
    onSkip,
    formatDate,
  }: Props = $props();
</script>

<div class="linking-overlay">
  <div class="linking-header">
    <div class="linking-progress">
      <span class="progress-text">
        {progress.current} / {progress.total} to link
        <span class="done-count">({progress.linked} linked)</span>
      </span>
      <div class="progress-bar">
        <div
          class="progress-fill"
          style="width: {(progress.linked / stats.withWord) * 100}%"
        ></div>
      </div>
    </div>
    <button class="exit-btn" onclick={onExit}>
      <i class="fas fa-times" aria-hidden="true"></i>
      Exit (Esc)
    </button>
  </div>

  <div class="linking-main">
    <!-- Navigation arrow left -->
    <button
      class="nav-arrow left"
      onclick={onPrev}
      disabled={linkingIndex === 0}
    >
      <i class="fas fa-chevron-left" aria-hidden="true"></i>
    </button>

    <!-- Video and sequence side by side -->
    <div class="linking-content">
      <!-- Video panel -->
      <div class="linking-video-panel">
        <div class="panel-header">
          <span class="panel-title">Video</span>
          <span class="tka-word">{currentVideo.title}</span>
        </div>
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
        <div class="video-meta">
          <span>{formatDate(currentVideo.instagramDate)}</span>
          {#if currentVideo.performerName}
            <span class="performer-tag">
              <i class="fas fa-user" aria-hidden="true"></i>
              {currentVideo.performerName}
            </span>
          {/if}
        </div>
      </div>

      <!-- Sequence matches panel -->
      <div class="linking-sequences-panel">
        <div class="panel-header">
          <span class="panel-title">Matching Sequences</span>
          {#if searching}
            <div class="spinner small"></div>
          {/if}
        </div>

        {#if searching}
          <div class="sequences-loading">
            <div class="spinner"></div>
            <span>Searching for "{currentVideo.title}"...</span>
          </div>
        {:else if matchedSequences.length === 0}
          <div class="sequences-empty">
            <i class="fas fa-search" aria-hidden="true"></i>
            <span>No sequences found matching "{currentVideo.title}"</span>
            <p>The sequence may not exist yet, or use a different word.</p>
          </div>
        {:else}
          <div class="sequences-list">
            {#each matchedSequences as seq, i}
              <button
                class="sequence-card"
                class:selected={selectedSequence?.id === seq.id}
                onclick={() => onSelectSequence(seq)}
              >
                <span class="key-hint">{i + 1}</span>
                <div class="sequence-thumbnail">
                  {#if seq.thumbnail}
                    <img src={seq.thumbnail} alt={seq.word} />
                  {:else}
                    <div class="no-thumbnail">
                      <i class="fas fa-image" aria-hidden="true"></i>
                    </div>
                  {/if}
                </div>
                <div class="sequence-info">
                  <span class="sequence-word">{seq.word}</span>
                  <span class="sequence-name">{seq.name}</span>
                  <span class="sequence-owner">
                    <i class="fas fa-user" aria-hidden="true"></i>
                    {seq.ownerName}
                    {#if seq.isPublic}
                      <span class="public-badge">Public</span>
                    {/if}
                  </span>
                </div>
                {#if selectedSequence?.id === seq.id}
                  <div class="selected-check">
                    <i class="fas fa-check" aria-hidden="true"></i>
                  </div>
                {/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Navigation arrow right -->
    <button
      class="nav-arrow right"
      onclick={onNext}
      disabled={linkingIndex >= unlinkableCount - 1}
    >
      <i class="fas fa-chevron-right" aria-hidden="true"></i>
    </button>
  </div>

  <!-- Action buttons -->
  <div class="linking-actions">
    {#if selectedSequence}
      <div class="link-confirm">
        <span class="confirm-text">
          Link video to <strong>{selectedSequence.word}</strong> by {selectedSequence.ownerName}?
        </span>
        <button
          class="confirm-btn"
          onclick={onConfirmLink}
          disabled={saving}
        >
          <span class="key-hint">Enter</span>
          Confirm Link
        </button>
      </div>
    {:else if matchedSequences.length > 0}
      <span class="select-prompt">Select a sequence above (1-{matchedSequences.length})</span>
    {/if}

    <button
      class="skip-btn"
      onclick={onSkip}
      disabled={saving}
    >
      <span class="key-hint">X</span>
      Skip
    </button>
  </div>

  {#if saving}
    <div class="saving-indicator">
      <div class="spinner small"></div>
      Linking...
    </div>
  {/if}
</div>

<style>
  .linking-overlay {
    position: fixed;
    inset: 0;
    z-index: 2000;
    background: var(--theme-panel-bg, #0a0a12);
    display: flex;
    flex-direction: column;
    padding: 16px;
  }

  .linking-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--theme-stroke);
  }

  .linking-progress {
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

  .linking-main {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 24px;
    padding: 24px 0;
    min-height: 0;
    overflow: hidden;
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

  .linking-content {
    flex: 1;
    max-width: 1000px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    height: 100%;
    max-height: calc(100vh - 250px);
  }

  .linking-video-panel,
  .linking-sequences-panel {
    display: flex;
    flex-direction: column;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--theme-stroke);
    background: rgba(255, 255, 255, 0.02);
  }

  .panel-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .tka-word {
    font-size: 18px;
    font-weight: 700;
    color: #06b6d4;
    font-family: monospace;
  }

  .video-wrapper {
    flex: 1;
    background: #000;
  }

  .video-wrapper video {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .video-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-top: 1px solid var(--theme-stroke);
    font-size: 13px;
    color: var(--theme-text-dim);
  }

  .performer-tag {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    background: rgba(99, 102, 241, 0.2);
    border-radius: 4px;
    color: #a5b4fc;
  }

  .performer-tag i {
    font-size: 11px;
  }

  .linking-sequences-panel {
    overflow: hidden;
  }

  .sequences-loading,
  .sequences-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 24px;
    color: var(--theme-text-dim);
    text-align: center;
  }

  .sequences-empty i {
    font-size: 32px;
    opacity: 0.5;
  }

  .sequences-empty p {
    font-size: 13px;
    opacity: 0.7;
    margin: 0;
  }

  .sequences-list {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .sequence-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-radius: 8px;
    border: 2px solid var(--theme-stroke);
    background: var(--theme-panel-bg);
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
  }

  .sequence-card:hover {
    border-color: #10b981;
    background: rgba(16, 185, 129, 0.05);
  }

  .sequence-card.selected {
    border-color: #10b981;
    background: rgba(16, 185, 129, 0.1);
  }

  .sequence-card .key-hint {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.1);
    font-family: monospace;
    font-size: 12px;
    color: var(--theme-text-dim);
    flex-shrink: 0;
  }

  .sequence-card.selected .key-hint {
    background: #10b981;
    color: white;
  }

  .sequence-thumbnail {
    width: 60px;
    height: 60px;
    border-radius: 6px;
    overflow: hidden;
    background: var(--theme-card-bg);
    flex-shrink: 0;
  }

  .sequence-thumbnail img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .no-thumbnail {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--theme-text-dim);
    font-size: 20px;
  }

  .sequence-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .sequence-word {
    font-size: 16px;
    font-weight: 700;
    font-family: monospace;
    color: var(--theme-text);
  }

  .sequence-name {
    font-size: 13px;
    color: var(--theme-text-dim);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sequence-owner {
    font-size: 12px;
    color: var(--theme-text-dim);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .sequence-owner i {
    font-size: 10px;
  }

  .public-badge {
    padding: 2px 6px;
    border-radius: 3px;
    background: rgba(16, 185, 129, 0.2);
    color: #10b981;
    font-size: 10px;
    font-weight: 600;
  }

  .selected-check {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #10b981;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .linking-actions {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 24px;
    padding-top: 16px;
    border-top: 1px solid var(--theme-stroke);
  }

  .link-confirm {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .confirm-text {
    font-size: 14px;
    color: var(--theme-text-dim);
  }

  .confirm-text strong {
    color: #10b981;
    font-family: monospace;
  }

  .confirm-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border-radius: 8px;
    border: none;
    background: #10b981;
    color: white;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    transition: all 0.2s;
  }

  .confirm-btn:hover:not(:disabled) {
    background: #059669;
  }

  .confirm-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .confirm-btn .key-hint {
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.2);
    font-family: monospace;
    font-size: 11px;
  }

  .select-prompt {
    font-size: 14px;
    color: var(--theme-text-dim);
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

  @media (max-width: 800px) {
    .linking-content {
      grid-template-columns: 1fr;
      max-height: calc(100vh - 200px);
    }

    .linking-video-panel {
      max-height: 40vh;
    }

    .linking-video-panel .video-wrapper {
      flex: 1;
      min-height: 0;
    }
  }
</style>
