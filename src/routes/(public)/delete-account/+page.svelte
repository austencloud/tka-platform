<script lang="ts">
  const steps = [
    "Sign in to TKA Scribe",
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
</script>

<svelte:head>
  <title>Delete Account - TKA Scribe</title>
  <meta
    name="description"
    content="How to delete your TKA Scribe account and data"
  />
</svelte:head>

<div class="page">
  <div class="container">
    <header>
      <div class="logo">TKA</div>
      <h1>Delete Your Account</h1>
      <p class="subtitle">Account deletion for TKA Scribe</p>
    </header>

    <div class="cards">
      <section class="card steps">
        <div class="card-icon">📋</div>
        <h2>How to Delete</h2>
        <ol>
          {#each steps as step}
            <li>{step}</li>
          {/each}
        </ol>
      </section>

      <section class="card deleted">
        <div class="card-icon">🗑️</div>
        <h2>What's Deleted</h2>
        <ul>
          {#each deletedData as item}
            <li>{item}</li>
          {/each}
        </ul>
      </section>

      <section class="card sequences">
        <div class="card-icon">✨</div>
        <h2>Your Sequences</h2>
        <ul>
          {#each sequenceInfo as item}
            <li>{item}</li>
          {/each}
        </ul>
      </section>
    </div>

    <div class="warning-banner">
      <span class="warning-icon">⚠️</span>
      <span
        ><strong>This action is permanent</strong> and cannot be undone. You'll be
        signed out immediately.</span
      >
    </div>

    <footer>
      <a href="/" class="button">Open TKA Scribe</a>
      <p class="help">
        Need help? <a href="mailto:tkaflowarts@gmail.com"
          >tkaflowarts@gmail.com</a
        >
      </p>
    </footer>
  </div>
</div>

<style>
  .page {
    min-height: 100vh;
    background: linear-gradient(135deg, #0a0a0f 0%, #12121f 50%, #0a0a0f 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    font-family:
      system-ui,
      -apple-system,
      sans-serif;
    color: #e5e5e5;
  }

  .container {
    max-width: 1000px;
    width: 100%;
  }

  header {
    text-align: center;
    margin-bottom: 2.5rem;
  }

  .logo {
    display: inline-block;
    font-size: 1rem;
    font-weight: 700;
    color: #6366f1;
    background: rgba(99, 102, 241, 0.15);
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
  }

  .subtitle {
    color: #666;
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
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    transition:
      transform 0.2s,
      border-color 0.2s;
  }

  .card:hover {
    transform: translateY(-2px);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .card-icon {
    font-size: 1.5rem;
    margin-bottom: 0.75rem;
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
    color: #a0a0a0;
    font-size: 0.9rem;
    line-height: 1.5;
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

  .deleted h2 {
    color: #f87171;
  }

  .deleted li::marker {
    color: #ef4444;
  }

  .sequences {
    background: linear-gradient(
      135deg,
      rgba(99, 102, 241, 0.08) 0%,
      rgba(99, 102, 241, 0.03) 100%
    );
    border-color: rgba(99, 102, 241, 0.15);
  }

  .sequences h2 {
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

  .warning-icon {
    font-size: 1.25rem;
  }

  .warning-banner strong {
    color: #fbbf24;
  }

  footer {
    text-align: center;
  }

  .button {
    display: inline-block;
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
    color: white;
    padding: 0.875rem 2.5rem;
    border-radius: 10px;
    text-decoration: none;
    font-weight: 500;
    font-size: 1rem;
    transition:
      transform 0.2s,
      box-shadow 0.2s;
    box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
  }

  .button:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
    color: white;
  }

  .help {
    margin-top: 1rem;
    font-size: 0.85rem;
    color: #666;
  }

  .help a {
    color: #818cf8;
    text-decoration: none;
  }

  .help a:hover {
    text-decoration: underline;
  }

  @media (max-width: 800px) {
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
</style>
