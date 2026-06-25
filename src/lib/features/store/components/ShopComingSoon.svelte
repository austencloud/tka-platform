<!--
  ShopComingSoon — the public placeholder shown at /shop until launch. Admins
  bypass this and see the live shop. Educational tone, not sales energy: the
  notation stays free; the Shop is for the made objects.
-->
<script lang="ts">
  import { joinWaitlist } from "../services/waitlist";

  let email = $state("");
  let status = $state<"idle" | "submitting" | "done" | "error">("idle");
  let errorMessage = $state("");

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const canSubmit = $derived(EMAIL_RE.test(email.trim()) && status !== "submitting");

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      status = "error";
      errorMessage = "That email doesn't look right.";
      return;
    }
    status = "submitting";
    errorMessage = "";
    try {
      await joinWaitlist(email);
      status = "done";
    } catch (err) {
      console.error("[ShopComingSoon] waitlist write failed:", err);
      status = "error";
      errorMessage = "Couldn't save that just now. Try again in a moment.";
    }
  }
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

    <!-- Reserved-height slot so swapping form -> confirmation never shifts the
         layout below (no-layout-shift rule). -->
    <div class="notify-slot">
      {#if status === "done"}
        <div class="confirmed" role="status">
          <i class="fas fa-circle-check" aria-hidden="true"></i>
          <span>You're on the list. You'll get an email when the Shop opens.</span>
        </div>
      {:else}
        <form class="notify" onsubmit={handleSubmit}>
          <label class="sr-only" for="shop-waitlist-email">Email address</label>
          <input
            id="shop-waitlist-email"
            class="text-input"
            type="email"
            inputmode="email"
            autocomplete="email"
            placeholder="you@email.com"
            bind:value={email}
            aria-invalid={status === "error"}
          />
          <button class="notify-btn" type="submit" disabled={!canSubmit}>
            {#if status === "submitting"}
              <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
            {:else}
              <i class="fas fa-bell" aria-hidden="true"></i>
            {/if}
            <span>Notify me</span>
          </button>
        </form>
        <!-- error line also reserved so it doesn't push the page -->
        <p class="error-line" class:visible={status === "error"} aria-live="polite">
          {errorMessage}
        </p>
      {/if}
    </div>
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
    font-size: clamp(2rem, 6vw, 3rem);
    font-weight: 700;
    margin: 0 0 16px;
    letter-spacing: -0.02em;
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

  .notify-slot {
    min-height: 96px; /* holds form + error line OR the confirmation */
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .notify {
    display: flex;
    gap: 10px;
    width: 100%;
    max-width: 440px;
  }

  .text-input {
    flex: 1;
    min-width: 0;
    padding: 14px 18px;
    min-height: var(--min-touch-target, 44px);
    background: rgba(255, 255, 255, 0.06);
    border: 2px solid rgba(255, 255, 255, 0.14);
    border-radius: 12px;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-sm, 0.95rem);
    font-family: inherit;
    transition: border-color 0.2s ease, background 0.2s ease;
  }
  .text-input::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }
  .text-input:focus {
    outline: none;
    border-color: #8b6cff;
    background: rgba(255, 255, 255, 0.09);
  }
  .text-input[aria-invalid="true"] {
    border-color: var(--semantic-error, #ef4444);
  }

  .notify-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 0 22px;
    min-height: var(--min-touch-target, 44px);
    border: none;
    border-radius: 12px;
    background: linear-gradient(135deg, #6f8cff, #8b6cff);
    color: #fff;
    font-size: var(--font-size-sm, 0.95rem);
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    transition: filter 0.18s ease, transform 0.18s ease;
  }
  .notify-btn:hover:not(:disabled) {
    filter: brightness(1.08);
    transform: translateY(-1px);
  }
  .notify-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .error-line {
    margin: 0;
    min-height: 1.2em; /* reserved so the page never jumps */
    font-size: var(--font-size-sm, 0.85rem);
    color: var(--semantic-error, #ff8a8a);
    opacity: 0;
  }
  .error-line.visible {
    opacity: 1;
  }

  .confirmed {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    padding: 16px 22px;
    border-radius: 14px;
    background: rgba(52, 211, 153, 0.12);
    border: 1px solid rgba(52, 211, 153, 0.4);
    color: #a7f3d0;
    font-size: var(--font-size-sm, 0.95rem);
    font-weight: 600;
  }
  .confirmed i {
    font-size: 1.2rem;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @media (max-width: 480px) {
    .notify {
      flex-direction: column;
    }
    .notify-slot {
      min-height: 140px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .text-input,
    .notify-btn {
      transition: none;
    }
  }
</style>
