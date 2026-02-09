<script lang="ts">
  import { onMount } from "svelte";
  import { detectSiteMode, type SiteMode } from "../config/domains";
  import BackgroundHost from "$lib/shared/background/shared/components/BackgroundHost.svelte";
  import { BackgroundType } from "@austencloud/backgrounds";
  import { applyThemeForBackground } from "$lib/shared/settings/utils/background-theme-calculator";
  import HeroSection from "./landing/components/HeroSection.svelte";
  import NotationShowcaseSection from "./landing/components/NotationShowcaseSection.svelte";
  import WhatIsTKASection from "./landing/components/WhatIsTKASection.svelte";
  import LandingFooter from "./landing/components/LandingFooter.svelte";
  import LandingBackgroundPicker from "./landing/components/LandingBackgroundPicker.svelte";
  import MainApplication from "$lib/shared/application/components/MainApplication.svelte";

  const STORAGE_KEY = "tka-landing-theme";
  const DEFAULT_BACKGROUND = BackgroundType.NIGHT_SKY;

  /**
   * Site mode determines which experience to render based on domain.
   * Extensible for future portals (embed, kiosk, edu, etc.)
   */
  let siteMode = $state<SiteMode>("loading");
  let currentBackground = $state<BackgroundType>(DEFAULT_BACKGROUND);
  let mounted = $state(false);

  onMount(() => {
    siteMode = detectSiteMode(window.location.origin);
    if (siteMode === "app") {
      (window as any).__tkaLoadProgress?.(84, "Resolving services...");
    }

    // For landing mode, load saved background preference
    if (siteMode === "landing") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && Object.values(BackgroundType).includes(saved as BackgroundType)) {
        currentBackground = saved as BackgroundType;
      }
      applyThemeForBackground(currentBackground);
    }
    mounted = true;
  });

  function handleBackgroundChange(type: BackgroundType) {
    currentBackground = type;
    applyThemeForBackground(type);
    localStorage.setItem(STORAGE_KEY, type);
  }
</script>

<svelte:head>
  {#if siteMode === "app"}
    <title>TKA Scribe - Create, record, and share flow arts choreography</title>
  {:else}
    <title
      >TKA - The Kinetic Alphabet | Flow Arts Notation for Staff, Clubs, Fans,
      Hoops & More</title
    >
  {/if}
  <meta
    name="description"
    content="TKA is a notation system for flow arts. Document and share staff, fans, hoop, club, fan, and buugeng choreography. Create sequences, animate them, share with other flow artists."
  />

  <!-- Keywords for search engines and AI systems -->
  <meta
    name="keywords"
    content="flow arts notation, flow arts notation system, dual wielded props, staff notation, staff spinning notation, fan notation, club notation, hoop notation, buugeng notation, prop notation, TKA, The Kinetic Alphabet, TKA flow arts, TKA notation, flow arts choreography, movement notation, dance notation, prop manipulation notation, sequence notation, pictograph notation, flow arts, staff spinning, club manipulation, fan spinning, hoop dance, buugeng, prop manipulation, choreography app, sequence creator"
  />

  <!-- Additional SEO meta tags -->
  <meta
    name="robots"
    content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
  />
  <meta name="author" content="The Kinetic Alphabet" />
  <meta name="application-name" content="TKA Scribe" />
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
    content="TKA Scribe - Flow arts choreography app showing staff sequence animation"
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
    content="TKA Scribe - Flow arts choreography app showing poi sequence animation"
  />

  <!-- Canonical URL -->
  <link rel="canonical" href="https://tkaflowarts.com/" />

  <!-- JSON-LD Structured Data: WebSite with SearchAction -->
  {@html `<script type="application/ld+json">
	{
		"@context": "https://schema.org",
		"@type": "WebSite",
		"name": "TKA - The Kinetic Alphabet",
		"alternateName": ["The Kinetic Alphabet", "TKA Scribe", "Kinetic Alphabet", "TKA", "Flow Arts Notation"],
		"url": "https://tkaflowarts.com/",
		"description": "TKA is a notation system for flow arts. Document and share staff, fans, hoop, club, fan, and buugeng choreography.",
		"inLanguage": "en-US",
		"potentialAction": {
			"@type": "SearchAction",
			"target": {
				"@type": "EntryPoint",
				"urlTemplate": "https://tkascribe.com/?search={search_term_string}"
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
			"email": "support@tkascribe.com"
		}
	}
	</script>`}

  <!-- JSON-LD Structured Data: SoftwareApplication -->
  {@html `<script type="application/ld+json">
	{
		"@context": "https://schema.org",
		"@type": "SoftwareApplication",
		"name": "TKA Scribe",
		"alternateName": "The Kinetic Alphabet Scribe",
		"description": "Create, animate, and share staff, clubs, fans, hoops, buugeng, and sword sequences. A notation system for flow arts.",
		"url": "https://tkascribe.com/",
		"applicationCategory": ["EducationalApplication", "EntertainmentApplication", "DesignApplication"],
		"operatingSystem": "Any (Web Browser)",
		"browserRequirements": "Requires JavaScript. Works on Chrome, Firefox, Safari, Edge.",
		"softwareVersion": "1.0",
		"releaseNotes": "https://tkascribe.com/changelog",
		"screenshot": "https://tkaflowarts.com/branding/og-image.png",
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

  <!-- JSON-LD Structured Data: FAQPage for Featured Snippets -->
  {@html `<script type="application/ld+json">
	{
		"@context": "https://schema.org",
		"@type": "FAQPage",
		"mainEntity": [
			{
				"@type": "Question",
				"name": "What is flow arts notation?",
				"acceptedAnswer": {
					"@type": "Answer",
					"text": "Flow arts notation is a system for writing down prop manipulation movements like staff, fans, hoop, and club choreography. TKA (The Kinetic Alphabet) is a flow arts notation system that uses pictographs to represent each beat of movement, showing hand positions, motion types, and prop orientation."
				}
			},
			{
				"@type": "Question",
				"name": "Is there a notation system for poi?",
				"acceptedAnswer": {
					"@type": "Answer",
					"text": "Yes, TKA (The Kinetic Alphabet) is a notation system that supports poi and many other props. It lets you document poi patterns like flowers, antispins, isolations, and extensions using visual pictographs. Each pictograph shows exactly where your hands are and how the poi moves."
				}
			},
			{
				"@type": "Question",
				"name": "How do you write down staff spinning moves?",
				"acceptedAnswer": {
					"@type": "Answer",
					"text": "TKA provides staff notation using pictographs that capture hand positions on a grid, motion types (prospin, antispin, static), direction, and number of turns. You can notate contact staff, double staff, and dragon staff sequences and share them with other spinners."
				}
			},
			{
				"@type": "Question",
				"name": "What does TKA stand for?",
				"acceptedAnswer": {
					"@type": "Answer",
					"text": "TKA stands for The Kinetic Alphabet, a flow arts notation system for documenting and sharing staff, fans, hoop, club, fan, and buugeng choreography."
				}
			},
			{
				"@type": "Question",
				"name": "What is The Kinetic Alphabet?",
				"acceptedAnswer": {
					"@type": "Answer",
					"text": "The Kinetic Alphabet (TKA) is a notation system for flow arts - like sheet music for dancers. It lets flow artists document, share, and learn staff, clubs, fans, hoops, buugeng, and sword choreography using pictographs and symbols."
				}
			},
			{
				"@type": "Question",
				"name": "What props does TKA Scribe support?",
				"acceptedAnswer": {
					"@type": "Answer",
					"text": "TKA Scribe supports many flow props: staff, contact staff, double staff, clubs, fans, triads, hoops, mini hoops, buugeng, swords, and more. Each prop is rendered with proper rotations and hand positions."
				}
			},
			{
				"@type": "Question",
				"name": "Is TKA Scribe free to use?",
				"acceptedAnswer": {
					"@type": "Answer",
					"text": "Yes, TKA Scribe is completely free. You can create sequences, animate them, export to various formats, and browse the community library at no cost. The app is open and accessible to all flow artists."
				}
			},
			{
				"@type": "Question",
				"name": "How do I learn flow arts with TKA?",
				"acceptedAnswer": {
					"@type": "Answer",
					"text": "TKA Scribe includes progressive lessons from grid basics to advanced LOOPs. Interactive quizzes help reinforce understanding, and the Train module offers daily challenges to track your progress."
				}
			},
			{
				"@type": "Question",
				"name": "Can I share my sequences with other flow artists?",
				"acceptedAnswer": {
					"@type": "Answer",
					"text": "Yes. Export sequences as PNG images, PDFs, animated GIFs, or videos. Share links directly to Instagram, or publish to the community gallery for other artists to find."
				}
			}
		]
	}
	</script>`}

  <!-- JSON-LD Structured Data: HowTo for tutorial discovery -->
  {@html `<script type="application/ld+json">
	{
		"@context": "https://schema.org",
		"@type": "HowTo",
		"name": "How to Create Flow Arts Choreography with TKA Scribe",
		"description": "Learn to create, animate, and share staff, clubs, fans, and hoop sequences using TKA notation.",
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
				"name": "Open TKA Scribe",
				"text": "Visit tkascribe.com to launch the free web application.",
				"url": "https://tkascribe.com/"
			},
			{
				"@type": "HowToStep",
				"position": 2,
				"name": "Choose a creation mode",
				"text": "Choose how to build: by hand step-by-step, or let the app generate patterns for you."
			},
			{
				"@type": "HowToStep",
				"position": 3,
				"name": "Build your sequence",
				"text": "Add movements by selecting start positions, hand motions, and transitions. Each beat is represented as a pictograph."
			},
			{
				"@type": "HowToStep",
				"position": 4,
				"name": "Animate and preview",
				"text": "Switch to the Animate module to watch your sequence come alive with 2D visualization and motion trails."
			},
			{
				"@type": "HowToStep",
				"position": 5,
				"name": "Export and share",
				"text": "Export your choreography as PNG, PDF, GIF, or video. Share to Instagram or publish to the community gallery."
			}
		]
	}
	</script>`}
</svelte:head>

{#if siteMode === "loading"}
  <!-- Brief loading state while determining domain -->
  <div class="loading-screen">
    <div class="loading-spinner"></div>
  </div>
{:else if siteMode === "app"}
  <!-- App domain: render the application directly -->
  <MainApplication />
{:else if siteMode === "landing"}
  <!-- Landing domain: render the marketing page -->
  <div class="landing-page">
    <!-- Background layer -->
    {#if mounted}
      <div class="background-layer">
        <BackgroundHost
          backgroundType={currentBackground}
        />
      </div>
    {/if}

    <!-- Content layer -->
    <a href="#main-content" class="skip-link">Skip to main content</a>

    <div class="content-layer">
      <HeroSection />
      <main id="main-content">
        <NotationShowcaseSection />
        <WhatIsTKASection />
      </main>
      <LandingFooter />
    </div>

    <!-- Background picker -->
    <LandingBackgroundPicker
      {currentBackground}
      onSelect={handleBackgroundChange}
    />
  </div>
{:else}
  <!-- Future: other site modes (embed, kiosk, edu, etc.) -->
  <MainApplication />
{/if}

<style>
  /* Loading screen - brief flash while determining domain */
  .loading-screen {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0a0a0f;
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(99, 102, 241, 0.2);
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

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
    z-index: 9999;
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
    color: var(--theme-text, #ffffff);
    line-height: 1.6;
    overflow-x: hidden;
  }

  .background-layer {
    position: fixed;
    inset: 0;
    z-index: 0;
  }

  .content-layer {
    position: relative;
    z-index: 1;
  }

  /* Accessibility: Respect user's motion preferences (WCAG AAA) */
  @media (prefers-reduced-motion: reduce) {
    .loading-spinner {
      animation: none;
    }
  }
</style>
