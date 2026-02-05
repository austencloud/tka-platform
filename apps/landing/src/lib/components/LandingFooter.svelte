<!--
  LandingFooter.svelte (Landing - standalone)

  Footer with educator quote, credibility line, CTA, and legal links.
  Content migrated from deleted EducatorsSection and ShowcaseSection.
-->
<script lang="ts">
  const APP_DOMAIN = "https://tkascribe.com";
</script>

<footer class="footer">
  <div class="container">
    <blockquote class="quote">
      Stop demonstrating the same move 50 times. Show them the pictograph.
    </blockquote>

    <p class="credibility">
      Taught at FireDrums, FLAME, and Kinetic Fire. Supported by Fund the Flow Arts.
    </p>

    <a href={APP_DOMAIN} class="btn btn-primary">
      Open TKA Scribe
      <span class="arrow">&rarr;</span>
    </a>

    <nav class="footer-links">
      <a href={`${APP_DOMAIN}/about`}>About</a>
      <a href={`${APP_DOMAIN}/roots`}>Roots</a>
      <a href="/terms">Terms</a>
      <a href="/privacy">Privacy</a>
    </nav>
  </div>
</footer>

<style>
  .footer {
    padding: 80px 24px 64px;
    text-align: center;
  }

  .container {
    max-width: 700px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 32px;
  }

  .quote {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border-left: 4px solid var(--theme-accent, #6366f1);
    padding: 24px 32px;
    border-radius: 0 12px 12px 0;
    font-style: italic;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    font-size: 1.25rem;
    line-height: 1.6;
    margin: 0;
    max-width: 600px;
  }

  .credibility {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-size: 0.9375rem;
    margin: 0;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 16px 32px;
    border-radius: 12px;
    font-weight: 600;
    font-size: 1.125rem;
    text-decoration: none;
    transition: background 0.2s ease, transform 0.2s ease;
  }

  .btn-primary {
    background: #6366f1;
    color: white;
  }

  .btn-primary:hover {
    background: #818cf8;
    transform: translateY(-2px);
  }

  .arrow {
    transition: transform 0.2s ease;
  }

  .btn:hover .arrow {
    transform: translateX(4px);
  }

  .footer-links {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 24px;
  }

  .footer-links a {
    color: rgba(255, 255, 255, 0.6);
    text-decoration: none;
    font-size: 0.875rem;
    padding: 8px 0;
    transition: color 0.2s ease;
  }

  .footer-links a:hover {
    color: #ffffff;
  }

  @media (max-width: 480px) {
    .footer {
      padding: 60px 16px 48px;
    }

    .quote {
      padding: 20px 24px;
      font-size: 1.125rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .btn,
    .arrow,
    .footer-links a {
      transition: none;
    }

    .btn:hover {
      transform: none;
    }

    .btn:hover .arrow {
      transform: none;
    }
  }
</style>
