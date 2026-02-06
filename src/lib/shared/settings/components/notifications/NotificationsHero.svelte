<section class="hero">
  <div>
    <p class="eyebrow">Notifications</p>
    <h2>Control how you’re notified</h2>
  </div>
</section>

<style>
  .hero {
    padding: 18px 18px;
    background: linear-gradient(
      135deg,
      var(--theme-panel-bg),
      var(--theme-panel-elevated-bg)
    );
    border: 1px solid var(--theme-stroke);
    border-radius: 18px;
    box-shadow: var(--theme-panel-shadow, 0 14px 36px rgba(0, 0, 0, 0.4));
  }

  .hero h2 {
    margin: 4px 0 8px;
    font-size: var(--font-size-2xl);
    color: var(--theme-text);
  }

  .eyebrow {
    margin: 0;
    font-size: var(--font-size-compact);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--theme-text-dim, var(--theme-text-dim));
  }

  @media (max-width: 900px) {
    .hero {
      padding: 16px;
    }
  }

  @media (max-width: 640px) {
    .hero h2 {
      font-size: var(--font-size-xl);
    }
  }
</style>
