<script lang="ts">
  import LegalSheet from "$lib/shared/legal/components/LegalSheet.svelte";
  import { APP_DOMAIN } from "../../../config/domains";

  let sheetOpen = $state(false);
  let sheetType = $state<"terms" | "privacy">("terms");

  const MOBILE_BREAKPOINT = 768;

  function handleLegalClick(e: MouseEvent, type: "terms" | "privacy") {
    if (window.innerWidth < MOBILE_BREAKPOINT) {
      e.preventDefault();
      sheetType = type;
      sheetOpen = true;
    }
  }

  function closeSheet() {
    sheetOpen = false;
  }
</script>

<footer class="footer">
  <div class="container">
    <a href={APP_DOMAIN} class="btn btn-primary">
      Open TKA Scribe
      <span class="arrow">→</span>
    </a>

    <nav class="footer-links">
      <a href="/about">About</a>
      <a href="/roots">Roots</a>
      <a href="/terms" onclick={(e) => handleLegalClick(e, "terms")}>Terms</a>
      <a href="/privacy" onclick={(e) => handleLegalClick(e, "privacy")}>Privacy</a>
    </nav>
  </div>
</footer>

<LegalSheet isOpen={sheetOpen} type={sheetType} onClose={closeSheet} />

<style>
  .footer {
    padding: 64px 24px;
    text-align: center;
  }

  .container {
    max-width: 600px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 32px;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 16px 32px;
    border-radius: 12px;
    font-weight: 600;
    font-size: 1.125rem;
    text-decoration: none;
    transition: background var(--duration-normal, 0.2s) ease,
                transform var(--duration-normal, 0.2s) ease;
  }

  .btn-primary {
    background: var(--theme-accent, #6366f1);
    color: white;
  }

  .btn-primary:hover {
    background: var(--theme-accent-strong, #818cf8);
    transform: translateY(-2px);
  }

  .arrow {
    transition: transform var(--duration-normal, 0.2s) ease;
  }

  .btn:hover .arrow {
    transform: translateX(4px);
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
    padding: 8px 0;
    transition: color var(--duration-normal, 0.2s) ease;
  }

  .footer-links a:hover {
    color: var(--theme-text, #ffffff);
  }

  @media (prefers-reduced-motion: reduce) {
    .btn,
    .arrow,
    .footer-links a {
      transition: none;
    }

    .btn:hover {
      transform: none;
    }

    .btn:hover .arrow {
      transform: none;
    }
  }
</style>
