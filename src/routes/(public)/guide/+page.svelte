<!--
  /guide — the Guide hub. A standalone page on the site's live cosmic background
  (same as the landing), with SiteHeader + LandingFooter chrome. Plain and
  honest: the guide is being rewritten, here are the old PDFs to download in the
  meantime, and an announce-me email form.

  This is NOT the in-progress guide itself. /guide/level-1 and its sub-routes are
  owned by another agent's rewrite and are deliberately not linked from here yet.
-->
<script lang="ts">
  import LandingFooter from "../../landing/components/LandingFooter.svelte";
  import GuidesSection from "../../landing/components/GuidesSection.svelte";
  import { joinWaitlist } from "$lib/features/store/services/waitlist";

  // Cosmic background + SiteHeader are provided by the persistent MarketingChrome
  // (root layout) so they survive navigation between marketing pages without a
  // flash. This page only renders its own content + footer.

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
    content="The Kinetic Alphabet guide: a written guide to flow arts notation. Read Level 2 and the Codex now; the full Level 1 rewrite for the web is in progress."
  />
  <link rel="canonical" href="https://tkaflowarts.com/guide" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://tkaflowarts.com/guide" />
  <meta property="og:title" content="Guide | The Kinetic Alphabet" />
  <meta
    property="og:description"
    content="The Kinetic Alphabet guide: a written guide to flow arts notation. Read Level 2 and the Codex now; the full Level 1 rewrite for the web is in progress."
  />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<main class="guide">
    <section class="hero">
      <h1>The guide is being rewritten for the web</h1>
      <p class="lede">
        The whole guide is being rebuilt as web pages you can read in the
        browser: the grid, the letters, and the words. It is in progress, so it
        is not fully live yet.
      </p>
    </section>

    <section class="available" aria-labelledby="available-heading">
      <h2 id="available-heading">Available now</h2>
      <p class="note">
        Parts of the guide are already live and readable right in the browser:
      </p>
      <div class="available-links">
        <a href="/guide/level-2" class="guide-link">
          <span class="guide-link-title">Level 2</span>
          <span class="guide-link-sub"
            >Turns, double-turns, and the intermediate system</span
          >
        </a>
        <a href="/guide/codex" class="guide-link">
          <span class="guide-link-title">The Codex</span>
          <span class="guide-link-sub"
            >Every letter of the Kinetic Alphabet, rendered</span
          >
        </a>
        <a href="/learn/staff-spinning-choreography" class="guide-link">
          <span class="guide-link-title">Staff Choreography</span>
          <span class="guide-link-sub"
            >Why TKA starts with staves, and what your first session looks like</span
          >
        </a>
      </div>
    </section>

    <section class="old-guides" aria-labelledby="old-guides-heading">
      <h2 id="old-guides-heading">The old guides</h2>
      <p class="note">
        These are the old guides. They are incomplete, but they cover the
        basics. Download and read them on your phone, tablet, or screen in the
        meantime.
      </p>
    </section>

    <GuidesSection showHeading={false} />

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

<LandingFooter showCredit={false} />

<style>
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
    /* Balance all three lines so the last one isn't a stray "fully live yet". */
    text-wrap: balance;
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

  /* ── Available now (links to the live, crawlable guide surfaces) ──── */
  .available {
    max-width: 760px;
    margin: 72px auto 0;
    padding: 0 24px;
    text-align: center;
  }
  .available-links {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    justify-content: center;
    margin-top: 24px;
  }
  .guide-link {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1 1 240px;
    min-width: 240px;
    max-width: 320px;
    padding: 20px 24px;
    min-height: var(--min-touch-target, 44px);
    border-radius: 16px;
    background: rgba(20, 19, 38, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.12);
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
    text-decoration: none;
    text-align: left;
    transition:
      border-color 0.18s ease,
      transform 0.18s ease,
      background 0.18s ease;
  }
  .guide-link:hover {
    border-color: rgba(139, 108, 255, 0.6);
    background: rgba(30, 27, 56, 0.6);
    transform: translateY(-2px);
  }
  .guide-link-title {
    font-family: "Playfair Display", Georgia, serif;
    font-size: 1.35rem;
    color: #fff;
  }
  .guide-link-sub {
    font-size: 0.95rem;
    line-height: 1.5;
    color: rgba(236, 233, 245, 0.62);
  }
  @media (prefers-reduced-motion: reduce) {
    .guide-link {
      transition: none;
    }
    .guide-link:hover {
      transform: none;
    }
  }

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

  /* ── 4K / ultrawide: recompose, don't just enlarge ────────────────────
     The hub becomes a two-column composition: the hero spans the top, then
     "Available now" (the two live guide links, stacked) sits LEFT while the
     notify card sits RIGHT as a true sidebar — the two calls to action share
     one glance instead of a long scroll. The old-guides intro + list span
     below. Pure grid placement on existing DOM; below 2200px the original
     stacked flow is untouched. */
  @media (min-width: 2200px) {
    .guide {
      display: grid;
      grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
      grid-template-areas:
        "hero hero"
        "available notify"
        "old old"
        "guides guides";
      column-gap: 96px;
      /* 45.8vw == 1760px at 3840; fluid past 4K. */
      max-width: max(1760px, 45.8vw);
      margin: 0 auto;
      align-items: start;
    }
    .hero {
      grid-area: hero;
      max-width: 1100px;
      justify-self: center;
    }
    .available {
      grid-area: available;
      justify-self: end;
      text-align: left;
      max-width: 640px;
      margin-top: 96px;
      padding: 0;
    }
    /* Stack the two live-guide links so the left column reads as a list. */
    .available-links {
      flex-direction: column;
      align-items: stretch;
    }
    .guide-link {
      max-width: none;
      flex: 0 0 auto;
      padding: 26px 30px;
      gap: 8px;
    }
    .notify {
      grid-area: notify;
      justify-self: start;
      align-self: stretch;
      display: flex;
      align-items: center;
      margin-top: 96px;
      padding: 0;
    }
    .old-guides {
      grid-area: old;
      justify-self: center;
    }
    /* GuidesSection's root section spans the full row below. */
    .guide > :global(.guides) {
      grid-area: guides;
    }

    h1 {
      font-size: clamp(3.2rem, 2.2vw, 4.6rem);
    }
    .lede {
      max-width: 800px;
      font-size: 1.45rem;
    }
    .old-guides {
      max-width: 980px;
    }
    h2 {
      font-size: 2.5rem;
    }
    .available h2 {
      font-size: 2.1rem;
      text-align: left;
    }
    .available .note {
      text-align: left;
      margin: 0 0 4px;
    }
    .note {
      font-size: 1.3rem;
      max-width: 760px;
    }
    .guide-link-title {
      font-size: 1.7rem;
    }
    .guide-link-sub {
      font-size: 1.15rem;
    }
    .notify-card {
      max-width: 640px;
      padding: 52px 48px 48px;
    }
    .notify-card h2 {
      font-size: 2.1rem;
    }
    .notify-intro {
      font-size: 1.2rem;
      max-width: 500px;
    }
    .notify-form {
      max-width: 520px;
    }
    .text-input,
    .notify-btn {
      font-size: 1.05rem;
    }
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
