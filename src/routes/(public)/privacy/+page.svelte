<script lang="ts">
</script>

<svelte:head>
  <title>Privacy Policy | TKA Scribe</title>
  <meta
    name="description"
    content="Privacy Policy for The Kinetic Alphabet (TKA) application."
  />
</svelte:head>

<div class="privacy-page">
  <div class="privacy-container">
    <header class="privacy-header">
      <a href="/" class="back-link">
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
        Back to App
      </a>
      <h1>Privacy Policy</h1>
      <p class="last-updated">
        Last Updated: {new Date().toLocaleDateString()}
      </p>
    </header>

    <div class="privacy-content">
      <section>
        <h2>1. Information We Collect</h2>
        <p>
          When you use TKA Scribe, we may collect the following types of
          information:
        </p>
        <ul>
          <li>
            <strong>Account Information:</strong> Email address and display name when
            you create an account
          </li>
          <li>
            <strong>Usage Data:</strong> How you interact with the application, including
            sequences you create and features you use
          </li>
          <li>
            <strong>Device Information:</strong> Browser type, device type, and operating
            system for optimization purposes
          </li>
          <li>
            <strong>Messages:</strong> Content of messages you send to other users
            through our in-app messaging feature
          </li>
        </ul>
      </section>

      <section>
        <h2>2. How We Use Your Information</h2>
        <p>We use the information we collect to:</p>
        <ul>
          <li>Provide and maintain the TKA Scribe service</li>
          <li>Personalize your experience and save your preferences</li>
          <li>Enable community features like sharing sequences</li>
          <li>Improve and optimize the application</li>
          <li>Communicate important updates about the service</li>
        </ul>
      </section>

      <section>
        <h2>3. Data Storage and Security</h2>
        <p>
          Your data is stored securely using Firebase services. We implement
          appropriate technical and organizational measures to protect your
          personal information against unauthorized access, alteration,
          disclosure, or destruction.
        </p>
      </section>

      <section>
        <h2>4. Messages and Communications</h2>
        <p>
          When you use our messaging feature to communicate with other users,
          we store your messages to deliver them and maintain your conversation
          history. Messages may be reviewed by our team to provide support,
          investigate abuse reports, or improve the service. We do not sell
          or share your private messages with third parties.
        </p>
      </section>

      <section>
        <h2>5. Data Sharing</h2>
        <p>
          We do not sell your personal information. We may share data only in
          the following circumstances:
        </p>
        <ul>
          <li>With your consent when you choose to share sequences publicly</li>
          <li>
            With service providers who assist in operating the application
          </li>
          <li>When required by law or to protect our rights</li>
        </ul>
      </section>

      <section>
        <h2>6. Your Rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>Access the personal information we hold about you</li>
          <li>Request correction of inaccurate information</li>
          <li>Request deletion of your account and associated data</li>
          <li>Export your sequences and content</li>
        </ul>
      </section>

      <section>
        <h2>7. Cookies and Local Storage</h2>
        <p>
          TKA Scribe uses local storage and cookies to maintain your session,
          remember your preferences, and provide a seamless experience. These
          are essential for the application to function properly.
        </p>
      </section>

      <section>
        <h2>8. Third-Party Services</h2>
        <p>We use the following third-party services:</p>
        <ul>
          <li><strong>Firebase:</strong> Authentication and data storage</li>
          <li>
            <strong>Google Analytics:</strong> Anonymous usage statistics (optional)
          </li>
        </ul>
        <p>
          Each of these services has their own privacy policies governing the
          use of your information.
        </p>
      </section>

      <section>
        <h2>9. Children's Privacy</h2>
        <p>
          TKA Scribe is not intended for children under 13 years of age. We do
          not knowingly collect personal information from children under 13.
        </p>
      </section>

      <section>
        <h2>10. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify
          you of any changes by posting the new Privacy Policy on this page and
          updating the "Last Updated" date.
        </p>
      </section>

      <section>
        <h2>11. Contact Us</h2>
        <p>
          If you have questions about this Privacy Policy or your data, please
          contact us through the application's support channels.
        </p>
      </section>
    </div>
  </div>
</div>

<style>
  .privacy-page {
    min-height: 100vh;
    background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
    color: #ffffff;
    padding: 2rem 1rem;
  }

  .privacy-container {
    max-width: 800px;
    margin: 0 auto;
  }

  .privacy-header {
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

  .privacy-content {
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

  li strong {
    color: #ffffff;
  }

  @media (max-width: 640px) {
    .privacy-content {
      padding: 1.5rem;
    }

    h2 {
      font-size: 1.125rem;
    }
  }
</style>
