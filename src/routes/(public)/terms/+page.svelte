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
          Last Updated: April 4, 2026
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
          learning, creating, and sharing TKA (The Kinetic Alphabet) sequences.
          The service includes sequence building tools, learning modules, and
          community features. Some features require a paid subscription.
        </p>
      </section>

      <section id="accounts">
        <h2>3. User Accounts</h2>
        <p>
          You are responsible for maintaining the confidentiality of your
          account credentials. You agree to accept responsibility for all
          activities that occur under your account. You may not share account
          credentials or allow others to access your account.
        </p>
      </section>

      <section id="user-content">
        <h2>4. User Content</h2>
        <p>
          You retain ownership of any sequences, content, or materials you
          create using TKA Composer. By sharing content publicly, you grant
          TKA Composer a non-exclusive, worldwide, royalty-free license to
          display, distribute, and cache that content within the application
          for the purpose of providing the service.
        </p>
        <p>
          TKA Composer may display publicly shared content in browse galleries,
          search results, and promotional materials. This license continues
          after account deletion for content that has already been shared
          publicly, but you may request removal by contacting us.
        </p>
      </section>

      <section id="acceptable-use">
        <h2>5. Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the service for any illegal purposes</li>
          <li>Attempt to gain unauthorized access to the service or other
            users' accounts</li>
          <li>Interfere with or disrupt the service or its infrastructure</li>
          <li>Upload malicious code or harmful content</li>
          <li>Harass, threaten, or harm other users</li>
        </ul>
      </section>

      <section id="automated-access">
        <h2>6. Automated Access and Data Extraction</h2>
        <p>You may not:</p>
        <ul>
          <li>Use bots, scrapers, crawlers, or other automated tools to
            access the service or extract data</li>
          <li>Systematically download, copy, or mirror content from the
            service beyond normal personal use</li>
          <li>Use the service's API or interfaces in ways not intended or
            documented</li>
          <li>Attempt to reverse-engineer, decompile, or extract the source
            code of the application from its hosted form</li>
        </ul>
        <p>
          The TKA notation system and sequence data are open knowledge meant
          to be shared and taught. This restriction targets automated bulk
          extraction from the hosted service, not the knowledge itself. The
          sequence dataset is separately available under open license terms
          as described in the project's LICENSE file.
        </p>
      </section>

      <section id="competing-service">
        <h2>7. Competing Service Restriction</h2>
        <p>
          You may not use the service, its source code, or data obtained
          through the service to build, operate, or contribute to a product
          or service that competes with TKA Composer. This includes hosting
          a substantially similar application as a service for others.
        </p>
        <p>
          Building personal tools, educational materials, or research using
          TKA notation is welcome and encouraged. This restriction targets
          commercial clones and hosted competitors, not the community.
        </p>
      </section>

      <section id="intellectual-property">
        <h2>8. Intellectual Property and Trademarks</h2>
        <p>
          The TKA Composer application, including its design, features, and
          underlying technology, is protected by applicable intellectual
          property laws and licensed under the Elastic License 2.0. The
          source code is available for inspection but is not open source.
        </p>
        <p>
          "The Kinetic Alphabet", "TKA", "TKA Composer", and associated
          logos are trademarks of Austen Cloud. You may not use these names
          to imply endorsement, name a competing product, or create
          confusion about the origin of your work. Fair use for attribution
          (e.g., "compatible with TKA notation") is permitted.
        </p>
        <p>
          The TKA notation system itself is an open standard documented
          under Creative Commons Attribution-ShareAlike 4.0. Anyone can
          teach, reference, and build upon the notation with attribution.
        </p>
      </section>

      <section id="subscriptions">
        <h2>9. Subscriptions and Payments</h2>
        <p>
          Some features require a paid subscription. By subscribing, you
          agree to pay the applicable fees. Subscriptions renew automatically
          unless cancelled before the renewal date.
        </p>
        <p>
          Refunds may be issued at the developer's discretion. If you
          experience a technical issue that prevents access to paid features,
          contact us and we will work to resolve it or issue a refund.
        </p>
        <p>
          Free-tier functionality may change over time. We will provide
          reasonable notice before removing features from the free tier.
        </p>
      </section>

      <section id="contributions">
        <h2>10. Code Contributions</h2>
        <p>
          By submitting code, pull requests, or other contributions to the
          TKA project repositories, you assign all intellectual property
          rights in your contribution to Austen Cloud. You represent that
          you have the right to make this assignment and that your
          contribution does not infringe any third-party rights.
        </p>
        <p>
          This assignment allows the project to maintain a unified licensing
          structure and execute future licensing changes (including the
          post-mortem open source provision described in the LICENSE file).
        </p>
      </section>

      <section id="disclaimers">
        <h2>11. Disclaimers</h2>
        <p>
          TKA Composer is provided "as is" without warranties of any kind,
          express or implied, including but not limited to warranties of
          merchantability, fitness for a particular purpose, and
          non-infringement. There is no guarantee that the service will be
          uninterrupted, secure, or error-free.
        </p>
      </section>

      <section id="liability">
        <h2>12. Limitation of Liability</h2>
        <p>
          TKA Composer and its developer shall not be liable for any
          indirect, incidental, special, consequential, or punitive damages
          arising from your use of the service, including but not limited to
          loss of data, loss of profits, or interruption of service. To the
          maximum extent permitted by law, total liability for any claims
          shall not exceed the amount you paid to use the service in the
          twelve (12) months preceding the claim.
        </p>
      </section>

      <section id="governing-law">
        <h2>13. Governing Law</h2>
        <p>
          These Terms are governed by and construed in accordance with the
          laws of the State of California, United States, without regard to
          conflict of law principles. Any disputes arising from these terms
          or use of the service shall be resolved in the courts of
          California.
        </p>
      </section>

      <section id="changes">
        <h2>14. Changes to Terms</h2>
        <p>
          These terms may be modified at any time. Continued use of the
          service after changes constitutes acceptance of the modified
          terms. Significant changes will be communicated through the app
          or via email at least 30 days before taking effect.
        </p>
      </section>

      <section id="contact">
        <h2>15. Contact</h2>
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
