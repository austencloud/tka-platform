<script lang="ts">
  /**
   * tkaflowarts.com/support — the donation landing page.
   *
   * The printed Level 1 guide carries ONE QR that points here, so the actual
   * payment methods (and any future additions) can change without reprinting a
   * single book. Opened mostly on phones (QR scan) → mobile-first, big tappable
   * cards, real brand logos. Echoes the guide cover's Fraunces title so the page
   * reads as the book's online extension.
   */
  import { LANDING_DOMAIN } from "../../../config/domains";

  const METHODS = [
    {
      name: "PayPal",
      logo: "/support/logo-paypal.png",
      handle: "@austencloud",
      href: "https://www.paypal.com/paypalme/austencloud",
      accent: "#0070ba",
    },
    {
      name: "Venmo",
      logo: "/support/logo-venmo.png",
      handle: "@austencloud",
      href: "https://venmo.com/code?user_id=2250430063050753012",
      accent: "#008cff",
    },
  ];
</script>

<svelte:head>
  <title>Support · The Kinetic Alphabet</title>
  <meta name="description" content="Support the development of The Kinetic Alphabet. Any amount is genuinely appreciated, and never required." />
  <meta name="robots" content="noindex" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital@0;1&family=Fraunces:ital,opsz,wght@1,9..144,400..700&display=swap" rel="stylesheet" />
</svelte:head>

<main class="page">
  <section class="card">
    <p class="eyebrow">The Kinetic Alphabet</p>
    <h1 class="title">Support the work</h1>
    <p class="lede">
      If this guide helps you, you can support its development. Any amount is
      genuinely appreciated, and never required.
    </p>

    <div class="methods">
      {#each METHODS as m}
        <a
          class="method"
          style="--accent:{m.accent}"
          href={m.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img class="logo" src={m.logo} alt="{m.name} logo" />
          <span class="meta">
            <span class="handle">{m.handle}</span>
            <span class="open">Open {m.name}</span>
          </span>
          <span class="chev" aria-hidden="true">→</span>
        </a>
      {/each}
    </div>

    <p class="suggest">Suggested $20–30 · any amount helps</p>

    <footer class="thanks">
      <p>Thank you.</p>
      <p class="sig">Austen Cloud</p>
      <a class="home" href={LANDING_DOMAIN}>tkaflowarts.com</a>
    </footer>
  </section>
</main>

<style>
  .page {
    min-height: 100dvh;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px 18px;
    background: radial-gradient(120% 90% at 50% 0%, #1d1d3a 0%, #14142b 60%, #0f0f22 100%);
    color: #f4f0e4;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  .card {
    width: 100%;
    max-width: 460px;
    text-align: center;
  }
  .eyebrow {
    font-family: "Cormorant Garamond", Georgia, serif;
    font-style: italic;
    font-size: 1.05rem;
    letter-spacing: 0.02em;
    color: #c8c4dc;
    opacity: 0.85;
    margin: 0 0 0.35rem;
  }
  .title {
    font-family: "Fraunces", Georgia, serif;
    font-style: italic;
    font-weight: 640;
    font-variation-settings: "opsz" 144, "wght" 640, "SOFT" 0, "WONK" 1;
    font-size: clamp(2.2rem, 11vw, 3rem);
    line-height: 1.04;
    margin: 0;
    color: #ffffff;
  }
  .lede {
    max-width: 24rem;
    margin: 1rem auto 1.8rem;
    font-size: 1.02rem;
    line-height: 1.55;
    color: #d8d4e8;
  }

  .methods {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }
  .method {
    display: flex;
    align-items: center;
    gap: 1rem;
    min-height: 72px;
    padding: 0 1.1rem;
    border-radius: 16px;
    background: #ffffff;
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 6px 22px rgba(0, 0, 0, 0.28);
    text-decoration: none;
    transition: transform 0.14s ease, box-shadow 0.14s ease;
  }
  .method:hover,
  .method:focus-visible {
    transform: translateY(-2px);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4), 0 0 0 2px var(--accent) inset;
    outline: none;
  }
  .logo {
    height: 26px;
    width: auto;
    flex: 0 0 auto;
  }
  .meta {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    margin-right: auto;
  }
  .handle {
    font-weight: 600;
    font-size: 1rem;
    color: #1a1a2e;
  }
  .open {
    font-size: 0.82rem;
    color: var(--accent);
    font-weight: 600;
  }
  .chev {
    font-size: 1.3rem;
    color: var(--accent);
    flex: 0 0 auto;
  }

  .suggest {
    font-family: "Cormorant Garamond", Georgia, serif;
    font-style: italic;
    font-size: 1.05rem;
    color: #b7b2cf;
    margin: 1.4rem 0 0;
  }

  .thanks {
    margin-top: 2.4rem;
    color: #c8c4dc;
  }
  .thanks p {
    margin: 0;
  }
  .thanks .sig {
    font-family: "Cormorant Garamond", Georgia, serif;
    font-style: italic;
    font-size: 1.25rem;
    color: #ece9f6;
    margin-top: 0.1rem;
  }
  .home {
    display: inline-block;
    margin-top: 1.1rem;
    font-size: 0.85rem;
    letter-spacing: 0.04em;
    color: #8f8bb0;
    text-decoration: none;
    border-bottom: 1px solid rgba(143, 139, 176, 0.4);
    padding-bottom: 1px;
  }
  .home:hover {
    color: #c8c4dc;
  }
</style>
