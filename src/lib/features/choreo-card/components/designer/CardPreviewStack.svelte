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
  import CardBackV5 from "../card-back/CardBackV5.svelte";
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

  // Front card image natural aspect ratio (width / height), detected by polling
  let cardAspect = $state(0);

  // The front card is landscape when the sequence image is meaningfully wider
  // than tall (aspect > 1.3). Near-square images (like 16-beat grids) fit
  // better in portrait. Default to landscape for the initial render.
  const frontIsLandscape = $derived(cardAspect > 0 ? cardAspect > 1.3 : false);
  const frontAR = $derived(frontIsLandscape ? CARD_LANDSCAPE : CARD_PORTRAIT);

  // Flex distribution: focused card gets 70%, other gets 30%, or 50/50
  const frontFlex = $derived(
    focusedCard === "front" ? 7 : focusedCard === "back" ? 3 : 5,
  );
  const backFlex = $derived(
    focusedCard === "back" ? 7 : focusedCard === "front" ? 3 : 5,
  );

  // Compute slot heights from flex proportions
  const totalFlex = $derived(frontFlex + backFlex);
  const availH = $derived(Math.max(0, cH - GAP));
  const frontSlotH = $derived(totalFlex > 0 ? (availH * frontFlex) / totalFlex : 0);
  const backSlotH = $derived(totalFlex > 0 ? (availH * backFlex) / totalFlex : 0);

  // Front card: fit within slot using its aspect ratio
  const frontLayout = $derived.by(() => {
    if (cW === 0 || frontSlotH === 0) return { w: 0, h: 0 };
    // Fit card with frontAR into (cW, frontSlotH)
    let h = frontSlotH;
    let w = h * frontAR;
    if (w > cW) {
      w = cW;
      h = w / frontAR;
    }
    return { w: Math.floor(w), h: Math.floor(h) };
  });

  // Back card: fit within slot using 5:7 aspect ratio (same approach as front)
  const backLayout = $derived.by(() => {
    if (cW === 0 || backSlotH === 0) return { w: 0, h: 0 };
    let h = backSlotH;
    let w = h * BACK_AR;
    if (w > cW) {
      w = cW;
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

<div class="preview-stack" bind:this={containerEl}>
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
          cardMode={true}
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
        <CardBackV5 {sequence} />
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

  .card-frame {
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    transition:
      width 300ms ease,
      height 300ms ease;
  }
</style>
