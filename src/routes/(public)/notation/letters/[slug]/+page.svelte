<script lang="ts">
  import EditorialNav from "$lib/shared/landing/components/EditorialNav.svelte";
  import { LETTER_IMAGE_SIZE } from "$lib/shared/seo/notation-letters";
  import "$lib/shared/landing/styles/public-editorial.css";

  let { data } = $props();
  const seo = $derived(data.seo);
  const abs = (p: string) => `${data.domain}${p}`;

  const imageObjectLd = $derived(
    JSON.stringify({
      "@context": "https://schema.org",
      "@type": "ImageObject",
      contentUrl: abs(seo.images.webp),
      thumbnailUrl: abs(seo.images.webpSmall),
      name: `Kinetic Alphabet letter ${seo.letter} pictograph`,
      caption: seo.caption,
      description: seo.description,
      width: LETTER_IMAGE_SIZE,
      height: LETTER_IMAGE_SIZE,
      representativeOfPage: true,
      isPartOf: abs("/notation/letters"),
      creditText: "The Kinetic Alphabet",
      author: { "@type": "Person", name: "Austen Cloud", url: abs("/about") },
      license: abs("/about"),
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
        { "@type": "ListItem", position: 4, name: `Letter ${seo.letter}`, item: abs(seo.href) },
      ],
    }),
  );
</script>

<svelte:head>
  <title>{seo.title}</title>
  <meta name="description" content={seo.description} />
  <link rel="canonical" href={abs(seo.href)} />

  <meta property="og:type" content="article" />
  <meta property="og:url" content={abs(seo.href)} />
  <meta property="og:title" content={seo.title} />
  <meta property="og:description" content={seo.description} />
  <meta property="og:image" content={abs(seo.images.webp)} />
  <meta property="og:image:alt" content={seo.alt} />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={seo.title} />
  <meta name="twitter:description" content={seo.description} />
  <meta name="twitter:image" content={abs(seo.images.webp)} />

  {@html `<script type="application/ld+json">${imageObjectLd}</` + `script>`}
  {@html `<script type="application/ld+json">${breadcrumbLd}</` + `script>`}
</svelte:head>

<EditorialNav />

<div class="editorial">
  <nav class="crumbs" aria-label="Breadcrumb">
    <a href="/notation">Notation</a>
    <span aria-hidden="true">›</span>
    <a href="/notation/letters">Letters</a>
    <span aria-hidden="true">›</span>
    <span aria-current="page">{seo.letter}</span>
  </nav>

  <header class="editorial-header">
    <h1 class="page-title">Letter {seo.letter}</h1>
    <p class="page-subtitle">{seo.typeName} · {seo.typeLabel.replace("Type", "Type ")}</p>
  </header>

  <figure class="pictograph-figure">
    <div class="pictograph-frame">
      <picture>
        <source srcset={seo.images.webp} type="image/webp" />
        <img
          src={seo.images.png}
          alt={seo.alt}
          width={LETTER_IMAGE_SIZE}
          height={LETTER_IMAGE_SIZE}
          loading="eager"
          decoding="async"
        />
      </picture>
    </div>
    <figcaption>{seo.caption}</figcaption>
  </figure>

  <section class="editorial-section" style="--accent: #22c55e">
    <div class="prose">
      <p>
        <strong>Letter {seo.letter}</strong> is a
        <strong>{seo.typeName}</strong> letter in the Kinetic Alphabet, the flow arts
        notation system for writing down prop choreography. {seo.typeBlurb}
      </p>
      {#if seo.motion}
        <p>
          In its representative form, the pictograph reads: {seo.motion} This is the
          exact motion the pictograph above encodes for two staves.
        </p>
      {/if}
      <p>
        You can build sequences from letter {seo.letter} and every other letter in the
        <a href="/composer">Flow Arts Composer</a>, or learn how the notation works on the
        <a href="/notation">notation overview</a>.
      </p>
    </div>
  </section>

  <nav class="letter-nav" aria-label="Adjacent letters">
    {#if data.prevSlug}
      <a class="letter-nav-link" href={`/notation/letters/${data.prevSlug}`}>← Previous</a>
    {:else}
      <span></span>
    {/if}
    <a class="letter-nav-link" href="/notation/letters">All letters</a>
    {#if data.nextSlug}
      <a class="letter-nav-link" href={`/notation/letters/${data.nextSlug}`}>Next →</a>
    {:else}
      <span></span>
    {/if}
  </nav>
</div>

<style>
  .crumbs {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    font-size: 0.9rem;
    opacity: 0.75;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }
  .crumbs a {
    color: inherit;
    text-decoration: none;
  }
  .crumbs a:hover {
    text-decoration: underline;
  }

  .pictograph-figure {
    margin: 1.5rem 0 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }
  /* Fixed-aspect frame reserves the box before load — no layout shift. */
  .pictograph-frame {
    width: min(440px, 82vw);
    aspect-ratio: 1 / 1;
    background: color-mix(in srgb, currentColor 4%, transparent);
    border-radius: 16px;
    overflow: hidden;
    display: grid;
    place-items: center;
  }
  .pictograph-frame :global(picture),
  .pictograph-frame img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  figcaption {
    font-size: 0.95rem;
    opacity: 0.8;
    text-align: center;
  }

  .letter-nav {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 1rem;
    margin: 2.5rem 0 1rem;
  }
  .letter-nav-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 1.1rem;
    border-radius: 999px;
    background: color-mix(in srgb, currentColor 8%, transparent);
    color: inherit;
    text-decoration: none;
    font-weight: 600;
    font-size: 0.95rem;
  }
  .letter-nav-link:hover {
    background: color-mix(in srgb, currentColor 14%, transparent);
  }
  .letter-nav a:last-child {
    justify-self: end;
  }
  .letter-nav a:only-child {
    justify-self: center;
  }
</style>
