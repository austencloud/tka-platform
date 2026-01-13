<script lang="ts">
  // Sample letters to display as pictograph-style examples
  const sampleLetters = ["A", "B", "C"];
</script>

<section class="what-is" id="what">
  <div class="container">
    <h2>What is TKA?</h2>
    <p class="lead">
      <strong>The Kinetic Alphabet is to flow arts what musical notation is to music.</strong>
    </p>

    <div class="comparison-grid">
      <div class="comparison-card">
        <div class="icon">
          <i class="fas fa-music" aria-hidden="true"></i>
        </div>
        <h3>Music Has Sheet Music</h3>
        <p>
          Musicians read, write, and share compositions through standard
          notation.
        </p>
      </div>
      <div class="comparison-card">
        <div class="icon pictograph-icon">
          {#each sampleLetters as letter}
            <span class="letter-sample">{letter}</span>
          {/each}
        </div>
        <h3>Flow Arts Has TKA</h3>
        <p>
          Flow artists document, share, and learn choreography through
          pictographs.
        </p>
      </div>
    </div>

    <div class="capabilities">
      <p>
        Document sequences precisely. Share choreography by link or paper.
        Learn from a global community. Animate to see movements in motion.
      </p>
    </div>

    <blockquote>
      Instead of relying on video or verbal descriptions, TKA lets you hand someone
      a page or send them a link. Every movement has a name, a symbol, and a visual.
    </blockquote>
  </div>
</section>

<style>
  .what-is {
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

  .lead {
    font-size: 1.5rem;
    text-align: center;
    max-width: 900px;
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
    color: var(--theme-accent, #6366f1);
  }

  .comparison-card .icon.pictograph-icon {
    display: flex;
    justify-content: center;
    gap: 8px;
    font-size: 1rem;
  }

  .letter-sample {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    border: 2px solid var(--theme-accent, #6366f1);
    border-radius: 8px;
    font-family: Georgia, serif;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .comparison-card h3 {
    font-size: 1.25rem;
    margin-bottom: 8px;
  }

  .comparison-card p {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .capabilities {
    text-align: center;
    margin-bottom: 48px;
  }

  .capabilities p {
    font-size: 1.125rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    max-width: 800px;
    margin: 0 auto;
    line-height: 1.7;
  }

  blockquote {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border-left: 4px solid var(--theme-accent, #6366f1);
    padding: 24px 32px;
    border-radius: 0 12px 12px 0;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    max-width: 800px;
    margin: 0 auto;
    line-height: 1.6;
  }
</style>
