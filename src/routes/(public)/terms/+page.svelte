<script lang="ts">
</script>

<svelte:head>
  <title>Terms of Service | TKA Scribe</title>
  <meta
    name="description"
    content="Terms of Service for The Kinetic Alphabet (TKA) application."
  />
</svelte:head>

<div class="terms-page">
  <div class="terms-container">
    <header class="terms-header">
      <a href="/" class="back-link">
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
        Back to App
      </a>
      <h1>Terms of Service</h1>
      <p class="last-updated">
        Last Updated: {new Date().toLocaleDateString()}
      </p>
    </header>

    <div class="terms-content">
      <section>
        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing and using The Kinetic Alphabet (TKA) application, you
          agree to be bound by these Terms of Service. If you do not agree to
          these terms, please do not use the application.
        </p>
      </section>

      <section>
        <h2>2. Description of Service</h2>
        <p>
          TKA Scribe is an educational platform that provides tools for
          learning, creating, and sharing kinetic alphabet sequences. The
          service includes sequence building tools, learning modules, and
          community features.
        </p>
      </section>

      <section>
        <h2>3. User Accounts</h2>
        <p>
          You are responsible for maintaining the confidentiality of your
          account credentials. You agree to accept responsibility for all
          activities that occur under your account.
        </p>
      </section>

      <section>
        <h2>4. User Content</h2>
        <p>
          You retain ownership of any sequences, content, or materials you
          create using TKA. By sharing content publicly, you grant TKA a license
          to display and distribute that content within the application.
        </p>
      </section>

      <section>
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

      <section>
        <h2>6. Intellectual Property</h2>
        <p>
          The TKA Scribe application, including its design, features, and
          underlying technology, is owned by TKA Scribe and protected by
          intellectual property laws. The Kinetic Alphabet system and
          methodology remain the intellectual property of their respective
          creators.
        </p>
      </section>

      <section>
        <h2>7. Disclaimers</h2>
        <p>
          TKA Scribe is provided "as is" without warranties of any kind. We do
          not guarantee that the service will be uninterrupted, secure, or
          error-free.
        </p>
      </section>

      <section>
        <h2>8. Limitation of Liability</h2>
        <p>
          TKA shall not be liable for any indirect, incidental, special, or
          consequential damages arising from your use of the service.
        </p>
      </section>

      <section>
        <h2>9. Changes to Terms</h2>
        <p>
          We reserve the right to modify these terms at any time. Continued use
          of the service after changes constitutes acceptance of the modified
          terms.
        </p>
      </section>

      <section>
        <h2>10. Contact</h2>
        <p>
          If you have questions about these Terms of Service, please contact us
          through the application's support channels.
        </p>
      </section>
    </div>
  </div>
</div>

<style>
  .terms-page {
    min-height: 100vh;
    background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
    color: #ffffff;
    padding: 2rem 1rem;
  }

  .terms-container {
    max-width: 800px;
    margin: 0 auto;
  }

  .terms-header {
    margin-bottom: 2rem;
  }

  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: rgba(255, 255, 255, 0.7);
    text-decoration: none;
    font-size: 0.875rem;
    margin-bottom: 1.5rem;
    transition: color var(--duration-normal) ease;
  }

  .back-link:hover {
    color: #ffffff;
  }

  h1 {
    font-size: clamp(2rem, 5vw, 2.5rem);
    font-weight: 700;
    margin: 0 0 0.5rem 0;
  }

  .last-updated {
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.875rem;
    margin: 0;
  }

  .terms-content {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 2rem;
  }

  section {
    margin-bottom: 2rem;
  }

  section:last-child {
    margin-bottom: 0;
  }

  h2 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0 0 0.75rem 0;
    color: #ffffff;
  }

  p {
    color: rgba(255, 255, 255, 0.8);
    line-height: 1.7;
    margin: 0 0 0.75rem 0;
  }

  ul {
    color: rgba(255, 255, 255, 0.8);
    line-height: 1.7;
    margin: 0;
    padding-left: 1.5rem;
  }

  li {
    margin-bottom: 0.5rem;
  }

  @media (max-width: 640px) {
    .terms-content {
      padding: 1.5rem;
    }

    h2 {
      font-size: 1.125rem;
    }
  }
</style>
