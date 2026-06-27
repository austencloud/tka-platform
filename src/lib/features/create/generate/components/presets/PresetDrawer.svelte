<!--
  PresetDrawer - Favorites selection drawer
  Desktop: right-side panel matching other create module drawers.
  Mobile: bottom sheet.
  Follows CustomizeDrawer pattern: portal + Drawer always in DOM.
-->
<script lang="ts">
  import Drawer from "$lib/shared/foundation/ui/Drawer.svelte";
  import { portal } from "../modals/portal";
  import type { FavoriteConfig, CommunityFavorite } from "../../domain/models/favorite-config";

  let {
    isOpen,
    myFavorite = null,
    communityFavorites = [],
    activeFavoriteId = null,
    isLoading = false,
    onActivateMine,
    onActivateCommunity,
    onSaveAsFavorite,
    onClose,
  }: {
    isOpen: boolean;
    myFavorite?: FavoriteConfig | null;
    communityFavorites?: CommunityFavorite[];
    activeFavoriteId?: string | null;
    isLoading?: boolean;
    onActivateMine?: () => void;
    onActivateCommunity?: (userId: string) => void;
    onSaveAsFavorite?: () => void;
    onClose?: () => void;
  } = $props();

  function summarize(fav: FavoriteConfig | CommunityFavorite): string {
    const c = fav.config;
    const parts: string[] = [];
    parts.push(`L${c.level}`);
    parts.push(c.gridMode === "diamond" ? "Diamond" : "Box");
    parts.push(`${c.length}ct`);
    if (c.loopEnabled) parts.push("LOOP");
    return parts.join(" \u00B7 ");
  }

  function getInitial(name: string): string {
    return name.charAt(0).toUpperCase();
  }

  /** Deterministic color from a string (for avatar fallback circles) */
  function avatarColor(seed: string): string {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = ((hash % 360) + 360) % 360;
    return `hsl(${h}, 55%, 50%)`;
  }
</script>

<div use:portal>
  <Drawer
    {isOpen}
    placement="right"
    respectLayoutMode={true}
    closeOnBackdrop={true}
    ariaLabel="Browse favorites"
    class="preset-drawer-sheet"
    onclose={onClose}
  >
    <div class="preset-drawer-content">
      <h3 class="drawer-title">Favorites</h3>

      <!-- Your Favorite section -->
      <section class="section">
        <h4 class="section-heading">Your Favorite</h4>

        {#if myFavorite}
          <button
            class="favorite-item"
            class:active={activeFavoriteId === "mine"}
            onclick={() => onActivateMine?.()}
          >
            <div class="favorite-info">
              <span class="favorite-name">My Favorite</span>
              <span class="favorite-summary">{summarize(myFavorite)}</span>
            </div>
            {#if activeFavoriteId === "mine"}
              <span class="active-badge">Active</span>
            {/if}
          </button>
        {:else}
          <button
            class="save-button"
            onclick={() => onSaveAsFavorite?.()}
          >
            Save Current Config as My Favorite
          </button>
        {/if}
      </section>

      <!-- Community Favorites section -->
      <section class="section">
        <h4 class="section-heading">Community Favorites</h4>

        {#if isLoading}
          <p class="empty-message">Loading community favorites...</p>
        {:else if communityFavorites.length === 0}
          <p class="empty-message">No community favorites yet</p>
        {:else}
          <div class="community-list">
            {#each communityFavorites as fav (fav.userId)}
              <button
                class="favorite-item"
                class:active={activeFavoriteId === fav.userId}
                onclick={() => onActivateCommunity?.(fav.userId)}
              >
                {#if fav.avatar}
                  <img
                    class="avatar"
                    src={fav.avatar}
                    alt={fav.displayName}
                    width="32"
                    height="32"
                  />
                {:else}
                  <span
                    class="avatar-fallback"
                    style="background: {avatarColor(fav.userId)}"
                  >
                    {getInitial(fav.displayName)}
                  </span>
                {/if}
                <div class="favorite-info">
                  <span class="favorite-name">{fav.displayName}</span>
                  <span class="favorite-summary">{summarize(fav)}</span>
                </div>
                {#if activeFavoriteId === fav.userId}
                  <span class="active-badge">Active</span>
                {/if}
              </button>
            {/each}
          </div>
        {/if}
      </section>
    </div>
  </Drawer>
</div>

<style>
  :global(.drawer-content.preset-drawer-sheet) {
    --sheet-bg: transparent;
    --sheet-border: none;
    --sheet-shadow: 0 -4px 24px rgba(0, 0, 0, 0.5);
  }

  /* Bottom sheet on mobile - auto-size to content, don't take full screen */
  :global(.drawer-content.preset-drawer-sheet[data-placement="bottom"]) {
    height: auto;
    min-height: auto;
    max-height: 85dvh;
  }

  /* Right-side panel on desktop - use full create panel width like LOOP drawer */

  .preset-drawer-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 12px 16px calc(16px + env(safe-area-inset-bottom, 0px));
    background: linear-gradient(
      135deg,
      color-mix(in srgb, #e11d48 20%, #1a1a2e) 0%,
      color-mix(in srgb, #be123c 12%, #1a1a2e) 50%,
      color-mix(in srgb, #e11d48 16%, #1a1a2e) 100%
    );
    gap: 12px;
  }

  .drawer-title {
    font-size: var(--font-size-base, 16px);
    font-weight: 700;
    color: var(--theme-text, #fff);
    margin: 0;
    text-align: center;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .section-heading {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text, #fff);
    opacity: 0.6;
    margin: 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .favorite-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: rgba(255, 255, 255, 0.06);
    border: 1.5px solid rgba(255, 255, 255, 0.12);
    border-radius: var(--radius-md, 8px);
    color: var(--theme-text, #fff);
    cursor: pointer;
    transition: border-color 150ms ease;
    min-height: var(--min-touch-target, 44px);
    text-align: left;
    width: 100%;
    font: inherit;
  }

  .favorite-item:hover {
    border-color: rgba(255, 255, 255, 0.25);
  }

  .favorite-item.active {
    border-color: var(--theme-accent, #3b82f6);
    background: rgba(59, 130, 246, 0.15);
  }

  .favorite-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    flex: 1;
    min-width: 0;
  }

  .favorite-name {
    font-weight: 600;
    font-size: var(--font-size-min, 14px);
  }

  .favorite-summary {
    font-size: var(--font-size-compact, 12px);
    opacity: 0.7;
  }

  .active-badge {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-accent, #3b82f6);
    flex-shrink: 0;
  }

  .avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }

  .avatar-fallback {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    color: #fff;
    flex-shrink: 0;
  }

  .save-button {
    padding: 0.75rem 1rem;
    background: rgba(59, 130, 246, 0.2);
    border: 1.5px dashed rgba(59, 130, 246, 0.5);
    border-radius: var(--radius-md, 8px);
    color: var(--theme-accent, #3b82f6);
    cursor: pointer;
    font: inherit;
    font-weight: 600;
    font-size: var(--font-size-min, 14px);
    min-height: var(--min-touch-target, 44px);
    transition: background 150ms ease, border-color 150ms ease;
    width: 100%;
    text-align: center;
  }

  .save-button:hover {
    background: rgba(59, 130, 246, 0.3);
    border-color: rgba(59, 130, 246, 0.7);
  }

  .community-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
  }

  .empty-message {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text, #fff);
    opacity: 0.5;
    margin: 0;
    padding: 0.5rem 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .favorite-item,
    .save-button {
      transition: none;
    }
  }
</style>
