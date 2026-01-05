<!--
  CreatorSection.svelte - Creator Info Display

  Discover-specific section showing the sequence creator's info.
  Only shown when viewing others' sequences (not your own).
-->
<script lang="ts">
  interface Props {
    ownerId: string;
    displayName: string;
    avatarUrl?: string;
    onProfileClick?: () => void;
  }

  let {
    ownerId,
    displayName = "Unknown Creator",
    avatarUrl,
    onProfileClick,
  }: Props = $props();
</script>

<div class="creator-section">
  <button
    class="creator-card"
    onclick={() => onProfileClick?.()}
    disabled={!onProfileClick}
    type="button"
  >
    {#if avatarUrl}
      <img src={avatarUrl} alt={displayName} class="creator-avatar" />
    {:else}
      <div class="creator-avatar placeholder">
        <i class="fas fa-user" aria-hidden="true"></i>
      </div>
    {/if}
    <div class="creator-info">
      <span class="creator-label">Created by</span>
      <span class="creator-name">{displayName}</span>
    </div>
    {#if onProfileClick}
      <i class="fas fa-chevron-right arrow" aria-hidden="true"></i>
    {/if}
  </button>
</div>

<style>
  .creator-section {
    display: flex;
    flex-direction: column;
  }

  .creator-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: var(--radius-2026-md, 14px);
    text-align: left;
    cursor: pointer;
    transition: all 0.2s ease;
    width: 100%;
    font: inherit;
  }

  .creator-card:not(:disabled):hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
  }

  .creator-card:disabled {
    cursor: default;
  }

  .creator-avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }

  .creator-avatar.placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--theme-accent) 20%, transparent);
    color: var(--theme-accent);
    font-size: 18px;
  }

  .creator-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }

  .creator-label {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .creator-name {
    font-size: var(--font-size-md, 15px);
    font-weight: 600;
    color: var(--theme-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .arrow {
    color: var(--theme-text-dim);
    font-size: 14px;
    flex-shrink: 0;
  }
</style>
