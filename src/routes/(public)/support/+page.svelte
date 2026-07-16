<script lang="ts">
  /**
   * tkaflowarts.com/support — the "buy me a coffee" page.
   *
   * A general support page for the whole Kinetic Alphabet project, not just the
   * guide: the printed Level 1 guide carries ONE QR that points here, and the
   * site header links here too, so it has to read for someone who arrived from
   * the book AND for someone clicking "Support" in the nav. Stripe Checkout also
   * redirects back HERE (not the in-app modal) on success/cancel.
   *
   * The donation card itself lives in the shared SupportContent component, so
   * this route and the in-app SupportModal render the exact same UI from one
   * source. This route owns only the page chrome: the cosmic background +
   * SiteHeader come from the persistent MarketingChrome (root layout); the
   * viewport-fit sizing and LandingFooter live here; and the Stripe-return
   * status banner is route-only (the modal never receives the redirect).
   */
  import { page } from "$app/state";
  import LandingFooter from "../../landing/components/LandingFooter.svelte";
  import SupportContent from "$lib/shared/support/components/SupportContent.svelte";

  // Stripe returns here on success/cancel.
  const justDonated = $derived(page.url.searchParams.get("donated") === "1");
  const checkoutCanceled = $derived(page.url.searchParams.get("canceled") === "1");
</script>

<svelte:head>
  <title>Support · The Kinetic Alphabet</title>
  <meta
    name="description"
    content="The Kinetic Alphabet is a continuously growing project with 4 years of development behind it. Donations help make this work possible."
  />
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="support-wrap">
  <main class="support">
    <SupportContent donated={justDonated} canceled={checkoutCanceled} />
  </main>

  <LandingFooter showCredit={false} />
</div>

<style>
  .support-wrap {
    /* The whole page — card AND footer — lives inside ONE dynamic viewport so a
       phone/tablet shows everything with no scroll. dvh (not vh) tracks the
       mobile browser chrome so the bottom never hides behind the URL bar; the
       plain vh line is the fallback for engines without dvh.

       BASE = centre the card+footer as ONE group (app-screen feel): the leftover
       space splits evenly above the card and below the footer instead of pooling
       into one dead gap between the signature and the footer. This balances every
       handheld + tablet (phone, iPad portrait/landscape, Z Fold folded/unfolded).
       Only true desktop (wide AND tall, see the bottom @media) reverts to a
       footer pinned at the very bottom, where that reads as expected. */
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .support {
    flex: 0 1 auto; /* size to the card; the wrap centres it as a group */
    min-height: 0; /* let the card shrink to fit instead of forcing page scroll */
    box-sizing: border-box;
    /* top clears the 64px fixed SiteHeader; bottom pad is breathing space below
       the card (the gap to the footer). */
    padding: clamp(70px, 8vh, 84px) 22px clamp(28px, 5vh, 52px);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* The shared LandingFooter pads 64px top+bottom for the tall landing page; on
     /support it must fit inside the same viewport as the card, so trim it down
     and tighten the link row so six links don't wrap into three tall rows. */
  .support-wrap :global(.footer) {
    padding: 14px 24px;
  }
  .support-wrap :global(.footer-links) {
    gap: 10px 18px;
  }
  .support-wrap :global(.footer-links a) {
    padding: 4px 0;
  }

  /* Tablet / landscape that's SHORTER than a desktop window (iPad landscape,
     short laptops). Trim the page padding so the full card + footer fits the
     shorter height and the centred group stays balanced (no scroll, no void). */
  @media (min-width: 521px) and (max-height: 895px) {
    .support {
      padding: 70px 22px clamp(16px, 2.5vh, 30px);
    }
    .support-wrap :global(.footer) {
      padding: 10px 20px;
    }
  }

  /* Small / old phones (iPhone SE, compact Androids ≤ ~690px tall): trim the
     chrome so the whole card + footer still clears the fold. */
  @media (max-height: 690px) {
    .support {
      padding: 66px 22px clamp(20px, 3.5vh, 40px);
    }
    .support-wrap :global(.footer) {
      padding: 9px 16px;
    }
    .support-wrap :global(.footer-links a) {
      font-size: 0.78rem;
    }
  }

  /* SHORT + WIDE (≤540px tall, ≥640px wide): Z Fold folded LANDSCAPE and phones
     held sideways. SupportContent switches its card to a 2-column letter/controls
     grid here; the page just tightens its padding to match. */
  @media (max-height: 540px) and (min-width: 640px) {
    .support {
      padding: 70px 26px 14px; /* 70 clears the fixed header; tight bottom */
    }
    .support-wrap :global(.footer) {
      padding: 8px 16px;
    }
    .support-wrap :global(.footer-links a) {
      font-size: 0.76rem;
      padding: 2px 0;
    }
  }

  /* 4K / ultrawide: the 480px donate card reads miniature on a 4K monitor.
     SupportContent is shared with the in-app modal, so scale it here at the
     route level (zoom is standardized and participates in layout, unlike
     transform) instead of forking the shared card's internals. */
  @media (min-width: 2200px) {
    .support > :global(.jar-card) {
      zoom: 1.3;
    }
  }

  /* True desktop (mouse, not touch): revert to the footer pinned at the very
     bottom with the card centred in the space above it — the expected document
     feel with a cursor. Touch devices (phones, iPads, the Z Fold in every
     fold/orientation) stay on the centred-group base above, which balances them
     as an app-screen. Width can't tell a desktop from a large tablet — both run
     ~1024–1366px wide — but pointer type can: a desktop has a fine pointer that
     hovers; touch screens report coarse / no-hover. */
  @media (hover: hover) and (pointer: fine) {
    .support-wrap {
      justify-content: flex-start;
    }
    .support {
      flex: 1 1 auto;
    }
  }
</style>
