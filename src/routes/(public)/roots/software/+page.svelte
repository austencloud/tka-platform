<script lang="ts">
  import "$lib/shared/landing/styles/public-editorial.css";

  // Every URL verified live 2026-07-16 (research pass, spec
  // 2026-07-16-flow-arts-software-seo-design.md). Statuses noted in copy.
  const links = {
    vtgPlay: "https://play.google.com/store/apps/details?id=net.firestaff.mcp.VTGv3",
    vtgIos: "https://apps.apple.com/us/app/vtg-full-flow-arts-resource/id1468743063",
    poiLab: "https://play.google.com/store/apps/details?id=net.firestaff.mcp.poilab.full",
    doubleStaffLab:
      "https://play.google.com/store/apps/details?id=net.firestaff.mcp.doublestafflab.full",
    hoopLab: "https://play.google.com/store/apps/details?id=net.firestaff.mcp.hooplab.full",
    tuttingLab: "https://play.google.com/store/apps/details?id=net.firestaff.mcp.armcontrollab",
    visualSpinner: "https://infiniteperplexity.github.io/visual-spinner-3d/",
    visualSpinnerGithub: "https://github.com/infiniteperplexity/visual-spinner-3d",
    arFlowArtsPlay: "https://play.google.com/store/apps/details?id=com.arflowartsreact",
    arFlowArtsIos: "https://apps.apple.com/us/app/arflowarts/id1517940593",
    taylorFlows: "https://app.taylorflows.com/",
    fam: "https://www.flowartsmeetup.com/",
  };

  const TITLE = "The History of Flow Arts Software | The Kinetic Alphabet";
  const DESCRIPTION =
    "Flow artists have been building software for over a decade: reference apps, spinning simulators, AR effects, and training platforms. Who built the tools, what they do, and where they are now.";
</script>

<svelte:head>
  <title>{TITLE}</title>
  <meta name="description" content={DESCRIPTION} />
  <link rel="canonical" href="https://tkaflowarts.com/roots/software" />

  <meta property="og:type" content="article" />
  <meta property="og:url" content="https://tkaflowarts.com/roots/software" />
  <meta property="og:title" content={TITLE} />
  <meta property="og:description" content={DESCRIPTION} />
  <meta property="og:image" content="https://tkaflowarts.com/branding/og-image.png" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={TITLE} />
  <meta name="twitter:description" content={DESCRIPTION} />
  <meta name="twitter:image" content="https://tkaflowarts.com/branding/og-image.png" />

  {@html `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "The History of Flow Arts Software",
    "url": "https://tkaflowarts.com/roots/software",
    "description": "${DESCRIPTION}",
    "inLanguage": "en-US",
    "author": { "@type": "Person", "name": "Austen Cloud", "url": "https://tkaflowarts.com/about" },
    "publisher": {
      "@type": "Organization",
      "name": "The Kinetic Alphabet",
      "url": "https://tkaflowarts.com/"
    }
  }
  </script>`}

  {@html `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://tkaflowarts.com/" },
      { "@type": "ListItem", "position": 2, "name": "Roots", "item": "https://tkaflowarts.com/roots" },
      { "@type": "ListItem", "position": 3, "name": "Software History", "item": "https://tkaflowarts.com/roots/software" }
    ]
  }
  </script>`}
</svelte:head>

<div class="editorial">
  <header class="editorial-header">
    <h1 class="page-title">The History of Flow Arts Software</h1>
    <p class="page-subtitle">The tools that came before, and the people who built them</p>
  </header>

  <div class="lede">
    <p>
      Flow arts is a niche discipline. No software company was ever going to serve it, so
      the artists who could code built the tools themselves. This page documents that
      lineage: the reference apps, the simulators, and the platforms the community made,
      with working links to everything that still runs.
    </p>
  </div>

  <!-- VTG app -->
  <section class="editorial-section" style="--accent: #f59e0b">
    <h2 class="section-title">The VTG App</h2>
    <div class="prose">
      <p>
        Vulcan Tech Gospel gave flow artists a shared vocabulary for timing, direction,
        and motion type. The <strong>VTG app</strong> turned that framework into a pocket
        reference: animations, quizzes, and pattern layouts covering staff, poi, clubs,
        hoops, fans, buugeng, and triads. The app has gone through multiple versions with
        different developers over the years. The current release comes from Michael Caden
        Pike and Noel Yee, and it is still available on both stores.
      </p>
      <div class="resource-row">
        <a href={links.vtgPlay} target="_blank" rel="noopener noreferrer" class="resource-chip">
          <span>VTG on Google Play</span>
          <i class="fas fa-external-link-alt ext" aria-hidden="true"></i>
        </a>
        <a href={links.vtgIos} target="_blank" rel="noopener noreferrer" class="resource-chip">
          <span>VTG on the App Store</span>
          <i class="fas fa-external-link-alt ext" aria-hidden="true"></i>
        </a>
      </div>
      <p>
        For what VTG contributed to The Kinetic Alphabet itself, read the
        <a href="/roots">roots page</a>.
      </p>
    </div>
  </section>

  <!-- LAB simulators -->
  <section class="editorial-section" style="--accent: #ec4899">
    <h2 class="section-title">The LAB Simulators</h2>
    <div class="prose">
      <p>
        Michael Caden Pike kept going. Over the years he shipped a whole family of
        simulators: <strong>Poi LAB</strong>, <strong>Double Staff LAB</strong>,
        <strong>Hoop Twinz LAB</strong>, and the <strong>Arm Control (Tutting) Lab</strong>.
        Each one lets you program a move, watch it animate as 2D trails, slow it down, and
        share the pattern. Double Staff LAB alone ships more than a hundred patterns,
        labeled in VTG terms or old-school names. The family last saw updates in early
        2024, and every app is still downloadable.
      </p>
      <div class="resource-row">
        <a href={links.poiLab} target="_blank" rel="noopener noreferrer" class="resource-chip">
          <span>Poi LAB</span>
          <i class="fas fa-external-link-alt ext" aria-hidden="true"></i>
        </a>
        <a href={links.doubleStaffLab} target="_blank" rel="noopener noreferrer" class="resource-chip">
          <span>Double Staff LAB</span>
          <i class="fas fa-external-link-alt ext" aria-hidden="true"></i>
        </a>
        <a href={links.hoopLab} target="_blank" rel="noopener noreferrer" class="resource-chip">
          <span>Hoop Twinz LAB</span>
          <i class="fas fa-external-link-alt ext" aria-hidden="true"></i>
        </a>
        <a href={links.tuttingLab} target="_blank" rel="noopener noreferrer" class="resource-chip">
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
        <strong>VisualSpinner3D</strong> took a different route: no install, just a web
        page. Glenn Wright, a fire spinner and programmer, built an open source simulator
        that renders flowers, pendulums, and hybrids for poi, staff, hoop, and fans right
        in the browser. It went up around 2014 and it still runs today, with the source
        on GitHub.
      </p>
      <div class="resource-row">
        <a href={links.visualSpinner} target="_blank" rel="noopener noreferrer" class="resource-chip">
          <span>VisualSpinner3D (live demo)</span>
          <i class="fas fa-external-link-alt ext" aria-hidden="true"></i>
        </a>
        <a href={links.visualSpinnerGithub} target="_blank" rel="noopener noreferrer" class="resource-chip">
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
        The current generation splits by purpose. <strong>AR Flow Arts</strong> by Ian
        Borukhovich overlays glowing trails and particle effects onto flow footage shot
        with your phone. <strong>Flows!</strong> by Taylor Flows is a training platform
        with structured video courses for hoop and fan technique. <strong>Flow Arts Meet
        Up</strong> by Ty Roachford covers the social side: finding jams, festivals, and
        other spinners near you.
      </p>
      <div class="resource-row">
        <a href={links.arFlowArtsPlay} target="_blank" rel="noopener noreferrer" class="resource-chip">
          <span>AR Flow Arts (Android)</span>
          <i class="fas fa-external-link-alt ext" aria-hidden="true"></i>
        </a>
        <a href={links.arFlowArtsIos} target="_blank" rel="noopener noreferrer" class="resource-chip">
          <span>AR Flow Arts (iOS)</span>
          <i class="fas fa-external-link-alt ext" aria-hidden="true"></i>
        </a>
        <a href={links.taylorFlows} target="_blank" rel="noopener noreferrer" class="resource-chip">
          <span>Flows! by Taylor Flows</span>
          <i class="fas fa-external-link-alt ext" aria-hidden="true"></i>
        </a>
        <a href={links.fam} target="_blank" rel="noopener noreferrer" class="resource-chip">
          <span>Flow Arts Meet Up</span>
          <i class="fas fa-external-link-alt ext" aria-hidden="true"></i>
        </a>
      </div>
    </div>
  </section>

  <!-- Where TKA fits -->
  <section class="editorial-section panel" style="--accent: #06b6d4">
    <h2 class="section-title">Where The Kinetic Alphabet Fits</h2>
    <div class="prose">
      <p>
        Look at the list again: a reference app, four simulators, an effects camera, a
        course library, a social network. The one thing missing is notation. A 2016 design
        exercise called PoiNotation sketched a text language for poi moves, but it never
        shipped. Writing choreography down, the way musicians write music, stayed an open
        problem.
      </p>
      <p>
        That is the problem The Kinetic Alphabet solves. Flow Arts Composer is the
        <a href="/composer">flow arts software</a> built on it: sequences written as
        notation, composed step by step, animated with any supported prop, and shared as
        something another artist can read.
      </p>
      <p>
        Statuses on this page were last checked in July 2026. If you built one of these
        tools and a detail is wrong, or a link has died,
        <a href="/about">get in touch</a> and it will be fixed.
      </p>
    </div>
  </section>

  <!-- CTA -->
  <div class="cta-card">
    <h3>Try the current chapter</h3>
    <p>Flow Arts Composer runs in your browser and costs nothing.</p>
    <a href="/composer" class="cta-button">
      <span>Open Flow Arts Composer</span>
      <i class="fas fa-arrow-right" aria-hidden="true"></i>
    </a>
  </div>
</div>
