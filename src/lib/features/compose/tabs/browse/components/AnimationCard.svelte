<!--
AnimationCard.svelte

Card component for displaying saved animations in the browse grid.
Adapted from SequenceCard but for animations with mode indicators.

Features:
- Thumbnail or placeholder
- Animation name (truncated if long)
- Mode indicator icon
- Sequence count badge
- Creator info
- Hover effects
-->
<script lang="ts">
  import type { SavedAnimation } from "../state/browse-state.svelte";
  import { COMPOSE_MODE_CONFIG } from "$lib/features/compose/shared/domain/compose-mode-config";

  const {
    animation,
    selected = false,
    onPrimaryAction = () => {},
  }: {
    animation: SavedAnimation;
    selected?: boolean;
    onPrimaryAction?: (animation: SavedAnimation) => void;
  } = $props();

  // Get mode config from centralized source
  const modeConfig = $derived(COMPOSE_MODE_CONFIG[animation.mode]);

  // Truncate title to 24 characters
  const displayTitle = $derived.by(() => {
    const name = animation.name || "Untitled";
    if (name.length <= 24) {
      return name;
    }
    return name.substring(0, 24) + "…";
  });

  function handleClick() {
    onPrimaryAction(animation);
  }
</script>

<button type="button" class="animation-card" class:selected onclick={handleClick}>
  <!-- Thumbnail / Placeholder -->
  <div class="card-media">
    {#if animation.thumbnailUrl}
      <img
        src={animation.thumbnailUrl}
        alt={animation.name}
        class="thumbnail"
      />
    {:else}
      <div
        class="placeholder"
        style="background: {modeConfig.gradient}"
      >
        <!-- Visual mode preview SVG -->
        <svg viewBox="0 0 100 100" class="mode-preview-svg" aria-hidden="true">
          {#if animation.mode === "single"}
            <!-- Single: One centered rectangle -->
            <rect
              x="20"
              y="15"
              width="60"
              height="70"
              rx="4"
              class="preview-shape"
              style="--accent: {modeConfig.accent}"
            />
          {:else if animation.mode === "mirror"}
            <!-- Mirror: Two side-by-side rectangles -->
            <rect
              x="8"
              y="20"
              width="35"
              height="60"
              rx="3"
              class="preview-shape"
              style="--accent: {modeConfig.accent}"
            />
            <rect
              x="57"
              y="20"
              width="35"
              height="60"
              rx="3"
              class="preview-shape mirrored"
              style="--accent: {modeConfig.accent}"
            />
            <line
              x1="50"
              y1="15"
              x2="50"
              y2="85"
              class="mirror-line"
              style="--accent: {modeConfig.accent}"
            />
          {:else if animation.mode === "tunnel"}
            <!-- Tunnel: Concentric circles -->
            <circle
              cx="50"
              cy="50"
              r="38"
              class="preview-circle outer"
              style="--accent: {modeConfig.accent}"
            />
            <circle
              cx="50"
              cy="50"
              r="26"
              class="preview-circle inner"
              style="--accent: {modeConfig.accent}"
            />
          {:else if animation.mode === "grid"}
            <!-- Grid: 2x2 grid of squares -->
            <rect
              x="8"
              y="8"
              width="38"
              height="38"
              rx="3"
              class="preview-shape"
              style="--accent: {modeConfig.accent}"
            />
            <rect
              x="54"
              y="8"
              width="38"
              height="38"
              rx="3"
              class="preview-shape"
              style="--accent: {modeConfig.accent}"
            />
            <rect
              x="8"
              y="54"
              width="38"
              height="38"
              rx="3"
              class="preview-shape"
              style="--accent: {modeConfig.accent}"
            />
            <rect
              x="54"
              y="54"
              width="38"
              height="38"
              rx="3"
              class="preview-shape"
              style="--accent: {modeConfig.accent}"
            />
            <line
              x1="50"
              y1="5"
              x2="50"
              y2="95"
              class="grid-line"
              style="--accent: {modeConfig.accent}"
            />
            <line
              x1="5"
              y1="50"
              x2="95"
              y2="50"
              class="grid-line"
              style="--accent: {modeConfig.accent}"
            />
          {/if}
        </svg>
        <span class="mode-label" style="color: {modeConfig.accent}"
          >{modeConfig.label}</span
        >
      </div>
    {/if}

    <!-- Mode indicator badge -->
    <div class="mode-badge" title={modeConfig.label}>
      <i class="fas {modeConfig.icon}" aria-hidden="true"></i>
    </div>

    <!-- Favorite indicator -->
    {#if animation.isFavorite}
      <div class="favorite-badge" title="Favorite">
        <i class="fas fa-heart" aria-hidden="true"></i>
      </div>
    {/if}
  </div>

  <!-- Card footer -->
  <div class="card-footer">
    <h3 class="animation-title">{displayTitle}</h3>
    <div class="card-meta">
      <span class="sequence-count" title="Number of sequences">
        <i class="fas fa-file-alt" aria-hidden="true"></i>
        {animation.sequences.length}
      </span>
      <span class="creator" title="Creator">
        <i class="fas fa-user" aria-hidden="true"></i>
        {animation.creator}
      </span>
    </div>
  </div>
</button>

<style>
  .animation-card {
    position: relative;
    border-radius: 8px;
    overflow: hidden;
    background: var(--theme-card-bg, rgba(8, 8, 12, 0.9));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, #fff);
    display: flex;
    flex-direction: column;
    box-shadow: 0 12px 40px var(--theme-shadow, rgba(0, 0, 0, 0.35));
    width: 100%;
    height: 100%;
    padding: 0;
    margin: 0;
    cursor: pointer;
    transition:
      transform 0.15s cubic-bezier(0.4, 0, 0.2, 1),
      box-shadow 0.15s cubic-bezier(0.4, 0, 0.2, 1),
      border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .animation-card:hover {
    transform: scale(1.02);
    box-shadow: 0 14px 48px var(--theme-shadow, rgba(0, 0, 0, 0.38));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.12));
  }

  /* Active state for mobile */
  @media (hover: none) and (pointer: coarse) {
    .animation-card:active {
      transform: scale(0.98);
      transition-duration: var(--duration-instant);
    }
  }

  .animation-card:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .animation-card.selected {
    border-color: color-mix(
      in srgb,
      var(--theme-accent, var(--theme-accent)) 80%,
      transparent
    );
    box-shadow: 0 0 0 2px
      color-mix(
        in srgb,
        var(--theme-accent, var(--theme-accent)) 40%,
        transparent
      );
  }

  /* Card Media */
  .card-media {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    overflow: hidden;
  }

  .thumbnail {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .mode-preview-svg {
    width: 60%;
    height: 60%;
    max-width: 80px;
    max-height: 80px;
  }

  .preview-shape {
    fill: var(--accent, rgba(255, 255, 255, 0.3));
    fill-opacity: 0.25;
    stroke: var(--accent, rgba(255, 255, 255, 0.5));
    stroke-width: 2;
  }

  .preview-shape.mirrored {
    fill-opacity: 0.15;
  }

  .preview-circle {
    fill: none;
    stroke: var(--accent, rgba(255, 255, 255, 0.5));
    stroke-width: 2;
  }

  .preview-circle.outer {
    stroke-opacity: 0.5;
  }

  .preview-circle.inner {
    stroke-opacity: 0.8;
    fill: var(--accent, rgba(255, 255, 255, 0.3));
    fill-opacity: 0.1;
  }

  .mirror-line {
    stroke: var(--accent, rgba(255, 255, 255, 0.3));
    stroke-width: 1.5;
    stroke-dasharray: 4 3;
    stroke-opacity: 0.6;
  }

  .grid-line {
    stroke: var(--accent, rgba(255, 255, 255, 0.3));
    stroke-width: 1;
    stroke-dasharray: 3 3;
    stroke-opacity: 0.4;
  }

  .mode-label {
    font-size: var(--font-size-compact);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.8;
  }

  /* Mode badge */
  .mode-badge {
    position: absolute;
    top: 8px;
    left: 8px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-panel-bg, rgba(0, 0, 0, 0.7));
    backdrop-filter: blur(8px);
    border-radius: 6px;
    border: 1px solid var(--theme-stroke);
    font-size: var(--font-size-sm);
    color: var(--theme-text);
  }

  /* Favorite badge */
  .favorite-badge {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--semantic-error, #ef4444) 20%, transparent);
    backdrop-filter: blur(8px);
    border-radius: 6px;
    border: 1px solid color-mix(in srgb, var(--semantic-error, #ef4444) 40%, transparent);
    font-size: var(--font-size-sm);
    color: var(--semantic-error);
  }

  /* Card Footer */
  .card-footer {
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: var(--theme-panel-bg, rgba(20, 20, 30, 0.95));
  }

  .animation-title {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--theme-text, rgba(255, 255, 255, 0.95));
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .card-meta {
    display: flex;
    gap: 12px;
    font-size: var(--font-size-compact);
    color: var(--theme-text-dim);
  }

  .card-meta span {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .card-meta i {
    font-size: var(--font-size-compact);
    opacity: 0.7;
  }

  /* Responsive adjustments */
  @container (max-width: 200px) {
    .card-footer {
      padding: 8px;
      gap: 6px;
    }

    .animation-title {
      font-size: var(--font-size-compact);
    }

    .card-meta {
      font-size: var(--font-size-compact);
      gap: 8px;
    }

    .mode-badge,
    .favorite-badge {
      width: 28px;
      height: 28px;
      font-size: var(--font-size-compact);
    }

    .placeholder-icon {
      font-size: var(--font-size-3xl);
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .animation-card {
      transition: none;
    }

    .animation-card:hover {
      transform: none;
    }
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    * {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
    }
  }
</style>
