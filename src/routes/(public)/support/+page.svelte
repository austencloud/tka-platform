<script lang="ts">
  /**
   * tkaflowarts.com/support — the "buy me a coffee" page.
   *
   * A general support page for the whole Kinetic Alphabet project, not just the
   * guide: the printed Level 1 guide carries ONE QR that points here, and the
   * site header links here too, so it has to read for someone who arrived from
   * the book AND for someone clicking "Support" in the nav.
   *
   * Lives inside the public chrome (SiteHeader + LandingFooter) over the same
   * COSMIC background the landing page uses (BackgroundHost in a fixed layer,
   * content above it), so the page is visually continuous with the rest of the
   * site and the footer shares the page background. Payment methods (PayPal,
   * Venmo, Cash App) can change without reprinting the book.
   */
  import { onMount } from "svelte";
  import BackgroundHost from "$lib/shared/background/shared/components/BackgroundHost.svelte";
  import { BackgroundType } from "@austencloud/backgrounds";
  import { applyThemeForBackground } from "$lib/shared/settings/utils/background-theme-calculator";
  import SiteHeader from "$lib/shared/landing/components/SiteHeader.svelte";
  import LandingFooter from "../../landing/components/LandingFooter.svelte";

  const BG = BackgroundType.COSMIC;
  let mounted = $state(false);

  onMount(() => {
    applyThemeForBackground(BG);
    mounted = true;
  });
</script>

<svelte:head>
  <title>Support · The Kinetic Alphabet</title>
  <meta
    name="description"
    content="The Kinetic Alphabet is a continuously growing project with 4 years of development behind it. Donations help make this work possible."
  />
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="support-page">
  {#if mounted}
    <div class="background-layer">
      <BackgroundHost backgroundType={BG} />
    </div>
  {/if}

  <div class="content-layer">
    <SiteHeader />

    <main class="support">
      <section class="jar-card">
        <h1 class="title">Buy me a coffee</h1>
        <div class="lines">
          <p class="line lead">
            The Kinetic Alphabet is a continuously growing project, with
            <strong>4&nbsp;years of development</strong> behind it.
          </p>
          <p class="line">Donations play a huge role in making this work possible.</p>
          <p class="line accent">
            Please consider supporting this work, any amount is deeply appreciated!
          </p>
        </div>

        <div class="jar">
          <a
            class="pay paypal"
            href="https://www.paypal.com/paypalme/austencloud"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Support via PayPal, @austencloud"
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
            href="https://venmo.com/code?user_id=2250430063050753012"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Support via Venmo, @austencloud"
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
            href="https://cash.app/$austencloud"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Support via Cash App, $austencloud"
          >
            <svg class="logo" viewBox="0 0 24 24" aria-hidden="true"
              ><path
                d="M23.59 3.475a5.1 5.1 0 00-3.05-3.05c-1.31-.42-2.5-.42-4.92-.42H8.36c-2.4 0-3.61 0-4.9.4a5.1 5.1 0 00-3.05 3.06C0 4.765 0 5.965 0 8.365v7.27c0 2.41 0 3.6.4 4.9a5.1 5.1 0 003.05 3.05c1.3.41 2.5.41 4.9.41h7.28c2.41 0 3.61 0 4.9-.4a5.1 5.1 0 003.06-3.06c.41-1.3.41-2.5.41-4.9v-7.25c0-2.41 0-3.61-.41-4.91zm-6.17 4.63l-.93.93a.5.5 0 01-.67.01 5 5 0 00-3.22-1.18c-.97 0-1.94.32-1.94 1.21 0 .9 1.04 1.2 2.24 1.65 2.1.7 3.84 1.58 3.84 3.64 0 2.24-1.74 3.78-4.58 3.95l-.26 1.2a.49.49 0 01-.48.39H9.63l-.09-.01a.5.5 0 01-.38-.59l.28-1.27a6.54 6.54 0 01-2.88-1.57v-.01a.48.48 0 010-.68l1-.97a.49.49 0 01.67 0c.91.86 2.13 1.34 3.39 1.32 1.3 0 2.17-.55 2.17-1.42 0-.87-.88-1.1-2.54-1.72-1.76-.63-3.43-1.52-3.43-3.6 0-2.42 2.01-3.6 4.39-3.71l.25-1.23a.48.48 0 01.48-.38h1.78l.1.01c.26.06.43.31.37.57l-.27 1.37c.9.3 1.75.77 2.48 1.39l.02.02c.19.2.19.5 0 .68z"
              /></svg
            >
            <span class="handle">$austencloud</span>
          </a>
        </div>

        <p class="sign">Austen Cloud</p>
        <p class="role">Creator of The Kinetic Alphabet</p>
      </section>
    </main>

    <LandingFooter showCredit={false} />
  </div>
</div>

<style>
  .support-page {
    position: relative;
    min-height: 100vh;
    overflow-x: hidden;
    color: var(--theme-text, #ffffff);
  }

  .background-layer {
    position: fixed;
    inset: 0;
    z-index: 0;
  }

  .content-layer {
    position: relative;
    z-index: 1;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .support {
    flex: 1;
    box-sizing: border-box;
    padding: 64px 22px 48px; /* top clears the fixed SiteHeader */
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .jar-card {
    width: 100%;
    max-width: 560px;
    text-align: center;
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
    margin: 0 auto 2.5rem;
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
  /* a teeny divider dot between sections */
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

  /* three methods, side by side */
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
    min-height: 132px;
    padding: 24px 14px;
    border-radius: 16px;
    text-decoration: none;
    color: var(--theme-text, #fff);
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
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
    background: rgba(255, 255, 255, 0.08);
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
    height: 30px;
    width: auto;
    display: block;
    fill: var(--brand);
    transition: filter 0.18s ease;
  }
  .logo--venmo {
    height: auto;
    width: 82px;
  }
  .pay:hover .logo,
  .pay:focus-visible .logo {
    filter: drop-shadow(0 0 10px var(--glow));
  }

  .handle {
    font-weight: 600;
    font-size: 0.95rem;
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

  .sign {
    font-weight: 600;
    font-size: 1.25rem;
    margin: 2.4rem 0 0;
    color: #818cf8;
  }
  .role {
    font-size: 0.9rem;
    margin: 0.2rem 0 0;
    color: rgba(255, 255, 255, 0.5);
  }

  @media (max-width: 520px) {
    .jar {
      grid-template-columns: 1fr;
      max-width: 340px;
      margin: 0 auto;
    }
    .pay {
      flex-direction: row;
      gap: 16px;
      min-height: 72px;
      justify-content: flex-start;
      padding: 0 22px;
    }
    .handle {
      margin-left: auto;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .pay {
      transition: none;
    }
    .pay:hover,
    .pay:focus-visible {
      transform: none;
    }
  }
</style>
