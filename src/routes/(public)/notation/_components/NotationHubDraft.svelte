<!--
  NotationHubDraft — the /notation hub as it stood when it was taken down on
  2026-07-26 for a rebuild. Only reachable in dev; production shows
  UnderConstruction (see ../+page.svelte).

  Known problems it is being rebuilt to fix: full-measure prose lines with no
  compositional rhythm, oversized static figures, the QFT explainer overreaching
  what the page can honestly teach, VTG reduced to a 2x2, and TKA represented by
  a single pictograph. Do not extend this file — replace it.
-->
<script lang="ts">
  import LazyMount from "$lib/shared/components/LazyMount.svelte";
  import SequenceHeroDemo from "$lib/shared/landing/components/SequenceHeroDemo.svelte";
  import { activateWhenNear } from "$lib/actions/activate-when-near";
  import demoJson from "$lib/shared/landing/data/demo-sequence.json";
  import { NOTATION_LOOP_TEASER_SEQUENCE } from "$lib/shared/loop-explorer/domain/notation-loop-teaser";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import "$lib/shared/landing/styles/public-editorial.css";

  const heroDemoSequence = demoJson as unknown as SequenceData;
  // Same verified rotated/quartered example the /notation/loops hero uses —
  // a real detector-checked LOOP, not a mockup.
  const loopTeaserSequence = NOTATION_LOOP_TEASER_SEQUENCE;
  let shapeMatrixActive = $state(false);
  const activateShapeMatrixWhenNear = (node: HTMLElement) =>
    activateWhenNear(node, {
      activate: () => (shapeMatrixActive = true),
      rootMargin: "300px",
      deferUntilIdle: true,
    });

  // Every source verified live during the 2026-07-17 research pass and again in
  // the 2026-07-18 audit. Primary pages, not generic bios, so each link
  // substantiates the claim next to it.
  const src = {
    vtgNoelYee: "https://noelyee.com/instruction/vulcan-tech-gospel",
    vtgDrex:
      "https://drexfactor.com/weirdscience/2015/11/25/vulcan_tech_gospel_vtg_explained",
    qftDrex:
      "https://www.drexfactor.com/weirdscience/2011/05/18/beginners_guide_poi_qft_notation",
    lorqMatrix:
      "https://sirlorq.wordpress.com/2014/07/16/144-shape-matrix-even-petaled-flowers-rework/",
    lorq324: "https://sirlorq.wordpress.com/324-patterns/",
    poiNotation: "https://github.com/tiffanyfong/PoiNotation",
    siteswapJugglingLab: "https://jugglinglab.org/html/ssnotation.html",
    siteswapHistory:
      "https://www.jonglage.net/theorie/notation/siteswap-avancee/refs/Allen%20Knutson%20-%20Siteswap%20FAQ.pdf",
  };

  const DESCRIPTION =
    "The Kinetic Alphabet is a pictographic system that uses letters and pictures to represent flow arts sequences that can be read on a page like music notation.";
</script>

<svelte:head>
  <title
    >Flow Arts Notation: The Kinetic Alphabet | Write Down Prop Choreography</title
  >
  <meta name="description" content={DESCRIPTION} />
  <link rel="canonical" href="https://tkaflowarts.com/notation" />

  <meta property="og:type" content="article" />
  <meta property="og:url" content="https://tkaflowarts.com/notation" />
  <meta
    property="og:title"
    content="Flow Arts Notation: The Kinetic Alphabet"
  />
  <meta property="og:description" content={DESCRIPTION} />
  <meta
    property="og:image"
    content="https://tkaflowarts.com/branding/og-image.png"
  />

  <meta name="twitter:card" content="summary_large_image" />
  <meta
    name="twitter:title"
    content="Flow Arts Notation: The Kinetic Alphabet"
  />
  <meta name="twitter:description" content={DESCRIPTION} />
  <meta
    name="twitter:image"
    content="https://tkaflowarts.com/branding/og-image.png"
  />

  {@html `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "Flow Arts Notation: The Kinetic Alphabet",
    "url": "https://tkaflowarts.com/notation",
    "description": "${DESCRIPTION}",
    "inLanguage": "en-US",
    "author": { "@type": "Person", "name": "Austen Cloud", "url": "https://tkaflowarts.com/about" },
    "publisher": {
      "@type": "Organization",
      "name": "The Kinetic Alphabet",
      "url": "https://tkaflowarts.com/"
    },
    "about": {
      "@type": "Thing",
      "name": "The Kinetic Alphabet",
      "alternateName": ["TKA", "Flow Arts Notation"]
    }
  }
  </script>`}

  {@html `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://tkaflowarts.com/" },
      { "@type": "ListItem", "position": 2, "name": "Notation", "item": "https://tkaflowarts.com/notation" }
    ]
  }
  </script>`}
</svelte:head>

<div class="editorial">
  <header class="editorial-header" style:view-transition-name="launchpad-notation">
    <h1 class="page-title">Flow Arts Notation</h1>
    <p class="page-subtitle">The family of systems for writing movement down</p>
  </header>

  <div class="lede">
    <p>
      Writing down what a body does with two spinning props is an old problem,
      and more than one craft has taken a run at it. Jugglers solved their side
      of it decades ago. Spinners have taken run after run at the rest.
    </p>
    <p>
      This page walks that family: how each system before The Kinetic Alphabet
      puts a move on paper, and where TKA sits among them.
    </p>
  </div>

  <!-- Rosetta row: three notation languages, each emphasizing different movement data. -->
  <section class="editorial-section" style="--accent: #a855f7">
    <span class="section-kicker">Three notation languages, three views</span>
    <h2 class="section-title">What each system puts on the page</h2>
    <div class="prose">
      <p>
        Each system here points at the same slippery target: where the props are
        and how they move. They disagree on what deserves ink. Put three of them
        next to each other and the disagreement is easy to see.
      </p>
    </div>

    <div class="breakout wide rosetta-band">
      <div class="rosetta">
        <!-- QFT: numbered circle. 8 at top, 1 to its right, clockwise (per DrexFactor). -->
        <figure class="rosetta-cell">
          <div class="rosetta-art">
            <svg
              viewBox="0 0 200 200"
              role="img"
              aria-label="A circle with eight numbered points: eight at the top, then one through seven clockwise, with an arrow drawn from point eight to point one."
            >
              <defs>
                <marker
                  id="qft-arrow"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M0 0 L10 5 L0 10 z" fill="currentColor" />
                </marker>
              </defs>
              <circle cx="100" cy="100" r="78" class="qft-ring" />
              <!-- 8 positions: 8 at top, clockwise through 1..7 -->
              <g class="qft-pt">
                <circle cx="100" cy="22" r="12" /><text x="100" y="26">8</text>
                <circle cx="155" cy="45" r="12" /><text x="155" y="49">1</text>
                <circle cx="178" cy="100" r="12" /><text x="178" y="104">2</text
                >
                <circle cx="155" cy="155" r="12" /><text x="155" y="159">3</text
                >
                <circle cx="100" cy="178" r="12" /><text x="100" y="182">4</text
                >
                <circle cx="45" cy="155" r="12" /><text x="45" y="159">5</text>
                <circle cx="22" cy="100" r="12" /><text x="22" y="104">6</text>
                <circle cx="45" cy="45" r="12" /><text x="45" y="49">7</text>
              </g>
              <!-- move 8 -> 1: from the top point across to the upper-right point -->
              <path
                class="qft-move"
                d="M113 26 Q140 26 147 39"
                fill="none"
                marker-end="url(#qft-arrow)"
              />
            </svg>
          </div>
          <figcaption>
            <strong>QFT</strong> numbers eight points around the circle, eight at
            the top. A move records where a prop starts and where it reaches, like
            eight to one.
          </figcaption>
        </figure>

        <!-- VTG: timing x direction 2x2 -->
        <figure class="rosetta-cell">
          <div class="rosetta-art">
            <div
              class="vtg-grid"
              role="img"
              aria-label="A two by two grid. Columns are same direction and opposite direction. Rows are split time and together time. The split, same cell is highlighted."
            >
              <span class="vtg-corner"></span>
              <span class="vtg-col">Same</span>
              <span class="vtg-col">Opp</span>
              <span class="vtg-row">Split</span>
              <span class="vtg-cell on">SS</span>
              <span class="vtg-cell">SO</span>
              <span class="vtg-row">Tog</span>
              <span class="vtg-cell">TS</span>
              <span class="vtg-cell">TO</span>
            </div>
          </div>
          <figcaption>
            <strong>VTG</strong> sorts a move by timing and direction. Hand paths
            traveling the same way, half a cycle apart, is a split-same move.
          </figcaption>
        </figure>

        <!-- TKA: real pictograph -->
        <figure class="rosetta-cell">
          <div class="rosetta-art">
            <img
              class="tka-picto"
              src="/notation/letters/kinetic-alphabet-letter-a.webp"
              width="950"
              height="950"
              alt="The Kinetic Alphabet pictograph for the letter A, showing both hands moving from alpha to alpha on the grid"
              loading="lazy"
            />
          </div>
          <figcaption>
            <strong>TKA</strong> draws the move. This is
            <a href="/notation/letters">the letter A</a>, a split-same move in
            VTG's terms, on a grid you read like sheet music.
          </figcaption>
        </figure>
      </div>
    </div>

    <div class="prose">
      <p>
        Two of those three say the same thing in different words. VTG's
        split-same and TKA's letter A both describe hand paths traveling the
        same direction, half a cycle out of phase. QFT is answering a different
        question: which of the eight points on the circle a prop passes through.
      </p>
      <p>The oldest piece of the puzzle came from off the field entirely.</p>
    </div>
  </section>

  <!-- Borrowed ideas: juggling (siteswap) + music. The off-field influences. -->
  <section class="editorial-section" style="--accent: #ec4899">
    <h2 class="section-title">A flow cut into beats, and a compact score</h2>
    <div class="prose">
      <p>
        Jugglers worked out siteswap in the early-to-mid 1980s, in more than one
        place at once: Paul Klimek's Quantum Juggling around 1981, a Caltech
        group around Bruce Tiemann and Bengt Magnusson by 1985, and a Cambridge
        group including Colin Wright. In vanilla siteswap, one value per beat
        schedules when that object is next thrown; some values mark a hold or an
        empty beat. A plain three-ball cascade is just repeating threes.
      </p>
    </div>
    <figure class="code-figure">
      <pre
        class="notation-line"
        aria-label="A siteswap pattern, five three one"><code
          >5 &nbsp;3 &nbsp;1</code
        ></pre>
      <figcaption>
        A valid three-ball pattern. High throw, medium throw, quick hand-across,
        then repeat. Ben Beever's Generalised Siteswap later added attributes
        like spin and orientation.
      </figcaption>
    </figure>
    <div class="prose">
      <p>
        Siteswap was built for juggling, so TKA treats it as an analogy rather
        than a spinning vocabulary. The useful shape of the idea is to cut a
        continuous flow into beats and give each beat a symbol. TKA keeps that
        structure and swaps the value for a picture, one pictograph each.
      </p>
      <p>
        Music is the other loan, older than any flow art. A written score stays
        compact. It pins down pitch and rhythm and marks cues like dynamics and
        tempo, while leaving the feel of a phrase to the player. And a short
        label saves breath: calling a movement "A" is quicker than describing
        it. TKA makes the same trade with its letters.
      </p>
      <div class="resource-row">
        <a
          href={src.siteswapJugglingLab}
          target="_blank"
          rel="noopener noreferrer"
          class="resource-chip"
        >
          <span>Siteswap notation, Juggling Lab</span>
          <i class="fas fa-external-link-alt ext" aria-hidden="true"></i>
        </a>
        <a
          href={src.siteswapHistory}
          target="_blank"
          rel="noopener noreferrer"
          class="resource-chip"
        >
          <span>Siteswap history, Allen Knutson FAQ</span>
          <i class="fas fa-external-link-alt ext" aria-hidden="true"></i>
        </a>
      </div>
    </div>
  </section>

  <!-- How spinners mapped it: VTG, QFT/Cushing, Lorq, PoiNotation. The long section. -->
  <section class="editorial-section" style="--accent: #f59e0b">
    <span class="section-kicker">How spinners mapped it</span>
    <h2 class="section-title">Four takes on the same problem</h2>
    <div class="prose">
      <p>
        Vulcan Tech Gospel came out of the Vulcan Lofts in Oakland, compiled by
        Noel Yee with the spinners there. It gave poi a shared vocabulary:
        together time against split time, same direction against opposite, where
        same and opposite describe the hand paths rather than the props. That
        pair of axes is the grid in the row above. The timing-and-direction
        quadrant shown above directly describes Type 1 dual-shifts such as A. It
        is one part of VTG's wider pattern and transition vocabulary.
      </p>
      <div class="resource-row">
        <a
          href={src.vtgNoelYee}
          target="_blank"
          rel="noopener noreferrer"
          class="resource-chip"
        >
          <span>Noel Yee on VTG</span>
          <i class="fas fa-external-link-alt ext" aria-hidden="true"></i>
        </a>
        <a
          href={src.vtgDrex}
          target="_blank"
          rel="noopener noreferrer"
          class="resource-chip"
        >
          <span>VTG explained, DrexFactor</span>
          <i class="fas fa-external-link-alt ext" aria-hidden="true"></i>
        </a>
      </div>
      <p>
        Charlie Cushing mapped position instead of relationship. His Quantized
        Field Theory, documented by DrexFactor, is the numbered circle above:
        eight points, eight at the top and one to its right, going clockwise. A
        move reads as an origin and a destination, plus the hand path's radius
        and direction. Cushing later dropped the same idea onto a three by three
        grid as 9-Square Theory. This records absolute position, while the small
        VTG quadrant above classifies timing and direction relationships.
      </p>
      <div class="resource-row">
        <a
          href={src.qftDrex}
          target="_blank"
          rel="noopener noreferrer"
          class="resource-chip"
        >
          <span>Beginner's guide to QFT, DrexFactor</span>
          <i class="fas fa-external-link-alt ext" aria-hidden="true"></i>
        </a>
      </div>
      <p>
        Lorq Nichols went combinatorial. His 144 Shape Matrix is a twelve by
        twelve table, twelve left-hand driving styles against twelve right-hand
        ones, the even-petaled prospin and antispin shapes across the 1:1, 1:3,
        and 1:5 ratios. Matched styles on the diagonal are basic shapes; the
        rest are hybrids. It sits alongside his other catalogs: the 324
        Patterns, counted a different way from arm paths and club shapes, and
        the Book of P.H.A.T., for Patterns, Hybrids, and Transitions, built with
        Brian Thompson, David Cantor, and Noel Yee. A paper chart, doing what a
        simulator does now: lay the space out so you can find what you have
        not tried.
      </p>
    </div>

    <figure class="matrix-figure lorq-figure">
      <img
        class="matrix-img"
        src="/notation/lorq-144-shape-matrix.webp"
        width="1400"
        height="1812"
        alt="Lorq Nichols' 144 Shape Matrix: a twelve by twelve grid of even-petaled flower shapes. Columns are twelve right-hand driving styles, rows are twelve left-hand styles, grouped by 1:1, 1:3, and 1:5 hand-to-prop ratios."
        loading="lazy"
      />
      <figcaption>
        Lorq Nichols' 144 Shape Matrix, charted in 2012: twelve right-hand
        driving styles across, twelve left-hand styles down, grouped by 1:1,
        1:3, and 1:5 hand-to-prop ratios. Diagram by
        <a href="https://sirlorq.com" target="_blank" rel="noopener noreferrer"
          >Lorq Nichols</a
        >.
      </figcaption>
    </figure>

    <div class="prose">
      <div class="resource-row">
        <a
          href={src.lorqMatrix}
          target="_blank"
          rel="noopener noreferrer"
          class="resource-chip"
        >
          <span>144 Shape Matrix, Sir Lorq</span>
          <i class="fas fa-external-link-alt ext" aria-hidden="true"></i>
        </a>
        <a
          href={src.lorq324}
          target="_blank"
          rel="noopener noreferrer"
          class="resource-chip"
        >
          <span>324 Patterns, Sir Lorq</span>
          <i class="fas fa-external-link-alt ext" aria-hidden="true"></i>
        </a>
      </div>
      <p>
        TKA can draw that same table live, one pictograph per cell, and every
        cell opens onto the moves that build it. The corner below is real:
        the 1:1 ratio, sixteen cells, running right now. The elemental lenses
        on the interactive matrix trace to Leonardo Icaza's four-element
        mapping of VTG timing and direction, taught on video by Ronan
        McLoughlin and extended with Sun and Moon by TKA.
      </p>
    </div>

    <div class="matrix-teaser-wrap">
      <div class="shape-matrix-teaser-slot" use:activateShapeMatrixWhenNear>
        <LazyMount
          loader={() =>
            import("$lib/shared/shape-matrix/components/ShapeMatrixTeaser.svelte")}
          active={shapeMatrixActive}
        >
          {#snippet placeholder()}
            <div class="shape-matrix-teaser-placeholder" aria-hidden="true"></div>
          {/snippet}
          {#snippet error(_error, retry)}
            <div class="shape-matrix-teaser-error" role="alert">
              <span>The shape matrix did not load.</span>
              <button type="button" onclick={retry}>Try again</button>
            </div>
          {/snippet}
        </LazyMount>
      </div>
      <a href="/notation/shape-matrix" class="cta-button matrix-teaser-cta">
        <span>Explore the full shape matrix</span>
        <i class="fas fa-arrow-right" aria-hidden="true"></i>
      </a>
    </div>

    <div class="prose">
      <p>
        In 2016 Tiffany Fong took the most literal swing at it. PoiNotation,
        written in Scala for a computer science course, treats a move as a set
        of properties and a sequence as those moves joined by operators.
        Describe a move, repeat it with a star, chain it with a tilde, and the
        code renders it for two poi simulators. Its public repository ends with
        that course release.
      </p>
    </div>
    <figure class="code-figure">
      <pre
        class="notation-line"
        aria-label="The documented PoiNotation input example: two move objects joined together, with the second repeated twice"><code
          >&#123;extended: true, rotations: 1, armSpin: cw, handleSpin: cw&#125;
          <span class="tok-op">~</span>
          &#123;extended: true, rotations: 2, armSpin: ccw, handleSpin: antispin&#125;
          <span class="tok-op">*</span> 2</code
        ></pre>
      <figcaption>
        The documented PoiNotation example from Tiffany Fong's repository: two
        moves joined with <code class="inline-tok">~</code>, with the second
        repeated using <code class="inline-tok">*</code>.
      </figcaption>
    </figure>
    <div class="prose">
      <div class="resource-row">
        <a
          href={src.poiNotation}
          target="_blank"
          rel="noopener noreferrer"
          class="resource-chip"
        >
          <span>PoiNotation on GitHub</span>
          <i class="fas fa-external-link-alt ext" aria-hidden="true"></i>
        </a>
      </div>
    </div>
  </section>

  <!-- LOOP algebra teaser: same live-demo-plus-CTA idiom as the Shape Matrix
       teaser above, pointing at its own destination page. -->
  <section class="editorial-section" style="--accent: #36c3ff">
    <span class="section-kicker">Sequences that come back around</span>
    <h2 class="section-title">The LOOP algebra</h2>
    <div class="prose">
      <p>
        A LOOP is a sequence built to return to where it started, under one of six
        transformations — mirror, flip, swap, invert, rewind, or rotate — alone or
        stacked together. The destination page walks the fixed-point theorem behind it
        and lets you build any verified combination live.
      </p>
    </div>
    {#if loopTeaserSequence}
      <SequenceHeroDemo sequence={loopTeaserSequence} note="a Rotated LOOP, live" />
    {/if}
    <div class="matrix-teaser-wrap">
      <a href="/notation/loops" class="cta-button matrix-teaser-cta">
        <span>Explore the LOOP algebra</span>
        <i class="fas fa-arrow-right" aria-hidden="true"></i>
      </a>
    </div>
  </section>

  <!-- CAP history teaser: the parallel discovery, with the recreated Yuta
       trace as its visual. Static image, no live demo — history page. -->
  <section class="editorial-section" style="--accent: #f472b6">
    <span class="section-kicker">The parallel discovery</span>
    <h2 class="section-title">CAPs came first, from the poi world</h2>
    <div class="section-duo">
      <div class="prose">
        <p>
          In 2009, poi spinners on the Home of Poi forums named the same craving
          from the other direction: Continuous Assembly Patterns, cyclic curves
          assembled from fragments, complete with a trochoid notation. The CAP
          page tells that story with the original math, the people who built it,
          and the videos that carried it since.
        </p>
      </div>
      <img
        class="caps-teaser-trace"
        src="/caps/yuta-cap.svg"
        alt="The Yuta CAP: an extension arc joined to antispin petals, drawn as one closed curve"
        width="280"
        height="280"
        loading="lazy"
      />
    </div>
    <div class="matrix-teaser-wrap">
      <a href="/notation/caps" class="cta-button matrix-teaser-cta">
        <span>Read the CAP story</span>
        <i class="fas fa-arrow-right" aria-hidden="true"></i>
      </a>
    </div>
  </section>

  <!-- Where TKA fits: peer framing, corrected grid + software lineage link. -->
  <section class="editorial-section" style="--accent: #14b8a6">
    <h2 class="section-title">What The Kinetic Alphabet adds</h2>
    <div class="prose">
      <p>
        Read the family back. VTG named the timing and direction. Cushing's
        circle and grid mapped position. Lorq charted the combinations. Siteswap
        offers an analogy for splitting a flow into beats. Music offers another
        for keeping a score compact.
      </p>
      <p>
        TKA's own combination is a pictograph for every beat, drawn on a grid of
        up to nine points and read from the center, so one image holds position,
        timing, and direction at once. String the beats together and they spell
        a word you can say, so a sequence has a name before it has a video, and
        another spinner who knows the conventions can read the page back without
        watching you do it.
      </p>
      <p>
        That is the choice TKA makes. It is one dialect in this family, not the
        last word on any of it. The software tools that chased the same goal
        have
        <a href="/roots/software">their own lineage</a>, and the
        <a href="/guide">guide</a> teaches the grid and the letters from the ground
        up.
      </p>
    </div>
  </section>

  <!-- See it work: the live demo. -->
  <section class="editorial-section" style="--accent: #8b5cf6">
    <h2 class="section-title">A sequence, read and played</h2>
    <div class="has-duo">
      <div class="section-duo demo-star">
        <div class="duo-copy">
          <div class="prose">
            <p>
              The demo places pictographs beside the animation. The sequence is
              written in the alphabet, then played back on the same page so the
              notation can be read while it runs.
            </p>
            <p>
              Build one the same way in the composer: go beat by beat, watch it
              animate, generate it under your own name, and save it.
            </p>
          </div>
        </div>
        <div class="duo-demo">
          <SequenceHeroDemo
            sequence={heroDemoSequence}
            note="pictographs beside the animation"
          />
        </div>
      </div>
    </div>
  </section>

  <!-- Start: props folded into prose, then the on-ramps. -->
  <section class="editorial-section" style="--accent: #06b6d4">
    <h2 class="section-title">Start with a prop and the guide</h2>
    <div class="prose">
      <p>
        The alphabet is one system, and props meet it differently. Dual-ended
        props like
        <a href="/notation/staves">staves</a> show two references at once, so
        patterns read fast. Single-ended props like
        <a href="/notation/clubs">clubs</a>
        and
        <a href="/notation/fans">fans</a> show one, so the same math opens into
        more visible variety. <a href="/notation/buugeng">Buugeng</a> add their
        own geometry, and
        <a href="/notation/poi">poi</a> run on momentum and use a restricted
        subset. Every letter has its own page too, in the
        <a href="/notation/letters">letter index</a>.
      </p>
      <p>
        Start with the <a href="/guide">guide</a> for the concepts, the
        <a href="/shop/choreography-cards">choreography cards</a> to hold the
        system in your hand, and <a href="/composer">Flow Arts Composer</a> to
        build. Chasing one word? The
        <a href="/glossary">full lexicon</a> defines positions, letter types, motions,
        and the rest of the notation vocabulary.
      </p>
    </div>
  </section>

  <div class="cta-card">
    <h3>Ready to create?</h3>
    <p>Flow Arts Composer is free to use. No download required.</p>
    <a href="/create" class="cta-button" data-sveltekit-reload>
      <span>Open Flow Arts Composer</span>
      <i class="fas fa-arrow-right" aria-hidden="true"></i>
    </a>
  </div>
</div>

<style>
  /* ── Rosetta row ──
     Three notation styles in one band. Each cell reserves a square art box
     (aspect-ratio, so the pictograph load never shifts the row), a shared
     caption measure below. Stacks 1-up on phones, 3-up from 720px. */
  .rosetta {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.6rem;
  }
  @media (min-width: 720px) {
    .rosetta {
      grid-template-columns: repeat(3, 1fr);
      gap: clamp(1.4rem, 3vw, 3rem);
      align-items: start;
    }
  }
  .rosetta-cell {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }
  .rosetta-art {
    aspect-ratio: 1;
    display: grid;
    place-items: center;
    padding: 1.1rem;
    background: oklch(0.16 0.018 270 / 0.5);
    border: 1px solid oklch(0.4 0.04 270 / 0.16);
    border-radius: 16px;
    color: color-mix(
      in oklch,
      var(--accent, oklch(0.7 0.13 275)) 70%,
      oklch(0.85 0.02 270)
    );
  }
  .rosetta-art svg {
    width: 100%;
    height: 100%;
  }
  .rosetta-cell figcaption {
    font-size: clamp(0.9rem, 0.86rem + 0.14vw, 1.05rem);
    line-height: 1.55;
    color: oklch(0.72 0.012 270);
  }
  .rosetta-cell figcaption strong {
    color: oklch(0.92 0.04 270);
    font-weight: 640;
  }
  .rosetta-cell figcaption a {
    color: oklch(0.82 0.12 275);
    text-decoration: none;
    border-bottom: 1px solid oklch(0.82 0.12 275 / 0.4);
  }
  .rosetta-cell figcaption a:hover {
    border-bottom-color: oklch(0.82 0.12 275 / 0.9);
  }

  /* QFT circle */
  .qft-ring {
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    opacity: 0.35;
  }
  .qft-pt circle {
    fill: oklch(0.22 0.03 270);
    stroke: currentColor;
    stroke-width: 1.5;
    opacity: 0.9;
  }
  .qft-pt text {
    fill: oklch(0.92 0.02 270);
    font-size: 13px;
    font-weight: 600;
    text-anchor: middle;
    font-family: "Inter", system-ui, sans-serif;
  }
  .qft-move {
    stroke: currentColor;
    stroke-width: 3;
    stroke-linecap: round;
  }

  /* VTG 2x2 */
  .vtg-grid {
    display: grid;
    grid-template-columns: auto 1fr 1fr;
    grid-auto-rows: auto;
    gap: 0.4rem;
    width: 100%;
    max-width: 15rem;
    font-family: "Inter", system-ui, sans-serif;
  }
  .vtg-corner {
    aspect-ratio: 1;
  }
  .vtg-col,
  .vtg-row {
    display: grid;
    place-items: center;
    /* 0.75rem floor: supplementary text never dips below 12px (styling rule). */
    font-size: clamp(0.75rem, 0.7rem + 0.15vw, 0.85rem);
    font-weight: 600;
    letter-spacing: 0.02em;
    color: oklch(0.68 0.02 270);
    text-transform: uppercase;
  }
  .vtg-cell {
    display: grid;
    place-items: center;
    aspect-ratio: 1;
    font-size: clamp(0.9rem, 0.82rem + 0.3vw, 1.15rem);
    font-weight: 640;
    color: oklch(0.78 0.02 270);
    background: oklch(0.2 0.02 270 / 0.55);
    border: 1px solid oklch(0.4 0.04 270 / 0.2);
    border-radius: 8px;
  }
  .vtg-cell.on {
    color: oklch(0.98 0.02 270);
    background: color-mix(
      in oklch,
      var(--accent, oklch(0.7 0.13 275)) 30%,
      oklch(0.2 0.02 270)
    );
    border-color: color-mix(
      in oklch,
      var(--accent, oklch(0.7 0.13 275)) 65%,
      transparent
    );
    box-shadow: 0 0 0 1px
      color-mix(in oklch, var(--accent, oklch(0.7 0.13 275)) 40%, transparent);
  }

  /* TKA pictograph */
  .tka-picto {
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    border-radius: 10px;
  }

  /* ── code / notation line ── (siteswap string, real PoiNotation input) */
  .code-figure {
    margin: 1.6rem 0;
  }
  .notation-line {
    margin: 0;
    padding: 1rem 1.3rem;
    overflow-x: auto;
    font-family:
      "SFMono-Regular", ui-monospace, "Cascadia Code", Menlo, monospace;
    font-size: clamp(1rem, 0.9rem + 0.5vw, 1.4rem);
    letter-spacing: 0.02em;
    color: oklch(0.9 0.02 270);
    background: oklch(0.14 0.018 270 / 0.6);
    border: 1px solid oklch(0.4 0.04 270 / 0.18);
    border-radius: 12px;
  }
  .notation-line .tok-op {
    color: oklch(0.82 0.13 200);
    font-weight: 700;
  }
  .code-figure figcaption {
    margin-top: 0.6rem;
    font-size: 0.85rem;
    line-height: 1.5;
    color: oklch(0.6 0.02 270);
  }
  .inline-tok {
    font-family: "SFMono-Regular", ui-monospace, monospace;
    color: oklch(0.82 0.13 200);
    padding: 0 0.15em;
  }

  /* ── Shape Matrix figure (Lorq Nichols' real 144 diagram) ── */
  .matrix-figure {
    margin: 1.8rem auto;
    max-width: min(34rem, 92%);
  }
  .matrix-img {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 14px;
    box-shadow: 0 10px 34px oklch(0.05 0.02 270 / 0.4);
  }
  .matrix-figure figcaption {
    margin-top: 0.7rem;
    font-size: 0.85rem;
    line-height: 1.5;
    color: oklch(0.6 0.02 270);
    text-align: center;
  }
  .matrix-figure figcaption a {
    color: oklch(0.8 0.12 275);
    text-decoration: none;
    border-bottom: 1px solid oklch(0.8 0.12 275 / 0.4);
  }
  .matrix-figure figcaption a:hover {
    border-bottom-color: oklch(0.8 0.12 275 / 0.9);
  }

  /* Hairline frame so a dark matrix panel would read against the page;
     invisible on Lorq's white chart. */
  .matrix-img {
    border: 1px solid oklch(1 0 0 / 0.08);
  }

  /* Lorq's paper chart demoted to a small reference figure inside the arc,
     not the full-width duo it used to share with a second static image. */
  .matrix-figure.lorq-figure {
    max-width: min(20rem, 80%);
  }

  /* Live teaser: a reserved-height lazy slot plus the call-to-action button,
     stacked and centered. The slot holds geometry while the matrix chunk and
     its calculation graph stay out of route-transition work. */
  .matrix-teaser-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.4rem;
    margin: 2rem 0;
  }

  .shape-matrix-teaser-slot {
    width: min(60vw, 26rem);
    max-width: 100%;
  }

  .shape-matrix-teaser-placeholder {
    width: 100%;
    height: min(60vw, 26rem);
    border: 1px solid oklch(0.4 0.04 270 / 0.16);
    border-radius: 16px;
    background:
      linear-gradient(135deg, transparent 40%, oklch(0.7 0.04 270 / 0.07), transparent 60%),
      #0a0f14;
  }

  .shape-matrix-teaser-error {
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 0.85rem;
    width: 100%;
    height: min(60vw, 26rem);
    padding: 1.5rem;
    color: oklch(0.88 0.025 270);
    text-align: center;
    border: 1px solid oklch(0.4 0.04 270 / 0.16);
    border-radius: 16px;
    background: #0a0f14;
  }

  .shape-matrix-teaser-error button {
    min-height: var(--min-touch-target, 44px);
    padding-inline: 1rem;
    color: oklch(0.94 0.02 270);
    font: inherit;
    font-weight: 650;
    cursor: pointer;
    border: 1px solid oklch(0.62 0.1 270 / 0.55);
    border-radius: 10px;
    background: oklch(0.36 0.08 270 / 0.5);
  }

  .caps-teaser-trace {
    width: min(280px, 100%);
    height: auto;
    aspect-ratio: 1;
    justify-self: center;
  }
  .matrix-teaser-cta {
    /* .cta-button below already defines the button look; this narrows its
       margin-top reset since it's not inside .cta-card here. */
    margin: 0;
  }
</style>
