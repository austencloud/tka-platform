<script lang="ts">
  import { onMount } from "svelte";
  import { APP_DOMAIN } from "../../../config/domains";
  import BackgroundCanvas from "$lib/shared/background/shared/components/BackgroundCanvas.svelte";
  import { BackgroundType } from "$lib/shared/background/shared/domain/enums/background-enums";
  import { ANIMATED_BACKGROUNDS } from "$lib/shared/background/shared/config/animated-backgrounds";
  import { applyThemeForBackground } from "$lib/shared/settings/utils/background-theme-calculator";
  import { getPublicThemeIndex, savePublicThemeIndex, getNextThemeIndex } from "$lib/shared/background/shared/config/public-page-theme";

  const sections = [
    {
      id: "origin",
      icon: "fa-seedling",
      title: "The Origin",
      color: "#22c55e",
      content: [
        "The seed that planted this idea was a real problem. I was creating choreography with my circus troupe, Cirque Aflame, and needed an effective way to remember and communicate sequences. After using an early version to build an act, I became obsessed with exploring its limits.",
        "It began as an experiment in notation and quickly grew into an obsession as the system expanded in scale. Once it passed a tipping point and I realized it was covering new ground, I shifted my focus intensely toward its development.",
      ],
    },
    {
      id: "what",
      icon: "fa-music",
      title: "What TKA Does",
      color: "#6366f1",
      content: [
        "The Kinetic Alphabet does something for flow arts that hasn't been explored before. Just like music theory has musical notation and dance theory has Labanotation, flow arts needs a system of describing patterns and techniques and recording them in a way that expands beyond videos on the Internet.",
        "The Kinetic Alphabet functions like music theory in that it can be drawn or written on paper and communicated across languages. It provides a shared understanding of technique and language that can be drawn, written, or spoken, making it ideal for creating complex synchronized choreography.",
      ],
    },
    {
      id: "notation",
      icon: "fa-diagram-project",
      title: "The Notation System",
      color: "#14b8a6",
      content: [
        "Every beat of movement becomes a pictograph showing where your hands are and how they move on a grid. Hand positions use Greek letters: Alpha (α) for hands across from each other, Beta (β) for hands at the same point, and Gamma (γ) for hands forming a right angle.",
        "Pictographs capture motion types (prospin, antispin, float, dash, static), direction (clockwise or counter-clockwise), and rotation variations. The visual approach means you can read a sequence immediately without memorizing terminology first. The letter system is optional for those who want to verbalize and reference sequences by name.",
      ],
    },
    {
      id: "loops",
      icon: "fa-rotate",
      title: "LOOPs: Algorithmic Composition",
      color: "#f97316",
      content: [
        "LOOPs (Linked Orbital Offset Patterns) are transformations that generate circular sequences automatically. Start with one beat, apply a LOOP, and get a full circular sequence. This is where TKA starts creating patterns for you — not just documenting what you know, but showing you patterns you've never tried.",
        "LOOP types include Rotated (90° or 180° around the grid), Mirrored (vertical reflection), Swapped (exchange hand roles), Inverted (opposite motion types), and combinations that stack multiple transformations together.",
      ],
    },
    {
      id: "why",
      icon: "fa-globe",
      title: "Why This Matters",
      color: "#ec4899",
      content: [
        "Flow arts is a very young art form. Many practitioners find it hard to collaborate with others due to physical distance or foundational differences in technique. Especially in the US, flow arts is a heavily solo-influenced art form.",
        "The Kinetic Alphabet does not rely on English terminology, instead embracing symbols and pictures for its communication, making it shareable with people from any cultural background and across any distance. It has a physical form making it recordable with pen and paper and a digital form which streamlines the process significantly.",
      ],
    },
    {
      id: "who",
      icon: "fa-users",
      title: "Who It's For",
      color: "#f59e0b",
      content: [
        "The Kinetic Alphabet is designed for flow arts teachers, choreographers, and spinners — whether you're just starting out or have been at it for years. It helps you go from theory to performance. It exists to make synchronized group choreography more achievable, and it is also a tool for self-directed progression.",
        "Because it allows for performers to keep track of their individual parts, it opens the door to people who struggle with memory and executive function to be able to engage with complex and intricate choreography. It is split into multiple levels of increasing complexity and density, so a beginner can learn at their own pace on the level that suits them, or it can be used as a structured curriculum for exploring movement.",
      ],
    },
    {
      id: "educators",
      icon: "fa-chalkboard-user",
      title: "For Educators",
      color: "#a855f7",
      content: [
        "TKA changes how you teach. Instead of demonstrating the same move 50 times, show them the pictograph. Progress from Grid basics to advanced LOOPs with a structured curriculum.",
        "Assign sequences, track completion, and give visual feedback. Share notated sequences with students anywhere in the world — the visual system communicates across languages and distances.",
      ],
    },
    {
      id: "ownership",
      icon: "fa-palette",
      title: "Creative Ownership",
      color: "#8b5cf6",
      content: [
        "The Kinetic Alphabet breaks down sequences into their constituent parts allowing practitioners to reassemble them and create their own unique sequences. This means people feel a creative ownership over their own designs, making the process of creative expression through patterns accessible earlier in the learning process.",
      ],
    },
    {
      id: "vision",
      icon: "fa-rocket",
      title: "The Vision",
      color: "#06b6d4",
      content: [
        "I hope to influence the field toward greater collaboration and a higher standard for professional performances. The Kinetic Alphabet has already gained momentum. I've heard from flow artists across the world who are spreading it in their own communities.",
      ],
    },
  ];

  const faqs = [
    {
      question: "What is The Kinetic Alphabet?",
      answer:
        "The Kinetic Alphabet (TKA) is a notation system for flow arts. It uses pictographs to document choreography visually, allowing flow artists to share and learn sequences without relying solely on video or verbal descriptions.",
    },
    {
      question: "How is this different from other notation systems?",
      answer:
        "TKA builds on ideas from Vulcan Tech Gospel (VTG) and extends them into a comprehensive pictograph-based system. The visual approach means you can read a sequence immediately without memorizing terminology first.",
    },
    {
      question: "Do I need to memorize the letter system?",
      answer:
        "No. The pictographs are immediately readable without memorization. The letter system is optional and provides a way to verbalize and reference sequences by name once you want to go deeper.",
    },
    {
      question: "Can I use this for teaching?",
      answer:
        "Yes. Educators use TKA to create visual curriculum, assign sequences for students to learn, and provide feedback. The pictographs communicate more precisely than verbal descriptions alone.",
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
    content="The Kinetic Alphabet does something for flow arts that hasn't been explored before. Learn about the origin, mission, and vision behind TKA."
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
      The Kinetic Alphabet does something for flow arts that hasn't been explored before.
    </blockquote>

    <!-- Content sections -->
    <div class="sections-grid">
      {#each sections as section}
        <article class="section-card" style="--accent: {section.color}">
          <div class="card-header">
            <div class="icon-wrapper">
              <i class="fas {section.icon}" aria-hidden="true"></i>
            </div>
            <h2>{section.title}</h2>
          </div>
          <div class="card-content">
            {#each section.content as paragraph}
              <p>{paragraph}</p>
            {/each}
          </div>
        </article>
      {/each}
    </div>

    <!-- FAQ -->
    <section class="faq-section">
      <h2>Questions</h2>
      <div class="faq-list">
        {#each faqs as faq}
          <details class="faq-item">
            <summary>{faq.question}</summary>
            <p>{faq.answer}</p>
          </details>
        {/each}
      </div>
    </section>

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
    gap: 1rem;
    margin-bottom: 1.25rem;
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

  /* FAQ Section */
  .faq-section {
    margin-top: 4rem;
  }

  .faq-section h2 {
    font-size: 1.75rem;
    font-weight: 600;
    margin-bottom: 1.5rem;
    text-align: center;
  }

  .faq-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .faq-item {
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    overflow: hidden;
  }

  .faq-item summary {
    padding: 1.25rem 1.5rem;
    cursor: pointer;
    font-weight: 500;
    font-size: 1rem;
    list-style: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: background 0.2s ease;
  }

  .faq-item summary:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.05));
  }

  .faq-item summary::-webkit-details-marker {
    display: none;
  }

  .faq-item summary::after {
    content: "+";
    font-size: 1.5rem;
    color: var(--theme-accent-strong, #818cf8);
    font-weight: 300;
    transition: transform 0.2s ease;
  }

  .faq-item[open] summary::after {
    content: "−";
  }

  .faq-item p {
    padding: 0 1.5rem 1.25rem;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    margin: 0;
    font-size: 0.9375rem;
    line-height: 1.6;
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
