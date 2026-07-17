<!--
  ShopComingSoon — the public placeholder shown at /shop until launch. Admins
  bypass this and see the live shop. Educational tone, not sales energy: the
  notation stays free; the Shop is for the made objects.
-->
<script lang="ts">
  import WaitlistForm from "./WaitlistForm.svelte";
</script>

<section class="coming-soon">
  <div class="inner">
    <span class="eyebrow"><i class="fas fa-bag-shopping" aria-hidden="true"></i> Shop</span>
    <h1>Shop opening soon</h1>
    <p class="lede">
      This is where the physical side of TKA lands. Printed Choreo card decks, the
      Level guides in print, and flow props. The notation stays free to use and
      print at home. The Shop is for the made objects.
    </p>

    <ul class="whats-coming" aria-label="What's coming">
      <li><i class="fas fa-layer-group" aria-hidden="true"></i> Choreo card decks</li>
      <li><i class="fas fa-book" aria-hidden="true"></i> Printed guides</li>
      <li><i class="fas fa-staff-snake" aria-hidden="true"></i> Materials and props</li>
    </ul>

    <WaitlistForm />
  </div>
</section>

<style>
  .coming-soon {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 96px 24px 64px;
    /* Transparent so the page's cosmic BackgroundHost shows through. */
    background: transparent;
    color: var(--theme-text, #fff);
  }

  .inner {
    width: 100%;
    max-width: 560px;
    text-align: center;
  }

  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #b8a6ff;
    margin-bottom: 18px;
  }

  h1 {
    /* Brand Fraunces wonky italic — same page-title voice as every other public
       page (token set by MarketingChrome; /shop lives under that chrome). */
    font-family: var(--page-title-font, "Fraunces", Georgia, serif);
    font-style: italic;
    font-weight: 700;
    font-variation-settings: "opsz" 144, "wght" 700, "SOFT" 0, "WONK" 1;
    font-size: clamp(2rem, 6vw, 3rem);
    margin: 0 0 16px;
    letter-spacing: -0.015em;
  }

  .lede {
    font-size: var(--font-size-lg, 1.125rem);
    line-height: 1.6;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.66));
    margin: 0 auto 28px;
  }

  .whats-coming {
    list-style: none;
    margin: 0 0 36px;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
  }
  .whats-coming li {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 500;
  }
  .whats-coming i {
    color: #8b6cff;
  }

  /* Waitlist form visuals live in WaitlistForm.svelte (shared with the
     per-product "not on sale yet" state). */

  /* 4K / ultrawide: one scale step so the gate doesn't read miniature. */
  @media (min-width: 2200px) {
    .inner {
      max-width: 720px;
    }
    .eyebrow {
      font-size: 1.05rem;
    }
    h1 {
      font-size: 3.8rem;
    }
    .lede {
      font-size: 1.4rem;
      margin-bottom: 36px;
    }
    .whats-coming li {
      font-size: 1.05rem;
      padding: 12px 20px;
    }
  }
</style>
