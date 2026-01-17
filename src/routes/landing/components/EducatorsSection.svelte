<script lang="ts">
  import { EDUCATOR_CARDS } from "../landing-content";
</script>

<section class="educators" id="educators">
  <div class="container">
    <h2>For Educators</h2>
    <p class="section-intro">TKA changes how you teach.</p>

    <div class="educator-grid">
      {#each EDUCATOR_CARDS as card}
        <div class="educator-card">
          <div class="edu-icon">{card.icon}</div>
          <h3>{card.title}</h3>
          <p>{card.description}</p>
        </div>
      {/each}
    </div>

    <blockquote class="educator-quote">
      Stop demonstrating the same move 50 times. Show them the pictograph.
    </blockquote>
  </div>
</section>

<style>
  .educators {
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

  .educator-card {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 16px;
    padding: 28px;
    text-align: center;
  }

  .educator-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 24px;
    margin-bottom: 48px;
  }

  .edu-icon {
    font-size: 2rem;
    margin-bottom: 12px;
  }

  .educator-card h3 {
    font-size: 1rem;
    margin-bottom: 8px;
  }

  .educator-card p {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 0.875rem;
  }

  .educator-quote {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border-left: 4px solid var(--theme-accent, #6366f1);
    padding: 24px 32px;
    border-radius: 0 12px 12px 0;
    font-style: italic;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    max-width: 700px;
    margin: 0 auto;
    text-align: center;
    font-size: 1.25rem;
  }
</style>
