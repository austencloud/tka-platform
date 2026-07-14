<script lang="ts">
  const backHref = "/";
</script>

<svelte:head>
  <title>Privacy Policy | Flow Arts Composer</title>
  <meta
    name="description"
    content="Privacy Policy for The Kinetic Alphabet (TKA) application."
  />
  <link rel="canonical" href="https://tkaflowarts.com/privacy" />
</svelte:head>

<div class="privacy-page">
  <div class="privacy-container">
    <header class="privacy-header">
      <a href={backHref} class="back-link">
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
        <span>Back</span>
      </a>

      <div class="header-content">
        <h1>Privacy Policy</h1>
        <p class="last-updated">
          Last Updated: January 16, 2026
        </p>
      </div>
    </header>

    <div class="privacy-content">
      <!-- Summary Box -->
      <div class="summary-box">
        <h2>Quick Summary</h2>
        <ul>
          <li>Flow Arts Composer collects only what's needed to provide the service</li>
          <li>Your data is stored on Firebase servers (US and other regions)</li>
          <li>Your data is never sold or used for ML training</li>
          <li>You can export or delete your data anytime</li>
          <li>Questions? Email <a href="mailto:tkaflowarts@gmail.com">tkaflowarts@gmail.com</a></li>
        </ul>
      </div>

      <section id="information-collected">
        <h2>1. Information Collected</h2>
        <p>
          When you use Flow Arts Composer, the following types of information are collected:
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
            through the in-app messaging feature
          </li>
        </ul>
      </section>

      <section id="information-use">
        <h2>2. How Your Information Is Used</h2>
        <p>The information collected is used to:</p>
        <ul>
          <li>Provide and maintain the Flow Arts Composer service</li>
          <li>Personalize your experience and save your preferences</li>
          <li>Enable community features like sharing sequences</li>
          <li>Improve and optimize the application</li>
          <li>Communicate important updates about the service</li>
        </ul>
      </section>

      <section id="data-storage">
        <h2>3. Data Storage and Security</h2>
        <p>
          Your data is stored securely using <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener noreferrer">Firebase</a> services, including:
        </p>
        <ul>
          <li><strong>Firebase Authentication:</strong> Handles sign-in and account security</li>
          <li><strong>Cloud Firestore:</strong> Stores your sequences, settings, and profile</li>
          <li><strong>Firebase Storage:</strong> Stores any uploaded images or media</li>
        </ul>
        <p>
          Your data may be stored on servers in the United States and other countries where Google operates data centers. Appropriate technical and organizational measures are in place to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
        </p>
      </section>

      <section id="messages">
        <h2>4. Messages and Communications</h2>
        <p>
          When you use the messaging feature to communicate with other users,
          your messages are stored to deliver them and maintain your conversation
          history.
        </p>
        <p>
          <strong>When messages may be reviewed:</strong> Messages may be reviewed by the developer only to respond to abuse reports or to provide support when you contact Flow Arts Composer about a conversation issue.
        </p>
        <p>
          <strong>Your messages are not:</strong> Sold, shared with third parties, or used for machine learning training. Your conversations are not used to train AI models.
        </p>
      </section>

      <section id="data-sharing">
        <h2>5. Data Sharing</h2>
        <p>
          Your personal information is never sold. Data may be shared only in
          the following circumstances:
        </p>
        <ul>
          <li>With your consent when you choose to share sequences publicly</li>
          <li>
            With Firebase/Google as the infrastructure provider (see their <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener noreferrer">privacy policy</a>)
          </li>
          <li>When required by law or to protect legal rights</li>
        </ul>
      </section>

      <section id="your-rights">
        <h2>6. Your Rights</h2>

        <h3>All Users</h3>
        <p>You have the right to:</p>
        <ul>
          <li>Access the personal information held about you</li>
          <li>Request correction of inaccurate information</li>
          <li>Request deletion of your account and associated data</li>
          <li>Export your sequences and content</li>
        </ul>
        <p>
          To delete your account, visit the <a href="/delete-account">account deletion page</a>.
        </p>

        <h3>EU Users (GDPR)</h3>
        <p>If you're in the European Union, you additionally have the right to:</p>
        <ul>
          <li>Object to processing of your personal data</li>
          <li>Request data portability (receive your data in a structured format)</li>
          <li>Lodge a complaint with your local data protection authority</li>
        </ul>

        <h3>California Users (CCPA)</h3>
        <p>
          Flow Arts Composer is a small independent project that falls below CCPA revenue thresholds. However, California users are afforded the same rights: you can request to know what data is held, request deletion, and will not face discrimination for exercising these rights.
        </p>
      </section>

      <section id="data-retention">
        <h2>7. Data Retention</h2>
        <p>
          Your data is retained for as long as your account is active. When you delete your account:
        </p>
        <ul>
          <li>Your profile, sequences, and settings are deleted immediately</li>
          <li>Backup data may persist for up to 30 days before being permanently removed</li>
          <li>Anonymized usage statistics may be retained indefinitely</li>
        </ul>
        <p>
          To delete your account and all associated data, visit the <a href="/delete-account">account deletion page</a>.
        </p>
        <p>
          When you delete your account, a minimal record is kept for 12 months: your name, email, the deletion date, and any reason you choose to provide. This record exists solely to document and audit the deletion itself, as required under data protection law. After 12 months it is permanently removed.
        </p>
      </section>

      <section id="cookies">
        <h2>8. Cookies and Local Storage</h2>
        <p>
          Flow Arts Composer uses local storage and cookies to maintain your session
          and remember your preferences. These are essential for the application
          to function properly. Cookies are not used for advertising or cross-site
          tracking.
        </p>
      </section>

      <section id="third-party">
        <h2>9. Third-Party Services</h2>
        <p>Flow Arts Composer uses the following third-party services:</p>
        <ul>
          <li>
            <strong>Firebase:</strong> Authentication, database, and storage (<a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener noreferrer">privacy policy</a>)
          </li>
          <li>
            <strong>PostHog:</strong> Anonymous usage statistics to understand how people use TKA. This includes page views, approximate location, device type, and session recordings. You can disable this in your browser settings or by using an ad blocker.
          </li>
        </ul>
      </section>

      <section id="childrens-privacy">
        <h2>10. Children's Privacy</h2>
        <p>
          Flow Arts Composer is not intended for children under 13 years of age. Personal
          information is not knowingly collected from children under 13. If
          you believe a child has provided personal information, please
          get in touch so it can be deleted.
        </p>
      </section>

      <section id="changes">
        <h2>11. Changes to This Policy</h2>
        <p>
          This Privacy Policy may be updated from time to time. Changes will be
          posted on this page with an updated "Last Updated" date.
        </p>
      </section>

      <section id="contact">
        <h2>12. Contact</h2>
        <p>
          For questions about this Privacy Policy or your data, email
          <a href="mailto:tkaflowarts@gmail.com">tkaflowarts@gmail.com</a>.
        </p>
      </section>
    </div>
  </div>

</div>

<style>
  .privacy-page {
    position: relative;
    min-height: 100vh;
    color: #ffffff;
    background: linear-gradient(145deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%);
    overflow-x: hidden;
  }

  /* Container */
  .privacy-container {
    position: relative;
    z-index: 1;
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem 1.5rem 4rem;
  }

  /* Header */
  .privacy-header {
    margin-bottom: 2rem;
  }

  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: rgba(255, 255, 255, 0.6);
    text-decoration: none;
    font-size: 0.875rem;
    padding: 0.5rem 1rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 100px;
    margin-bottom: 2rem;
    transition: all 0.2s ease;
  }

  .back-link:hover {
    color: #ffffff;
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.05);
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
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.875rem;
    margin: 0;
  }

  /* Content card */
  .privacy-content {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    padding: 2rem;
    transition: all 0.25s ease;
  }

  .privacy-content:hover {
    border-color: rgba(255, 255, 255, 0.15);
    transform: translateY(-2px);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  }

  /* Summary box */
  .summary-box {
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(129, 140, 248, 0.3);
    border-radius: 12px;
    padding: 1.25rem;
    margin-bottom: 2rem;
  }

  .summary-box h2 {
    font-size: 1rem;
    margin: 0 0 0.75rem 0;
    color: #818cf8;
  }

  .summary-box ul {
    margin: 0;
    padding-left: 1.25rem;
    font-size: 0.9rem;
  }

  .summary-box li {
    margin-bottom: 0.375rem;
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
    color: #ffffff;
  }

  h3 {
    font-size: 1.1rem;
    font-weight: 600;
    margin: 1.25rem 0 0.5rem 0;
    color: #ffffff;
  }

  p {
    color: rgba(255, 255, 255, 0.6);
    line-height: 1.7;
    margin: 0 0 0.75rem 0;
  }

  a {
    color: #818cf8;
    text-decoration: none;
    border-bottom: 1px solid transparent;
    transition: border-color 0.2s ease;
  }

  a:hover {
    border-bottom-color: #818cf8;
  }

  ul {
    color: rgba(255, 255, 255, 0.6);
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

  /* Responsive */
  @media (max-width: 768px) {
    .privacy-container {
      padding: 1.5rem 1rem 3rem;
    }

    .privacy-content {
      padding: 1.5rem;
    }

    h2 {
      font-size: 1.25rem;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .back-link,
    .privacy-content,
    a {
      transition: none;
    }

    .privacy-content:hover {
      transform: none;
    }
  }
</style>
