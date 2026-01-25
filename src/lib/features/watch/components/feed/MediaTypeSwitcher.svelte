<!--
  MediaTypeSwitcher

  Pill-style buttons to switch between available media types for a card.
  Only shows buttons for media types that exist on the item.
-->
<script lang="ts">
  import type { FeedContentType } from "../../domain/models/feed-models";

  interface Props {
    hasVideo: boolean;
    hasAnimation: boolean;
    hasPictograph: boolean;
    selectedType: FeedContentType;
    onTypeChange?: (type: FeedContentType) => void;
  }

  const {
    hasVideo,
    hasAnimation,
    hasPictograph,
    selectedType,
    onTypeChange,
  }: Props = $props();

  // Only show switcher if more than one type is available
  const availableTypes = $derived.by(() => {
    const types: Array<Exclude<FeedContentType, "all">> = [];
    if (hasVideo) types.push("video");
    if (hasAnimation) types.push("animation");
    if (hasPictograph) types.push("pictograph");
    return types;
  });

  const showSwitcher = $derived(availableTypes.length > 1);

  const typeConfig: Record<Exclude<FeedContentType, "all">, { icon: string; label: string }> = {
    video: { icon: "fas fa-play", label: "Video" },
    animation: { icon: "fas fa-film", label: "Animation" },
    pictograph: { icon: "fas fa-th", label: "Card" },
  };

  function handleClick(type: FeedContentType, e: Event) {
    e.stopPropagation();
    onTypeChange?.(type);
  }
</script>

{#if showSwitcher}
  <div class="media-switcher" role="tablist" aria-label="Media type">
    {#each availableTypes as type (type)}
      {@const config = typeConfig[type]}
      <button
        class="switcher-btn"
        class:active={selectedType === type}
        onclick={(e) => handleClick(type, e)}
        type="button"
        role="tab"
        aria-selected={selectedType === type}
        aria-label={config.label}
      >
        <i class={config.icon} aria-hidden="true"></i>
      </button>
    {/each}
  </div>
{/if}

<style>
  .media-switcher {
    display: flex;
    gap: 4px;
    padding: 4px;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    border-radius: 20px;
  }

  .switcher-btn {
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: rgba(255, 255, 255, 0.7);
    font-size: var(--font-size-sm, 13px);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--duration-fast, 150ms) ease;
  }

  .switcher-btn:hover {
    color: white;
    background: rgba(255, 255, 255, 0.1);
  }

  .switcher-btn.active {
    background: white;
    color: #000;
  }

  .switcher-btn:focus-visible {
    outline: 2px solid white;
    outline-offset: 2px;
  }

  /* Touch-friendly sizing */
  @media (hover: none) and (pointer: coarse) {
    .switcher-btn {
      width: 44px;
      height: 44px;
    }
  }
</style>
