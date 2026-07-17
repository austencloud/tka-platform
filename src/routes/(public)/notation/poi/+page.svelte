<script lang="ts">
  import Seo from "$lib/shared/components/Seo.svelte";
  import "$lib/shared/landing/styles/public-editorial.css";

  const TITLE = "Poi Notation | Can The Kinetic Alphabet Write Poi?";
  const DESCRIPTION =
    "Can The Kinetic Alphabet notate poi? Partially. Poi rely on momentum, so they reach the subset of patterns whose rotation stays consistent. Here is where the line is, and why VTG is the poi-native lineage.";
  const URL = "https://tkaflowarts.com/notation/poi";
</script>

<Seo title={TITLE} description={DESCRIPTION} canonical={URL} ogType="article">
  {@html `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "Poi Notation",
    "url": "${URL}",
    "description": "${DESCRIPTION}",
    "inLanguage": "en-US",
    "author": { "@type": "Person", "name": "Austen Cloud", "url": "https://tkaflowarts.com/about" },
    "publisher": { "@type": "Organization", "name": "The Kinetic Alphabet", "url": "https://tkaflowarts.com/" }
  }
  </script>`}
  {@html `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://tkaflowarts.com/" },
      { "@type": "ListItem", "position": 2, "name": "Notation", "item": "https://tkaflowarts.com/notation" },
      { "@type": "ListItem", "position": 3, "name": "Poi", "item": "${URL}" }
    ]
  }
  </script>`}
</Seo>

<div class="editorial">
  <a class="back-link" href="/notation">← Flow Arts Notation</a>

  <header class="editorial-header">
    <h1 class="page-title">Poi Notation</h1>
    <p class="page-subtitle">The honest answer: partially</p>
  </header>

  <section class="editorial-section" style="--accent: #22c55e">
    <h2 class="section-title">Can TKA Write Poi?</h2>
    <div class="prose">
      <p>
        Some of it. The Kinetic Alphabet was built to take advantage of the unique
        properties of static dual-wielded props: they aren't affected by gravity, can be
        held at any orientation, and can move to any other location in any orientation
        freely, with no reliance on momentum. Poi are the opposite case. The head hangs
        from a tether, and its motion is continuous and momentum-driven.
      </p>
      <p>
        The line sits at momentum. The alphabet can generate lots and lots of patterns.
        Only some of them can be achieved with poi, and only when the pattern's rotational
        value stays relatively consistent, because momentum needs continuity. Patterns
        that hold an orientation, reverse on a dime, or change rotation speed abruptly are
        outside what a tethered head can do. That makes The Kinetic Alphabet a generator
        poi spinners can draw from, not an ideal system for describing poi patterns, and
        this site won't pretend otherwise.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #14b8a6">
    <h2 class="section-title">Two Reference Systems</h2>
    <div class="prose">
      <p>
        The deeper difference is the frame of reference. TKA is a radial system: every
        orientation is measured from the prop to the performer's center point, not
        relative to the ground. Poi tradition grew up in gravity's frame instead. VTG, the
        notation framework poi spinners already know, anchors its classifications to the
        downbeat, the bottom of the circle, which is a ground reference through and
        through.
      </p>
      <p>
        Neither frame is wrong. They're built for different physics: center-referenced
        orientation suits a prop you can freeze anywhere; a ground-referenced downbeat
        suits a prop that swings.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #ec4899">
    <h2 class="section-title">The Poi-Native Lineage</h2>
    <div class="prose">
      <p>
        TKA is built on VTG, the Vulcan Tech Gospel, created by Noel Yee and spinners at
        the Vulcan Lofts in Oakland. VTG's four timing and direction categories are fully
        encoded in TKA's Type 1 letters, so if you already think in split-same and
        tog-opposite, you already read part of this alphabet. The full lineage, with
        sources, lives on the <a href="/roots">roots page</a>.
      </p>
      <p>
        If you spin poi and want notation that was born for your prop, VTG is that system,
        and TKA honors it rather than replacing it.
      </p>
    </div>
  </section>

  <section class="editorial-section" style="--accent: #f59e0b">
    <h2 class="section-title">Poi Lab Is Planned</h2>
    <div class="prose">
      <p>
        A Poi Lab module is planned for Flow Arts Composer to identify the poi-legal
        subset of the alphabet: which sequences a momentum-based prop can actually
        perform. It is planned, not built, and it will be presented as working only when
        it is.
      </p>
      <p>
        In the meantime, the <a href="/guide">guide</a>, the
        <a href="/glossary">glossary</a>, and the <a href="/notation">notation
        overview</a> are all readable through a poi spinner's eyes, and the
        momentum-friendly slice of what you build in the composer will be spinnable.
      </p>
    </div>
  </section>

  <div class="cta-card">
    <h3>Curious what the full system feels like?</h3>
    <p>Flow Arts Composer is free to use. No download required.</p>
    <a href="/create" class="cta-button" data-sveltekit-reload>
      <span>Open Flow Arts Composer</span>
      <i class="fas fa-arrow-right" aria-hidden="true"></i>
    </a>
  </div>
</div>
