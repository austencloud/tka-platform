<script lang="ts">
  /**
   * tkaflowarts.com/support — the "buy me a coffee" page.
   *
   * A general support page for the whole Kinetic Alphabet project, not just the
   * guide: the printed Level 1 guide carries ONE QR that points here, and the
   * site header links here too, so it has to read for someone who arrived from
   * the book AND for someone clicking "Support" in the nav.
   *
   * The cosmic background + SiteHeader come from the persistent MarketingChrome
   * (root layout); this page renders its content and its own LandingFooter. A
   * suggested-amount selector drives prefilled deep links (PayPal.me, Venmo web
   * pay, Cash App) and a Stripe Checkout "pay by card" path
   * (createDonationCheckout function), so the chosen amount carries straight into
   * whichever method the visitor picks.
   */
  import { slide } from "svelte/transition";
  import { page } from "$app/state";
  import LandingFooter from "../../landing/components/LandingFooter.svelte";
  import SegmentedControl from "$lib/shared/3d/components/controls/SegmentedControl.svelte";

  // ── Suggested amounts ──────────────────────────────────────────────────────
  type Tier = "5" | "15" | "custom";
  const AMOUNT_OPTIONS: { value: Tier; label: string }[] = [
    { value: "5", label: "Coffee · $5" },
    { value: "15", label: "Lunch · $15" },
    { value: "custom", label: "Custom" },
  ];

  let tier = $state<Tier>("5");
  let customDollars = $state<number | null>(null);

  const dollars = $derived(
    tier === "custom" ? (customDollars ?? 0) : Number(tier)
  );
  const validAmount = $derived(dollars >= 1 && dollars <= 1000);
  // " $5 " when valid, "" when not — keeps a stray "$0" out of labels while a
  // Custom amount is still empty.
  const amtLabel = $derived(validAmount ? `$${dollars} ` : "");
  // PayPal.me and Cash App take the amount as a trailing path segment.
  const amountPath = $derived(validAmount ? `/${dollars}` : "");
  const note = encodeURIComponent("Thank you for supporting TKA! 🙏");

  const paypalHref = $derived(
    `https://www.paypal.com/paypalme/austencloud${amountPath}`
  );
  const cashHref = $derived(`https://cash.app/$austencloud${amountPath}`);
  // Venmo web pay URL. The recipient MUST be a path segment (venmo.com/<user>),
  // matching the PayPal/Cash App links above. The `recipients=` query param is
  // only valid for the native venmo:// scheme — using it on the venmo.com host
  // leaves the web/app flow with no named recipient, so it drops into the
  // multi-person "split" picker ("$X each / $Y total"). Path segment avoids that.
  const venmoHref = $derived(
    `https://venmo.com/austencloud?txn=pay${
      validAmount ? `&amount=${dollars}` : ""
    }&note=${note}`
  );

  // ── Pay by card (Stripe Checkout) ──────────────────────────────────────────
  let cardLoading = $state(false);
  let cardError = $state<string | null>(null);

  // Focus the custom amount field the moment it appears, so picking "Custom" is
  // immediately ready to type into.
  function focusInput(node: HTMLInputElement) {
    node.focus();
  }

  async function payByCard() {
    if (!validAmount || cardLoading) return;
    cardLoading = true;
    cardError = null;
    try {
      // Dynamic import keeps the firebase SDK out of the public/landing bundle.
      const { createDonationCheckout } = await import(
        "$lib/shared/support/donation-checkout"
      );
      const url = await createDonationCheckout(
        Math.round(dollars * 100),
        window.location.origin
      );
      window.location.href = url;
    } catch (e) {
      console.error("[support] card checkout failed", e);
      cardError = "Couldn't start card checkout. Try a method below, or again in a moment.";
      cardLoading = false;
    }
  }

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
      <section class="jar-card">
        {#if justDonated}
          <p class="donated" role="status">Thank you, truly. Your support means a lot.</p>
        {:else if checkoutCanceled}
          <p class="canceled" role="status">Checkout canceled. You weren't charged.</p>
        {/if}

        <div class="tell">
        <h1 class="title">Buy me a coffee</h1>
        <div class="lines">
          <p class="line lead">
            The Kinetic Alphabet is a continuously growing project, with
            <strong>4&nbsp;years of development</strong> behind it.
          </p>
          <p class="line">Donations play a huge role in making this work possible.</p>
          <p class="line accent">
            Please consider supporting, any amount is deeply appreciated!
          </p>
        </div>
        </div>

        <div class="act">
        <!-- Suggested amount -->
        <div class="amounts">
          <SegmentedControl
            options={AMOUNT_OPTIONS}
            value={tier}
            onchange={(v) => (tier = v)}
            color="accent"
          />
          {#if tier === "custom"}
            <div class="custom-amount" transition:slide={{ duration: 220 }}>
              <span class="dollar" aria-hidden="true">$</span>
              <input
                type="number"
                min="1"
                max="1000"
                step="1"
                inputmode="numeric"
                placeholder="Amount"
                aria-label="Custom amount in dollars"
                use:focusInput
                bind:value={customDollars}
              />
            </div>
          {/if}
        </div>

        <!-- Primary: pay by card (works for everyone, no app needed) -->
        <button
          type="button"
          class="card-cta"
          onclick={payByCard}
          disabled={!validAmount || cardLoading}
        >
          <i class="fas fa-credit-card" aria-hidden="true"></i>
          <span>
            {#if cardLoading}
              Starting checkout…
            {:else}
              Donate{#if validAmount}&nbsp;<span class="amt">${dollars}</span>{/if} by card
            {/if}
          </span>
        </button>
        {#if cardError}
          <p class="card-err" role="alert">{cardError}</p>
        {/if}

        <p class="or">or send{#if validAmount}&nbsp;<span class="amt">${dollars}</span>{/if} directly</p>

        <div class="jar">
          <a
            class="pay paypal"
            href={paypalHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Send ${amtLabel}via PayPal, @austencloud`}
          >
            <svg class="logo" viewBox="0 0 24 24" aria-hidden="true"
              ><path
                d="M15.607 4.653H8.941L6.645 19.251H1.82L4.862 0h7.995c3.754 0 6.375 2.294 6.473 5.513-.648-.478-2.105-.86-3.722-.86m6.57 5.546c0 3.41-3.01 6.853-6.958 6.853h-2.493L11.595 24H6.74l1.845-11.538h3.592c4.208 0 7.346-3.634 7.153-6.949a5.24 5.24 0 0 1 2.848 4.686M9.653 5.546h6.408c.907 0 1.942.222 2.363.541-.195 2.741-2.655 5.483-6.441 5.483H8.714Z"
              /></svg
            >
            <span class="handle">@austencloud</span>
          </a>

          <a
            class="pay venmo"
            href={venmoHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Send ${amtLabel}via Venmo, @austencloud`}
          >
            <svg class="logo logo--venmo" viewBox="0 9.4 24 5.2" aria-hidden="true"
              ><path
                d="M21.772 13.119c-.267 0-.381-.251-.38-.655 0-.533.121-1.575.712-1.575.267 0 .357.243.357.598 0 .533-.13 1.632-.689 1.632Zm.502-3.377c-1.677 0-2.405 1.285-2.405 2.658 0 1.042.421 1.874 1.693 1.874 1.717 0 2.438-1.406 2.438-2.763 0-1.025-.462-1.769-1.726-1.769Zm-3.833 0c-.558 0-.964.17-1.393.477-.154-.275-.462-.477-.932-.477-.542 0-.947.219-1.247.437l-.04-.364H13.54l-.688 4.354h1.506l.479-3.053c.129-.065.323-.154.518-.154.145 0 .267.049.267.267 0 .056-.016.145-.024.218l-.429 2.722h1.498l.478-3.053c.138-.073.324-.154.51-.154.146 0 .268.049.268.267 0 .056-.017.145-.025.218l-.429 2.722h1.499l.461-2.908c.025-.153.049-.388.049-.549 0-.582-.267-.97-1.037-.97Zm-6.871 0c-.575 0-.98.219-1.287.421l-.017-.348H8.962l-.689 4.354H9.78l.478-3.053c.13-.065.324-.154.518-.154.147 0 .268.049.268.242 0 .081-.024.227-.032.299l-.422 2.666h1.499l.462-2.908c.024-.153.049-.388.049-.549 0-.582-.268-.97-1.03-.97Zm-5.631 1.834c.041-.485.413-.824.697-.824.162 0 .299.097.299.291 0 .404-.713.533-.996.533Zm.843-1.834c-1.604 0-2.382 1.39-2.382 2.698 0 1.01.478 1.817 1.814 1.817.527 0 1.07-.113 1.418-.282l.186-1.26c-.494.25-.874.347-1.271.347-.365 0-.64-.194-.64-.687.826-.008 2.252-.347 2.252-1.453 0-.687-.494-1.18-1.377-1.18Zm-4.239.267c.089.186.146.412.146.743 0 .606-.429 1.494-.777 2.06l-.373-2.989L0 9.969l.705 4.2h1.757c.77-1.01 1.718-2.448 1.718-3.554 0-.347-.073-.622-.235-.889l-1.402.283Z"
              /></svg
            >
            <span class="handle">@austencloud</span>
          </a>

          <a
            class="pay cashapp"
            href={cashHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Send ${amtLabel}via Cash App, $austencloud`}
          >
            <svg class="logo" viewBox="0 0 24 24" aria-hidden="true"
              ><path
                d="M23.59 3.475a5.1 5.1 0 00-3.05-3.05c-1.31-.42-2.5-.42-4.92-.42H8.36c-2.4 0-3.61 0-4.9.4a5.1 5.1 0 00-3.05 3.06C0 4.765 0 5.965 0 8.365v7.27c0 2.41 0 3.6.4 4.9a5.1 5.1 0 003.05 3.05c1.3.41 2.5.41 4.9.41h7.28c2.41 0 3.61 0 4.9-.4a5.1 5.1 0 003.06-3.06c.41-1.3.41-2.5.41-4.9v-7.25c0-2.41 0-3.61-.41-4.91zm-6.17 4.63l-.93.93a.5.5 0 01-.67.01 5 5 0 00-3.22-1.18c-.97 0-1.94.32-1.94 1.21 0 .9 1.04 1.2 2.24 1.65 2.1.7 3.84 1.58 3.84 3.64 0 2.24-1.74 3.78-4.58 3.95l-.26 1.2a.49.49 0 01-.48.39H9.63l-.09-.01a.5.5 0 01-.38-.59l.28-1.27a6.54 6.54 0 01-2.88-1.57v-.01a.48.48 0 010-.68l1-.97a.49.49 0 01.67 0c.91.86 2.13 1.34 3.39 1.32 1.3 0 2.17-.55 2.17-1.42 0-.87-.88-1.1-2.54-1.72-1.76-.63-3.43-1.52-3.43-3.6 0-2.42 2.01-3.6 4.39-3.71l.25-1.23a.48.48 0 01.48-.38h1.78l.1.01c.26.06.43.31.37.57l-.27 1.37c.9.3 1.75.77 2.48 1.39l.02.02c.19.2.19.5 0 .68z"
              /></svg
            >
            <span class="handle">$austencloud</span>
          </a>
        </div>
        </div>

        <div class="signature">
        <p class="signoff">With love,</p>
        <p class="sign">Austen Cloud</p>
        </div>
      </section>
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

  .jar-card {
    width: 100%;
    max-width: 480px;
    text-align: center;
  }

  .donated,
  .canceled {
    max-width: 30rem;
    margin: 0 auto 1.6rem;
    padding: 0.7rem 1.1rem;
    border-radius: 12px;
    font-weight: 600;
  }
  .donated {
    background: rgba(34, 197, 94, 0.14);
    border: 1px solid rgba(34, 197, 94, 0.4);
    color: #86efac;
  }
  .canceled {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.16);
    color: rgba(255, 255, 255, 0.78);
  }

  .title {
    font-weight: 700;
    font-size: clamp(2.5rem, 6vw, 3.5rem);
    line-height: 1.2;
    padding-bottom: 0.12em; /* room for the 'y' descender under background-clip:text */
    margin: 0 0 0.6rem;
    background: linear-gradient(135deg, #fff 0%, rgba(255, 255, 255, 0.7) 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .lines {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    max-width: 30rem;
    margin: 0 auto 2rem;
  }
  .line {
    margin: 0;
    font-size: 1.1rem;
    line-height: 1.55;
    color: rgba(255, 255, 255, 0.66);
    text-wrap: balance;
  }
  .line.lead {
    font-size: 1.2rem;
    color: rgba(255, 255, 255, 0.86);
  }
  .line strong {
    color: #ffffff;
    font-weight: 600;
  }
  .line.accent {
    color: #b8bdf2;
    font-weight: 500;
  }
  .line + .line {
    position: relative;
    padding-top: 1rem;
  }
  .line + .line::before {
    content: "";
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.28);
  }

  /* ── amounts ── */
  .amounts {
    width: 100%;
    margin: 0 auto 18px;
  }
  .custom-amount {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-top: 12px;
  }
  .custom-amount .dollar {
    font-size: 1.2rem;
    color: rgba(255, 255, 255, 0.7);
  }
  .custom-amount input {
    width: 130px;
    padding: 10px 12px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.16);
    color: #fff;
    font-size: 1rem;
    text-align: center;
    font-variant-numeric: tabular-nums;
    /* no up/down stepper */
    -moz-appearance: textfield;
    appearance: textfield;
  }
  .custom-amount input::-webkit-outer-spin-button,
  .custom-amount input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .custom-amount input:focus-visible {
    outline: none;
    border-color: var(--theme-accent, #818cf8);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--theme-accent, #818cf8) 40%, transparent);
  }

  .amt {
    font-variant-numeric: tabular-nums;
  }

  /* ── primary: pay by card ── */
  .card-cta {
    display: flex;
    width: 100%;
    box-sizing: border-box;
    align-items: center;
    justify-content: center;
    gap: 11px;
    min-height: 56px;
    padding: 0 30px;
    border: none;
    border-radius: 14px;
    cursor: pointer;
    color: #fff;
    font-size: 1.08rem;
    font-weight: 700;
    background: linear-gradient(135deg, #6f8cff, #8b6cff);
    box-shadow: 0 14px 34px rgba(110, 100, 255, 0.35);
    transition:
      transform 0.16s ease,
      box-shadow 0.16s ease,
      filter 0.16s ease;
  }
  .card-cta:hover:not(:disabled),
  .card-cta:focus-visible:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 20px 46px rgba(110, 100, 255, 0.5);
    filter: saturate(1.08);
    outline: none;
  }
  .card-cta:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .card-cta i {
    font-size: 1.05rem;
  }
  .card-err {
    margin: 0.7rem auto 0;
    max-width: 26rem;
    font-size: 0.85rem;
    color: #fca5a5;
  }

  .or {
    margin: 20px 0 14px;
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.5);
  }

  /* ── payment app buttons (glass + brand tint) ── */
  .jar {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
  }

  .pay {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    min-height: 116px;
    padding: 22px 14px;
    border-radius: 16px;
    text-decoration: none;
    color: var(--theme-text, #fff);
    background:
      linear-gradient(
        155deg,
        color-mix(in srgb, var(--brand) 16%, transparent) 0%,
        color-mix(in srgb, var(--brand) 5%, transparent) 55%,
        transparent 100%
      ),
      rgba(255, 255, 255, 0.045);
    border: 1px solid color-mix(in srgb, var(--brand) 24%, rgba(255, 255, 255, 0.12));
    -webkit-backdrop-filter: blur(14px) saturate(1.15);
    backdrop-filter: blur(14px) saturate(1.15);
    box-shadow:
      0 8px 24px rgba(0, 0, 0, 0.32),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
    transition:
      transform 0.18s ease,
      border-color 0.18s ease,
      background 0.18s ease,
      box-shadow 0.18s ease;
  }
  .pay:hover,
  .pay:focus-visible {
    transform: translateY(-4px);
    background:
      linear-gradient(
        155deg,
        color-mix(in srgb, var(--brand) 28%, transparent) 0%,
        color-mix(in srgb, var(--brand) 11%, transparent) 60%,
        transparent 100%
      ),
      rgba(255, 255, 255, 0.06);
    border-color: var(--brand);
    box-shadow:
      0 18px 40px rgba(0, 0, 0, 0.42),
      inset 0 0 0 1px var(--brand),
      0 12px 34px var(--glow);
    outline: none;
  }
  .pay:active {
    transform: translateY(-1px);
  }

  .logo {
    height: 28px;
    width: auto;
    display: block;
    fill: var(--brand);
    transition: filter 0.18s ease;
  }
  .logo--venmo {
    height: auto;
    width: 78px;
  }
  .pay:hover .logo,
  .pay:focus-visible .logo {
    filter: drop-shadow(0 0 10px var(--glow));
  }

  .handle {
    font-weight: 600;
    font-size: 0.92rem;
    letter-spacing: 0.01em;
    color: rgba(255, 255, 255, 0.82);
  }

  .paypal {
    --brand: #2d9cdb;
    --glow: rgba(45, 156, 219, 0.45);
  }
  .venmo {
    --brand: #3d95ff;
    --glow: rgba(61, 149, 255, 0.45);
  }
  .cashapp {
    --brand: #00d957;
    --glow: rgba(0, 217, 87, 0.45);
  }

  .signoff {
    font-size: 0.95rem;
    margin: 2.4rem 0 0;
    color: rgba(255, 255, 255, 0.55);
  }
  .sign {
    font-weight: 600;
    font-size: 1.3rem;
    margin: 0.15rem 0 0;
    color: #818cf8;
  }

  /* Phone: a compact, calmer card. Smaller type and tighter rhythm so the copy
     reads less crowded AND leaves headroom for the Custom-amount field to open
     without shoving the footer past the fold. The three payment apps stay a 3-up
     row (icon over handle) — stacking them to full-width rows added ~170px and
     was the original scroll culprit. Values are fixed (not vh-scaled): every
     phone gets the same compact card, centered, so taller screens simply gain
     breathing room top and bottom — no per-size breakpoint gaps. */
  @media (max-width: 520px) {
    .title {
      font-size: clamp(1.6rem, 6.8vw, 2.05rem);
      margin-bottom: 0.3rem;
    }
    .lines {
      gap: 0.3rem;
      margin-bottom: 0.7rem;
    }
    .line {
      font-size: 0.88rem;
      line-height: 1.4;
    }
    .line.lead {
      font-size: 0.94rem;
    }
    .line + .line {
      padding-top: 0.5rem;
    }
    .amounts {
      margin-bottom: 10px;
    }
    .card-cta {
      min-height: 52px;
      font-size: 1rem;
    }
    .or {
      margin: 10px 0 8px;
      font-size: 0.85rem;
    }

    .jar {
      gap: 10px;
    }
    .pay {
      gap: 7px;
      min-height: 0;
      padding: 12px 6px;
    }
    .logo {
      height: 21px;
    }
    .logo--venmo {
      width: 56px;
    }
    .handle {
      font-size: 0.72rem;
    }

    .signoff {
      font-size: 0.9rem;
      margin-top: 0.85rem;
    }
    .sign {
      font-size: 1.1rem;
    }
  }

  /* Tablet / landscape that's SHORTER than a desktop window (iPad landscape
     1024×768, iPad mini 1133×744, Air/Pro 11 landscape, Z Fold unfolded
     landscape, short laptops). min-width:521 keeps this OFF phones — they have
     their own smaller scale above and source order would otherwise let this
     overwrite it. Mild trim so the full card + footer fits the shorter height
     and the centred group stays balanced (no scroll, no void). */
  @media (min-width: 521px) and (max-height: 895px) {
    .support {
      padding: 70px 22px clamp(16px, 2.5vh, 30px);
    }
    .title {
      font-size: clamp(1.9rem, 4.6vw, 2.6rem);
      margin-bottom: 0.4rem;
    }
    .lines {
      gap: 0.45rem;
      margin-bottom: 1rem;
    }
    .line {
      font-size: 0.98rem;
      line-height: 1.4;
    }
    .line.lead {
      font-size: 1.05rem;
    }
    .line + .line {
      padding-top: 0.55rem;
    }
    .amounts {
      margin-bottom: 12px;
    }
    .card-cta {
      min-height: 50px;
    }
    .or {
      margin: 12px 0 10px;
    }
    .jar {
      gap: 10px;
    }
    .pay {
      min-height: 0;
      padding: 13px 8px;
      gap: 9px;
    }
    .logo {
      height: 23px;
    }
    .logo--venmo {
      width: 60px;
    }
    .signoff {
      margin-top: 1rem;
      font-size: 0.9rem;
    }
    .sign {
      font-size: 1.15rem;
    }
    .support-wrap :global(.footer) {
      padding: 10px 20px;
    }
  }

  /* Small / old phones (iPhone SE, compact Androids ≤ ~690px tall): trim the
     chrome so the whole card + footer still clears the fold (now with the
     @handles kept — they fit at this size and read fuller than bare icons). */
  @media (max-height: 690px) {
    .support {
      padding: 66px 22px clamp(20px, 3.5vh, 40px);
    }
    .title {
      font-size: clamp(1.45rem, 6vw, 1.75rem);
    }
    .pay {
      padding: 11px 6px;
    }
    .support-wrap :global(.footer) {
      padding: 9px 16px;
    }
    .support-wrap :global(.footer-links a) {
      font-size: 0.78rem;
    }
  }

  /* SHORT + WIDE (≤540px tall, ≥640px wide): Z Fold 6 folded LANDSCAPE
     (~1110×452) and phones held sideways. A single column can't fit ~330px of
     card into ~280px of usable height, so spend the width instead: a 2-column
     grid puts the "letter" (title + copy + signature) on the left and the
     donation controls on the right, which halves the vertical stack. The
     .tell/.act/.signature wrappers are plain blocks everywhere else (DOM order =
     the portrait single column), and only become grid areas here. */
  @media (max-height: 540px) and (min-width: 640px) {
    .support {
      padding: 70px 26px 14px; /* 70 clears the fixed header; tight bottom */
    }
    .jar-card {
      max-width: 760px;
      display: grid;
      grid-template-columns: 1.05fr 1fr;
      grid-template-areas:
        "status status"
        "tell   act"
        "sign   act";
      align-items: start;
      column-gap: clamp(22px, 4vw, 44px);
      row-gap: 4px;
      text-align: left;
    }
    .donated,
    .canceled {
      grid-area: status;
      margin: 0 0 8px;
    }
    .tell {
      grid-area: tell;
    }
    .act {
      grid-area: act;
      align-self: center;
      display: flex;
      flex-direction: column;
    }
    .signature {
      grid-area: sign;
      align-self: end;
    }

    .title {
      font-size: clamp(1.4rem, 4.4vw, 1.85rem);
      margin-bottom: 0.35rem;
    }
    .lines {
      gap: 0.3rem;
      margin: 0;
      max-width: none;
      align-items: flex-start;
    }
    .line {
      font-size: 0.82rem;
      line-height: 1.35;
      text-align: left;
    }
    .line.lead {
      font-size: 0.9rem;
    }
    .line + .line {
      padding-top: 0.45rem;
    }
    .line + .line::before {
      left: 0;
      transform: none; /* divider dot to the left edge, not centred */
    }
    .amounts {
      margin: 0 0 10px;
    }
    .card-cta {
      min-height: 46px;
      font-size: 0.98rem;
    }
    .or {
      margin: 9px 0 8px;
      font-size: 0.82rem;
    }
    .jar {
      gap: 8px;
    }
    .pay {
      gap: 6px;
      min-height: 0;
      padding: 10px 6px;
    }
    .logo {
      height: 19px;
    }
    .logo--venmo {
      width: 52px;
    }
    .handle {
      font-size: 0.68rem;
    }
    .signoff {
      font-size: 0.82rem;
      margin: 0.5rem 0 0;
    }
    .sign {
      font-size: 1rem;
    }
    .support-wrap :global(.footer) {
      padding: 8px 16px;
    }
    .support-wrap :global(.footer-links a) {
      font-size: 0.76rem;
      padding: 2px 0;
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

  @media (prefers-reduced-motion: reduce) {
    .pay,
    .card-cta {
      transition: none;
    }
    .pay:hover,
    .pay:focus-visible,
    .card-cta:hover:not(:disabled) {
      transform: none;
    }
  }
</style>
