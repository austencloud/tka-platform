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
    <p class="page-subtitle">Can The Kinetic Alphabet write poi?</p>
  </header>

  <section class="editorial-section" style="--accent: #22c55e">
    <div class="prose">
      <p>Some of it.</p>
      <p>
        The Kinetic Alphabet was built to take advantage of what static
        dual-wielded props can do: hold any orientation for as long as you want,
        move to any location in any orientation, reverse on a dime, all without
        owing anything to momentum. A poi head is the opposite case. It hangs
        from a tether, its motion is continuous, and it answers to swing and
        gravity as much as to your hand. So the alphabet can generate lots and
        lots of patterns, and poi can perform some of them, and only when the
        pattern's rotational value stays relatively consistent, because momentum
        needs continuity. Holds, hard reversals, and abrupt speed changes are
        outside what a tethered head can do. That makes The Kinetic Alphabet a
        generator poi spinners can draw from rather than an ideal system for
        describing poi patterns, and this site won't pretend otherwise.
      </p>
      <p>
        The frame of reference splits the same way, and it's worth a moment
        because it explains why the two worlds notate differently at all. TKA is
        a radial system: every orientation is measured from the prop to the
        performer's center point, not relative to the ground. Poi tradition grew
        up in gravity's frame. VTG, the Vulcan Tech Gospel, anchors its
        classifications to the downbeat at the bottom of the circle, a ground
        reference through and through, which is exactly right for a prop that
        swings. Neither frame is wrong. They're built for different physics.
      </p>
      <p>
        And the two systems are family, not rivals. TKA is built on VTG, created
        by Noel Yee and spinners at the Vulcan Lofts in Oakland, and VTG's four
        timing and direction categories are fully encoded in TKA's Type 1
        letters. If you already think in split-same and tog-opposite, you
        already read part of this alphabet. If you spin poi and want notation
        that was born for your prop, VTG is that system, and TKA honors it
        rather than replacing it. The full lineage, with sources, lives on the <a
          href="/notation">notation page</a
        >.
      </p>
      <p>
        A Poi Lab module is planned for Flow Arts Composer to identify the
        poi-legal subset of the alphabet, meaning which sequences a
        momentum-based prop can actually perform. Planned, not built, and it
        will be presented as working only when it is. In the meantime the <a
          href="/guide">guide</a
        >, the
        <a href="/glossary">Kinetic Atlas</a>, and the
        <a href="/notation">notation overview</a> all read fine through a poi spinner's
        eyes, and the momentum-friendly slice of what you build in the composer will
        be spinnable.
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
