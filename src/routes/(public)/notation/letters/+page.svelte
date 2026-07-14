<script lang="ts">
  import EditorialNav from "$lib/shared/landing/components/EditorialNav.svelte";
  import "$lib/shared/landing/styles/public-editorial.css";

  let { data } = $props();
  const abs = (p: string) => `${data.domain}${p}`;

  const DESCRIPTION =
    "Every letter of the Kinetic Alphabet as a pictograph — the flow arts notation system for writing down staff, club, and prop choreography. Browse all 47 letters by type.";

  // The letters arrive in canonical order (grouped by type). Split into type
  // sections by walking the list and starting a new group when the type changes.
  type Letter = (typeof data.letters)[number];
  const sections = $derived(
    data.letters.reduce<{ type: string; typeName: string; letters: Letter[] }[]>(
      (acc, l) => {
        const last = acc[acc.length - 1];
        if (!last || last.type !== l.type) {
          acc.push({ type: l.type, typeName: l.typeName, letters: [l] });
        } else {
          last.letters.push(l);
        }
        return acc;
      },
      [],
    ),
  );

  const itemListLd = $derived(
    JSON.stringify({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Kinetic Alphabet Letters",
      description: DESCRIPTION,
      url: abs("/notation/letters"),
      hasPart: {
        "@type": "ItemList",
        numberOfItems: data.letters.length,
        itemListElement: data.letters.map((l, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: abs(l.href),
          name: `Letter ${l.letter} — ${l.typeName}`,
          image: abs(l.images.webp),
        })),
      },
    }),
  );

  const breadcrumbLd = $derived(
    JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: abs("/") },
        { "@type": "ListItem", position: 2, name: "Notation", item: abs("/notation") },
        { "@type": "ListItem", position: 3, name: "Letters", item: abs("/notation/letters") },
      ],
    }),
  );
</script>

<svelte:head>
  <title>Kinetic Alphabet Letters: All 47 Flow Arts Notation Pictographs</title>
  <meta name="description" content={DESCRIPTION} />
  <link rel="canonical" href="https://tkaflowarts.com/notation/letters" />

  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://tkaflowarts.com/notation/letters" />
  <meta property="og:title" content="Kinetic Alphabet Letters: All 47 Notation Pictographs" />
  <meta property="og:description" content={DESCRIPTION} />
  <meta property="og:image" content="https://tkaflowarts.com/branding/og-image.png" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Kinetic Alphabet Letters" />
  <meta name="twitter:description" content={DESCRIPTION} />
  <meta name="twitter:image" content="https://tkaflowarts.com/branding/og-image.png" />

  {@html `<script type="application/ld+json">${itemListLd}</` + `script>`}
  {@html `<script type="application/ld+json">${breadcrumbLd}</` + `script>`}
</svelte:head>

<EditorialNav />

<div class="editorial">
  <header class="editorial-header">
    <h1 class="page-title">The Kinetic Alphabet Letters</h1>
    <p class="page-subtitle">All 47 flow arts notation pictographs</p>
  </header>

  <section class="editorial-section" style="--accent: #22c55e">
    <div class="prose">
      <p>
        Each letter of the Kinetic Alphabet is a pictograph: a single picture that
        records what both hands do with a pair of staves. The letters are grouped into
        six types by how the hands move. Pick any letter to see its pictograph and the
        exact motion it encodes, or open the
        <a href="/composer">Flow Arts Composer</a> to build sequences from them.
      </p>
    </div>
  </section>

  {#each sections as section (section.type)}
    <section class="editorial-section letter-section">
      <h2 class="section-title">{section.typeName}</h2>
      <ul class="letter-grid">
        {#each section.letters as l (l.slug)}
          <li>
            <a class="letter-card" href={l.href} aria-label={`Letter ${l.letter} — ${l.typeName}`}>
              <span class="letter-thumb">
                <picture>
                  <source srcset={l.images.webpSmall} type="image/webp" />
                  <img src={l.images.png} alt={l.alt} width="400" height="400" loading="lazy" decoding="async" />
                </picture>
              </span>
              <span class="letter-glyph">{l.letter}</span>
            </a>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
</div>

<style>
  .letter-section {
    margin-top: 2rem;
  }
  .letter-grid {
    list-style: none;
    padding: 0;
    margin: 1rem 0 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: 0.75rem;
  }
  .letter-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    padding: 0.6rem 0.4rem 0.5rem;
    border-radius: 14px;
    background: color-mix(in srgb, currentColor 5%, transparent);
    color: inherit;
    text-decoration: none;
    min-height: 44px;
  }
  .letter-card:hover {
    background: color-mix(in srgb, currentColor 12%, transparent);
  }
  /* Fixed square thumb reserves the box before the image loads. */
  .letter-thumb {
    width: 100%;
    aspect-ratio: 1 / 1;
    display: grid;
    place-items: center;
  }
  .letter-thumb :global(picture),
  .letter-thumb img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .letter-glyph {
    font-weight: 700;
    font-size: 1rem;
    line-height: 1;
  }
</style>
