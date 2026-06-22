<script lang="ts">
  /**
   * Marketing top bar for the public/landing pages (landing, /about, /roots,
   * /support). Modeled on the Cirque Aflame site header pattern — fixed
   * translucent bar that shrinks on scroll, desktop link row with an
   * active-underline, mobile hamburger → right slide-in drawer + backdrop —
   * re-themed to TKA's navy/indigo. Fixes the "links only in the footer"
   * problem: these standalone pages had no nav at all.
   *
   * `/create` + sign-in force a full reload (data-sveltekit-reload) because they
   * cross from the chrome-less public pages into the app shell.
   */
  import { page } from "$app/state";

  let scrolled = $state(false);
  let mobileOpen = $state(false);

  const NAV = [
    { label: "About", href: "/about" },
    { label: "Roots", href: "/roots" },
    { label: "Guide", href: "/guide/level-1" },
    { label: "Support", href: "/support" },
  ];

  function isActive(href: string): boolean {
    const path = page.url?.pathname ?? "";
    return path === href || path.startsWith(href + "/");
  }

  function handleScroll() {
    scrolled = window.scrollY > 40;
  }

  function close() {
    mobileOpen = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && mobileOpen) mobileOpen = false;
  }
</script>

<svelte:window onscroll={handleScroll} onkeydown={handleKeydown} />

<header class:scrolled>
  <div class="inner">
    <a href="/" class="logo" aria-label="The Kinetic Alphabet — Home">
      <span class="logo-text">TKA</span>
    </a>

    <nav class="desktop-nav" aria-label="Main navigation">
      {#each NAV as link}
        <a href={link.href} class:active={isActive(link.href)}>
          {link.label}
          {#if isActive(link.href)}<span class="ind" aria-hidden="true"></span>{/if}
        </a>
      {/each}
      <a class="signin" href="/create?sheet=auth" data-sveltekit-reload>Sign in</a>
      <a class="cta" href="/create" data-sveltekit-reload>Open the app</a>
    </nav>

    <button
      class="toggle"
      aria-label={mobileOpen ? "Close menu" : "Open menu"}
      aria-expanded={mobileOpen}
      aria-controls="site-mobile-nav"
      onclick={() => (mobileOpen = !mobileOpen)}
    >
      <span class="bar" class:open={mobileOpen}></span>
      <span class="bar" class:open={mobileOpen}></span>
      <span class="bar" class:open={mobileOpen}></span>
    </button>
  </div>

  <nav
    id="site-mobile-nav"
    class="mobile-nav"
    class:open={mobileOpen}
    aria-label="Mobile navigation"
    aria-hidden={!mobileOpen}
  >
    {#each NAV as link}
      <a href={link.href} class:active={isActive(link.href)} onclick={close}>{link.label}</a>
    {/each}
    <a class="m-signin" href="/create?sheet=auth" data-sveltekit-reload onclick={close}>Sign in</a>
    <a class="m-cta" href="/create" data-sveltekit-reload onclick={close}>Open the app</a>
  </nav>

  {#if mobileOpen}
    <button class="backdrop" onclick={close} aria-label="Close menu" tabindex="-1"></button>
  {/if}
</header>

<style>
  header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 200;
    background: rgba(15, 15, 34, 0.72);
    backdrop-filter: blur(16px) saturate(160%);
    -webkit-backdrop-filter: blur(16px) saturate(160%);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    transition: background 0.3s ease, border-color 0.3s ease, height 0.3s ease;
  }
  header.scrolled {
    background: rgba(13, 13, 28, 0.92);
    border-bottom-color: rgba(255, 255, 255, 0.1);
  }

  .inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1.4rem;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    transition: height 0.3s ease;
  }
  header.scrolled .inner {
    height: 56px;
  }

  .logo {
    text-decoration: none;
    display: flex;
    align-items: center;
  }
  .logo-text {
    font-family: "Fraunces", Georgia, serif;
    font-style: italic;
    font-weight: 700;
    font-size: 1.5rem;
    letter-spacing: 0.04em;
    background: linear-gradient(135deg, #6f8cff, #c0a3ff);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .desktop-nav {
    display: flex;
    gap: 1.4rem;
    align-items: center;
  }
  .desktop-nav a {
    position: relative;
    color: #c4c1d8;
    text-decoration: none;
    font-size: 0.92rem;
    font-weight: 500;
    padding: 0.4rem 0;
    transition: color 0.2s ease;
  }
  .desktop-nav a:hover,
  .desktop-nav a:focus-visible {
    color: #fff;
    outline: none;
  }
  .desktop-nav a.active {
    color: #fff;
  }
  .ind {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 2px;
    border-radius: 1px;
    background: linear-gradient(90deg, #6f8cff, #c0a3ff);
  }

  .signin {
    color: #9b97bd !important;
  }
  .cta {
    padding: 0.5rem 1.1rem !important;
    border-radius: 999px;
    background: linear-gradient(135deg, #6f8cff, #8b6cff);
    color: #fff !important;
    font-weight: 600 !important;
  }
  .cta:hover {
    filter: brightness(1.08);
  }

  /* Mobile toggle */
  .toggle {
    display: none;
    flex-direction: column;
    gap: 5px;
    background: none;
    border: none;
    cursor: pointer;
    min-width: 48px;
    min-height: 48px;
    align-items: center;
    justify-content: center;
    z-index: 201;
  }
  .bar {
    width: 24px;
    height: 2px;
    background: #fff;
    border-radius: 1px;
    transition: all 0.3s ease;
    transform-origin: center;
  }
  .bar.open:nth-child(1) {
    transform: rotate(45deg) translate(5px, 5px);
  }
  .bar.open:nth-child(2) {
    opacity: 0;
    transform: scaleX(0);
  }
  .bar.open:nth-child(3) {
    transform: rotate(-45deg) translate(5px, -5px);
  }

  /* Mobile drawer */
  .mobile-nav {
    display: none;
    position: fixed;
    top: 56px;
    right: 0;
    width: 270px;
    max-width: calc(100vw - 2rem);
    max-height: calc(100dvh - 56px);
    overflow-y: auto;
    flex-direction: column;
    padding: 0.75rem 0 1.25rem;
    background: rgba(13, 13, 28, 0.98);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-left: 1px solid rgba(255, 255, 255, 0.1);
    transform: translateX(100%);
    opacity: 0;
    transition: transform 0.3s ease, opacity 0.3s ease;
  }
  .mobile-nav.open {
    transform: translateX(0);
    opacity: 1;
  }
  .mobile-nav a {
    display: flex;
    align-items: center;
    min-height: 48px;
    padding: 0.5rem 1.4rem;
    color: #cfccdf;
    text-decoration: none;
    font-size: 1rem;
    font-weight: 500;
    border-left: 3px solid transparent;
    transition: background 0.2s ease, color 0.2s ease;
  }
  .mobile-nav a:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #fff;
  }
  .mobile-nav a.active {
    color: #fff;
    border-left-color: #8b6cff;
    background: rgba(139, 108, 255, 0.12);
  }
  .m-signin {
    color: #9b97bd !important;
  }
  .m-cta {
    margin: 0.8rem 1.4rem 0;
    justify-content: center;
    border-radius: 999px;
    background: linear-gradient(135deg, #6f8cff, #8b6cff);
    color: #fff !important;
    font-weight: 700 !important;
    border-left: none !important;
  }

  .backdrop {
    display: none;
    position: fixed;
    inset: 0;
    top: 56px;
    background: rgba(0, 0, 0, 0.5);
    border: none;
    cursor: pointer;
    z-index: 199;
  }

  @media (max-width: 900px) {
    .desktop-nav {
      display: none;
    }
    .toggle {
      display: flex;
    }
    .mobile-nav {
      display: flex;
    }
    .backdrop {
      display: block;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    header,
    .inner,
    .bar,
    .mobile-nav {
      transition: none;
    }
  }
</style>
