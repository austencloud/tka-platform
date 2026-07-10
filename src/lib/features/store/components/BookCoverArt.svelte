<!-- src/lib/features/store/components/BookCoverArt.svelte -->
<!--
  Typographic stand-in cover for the printed book, shared by the /shop book
  band and the /shop/book detail preview. Replace with a real photo once the
  printed book exists. Decorative: hosts label the product in text.
-->
<script lang="ts">
  let { width = "clamp(150px, 11vw, 210px)" }: { width?: string } = $props();
</script>

<div class="book-cover" style:width aria-hidden="true">
  <i class="fas fa-book-open" aria-hidden="true"></i>
  <span class="book-cover-title">The Kinetic<br />Alphabet</span>
  <span class="book-cover-sub">the book</span>
</div>

<style>
  .book-cover {
    aspect-ratio: 2 / 3;
    border-radius: 8px 14px 14px 8px; /* squared spine edge */
    border: 1px solid rgba(255, 255, 255, 0.22);
    border-left: 6px solid #8b6cff;
    background: linear-gradient(155deg, #2c3060, #15182f 78%);
    box-shadow: 14px 18px 36px rgba(0, 0, 0, 0.45);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    text-align: center;
    padding: 18px;
    transform: rotate(-2deg);
  }

  .book-cover i {
    font-size: 1.6rem;
    color: #8b6cff;
  }

  .book-cover-title {
    font-size: clamp(1.05rem, 1.2vw, 1.4rem);
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    line-height: 1.25;
    color: #fff;
  }

  .book-cover-sub {
    font-size: var(--font-size-compact, 12px);
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.55);
  }
</style>
