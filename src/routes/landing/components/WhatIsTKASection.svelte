<script lang="ts">
  const benefits = [
    "Document complex sequences precisely",
    "Share choreography with anyone, anywhere",
    "Learn from the global flow community",
    "Animate sequences to see them in motion",
    "Train with real-time scoring and feedback",
  ];
</script>

<section class="what-is" id="what">
  <div class="container">
    <h2>What is TKA?</h2>
    <p class="lead">
      <strong
        >The Kinetic Alphabet is to flow arts what musical notation is to music.</strong
      >
    </p>

    <div class="comparison-grid">
      <div class="comparison-card">
        <div class="icon">🎵</div>
        <h3>Music Has Sheet Music</h3>
        <p>
          Musicians read, write, and share compositions through standard
          notation.
        </p>
      </div>
      <div class="comparison-card">
        <div class="icon">🌀</div>
        <h3>Flow Arts Has TKA</h3>
        <p>
          Flow artists document, share, and learn choreography through
          pictographs.
        </p>
      </div>
    </div>

    <div class="benefits">
      {#each benefits as benefit}
        <div class="benefit">
          <span class="check">✓</span>
          <span>{benefit}</span>
        </div>
      {/each}
    </div>

    <blockquote>
      No more trying to describe "that spinny thing where your hands cross and
      then... you know, the thing."
      <br />
      <strong
        >With TKA, every movement has a name, a symbol, and a visual
        representation.</strong
      >
    </blockquote>
  </div>
</section>

<style>
  .what-is {
    padding: 120px 24px;
    background: linear-gradient(
      180deg,
      transparent 0%,
      rgba(99, 102, 241, 0.05) 100%
    );
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

  .lead {
    font-size: 1.5rem;
    text-align: center;
    max-width: 700px;
    margin: 0 auto 48px;
  }

  .comparison-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 24px;
    margin-bottom: 48px;
  }

  .comparison-card {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 16px;
    padding: 32px;
    text-align: center;
  }

  .comparison-card .icon {
    font-size: 3rem;
    margin-bottom: 16px;
  }

  .comparison-card h3 {
    font-size: 1.25rem;
    margin-bottom: 8px;
  }

  .comparison-card p {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .benefits {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 16px 32px;
    margin-bottom: 48px;
  }

  .benefit {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .check {
    color: var(--semantic-success, #22c55e);
    font-weight: bold;
  }

  blockquote {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border-left: 4px solid var(--theme-accent, #6366f1);
    padding: 24px 32px;
    border-radius: 0 12px 12px 0;
    font-style: italic;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    max-width: 700px;
    margin: 0 auto;
  }

  blockquote strong {
    color: var(--theme-text, #ffffff);
    font-style: normal;
  }
</style>
