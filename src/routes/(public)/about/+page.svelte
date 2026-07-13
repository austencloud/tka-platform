<script lang="ts">
  import FaqAccordion from "$lib/shared/landing/components/FaqAccordion.svelte";
  import "$lib/shared/landing/styles/public-editorial.css";

  const sections = [
    {
      id: "what",
      title: "What Is The Kinetic Alphabet",
      color: "#22c55e",
      content: [
        "The Kinetic Alphabet (TKA) is a notation system for flow arts. Other people have documented patterns before. The Kinetic Alphabet takes it further.",
        "Right now, flow arts knowledge lives mostly in videos scattered across the internet. Sheet music tells musicians what to play. Scripts tell actors what to say. The Kinetic Alphabet does that for prop movement: write it down, read it back, reproduce it later.",
      ],
    },
    {
      id: "notation",
      title: "How It Works",
      color: "#14b8a6",
      content: [
        "Each step of movement gets a pictograph. It shows where your hands are and how they move on a grid. You can read it without memorizing terminology. Positions are simple: hands across from each other, at the same point, or at a right angle.",
        "Pictographs also capture motion type, direction, and rotation. Letters are optional but handy when you need to talk about a specific step during rehearsal.",
      ],
    },
    {
      id: "why",
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
      title: "The Vision",
      color: "#06b6d4",
      content: [
        "If you teach, you can hand someone a pictograph instead of demonstrating the same thing over and over. Send notated sequences to students anywhere. No shared language required.",
        "Once the system clicks, you start thinking in it. Make your own sequences. The letter system shows you what you've explored and what you haven't, so there's always something new to try.",
        "The long-term goal is better collaboration and more ambitious group performances.",
      ],
    },
  ];
</script>

<svelte:head>
  <title>About The Kinetic Alphabet</title>
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

  <!-- FAQPage JSON-LD is emitted by <FaqAccordion emitSchema> below, generated
       from the canonical FAQ_ITEMS so schema and visible answers never drift. -->
</svelte:head>

<div class="editorial">
    <header class="editorial-header">
      <h1 class="page-title">The Kinetic Alphabet</h1>
      <p class="page-subtitle">A notation system for flow arts</p>
    </header>

    {#each sections as section}
      <section class="editorial-section" style="--accent: {section.color}">
        <h2 class="section-title">{section.title}</h2>

        <div class="prose">
          {#each section.content as paragraph}
            <p>{paragraph}</p>
          {/each}
          {#if section.id === "notation"}
            <p>
              Want the full breakdown, with the positions rendered live? Read the
              <a href="/notation">notation page</a>.
            </p>
          {/if}
        </div>
      </section>
    {/each}

    <!-- Frequently Asked Questions (visible FAQ for search + AI overviews).
         Visible answers AND the FAQPage JSON-LD both come from FAQ_ITEMS. -->
    <FaqAccordion emitSchema variant="card" />

    <!-- CTA -->
    <div class="cta-card">
      <h3>Ready to create?</h3>
      <p>Flow Arts Composer is free to use. No download required.</p>
      <a href="/create" class="cta-button" data-sveltekit-reload>
        <span>Open Flow Arts Composer</span>
        <i class="fas fa-arrow-right" aria-hidden="true"></i>
      </a>
    </div>
    <p class="creator-credit">Created by Austen Cloud • 2022–present</p>
  </div>
