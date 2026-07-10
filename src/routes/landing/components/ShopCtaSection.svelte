<script lang="ts">
  /**
   * ShopCtaSection — a compact landing-page pointer to the physical Choreo
   * Cards store. Static copy, fixed sizing, no dynamic labels (no layout
   * shift risk). Button styling mirrors HeroCarouselSection's `.hero-link.primary`
   * CTA — this directory has no shared Button primitive, so the established
   * per-section pattern (grep: no `Button.svelte` under landing/) is followed
   * rather than inventing a new visual language.
   */
</script>

<section class="shop-cta" id="shop">
  <div class="container">
    <h2>Choreo Cards</h2>
    <p class="section-intro">
      <span>Physical decks of flow arts choreography.</span>
      <span>Coming soon. Join the waitlist.</span>
    </p>
    <a class="cta-link" href="/shop">
      <i class="fas fa-store" aria-hidden="true"></i>
      <span>Visit the shop</span>
    </a>
  </div>
</section>

<style>
  .shop-cta {
    padding: 96px 24px;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    text-align: center;
  }

  h2 {
    font-family: var(--landing-heading-font, "Playfair Display", Georgia, serif);
    font-size: clamp(1.6rem, 4vw, 2.2rem);
    margin-bottom: 12px;
    font-weight: 500;
    line-height: 1.2;
  }

  .section-intro {
    font-size: 1.05rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    max-width: 640px;
    margin: 0 auto 2rem;
    line-height: 1.7;
  }

  .section-intro span {
    display: block;
    text-wrap: balance;
  }

  /* Same visual family as HeroCarouselSection's `.hero-link.primary` CTA. */
  .cta-link {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    padding: 12px 22px;
    min-height: 44px;
    box-sizing: border-box;
    border-radius: 999px;
    font-family: var(--font-body, system-ui, sans-serif);
    font-size: 0.95rem;
    font-weight: 600;
    text-decoration: none;
    color: #fff;
    background: linear-gradient(135deg, #6f8cff, #8b6cff);
    border: 1px solid transparent;
    box-shadow: 0 4px 18px rgba(111, 140, 255, 0.4);
    cursor: pointer;
    transition:
      transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1),
      box-shadow 0.18s ease,
      filter 0.18s ease;
  }

  .cta-link i {
    font-size: 0.9rem;
  }

  .cta-link:hover,
  .cta-link:focus-visible {
    transform: translateY(-3px);
    box-shadow: 0 10px 30px rgba(111, 140, 255, 0.55);
    filter: brightness(1.06);
    outline: none;
  }

  .cta-link:active {
    transform: translateY(-1px);
  }

  @media (prefers-reduced-motion: reduce) {
    .cta-link {
      transition: none;
    }
  }
</style>
