<script lang="ts">
  import { FEATURES } from "../landing-content";
</script>

<section class="features" id="features">
  <div class="container">
    <h2>Meet Flow Arts Composer</h2>
    <p class="section-intro">
      The free web app for The Kinetic Alphabet.
    </p>

    <div class="features-grid">
      {#each FEATURES as feature}
        <div class="feature-card" style="--accent: {feature.color}">
          <div class="feature-icon">{feature.icon}</div>
          <h3>{feature.title}</h3>
          <p>{feature.description}</p>
        </div>
      {/each}
    </div>
  </div>
</section>

<style>
  .features {
    padding: 120px 24px;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
  }

  h2 {
    font-size: clamp(2rem, 5vw, 3rem);
    margin-bottom: 1rem;
    text-align: center;
    font-weight: 600;
    line-height: 1.2;
  }

  .section-intro {
    text-align: center;
    font-size: 1.125rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    max-width: 700px;
    margin: 0 auto 3rem;
  }

  .features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 24px;
  }

  .feature-card {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 16px;
    padding: 32px;
    transition: all var(--duration-emphasis) ease;
  }

  .feature-card:hover {
    border-color: var(--accent);
    transform: translateY(-4px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
  }

  .feature-icon {
    font-size: 2.5rem;
    margin-bottom: 16px;
  }

  .feature-card h3 {
    font-size: 1.25rem;
    margin-bottom: 8px;
    color: var(--accent);
  }

  .feature-card p {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-sm, 0.875rem);
  }

  @media (prefers-reduced-motion: reduce) {
    .feature-card {
      transition: none;
    }
  }
</style>
