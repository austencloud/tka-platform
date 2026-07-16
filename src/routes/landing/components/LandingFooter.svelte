<script lang="ts">
  import LegalSheet from "$lib/shared/legal/components/LegalSheet.svelte";
  import { APP_DOMAIN } from "../../../config/domains";

  // showCredit hides the "Made by Austen Cloud." line on pages that already
  // credit the author elsewhere (e.g. /support's signature) to avoid a double
  // credit. Defaults true so the landing page is unaffected.
  let { showCredit = true }: { showCredit?: boolean } = $props();

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
    {#if showCredit}
      <p class="credit">Made by Austen Cloud.</p>
    {/if}
    <nav class="footer-links">
      <a href="/about">About</a>
      <a href="/notation">Notation</a>
      <a href="/roots">Roots</a>
      <a href="/composer">Flow Arts Composer</a>
      <a href="/shop">Shop</a>
      <a href="/create?sheet=auth" data-sveltekit-reload>Sign in</a>
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
    gap: 20px;
  }

  .credit {
    font-size: var(--font-size-sm, 0.875rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.45));
    margin: 0;
  }

  .footer-links {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 24px;
  }

  .footer-links a {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-decoration: none;
    font-size: var(--font-size-sm, 0.875rem);
    padding: 8px 0;
    transition: color 0.2s ease;
  }

  .footer-links a:hover {
    color: var(--theme-text, #ffffff);
  }

  /* 4K / ultrawide: one type step up so the footer doesn't read miniature. */
  @media (min-width: 2200px) {
    .credit,
    .footer-links a {
      font-size: 1rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .footer-links a {
      transition: none;
    }
  }
</style>
