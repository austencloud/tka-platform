<script lang="ts">
  import Seo from "$lib/shared/components/Seo.svelte";
  import PositionTrioGrid from "$lib/shared/landing/components/PositionTrioGrid.svelte";
  import "$lib/shared/landing/styles/public-editorial.css";

  const TITLE = "About The Kinetic Alphabet";
  const DESCRIPTION =
    "The Kinetic Alphabet (TKA) is a notation system for flow arts. Learn what TKA is, how it works, and why it exists.";
  const URL = "https://tkaflowarts.com/about";
  const PERSON_ID = `${URL}#austen-cloud`;

  const pageJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "AboutPage",
        "@id": `${URL}#about-page`,
        name: TITLE,
        url: URL,
        description: DESCRIPTION,
        inLanguage: "en-US",
        mainEntity: { "@id": "https://tkaflowarts.com/#tka" },
        isPartOf: { "@id": "https://tkaflowarts.com/#website" },
      },
      {
        "@type": "Thing",
        "@id": "https://tkaflowarts.com/#tka",
        name: "The Kinetic Alphabet",
        alternateName: "TKA",
        description:
          "A pictographic notation system for flow arts choreography.",
      },
      {
        "@type": "Person",
        "@id": PERSON_ID,
        name: "Austen Cloud",
        url: `${URL}#austen-cloud`,
        award: "2024–25 Seed Fund grant recipient for The Kinetic Alphabet",
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${URL}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: "https://tkaflowarts.com/",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "About",
            item: URL,
          },
        ],
      },
    ],
  }).replace(/</g, "\\u003c");

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

<Seo
  title={TITLE}
  description={DESCRIPTION}
  canonical={URL}
  ogType="article"
  ogImageAlt="The Kinetic Alphabet pictographs"
>
  {@html `<script type="application/ld+json">${pageJsonLd}</script>`}
</Seo>

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
          <PositionTrioGrid />
          <p>
            Want the full breakdown, with the positions rendered live? Read the
            <a href="/notation">notation page</a>.
          </p>
        {/if}
      </div>
    </section>
  {/each}

  <section
    id="austen-cloud"
    class="editorial-section"
    style="--accent: #8b5cf6"
  >
    <span class="section-kicker">Creator</span>
    <h2 class="section-title">Built by Austen Cloud</h2>
    <div class="prose">
      <p>
        The Kinetic Alphabet and
        <a href="/composer">Flow Arts Composer</a> are the work of Austen Cloud. Austen
        Cloud received a 2024–25 Seed Fund grant for The Kinetic Alphabet.
      </p>
      <p>
        The history behind the notation and its software is documented on this
        site. Corrections can be sent to
        <a href="mailto:support@tkaflowarts.com">support@tkaflowarts.com</a>.
      </p>
    </div>
    <div class="resource-row">
      <a
        href="https://fundtheflowarts.org/announcing-2024-25-seed-fund-grant-recipients/"
        class="resource-chip"
        rel="noopener noreferrer">See the Seed Fund announcement</a
      >
      <a href="/roots/software" class="resource-chip"
        >Read the software history</a
      >
    </div>
  </section>

  <!-- CTA. The FAQ moved to its own page (/faq, in the header's Learn menu);
         the pointer below keeps the path discoverable from here. -->
  <div class="cta-card">
    <h3>Ready to create?</h3>
    <p>
      Flow Arts Composer is free to use. No download required. Still have
      questions? The <a href="/faq" class="faq-link">FAQ</a> covers the common ones.
    </p>
    <a href="/create" class="cta-button" data-sveltekit-reload>
      <span>Open Flow Arts Composer</span>
      <i class="fas fa-arrow-right" aria-hidden="true"></i>
    </a>
  </div>
  <p class="creator-credit">Created by Austen Cloud • 2022–present</p>
</div>

<style>
  /* In-sentence FAQ pointer inside the CTA card: same treatment as .prose
     links (public-editorial.css), which don't reach inside .cta-card. */
  .cta-card .faq-link {
    color: oklch(0.8 0.12 275);
    text-decoration: none;
    border-bottom: 1px solid oklch(0.8 0.12 275 / 0.35);
    transition:
      border-color 160ms ease,
      color 160ms ease;
  }
  .cta-card .faq-link:hover {
    color: oklch(0.9 0.06 275);
    border-bottom-color: oklch(0.8 0.12 275 / 0.85);
  }
</style>
