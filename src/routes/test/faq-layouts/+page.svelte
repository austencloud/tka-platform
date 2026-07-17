<script lang="ts">
  /**
   * Tuning harness for the FAQ interview layout (option B, chosen 2026-07-16;
   * the accordion and stack candidates are retired). Renders the exact
   * component the landing page ships, in the landing's dark context.
   *
   * Judge it per tier by resizing the viewport (or DevTools device toolbar):
   * ≤400 iPhone SE · ≤600 phones · 601–899 tablet stack · ≥900 editorial grid
   * · ≥2200 4K scale-up.
   */
  import FaqInterview from "$lib/shared/landing/components/FaqInterview.svelte";
</script>

<svelte:head>
  <title>FAQ interview layout — tuning</title>
</svelte:head>

<div class="page">
  <FaqInterview />
</div>

<style>
  /* Approximate the landing page's dark cosmic context so the layout is
     judged in situ, not on a white void. */
  .page {
    min-height: 100vh;
    background: linear-gradient(180deg, #0a0c18 0%, #10122a 55%, #0a0c18 100%);
    color: #ffffff;
    font-family: system-ui, -apple-system, sans-serif;
    line-height: 1.6;
    --landing-heading-font: "Playfair Display", Georgia, serif;
  }
</style>
