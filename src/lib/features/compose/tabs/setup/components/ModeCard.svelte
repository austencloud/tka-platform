<script lang="ts">
  /**
   * ModeCard - Individual animation mode selection card
   *
   * Bento-style card with gradient background, icon, visual preview, and metadata.
   * Visual previews show mini diagrams of each mode's layout arrangement.
   */

  import type { ComposeMode } from "$lib/features/compose/shared/state/compose-module-state.svelte";
  import { container } from "$lib/shared/di";
  import type { IHapticFeedback } from "$lib/shared/application/services/contracts/IHapticFeedback";

  interface Props {
    mode: ComposeMode;
    title: string;
    description: string;
    slotCount: number;
    gradient: string;
    onclick: () => void;
  }

  let { mode, title, description, slotCount, gradient, onclick }: Props =
    $props();

  // Visual preview configurations for each mode
  const modePreviewConfig: Record<
    ComposeMode,
    { type: string; elements: any[] }
  > = {
    single: {
      type: "single",
      elements: [{ x: 50, y: 50, width: 60, height: 70 }],
    },
    mirror: {
      type: "mirror",
      elements: [
        { x: 25, y: 50, width: 35, height: 60, mirrored: false },
        { x: 75, y: 50, width: 35, height: 60, mirrored: true },
      ],
    },
    tunnel: {
      type: "tunnel",
      elements: [
        { cx: 50, cy: 50, r: 35, opacity: 0.7 },
        { cx: 50, cy: 50, r: 25, opacity: 0.9 },
      ],
    },
    grid: {
      type: "grid",
      elements: [
        { x: 25, y: 25, size: 35 },
        { x: 75, y: 25, size: 35 },
        { x: 25, y: 75, size: 35 },
        { x: 75, y: 75, size: 35 },
      ],
    },
    "side-by-side": {
      type: "side-by-side",
      elements: [
        { x: 25, y: 50, width: 40, height: 70 },
        { x: 75, y: 50, width: 40, height: 70 },
      ],
    },
  };

  const previewConfig = $derived(modePreviewConfig[mode]);

  // Haptic feedback
  let hapticService: IHapticFeedback | undefined;

  try {
    hapticService = container.items.hapticFeedback;
  } catch (error) {
    console.warn("ModeCard: Failed to resolve HapticFeedback", error);
  }

  function handleClick() {
    hapticService?.trigger("selection");
    onclick();
  }
</script>

<button
  class="mode-card"
  style="--mode-gradient: {gradient}"
  onclick={handleClick}
  aria-label="Select {title} animation mode"
>
  <!-- Visual Mode Preview (top-right corner) -->
  <div class="mode-preview" aria-hidden="true">
    <svg viewBox="0 0 100 100" class="preview-svg">
      {#if previewConfig.type === "single"}
        <!-- Single: One centered rectangle -->
        <rect
          x={previewConfig.elements[0].x - previewConfig.elements[0].width / 2}
          y={previewConfig.elements[0].y - previewConfig.elements[0].height / 2}
          width={previewConfig.elements[0].width}
          height={previewConfig.elements[0].height}
          rx="4"
          class="preview-shape"
        />
      {:else if previewConfig.type === "mirror"}
        <!-- Mirror: Two side-by-side rectangles -->
        {#each previewConfig.elements as el}
          <rect
            x={el.x - el.width / 2}
            y={el.y - el.height / 2}
            width={el.width}
            height={el.height}
            rx="3"
            class="preview-shape"
            class:mirrored={el.mirrored}
          />
        {/each}
        <!-- Mirror line -->
        <line x1="50" y1="15" x2="50" y2="85" class="mirror-line" />
      {:else if previewConfig.type === "tunnel"}
        <!-- Tunnel: Concentric circles -->
        {#each previewConfig.elements as el}
          <circle
            cx={el.cx}
            cy={el.cy}
            r={el.r}
            class="preview-circle"
            style="opacity: {el.opacity}"
          />
        {/each}
      {:else if previewConfig.type === "grid"}
        <!-- Grid: 2x2 grid of squares -->
        {#each previewConfig.elements as el}
          <rect
            x={el.x - el.size / 2}
            y={el.y - el.size / 2}
            width={el.size}
            height={el.size}
            rx="3"
            class="preview-shape grid-cell"
          />
        {/each}
        <!-- Grid lines -->
        <line x1="50" y1="8" x2="50" y2="92" class="grid-line" />
        <line x1="8" y1="50" x2="92" y2="50" class="grid-line" />
      {/if}
    </svg>
  </div>

  <div class="mode-content">
    <h3 class="mode-title">{title}</h3>
    <p class="mode-description">{description}</p>
  </div>

  <div class="mode-meta">
    <span class="slot-count">
      <i class="fas fa-layer-group" aria-hidden="true"></i>
      {slotCount}
      {slotCount === 1 ? "sequence" : "sequences"}
    </span>
  </div>
</button>

<style>
  /* Container query context from parent grid cell */
  .mode-card {
    container-type: inline-size;
    container-name: mode-card;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
    aspect-ratio: 4 / 3;
    padding: clamp(0.875rem, 8cqi, 1.5rem);
    gap: clamp(0.5rem, 4cqi, 1rem);
    background: var(--mode-gradient);
    border: none;
    border-radius: clamp(1rem, 6cqi, 1.5rem);
    cursor: pointer;
    transition:
      transform var(--duration-fast, 150ms)
        var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1)),
      box-shadow var(--duration-fast, 150ms)
        var(--ease-out, cubic-bezier(0.16, 1, 0.3, 1));
    text-align: left;
    position: relative;
    overflow: hidden;
  }

  .mode-card::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.15) 0%,
      transparent 50%
    );
    pointer-events: none;
  }

  /* Visual Mode Preview */
  .mode-preview {
    position: absolute;
    top: clamp(0.5rem, 4cqi, 1rem);
    right: clamp(0.5rem, 4cqi, 1rem);
    width: clamp(2.5rem, 20cqi, 4.5rem);
    height: clamp(2.5rem, 20cqi, 4.5rem);
    background: rgba(0, 0, 0, 0.2);
    border-radius: clamp(0.375rem, 3cqi, 0.625rem);
    padding: clamp(0.25rem, 2cqi, 0.375rem);
    backdrop-filter: blur(4px);
    transition:
      transform 0.2s ease,
      opacity 0.2s ease;
    z-index: 1;
  }

  .mode-card:hover .mode-preview {
    transform: scale(1.05);
  }

  .preview-svg {
    width: 100%;
    height: 100%;
  }

  .preview-shape {
    fill: rgba(255, 255, 255, 0.9);
    stroke: rgba(255, 255, 255, 0.3);
    stroke-width: 1;
  }

  .preview-shape.mirrored {
    fill: rgba(255, 255, 255, 0.6);
  }

  .preview-shape.grid-cell {
    fill: rgba(255, 255, 255, 0.8);
  }

  .preview-circle {
    fill: none;
    stroke: rgba(255, 255, 255, 0.9);
    stroke-width: 2;
  }

  .mirror-line {
    stroke: rgba(255, 255, 255, 0.4);
    stroke-width: 1;
    stroke-dasharray: 3 2;
  }

  .grid-line {
    stroke: rgba(255, 255, 255, 0.3);
    stroke-width: 1;
    stroke-dasharray: 2 2;
  }

  .mode-card:hover {
    transform: translateY(-2px) scale(1.01);
    box-shadow: 0 12px 32px var(--theme-shadow);
  }

  .mode-card:active {
    transform: scale(0.98);
    transition-duration: 50ms;
  }

  .mode-card:focus {
    outline: 3px solid white;
    outline-offset: 2px;
  }

  .mode-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: clamp(0.25rem, 2cqi, 0.5rem);
    min-height: 0;
  }

  .mode-title {
    margin: 0;
    font-size: clamp(1rem, 7cqi, 1.5rem);
    font-weight: 700;
    color: white;
    line-height: 1.2;
  }

  .mode-description {
    margin: 0;
    font-size: clamp(0.75rem, 5cqi, 1rem);
    color: rgba(255, 255, 255, 0.85);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .mode-meta {
    display: flex;
    align-items: center;
    gap: clamp(0.5rem, 3cqi, 0.75rem);
    margin-top: auto;
  }

  .slot-count {
    display: flex;
    align-items: center;
    gap: clamp(0.25rem, 2cqi, 0.375rem);
    font-size: clamp(0.75rem, 4.5cqi, 0.9375rem);
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
    background: rgba(255, 255, 255, 0.15);
    padding: clamp(0.3rem, 2cqi, 0.5rem) clamp(0.6rem, 4cqi, 1rem);
    border-radius: clamp(0.5rem, 3cqi, 0.75rem);
  }

  .slot-count i {
    font-size: clamp(0.625rem, 4cqi, 0.75rem);
  }

  @media (prefers-reduced-motion: reduce) {
    .mode-card {
      transition: none;
    }

    .mode-card:hover {
      transform: none;
    }
  }
</style>
