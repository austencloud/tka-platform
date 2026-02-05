<!--
  CreatorBadge

  Displays creator avatar and name.
  Tappable to navigate to creator's profile.
-->
<script lang="ts">
  interface Props {
    creatorId: string;
    creatorName: string;
    creatorAvatarUrl?: string;
    onClick?: (creatorId: string, creatorName: string) => void;
  }

  const { creatorId, creatorName, creatorAvatarUrl, onClick }: Props = $props();

  function handleClick(e: Event) {
    e.stopPropagation(); // Don't trigger card click
    onClick?.(creatorId, creatorName);
  }

  // Generate initials for avatar fallback
  const initials = $derived(
    creatorName
      .split(" ")
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
  );
</script>

<button class="creator-badge" onclick={handleClick} type="button">
  <div class="avatar">
    {#if creatorAvatarUrl}
      <img src={creatorAvatarUrl} alt="" loading="lazy" />
    {:else}
      <span class="initials">{initials}</span>
    {/if}
  </div>
  <span class="name">@{creatorName}</span>
</button>

<style>
  .creator-badge {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 8px 4px 4px;
    background: transparent;
    border: none;
    border-radius: 24px;
    cursor: pointer;
    transition: background var(--duration-fast, 150ms) ease;
  }

  .creator-badge:hover {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
  }

  .creator-badge:focus-visible {
    outline: 2px solid var(--theme-accent);
    outline-offset: 2px;
  }

  .avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    overflow: hidden;
    background: linear-gradient(135deg, var(--theme-accent), var(--theme-accent-hover, var(--theme-accent)));
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .initials {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: white;
  }

  .name {
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    color: var(--theme-text);
  }
</style>
