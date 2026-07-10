<script lang="ts">
  import { onMount } from "svelte";
  import HeroCarouselSection from "./landing/components/HeroCarouselSection.svelte";
  import LazyHowTkaWorksSection from "./landing/components/LazyHowTkaWorksSection.svelte";
  import PlayWithItSection from "./landing/components/PlayWithItSection.svelte";
  import GuidesSection from "./landing/components/GuidesSection.svelte";
  import ShopCtaSection from "./landing/components/ShopCtaSection.svelte";
  import LandingFooter from "./landing/components/LandingFooter.svelte";
  import FaqAccordion from "$lib/shared/landing/components/FaqAccordion.svelte";

  onMount(() => {
    // Cosmic background + SiteHeader are provided by MarketingChrome (root layout).

    // Scroll-triggered reveal animations for all sections below the hero
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );

    requestAnimationFrame(() => {
      document.querySelectorAll(".scroll-reveal").forEach((el) => {
        observer.observe(el);
      });
    });

    return () => observer.disconnect();
  });
</script>

<svelte:head>
  <!-- Playfair Display for landing page headings -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600&display=swap"
    rel="stylesheet"
  />

  <title
    >TKA - The Kinetic Alphabet | Flow Arts Notation for Staff, Clubs, Fans,
    Hoops & More</title
  >
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
  <meta name="application-name" content="TKA Composer" />
  <meta name="generator" content="SvelteKit" />

  <!-- Geographic targeting (global, but origin matters for trust) -->
  <meta name="geo.region" content="US" />
  <meta name="language" content="English" />

  <!-- Open Graph (Facebook, LinkedIn, Pinterest) -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="TKA - The Kinetic Alphabet" />
  <meta property="og:url" content="https://tkaflowarts.com/" />
  <meta property="og:title" content="TKA | A Flow Arts Notation System" />
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
    content="TKA Composer - Flow arts choreography app showing staff sequence animation"
  />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:locale" content="en_US" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@tkaflowarts" />
  <meta name="twitter:creator" content="@tkaflowarts" />
  <meta name="twitter:title" content="TKA | A Flow Arts Notation System" />
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
    content="TKA Composer - Flow arts notation app showing staff sequence animation"
  />

  <!-- Canonical URL -->
  <link rel="canonical" href="https://tkaflowarts.com/" />

  <!-- JSON-LD Structured Data: WebSite with SearchAction -->
  {@html `<script type="application/ld+json">
	{
		"@context": "https://schema.org",
		"@type": "WebSite",
		"name": "TKA - The Kinetic Alphabet",
		"alternateName": ["The Kinetic Alphabet", "TKA Composer", "Kinetic Alphabet", "TKA", "Flow Arts Notation"],
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
		"alternateName": ["The Kinetic Alphabet", "TKA", "Flow Arts Notation"],
		"url": "https://tkaflowarts.com/",
		"logo": "https://tkaflowarts.com/pwa/icons/icon-512x512.png",
		"description": "TKA is a notation system for flow arts. Document and share staff, fans, hoop, club, fan, and buugeng choreography.",
		"foundingDate": "2024",
		"sameAs": [
			"https://instagram.com/tkaflowarts",
			"https://facebook.com/tkaflowarts"
		],
		"contactPoint": {
			"@type": "ContactPoint",
			"contactType": "customer support",
			"email": "support@tkaflowarts.com"
		}
	}
	</script>`}

  <!-- JSON-LD Structured Data: SoftwareApplication -->
  {@html `<script type="application/ld+json">
	{
		"@context": "https://schema.org",
		"@type": "SoftwareApplication",
		"name": "TKA Composer",
		"alternateName": "The Kinetic Alphabet Composer",
		"description": "Create, animate, and share staff, clubs, fans, hoops, buugeng, and sword sequences. A notation system for flow arts.",
		"url": "https://tkaflowarts.com/create",
		"applicationCategory": "EducationalApplication",
		"operatingSystem": "Any (Web Browser)",
		"browserRequirements": "Requires JavaScript. Works on Chrome, Firefox, Safari, Edge.",
		"softwareVersion": "1.0",
		"releaseNotes": "https://tkaflowarts.com/changelog",
		"image": "https://tkaflowarts.com/branding/og-image.png",
		"screenshot": "https://tkaflowarts.com/branding/og-image.png",
		"datePublished": "2024-01-01",
		"inLanguage": "en-US",
		"featureList": [
			"Create sequences by hand or generate them automatically",
			"Animate sequences in 2D with motion trails",
			"Export to PNG, PDF, GIF, or video",
			"Browse community sequences",
			"Learn with progressive lessons",
			"Practice with real-time feedback",
			"Support for many prop types"
		],
		"offers": {
			"@type": "Offer",
			"price": "0",
			"priceCurrency": "USD",
			"availability": "https://schema.org/InStock"
		},
		"author": {
			"@type": "Organization",
			"name": "The Kinetic Alphabet",
			"url": "https://tkaflowarts.com/"
		}
	}
	</script>`}

  <!-- FAQPage JSON-LD is emitted by <FaqAccordion emitSchema> in the body, from
       the canonical FAQ_ITEMS, so the schema matches the visible on-page FAQ. -->

  <!-- JSON-LD Structured Data: HowTo for tutorial discovery -->
  {@html `<script type="application/ld+json">
	{
		"@context": "https://schema.org",
		"@type": "HowTo",
		"name": "How to Create Flow Arts Choreography with TKA Composer",
		"description": "Learn to create, animate, and share staff, clubs, fans, and hoop sequences using TKA notation.",
		"image": "https://tkaflowarts.com/branding/og-image.png",
		"totalTime": "PT10M",
		"tool": [
			{
				"@type": "HowToTool",
				"name": "Web browser (Chrome, Firefox, Safari, or Edge)"
			}
		],
		"step": [
			{
				"@type": "HowToStep",
				"position": 1,
				"name": "Open TKA Composer",
				"text": "Visit tkaflowarts.com/create to launch the free web application.",
				"url": "https://tkaflowarts.com/create",
				"image": "https://tkaflowarts.com/branding/og-image.png"
			},
			{
				"@type": "HowToStep",
				"position": 2,
				"name": "Choose a creation mode",
				"text": "Choose how to build: by hand step-by-step, or let the app generate patterns for you.",
				"image": "https://tkaflowarts.com/branding/og-image.png"
			},
			{
				"@type": "HowToStep",
				"position": 3,
				"name": "Build your sequence",
				"text": "Add movements by selecting start positions, hand motions, and transitions. Each beat is represented as a pictograph.",
				"image": "https://tkaflowarts.com/branding/og-image.png"
			},
			{
				"@type": "HowToStep",
				"position": 4,
				"name": "Animate and preview",
				"text": "Switch to the Animate module to watch your sequence come alive with 2D visualization and motion trails.",
				"image": "https://tkaflowarts.com/branding/og-image.png"
			},
			{
				"@type": "HowToStep",
				"position": 5,
				"name": "Export and share",
				"text": "Export your choreography as PNG, PDF, GIF, or video. Share to Instagram or publish to the community gallery.",
				"image": "https://tkaflowarts.com/branding/og-image.png"
			}
		]
	}
	</script>`}
</svelte:head>

<div class="landing-page">
  <!-- Cosmic background + SiteHeader come from MarketingChrome (root layout). -->
  <a href="#main-content" class="skip-link">Skip to main content</a>

  <div class="content-layer">
    <HeroCarouselSection />
    <main id="main-content">
      <hr class="divider" />
      <LazyHowTkaWorksSection />
      <hr class="divider" />
      <div class="scroll-reveal">
        <PlayWithItSection />
      </div>
      <hr class="divider" />
      <div class="scroll-reveal">
        <GuidesSection />
      </div>
      <hr class="divider" />
      <div class="scroll-reveal">
        <ShopCtaSection />
      </div>
      <hr class="divider" />
      <div class="scroll-reveal">
        <FaqAccordion emitSchema />
      </div>
    </main>
    <LandingFooter />
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

  .divider {
    border: none;
    border-top: 1px solid rgba(255, 255, 255, 0.07);
    margin: 0;
  }

  /* Scroll-triggered reveal animations */
  :global(.scroll-reveal) {
    opacity: 0;
    transform: translateY(32px);
    transition: opacity 0.7s ease, transform 0.7s ease;
  }

  :global(.scroll-reveal.revealed) {
    opacity: 1;
    transform: translateY(0);
  }

  @media (prefers-reduced-motion: reduce) {
    :global(.scroll-reveal) {
      opacity: 1;
      transform: none;
      transition: none;
    }
  }
</style>
