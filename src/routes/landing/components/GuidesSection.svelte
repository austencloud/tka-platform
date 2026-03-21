<script lang="ts">
  const guides = [
    {
      level: 1,
      title: "Base Motions",
      description:
        "The grid, all 6 letter types, basic words. No turns.",
      image: "/images/level_images/level_1.png",
      href: "/guides/level-1.pdf",
      accent: "#4CAF50",
    },
    {
      level: 2,
      title: "Whole Turns",
      description:
        "Whole turns. Shifts get rotation, combos get harder.",
      image: "/images/level_images/level_2.png",
      href: "/guides/level-2.pdf",
      accent: "#2196F3",
    },
    {
      level: 3,
      title: "Half Turns, Floats",
      description:
        "Half turns, floats. The full vocabulary.",
      image: "/images/level_images/level_3.png",
      href: "/guides/level-3.pdf",
      accent: "#9C27B0",
    },
  ];
</script>

<section class="guides" id="guides">
  <div class="container">
    <h2>Learn TKA</h2>

    <div class="guides-grid">
      {#each guides as guide}
        <div class="guide-card" style="--accent: {guide.accent}">
          <div class="guide-image">
            <img
              src={guide.image}
              alt="Level {guide.level} pictograph examples"
              loading="lazy"
            />
          </div>
          <div class="guide-body">
            <span class="guide-level">Level {guide.level}</span>
            <h3>{guide.title}</h3>
            <p>{guide.description}</p>
            <a href={guide.href} download class="download-btn">
              <i class="fas fa-download" aria-hidden="true"></i>
              Download PDF
            </a>
          </div>
        </div>
      {/each}
    </div>

    <p class="closing">Grab a pair of staves and follow along.</p>
  </div>
</section>

<style>
  .guides {
    padding: 120px 24px;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
  }

  h2 {
    font-size: clamp(2rem, 5vw, 3rem);
    margin-bottom: 3rem;
    text-align: center;
    font-weight: 600;
    line-height: 1.2;
  }

  .guides-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 24px;
  }

  .guide-card {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 16px;
    overflow: hidden;
    transition: all var(--duration-emphasis, 0.3s) ease;
    display: flex;
    flex-direction: column;
  }

  .guide-card:hover {
    border-color: var(--accent);
    transform: translateY(-4px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
  }

  .guide-image {
    aspect-ratio: 1;
    background: rgba(255, 255, 255, 0.95);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  .guide-image img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .guide-body {
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
  }

  .guide-level {
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--accent);
  }

  .guide-body h3 {
    font-size: 1.25rem;
    margin: 0;
  }

  .guide-body p {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-sm, 0.875rem);
    margin: 0;
    flex: 1;
  }

  .download-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
    padding: 10px 20px;
    background: var(--accent);
    color: #fff;
    border-radius: 8px;
    text-decoration: none;
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 600;
    transition: opacity var(--duration-normal, 0.2s) ease;
    align-self: flex-start;
  }

  .download-btn:hover {
    opacity: 0.85;
  }

  .closing {
    text-align: center;
    font-size: 1.125rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    margin-top: 3rem;
  }

  @media (prefers-reduced-motion: reduce) {
    .guide-card {
      transition: none;
    }

    .download-btn {
      transition: none;
    }
  }
</style>
