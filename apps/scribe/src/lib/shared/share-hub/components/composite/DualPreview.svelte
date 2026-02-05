<!--
  DualPreview.svelte

  Responsive dual preview layout for Composite mode.
  Shows two MediaPieceCard components arranged horizontally or vertically.

  Features:
  - Responsive layout based on orientation setting
  - Side-by-side (horizontal) or stacked (vertical)
  - Each piece has gear icon for settings
  - Maintains aspect ratio
  - Mobile-friendly (automatically switches to vertical on small screens)

  Domain: Share Hub - Composite Mode - Dual Preview
-->
<script lang="ts">
  import { getShareHubState } from "../../state/share-hub-state.svelte";
  import MediaPieceCard from "./MediaPieceCard.svelte";

  // FIX: Use 'hubState' instead of 'state' to avoid collision with $state rune
  const hubState = getShareHubState();
  const isHorizontal = $derived(
    hubState.compositeLayout.orientation === "horizontal"
  );
</script>

<div
  class="dual-preview"
  class:horizontal={isHorizontal}
  class:vertical={!isHorizontal}
>
  <!-- Piece 1 (Left/Top) -->
  <div class="piece-container piece-1">
    <MediaPieceCard
      pieceIndex={1}
      format={hubState.compositeLayout.piece1}
      label="Piece 1"
    />
  </div>

  <!-- Piece 2 (Right/Bottom) -->
  <div class="piece-container piece-2">
    <MediaPieceCard
      pieceIndex={2}
      format={hubState.compositeLayout.piece2}
      label="Piece 2"
    />
  </div>
</div>

<style>
  .dual-preview {
    display: flex;
    gap: 16px;
    width: 100%;
    height: 100%;
    min-height: 0;
  }

  .dual-preview.horizontal {
    flex-direction: row;
  }

  .dual-preview.vertical {
    flex-direction: column;
  }

  .piece-container {
    flex: 1;
    min-width: 0; /* Allow flex children to shrink */
    min-height: 0;
    display: flex;
  }

  /* Ensure equal sizing in horizontal layout */
  .dual-preview.horizontal .piece-container {
    width: 0; /* Force flex to distribute space equally */
  }

  /* Ensure equal sizing in vertical layout */
  .dual-preview.vertical .piece-container {
    height: 0; /* Force flex to distribute space equally */
  }

  /* Mobile optimization - always vertical on small screens */
  @media (max-width: 768px) {
    .dual-preview {
      flex-direction: column !important;
    }

    .dual-preview .piece-container {
      width: auto;
      height: 0;
    }
  }

  /* Tablet - respect horizontal orientation but with smaller gap */
  @media (min-width: 769px) and (max-width: 1024px) {
    .dual-preview {
      gap: 12px;
    }
  }
</style>
