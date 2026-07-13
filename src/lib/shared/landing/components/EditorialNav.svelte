<!--
  EditorialNav

  The shared mini pillar nav for the public editorial pages (/notation,
  /composer, /roots, /about). One component on all four so the pages stop
  being dead-ends and can't drift apart (same playbook as SequenceViewerShell).

  Also owns the Inter font load: every editorial page gets the same
  typography by construction (public-editorial.css asks for Inter; before
  this, only /about and /roots actually loaded it).

  Fixed bar, 56px tall; the editorial pages' existing 80-88px top padding
  already clears it.
-->
<script lang="ts">
  import { page } from "$app/state";

  const LINKS = [
    { href: "/notation", label: "Notation" },
    { href: "/composer", label: "Composer" },
    { href: "/roots", label: "Roots" },
    { href: "/about", label: "About" },
  ];

  const path = $derived(page.url.pathname.replace(/\/$/, "") || "/");
</script>

<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300..800&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<nav class="editorial-nav" aria-label="Site">
  <a href="/" class="brand">The Kinetic Alphabet</a>

  <div class="links">
    {#each LINKS as link}
      <a
        href={link.href}
        class="nav-link"
        aria-current={path === link.href ? "page" : undefined}
      >
        {link.label}
      </a>
    {/each}
  </div>

  <a href="/create" class="open-app" data-sveltekit-reload>
    <span>Open Composer</span>
  </a>
</nav>

<style>
  .editorial-nav {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    gap: 1rem;
    height: 56px;
    padding: 0 clamp(0.9rem, 3vw, 2rem);
    background: oklch(0.13 0.02 270 / 0.72);
    border-bottom: 1px solid oklch(0.5 0.04 270 / 0.14);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    font-family: "Inter", system-ui, sans-serif;
  }

  .brand {
    font-size: 0.9rem;
    font-weight: 650;
    letter-spacing: -0.01em;
    color: oklch(0.92 0.01 270);
    text-decoration: none;
    white-space: nowrap;
    /* keep tap target honest even in a 56px bar */
    display: inline-flex;
    align-items: center;
    min-height: 44px;
  }
  .brand:hover {
    color: oklch(1 0 0);
  }

  .links {
    display: flex;
    align-items: center;
    gap: 0.15rem;
    margin-inline: auto;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .links::-webkit-scrollbar {
    display: none;
  }

  .nav-link {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 0.75rem;
    font-size: 0.88rem;
    font-weight: 520;
    color: oklch(0.72 0.015 270);
    text-decoration: none;
    border-radius: 10px;
    white-space: nowrap;
    transition:
      color 140ms ease,
      background 140ms ease;
  }
  .nav-link:hover {
    color: oklch(0.94 0.01 270);
    background: oklch(0.35 0.04 270 / 0.18);
  }
  .nav-link[aria-current="page"] {
    color: oklch(0.96 0.01 270);
    background: oklch(0.4 0.06 275 / 0.22);
  }

  .open-app {
    display: inline-flex;
    align-items: center;
    min-height: 40px;
    padding: 0 1rem;
    font-size: 0.85rem;
    font-weight: 650;
    color: #fff;
    text-decoration: none;
    white-space: nowrap;
    border-radius: 11px;
    background: linear-gradient(135deg, #6f8cff, #8b6cff);
    box-shadow: 0 6px 18px oklch(0.45 0.18 275 / 0.35);
    transition:
      transform 140ms ease,
      box-shadow 140ms ease;
  }
  .open-app:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 24px oklch(0.45 0.18 275 / 0.5);
  }

  @media (prefers-reduced-motion: reduce) {
    .nav-link,
    .open-app {
      transition: none;
    }
    .open-app:hover {
      transform: none;
    }
  }

  /* Small phones: brand shrinks to the acronym via clipping trick is too
     clever; just tighten. The links row scrolls horizontally if needed. */
  @media (max-width: 560px) {
    .editorial-nav {
      gap: 0.6rem;
    }
    .brand {
      font-size: 0.82rem;
    }
    .open-app {
      padding: 0 0.75rem;
      font-size: 0.8rem;
    }
  }

  @media (max-width: 400px) {
    .brand {
      display: none;
    }
  }
</style>
