<script lang="ts">
  import { onMount } from "svelte";
  import { APP_DOMAIN } from "../../../config/domains";
  import BackgroundCanvas from "$lib/shared/background/shared/components/BackgroundCanvas.svelte";
  import { BackgroundType } from "$lib/shared/background/shared/domain/enums/background-enums";
  import { ANIMATED_BACKGROUNDS } from "$lib/shared/background/shared/config/animated-backgrounds";
  import { applyThemeForBackground } from "$lib/shared/settings/utils/background-theme-calculator";
  import { getPublicThemeIndex, savePublicThemeIndex, getNextThemeIndex } from "$lib/shared/background/shared/config/public-page-theme";
  import LightsToggleButton from "$lib/shared/ui/components/LightsToggleButton.svelte";

  // Position pictograph light/dark mode (default to light to show existing images)
  let positionLightsOn = $state(true);

  const sections = [
    {
      id: "origin",
      icon: "fa-seedling",
      title: "The Origin",
      color: "#22c55e",
      content: [
        "The seed that planted this idea was a real problem. I was creating choreography with my circus troupe and needed a way to remember and communicate sequences. After using an early version to build an act, I became obsessed with exploring its limits.",
        "It began as an experiment in notation and quickly grew into an obsession as the system expanded in scale. Once it passed a tipping point and I realized it was covering new ground, I threw myself into its development.",
      ],
    },
    {
      id: "what",
      icon: "fa-music",
      title: "What TKA Does",
      color: "#6366f1",
      content: [
        "The Kinetic Alphabet brings something novel to flow arts. Previous attempts to document spin have created collections of knowledge that form the backbone of TKA's notation system. But flow arts still needs a way to describe patterns that expands beyond videos scattered across the Internet.",
        "Sheet music tells musicians what notes to play. It says nothing about how to feel while playing. Actors memorize their lines so they can act. TKA works the same way: it handles what your hands and props are doing so your mind has bandwidth for everything else.",
      ],
    },
    {
      id: "notation",
      icon: "fa-diagram-project",
      title: "The Notation System",
      color: "#14b8a6",
      content: [
        "Every beat of movement becomes a pictograph showing where your hands are and how they move on a grid. The visual approach means you can read a sequence immediately without memorizing terminology. Positions describe where your hands are relative to each other: across from each other, at the same point, forming a right angle.",
        "Pictographs also capture motion types, direction, and rotation. The letter system is optional, but useful when you need to reference a single beat in a specific sequence during choreography and rehearsal.",
      ],
    },
    {
      id: "why",
      icon: "fa-globe",
      title: "Why This Matters",
      color: "#ec4899",
      content: [
        "Flow arts is a very young art form. Many practitioners find it hard to collaborate with others due to physical distance or foundational differences in technique. Especially in the US, where TKA got its start, flow arts is a heavily solo-influenced art form.",
        "The Kinetic Alphabet does not rely on English terminology, instead embracing symbols and pictures for its communication, making it shareable with people from any cultural background and across any distance. It has a physical form making it recordable with pen and paper and a digital form which streamlines the process significantly.",
        "TKA handles the technical complexity of hand paths and prop relationships. That leaves mental bandwidth for the parts of performance that can't be notated. Expression, presence, how you move through space.",
      ],
    },
    {
      id: "who",
      icon: "fa-users",
      title: "Who It's For",
      color: "#f59e0b",
      content: [
        "The Kinetic Alphabet is designed for flow arts teachers, choreographers, and spinners. For beginners and veterans alike, TKA bridges theory and performance. It exists to make synchronized group choreography more achievable, and it is also a tool for self-directed progression.",
        "Because it allows for performers to keep track of their individual parts, it opens the door to people who struggle with memory and executive function to be able to engage with complex and intricate choreography. It is split into multiple levels of increasing complexity and density, so a beginner can learn at their own pace on the level that suits them, or it can be used as a structured curriculum for exploring movement.",
        "It's also for performers who care more about expression than drilling patterns. TKA handles the technical groundwork so you can focus on being a performer. Learn the notation, then forget it so you can perform.",
      ],
    },
    {
      id: "educators",
      icon: "fa-chalkboard-user",
      title: "For Educators",
      color: "#a855f7",
      content: [
        "TKA changes how you teach. Instead of demonstrating the same sequence 50 times, show them the pictograph. Share notated sequences with students anywhere in the world. The visual system works across languages.",
        "Students who internalize the pictographs and vocabulary gain building blocks for thinking about movement, and mental bandwidth to focus on expression.",
      ],
    },
    {
      id: "ownership",
      icon: "fa-palette",
      title: "Creative Ownership",
      color: "#8b5cf6",
      content: [
        "TKA breaks prop movement into building blocks. Once you understand how sequences work, you can build your own. And once your body knows the shapes, your mind is free for everything else.",
      ],
    },
    {
      id: "vision",
      icon: "fa-rocket",
      title: "The Vision",
      color: "#06b6d4",
      content: [
        "The goal is greater collaboration and more ambitious live performances. The Kinetic Alphabet has already gained momentum. Flow artists across the world are spreading it in their communities.",
        "The Kinetic Alphabet isn't meant to define what flow arts should look like. It's meant to handle the technical groundwork so artists can focus on what makes them unique.",
      ],
    },
  ];

  // Use shared animated backgrounds config
  const backgrounds = ANIMATED_BACKGROUNDS;

  // Restore saved theme from localStorage (persists across public pages)
  let currentBgIndex = $state(getPublicThemeIndex());
  let currentBackground = $derived(backgrounds[currentBgIndex]?.type ?? BackgroundType.NIGHT_SKY);
  let currentIcon = $derived(backgrounds[currentBgIndex]?.icon ?? "fa-moon");
  let currentLabel = $derived(backgrounds[currentBgIndex]?.label ?? "Night Sky");

  function cycleBackground() {
    currentBgIndex = getNextThemeIndex(currentBgIndex);
    savePublicThemeIndex(currentBgIndex);
    applyThemeForBackground(backgrounds[currentBgIndex]!.type);
  }

  onMount(() => {
    applyThemeForBackground(currentBackground);
  });

  // In dev, back goes to /landing; in prod, back goes to /
  const backHref = import.meta.env.DEV ? "/landing" : "/";
</script>

<svelte:head>
  <title>About The Kinetic Alphabet | TKA Scribe</title>
  <meta
    name="description"
    content="The Kinetic Alphabet brings something novel to flow arts. Learn about the origin, mission, and vision behind TKA."
  />
</svelte:head>

<div class="about-page">
  <!-- Animated Background -->
  <BackgroundCanvas backgroundType={currentBackground} quality="medium" />

  <div class="about-container">
    <!-- Header -->
    <header class="about-header">
      <a href={backHref} class="back-link">
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
        <span>Back</span>
      </a>

      <div class="header-content">
        <h1>The Story Behind TKA</h1>
        <p class="tagline">A notation system for flow arts</p>
      </div>
    </header>

    <!-- Quote callout -->
    <blockquote class="hero-quote">
      The Kinetic Alphabet brings something novel to flow arts.
    </blockquote>

    <!-- Content sections -->
    <div class="sections-grid">
      {#each sections as section}
        <article class="section-card" style="--accent: {section.color}">
          <div class="card-header">
            <div class="card-header-left">
              <div class="icon-wrapper">
                <i class="fas {section.icon}" aria-hidden="true"></i>
              </div>
              <h2>{section.title}</h2>
            </div>
            {#if section.id === "notation"}
              <LightsToggleButton
                lightsOn={positionLightsOn}
                onToggle={() => (positionLightsOn = !positionLightsOn)}
                size="small"
              />
            {/if}
          </div>
          <div class="card-content">
            {#if section.id === "notation"}
              <!-- First paragraph -->
              <p>{section.content[0]}</p>

              <!-- Position pictographs -->
              <div class="position-grid" class:dark-mode={!positionLightsOn}>
                <div class="position-item">
                  <div class="position-image-container">
                    <img
                      src="/images/position_images/alpha.png"
                      alt="Alpha position: hands at opposite points on the grid"
                    />
                  </div>
                  <span class="position-name">Alpha</span>
                  <span class="position-desc">Opposite points</span>
                </div>
                <div class="position-item">
                  <div class="position-image-container">
                    <img
                      src="/images/position_images/beta.png"
                      alt="Beta position: hands at the same point on the grid"
                    />
                  </div>
                  <span class="position-name">Beta</span>
                  <span class="position-desc">Same point</span>
                </div>
                <div class="position-item">
                  <div class="position-image-container">
                    <img
                      src="/images/position_images/gamma.png"
                      alt="Gamma position: hands forming a right angle on the grid"
                    />
                  </div>
                  <span class="position-name">Gamma</span>
                  <span class="position-desc">Right angle</span>
                </div>
              </div>

              <!-- Second paragraph -->
              <p>{section.content[1]}</p>
            {:else}
              {#each section.content as paragraph}
                <p>{paragraph}</p>
              {/each}
            {/if}
          </div>
        </article>
      {/each}
    </div>

    <!-- CTA -->
    <footer class="about-footer">
      <div class="cta-card">
        <h3>Ready to explore?</h3>
        <p>TKA Scribe is free to use. No download required.</p>
        <a href={APP_DOMAIN} class="cta-button">
          <span>Open TKA Scribe</span>
          <i class="fas fa-arrow-right" aria-hidden="true"></i>
        </a>
      </div>
    </footer>
  </div>

  <!-- Theme Toggle Button -->
  <button
    class="theme-toggle"
    onclick={cycleBackground}
    title="Change theme: {currentLabel}"
    aria-label="Change background theme"
  >
    <i class="fas {currentIcon}" aria-hidden="true"></i>
  </button>
</div>

<style>
  .about-page {
    position: relative;
    min-height: 100vh;
    color: var(--theme-text, #ffffff);
    overflow-x: hidden;
  }

  /* Container */
  .about-container {
    position: relative;
    z-index: 1;
    max-width: 900px;
    margin: 0 auto;
    padding: 2rem 1.5rem 4rem;
  }

  /* Header */
  .about-header {
    margin-bottom: 3rem;
  }

  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    text-decoration: none;
    font-size: 0.875rem;
    padding: 0.5rem 1rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 100px;
    margin-bottom: 2rem;
    transition: all 0.2s ease;
  }

  .back-link:hover {
    color: var(--theme-text, #ffffff);
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.2));
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.05));
  }

  .header-content {
    text-align: center;
  }

  h1 {
    font-size: clamp(2.5rem, 6vw, 3.5rem);
    font-weight: 700;
    margin: 0 0 0.5rem 0;
    background: linear-gradient(135deg, #fff 0%, rgba(255, 255, 255, 0.7) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    line-height: 1.1;
  }

  .tagline {
    font-size: 1.25rem;
    color: var(--theme-accent-strong, #818cf8);
    margin: 0;
    font-weight: 500;
    transition: color 0.3s ease;
  }

  /* Hero quote */
  .hero-quote {
    position: relative;
    font-size: clamp(1.25rem, 3vw, 1.5rem);
    font-weight: 500;
    line-height: 1.5;
    color: var(--theme-text, #ffffff);
    text-align: center;
    max-width: 700px;
    margin: 0 auto 4rem;
    padding: 2rem 2.5rem;
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent, #6366f1) 25%, transparent);
    border-radius: 20px;
    transition: background 0.3s ease, border-color 0.3s ease;
  }

  /* Sections grid */
  .sections-grid {
    display: grid;
    gap: 1.5rem;
  }

  .section-card {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 20px;
    padding: 2rem;
    transition: all 0.25s ease;
  }

  .section-card:hover {
    border-color: color-mix(in srgb, var(--accent) 40%, transparent);
    transform: translateY(-2px);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.25rem;
  }

  .card-header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: color-mix(in srgb, var(--accent) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
    border-radius: 12px;
    color: var(--accent);
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .section-card h2 {
    font-size: 1.375rem;
    font-weight: 600;
    margin: 0;
    color: var(--theme-text, #ffffff);
  }

  .card-content p {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    line-height: 1.7;
    margin: 0 0 1rem 0;
    font-size: 1rem;
  }

  .card-content p:last-child {
    margin-bottom: 0;
  }

  /* Position pictographs grid */
  .position-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin: 1.5rem 0;
  }

  .position-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .position-image-container {
    width: 100%;
    max-width: 160px;
    aspect-ratio: 1;
    background: #ffffff;
    border-radius: 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 0.5rem;
    transition: filter 0.3s ease, background 0.3s ease;
  }

  .position-image-container img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  /* Dark mode - invert the images */
  .position-grid.dark-mode .position-image-container {
    background: #1a1a2e;
    filter: invert(1) hue-rotate(180deg);
  }

  .position-name {
    font-weight: 600;
    font-size: 1rem;
    color: var(--theme-text, #ffffff);
    margin-bottom: 0.125rem;
  }

  .position-desc {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  /* Footer CTA */
  .about-footer {
    margin-top: 4rem;
  }

  .cta-card {
    text-align: center;
    padding: 3rem 2rem;
    background: color-mix(in srgb, var(--theme-accent, #6366f1) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--theme-accent, #6366f1) 30%, transparent);
    border-radius: 24px;
    transition: background 0.3s ease, border-color 0.3s ease;
  }

  .cta-card h3 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
  }

  .cta-card p {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    margin: 0 0 1.5rem 0;
  }

  .cta-button {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
    background: var(--theme-accent, #6366f1);
    color: #ffffff;
    text-decoration: none;
    padding: 1rem 2rem;
    border-radius: 12px;
    font-weight: 600;
    font-size: 1.125rem;
    transition: all 0.2s ease;
  }

  .cta-button:hover {
    background: var(--theme-accent-strong, #818cf8);
    transform: translateY(-2px);
    box-shadow: 0 12px 32px color-mix(in srgb, var(--theme-accent, #6366f1) 40%, transparent);
  }

  .cta-button i {
    transition: transform 0.2s ease;
  }

  .cta-button:hover i {
    transform: translateX(4px);
  }

  /* Theme Toggle Button */
  .theme-toggle {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 100;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--theme-accent-strong, #818cf8) 15%, rgba(0, 0, 0, 0.5));
    border: 1px solid color-mix(in srgb, var(--theme-accent-strong, #818cf8) 25%, transparent);
    border-radius: 50%;
    color: var(--theme-accent-strong, #818cf8);
    font-size: 1.125rem;
    cursor: pointer;
    backdrop-filter: blur(8px);
    transition: all 0.2s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .theme-toggle:hover {
    background: color-mix(in srgb, var(--theme-accent-strong, #818cf8) 25%, rgba(0, 0, 0, 0.6));
    border-color: color-mix(in srgb, var(--theme-accent-strong, #818cf8) 40%, transparent);
    transform: scale(1.05);
  }

  .theme-toggle:active {
    transform: scale(0.95);
  }

  /* Responsive */
  @media (max-width: 768px) {
    .about-container {
      padding: 1.5rem 1rem 3rem;
    }

    .section-card {
      padding: 1.5rem;
    }

    .card-header {
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .card-header-left {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.75rem;
    }

    .hero-quote {
      padding: 1.5rem;
      margin-bottom: 3rem;
    }

    .cta-card {
      padding: 2rem 1.5rem;
    }

    .theme-toggle {
      bottom: 16px;
      right: 16px;
      width: 44px;
      height: 44px;
    }

    /* Position grid responsive */
    .position-grid {
      grid-template-columns: repeat(3, 1fr);
      gap: 0.75rem;
    }

    .position-image-container {
      max-width: 100px;
    }

    .position-name {
      font-size: 0.875rem;
    }
  }

  @media (max-width: 400px) {
    .position-image-container {
      max-width: 80px;
    }

    .position-desc {
      font-size: 11px;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .section-card,
    .cta-button,
    .back-link,
    .theme-toggle,
    .tagline,
    .hero-quote,
    .cta-card {
      transition: none;
    }

    .section-card:hover,
    .cta-button:hover,
    .theme-toggle:hover {
      transform: none;
    }

    .cta-button:hover i {
      transform: none;
    }
  }
</style>
