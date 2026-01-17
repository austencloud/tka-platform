<script lang="ts">
  import { APP_DOMAIN } from "../../../config/domains";

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
      id: "why",
      icon: "fa-globe",
      title: "Why This Matters",
      color: "#ec4899",
      content: [
        "Flow arts is a very young art form. Many practitioners find it hard to collaborate with others due to physical distance or foundational differences in technique. Especially in the US, flow arts is a heavily solo-influenced art form.",
        "The Kinetic Alphabet does not rely on English terminology, instead embracing symbols and pictures for its communication, making it shareable with people from any cultural background and across any distance. It has a physical form making it recordable with pen and paper and a digital form which amplifies and streamlines the process significantly.",
      ],
    },
    {
      id: "who",
      icon: "fa-users",
      title: "Who It's For",
      color: "#f59e0b",
      content: [
        "The Kinetic Alphabet is designed to be an effective tool for flow arts teachers, choreographers, and practitioners of all levels. It bridges the gap between understanding theory and performing choreography. It exists to make synchronized group choreography more achievable, and it is also a tool for self-directed progression.",
        "Because it allows for performers to keep track of their individual parts, it opens the door to people who struggle with memory and executive function to be able to engage with complex and intricate choreography. It is split into multiple levels of increasing complexity and density, so a beginner can learn at their own pace on the level that suits them, or it can be used as a structured curriculum for exploring movement.",
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
</script>

<svelte:head>
  <title>About The Kinetic Alphabet | TKA Scribe</title>
  <meta
    name="description"
    content="The Kinetic Alphabet does something for flow arts that hasn't been explored before. Learn about the origin, mission, and vision behind TKA."
  />
</svelte:head>

<div class="about-page">
  <!-- Background effects -->
  <div class="bg-effects">
    <div class="glow glow-1"></div>
    <div class="glow glow-2"></div>
    <div class="glow glow-3"></div>
    <div class="grid-lines"></div>
  </div>

  <div class="about-container">
    <!-- Header -->
    <header class="about-header">
      <a href="/" class="back-link">
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
        <span>Back</span>
      </a>

      <div class="header-content">
        <h1>The Story Behind TKA</h1>
        <p class="tagline">A Flow Arts Choreography Toolbox</p>
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
</div>

<style>
  .about-page {
    --primary: #6366f1;
    --primary-light: #818cf8;
    --bg-dark: #0a0a0f;
    --bg-card: rgba(255, 255, 255, 0.03);
    --text: #ffffff;
    --text-muted: rgba(255, 255, 255, 0.6);
    --border: rgba(255, 255, 255, 0.1);

    position: relative;
    min-height: 100vh;
    background: var(--bg-dark);
    color: var(--text);
    overflow-x: hidden;
  }

  /* Background effects */
  .bg-effects {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
  }

  .grid-lines {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
    background-size: 80px 80px;
  }

  .glow {
    position: absolute;
    border-radius: 50%;
    filter: blur(120px);
    opacity: 0.3;
  }

  .glow-1 {
    width: 600px;
    height: 600px;
    background: #6366f1;
    top: -200px;
    right: -100px;
  }

  .glow-2 {
    width: 500px;
    height: 500px;
    background: #ec4899;
    top: 40%;
    left: -200px;
  }

  .glow-3 {
    width: 400px;
    height: 400px;
    background: #06b6d4;
    bottom: -100px;
    right: 10%;
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
    color: var(--text-muted);
    text-decoration: none;
    font-size: 0.875rem;
    padding: 0.5rem 1rem;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 100px;
    margin-bottom: 2rem;
    transition: all var(--duration-normal) ease;
  }

  .back-link:hover {
    color: var(--text);
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.05);
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
    color: var(--primary-light);
    margin: 0;
    font-weight: 500;
  }

  /* Hero quote */
  .hero-quote {
    position: relative;
    font-size: clamp(1.25rem, 3vw, 1.5rem);
    font-weight: 500;
    line-height: 1.5;
    color: var(--text);
    text-align: center;
    max-width: 700px;
    margin: 0 auto 4rem;
    padding: 2rem 2.5rem;
    background: linear-gradient(
      135deg,
      rgba(99, 102, 241, 0.12) 0%,
      rgba(236, 72, 153, 0.06) 100%
    );
    border: 1px solid rgba(99, 102, 241, 0.25);
    border-radius: 16px;
  }

  /* Sections grid */
  .sections-grid {
    display: grid;
    gap: 1.5rem;
  }

  .section-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 2rem;
    transition: all var(--duration-emphasis) ease;
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
    color: var(--text);
  }

  .card-content p {
    color: var(--text-muted);
    line-height: 1.75;
    margin: 0 0 1rem 0;
    font-size: 1rem;
  }

  .card-content p:last-child {
    margin-bottom: 0;
  }

  /* Footer CTA */
  .about-footer {
    margin-top: 4rem;
  }

  .cta-card {
    text-align: center;
    padding: 3rem 2rem;
    background: linear-gradient(
      135deg,
      rgba(99, 102, 241, 0.15) 0%,
      rgba(99, 102, 241, 0.05) 100%
    );
    border: 1px solid rgba(99, 102, 241, 0.3);
    border-radius: 24px;
  }

  .cta-card h3 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
  }

  .cta-card p {
    color: var(--text-muted);
    margin: 0 0 1.5rem 0;
  }

  .cta-button {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
    background: var(--primary);
    color: #ffffff;
    text-decoration: none;
    padding: 1rem 2rem;
    border-radius: 12px;
    font-weight: 600;
    font-size: 1.125rem;
    transition: all var(--duration-normal) ease;
  }

  .cta-button:hover {
    background: var(--primary-light);
    transform: translateY(-2px);
    box-shadow: 0 12px 32px rgba(99, 102, 241, 0.4);
  }

  .cta-button i {
    transition: transform var(--duration-normal) ease;
  }

  .cta-button:hover i {
    transform: translateX(4px);
  }

  /* Responsive */
  @media (max-width: 640px) {
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
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .section-card,
    .cta-button,
    .back-link {
      transition: none;
    }

    .section-card:hover,
    .cta-button:hover {
      transform: none;
    }

    .cta-button:hover i {
      transform: none;
    }
  }
</style>
