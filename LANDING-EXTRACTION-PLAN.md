# TKA Landing Page Extraction Plan

## Executive Summary

Extract the public-facing landing page from TKA Composer (tkacomposer.com) into a standalone SvelteKit project deployed to tkaflowarts.com. The admin tools (LandingPreviewModule, VideoCurator) stay in Composer. The animation demo embeds via iframe from Composer.

---

## Current Architecture

The root `+page.svelte` uses domain detection (`detectSiteMode`) to render either:
- **"app" mode** → MainApplication (tkacomposer.com)
- **"landing" mode** → Landing page sections (tkaflowarts.com)

Both are bundled in the same codebase, sharing imports from `$lib/`.

---

## File Inventory

### Files That MOVE to Standalone Project

| File | Purpose |
|------|---------|
| `src/routes/landing/components/HeroSection.svelte` | Hero banner with CTA buttons |
| `src/routes/landing/components/WhatIsTKASection.svelte` | "What is TKA" explainer |
| `src/routes/landing/components/NotationShowcaseSection.svelte` | Pictograph showcase |
| `src/routes/landing/components/FeaturesSection.svelte` | Features grid |
| `src/routes/landing/components/FAQSection.svelte` | FAQ accordion |
| `src/routes/landing/components/EducatorsSection.svelte` | Educators callout |
| `src/routes/landing/components/LOOPsSection.svelte` | LOOPs explainer |
| `src/routes/landing/components/NotationSection.svelte` | Notation explainer |
| `src/routes/landing/components/PropsSection.svelte` | Supported props list |
| `src/routes/landing/components/ShowcaseSection.svelte` | General showcase |
| `src/routes/landing/components/LandingFooter.svelte` | Footer with links |
| `src/routes/landing/components/LandingBackgroundPicker.svelte` | Background theme picker |
| `src/routes/landing/landing-content.ts` | Static content/copy |

### Files That STAY in Scribe (Admin Tools)

| File | Purpose |
|------|---------|
| `src/lib/features/landing-preview/LandingPreviewModule.svelte` | Admin module host |
| `src/lib/features/landing-preview/components/VideoCurator.svelte` | Video curation UI |
| `src/lib/features/landing-preview/components/VideoEditModal.svelte` | Video metadata editor |
| `src/lib/features/landing-preview/components/video-editor/**` | All editor panels |
| `src/lib/features/landing-preview/services/**` | Loader, Persister, SequenceMatcher |
| `src/lib/features/landing-preview/state/**` | VideoEditorController |
| `src/lib/features/landing-preview/types.ts` | Shared types |

### Files with ENTANGLEMENTS (Special Handling Required)

| File | Dependencies | Strategy |
|------|-------------|----------|
| `LandingAnimationDemo.svelte` | 20+ deep imports from animation engine, DI container, compose/browse/create modules | **iframe embed** |
| `VideoShowcaseSection.svelte` | Firebase Firestore (`showcaseVideos` collection), `EndlessVideoPlayer` | Own Firebase init in standalone |
| `HeroInstallFlow.svelte` | DI container (`IPlatformDetector`) | Inline platform detection |
| `InAppBrowserModal.svelte` | Used by HeroInstallFlow | Move with HeroInstallFlow |
| `IOSInstallInstructions.svelte` | Used by HeroInstallFlow | Move with HeroInstallFlow |
| `DemoControlBar.svelte` | Used by LandingAnimationDemo | Stays in Scribe (iframe) |

---

## Dependency Analysis

### LandingAnimationDemo.svelte

**Import chain (partial):**
```
LandingAnimationDemo.svelte
├── $lib/shared/animation-engine/components/AnimatorCanvas.svelte
├── $lib/shared/foundation/domain/models/SequenceData
├── $lib/features/create/shared/domain/models/StepData
├── $lib/features/compose/services/contracts/IAnimationPlaybackController
├── $lib/features/browse/sequences/display/services/contracts/IBrowseLoader
├── $lib/shared/pictograph/shared/services/contracts/IStartPositionDeriver
├── $lib/features/landing/services/contracts/IEndlessSpinnerOrchestrator
├── $lib/features/compose/state/animation-panel-state.svelte
├── $lib/shared/di (container)
├── $lib/shared/pictograph/grid/services/**
├── $lib/features/create/generate/shared/services/implementations/GenerationOrchestrator
└── ... 10+ more deep imports
```

**Strategy:** iframe embed. Extracting this would require duplicating 50% of the codebase.

### VideoShowcaseSection.svelte

**Import chain:**
```
VideoShowcaseSection.svelte
├── $lib/features/landing-preview/components/EndlessVideoPlayer.svelte
├── $lib/features/landing-preview/types (ShowcaseVideo)
└── $lib/shared/auth/firebase (getFirestoreInstance)
```

**Strategy:** Extract with own Firebase init. EndlessVideoPlayer can be copied to standalone.

### HeroInstallFlow.svelte

**Import chain:**
```
HeroInstallFlow.svelte
├── $lib/shared/di (container)
├── $lib/shared/mobile/services/contracts/IPlatformDetector
├── ../../../config/domains (APP_DOMAIN)
├── ./InAppBrowserModal.svelte
└── ./IOSInstallInstructions.svelte
```

**Strategy:** Inline platform detection (replace DI lookup with direct implementation).

---

## Phase 1: Standalone SvelteKit Project

### Step 1: Scaffold Project

```bash
cd F:\
npm create svelte@latest tka-landing
cd tka-landing
npm install
npm install @austencloud/backgrounds firebase
```

### Step 2: Copy Clean Components

These have no deep entanglements:
- `WhatIsTKASection.svelte`
- `FeaturesSection.svelte`
- `FAQSection.svelte`
- `EducatorsSection.svelte`
- `LOOPsSection.svelte`
- `NotationSection.svelte`
- `PropsSection.svelte`
- `ShowcaseSection.svelte`
- `LandingFooter.svelte` (simplify LegalSheet to static links)
- `LandingBackgroundPicker.svelte`
- `landing-content.ts`

### Step 3: Create HeroSection (Simplified)

Copy `HeroSection.svelte` but:
- Replace `HeroInstallFlow` with inline platform detection
- Replace `LandingAnimationDemo` with placeholder (static image or video)

### Step 4: Firebase Setup (Read-Only)

Create `src/lib/firebase.ts`:
```typescript
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  // Same config as TKA Scribe (read-only access)
  projectId: 'tka-platform',
  // ... other config
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
```

### Step 5: Placeholder for Animation Demo

Options:
1. Static image showing animation frame
2. Embedded GIF/video recording
3. Simple "Coming soon" with link to tkascribe.com

### Step 6: Netlify Deployment

Create `netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = "build"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

Environment: Set `PUBLIC_FIREBASE_*` variables in Netlify dashboard.

---

## Phase 2: Live Video Showcase

### Step 1: Extract EndlessVideoPlayer

Copy from `src/lib/features/landing-preview/components/EndlessVideoPlayer.svelte`.

Update imports to use local Firebase instance.

### Step 2: Extract VideoShowcaseSection

Copy from `src/routes/landing/components/VideoShowcaseSection.svelte`.

Update Firebase imports:
```typescript
// Before (in Scribe)
import { getFirestoreInstance } from "$lib/shared/auth/firebase";

// After (in standalone)
import { db } from '$lib/firebase';
```

### Step 3: Copy Types

Copy `ShowcaseVideo` type from `src/lib/features/landing-preview/types.ts`.

---

## Phase 3: Animation Demo via iframe

### Create `/embed/spinner` Route in Scribe

`src/routes/embed/spinner/+page.svelte`:
```svelte
<script lang="ts">
  import LandingAnimationDemo from '../../landing/components/LandingAnimationDemo.svelte';
</script>

<div class="embed-container">
  <LandingAnimationDemo />
</div>

<style>
  .embed-container {
    width: 100%;
    height: 100vh;
    background: transparent;
  }
</style>
```

### Embed in Standalone Landing

```svelte
<iframe
  src="https://tkascribe.com/embed/spinner"
  class="animation-demo"
  title="TKA Animation Demo"
  loading="lazy"
/>
```

### Benefits

- Animation demo always uses latest engine
- Zero code duplication
- Changes to animation system automatically reflect on landing
- Scribe controls the implementation

---

## Phase 4: Remove Landing from Scribe

### Step 1: Remove Domain Detection

In `src/routes/+page.svelte`, remove:
```typescript
import { detectSiteMode } from "../config/domains";
// ... landing mode handling
```

Replace with direct MainApplication render.

### Step 2: Remove Landing Route Group

Delete:
- `src/routes/landing/` (all files)
- `src/routes/(public)/landing/` (if exists)

### Step 3: Keep Admin Tools

These remain in Scribe:
- `src/lib/features/landing-preview/` (entire directory)
- Lab tab routing that hosts LandingPreviewModule

### Step 4: Update Domain Config

In `src/config/domains.ts`:
```typescript
// Remove landing domain handling
// tkaflowarts.com now handled by separate project
```

---

## Domain Migration Checklist

### DNS Changes

| Domain | Current | Target |
|--------|---------|--------|
| tkaflowarts.com | Points to Scribe | Points to Netlify (standalone) |
| www.tkaflowarts.com | Points to Scribe | Points to Netlify (standalone) |
| tkascribe.com | Scribe app | Unchanged |

### Redirect Setup

In standalone Netlify, add redirects for any old landing URLs:
```toml
[[redirects]]
  from = "/app"
  to = "https://tkascribe.com/"
  status = 301
```

### SEO Considerations

1. **Canonical URLs** - Update to tkaflowarts.com
2. **Sitemap** - Generate for standalone site
3. **robots.txt** - Allow indexing
4. **Structured data** - Keep all JSON-LD from current +page.svelte
5. **Social meta** - Update og:url to tkaflowarts.com

### Post-Migration Verification

- [ ] tkaflowarts.com loads standalone landing
- [ ] tkascribe.com loads Scribe app directly (no landing mode)
- [ ] /embed/spinner route works on tkascribe.com
- [ ] iframe embed works on standalone landing
- [ ] Video showcase loads from Firestore
- [ ] All SEO meta tags present
- [ ] Netlify build succeeds
- [ ] Admin tools in Scribe still functional

---

## Timeline Estimate

| Phase | Effort |
|-------|--------|
| Phase 1: Standalone project with placeholders | 1-2 days |
| Phase 2: Video showcase integration | 0.5 day |
| Phase 3: iframe embed route | 0.5 day |
| Phase 4: Remove landing from Scribe | 0.5 day |
| DNS migration + verification | 0.5 day |
| **Total** | **3-4 days** |

---

## Open Questions

1. Should the animation demo iframe have any communication with the parent page (e.g., theme sync)?
2. Should video showcase data be cached in the standalone project or always fetch live?
3. Any sections currently rendered on landing that aren't listed here?
