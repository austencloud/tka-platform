<script lang="ts">
  const props = [
    { name: "Poi", icon: "fa-circle" },
    { name: "Staff", icon: "fa-minus" },
    { name: "Hoop", icon: "fa-ring" },
    { name: "Clubs", icon: "fa-bowling-ball" },
    { name: "Fans", icon: "fa-fan" },
    { name: "Buugeng", icon: "fa-yin-yang" },
  ];

  const features = [
    {
      title: "Pictograph System",
      description:
        "Each beat of movement is represented by a visual diagram showing hand positions, motion type, and prop orientation.",
    },
    {
      title: "Position Grid",
      description:
        "Hands are placed on a grid with three position types: Alpha (same direction), Beta (opposite direction), and Gamma (split).",
    },
    {
      title: "Motion Types",
      description:
        "Capture prospin, antispin, static, float, and dash movements with precise turn counts (0.5, 1, 1.5, 2+).",
    },
    {
      title: "Letter System",
      description:
        "Each fundamental motion has a letter. Combine letters into words — multi-beat patterns that become your choreographic vocabulary.",
    },
  ];

  const faqs = [
    {
      question: "What is flow arts notation?",
      answer:
        "Flow arts notation is a system for writing down prop manipulation movements. Just like musicians use sheet music, flow artists can use notation to document, share, and learn choreography for poi, staff, hoop, clubs, and other props.",
    },
    {
      question: "Why do flow artists need notation?",
      answer:
        "Without notation, flow artists rely on videos or verbal descriptions to share moves. Notation provides a universal written language that's precise, searchable, and works across language barriers. You can share a sequence in seconds instead of filming a tutorial.",
    },
    {
      question: "Is TKA the only flow arts notation system?",
      answer:
        "There have been other notation attempts like QFT (Quantized Flow Theory) for poi. TKA builds on these ideas to create a comprehensive system that works across all props and captures the full range of movement possibilities.",
    },
    {
      question: "How long does it take to learn?",
      answer:
        "You can understand basic pictographs in minutes. The Learn module in TKA Scribe has 28 structured concepts that take you from grid basics to advanced patterns, with interactive quizzes to reinforce understanding.",
    },
    {
      question: "Can I use this for teaching?",
      answer:
        "Absolutely. Educators use TKA to create curriculum, assign sequences for students to learn, and provide visual feedback. Instead of demonstrating the same move repeatedly, show them the pictograph.",
    },
  ];
</script>

<svelte:head>
  <title>Flow Arts Notation | TKA - The Kinetic Alphabet</title>
  <meta
    name="description"
    content="Flow arts notation for poi, staff, hoop, club, and fan choreography. TKA (The Kinetic Alphabet) is a notation system that lets you document, share, and learn prop manipulation sequences."
  />
  <meta
    name="keywords"
    content="flow arts notation, flow arts notation system, poi notation, staff notation, hoop notation, club notation, fan notation, prop notation, movement notation, dance notation, TKA, The Kinetic Alphabet"
  />
  <link rel="canonical" href="https://tkaflowarts.com/notation" />

  <meta property="og:type" content="article" />
  <meta
    property="og:title"
    content="Flow Arts Notation | A System for Documenting Choreography"
  />
  <meta
    property="og:description"
    content="A notation system for poi, staff, hoop, club, and fan choreography. Document, share, and learn flow arts sequences with TKA."
  />
  <meta property="og:url" content="https://tkaflowarts.com/notation" />

  <!-- JSON-LD for this page -->
  {@html `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "Flow Arts Notation: A System for Documenting Choreography",
    "description": "Flow arts notation is a system for writing down prop manipulation movements like poi, staff, hoop, and club choreography. Learn how TKA (The Kinetic Alphabet) provides a universal notation system for flow artists.",
    "author": {
      "@type": "Organization",
      "name": "TKA - The Kinetic Alphabet"
    },
    "publisher": {
      "@type": "Organization",
      "name": "TKA - The Kinetic Alphabet",
      "url": "https://tkaflowarts.com"
    },
    "mainEntityOfPage": "https://tkaflowarts.com/notation"
  }
  </script>`}

  <!-- FAQPage schema for this page -->
  {@html `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "What is flow arts notation?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Flow arts notation is a system for writing down prop manipulation movements. Just like musicians use sheet music, flow artists can use notation to document, share, and learn choreography for poi, staff, hoop, clubs, and other props."
        }
      },
      {
        "@type": "Question",
        "name": "Why do flow artists need notation?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Without notation, flow artists rely on videos or verbal descriptions to share moves. Notation provides a universal written language that's precise, searchable, and works across language barriers."
        }
      },
      {
        "@type": "Question",
        "name": "Is there a notation system for poi?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes, TKA (The Kinetic Alphabet) is a notation system that supports poi and many other props. It lets you document poi patterns like flowers, antispins, isolations, and extensions using visual pictographs."
        }
      },
      {
        "@type": "Question",
        "name": "How do you write down staff spinning moves?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "TKA provides staff notation using pictographs that capture hand positions on a grid, motion types (prospin, antispin, static), direction, and number of turns. You can notate contact staff, double staff, and dragon staff sequences."
        }
      }
    ]
  }
  </script>`}
</svelte:head>

<div class="notation-page">
  <header class="hero">
    <div class="container">
      <h1>Flow Arts Notation</h1>
      <p class="subtitle">
        A notation system for documenting and sharing poi, staff, hoop, club,
        and fan choreography
      </p>
      <a href="https://tkascribe.com" class="cta-button">
        Try TKA Scribe Free
      </a>
    </div>
  </header>

  <main>
    <section class="intro">
      <div class="container">
        <h2>What is Flow Arts Notation?</h2>
        <p>
          Flow arts notation is a system for writing down prop manipulation
          movements — the same way musicians use sheet music or dancers use
          Labanotation. Instead of relying on videos or trying to describe "that
          spinny thing where your hands cross," notation gives you a precise,
          universal language for choreography.
        </p>
        <p>
          <strong>TKA (The Kinetic Alphabet)</strong> is a flow arts notation system
          that uses pictographs to represent each beat of movement. Every pictograph
          captures where your hands are, what motion type you're using, and how the
          prop moves through space.
        </p>
      </div>
    </section>

    <section class="props">
      <div class="container">
        <h2>Supported Props</h2>
        <p class="section-intro">
          TKA notation works across all major flow arts props
        </p>
        <div class="props-grid">
          {#each props as prop}
            <div class="prop-card">
              <i class="fas {prop.icon}" aria-hidden="true"></i>
              <span>{prop.name}</span>
            </div>
          {/each}
        </div>
        <p class="more-props">
          Plus: Buugeng, Swords, Triads, Double Stars, and many more
        </p>
      </div>
    </section>

    <section class="how-it-works">
      <div class="container">
        <h2>How Flow Arts Notation Works</h2>
        <div class="features-grid">
          {#each features as feature}
            <div class="feature-card">
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          {/each}
        </div>
      </div>
    </section>

    <section class="comparison">
      <div class="container">
        <h2>Why Notation Matters</h2>
        <div class="comparison-grid">
          <div class="comparison-card">
            <h3>Without Notation</h3>
            <ul>
              <li>Film a video for every sequence</li>
              <li>Describe moves verbally (often confusing)</li>
              <li>Lost choreography when you forget</li>
              <li>Language barriers limit sharing</li>
            </ul>
          </div>
          <div class="comparison-card highlight">
            <h3>With TKA Notation</h3>
            <ul>
              <li>Write sequences in seconds</li>
              <li>Universal visual language</li>
              <li>Permanent documentation</li>
              <li>Share across any language</li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <section class="faq">
      <div class="container">
        <h2>Frequently Asked Questions</h2>
        <div class="faq-list">
          {#each faqs as faq}
            <details class="faq-item">
              <summary>{faq.question}</summary>
              <p>{faq.answer}</p>
            </details>
          {/each}
        </div>
      </div>
    </section>

    <section class="cta">
      <div class="container">
        <h2>Start Using Flow Arts Notation</h2>
        <p>
          TKA Scribe is a free app for creating, animating, and sharing flow
          arts sequences using TKA notation.
        </p>
        <a href="https://tkascribe.com" class="cta-button">
          Try TKA Scribe Free
        </a>
      </div>
    </section>
  </main>
</div>

<style>
  .notation-page {
    --primary: #6366f1;
    --primary-light: #818cf8;
    --bg-dark: #0a0a0f;
    --bg-card: rgba(255, 255, 255, 0.03);
    --text: #ffffff;
    --text-muted: rgba(255, 255, 255, 0.6);
    --border: rgba(255, 255, 255, 0.1);

    font-family: system-ui, -apple-system, sans-serif;
    background: var(--bg-dark);
    color: var(--text);
    line-height: 1.6;
    min-height: 100vh;
  }

  .container {
    max-width: 1000px;
    margin: 0 auto;
    padding: 0 24px;
  }

  /* Hero */
  .hero {
    padding: 120px 24px 80px;
    text-align: center;
    background: linear-gradient(
      180deg,
      rgba(99, 102, 241, 0.1) 0%,
      transparent 100%
    );
  }

  h1 {
    font-size: clamp(2.5rem, 6vw, 4rem);
    font-weight: 700;
    margin-bottom: 1rem;
    line-height: 1.1;
  }

  .subtitle {
    font-size: 1.25rem;
    color: var(--text-muted);
    max-width: 600px;
    margin: 0 auto 2rem;
  }

  .cta-button {
    display: inline-block;
    background: var(--primary);
    color: white;
    padding: 16px 32px;
    border-radius: 12px;
    text-decoration: none;
    font-weight: 600;
    font-size: 1.125rem;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .cta-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(99, 102, 241, 0.3);
  }

  /* Sections */
  section {
    padding: 80px 24px;
  }

  section:nth-child(even) {
    background: rgba(255, 255, 255, 0.02);
  }

  h2 {
    font-size: clamp(1.75rem, 4vw, 2.5rem);
    margin-bottom: 1.5rem;
    text-align: center;
  }

  .section-intro {
    text-align: center;
    color: var(--text-muted);
    margin-bottom: 2rem;
  }

  /* Intro */
  .intro p {
    font-size: 1.125rem;
    max-width: 800px;
    margin: 0 auto 1.5rem;
  }

  /* Props */
  .props-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 16px;
    margin-bottom: 1.5rem;
  }

  .prop-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 24px 16px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .prop-card i {
    font-size: 2rem;
    color: var(--primary-light);
  }

  .more-props {
    text-align: center;
    color: var(--text-muted);
    font-size: 0.875rem;
  }

  /* Features */
  .features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 24px;
  }

  .feature-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 28px;
  }

  .feature-card h3 {
    font-size: 1.125rem;
    margin-bottom: 12px;
    color: var(--primary-light);
  }

  .feature-card p {
    color: var(--text-muted);
    font-size: 0.9375rem;
  }

  /* Comparison */
  .comparison-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 24px;
  }

  .comparison-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 28px;
  }

  .comparison-card.highlight {
    border-color: var(--primary);
    background: rgba(99, 102, 241, 0.1);
  }

  .comparison-card h3 {
    font-size: 1.125rem;
    margin-bottom: 16px;
  }

  .comparison-card ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .comparison-card li {
    padding: 8px 0;
    color: var(--text-muted);
    border-bottom: 1px solid var(--border);
  }

  .comparison-card li:last-child {
    border-bottom: none;
  }

  .comparison-card.highlight li {
    color: var(--text);
  }

  /* FAQ */
  .faq-list {
    max-width: 800px;
    margin: 0 auto;
  }

  .faq-item {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    margin-bottom: 12px;
    overflow: hidden;
  }

  .faq-item summary {
    padding: 20px 24px;
    cursor: pointer;
    font-weight: 500;
    list-style: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .faq-item summary::-webkit-details-marker {
    display: none;
  }

  .faq-item summary::after {
    content: "+";
    font-size: 1.5rem;
    color: var(--primary-light);
  }

  .faq-item[open] summary::after {
    content: "-";
  }

  .faq-item p {
    padding: 0 24px 20px;
    color: var(--text-muted);
    margin: 0;
  }

  /* CTA Section */
  .cta {
    text-align: center;
    background: linear-gradient(
      180deg,
      transparent 0%,
      rgba(99, 102, 241, 0.1) 100%
    );
  }

  .cta p {
    color: var(--text-muted);
    margin-bottom: 2rem;
    font-size: 1.125rem;
  }

  @media (max-width: 768px) {
    .hero {
      padding: 80px 24px 60px;
    }

    section {
      padding: 60px 24px;
    }

    .props-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
</style>
