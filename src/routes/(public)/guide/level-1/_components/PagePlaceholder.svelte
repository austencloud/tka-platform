<script lang="ts">
  /**
   * Numbered placeholder for a manifest body page that hasn't been built yet.
   * Lets the printable guide carry its full, correctly numbered page sequence
   * while content is filled in page-by-page (see guide-manifest.ts).
   */
  let { title }: { title: string } = $props();
</script>

<div class="placeholder">
  <h2 class="ph-title">{title}</h2>
  <span class="ph-rule" aria-hidden="true"></span>
  <p class="ph-note">In progress</p>
</div>

<style>
  .placeholder {
    min-height: 9.4in;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 0.9rem;
  }
  .ph-title {
    font-family: "Fraunces", Georgia, serif;
    font-style: italic;
    font-variation-settings: "opsz" 144, "wght" 540, "WONK" 1;
    font-size: 2rem;
    color: #3a3550;
    margin: 0;
  }
  .ph-rule {
    width: 1.6in;
    height: 1px;
    background: #d8d4e4;
  }
  .ph-note {
    font-family: "Cormorant Garamond", Georgia, serif;
    font-style: italic;
    font-size: 1.05rem;
    color: #9a93ad;
    margin: 0;
  }
</style>
