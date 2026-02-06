<!--
  MediaSearchBar.svelte - Search input with favorites toggle
-->
<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte.js";

  interface Props {
    searchQuery: string;
    isFavoritesActive: boolean;
    onSearchChange: (query: string) => void;
    onFavoritesToggle: (active: boolean) => void;
  }

  let {
    searchQuery,
    isFavoritesActive,
    onSearchChange,
    onFavoritesToggle,
  }: Props = $props();
</script>

<div class="search-bar" role="search" aria-label={t("search_media")}>
  <i class="fas fa-search" aria-hidden="true"></i>
  <input
    type="text"
    placeholder={t("search_placeholder")}
    value={searchQuery}
    oninput={(e) => onSearchChange(e.currentTarget.value)}
  />
  <button
    class="favorites-btn"
    class:active={isFavoritesActive}
    onclick={() => onFavoritesToggle(!isFavoritesActive)}
    title={t("favorites")}
    aria-label={t("favorites_toggle")}
  >
    <i class="fas fa-heart" aria-hidden="true"></i>
  </button>
  {#if searchQuery}
    <button
      class="clear-btn"
      onclick={() => onSearchChange("")}
      aria-label={t("search_clear")}
    >
      <i class="fas fa-times" aria-hidden="true"></i>
    </button>
  {/if}
</div>

<style>
  .search-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: var(--theme-panel-elevated-bg);
    border-bottom: 1px solid var(--theme-stroke);
    flex-shrink: 0;
  }

  .search-bar i {
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
  }

  .search-bar input {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--theme-text);
    font-size: var(--font-size-min);
    outline: none;
    min-width: 0;
  }

  .search-bar input::placeholder {
    color: var(--theme-text-dim);
  }

  .favorites-btn {
    width: 48px; /* WCAG AAA touch target */
    height: 48px;
    border-radius: 50%;
    border: 1px solid var(--theme-stroke);
    background: var(--theme-card-hover-bg);
    color: var(--theme-text-dim);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-sm);
    transition: all var(--duration-normal) ease;
    margin-left: auto;
  }

  .favorites-btn:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: #ec4899;
    transform: scale(1.1);
  }

  .favorites-btn.active {
    background: linear-gradient(
      135deg,
      rgba(244, 114, 182, 0.25) 0%,
      rgba(236, 72, 153, 0.2) 100%
    );
    border-color: #ec4899;
    color: #ec4899;
    box-shadow: 0 0 12px rgba(236, 72, 153, 0.3);
  }

  .favorites-btn.active:hover {
    background: linear-gradient(
      135deg,
      rgba(244, 114, 182, 0.35) 0%,
      rgba(236, 72, 153, 0.3) 100%
    );
    transform: scale(1.1);
  }

  .clear-btn {
    width: 48px; /* WCAG AAA touch target */
    height: 48px;
    border-radius: 50%;
    border: 1px solid var(--theme-stroke);
    background: var(--theme-card-hover-bg);
    color: var(--theme-text-dim);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-compact);
    transition: all var(--duration-normal) ease;
  }

  .clear-btn:hover {
    background: var(--theme-accent);
    border-color: var(--theme-accent);
    color: white;
    box-shadow: 0 0 8px color-mix(in srgb, var(--theme-accent) 40%, transparent);
  }
</style>
