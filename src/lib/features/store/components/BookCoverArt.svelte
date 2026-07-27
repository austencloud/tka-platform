<!-- src/lib/features/store/components/BookCoverArt.svelte -->
<!--
  The book's REAL cover in the shop: renders the locked Level 1 guide cover
  (GuideCover, navy edition — mandala emblem, trio arc, byline) inside a
  book-shaped frame. The cover is authored for a full 8.5x11 page with px font
  floors, so it renders at a fixed 480px width and scales down to the frame —
  identical proportions at every shop size. Decorative: hosts label the product
  in text.
-->
<script lang="ts">
  import GuideCover from "../../../../routes/(public)/guide/level-1/_components/GuideCover.svelte";

  let {
    width = "clamp(150px, 11vw, 210px)",
    viewTransitionName,
  }: {
    width?: string;
    viewTransitionName?: string;
  } = $props();

  // Native render width the cover is laid out at before scaling down.
  const NATIVE_W = 480;
  const NATIVE_H = Math.round((NATIVE_W * 11) / 8.5);

  let boxW = $state(0);
  const scale = $derived(boxW ? boxW / NATIVE_W : 0);
</script>

<div
  class="book"
  style:width
  style:view-transition-name={viewTransitionName}
  bind:clientWidth={boxW}
  aria-hidden="true"
>
  {#if scale}
    <div
      class="native"
      style:width="{NATIVE_W}px"
      style:height="{NATIVE_H}px"
      style:transform="scale({scale})"
    >
      <GuideCover theme="navy" />
    </div>
  {/if}
</div>

<style>
  .book {
    aspect-ratio: 8.5 / 11;
    position: relative;
    overflow: hidden;
    border-radius: 4px 10px 10px 4px; /* squared spine edge */
    border-left: 5px solid #8b6cff;
    box-shadow: 14px 18px 36px rgba(0, 0, 0, 0.45);
    background: #14142b; /* cover's navy ground while it mounts */
    transform: rotate(-2deg);
  }

  .native {
    position: absolute;
    top: 0;
    left: 0;
    transform-origin: top left;
  }
</style>
