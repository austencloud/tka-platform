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
    <h2>Printable guides</h2>
    <p class="section-intro">
      Learn the notation at your own pace. Print these, stick them on your wall,
      bring them to jams. Start with Level 1.
    </p>

    <div class="guides-grid">
      {#each guides as guide}
        <a
          class="guide-card"
          style="--accent: {guide.accent}"
          href={guide.href}
          download
          aria-label="Download Level {guide.level} guide: {guide.title}"
        >
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
            <span class="guide-dl">⬇ Download PDF</span>
          </div>
        </a>
      {/each}
    </div>

    <p class="closing">Start with Level 1. Grab a pair of staves and follow along.</p>
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
    font-family: var(--landing-heading-font, "Instrument Serif", Georgia, serif);
    font-size: clamp(1.6rem, 4vw, 2.2rem);
    margin-bottom: 12px;
    text-align: center;
    font-weight: 400;
    line-height: 1.2;
  }

  .section-intro {
    text-align: center;
    font-size: var(--font-size-sm, 0.875rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    max-width: 480px;
    margin: 0 auto 3rem;
    line-height: 1.7;
  }

  .guides-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 24px;
  }

  .guide-card {
    background: rgba(18, 16, 14, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 10px;
    overflow: hidden;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
    display: flex;
    flex-direction: column;
    text-decoration: none;
    color: inherit;
    min-height: 44px;
  }

  .guide-card:hover {
    border-color: rgba(212, 129, 58, 0.25);
    box-shadow: 0 0 20px rgba(212, 129, 58, 0.15);
    transform: translateY(-2px);
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

  .guide-dl {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    align-self: flex-start;
    font-size: 0.82rem;
    color: #4a8f8f;
    padding: 6px 14px;
    min-height: 44px;
    border: 1px solid rgba(74, 143, 143, 0.3);
    border-radius: 6px;
    transition: background 0.2s ease, border-color 0.2s ease;
  }

  .guide-card:hover .guide-dl {
    background: rgba(74, 143, 143, 0.1);
    border-color: #4a8f8f;
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

    .guide-dl {
      transition: none;
    }
  }
</style>
