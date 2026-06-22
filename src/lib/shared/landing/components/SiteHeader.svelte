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
    { label: "About", href: "/about", icon: "fa-circle-info" },
    { label: "Roots", href: "/roots", icon: "fa-seedling" },
    { label: "Guide", href: "/guide/level-1", icon: "fa-book-open" },
    { label: "Support", href: "/support", icon: "fa-heart" },
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
</header>

<!-- Full-screen mobile menu. MUST be a sibling of <header> (not a child): the
     header's backdrop-filter would otherwise contain this fixed overlay, sizing
     it to the 64px bar instead of the viewport. -->
<nav
  id="site-mobile-nav"
  class="mobile-nav"
  class:open={mobileOpen}
  aria-label="Mobile navigation"
  aria-hidden={!mobileOpen}
>
    <ul class="m-list">
      {#each NAV as link, i}
        <li style="--i:{i}">
          <a href={link.href} class:active={isActive(link.href)} onclick={close}>
            <i class="fas {link.icon} m-icon" aria-hidden="true"></i>
            <span class="m-label">{link.label}</span>
            <i class="fas fa-chevron-right m-chev" aria-hidden="true"></i>
          </a>
        </li>
      {/each}
    </ul>

    <div class="m-actions" style="--i:{NAV.length}">
      <a class="m-cta" href="/create" data-sveltekit-reload onclick={close}>
        <i class="fas fa-rocket" aria-hidden="true"></i>
        <span>Open the app</span>
      </a>
      <a class="m-signin" href="/create?sheet=auth" data-sveltekit-reload onclick={close}>Sign in</a>
    </div>
</nav>

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

  /* Mobile menu — full-screen navy overlay */
  .mobile-nav {
    display: none;
    position: fixed;
    inset: 0;
    z-index: 195; /* below the header bar (200) so the logo + X stay on top */
    flex-direction: column;
    justify-content: center;
    padding: calc(64px + env(safe-area-inset-top)) 24px calc(28px + env(safe-area-inset-bottom));
    background: radial-gradient(120% 90% at 50% 0%, #1d1d3a 0%, #14142b 55%, #0f0f22 100%);
    -webkit-backdrop-filter: blur(8px);
    backdrop-filter: blur(8px);
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.3s ease, visibility 0s linear 0.3s;
  }
  .mobile-nav.open {
    opacity: 1;
    visibility: visible;
    transition: opacity 0.32s ease, visibility 0s;
  }

  .m-list {
    list-style: none;
    margin: 0 auto;
    padding: 0;
    width: 100%;
    max-width: 420px;
  }
  .m-list li {
    opacity: 0;
    transform: translateY(14px);
  }
  .mobile-nav.open .m-list li {
    animation: m-item-in 0.42s cubic-bezier(0.16, 1, 0.3, 1) both;
    animation-delay: calc(0.06s + var(--i) * 0.06s);
  }
  .m-list a {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 18px 18px;
    border-radius: 16px;
    color: #e8e6f4;
    text-decoration: none;
    font-size: 1.4rem;
    font-weight: 600;
    border: 1px solid transparent;
    transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
  }
  .m-list a:hover,
  .m-list a:focus-visible {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.12);
    outline: none;
  }
  .m-list a:active {
    transform: scale(0.98);
  }
  .m-list a.active {
    background: rgba(139, 108, 255, 0.14);
    border-color: rgba(139, 108, 255, 0.4);
    color: #fff;
  }
  .m-icon {
    width: 28px;
    text-align: center;
    font-size: 1.15rem;
    color: #9b97bd;
  }
  .m-list a.active .m-icon {
    color: #b8a6ff;
  }
  .m-label {
    flex: 1;
  }
  .m-chev {
    font-size: 0.85rem;
    color: #6f6b8e;
  }

  .m-actions {
    margin: 26px auto 0;
    width: 100%;
    max-width: 420px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    opacity: 0;
    transform: translateY(14px);
  }
  .mobile-nav.open .m-actions {
    animation: m-item-in 0.42s cubic-bezier(0.16, 1, 0.3, 1) both;
    animation-delay: calc(0.06s + var(--i) * 0.06s);
  }
  .m-cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    padding: 16px 24px;
    border-radius: 999px;
    background: linear-gradient(135deg, #6f8cff, #8b6cff);
    color: #fff;
    text-decoration: none;
    font-size: 1.05rem;
    font-weight: 700;
    box-shadow: 0 8px 26px rgba(111, 140, 255, 0.45);
    transition: filter 0.18s ease, transform 0.18s ease;
  }
  .m-cta:hover {
    filter: brightness(1.07);
    transform: translateY(-2px);
  }
  .m-signin {
    color: #9b97bd;
    text-decoration: none;
    font-size: 0.95rem;
    font-weight: 500;
    padding: 6px;
  }
  .m-signin:hover {
    color: #d7d4ea;
  }

  @keyframes m-item-in {
    to {
      opacity: 1;
      transform: translateY(0);
    }
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
  }

  @media (prefers-reduced-motion: reduce) {
    header,
    .inner,
    .bar,
    .mobile-nav {
      transition: none;
    }
    .mobile-nav.open .m-list li,
    .mobile-nav.open .m-actions {
      animation: none;
      opacity: 1;
      transform: none;
    }
  }
</style>
