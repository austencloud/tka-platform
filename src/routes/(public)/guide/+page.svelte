<!--
  /guide - the Guide hub. Renders inside GuideShell (the same sidebar shell
  every /guide/level-* page uses), so clicking Guide from the landing page
  lands directly in the navigable guide instead of a separate cosmic-
  background page first. This page is the guide's front door: what it is,
  a way straight into Level 1, and a way into Level 2. It commits to being
  the guide, not apologizing for what isn't built yet.

  The full Level 1 topic corpus (/guide/level-1/<slug>) is not repeated in an
  in-page TOC here - GuideShell's sidebar (GuideSidebar.svelte) already lists
  every one of those routes in SSR HTML, so they stay crawlable without a
  duplicate list on this page. Same for the PDF downloads - the sidebar's
  Downloads group carries them.
-->
<script lang="ts">
  import GuideShell from "./_components/GuideShell.svelte";
  import { joinWaitlist } from "$lib/features/store/services/waitlist";
  import { bodyPagesByGroup } from "./level-1/_data/guide-manifest";
  import { seoForSlug } from "./level-1/_data/guide-page-seo";

  // The guide's actual first page - "Start reading" goes straight there.
  const firstTopic = bodyPagesByGroup()[0]?.entries[0]?.entry;
  const firstTopicHref = firstTopic ? `/guide/level-1/${firstTopic.id}` : "/guide/level-1";
  const firstTopicLabel = firstTopic
    ? seoForSlug(firstTopic.id, firstTopic.title).h1
    : "Level 1";

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
  <title>Flow Arts Guide | The Kinetic Alphabet</title>
  <meta
    name="description"
    content="The Kinetic Alphabet guide: a written guide to flow arts notation. Read Level 1 topic by topic, plus Level 2 and the Codex."
  />
  <link rel="canonical" href="https://tkaflowarts.com/guide" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://tkaflowarts.com/guide" />
  <meta property="og:title" content="Flow Arts Guide | The Kinetic Alphabet" />
  <meta
    property="og:description"
    content="The Kinetic Alphabet guide: a written guide to flow arts notation. Read Level 1 topic by topic, plus Level 2 and the Codex."
  />
  <meta property="og:site_name" content="The Kinetic Alphabet" />
  <meta property="og:image" content="https://tkaflowarts.com/branding/og-image.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="The Kinetic Alphabet" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@tkaflowarts" />
  <meta name="twitter:creator" content="@tkaflowarts" />
  <meta name="twitter:title" content="Flow Arts Guide | The Kinetic Alphabet" />
  <meta
    name="twitter:description"
    content="The Kinetic Alphabet guide: a written guide to flow arts notation. Read Level 1 topic by topic, plus Level 2 and the Codex."
  />
  <meta name="twitter:image" content="https://tkaflowarts.com/branding/og-image.png" />

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<GuideShell>
<!-- guide-page-route: the shared guide.css hook that lets a route span the
     full guide-content width instead of the narrow prose column (see
     guide.css's `.guide-content > .guide-page-route` rule) - needed so the
     2200px recomposition below actually gets the width to recompose into. -->
<main class="guide guide-page-route">
    <section class="hero">
      <h1>The Kinetic Alphabet Guide</h1>
      <p class="lede">
        Written notation for flow arts. Level 1 covers the grid, hand
        positions and motions, letters, and words. Level 2 covers turns and
        the intermediate system.
      </p>
      <div class="hero-ctas">
        <a class="btn btn-primary" href={firstTopicHref}>
          Start reading
          <span class="btn-sub">{firstTopicLabel}</span>
        </a>
        <a class="btn btn-secondary" href="/guide/level-2/turns">
          Read Level 2
          <span class="btn-sub">Turns</span>
        </a>
      </div>
    </section>

    <section class="more" aria-labelledby="more-heading">
      <h2 id="more-heading">More in the guide</h2>
      <div class="available-links">
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

    <section class="notify" aria-labelledby="notify-heading">
      <div class="notify-card">
        <h2 id="notify-heading">New sections are still landing</h2>
        <p class="notify-intro">
          Leave your email to get one message when they do.
        </p>

        <!-- Reserved-height slot so swapping form -> confirmation never shifts
             the layout below (no-layout-shift rule). -->
        <div class="notify-slot">
          {#if status === "done"}
            <div class="confirmed" role="status">
              <i class="fas fa-circle-check" aria-hidden="true"></i>
              <span>You're on the list. You'll get an email when new sections land.</span>
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
</GuideShell>

<style>
  .guide {
    font-family: system-ui, -apple-system, sans-serif;
    --landing-heading-font: "Playfair Display", Georgia, serif;
    color: #ece9f5;
  }

  /* ── Hero ─────────────────────────────────────────────────────────── */
  .hero {
    max-width: 760px;
    margin: 0 auto;
    padding: 96px 24px 0;
    text-align: center;
  }
  h1 {
    /* Brand Fraunces wonky italic - the page-title voice shared across every
       public page. Section h2s below stay Playfair (h1 vs h2 hierarchy). */
    font-family: var(--page-title-font, "Fraunces", Georgia, serif);
    font-style: italic;
    font-weight: 700;
    font-variation-settings: "opsz" 144, "wght" 700, "SOFT" 0, "WONK" 1;
    font-size: clamp(2rem, 5vw, 3.2rem);
    line-height: 1.1;
    letter-spacing: -0.015em;
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
    text-wrap: balance;
  }

  /* ── Hero CTAs ────────────────────────────────────────────────────── */
  .hero-ctas {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 14px;
    margin-top: 36px;
  }
  .btn {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-width: 200px;
    min-height: var(--min-touch-target, 44px);
    padding: 14px 28px;
    border-radius: 14px;
    text-decoration: none;
    font-weight: 700;
    font-size: 1.05rem;
    transition: filter 0.18s ease, transform 0.18s ease, background 0.18s ease;
  }
  .btn:hover {
    transform: translateY(-2px);
  }
  .btn-primary {
    background: linear-gradient(135deg, #6f8cff, #8b6cff);
    color: #fff;
    box-shadow: 0 8px 26px rgba(111, 140, 255, 0.35);
  }
  .btn-primary:hover {
    filter: brightness(1.08);
  }
  .btn-secondary {
    background: rgba(20, 19, 38, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.16);
    color: #fff;
  }
  .btn-secondary:hover {
    border-color: rgba(139, 108, 255, 0.6);
    background: rgba(30, 27, 56, 0.6);
  }
  .btn-sub {
    font-weight: 400;
    font-size: 0.78rem;
    opacity: 0.75;
  }
  @media (prefers-reduced-motion: reduce) {
    .btn {
      transition: none;
    }
    .btn:hover {
      transform: none;
    }
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

  /* ── More in the guide (Codex, staff choreography) ───────────────── */
  .more {
    max-width: 760px;
    margin: 96px auto 0;
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
     "More in the guide" sits LEFT while the notify card sits RIGHT as a true
     sidebar - the two share one glance instead of a long scroll. Pure grid
     placement on existing DOM; below 2200px the original stacked flow is
     untouched. */
  @media (min-width: 2200px) {
    .guide {
      display: grid;
      grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
      grid-template-areas:
        "hero hero"
        "more notify";
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
    .more {
      grid-area: more;
      justify-self: end;
      text-align: left;
      max-width: 640px;
      margin-top: 96px;
      padding: 0;
    }
    .more h2 {
      text-align: left;
    }
    /* Stack the links so the left column reads as a list. */
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

    h1 {
      font-size: clamp(3.2rem, 2.2vw, 4.6rem);
    }
    .lede {
      max-width: 800px;
      font-size: 1.45rem;
    }
    h2 {
      font-size: 2.5rem;
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
