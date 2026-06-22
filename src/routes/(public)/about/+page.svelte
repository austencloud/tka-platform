<script lang="ts">
  import { APP_DOMAIN } from "../../../config/domains";
  import LightsToggleButton from "$lib/shared/ui/components/LightsToggleButton.svelte";
  import SiteHeader from "$lib/shared/landing/components/SiteHeader.svelte";

  // Position pictograph light/dark mode (default to light to show existing images)
  let positionLightsOn = $state(true);

  const sections = [
    {
      id: "what",
      icon: "fa-seedling",
      title: "What Is The Kinetic Alphabet",
      color: "#22c55e",
      content: [
        "The Kinetic Alphabet (TKA) is a notation system for flow arts. Other people have documented patterns before. The Kinetic Alphabet takes it further.",
        "Right now, flow arts knowledge lives mostly in videos scattered across the internet. Sheet music tells musicians what to play. Scripts tell actors what to say. The Kinetic Alphabet does that for prop movement: write it down, read it back, reproduce it later.",
      ],
    },
    {
      id: "notation",
      icon: "fa-diagram-project",
      title: "How It Works",
      color: "#14b8a6",
      content: [
        "Each beat of movement gets a pictograph. It shows where your hands are and how they move on a grid. You can read it without memorizing terminology. Positions are simple: hands across from each other, at the same point, or at a right angle.",
        "Pictographs also capture motion type, direction, and rotation. Letters are optional but handy when you need to talk about a specific beat during rehearsal.",
      ],
    },
    {
      id: "why",
      icon: "fa-globe",
      title: "Why This Matters",
      color: "#ec4899",
      content: [
        "Flow arts is young. Most spinners learn alone, develop their own vocabulary, and have a hard time collaborating with people who learned differently.",
        "TKA uses symbols and pictures instead of English terminology, so it works across languages. It works on paper and on screen.",
        "When patterns are written down, choreographers can share and build on each other's work. You can also archive your own material and actually find it again months later.",
      ],
    },
    {
      id: "who",
      icon: "fa-users",
      title: "Who It's For",
      color: "#f59e0b",
      content: [
        "Teachers, choreographers, spinners. TKA is meant to make synchronized group choreography more realistic, but it's also useful for solo practice.",
        "It tracks individual parts, which helps if you struggle with memory or executive function. The level system starts simple and gets denser, so you set your own pace.",
        "If you care more about theatrical performance than technical patterns, that's fine. Learn the notation, then forget about it while you perform.",
      ],
    },
    {
      id: "vision",
      icon: "fa-rocket",
      title: "The Vision",
      color: "#06b6d4",
      content: [
        "If you teach, you can hand someone a pictograph instead of demonstrating the same thing over and over. Send notated sequences to students anywhere. No shared language required.",
        "Once the system clicks, you start thinking in it. Make your own sequences. The letter system shows you what you've explored and what you haven't, so there's always something new to try.",
        "The long-term goal is better collaboration and more ambitious group performances.",
      ],
    },
  ];

  const backHref = "/";
</script>

<svelte:head>
  <title>About The Kinetic Alphabet | TKA Composer</title>
  <meta
    name="description"
    content="The Kinetic Alphabet (TKA) is a notation system for flow arts. Learn what TKA is, how it works, and why it exists."
  />
  <link rel="canonical" href="https://tkaflowarts.com/about" />

  <meta property="og:type" content="article" />
  <meta property="og:url" content="https://tkaflowarts.com/about" />
  <meta property="og:title" content="About The Kinetic Alphabet" />
  <meta
    property="og:description"
    content="The Kinetic Alphabet (TKA) is a notation system for flow arts. Learn what TKA is, how it works, and why it exists."
  />
  <meta property="og:image" content="https://tkaflowarts.com/branding/og-image.png" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="About The Kinetic Alphabet" />
  <meta
    name="twitter:description"
    content="The Kinetic Alphabet (TKA) is a notation system for flow arts. Learn what TKA is, how it works, and why it exists."
  />
  <meta name="twitter:image" content="https://tkaflowarts.com/branding/og-image.png" />

  <!-- JSON-LD: AboutPage identifies this page and its subject (the TKA system) -->
  {@html `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "name": "About The Kinetic Alphabet",
    "url": "https://tkaflowarts.com/about",
    "description": "The Kinetic Alphabet (TKA) is a notation system for flow arts. Learn what TKA is, how it works, and why it exists.",
    "inLanguage": "en-US",
    "mainEntity": {
      "@type": "Thing",
      "name": "The Kinetic Alphabet",
      "alternateName": ["TKA", "Kinetic Alphabet", "Flow Arts Notation"],
      "description": "A notation system for flow arts that uses pictographs to document staff, club, fan, hoop, and buugeng choreography."
    },
    "isPartOf": {
      "@type": "WebSite",
      "name": "TKA - The Kinetic Alphabet",
      "url": "https://tkaflowarts.com/"
    }
  }
  </script>`}

  <!-- JSON-LD: BreadcrumbList for search result hierarchy -->
  {@html `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://tkaflowarts.com/"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "About",
        "item": "https://tkaflowarts.com/about"
      }
    ]
  }
  </script>`}

  <!-- JSON-LD: FAQPage - matches the visible FAQ section on this page -->
  {@html `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "What is The Kinetic Alphabet?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "The Kinetic Alphabet (TKA) is a notation system for flow arts - like sheet music for dancers. It lets flow artists document, share, and learn staff, clubs, fans, hoops, buugeng, and sword choreography using pictographs and symbols."
        }
      },
      {
        "@type": "Question",
        "name": "What does TKA stand for?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "TKA stands for The Kinetic Alphabet, a flow arts notation system for documenting and sharing staff, fans, hoop, club, and buugeng choreography."
        }
      },
      {
        "@type": "Question",
        "name": "What is flow arts notation?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Flow arts notation is a system for writing down prop manipulation movements like staff, fans, hoop, and club choreography. The Kinetic Alphabet uses pictographs to represent each beat of movement, showing hand positions, motion types, and prop orientation."
        }
      },
      {
        "@type": "Question",
        "name": "How do you write down staff spinning moves?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "The Kinetic Alphabet uses pictographs that capture hand positions on a grid, motion types (prospin, antispin, static), direction, and number of turns. It's built for dual-wielded props like double staff, and the notation applies to any prop you grip directly."
        }
      },
      {
        "@type": "Question",
        "name": "What props does TKA Composer support?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "TKA Composer is built for dual-wielded static props: staff, clubs, fans, hoops, mini hoops, buugeng, triads, and swords. Each prop is rendered with proper rotations and hand positions."
        }
      },
      {
        "@type": "Question",
        "name": "Can I use TKA notation for poi?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "The Kinetic Alphabet is built for static props like staff and fans, where you can hold any orientation freely. Poi is momentum-based, so gravity limits which TKA sequences are physically possible. Many sequences work, but not all. The Poi Lab tool identifies which sequences are poi-legal."
        }
      },
      {
        "@type": "Question",
        "name": "Is TKA Composer free to use?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes, TKA Composer is completely free. You can create sequences, animate them, export to various formats, and browse the community library at no cost. The app is open and accessible to all flow artists."
        }
      },
      {
        "@type": "Question",
        "name": "How do I learn flow arts with The Kinetic Alphabet?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "TKA Composer includes progressive lessons from grid basics to advanced LOOPs. Interactive quizzes help reinforce understanding, and the Train module offers daily challenges to track your progress."
        }
      },
      {
        "@type": "Question",
        "name": "Can I share my sequences with other flow artists?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes. Export sequences as PNG images, PDFs, animated GIFs, or videos. Share links directly to Instagram, or publish to the community gallery for other artists to find."
        }
      }
    ]
  }
  </script>`}
</svelte:head>

<SiteHeader />

<div class="about-page">
  <div class="about-container">
    <!-- Header -->
    <header class="about-header">
      <a href={backHref} class="back-link">
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
        <span>Back</span>
      </a>

      <div class="header-content">
        <h1>The Kinetic Alphabet</h1>
        <p class="tagline">A notation system for flow arts</p>
      </div>
    </header>

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

    <!-- Frequently Asked Questions (visible FAQ for search + AI overviews) -->
    <section class="faq-section" aria-labelledby="faq-heading">
      <h2 id="faq-heading">Frequently Asked Questions</h2>

      <article class="faq-item">
        <h3>What is The Kinetic Alphabet?</h3>
        <p>
          The Kinetic Alphabet (TKA) is a notation system for flow arts - like sheet music for dancers. It lets flow artists document, share, and learn staff, clubs, fans, hoops, buugeng, and sword choreography using pictographs and symbols.
        </p>
      </article>

      <article class="faq-item">
        <h3>What does TKA stand for?</h3>
        <p>
          TKA stands for The Kinetic Alphabet, a flow arts notation system for documenting and sharing staff, fans, hoop, club, and buugeng choreography.
        </p>
      </article>

      <article class="faq-item">
        <h3>What is flow arts notation?</h3>
        <p>
          Flow arts notation is a system for writing down prop manipulation movements like staff, fans, hoop, and club choreography. The Kinetic Alphabet uses pictographs to represent each beat of movement, showing hand positions, motion types, and prop orientation.
        </p>
      </article>

      <article class="faq-item">
        <h3>How do you write down staff spinning moves?</h3>
        <p>
          The Kinetic Alphabet uses pictographs that capture hand positions on a grid, motion types (prospin, antispin, static), direction, and number of turns. It's built for dual-wielded props like double staff, and the notation applies to any prop you grip directly.
        </p>
      </article>

      <article class="faq-item">
        <h3>What props does TKA Composer support?</h3>
        <p>
          TKA Composer is built for dual-wielded static props: staff, clubs, fans, hoops, mini hoops, buugeng, triads, and swords. Each prop is rendered with proper rotations and hand positions.
        </p>
      </article>

      <article class="faq-item">
        <h3>Can I use TKA notation for poi?</h3>
        <p>
          The Kinetic Alphabet is built for static props like staff and fans, where you can hold any orientation freely. Poi is momentum-based, so gravity limits which TKA sequences are physically possible. Many sequences work, but not all. The Poi Lab tool identifies which sequences are poi-legal.
        </p>
      </article>

      <article class="faq-item">
        <h3>Is TKA Composer free to use?</h3>
        <p>
          Yes, TKA Composer is completely free. You can create sequences, animate them, export to various formats, and browse the community library at no cost. The app is open and accessible to all flow artists.
        </p>
      </article>

      <article class="faq-item">
        <h3>How do I learn flow arts with The Kinetic Alphabet?</h3>
        <p>
          TKA Composer includes progressive lessons from grid basics to advanced LOOPs. Interactive quizzes help reinforce understanding, and the Train module offers daily challenges to track your progress.
        </p>
      </article>

      <article class="faq-item">
        <h3>Can I share my sequences with other flow artists?</h3>
        <p>
          Yes. Export sequences as PNG images, PDFs, animated GIFs, or videos. Share links directly to Instagram, or publish to the community gallery for other artists to find.
        </p>
      </article>
    </section>

    <!-- CTA -->
    <footer class="about-footer">
      <div class="cta-card">
        <h3>Ready to create?</h3>
        <p>TKA Composer is free to use. No download required.</p>
        <a href="/create" class="cta-button">
          <span>Open TKA Composer</span>
          <i class="fas fa-arrow-right" aria-hidden="true"></i>
        </a>
      </div>
      <p class="creator-credit">Created by Austen Cloud • 2022–present</p>
    </footer>
  </div>
</div>

<style>
  .about-page {
    position: relative;
    min-height: 100vh;
    padding-top: 64px; /* clear the fixed SiteHeader */
    color: #ffffff;
    background: linear-gradient(145deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%);
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
    color: rgba(255, 255, 255, 0.6);
    text-decoration: none;
    font-size: 0.875rem;
    padding: 0.5rem 1rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 100px;
    margin-bottom: 2rem;
    transition: all 0.2s ease;
  }

  .back-link:hover {
    color: #ffffff;
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
    color: #818cf8;
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
    color: #ffffff;
    text-align: center;
    max-width: 700px;
    margin: 0 auto 4rem;
    padding: 2rem 2.5rem;
    background: color-mix(
      in srgb,
      #6366f1 12%,
      transparent
    );
    border: 1px solid
      color-mix(in srgb, #6366f1 25%, transparent);
    border-radius: 20px;
    transition:
      background 0.3s ease,
      border-color 0.3s ease;
  }

  /* Sections grid */
  .sections-grid {
    display: grid;
    gap: 1.5rem;
  }

  .section-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
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
    color: #ffffff;
  }

  .card-content p {
    color: rgba(255, 255, 255, 0.6);
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
    border: 1px solid rgba(255, 255, 255, 0.1);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 0.5rem;
    transition:
      filter 0.3s ease,
      background 0.3s ease;
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
    color: #ffffff;
    margin-bottom: 0.125rem;
  }

  .position-desc {
    font-size: var(--font-size-compact, 12px);
    color: rgba(255, 255, 255, 0.6);
  }

  /* FAQ Section */
  .faq-section {
    margin-top: 4rem;
    padding: 2rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
  }

  .faq-section > h2 {
    font-size: clamp(1.5rem, 4vw, 2rem);
    font-weight: 700;
    margin: 0 0 1.5rem 0;
    color: #ffffff;
    text-align: center;
  }

  .faq-item {
    padding: 1.25rem 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .faq-item:last-child {
    border-bottom: none;
  }

  .faq-item h3 {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
    color: #ffffff;
  }

  .faq-item p {
    margin: 0;
    color: rgba(255, 255, 255, 0.75);
    line-height: 1.6;
    font-size: 0.95rem;
  }

  /* Footer CTA */
  .about-footer {
    margin-top: 4rem;
  }

  .creator-credit {
    text-align: center;
    margin-top: 2rem;
    color: rgba(255, 255, 255, 0.5);
    font-size: var(--font-size-compact, 12px);
  }

  .cta-card {
    text-align: center;
    padding: 3rem 2rem;
    background: color-mix(
      in srgb,
      #6366f1 15%,
      transparent
    );
    border: 1px solid
      color-mix(in srgb, #6366f1 30%, transparent);
    border-radius: 24px;
    transition:
      background 0.3s ease,
      border-color 0.3s ease;
  }

  .cta-card h3 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
  }

  .cta-card p {
    color: rgba(255, 255, 255, 0.6);
    margin: 0 0 1.5rem 0;
  }

  .cta-button {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
    background: #6366f1;
    color: #ffffff;
    text-decoration: none;
    padding: 1rem 2rem;
    border-radius: 12px;
    font-weight: 600;
    font-size: 1.125rem;
    transition: all 0.2s ease;
  }

  .cta-button:hover {
    background: #818cf8;
    transform: translateY(-2px);
    box-shadow: 0 12px 32px
      color-mix(in srgb, #6366f1 40%, transparent);
  }

  .cta-button i {
    transition: transform 0.2s ease;
  }

  .cta-button:hover i {
    transform: translateX(4px);
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
    .tagline,
    .hero-quote,
    .cta-card {
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
