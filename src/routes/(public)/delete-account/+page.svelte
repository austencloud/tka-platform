<script lang="ts">
  const steps = [
    "Sign in to TKA Composer",
    "Tap profile icon → Settings",
    "Account → Delete Account",
    "Confirm deletion",
  ];

  const deletedData = [
    "Profile & account info",
    "Library & collections",
    "Settings & preferences",
    "Achievements & XP",
  ];

  const sequenceInfo = [
    "Sequences stay in the gallery",
    "Choose: Anonymize or keep your name",
    "Protects community references",
  ];

  const backHref = "/";
</script>

<svelte:head>
  <title>Delete Account - TKA Composer</title>
  <meta
    name="description"
    content="How to delete your TKA Composer account and data"
  />
</svelte:head>

<div class="page">
  <div class="container">
    <header>
      <a href={backHref} class="back-link">
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
        <span>Back</span>
      </a>

      <div class="header-content">
        <div class="logo">TKA</div>
        <h1>Delete Your Account</h1>
        <p class="subtitle">Account deletion for TKA Composer</p>
      </div>
    </header>

    <div class="cards">
      <section class="card steps">
        <div class="card-icon">
          <i class="fas fa-list-check" aria-hidden="true"></i>
        </div>
        <h2>How to Delete</h2>
        <ol>
          {#each steps as step}
            <li>{step}</li>
          {/each}
        </ol>
      </section>

      <section class="card deleted">
        <div class="card-icon">
          <i class="fas fa-trash-can" aria-hidden="true"></i>
        </div>
        <h2>What's Deleted</h2>
        <ul>
          {#each deletedData as item}
            <li>{item}</li>
          {/each}
        </ul>
      </section>

      <section class="card sequences">
        <div class="card-icon">
          <i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i>
        </div>
        <h2>Your Sequences</h2>
        <ul>
          {#each sequenceInfo as item}
            <li>{item}</li>
          {/each}
        </ul>
      </section>
    </div>

    <div class="warning-banner">
      <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
      <span>
        <strong>This action is permanent</strong> and cannot be undone. You'll be
        signed out immediately.
      </span>
    </div>

    <footer>
      <a href="/" class="cta-button">
        <span>Open TKA Composer</span>
        <i class="fas fa-arrow-right" aria-hidden="true"></i>
      </a>
      <p class="help">
        Need help? <a href="mailto:tkaflowarts@gmail.com">tkaflowarts@gmail.com</a>
      </p>
    </footer>
  </div>

</div>

<style>
  .page {
    position: relative;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    font-family: system-ui, -apple-system, sans-serif;
    color: rgba(255, 255, 255, 0.6);
    overflow-x: hidden;
    background: linear-gradient(145deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%);
  }

  .container {
    position: relative;
    z-index: 1;
    max-width: 1000px;
    width: 100%;
  }

  header {
    margin-bottom: 2.5rem;
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

  .logo {
    display: inline-block;
    font-size: 1rem;
    font-weight: 700;
    color: #6366f1;
    background: color-mix(in srgb, #6366f1 15%, transparent);
    padding: 0.5rem 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
    letter-spacing: 0.1em;
  }

  h1 {
    font-size: 2.5rem;
    margin: 0 0 0.5rem;
    color: #ffffff;
    font-weight: 600;
    background: linear-gradient(135deg, #fff 0%, rgba(255, 255, 255, 0.7) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .subtitle {
    color: rgba(255, 255, 255, 0.6);
    margin: 0;
    font-size: 1rem;
  }

  .cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.25rem;
    margin-bottom: 1.5rem;
  }

  .card {
    padding: 1.5rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    transition: all 0.25s ease;
  }

  .card:hover {
    transform: translateY(-2px);
    border-color: rgba(255, 255, 255, 0.2);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  }

  .card-icon {
    font-size: 1.5rem;
    margin-bottom: 0.75rem;
    color: #818cf8;
  }

  h2 {
    font-size: 1rem;
    margin: 0 0 1rem;
    color: #ffffff;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  ol,
  ul {
    padding-left: 1.25rem;
    margin: 0;
  }

  li {
    margin-bottom: 0.5rem;
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.9rem;
    line-height: 1.7;
  }

  li:last-child {
    margin-bottom: 0;
  }

  .steps li::marker {
    color: #6366f1;
    font-weight: 600;
  }

  .deleted {
    background: linear-gradient(
      135deg,
      rgba(239, 68, 68, 0.08) 0%,
      rgba(239, 68, 68, 0.03) 100%
    );
    border-color: rgba(239, 68, 68, 0.15);
  }

  .deleted:hover {
    border-color: rgba(239, 68, 68, 0.3);
  }

  .deleted h2 {
    color: #f87171;
  }

  .deleted .card-icon {
    color: #f87171;
  }

  .deleted li::marker {
    color: #ef4444;
  }

  .sequences {
    background: color-mix(in srgb, #6366f1 8%, transparent);
    border-color: color-mix(in srgb, #6366f1 15%, transparent);
  }

  .sequences:hover {
    border-color: color-mix(in srgb, #6366f1 30%, transparent);
  }

  .sequences h2 {
    color: #a5b4fc;
  }

  .sequences .card-icon {
    color: #a5b4fc;
  }

  .sequences li::marker {
    color: #6366f1;
  }

  .warning-banner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    background: rgba(251, 191, 36, 0.1);
    border: 1px solid rgba(251, 191, 36, 0.2);
    border-radius: 12px;
    margin-bottom: 2rem;
    font-size: 0.9rem;
    color: #fcd34d;
  }

  .warning-banner i {
    font-size: 1.25rem;
  }

  .warning-banner strong {
    color: #fbbf24;
  }

  footer {
    text-align: center;
  }

  .cta-button {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
    background: #6366f1;
    color: #ffffff;
    text-decoration: none;
    padding: 1rem 2rem;
    border-radius: 12px;
    font-weight: 600;
    font-size: 1.125rem;
    transition: all 0.2s ease;
  }

  .cta-button:hover {
    background: #818cf8;
    transform: translateY(-2px);
    box-shadow: 0 12px 32px color-mix(in srgb, #6366f1 40%, transparent);
    color: white;
  }

  .cta-button i {
    transition: transform 0.2s ease;
  }

  .cta-button:hover i {
    transform: translateX(4px);
  }

  .help {
    margin-top: 1rem;
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.6);
  }

  .help a {
    color: #818cf8;
    text-decoration: none;
    border-bottom: 1px solid transparent;
    transition: border-color 0.2s ease;
  }

  .help a:hover {
    border-bottom-color: #818cf8;
  }

  @media (max-width: 768px) {
    .cards {
      grid-template-columns: 1fr;
    }

    h1 {
      font-size: 1.75rem;
    }

    .page {
      padding: 1.5rem 1rem;
      align-items: flex-start;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .back-link,
    .card,
    .cta-button,
    .help a {
      transition: none;
    }

    .card:hover,
    .cta-button:hover {
      transform: none;
    }

    .cta-button:hover i {
      transform: none;
    }
  }
</style>
