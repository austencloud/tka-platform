<script lang="ts">
  import Seo from "$lib/shared/components/Seo.svelte";
  import "$lib/shared/landing/styles/public-editorial.css";
  import SoftwareSubmitForm from "$lib/shared/landing/components/SoftwareSubmitForm.svelte";

  // Every URL verified live 2026-07-16/17 (research passes, spec
  // 2026-07-16-flow-arts-software-seo-design.md). Statuses noted in copy.
  const links = {
    vtgPlay:
      "https://play.google.com/store/apps/details?id=net.firestaff.mcp.VTGv3",
    vtgIos:
      "https://apps.apple.com/us/app/vtg-full-flow-arts-resource/id1468743063",
    poiLab:
      "https://play.google.com/store/apps/details?id=net.firestaff.mcp.poilab.full",
    doubleStaffLab:
      "https://play.google.com/store/apps/details?id=net.firestaff.mcp.doublestafflab.full",
    hoopLab:
      "https://play.google.com/store/apps/details?id=net.firestaff.mcp.hooplab.full",
    tuttingLab:
      "https://play.google.com/store/apps/details?id=net.firestaff.mcp.armcontrollab",
    spinScience: "https://sirlorq.wordpress.com/",
    sirLorq: "https://sirlorq.wordpress.com/tech-tiles/",
    visualSpinner: "https://infiniteperplexity.github.io/visual-spinner-3d/",
    visualSpinnerGithub:
      "https://github.com/infiniteperplexity/visual-spinner-3d",
    spiroAnim: "https://spiroanim.com/app",
    spiroAnimGithub: "https://github.com/rbgirard/spiroanim",
    arFlowArtsPlay:
      "https://play.google.com/store/apps/details?id=com.arflowartsreact",
    arFlowArtsIos: "https://apps.apple.com/us/app/arflowarts/id1517940593",
    fam: "https://www.flowartsmeetup.com/",
    poiNotation: "https://github.com/tiffanyfong/PoiNotation",
  };

  const TITLE = "The History of Flow Arts Software | The Kinetic Alphabet";
  const DESCRIPTION =
    "Flow artists have been building software for over a decade: reference apps, spinning simulators, AR effects, and community platforms. Who built the tools, what they do, and where they are now.";
  const URL = "https://tkaflowarts.com/roots/software";
  const ARTICLE_ID = `${URL}#article`;
  const PERSON_ID = "https://tkaflowarts.com/about#austen-cloud";
  const ORGANIZATION_ID = "https://tkaflowarts.com/#organization";
  const WEBSITE_ID = "https://tkaflowarts.com/#website";

  const pageJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": ARTICLE_ID,
        headline: "The History of Flow Arts Software",
        url: URL,
        mainEntityOfPage: URL,
        description: DESCRIPTION,
        inLanguage: "en-US",
        datePublished: "2026-07-16",
        dateModified: "2026-08-31",
        image: "https://tkaflowarts.com/branding/og-image.png",
        author: { "@id": PERSON_ID },
        publisher: { "@id": ORGANIZATION_ID },
        isPartOf: { "@id": WEBSITE_ID },
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
            name: "Notation",
            item: "https://tkaflowarts.com/notation",
          },
          {
            "@type": "ListItem",
            position: 3,
            name: "Software History",
            item: URL,
          },
        ],
      },
    ],
  }).replace(/</g, "\\u003c");
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
    <h1 class="page-title">The History of Flow Arts Software</h1>
    <p class="page-subtitle">
      The tools that came before, and the people who built them
    </p>
    <p class="page-subtitle article-meta">
      By <a href="/about#austen-cloud">Austen Cloud</a>
      <span aria-hidden="true">·</span>
      Published July 16, 2026
      <span aria-hidden="true">·</span>
      Updated August 31, 2026
    </p>
  </header>

  <div class="lede">
    <p>
      Flow arts software has mostly been built by practitioners who needed a
      tool and knew how to make one. This page documents that lineage: reference
      apps, simulators, and community platforms, with working links to the tools
      that remain available.
    </p>
  </div>

  <!-- VTG app -->
  <section class="editorial-section" style="--accent: #f59e0b">
    <h2 class="section-title">The VTG App</h2>
    <div class="prose">
      <p>
        Vulcan Tech Gospel gave flow artists a shared vocabulary for timing,
        direction, and motion type. The <strong>VTG app</strong> turned that framework
        into a pocket reference: animations, quizzes, and pattern layouts covering
        staff, poi, clubs, hoops, fans, buugeng, and triads. The app has gone through
        multiple versions with different developers over the years. The current release
        comes from Michael Caden Pike and Noel Yee, and it is still available on both
        stores.
      </p>
      <div class="shot-strip phones two">
        <figure class="shot">
          <img
            src="/roots/software/vtg-1.webp"
            alt="Screenshot of the VTG app rendering a two-petal in-spin pattern"
            loading="lazy"
            width="800"
            height="1600"
          />
          <figcaption>VTG app, Google Play listing</figcaption>
        </figure>
        <figure class="shot">
          <img
            src="/roots/software/vtg-2.webp"
            alt="Screenshot of the VTG app's timing and direction reference screen"
            loading="lazy"
            width="800"
            height="1600"
          />
          <figcaption>Timing and direction reference</figcaption>
        </figure>
      </div>
      <div class="resource-row">
        <a
          href={links.vtgPlay}
          target="_blank"
          rel="noopener noreferrer"
          class="resource-chip"
        >
          <span>VTG on Google Play</span>
          <i class="fas fa-external-link-alt ext" aria-hidden="true"></i>
        </a>
        <a
          href={links.vtgIos}
          target="_blank"
          rel="noopener noreferrer"
          class="resource-chip"
        >
          <span>VTG on the App Store</span>
          <i class="fas fa-external-link-alt ext" aria-hidden="true"></i>
        </a>
      </div>
      <p>
        For what VTG contributed to The Kinetic Alphabet itself, read the
        <a href="/notation">Notation lineage</a>.
      </p>
    </div>
  </section>

  <!-- Paper tools -->
  <section class="editorial-section" style="--accent: #a855f7">
    <h2 class="section-title">The Paper Tools</h2>
    <div class="prose">
      <p>
        Not every tool was software. <strong>Lorq Nichols</strong> spent years mapping
        poi movement into printed systems through Spin Science: the Shape Matrix,
        324 Patterns, the 144 Atomic Hybrids, the 9 Flower Families, and the Book
        of P.H.A.T., built with contributions from Brian Thompson, David "Tankboy"
        Cantor, and Noel Yee. Charts and posters rather than apps, but they do the
        same job a simulator does: show you the pattern space so you can map it.
      </p>
      <div class="shot-strip web">
        <figure class="shot">
          <img
            src="/roots/software/spin-science.webp"
            alt="Screenshot of the Spin Science website by Lorq Nichols"
            loading="lazy"
            width="1600"
            height="850"
          />
          <figcaption>spinscience.xyz</figcaption>
        </figure>
      </div>
      <div class="resource-row">
        <a
          href={links.spinScience}
          target="_blank"
          rel="noopener noreferrer"
          class="resource-chip"
        >
          <span>Spin Science</span>
          <i class="fas fa-external-link-alt ext" aria-hidden="true"></i>
        </a>
        <a
          href={links.sirLorq}
          target="_blank"
          rel="noopener noreferrer"
          class="resource-chip"
        >
          <span>Book of P.H.A.T. at Sir Lorq</span>
          <i class="fas fa-external-link-alt ext" aria-hidden="true"></i>
        </a>
      </div>
    </div>
  </section>

  <!-- LAB simulators -->
  <section class="editorial-section" style="--accent: #ec4899">
    <h2 class="section-title">The LAB Simulators</h2>
    <div class="prose">
      <p>
        Michael Caden Pike kept going. Over the years he shipped a suite of
        simulators: <strong>Poi LAB</strong>,
        <strong>Double Staff LAB</strong>,
        <strong>Hoop Twinz LAB</strong>, and the
        <strong>Arm Control (Tutting) Lab</strong>. Each one lets you program a
        move, watch it animate as 2D trails, slow it down, and share the
        pattern. Double Staff LAB alone ships more than a hundred patterns,
        labeled in VTG terms or old-school names. The family last saw updates in
        early 2024, and all four remain downloadable.
      </p>
      <div class="shot-strip phones">
        <figure class="shot">
          <img
            src="/roots/software/poi-lab.webp"
            alt="Screenshot of the Poi LAB Android app, from its Google Play listing"
            loading="lazy"
            width="800"
            height="1600"
          />
          <figcaption>Poi LAB</figcaption>
        </figure>
        <figure class="shot">
          <img
            src="/roots/software/double-staff-lab.webp"
            alt="Screenshot of the Double Staff LAB Android app's pattern picker"
            loading="lazy"
            width="800"
            height="1600"
          />
          <figcaption>Double Staff LAB</figcaption>
        </figure>
        <figure class="shot">
          <img
            src="/roots/software/hoop-twinz-lab.webp"
            alt="Screenshot of the Hoop Twinz LAB Android app, from its Google Play listing"
            loading="lazy"
            width="800"
            height="1600"
          />
          <figcaption>Hoop Twinz LAB</figcaption>
        </figure>
        <figure class="shot">
          <img
            src="/roots/software/tutting-lab.webp"
            alt="Screenshot of the Arm Control Tutting Lab Android app, from its Google Play listing"
            loading="lazy"
            width="800"
            height="1600"
          />
          <figcaption>Arm Control (Tutting) Lab</figcaption>
        </figure>
      </div>
      <div class="resource-row">
        <a
          href={links.poiLab}
          target="_blank"
          rel="noopener noreferrer"
          class="resource-chip"
        >
          <span>Poi LAB</span>
          <i class="fas fa-external-link-alt ext" aria-hidden="true"></i>
        </a>
        <a
          href={links.doubleStaffLab}
          target="_blank"
          rel="noopener noreferrer"
          class="resource-chip"
        >
          <span>Double Staff LAB</span>
          <i class="fas fa-external-link-alt ext" aria-hidden="true"></i>
        </a>
        <a
          href={links.hoopLab}
          target="_blank"
          rel="noopener noreferrer"
          class="resource-chip"
        >
          <span>Hoop Twinz LAB</span>
          <i class="fas fa-external-link-alt ext" aria-hidden="true"></i>
        </a>
        <a
          href={links.tuttingLab}
          target="_blank"
          rel="noopener noreferrer"
          class="resource-chip"
        >
          <span>Arm Control (Tutting) Lab</span>
          <i class="fas fa-external-link-alt ext" aria-hidden="true"></i>
        </a>
      </div>
    </div>
  </section>

  <!-- VisualSpinner3D -->
  <section class="editorial-section" style="--accent: #818cf8">
    <h2 class="section-title">The Browser Simulator</h2>
    <div class="prose">
      <p>
        <strong>VisualSpinner3D</strong> took a different route: no install, just
        a web page. Glenn Wright, a fire spinner and programmer, built an open source
        simulator that renders flowers, pendulums, and hybrids for poi, staff, hoop,
        and fans right in the browser. It went up around 2014 and it still runs today,
        with the source on GitHub.
      </p>
      <div class="shot-strip web">
        <figure class="shot">
          <img
            src="/roots/software/visualspinner3d.webp"
            alt="Screenshot of the VisualSpinner3D browser simulator by Glenn Wright"
            loading="lazy"
            width="1600"
            height="850"
          />
          <figcaption>VisualSpinner3D running in the browser</figcaption>
        </figure>
      </div>
      <div class="resource-row">
        <a
          href={links.visualSpinner}
          target="_blank"
          rel="noopener noreferrer"
          class="resource-chip"
        >
          <span>VisualSpinner3D (live demo)</span>
          <i class="fas fa-external-link-alt ext" aria-hidden="true"></i>
        </a>
        <a
          href={links.visualSpinnerGithub}
          target="_blank"
          rel="noopener noreferrer"
          class="resource-chip"
        >
          <span>Source on GitHub</span>
          <i class="fas fa-external-link-alt ext" aria-hidden="true"></i>
        </a>
      </div>
    </div>
  </section>

  <!-- SpiroAnim -->
  <section class="editorial-section" style="--accent: #22d3ee">
    <h2 class="section-title">SpiroAnim</h2>
    <div class="prose">
      <p>
        <strong>SpiroAnim</strong> is Ryan Girard's browser workspace for advanced
        poi and staff concepts. Its animated player sits beside live generators for
        Vulcan Tech Gospel, Quarter Spacing, and Eight Step. Change a cell, speed
        ratio, grid, pattern option, or playback setting, and the movement redraws
        immediately. A timeline and editor handle patterns built outside those
        concept catalogs.
      </p>
      <p>
        The project became public in 2026 after several years of development. It
        is open source, installable as a progressive web app, and designed to
        reopen offline after its first successful visit. SpiroAnim's own builders
        and compiler also supplied the source geometry for the app's full
        transcription into The Kinetic Alphabet.
      </p>
      <div class="shot-strip web">
        <figure class="shot">
          <img
            src="/roots/software/spiroanim.webp"
            alt="SpiroAnim showing animated cyan and green poi paths beside its Vulcan Tech Gospel concept matrix"
            loading="lazy"
            width="1920"
            height="1080"
          />
          <figcaption>
            SpiroAnim player and Vulcan Tech Gospel concept matrix
          </figcaption>
        </figure>
      </div>
      <div class="resource-row">
        <a
          href={links.spiroAnim}
          target="_blank"
          rel="noopener noreferrer"
          class="resource-chip"
        >
          <span>Open SpiroAnim</span>
          <i class="fas fa-external-link-alt ext" aria-hidden="true"></i>
        </a>
        <a
          href={links.spiroAnimGithub}
          target="_blank"
          rel="noopener noreferrer"
          class="resource-chip"
        >
          <span>Source on GitHub</span>
          <i class="fas fa-external-link-alt ext" aria-hidden="true"></i>
        </a>
      </div>
    </div>
  </section>

  <!-- Today -->
  <section class="editorial-section" style="--accent: #22c55e">
    <h2 class="section-title">Today</h2>
    <div class="prose">
      <p>
        The current generation splits by purpose. <strong>AR Flow Arts</strong>
        by Ian Borukhovich overlays glowing trails and particle effects onto flow
        footage shot with your phone. <strong>Flow Arts Meet Up</strong> by Ty Roachford
        found real traction in the community: an app for finding jams, festivals,
        and other spinners near you, with event listings and a vendor marketplace
        along the way.
      </p>
      <div class="shot-strip mixed">
        <figure class="shot phone">
          <img
            src="/roots/software/ar-flow-arts.webp"
            alt="Screenshot of the AR Flow Arts app, from its Google Play listing"
            loading="lazy"
            width="800"
            height="1600"
          />
          <figcaption>AR Flow Arts</figcaption>
        </figure>
        <figure class="shot web-shot">
          <img
            src="/roots/software/flow-arts-meet-up.webp"
            alt="Screenshot of the Flow Arts Meet Up website by Ty Roachford"
            loading="lazy"
            width="1600"
            height="850"
          />
          <figcaption>flowartsmeetup.com</figcaption>
        </figure>
      </div>
      <div class="resource-row">
        <a
          href={links.arFlowArtsPlay}
          target="_blank"
          rel="noopener noreferrer"
          class="resource-chip"
        >
          <span>AR Flow Arts (Android)</span>
          <i class="fas fa-external-link-alt ext" aria-hidden="true"></i>
        </a>
        <a
          href={links.arFlowArtsIos}
          target="_blank"
          rel="noopener noreferrer"
          class="resource-chip"
        >
          <span>AR Flow Arts (iOS)</span>
          <i class="fas fa-external-link-alt ext" aria-hidden="true"></i>
        </a>
        <a
          href={links.fam}
          target="_blank"
          rel="noopener noreferrer"
          class="resource-chip"
        >
          <span>Flow Arts Meet Up</span>
          <i class="fas fa-external-link-alt ext" aria-hidden="true"></i>
        </a>
      </div>
    </div>
  </section>

  <!-- Where TKA fits -->
  <section class="editorial-section" style="--accent: #06b6d4">
    <h2 class="section-title">Where The Kinetic Alphabet Fits</h2>
    <div class="prose">
      <p>
        These tools approach movement as references, catalogs, simulators,
        effects, or community infrastructure. In 2016, Tiffany Fong built
        PoiNotation, a Scala domain-specific language for writing poi moves as
        text. The source remains on
        <a href={links.poiNotation} target="_blank" rel="noopener noreferrer"
          >GitHub</a
        >. The surviving public repository ends with that course release.
      </p>
      <p>
        TKA takes a different route: a pictograph for each beat and a
        pronounceable label for the sequence. Flow Arts Composer is the
        <a href="/composer">flow arts software</a> built on it: sequences written
        as notation, composed step by step, animated with supported props, and shared
        with artists who know the conventions.
      </p>
    </div>
  </section>

  <!-- Submit -->
  <section class="editorial-section" style="--accent: #f59e0b" id="submit">
    <h2 class="section-title">Add to This List</h2>
    <div class="prose">
      <p>
        Built flow arts software? Remember a tool this page is missing, or
        spotted a detail that is wrong? Submit it below. Every submission gets
        reviewed, and anything that belongs here gets added with credit.
        Statuses on this page were last checked in August 2026.
      </p>
      <SoftwareSubmitForm source="roots-software" />
    </div>
  </section>

  <!-- CTA -->
  <div class="cta-card">
    <h3>Try the current chapter</h3>
    <p>Flow Arts Composer runs in your browser and costs nothing.</p>
    <a href="/create" class="cta-button">
      <span>Open Flow Arts Composer</span>
      <i class="fas fa-arrow-right" aria-hidden="true"></i>
    </a>
  </div>
</div>

<style>
  .article-meta {
    margin-top: 0.65rem;
    font-size: 0.875rem;
  }
  .article-meta span {
    margin-inline: 0.35rem;
  }

  /* Screenshot galleries. Fixed aspect boxes (no layout shift on load), fluid
     from iPhone SE (375px: phones 2-up) to 4K (the editorial column caps at
     46rem; 800px-wide sources keep phone shots crisp at 2x). */
  .shot-strip {
    display: grid;
    gap: 0.9rem;
    margin: 1.5rem 0 1.1rem;
  }
  .shot-strip.phones {
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  }
  .shot-strip.phones.two {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    max-width: 26rem;
  }
  .shot-strip.web {
    grid-template-columns: 1fr;
  }
  .shot-strip.mixed {
    grid-template-columns: minmax(130px, 1fr) minmax(200px, 2.4fr);
    align-items: start;
  }

  .shot {
    margin: 0;
  }
  .shot img {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 1 / 2;
    object-fit: cover;
    border-radius: 12px;
    border: 1px solid oklch(0.45 0.04 270 / 0.25);
    background: oklch(0.22 0.03 270);
  }
  .shot-strip.web .shot img,
  .shot.web-shot img {
    aspect-ratio: 16 / 9;
  }
  .shot figcaption {
    margin-top: 0.45rem;
    font-size: 0.8rem;
    line-height: 1.35;
    color: oklch(0.62 0.02 270);
    text-align: center;
  }

  /* Below the width where all four LAB shots fit on one row, go straight to
     2-up: the auto-fit middle ground wraps as a 3+1 orphan row. */
  @media (max-width: 640px) {
    .shot-strip.phones {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  @media (max-width: 480px) {
    .shot-strip.mixed {
      grid-template-columns: 1fr;
    }
    /* A stacked phone shot must not become a full-width 750px-tall tower. */
    .shot-strip.mixed .shot.phone {
      width: 100%;
      max-width: 200px;
      margin: 0 auto;
    }
  }
</style>
