<!-- src/lib/features/store/components/OrderConfirmation.svelte -->
<script lang="ts">
</script>

<div class="confirmation-page">
  <main class="confirmation-content">
    <div class="success-icon">
      <i class="fas fa-check-circle" aria-hidden="true"></i>
    </div>
    <h1>Order Confirmed</h1>
    <p>Your deck is on its way. You'll get a receipt from Stripe at the email you provided.</p>
    <p class="note">Orders are packed and shipped within a few business days.</p>
    <a href="/shop" class="back-link">Back to Shop</a>
  </main>
</div>

<style>
  .confirmation-page {
    min-height: 100vh;
    padding-top: 64px; /* clear the fixed SiteHeader */
    /* Transparent so the /shop cosmic background shows through (no dark panel). */
    background: transparent;
    color: var(--theme-text, #ffffff);
  }

  .confirmation-content {
    max-width: 600px;
    margin: 0 auto;
    padding: 80px 24px;
    text-align: center;
  }

  .success-icon {
    font-size: 64px;
    color: var(--semantic-success, #22c55e);
    margin-bottom: 24px;
  }

  h1 {
    font-size: 2rem;
    margin: 0 0 16px;
  }

  p {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    margin: 0 0 8px;
  }

  .note {
    font-size: var(--font-size-compact, 12px);
    margin-top: 16px;
  }

  .back-link {
    display: inline-block;
    margin-top: 32px;
    padding: 12px 24px;
    background: var(--theme-accent, #60a5fa);
    color: var(--theme-text-on-accent, #fff);
    text-decoration: none;
    border-radius: 8px;
    font-weight: 600;
  }
</style>
