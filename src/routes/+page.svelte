<script lang="ts">
  import HomeHero from "$lib/shared/landing/components/HomeHero.svelte";
  import LaunchpadGrid from "$lib/shared/landing/components/launchpad/LaunchpadGrid.svelte";
</script>

<svelte:head>
  <!-- Playfair Display for landing page headings -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600&display=swap"
    rel="stylesheet"
  />

  <title>Flow Arts Notation | The Kinetic Alphabet</title>
  <meta
    name="description"
    content="TKA is a notation system for flow arts. Document and share staff, fans, hoop, club, fan, and buugeng choreography. Create sequences, animate them, share with other flow artists."
  />

  <!-- Additional SEO meta tags -->
  <meta
    name="robots"
    content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
  />
  <meta name="author" content="The Kinetic Alphabet" />
  <meta name="application-name" content="Flow Arts Composer" />
  <meta name="generator" content="SvelteKit" />

  <!-- Geographic targeting (global, but origin matters for trust) -->
  <meta name="geo.region" content="US" />
  <meta name="language" content="English" />

  <!-- Open Graph (Facebook, LinkedIn, Pinterest) -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="TKA - The Kinetic Alphabet" />
  <meta property="og:url" content="https://tkaflowarts.com/" />
  <meta property="og:title" content="Flow Arts Notation | The Kinetic Alphabet" />
  <meta
    property="og:description"
    content="A notation system for flow arts. Document, animate, and share staff, fans, hoop, club, and fan choreography."
  />
  <meta
    property="og:image"
    content="https://tkaflowarts.com/branding/og-image.png"
  />
  <meta
    property="og:image:alt"
    content="Flow Arts Composer - Flow arts choreography app showing staff sequence animation"
  />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:locale" content="en_US" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@tkaflowarts" />
  <meta name="twitter:creator" content="@tkaflowarts" />
  <meta name="twitter:title" content="Flow Arts Notation | The Kinetic Alphabet" />
  <meta
    name="twitter:description"
    content="A notation system for flow arts. Document, animate, and share staff, fans, hoop, club, and fan choreography."
  />
  <meta
    name="twitter:image"
    content="https://tkaflowarts.com/branding/og-image.png"
  />
  <meta
    name="twitter:image:alt"
    content="Flow Arts Composer - Flow arts notation app showing staff sequence animation"
  />

  <!-- Canonical URL -->
  <link rel="canonical" href="https://tkaflowarts.com/" />

  <!-- JSON-LD Structured Data: WebSite with SearchAction -->
  {@html `<script type="application/ld+json">
	{
		"@context": "https://schema.org",
		"@type": "WebSite",
		"name": "TKA - The Kinetic Alphabet",
		"alternateName": ["The Kinetic Alphabet", "Kinetic Alphabet", "TKA"],
		"url": "https://tkaflowarts.com/",
		"description": "TKA is a notation system for flow arts. Document and share staff, fans, hoop, club, fan, and buugeng choreography.",
		"inLanguage": "en-US",
		"potentialAction": {
			"@type": "SearchAction",
			"target": {
				"@type": "EntryPoint",
				"urlTemplate": "https://tkaflowarts.com/create?search={search_term_string}"
			},
			"query-input": "required name=search_term_string"
		}
	}
	</script>`}

  <!-- JSON-LD Structured Data: Organization -->
  {@html `<script type="application/ld+json">
	{
		"@context": "https://schema.org",
		"@type": "Organization",
		"name": "TKA - The Kinetic Alphabet",
		"alternateName": ["The Kinetic Alphabet", "TKA"],
		"url": "https://tkaflowarts.com/",
		"logo": "https://tkaflowarts.com/pwa/icons/icon-512x512.png",
		"description": "TKA is a notation system for flow arts. Document and share staff, fans, hoop, club, fan, and buugeng choreography.",
		"disambiguatingDescription": "The Kinetic Alphabet is a movement notation system for flow arts and prop spinning. It is not related to the NATO phonetic alphabet or any spelling alphabet.",
		"knowsAbout": [
			"flow arts",
			"staff spinning",
			"double staff",
			"prop spinning",
			"movement notation",
			"choreography notation"
		],
		"foundingDate": "2022-03-27",
		"sameAs": [
			"https://instagram.com/tkaflowarts",
			"https://facebook.com/tkaflowarts",
			"https://www.youtube.com/@TheKineticAlphabet"
		],
		"contactPoint": {
			"@type": "ContactPoint",
			"contactType": "customer support",
			"email": "support@tkaflowarts.com"
		}
	}
	</script>`}

  <!-- SoftwareApplication + HowTo JSON-LD moved to /composer — Flow Arts
       Composer is its own entity with its own page; this page is TKA's. -->

  <!-- The FAQ lives on its own page (/faq, in the header's Learn menu); its
       FAQPage JSON-LD is emitted there, matching that page's visible content. -->

</svelte:head>

<div class="landing-page">
  <!-- Cosmic background + SiteHeader come from MarketingChrome (root layout). -->
  <a href="#main-content" class="skip-link">Skip to main content</a>

  <div class="content-layer">
    <HomeHero />
    <main id="main-content" class="launchpad-main">
      <LaunchpadGrid />
    </main>
  </div>
</div>


<style>
  /* Skip link - visible only on focus for keyboard users */
  .skip-link {
    position: absolute;
    top: -100px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--primary, #6366f1);
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 600;
    z-index: var(--z-overlay);
    transition: top var(--duration-normal) ease;
  }

  .skip-link:focus {
    top: 16px;
    outline: 2px solid white;
    outline-offset: 2px;
  }

  .landing-page {
    position: relative;
    min-height: 100vh;
    font-family: system-ui, -apple-system, sans-serif;
    --landing-heading-font: "Playfair Display", Georgia, serif;
    color: var(--theme-text, #ffffff);
    line-height: 1.6;
    overflow-x: hidden;
  }

  .content-layer {
    position: relative;
    z-index: 1;
  }

  .launchpad-main {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1.25rem;
  }

  /* Split tier: hero (left pane) + launchpad grid (right pane) compose into
     ONE viewport on wide screens — a practitioner on a 1080p/1440p/4K display
     sees the whole front door without scrolling. Recomposition, not scaling
     (per the 4K landing spec's wave-3 rule). Below 1680px the stacked layout
     above is untouched. The bound stays fluid (62vw beyond ~2840px wide) so
     the composition keeps growing at 4K/5K instead of re-freezing. */
  @media (min-width: 1680px) {
    .content-layer {
      display: grid;
      grid-template-columns: minmax(520px, 5fr) 7fr;
      column-gap: clamp(2.5rem, 4vw, 5.5rem);
      align-items: center;
      max-width: max(1760px, 62vw);
      margin-inline: auto;
      padding-inline: clamp(1.5rem, 2.5vw, 4rem);
      /* The fixed MarketingChrome header overlays the top ~64px, so the
         composition budgets for it: top padding pushes both panes clear, and
         min-height (not height) lets a short window scroll instead of clip. */
      padding-top: 76px;
      min-height: 100svh;
    }

    .launchpad-main {
      max-width: none;
      padding: 0;
      /* The base margin:0 auto must go: auto inline margins on a grid item
         mean shrink-to-fit, and the tiles' content is absolutely positioned,
         so the whole grid collapsed to its strip row's width (~390px). */
      margin: 0;
      width: 100%;
    }
  }
</style>
