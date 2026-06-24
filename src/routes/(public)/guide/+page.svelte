<!--
  /guide — the Guide hub. A standalone page on the site's live cosmic background
  (same as the landing), with SiteHeader + LandingFooter chrome. Plain and
  honest: the guide is being rewritten, here are the old PDFs to download in the
  meantime, and an announce-me email form.

  This is NOT the in-progress guide itself. /guide/level-1 and its sub-routes are
  owned by another agent's rewrite and are deliberately not linked from here yet.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import BackgroundHost from "$lib/shared/background/shared/components/BackgroundHost.svelte";
  import { BackgroundType } from "@austencloud/backgrounds";
  import { applyThemeForBackground } from "$lib/shared/settings/utils/background-theme-calculator";
  import SiteHeader from "$lib/shared/landing/components/SiteHeader.svelte";
  import LandingFooter from "../../landing/components/LandingFooter.svelte";
  import GuidesSection from "../../landing/components/GuidesSection.svelte";
  import { joinWaitlist } from "$lib/features/store/services/waitlist";

  const BG = BackgroundType.COSMIC;
  let mounted = $state(false);

  let email = $state("");
  let status = $state<"idle" | "submitting" | "done" | "error">("idle");
  let errorMessage = $state("");

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const canSubmit = $derived(EMAIL_RE.test(email.trim()) && status !== "submitting");

  onMount(() => {
    applyThemeForBackground(BG);
    mounted = true;
  });

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
    content="The Kinetic Alphabet guide is being rewritten for the web. Download the old PDF guides to read in the meantime, or get notified when the new guide is out."
  />
  <link rel="canonical" href="https://tkaflowarts.com/guide" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://tkaflowarts.com/guide" />
  <meta property="og:title" content="Guide | The Kinetic Alphabet" />
  <meta
    property="og:description"
    content="The Kinetic Alphabet guide is being rewritten for the web. Download the old PDF guides to read in the meantime, or get notified when the new one is out."
  />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500&display=swap"
    rel="stylesheet"
  />
</svelte:head>

{#if mounted}
  <div class="bg-layer"><BackgroundHost backgroundType={BG} /></div>
{/if}

<div class="content">
  <SiteHeader />

  <main class="guide">
    <section class="hero">
      <h1>The guide is being rewritten for the web</h1>
      <p class="lede">
        The whole guide is being rebuilt as web pages you can read in the
        browser: the grid, the letters, and the words. It is in progress, so it
        is not fully live yet.
      </p>
    </section>

    <section class="old-guides" aria-labelledby="old-guides-heading">
      <h2 id="old-guides-heading">The old guides</h2>
      <p class="note">
        These are the old guides. They are incomplete, but they cover the
        basics. Download and read them on your phone, tablet, or screen in the
        meantime.
      </p>
    </section>

    <GuidesSection />

    <section class="notify" aria-labelledby="notify-heading">
      <div class="notify-card">
        <h2 id="notify-heading">Get notified when it's ready</h2>
        <p class="notify-intro">
          Leave your email to get one message when the web guide is ready.
        </p>

        <!-- Reserved-height slot so swapping form -> confirmation never shifts
             the layout below (no-layout-shift rule). -->
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
                {/if}
                <span>Notify me</span>
              </button>
            </form>
            <p class="error-line" class:visible={status === "error"} aria-live="polite">
              {errorMessage}
            </p>
          {/if}
        </div>
      </div>
    </section>
  </main>

  <LandingFooter />
</div>

<style>
  /* Live cosmic background, same as the landing — fixed behind the content. */
  .bg-layer {
    position: fixed;
    inset: 0;
    z-index: 0;
  }
  .content {
    position: relative;
    z-index: 1;
  }

  .guide {
    font-family: system-ui, -apple-system, sans-serif;
    --landing-heading-font: "Playfair Display", Georgia, serif;
    color: #ece9f5;
    /* Clear the fixed 64px header. */
    padding-top: 64px;
  }

  /* ── Hero ─────────────────────────────────────────────────────────── */
  .hero {
    max-width: 760px;
    margin: 0 auto;
    padding: 96px 24px 0;
    text-align: center;
  }
  h1 {
    font-family: "Playfair Display", Georgia, serif;
    font-weight: 500;
    font-size: clamp(2rem, 5vw, 3.2rem);
    line-height: 1.12;
    margin: 0;
    color: #fff;
    /* Even out the line lengths so it doesn't break to a ragged "for the web". */
    text-wrap: balance;
  }
  .lede {
    max-width: 620px;
    margin: 24px auto 0;
    font-size: clamp(1.02rem, 2vw, 1.18rem);
    line-height: 1.65;
    color: rgba(236, 233, 245, 0.7);
    /* Avoid a lone last word (widow). */
    text-wrap: pretty;
  }

  /* ── Old guides ───────────────────────────────────────────────────── */
  .old-guides {
    max-width: 680px;
    margin: 88px auto 0;
    padding: 0 24px;
    text-align: center;
  }
  h2 {
    font-family: "Playfair Display", Georgia, serif;
    font-weight: 500;
    font-size: clamp(1.5rem, 3.6vw, 2.1rem);
    line-height: 1.15;
    margin: 0 0 14px;
    color: #fff;
    text-wrap: balance;
  }
  .note {
    font-size: 1.05rem;
    line-height: 1.7;
    color: rgba(236, 233, 245, 0.64);
    margin: 0 auto;
    max-width: 580px;
    text-wrap: pretty;
  }
  /* GuidesSection ships its own 120px vertical padding + heading, so it sits
     directly below the honest-framing note above. */

  /* ── Notify ───────────────────────────────────────────────────────── */
  .notify {
    padding: 16px 24px 104px;
    display: flex;
    justify-content: center;
  }
  .notify-card {
    width: 100%;
    max-width: 560px;
    padding: 44px 40px 40px;
    text-align: center;
    border-radius: 18px;
    background: rgba(20, 19, 38, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
  }
  .notify-card h2 {
    font-size: clamp(1.35rem, 3.2vw, 1.7rem);
    margin: 0 0 10px;
  }
  .notify-intro {
    font-size: 1rem;
    line-height: 1.6;
    color: rgba(236, 233, 245, 0.6);
    margin: 0 auto 24px;
    max-width: 400px;
    text-wrap: pretty;
  }

  .notify-slot {
    min-height: 96px;
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
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 12px;
    color: #fff;
    font-size: 0.95rem;
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
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: filter 0.18s ease;
  }
  .notify-btn:hover:not(:disabled) {
    filter: brightness(1.08);
  }
  .notify-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .error-line {
    margin: 0;
    min-height: 1.2em;
    font-size: 0.85rem;
    color: #ff8a8a;
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
    font-size: 0.95rem;
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
    .notify-card {
      padding: 36px 24px 32px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .text-input,
    .notify-btn {
      transition: none;
    }
  }
</style>
