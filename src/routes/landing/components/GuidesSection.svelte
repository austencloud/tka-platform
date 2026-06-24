<script lang="ts">
  import { LEVEL_METADATA, type LevelNumber } from "$lib/shared/domain/curriculum/level-metadata";

  // showHeading lets a host page (e.g. /guide) supply its own section heading
  // and hide this component's, so the two don't stack into a double title.
  let { showHeading = true }: { showHeading?: boolean } = $props();

  // Level 3 is intentionally omitted — its guide was never finished, so we don't
  // offer it. Only the completed Level 1 + Level 2 guides ship.
  const levels: LevelNumber[] = [1, 2];

  const guides = levels.map((level) => ({
    level,
    title: LEVEL_METADATA[level].name,
    description: LEVEL_METADATA[level].blurb,
    image: LEVEL_METADATA[level].image,
    href: `/guides/level-${level}.pdf`,
    accent: LEVEL_METADATA[level].accent,
  }));
</script>

<section class="guides" id="guides">
  <div class="container">
    {#if showHeading}
      <h2>Guides</h2>
      <p class="section-intro">
        Learn the notation at your own pace. Download any level to read on your
        phone, tablet, or screen. Start with Level 1.
      </p>
    {/if}

    <ul class="guide-list">
      {#each guides as guide}
        <li>
          <a
            class="guide-card"
            style="--accent: {guide.accent}"
            href={guide.href}
            download
            aria-label="Download the Level {guide.level} guide: {guide.title} (PDF)"
          >
            <span class="cover">
              <img src={guide.image} alt="" loading="lazy" />
            </span>
            <span class="body">
              <span class="level">Level {guide.level}</span>
              <span class="title">{guide.title}</span>
              <span class="desc">{guide.description}</span>
            </span>
            <span class="action">
              <i class="fas fa-arrow-down" aria-hidden="true"></i>
              <span class="action-label">PDF</span>
            </span>
          </a>
        </li>
      {/each}
    </ul>

    <p class="closing">Start with Level 1. Grab a pair of staves and follow along.</p>
  </div>
</section>

<style>
  .guides {
    padding: 96px 24px;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
  }

  h2 {
    font-family: var(--landing-heading-font, "Playfair Display", Georgia, serif);
    font-size: clamp(1.6rem, 4vw, 2.2rem);
    margin-bottom: 12px;
    text-align: center;
    font-weight: 500;
    line-height: 1.2;
  }

  .section-intro {
    text-align: center;
    font-size: var(--font-size-sm, 0.875rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    max-width: 480px;
    margin: 0 auto 3rem;
    line-height: 1.7;
    text-wrap: pretty;
  }

  /* A short, scannable list of guide entries — reads like a chapter list, not a
     wall of giant pictographs. */
  .guide-list {
    list-style: none;
    margin: 0 auto;
    padding: 0;
    max-width: 620px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .guide-list li {
    margin: 0;
  }

  .guide-card {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 16px 20px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    -webkit-backdrop-filter: blur(10px);
    backdrop-filter: blur(10px);
    text-decoration: none;
    color: inherit;
    transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease,
      box-shadow 0.2s ease;
  }
  .guide-card:hover,
  .guide-card:focus-visible {
    outline: none;
    transform: translateY(-2px);
    background: rgba(255, 255, 255, 0.06);
    border-color: color-mix(in srgb, var(--accent) 55%, transparent);
    box-shadow: 0 14px 34px -16px color-mix(in srgb, var(--accent) 60%, transparent);
  }

  /* Small "cover" tile — the pictograph as a supporting emblem, not the whole card. */
  .cover {
    flex: 0 0 auto;
    width: 76px;
    height: 76px;
    border-radius: 12px;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    box-shadow: 0 4px 14px -6px rgba(0, 0, 0, 0.6);
  }
  .cover img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .level {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--accent);
  }
  .title {
    font-family: var(--landing-heading-font, "Playfair Display", Georgia, serif);
    font-size: 1.32rem;
    font-weight: 500;
    line-height: 1.2;
    color: #fff;
  }
  .desc {
    font-size: 0.9rem;
    line-height: 1.5;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.58));
  }

  /* Download affordance — fills with the level accent on hover so the card reads
     as something you open. */
  .action {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    align-self: stretch;
    padding: 0 16px;
    margin: -16px -20px -16px 0;
    border-left: 1px solid rgba(255, 255, 255, 0.08);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.55));
    font-size: 0.82rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    transition: color 0.2s ease, background 0.2s ease;
  }
  .guide-card:hover .action,
  .guide-card:focus-visible .action {
    color: var(--accent);
  }
  .action i {
    transition: transform 0.2s ease;
  }
  .guide-card:hover .action i {
    transform: translateY(2px);
  }

  .closing {
    text-align: center;
    font-size: 1.05rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    margin-top: 2.5rem;
  }

  @media (max-width: 520px) {
    .guide-card {
      gap: 14px;
      padding: 14px 16px;
    }
    .cover {
      width: 60px;
      height: 60px;
    }
    .action {
      margin-right: -16px;
      padding: 0 12px;
    }
    .action-label {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .guide-card,
    .action,
    .action i {
      transition: none;
    }
  }
</style>
