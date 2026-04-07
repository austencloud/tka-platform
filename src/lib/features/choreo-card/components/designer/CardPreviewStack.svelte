<!--
  CardPreviewStack.svelte - Stacked front+back card preview with toggleable focus

  Renders front card on top, back card below. Click either card to expand it
  to 70% of the vertical space (the other shrinks to 30%). Click the focused
  card again to return to 50/50. Uses ResizeObserver to track container
  dimensions and computes per-card scaling to fit within each slot.
-->
<script lang="ts">
  import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
  import ChoreoCard from "../ChoreoCard.svelte";
  import CardBack from "../card-back/CardBack.svelte";
  import InfoCardFront from "../card-back/InfoCardFront.svelte";
  import InfoCardBack from "../card-back/InfoCardBack.svelte";

  interface Props {
    sequence: SequenceData | null;
    focusedCard: "front" | "back" | null;
    onFocusChange: (focused: "front" | "back" | null) => void;
    handPointsVisible: boolean;
    showGrid: boolean;
    showTKA: boolean;
    showWord: boolean;
    includeStartPosition: boolean;
    startPositionLayout: "row" | "column";
    showBirthday: boolean;
    showQRCode: boolean;
    showInfoCard: boolean;
    /** Use print layout (matching the grid view) instead of 5:7 card layout */
    printMode?: boolean;
    /** Pre-rendered front image URL — displays this instead of re-rendering */
    frontImageUrl?: string | null;
    onCardContextMenu?: (x: number, y: number, rerender: () => void) => void;
  }

  let {
    sequence,
    focusedCard,
    onFocusChange,
    handPointsVisible,
    showGrid,
    showTKA,
    showWord,
    includeStartPosition,
    startPositionLayout,
    showBirthday,
    showQRCode,
    showInfoCard,
    printMode = false,
    frontImageUrl,
    onCardContextMenu,
  }: Props = $props();

  // Playing card proportions: 2.5" x 3.5" = 5:7
  const CARD_PORTRAIT = 5 / 7;
  const CARD_LANDSCAPE = 7 / 5;
  const BACK_AR = 5 / 7; // Back card is always portrait 5:7
  const GAP = 16;

  // Container dimensions via ResizeObserver
  let containerEl: HTMLDivElement | undefined = $state();
  let cW = $state(0);
  let cH = $state(0);

  $effect(() => {
    if (!containerEl) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) {
        cW = r.width;
        cH = r.height;
      }
    });
    ro.observe(containerEl);
    return () => ro.disconnect();
  });

  // When the container is wider than tall, lay out side by side
  const isHorizontal = $derived(cW > cH * 1.2);

  // Front card image natural aspect ratio (width / height), detected by polling
  let cardAspect = $state(0);

  // Print mode: both front and back use 5:7 so they match as a physical card pair.
  // Card mode: detect from the rendered image aspect ratio.
  const frontIsLandscape = $derived(
    printMode ? false : (cardAspect > 0 ? cardAspect > 1.3 : false)
  );
  const frontAR = $derived(
    printMode ? CARD_PORTRAIT : (frontIsLandscape ? CARD_LANDSCAPE : CARD_PORTRAIT)
  );

  // Flex distribution: focused card gets 70%, other gets 30%, or 50/50
  const frontFlex = $derived(
    focusedCard === "front" ? 7 : focusedCard === "back" ? 3 : 5,
  );
  const backFlex = $derived(
    focusedCard === "back" ? 7 : focusedCard === "front" ? 3 : 5,
  );

  // Compute slot sizes from flex proportions along the layout axis
  const totalFlex = $derived(frontFlex + backFlex);
  const availMain = $derived(Math.max(0, (isHorizontal ? cW : cH) - GAP));
  const frontSlotMain = $derived(totalFlex > 0 ? (availMain * frontFlex) / totalFlex : 0);
  const backSlotMain = $derived(totalFlex > 0 ? (availMain * backFlex) / totalFlex : 0);

  // Cross-axis is the full container dimension perpendicular to layout direction
  const crossAxis = $derived(isHorizontal ? cH : cW);

  // Front card: fit within its slot
  const frontLayout = $derived.by(() => {
    const slotW = isHorizontal ? frontSlotMain : crossAxis;
    const slotH = isHorizontal ? crossAxis : frontSlotMain;
    if (slotW === 0 || slotH === 0) return { w: 0, h: 0 };
    let h = slotH;
    let w = h * frontAR;
    if (w > slotW) {
      w = slotW;
      h = w / frontAR;
    }
    return { w: Math.floor(w), h: Math.floor(h) };
  });

  // Back card: fit within its slot using 5:7 aspect ratio
  const backLayout = $derived.by(() => {
    const slotW = isHorizontal ? backSlotMain : crossAxis;
    const slotH = isHorizontal ? crossAxis : backSlotMain;
    if (slotW === 0 || slotH === 0) return { w: 0, h: 0 };
    let h = slotH;
    let w = h * BACK_AR;
    if (w > slotW) {
      w = slotW;
      h = w / BACK_AR;
    }
    return { w: Math.floor(w), h: Math.floor(h) };
  });

  function handleFrontClick() {
    onFocusChange(focusedCard === "front" ? null : "front");
  }

  function handleBackClick() {
    onFocusChange(focusedCard === "back" ? null : "back");
  }

  // Observe the front card image to get its natural aspect ratio.
  // Poll briefly because the image loads async via PropAwareThumbnail.
  function watchForImage(node: HTMLElement) {
    let attempts = 0;
    const check = () => {
      const img = node.querySelector("img") as HTMLImageElement | null;
      if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
        cardAspect = img.naturalWidth / img.naturalHeight;
        return;
      }
      if (attempts++ < 50) requestAnimationFrame(check);
    };
    check();

    // Re-check when the image swaps (navigating between sequences)
    const mo = new MutationObserver(() => {
      attempts = 0;
      check();
    });
    mo.observe(node, { childList: true, subtree: true });

    return { destroy() { mo.disconnect(); } };
  }
</script>

<div class="preview-stack" class:horizontal={isHorizontal} class:print-mode={printMode} bind:this={containerEl}>
  <!-- Front card slot -->
  <button
    class="card-slot front-slot"
    style="flex: {frontFlex};"
    onclick={handleFrontClick}
    aria-label="Front card preview — click to {focusedCard === 'front' ? 'equalize' : 'focus'}"
  >
    <div
      class="card-frame"
      style="width: {frontLayout.w}px; height: {frontLayout.h}px;"
      use:watchForImage
    >
      {#if showInfoCard}
        <InfoCardFront />
      {:else if sequence}
        <ChoreoCard
          {sequence}
          showWord={showWord}
          handPointsVisible={handPointsVisible}
          showGrid={showGrid}
          showTKA={showTKA}
          includeStartPosition={includeStartPosition}
          {startPositionLayout}
          showQRCodes={showQRCode}
          showBirthday={showBirthday}
          printMode={printMode}
          cardMode={!printMode}
          preRenderedImageUrl={printMode ? frontImageUrl : undefined}
          onContextMenu={onCardContextMenu}
        />
      {/if}
    </div>
  </button>

  <!-- Back card slot -->
  <button
    class="card-slot back-slot"
    style="flex: {backFlex};"
    onclick={handleBackClick}
    aria-label="Back card preview — click to {focusedCard === 'back' ? 'equalize' : 'focus'}"
  >
    <div
      class="card-frame back-frame"
      style="width: {backLayout.w}px; height: {backLayout.h}px;"
    >
      {#if showInfoCard}
        <InfoCardBack />
      {:else if sequence}
        <CardBack {sequence} />
      {/if}
    </div>
  </button>
</div>

<style>
  .preview-stack {
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: 16px;
    align-items: center;
    padding: 8px;
    overflow: hidden;
  }

  .preview-stack.horizontal {
    flex-direction: row;
    justify-content: center;
  }

  .card-slot {
    display: flex;
    align-items: center;
    justify-content: center;
    transition: flex 300ms ease;
    overflow: visible;
    background: none;
    border: none;
    cursor: pointer;
    width: 100%;
    min-height: 0;
  }

  .horizontal .card-slot {
    height: 100%;
    min-width: 0;
  }

  .card-frame {
    border-radius: 5%;
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    transition:
      width 300ms ease,
      height 300ms ease;
    container-type: inline-size;
  }

  .preview-stack.print-mode .card-frame {
    background: #ffffff;
  }

  /* Back card has dark content — transparent bg so corners don't show white */
  .preview-stack.print-mode .back-frame {
    background: transparent;
  }

  /* CardBack's .border-frame uses cqi units that scale too large at preview size.
     Match the outer card-frame's radius so the gradient border follows the curve. */
  .card-frame :global(.border-frame) {
    border-radius: 5%;
  }

  .card-frame :global(.back) {
    border-radius: 3.5%;
  }
</style>
