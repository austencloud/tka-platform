<!--
  /guide — the Guide hub. A standalone page on the site's live cosmic background
  (same as the landing), with SiteHeader + LandingFooter chrome. Editorial
  treatment: Playfair Display display type and a gold-leaf accent (the flourish
  motif from the printed guide) that gives this page its own identity while
  staying native to the site.

  It explains the whole guide is being rewritten as an interactive web
  experience, frames the old guides honestly (download to read, not really
  printable), surfaces them via the existing GuidesSection component, and offers
  an announce-me email form.

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
    content="The Kinetic Alphabet guide is being rewritten as an interactive web experience. Download the old PDF guides to read in the meantime, or get notified when the new guide is out."
  />
  <link rel="canonical" href="https://tkaflowarts.com/guide" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://tkaflowarts.com/guide" />
  <meta property="og:title" content="Guide | The Kinetic Alphabet" />
  <meta
    property="og:description"
    content="The Kinetic Alphabet guide is being rewritten as an interactive web experience. Download the old PDF guides to read in the meantime, or get notified when the new one is out."
  />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap"
    rel="stylesheet"
  />
</svelte:head>

{#if mounted}
  <div class="bg-layer"><BackgroundHost backgroundType={BG} /></div>
{/if}

<div class="content">
  <SiteHeader />

  <main class="guide">
    <!-- Hero -->
    <section class="hero">
      <span class="status reveal" style="--d:0ms">
        <span class="status-dot" aria-hidden="true"></span>
        Rewriting for the web
      </span>

      <p class="eyebrow reveal" style="--d:80ms">
        <span class="eb-rule" aria-hidden="true"></span>
        <i class="fas fa-book-open" aria-hidden="true"></i> The Kinetic Alphabet Guide
        <span class="eb-rule" aria-hidden="true"></span>
      </p>

      <h1 class="reveal" style="--d:160ms">
        Being rebuilt as an<br /><em>interactive</em> web experience
      </h1>

      <span class="draw-rule" aria-hidden="true"></span>

      <p class="lede reveal" style="--d:380ms">
        The whole guide is being rewritten from the ground up: the grid, the
        letters, and the words, as pages you read and play with in the browser.
        It is in progress, so it is not fully live yet.
      </p>
    </section>

    <!-- Old guides -->
    <section class="old-guides reveal" style="--d:80ms" aria-labelledby="old-guides-heading">
      <div class="flourish" aria-hidden="true"></div>
      <h2 id="old-guides-heading">The old guides</h2>
      <p class="note">
        These are the old guides. They are incomplete, and the whole guide is
        being rewritten as an interactive web experience. Download and read them
        on your phone, tablet, or screen in the meantime.
      </p>
    </section>

    <GuidesSection />

    <!-- Notify -->
    <section class="notify" aria-labelledby="notify-heading">
      <div class="notify-card reveal" style="--d:60ms">
        <span class="card-accent" aria-hidden="true"></span>
        <i class="fas fa-bell card-bell" aria-hidden="true"></i>
        <h2 id="notify-heading">Get notified when the new guide lands</h2>
        <p class="notify-intro">
          Leave your email and we'll send one message when the web guide is ready.
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
                {:else}
                  <i class="fas fa-bell" aria-hidden="true"></i>
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
  :root {
    --guide-gold: #d8b15a;
    --guide-gold-bright: #f0d189;
    --guide-gold-soft: rgba(216, 177, 90, 0.16);
  }

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
    /* Unify the reused GuidesSection heading with this page's display type. */
    --landing-heading-font: "Playfair Display", Georgia, serif;
    color: #ece9f5;
    /* Clear the fixed 64px header. */
    padding-top: 64px;
  }

  /* ── Hero ─────────────────────────────────────────────────────────── */
  .hero {
    max-width: 940px;
    margin: 0 auto;
    padding: 96px 24px 8px;
    text-align: center;
  }

  .status {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    padding: 7px 16px 7px 13px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
    -webkit-backdrop-filter: blur(8px);
    backdrop-filter: blur(8px);
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: #d7d2ea;
  }
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--guide-gold-bright);
    box-shadow: 0 0 0 0 rgba(240, 209, 137, 0.6);
    animation: pulse-dot 2.4s ease-out infinite;
  }
  @keyframes pulse-dot {
    0% { box-shadow: 0 0 0 0 rgba(240, 209, 137, 0.55); }
    70% { box-shadow: 0 0 0 7px rgba(240, 209, 137, 0); }
    100% { box-shadow: 0 0 0 0 rgba(240, 209, 137, 0); }
  }

  .eyebrow {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    margin: 26px 0 18px;
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--guide-gold);
  }
  .eb-rule {
    height: 1px;
    width: clamp(28px, 8vw, 72px);
    background: linear-gradient(90deg, transparent, var(--guide-gold));
  }
  .eb-rule:last-child {
    background: linear-gradient(90deg, var(--guide-gold), transparent);
  }

  h1 {
    font-family: "Playfair Display", Georgia, serif;
    font-weight: 500;
    font-size: clamp(2.2rem, 6vw, 4rem);
    line-height: 1.08;
    letter-spacing: -0.01em;
    margin: 0;
    color: #fff;
  }
  h1 em {
    font-style: italic;
    background: linear-gradient(120deg, var(--guide-gold-bright), var(--guide-gold));
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  /* Gold flourish rule that draws itself in beneath the headline (the printed
     guide's diamond-and-line motif). */
  .draw-rule {
    display: block;
    position: relative;
    width: clamp(120px, 24vw, 200px);
    height: 1px;
    margin: 30px auto 0;
    background: linear-gradient(90deg, transparent, var(--guide-gold), transparent);
    transform: scaleX(0);
    transform-origin: center;
    animation: draw 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.5s both;
  }
  .draw-rule::after {
    content: "";
    position: absolute;
    left: 50%;
    top: 50%;
    width: 7px;
    height: 7px;
    transform: translate(-50%, -50%) rotate(45deg);
    background: var(--guide-gold-bright);
    box-shadow: 0 0 10px rgba(240, 209, 137, 0.5);
    opacity: 0;
    animation: gem-in 0.5s ease 1.2s both;
  }
  @keyframes draw {
    to { transform: scaleX(1); }
  }
  @keyframes gem-in {
    from { opacity: 0; transform: translate(-50%, -50%) rotate(45deg) scale(0); }
    to { opacity: 1; transform: translate(-50%, -50%) rotate(45deg) scale(1); }
  }

  .lede {
    max-width: 660px;
    margin: 30px auto 0;
    font-size: clamp(1.05rem, 2.2vw, 1.25rem);
    line-height: 1.65;
    color: rgba(236, 233, 245, 0.72);
  }

  /* ── Old guides ───────────────────────────────────────────────────── */
  .old-guides {
    max-width: 720px;
    margin: 92px auto 0;
    padding: 0 24px;
    text-align: center;
  }
  .flourish {
    width: 9px;
    height: 9px;
    margin: 0 auto 22px;
    transform: rotate(45deg);
    background: var(--guide-gold);
    box-shadow: 0 0 0 5px var(--guide-gold-soft);
  }
  h2 {
    font-family: "Playfair Display", Georgia, serif;
    font-weight: 500;
    font-size: clamp(1.6rem, 4vw, 2.3rem);
    line-height: 1.15;
    margin: 0 0 14px;
    color: #fff;
  }
  .note {
    font-size: 1.05rem;
    line-height: 1.7;
    color: rgba(236, 233, 245, 0.66);
    margin: 0 auto;
    max-width: 600px;
  }
  /* GuidesSection ships its own 120px vertical padding + heading, so it sits
     directly below the honest-framing note above. */

  /* ── Notify ───────────────────────────────────────────────────────── */
  .notify {
    padding: 24px 24px 110px;
    display: flex;
    justify-content: center;
  }
  .notify-card {
    position: relative;
    width: 100%;
    max-width: 580px;
    padding: 48px 40px 44px;
    text-align: center;
    border-radius: 22px;
    background: rgba(20, 19, 38, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.1);
    -webkit-backdrop-filter: blur(14px) saturate(140%);
    backdrop-filter: blur(14px) saturate(140%);
    box-shadow: 0 30px 80px -28px rgba(0, 0, 0, 0.7);
    overflow: hidden;
  }
  /* Gold hairline along the top edge of the card. */
  .card-accent {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 70%;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--guide-gold), transparent);
  }
  .card-bell {
    font-size: 1.35rem;
    color: var(--guide-gold-bright);
    margin-bottom: 16px;
    filter: drop-shadow(0 0 10px rgba(240, 209, 137, 0.35));
  }
  .notify-card h2 {
    font-size: clamp(1.4rem, 3.4vw, 1.85rem);
    margin: 0 0 10px;
  }
  .notify-intro {
    font-size: 1rem;
    line-height: 1.6;
    color: rgba(236, 233, 245, 0.62);
    margin: 0 auto 26px;
    max-width: 420px;
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
    transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
  }
  .text-input::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }
  .text-input:focus {
    outline: none;
    border-color: var(--guide-gold);
    background: rgba(255, 255, 255, 0.09);
    box-shadow: 0 0 0 3px var(--guide-gold-soft);
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
    background: linear-gradient(135deg, var(--guide-gold-bright), var(--guide-gold));
    color: #2a1e05;
    font-size: 0.95rem;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    transition: filter 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
  }
  .notify-btn:hover:not(:disabled) {
    filter: brightness(1.06);
    transform: translateY(-1px);
    box-shadow: 0 8px 22px -6px rgba(216, 177, 90, 0.6);
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

  /* ── Load reveals (staggered) ─────────────────────────────────────── */
  .reveal {
    opacity: 0;
    transform: translateY(20px);
    animation: rise 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
    animation-delay: var(--d, 0ms);
  }
  @keyframes rise {
    to { opacity: 1; transform: translateY(0); }
  }

  @media (max-width: 480px) {
    .notify-form {
      flex-direction: column;
    }
    .notify-slot {
      min-height: 140px;
    }
    .notify-card {
      padding: 40px 24px 36px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .reveal,
    .draw-rule,
    .draw-rule::after,
    .status-dot {
      animation: none;
    }
    .reveal {
      opacity: 1;
      transform: none;
    }
    .draw-rule {
      transform: scaleX(1);
    }
    .draw-rule::after {
      opacity: 1;
    }
    .text-input,
    .notify-btn {
      transition: none;
    }
  }
</style>
