<!--
  /guide — the Guide hub. A standalone page (landing chrome: SiteHeader +
  LandingFooter) that explains the Level 1 guide is being rewritten for the web,
  frames the old printable PDFs honestly, surfaces them via the existing
  GuidesSection component, and offers an announce-me email form.

  This is NOT the in-progress guide itself. /guide/level-1 and its sub-routes are
  owned by another agent's rewrite and are deliberately not linked from here yet.
-->
<script lang="ts">
  import SiteHeader from "$lib/shared/landing/components/SiteHeader.svelte";
  import LandingFooter from "../../landing/components/LandingFooter.svelte";
  import GuidesSection from "../../landing/components/GuidesSection.svelte";
  import { joinWaitlist } from "$lib/features/store/services/waitlist";

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
      await joinWaitlist(email, "guide-coming-soon");
      status = "done";
    } catch (err) {
      console.error("[GuidePage] waitlist write failed:", err);
      status = "error";
      errorMessage = "Couldn't save that just now. Try again in a moment.";
    }
  }
</script>

<svelte:head>
  <title>Guide | The Kinetic Alphabet</title>
  <meta
    name="description"
    content="The Level 1 guide to The Kinetic Alphabet notation is being rewritten for the web. Print the old PDF guides in the meantime, or get notified when the new guide is out."
  />
  <link rel="canonical" href="https://tkaflowarts.com/guide" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://tkaflowarts.com/guide" />
  <meta property="og:title" content="Guide | The Kinetic Alphabet" />
  <meta
    property="og:description"
    content="The Level 1 notation guide is being rewritten for the web. Print the old PDF guides in the meantime, or get notified when the new one is out."
  />
</svelte:head>

<SiteHeader />

<main class="guide-page">
  <section class="intro" aria-labelledby="guide-intro-heading">
    <div class="inner">
      <span class="eyebrow">
        <i class="fas fa-book-open" aria-hidden="true"></i> Guide
      </span>
      <h1 id="guide-intro-heading">The Level 1 guide is being rewritten for the web</h1>
      <p class="lede">
        We're rebuilding the Level 1 guide as interactive web pages: the grid,
        all six letter types, and your first words. It is in progress, so the
        full guide is not live yet.
      </p>
    </div>
  </section>

  <section class="old-guides" aria-labelledby="old-guides-heading">
    <div class="inner">
      <h2 id="old-guides-heading">The old printable guides</h2>
      <p class="note">
        These are the old printable guides. They are incomplete and we are in the
        middle of rewriting the guide for the web. You are welcome to print these
        in the meantime.
      </p>
    </div>
    <GuidesSection />
  </section>

  <section class="notify" aria-labelledby="notify-heading">
    <div class="inner">
      <h2 id="notify-heading">Get notified when the new guide is out</h2>
      <p class="notify-intro">
        Leave your email and we'll send one message when the web guide is ready.
      </p>

      <!-- Reserved-height slot so swapping form -> confirmation never shifts the
           layout below (no-layout-shift rule). -->
      <div class="notify-slot">
        {#if status === "done"}
          <div class="confirmed" role="status">
            <i class="fas fa-circle-check" aria-hidden="true"></i>
            <span>You're on the list. You'll get an email when the new guide is out.</span>
          </div>
        {:else}
          <form class="notify-form" onsubmit={handleSubmit}>
            <label class="sr-only" for="guide-notify-email">Email address</label>
            <input
              id="guide-notify-email"
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
          <!-- error line reserved so it doesn't push the page -->
          <p class="error-line" class:visible={status === "error"} aria-live="polite">
            {errorMessage}
          </p>
        {/if}
      </div>
    </div>
  </section>
</main>

<LandingFooter />

<style>
  .guide-page {
    --landing-heading-font: "Playfair Display", Georgia, serif;
    min-height: 60vh;
    background: linear-gradient(145deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%);
    color: var(--theme-text, #fff);
    /* Clear the fixed 64px header. */
    padding-top: 64px;
  }

  .inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 24px;
  }

  .intro {
    padding: 80px 0 8px;
    text-align: center;
  }
  .intro .inner {
    max-width: 640px;
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
    font-family: var(--landing-heading-font);
    font-size: clamp(1.9rem, 5vw, 2.8rem);
    font-weight: 400;
    line-height: 1.15;
    margin: 0 0 16px;
  }

  .lede {
    font-size: var(--font-size-lg, 1.125rem);
    line-height: 1.6;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.66));
    margin: 0 auto;
  }

  .old-guides {
    padding-top: 56px;
  }
  .old-guides .inner {
    max-width: 640px;
    text-align: center;
  }

  h2 {
    font-family: var(--landing-heading-font);
    font-size: clamp(1.5rem, 4vw, 2rem);
    font-weight: 400;
    line-height: 1.2;
    margin: 0 0 12px;
  }

  .note {
    font-size: var(--font-size-md, 1rem);
    line-height: 1.7;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.66));
    margin: 0 auto;
  }

  /* GuidesSection ships its own 120px vertical padding + heading, so it sits
     directly below the honest-framing note above without extra spacing. */

  .notify {
    padding: 40px 0 96px;
  }
  .notify .inner {
    max-width: 560px;
    text-align: center;
  }

  .notify-intro {
    font-size: var(--font-size-md, 1rem);
    line-height: 1.6;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.66));
    margin: 0 auto 24px;
  }

  .notify-slot {
    min-height: 96px; /* holds form + error line OR the confirmation */
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .notify-form {
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
    .notify-form {
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
