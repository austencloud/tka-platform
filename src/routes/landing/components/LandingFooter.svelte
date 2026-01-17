<script lang="ts">
  import LegalSheet from "$lib/shared/legal/components/LegalSheet.svelte";
  import { APP_DOMAIN } from "../../../config/domains";

  const footerLinks = [
    { href: APP_DOMAIN, label: "App" },
    { href: "/about", label: "About" },
    { href: "/roots", label: "Roots" },
    { href: "#features", label: "Features" },
    { href: "#notation", label: "Notation" },
    { href: "#loops", label: "LOOPs" },
  ];

  let sheetOpen = $state(false);
  let sheetType = $state<"terms" | "privacy">("terms");

  const MOBILE_BREAKPOINT = 768;

  function handleLegalClick(e: MouseEvent, type: "terms" | "privacy") {
    // On mobile, use sheet. On desktop, let link navigate normally.
    if (window.innerWidth < MOBILE_BREAKPOINT) {
      e.preventDefault();
      sheetType = type;
      sheetOpen = true;
    }
    // On desktop, don't prevent default - link navigates to /terms or /privacy
  }

  function closeSheet() {
    sheetOpen = false;
  }
</script>

<section class="final-cta">
  <div class="container">
    <h2>Open & Free</h2>
    <p>
      No download required — runs in your browser.
    </p>
    <p class="small">
      The notation system is open. Create educational content, build tools, grow the community.
    </p>

    <a href={APP_DOMAIN} class="btn btn-primary btn-large">
      Open TKA Scribe
      <span class="arrow">→</span>
    </a>
  </div>
</section>

<footer class="footer">
  <div class="container">
    <div class="footer-content">
      <div class="footer-brand">
        <strong>The Kinetic Alphabet</strong>
        <span>A notation system for flow arts</span>
      </div>
      <div class="footer-links">
        {#each footerLinks as link}
          <a href={link.href}>{link.label}</a>
        {/each}
      </div>
    </div>
    <div class="footer-note">
      <p>
        TKA builds on <a href="/roots">ideas from Vulcan Tech Gospel (VTG), CAPs, and other community efforts</a>
        to systematize flow arts knowledge.
      </p>
    </div>
    <div class="footer-legal">
      <a href="/terms" onclick={(e) => handleLegalClick(e, "terms")}
        >Terms of Service</a
      >
      <a href="/privacy" onclick={(e) => handleLegalClick(e, "privacy")}
        >Privacy Policy</a
      >
    </div>
  </div>
</footer>

<LegalSheet isOpen={sheetOpen} type={sheetType} onClose={closeSheet} />

<style>
  .final-cta {
    padding: 120px 24px;
    text-align: center;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
  }

  h2 {
    font-size: clamp(2rem, 5vw, 3rem);
    margin-bottom: 1rem;
    text-align: center;
    font-weight: 600;
    line-height: 1.2;
  }

  .small {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .final-cta p {
    font-size: 1.25rem;
    margin-bottom: 16px;
  }

  .final-cta .small {
    font-size: 1rem;
    margin-bottom: 32px;
  }

  /* Button styles */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 14px 28px;
    border-radius: 12px;
    font-weight: 600;
    font-size: 1rem;
    text-decoration: none;
    transition: all var(--duration-normal) ease;
    cursor: pointer;
  }

  .btn-primary {
    background: var(--theme-accent, #6366f1);
    color: white;
  }

  .btn-primary:hover {
    background: var(--theme-accent-strong, #818cf8);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px color-mix(in srgb, var(--theme-accent, #6366f1) 30%, transparent);
  }

  .btn-large {
    padding: 18px 36px;
    font-size: 1.125rem;
  }

  .arrow {
    transition: transform var(--duration-normal) ease;
  }

  .btn:hover .arrow {
    transform: translateX(4px);
  }

  .footer {
    padding: 48px 24px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .footer-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 24px;
    margin-bottom: 24px;
  }

  .footer-brand {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .footer-brand span {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 0.875rem;
  }

  .footer-links {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 24px;
  }

  .footer-links a {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    text-decoration: none;
    font-size: 0.875rem;
    transition: color var(--duration-normal) ease;
  }

  .footer-links a:hover {
    color: var(--theme-text, #ffffff);
  }

  .footer-note {
    padding-top: 24px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }

  .footer-note p {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 0.875rem;
    max-width: 700px;
  }

  .footer-note a {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    text-decoration: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    transition: color var(--duration-normal) ease, border-color var(--duration-normal) ease;
  }

  .footer-note a:hover {
    color: var(--theme-text, #ffffff);
    border-bottom-color: rgba(255, 255, 255, 0.5);
  }

  .footer-legal {
    display: flex;
    gap: 24px;
    padding-top: 24px;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    margin-top: 24px;
  }

  .footer-legal a {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    text-decoration: none;
    font-size: var(--font-size-compact, 0.75rem);
    padding: 8px 0;
    transition: color var(--duration-normal) ease;
  }

  .footer-legal a:hover {
    color: var(--theme-text, #ffffff);
  }

  @media (max-width: 768px) {
    .footer-content {
      flex-direction: column;
      text-align: center;
    }

    .footer-legal {
      justify-content: center;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .btn {
      transition: none;
    }

    .btn:hover .arrow {
      transform: none;
    }

    .footer-links a,
    .footer-legal a {
      transition: none;
    }
  }
</style>
