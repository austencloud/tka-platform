<script lang="ts">
  /**
   * WhatsHereSection
   *
   * An honest inventory of what exists. Doorway cards to different parts
   * of the ecosystem. Not features. Not benefits. Just places you can go.
   */

  const doorways = [
    {
      icon: "fas fa-pen-nib",
      label: "The Composer",
      description:
        "Build sequences beat by beat or generate them. Animate any sequence. Export as image, PDF, or video.",
      href: "/create",
      linkText: "Open the Composer",
    },
    {
      icon: "fas fa-book-open",
      label: "Sequence Library",
      description:
        "Browse the full collection. Filter by word, length, difficulty, or starting position.",
      href: "/create",
      linkText: "Browse sequences",
    },
    {
      icon: "fas fa-file-pdf",
      label: "Guides",
      description:
        "Printable PDF reference cards for Levels 1 through 3. Start from zero, go at your own pace.",
      href: "#guides",
      linkText: "See the guides",
    },
    {
      icon: "fas fa-seedling",
      label: "About & Roots",
      description:
        "Where TKA came from, how it works, and where it's going.",
      href: "/about",
      linkText: "Read more",
    },
  ];
</script>

<section class="whats-here">
  <div class="container">
    <h2>What's here</h2>

    <div class="doorways">
      {#each doorways as door}
        <div class="doorway-card">
          <i class={door.icon} aria-hidden="true"></i>
          <h3>{door.label}</h3>
          <p>{door.description}</p>
          <a href={door.href}>{door.linkText} →</a>
        </div>
      {/each}
    </div>
  </div>
</section>

<style>
  .whats-here {
    padding: 100px 24px;
  }

  .container {
    max-width: 960px;
    margin: 0 auto;
  }

  h2 {
    font-family: var(--landing-heading-font, "Instrument Serif", Georgia, serif);
    font-size: clamp(1.6rem, 4vw, 2.2rem);
    font-weight: 400;
    margin-bottom: 48px;
    text-align: center;
    color: var(--theme-text, #fff);
  }

  .doorways {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 20px;
  }

  .doorway-card {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    border-radius: 14px;
    padding: 28px 24px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: border-color 0.25s ease;
  }

  .doorway-card:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.18));
  }

  .doorway-card i {
    font-size: 1.25rem;
    color: var(--theme-accent, #6366f1);
    margin-bottom: 4px;
  }

  .doorway-card h3 {
    font-size: 1.05rem;
    font-weight: 600;
    margin: 0;
    color: var(--theme-text, #fff);
  }

  .doorway-card p {
    font-size: var(--font-size-sm, 0.875rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    line-height: 1.6;
    margin: 0;
    flex: 1;
  }

  .doorway-card a {
    font-size: var(--font-size-sm, 0.875rem);
    color: var(--theme-accent, #6366f1);
    text-decoration: none;
    margin-top: 4px;
    transition: color 0.2s ease;
  }

  .doorway-card a:hover {
    color: var(--theme-accent-strong, #818cf8);
  }

  @media (max-width: 600px) {
    .whats-here {
      padding: 72px 16px;
    }

    .doorways {
      grid-template-columns: 1fr;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .doorway-card {
      transition: none;
    }

    .doorway-card a {
      transition: none;
    }
  }
</style>
