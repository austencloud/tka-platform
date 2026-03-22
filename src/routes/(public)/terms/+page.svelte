<script lang="ts">
  import { onMount } from "svelte";
  import BackgroundHost from "$lib/shared/background/shared/components/BackgroundHost.svelte";
  import { BackgroundType } from "@austencloud/backgrounds";
  import { ANIMATED_BACKGROUNDS } from "$lib/shared/settings/utils/public-page-backgrounds";
  import { applyThemeForBackground } from "$lib/shared/settings/utils/background-theme-calculator";
  import { getPublicThemeIndex, savePublicThemeIndex, getNextThemeIndex } from "$lib/shared/settings/utils/public-page-backgrounds";

  // Use shared animated backgrounds config
  const backgrounds = ANIMATED_BACKGROUNDS;

  // Restore saved theme from localStorage (persists across public pages)
  let currentBgIndex = $state(getPublicThemeIndex());
  let currentBackground = $derived(backgrounds[currentBgIndex]?.type ?? BackgroundType.NIGHT_SKY);
  let currentIcon = $derived(backgrounds[currentBgIndex]?.icon ?? "fa-moon");
  let currentLabel = $derived(backgrounds[currentBgIndex]?.label ?? "Night Sky");

  function cycleBackground() {
    currentBgIndex = getNextThemeIndex(currentBgIndex);
    savePublicThemeIndex(currentBgIndex);
    applyThemeForBackground(backgrounds[currentBgIndex]!.type);
  }

  onMount(() => {
    applyThemeForBackground(currentBackground);
  });

  // In dev, back goes to /landing; in prod, back goes to /
  const backHref = import.meta.env.DEV ? "/landing" : "/";
</script>

<svelte:head>
  <title>Terms of Service | TKA Composer</title>
  <meta
    name="description"
    content="Terms of Service for The Kinetic Alphabet (TKA) application."
  />
</svelte:head>

<div class="terms-page">
  <!-- Animated Background -->
  <BackgroundHost backgroundType={currentBackground} />

  <div class="terms-container">
    <header class="terms-header">
      <a href={backHref} class="back-link">
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
        <span>Back</span>
      </a>

      <div class="header-content">
        <h1>Terms of Service</h1>
        <p class="last-updated">
          Last Updated: January 16, 2026
        </p>
      </div>
    </header>

    <div class="terms-content">
      <section id="acceptance">
        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing and using The Kinetic Alphabet (TKA) application, you
          agree to be bound by these Terms of Service. If you do not agree to
          these terms, please do not use the application.
        </p>
      </section>

      <section id="description">
        <h2>2. Description of Service</h2>
        <p>
          TKA Composer is an educational platform that provides tools for
          learning, creating, and sharing TKA (The Kinetic Alphabet) sequences. The
          service includes sequence building tools, learning modules, and
          community features.
        </p>
      </section>

      <section id="accounts">
        <h2>3. User Accounts</h2>
        <p>
          You are responsible for maintaining the confidentiality of your
          account credentials. You agree to accept responsibility for all
          activities that occur under your account.
        </p>
      </section>

      <section id="user-content">
        <h2>4. User Content</h2>
        <p>
          You retain ownership of any sequences, content, or materials you
          create using TKA Composer. By sharing content publicly, you grant TKA Composer a
          non-exclusive license to display and distribute that content within
          the application for the purpose of providing the service.
        </p>
      </section>

      <section id="acceptable-use">
        <h2>5. Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the service for any illegal purposes</li>
          <li>Attempt to gain unauthorized access to the service</li>
          <li>Interfere with or disrupt the service</li>
          <li>Upload malicious code or harmful content</li>
          <li>Harass or harm other users</li>
        </ul>
      </section>

      <section id="intellectual-property">
        <h2>6. Intellectual Property</h2>
        <p>
          The TKA Composer application, including its design, features, and
          underlying technology, is protected by applicable intellectual property
          laws. The Kinetic Alphabet notation system is an original work
          created to represent flow arts movements in written form.
        </p>
      </section>

      <section id="disclaimers">
        <h2>7. Disclaimers</h2>
        <p>
          TKA Composer is provided "as is" without warranties of any kind. There is
          no guarantee that the service will be uninterrupted, secure, or
          error-free. TKA Composer is an independent project maintained outside of
          regular business hours.
        </p>
      </section>

      <section id="liability">
        <h2>8. Limitation of Liability</h2>
        <p>
          TKA Composer and its developer shall not be liable for any indirect,
          incidental, special, or consequential damages arising from your use
          of the service. To the maximum extent permitted by law, total liability
          for any claims shall not exceed the amount you paid to use the service
          (if any).
        </p>
      </section>

      <section id="changes">
        <h2>9. Changes to Terms</h2>
        <p>
          These terms may be modified at any time. Continued use of the service
          after changes constitutes acceptance of the modified terms. Significant
          changes will be communicated through the app or via email.
        </p>
      </section>

      <section id="contact">
        <h2>10. Contact</h2>
        <p>
          For questions about these Terms of Service, email
          <a href="mailto:tkaflowarts@gmail.com">tkaflowarts@gmail.com</a>.
        </p>
      </section>
    </div>
  </div>

  <!-- Theme Toggle Button -->
  <button
    class="theme-toggle"
    onclick={cycleBackground}
    title="Change theme: {currentLabel}"
    aria-label="Change background theme"
  >
    <i class="fas {currentIcon}" aria-hidden="true"></i>
  </button>
</div>

<style>
  .terms-page {
    position: relative;
    min-height: 100vh;
    color: var(--theme-text, #ffffff);
    overflow-x: hidden;
  }

  /* Container */
  .terms-container {
    position: relative;
    z-index: 1;
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem 1.5rem 4rem;
  }

  /* Header */
  .terms-header {
    margin-bottom: 2rem;
  }

  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    text-decoration: none;
    font-size: 0.875rem;
    padding: 0.5rem 1rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 100px;
    margin-bottom: 2rem;
    transition: all 0.2s ease;
  }

  .back-link:hover {
    color: var(--theme-text, #ffffff);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.05));
  }

  .header-content {
    text-align: center;
  }

  h1 {
    font-size: clamp(2rem, 5vw, 2.5rem);
    font-weight: 700;
    margin: 0 0 0.5rem 0;
    background: linear-gradient(135deg, #fff 0%, rgba(255, 255, 255, 0.7) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    line-height: 1.1;
  }

  .last-updated {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 0.875rem;
    margin: 0;
  }

  /* Content card */
  .terms-content {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 20px;
    padding: 2rem;
    transition: all 0.25s ease;
  }

  .terms-content:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
    transform: translateY(-2px);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  }

  section {
    margin-bottom: 2rem;
  }

  section:last-child {
    margin-bottom: 0;
  }

  h2 {
    font-size: 1.375rem;
    font-weight: 600;
    margin: 0 0 0.75rem 0;
    color: var(--theme-text, #ffffff);
  }

  p {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    line-height: 1.7;
    margin: 0 0 0.75rem 0;
  }

  a {
    color: var(--theme-accent-strong, #818cf8);
    text-decoration: none;
    border-bottom: 1px solid transparent;
    transition: border-color 0.2s ease;
  }

  a:hover {
    border-bottom-color: var(--theme-accent-strong, #818cf8);
  }

  ul {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    line-height: 1.7;
    margin: 0;
    padding-left: 1.5rem;
  }

  li {
    margin-bottom: 0.5rem;
  }

  /* Theme Toggle Button */
  .theme-toggle {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 100;
    width: var(--min-touch-target);
    height: var(--min-touch-target);
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--theme-accent-strong, #818cf8) 15%, rgba(0, 0, 0, 0.5));
    border: 1px solid color-mix(in srgb, var(--theme-accent-strong, #818cf8) 25%, transparent);
    border-radius: 50%;
    color: var(--theme-accent-strong, #818cf8);
    font-size: 1.125rem;
    cursor: pointer;
    backdrop-filter: blur(8px);
    transition: all 0.2s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .theme-toggle:hover {
    background: color-mix(in srgb, var(--theme-accent-strong, #818cf8) 25%, rgba(0, 0, 0, 0.6));
    border-color: color-mix(in srgb, var(--theme-accent-strong, #818cf8) 40%, transparent);
    transform: scale(1.05);
  }

  .theme-toggle:active {
    transform: scale(0.95);
  }

  /* Responsive */
  @media (max-width: 768px) {
    .terms-container {
      padding: 1.5rem 1rem 3rem;
    }

    .terms-content {
      padding: 1.5rem;
    }

    h2 {
      font-size: 1.25rem;
    }

    .theme-toggle {
      bottom: 16px;
      right: 16px;
      width: 44px;
      height: 44px;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .back-link,
    .terms-content,
    .theme-toggle,
    a {
      transition: none;
    }

    .terms-content:hover,
    .theme-toggle:hover {
      transform: none;
    }
  }
</style>
