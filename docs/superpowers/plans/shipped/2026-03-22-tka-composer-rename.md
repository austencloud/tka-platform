# TKA Composer Rename — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename all brand references from "TKA Scribe" to "TKA Composer" across the codebase.

**Architecture:** Pure string replacements. No logic, routing, or structural changes. Each task is a batch of related files grouped by domain. Verification is `npm run build && npm run check` after all tasks.

**Tech Stack:** Find-and-replace across TypeScript, Svelte, JSON, HTML, CSS, Markdown, and config files.

**Spec:** `docs/superpowers/specs/2026-03-22-tka-composer-rename-design.md`

---

## Important Rules

1. **Retro/lore files are OUT OF SCOPE.** Do not touch files in `src/lib/features/retro/`. "TKA Scribe 98" and "TKA Scribe XP" are fictional historical product names.
2. **Historical docs are OUT OF SCOPE.** Do not touch files in `docs/superpowers/specs/`, `docs/superpowers/plans/` (except this plan), `docs/grants/drafts/`, `docs/museum/`, `docs/adr/`. They reference the name at time of writing.
3. **Domain/URL references stay.** `tkascribe.com` is the domain — don't change URLs, only change display names and descriptions.
4. **PWA `id` stays as `tka-scribe-2025`.** Changing it breaks installed app identity.
5. **Android `packageId` stays as `com.tkascribe.app`.** Package name changes require a new Play Store listing.
6. **Keystore references stay.** `tka-scribe-keystore.jks` and `tka-scribe` alias are file/key names, not brand.
7. **WebAuthn `rpName`**: Change to "TKA Composer" — the rpName is a display label, not a cryptographic identifier. The `rpID` (domain) is what passkeys bind to, and that stays `tkascribe.com`.
8. **Keep "TKA Scribe" as `alternateName`** in SEO structured data for search continuity.
9. **Compiled/build artifacts are OUT OF SCOPE.** Do not edit files in `deployment/functions/lib/`, `.svelte-kit/`, `build/`, etc. They will be regenerated.
10. **After renaming package.json files**, run `npm install` in `firebase-functions/` and `deployment/functions/` to regenerate their lockfiles.
11. **Deployment note:** After this rename, update the live `.env` file on the server to set `PUBLIC_APP_NAME=TKA Composer`.

---

### Task 1: Core App Identity

**Files:**
- Modify: `package.json` (line 2)
- Modify: `src/app.html` (2 locations)
- Modify: `src/config/domains.ts` (lines 6, 153, 155, 157)
- Modify: `README.md` (line 1)
- Modify: `vite.config.ts` (comment)

- [ ] **Step 1: Update package.json**

Change `"name": "@tka/scribe"` to `"name": "@tka/composer"`

- [ ] **Step 2: Update src/app.html**

Change both:
- `content="TKA Scribe"` to `content="TKA Composer"`
- `aria-label="Loading TKA Scribe"` to `aria-label="Loading TKA Composer"`

- [ ] **Step 3: Update src/config/domains.ts**

- Comment: `tkascribe.com: The app (TKA Scribe product)` to `tkascribe.com: The app (TKA Composer product)`
- `siteName: "TKA Scribe"` to `siteName: "TKA Composer"`
- Update description and keywords strings: replace "TKA Scribe" with "TKA Composer"

- [ ] **Step 4: Update README.md**

`# TKA Scribe` to `# TKA Composer`

- [ ] **Step 5: Update vite.config.ts comment**

Replace any "TKA Scribe" comment reference.

- [ ] **Step 6: Commit**

```bash
git add package.json src/app.html src/config/domains.ts README.md vite.config.ts
git commit -m "feat: rename TKA Scribe to TKA Composer — core identity"
```

---

### Task 2: PWA Manifests & Static Assets

**Files:**
- Modify: `static/pwa/manifest.webmanifest` (name, short_name only — keep id)
- Modify: `static/pwa/manifest-launcher.webmanifest`
- Modify: `static/firebase-messaging-handler.js` (line 32)
- Modify: `static/sitemap.xml`
- Modify: `static/robots.txt`
- Modify: `static/branding/og-image.html`

- [ ] **Step 1: Update manifest.webmanifest**

- `"name": "TKA Scribe"` to `"name": "TKA Composer"`
- `"short_name": "TKA Scribe"` to `"short_name": "TKA Composer"`
- **DO NOT** change `"id": "tka-scribe-2025"` — this preserves installed PWA identity

- [ ] **Step 2: Update manifest-launcher.webmanifest**

`"name": "TKA Scribe Launcher"` to `"name": "TKA Composer Launcher"`

- [ ] **Step 3: Update firebase-messaging-handler.js**

`"TKA Scribe"` to `"TKA Composer"` (push notification fallback title)

- [ ] **Step 4: Update sitemap.xml**

Replace "TKA Scribe" in image captions.

- [ ] **Step 5: Update robots.txt**

Replace "TKA Scribe" in comment.

- [ ] **Step 6: Update og-image.html**

Replace "TKA Scribe" in OG image template.

- [ ] **Step 7: Commit**

```bash
git add static/
git commit -m "feat: rename TKA Scribe to TKA Composer — PWA & static assets"
```

---

### Task 3: Firebase Functions & Email Templates

**Files:**
- Modify: `firebase-functions/package.json` (lines 2, 4)
- Modify: `firebase-functions/src/sendMagicLink.ts` (6 instances)
- Modify: `firebase-functions/src/templates/magic-link.html` (3 instances)
- Modify: `firebase-functions/src/index.ts` (1 comment)
- Modify: `deployment/functions/package.json` (lines 2, 4)
- Modify: `deployment/functions/src/index.ts` (comment)

- [ ] **Step 1: Update firebase-functions/package.json**

- `"name": "tka-scribe-functions"` to `"name": "tka-composer-functions"`
- `"description": "Firebase Cloud Functions for TKA Scribe"` to `"description": "Firebase Cloud Functions for TKA Composer"`

- [ ] **Step 2: Update deployment/functions/package.json**

Same changes as step 1.

- [ ] **Step 3: Update sendMagicLink.ts**

Replace all 6 instances of "TKA Scribe" with "TKA Composer".

- [ ] **Step 4: Update magic-link.html**

Replace all 3 instances of "TKA Scribe" with "TKA Composer".

- [ ] **Step 5: Update firebase-functions/src/index.ts and deployment/functions/src/index.ts**

Replace comment references.

- [ ] **Step 6: Regenerate lockfiles**

```bash
cd firebase-functions && npm install && cd ..
cd deployment/functions && npm install && cd ../..
```

- [ ] **Step 7: Commit**

```bash
git add firebase-functions/ deployment/functions/
git commit -m "feat: rename TKA Scribe to TKA Composer — Firebase & email"
```

---

### Task 4: i18n Message Files

**Files:**
- Modify: `messages/en.json` (9 instances)
- Modify: `messages/ar.json`, `messages/de.json`, `messages/es.json`, `messages/fr.json`, `messages/it.json`, `messages/ja.json`, `messages/ko.json`, `messages/pt.json`, `messages/ru.json`, `messages/zh.json`

- [ ] **Step 1: Update en.json**

Replace all instances of "TKA Scribe" with "TKA Composer". This includes `app_name`, toast messages, descriptions, and any other brand references.

- [ ] **Step 2: Update all other language files**

For each of `ar.json`, `de.json`, `es.json`, `fr.json`, `it.json`, `ja.json`, `ko.json`, `pt.json`, `ru.json`, `zh.json`:
Replace all instances of "TKA Scribe" with "TKA Composer". The brand name is not translated — it stays "TKA Composer" in all languages.

- [ ] **Step 3: Commit**

```bash
git add messages/
git commit -m "feat: rename TKA Scribe to TKA Composer — i18n (11 languages)"
```

---

### Task 5: User-Facing UI Components (Shared)

**Files:**
- Modify: `src/lib/shared/onboarding/domain/first-run-types.ts`
- Modify: `src/lib/shared/onboarding/components/first-run/steps/WelcomeStep.svelte` (3 instances)
- Modify: `src/lib/shared/mobile/config/pwa-install-instructions.ts` (~12 instances)
- Modify: `src/lib/shared/foundation/services/implementations/SeoManager.ts`
- Modify: `src/lib/shared/voice-control/ai/voice-command-prompt.ts`
- Modify: `src/lib/shared/legal/components/LegalSheet.svelte` (8 instances)
- Modify: `src/lib/shared/i18n/i18n.svelte.ts` (comment)
- Modify: `src/lib/server/webauthn/webauthnConfig.ts`
- Modify: `src/lib/shared/application/components/MainApplication.svelte` (title + meta)
- Modify: `src/lib/shared/navigation/components/desktop-sidebar/SidebarHeader.svelte`
- Modify: `src/lib/shared/auth/components/InAppBrowserPrompt.svelte` (4 instances)
- Modify: `src/lib/shared/auth/components/LandingPage.svelte`
- Modify: `src/lib/shared/attribution/components/AttributionPrompt.svelte` (comment)
- Modify: `src/lib/shared/settings/components/tabs/release-notes/VersionDetailContent.svelte`
- Modify: `src/lib/shared/migration/components/MigrationModal.svelte`
- Modify: `src/lib/shared/migration/components/MigrationBanner.svelte`
- Modify: `src/lib/shared/sequence-viewer/components/ChoreoCard.svelte`
- Modify: `src/lib/shared/sequence-viewer/components/ViewerMorphToolbar.svelte`
- Modify: `src/lib/shared/sequence-viewer/components/ViewerFooter.svelte`

- [ ] **Step 1: Update onboarding**

- `first-run-types.ts`: `"Welcome to TKA Scribe"` to `"Welcome to TKA Composer"`
- `WelcomeStep.svelte`: Replace all 3 instances

- [ ] **Step 2: Update PWA install instructions**

Replace all ~12 instances of "TKA Scribe" with "TKA Composer" in `pwa-install-instructions.ts`.

- [ ] **Step 3: Update SeoManager.ts**

Replace "TKA Scribe" in default title and description.

- [ ] **Step 4: Update voice-command-prompt.ts**

Replace "TKA Scribe" in AI system prompt.

- [ ] **Step 5: Update LegalSheet.svelte**

Replace all 8 instances of "TKA Scribe" with "TKA Composer".

- [ ] **Step 6: Update i18n.svelte.ts**

Replace comment: `// "TKA Scribe"` to `// "TKA Composer"`

- [ ] **Step 7: Update webauthnConfig.ts**

`"TKA Scribe"` to `"TKA Composer"` (fallback rpName — display label only)

- [ ] **Step 8: Update MainApplication.svelte**

Replace `<title>TKA Scribe` and meta description.

- [ ] **Step 9: Update SidebarHeader.svelte**

Replace "TKA Scribe" brand text.

- [ ] **Step 10: Update auth components**

- `InAppBrowserPrompt.svelte`: Replace all 4 instances of "TKA Scribe"
- `LandingPage.svelte`: Replace `<h1>TKA Scribe</h1>`

- [ ] **Step 11: Update viewer components**

- `ChoreoCard.svelte`: Replace "Created using TKA Scribe" default prop
- `ViewerMorphToolbar.svelte`: Replace `aria-label="Get TKA Scribe"`
- `ViewerFooter.svelte`: Replace `aria-label="Get TKA Scribe"`

- [ ] **Step 12: Update settings/release notes**

- `VersionDetailContent.svelte`: Replace `"TKA Scribe v${version}"`

- [ ] **Step 13: Update migration components**

- `MigrationModal.svelte`: "TKA Studio is now TKA Scribe" to "TKA Studio is now TKA Composer"
- `MigrationBanner.svelte`: "keep using TKA Scribe" to "keep using TKA Composer"

- [ ] **Step 14: Update attribution**

- `AttributionPrompt.svelte`: Replace comment reference

- [ ] **Step 15: Commit**

```bash
git add src/lib/shared/ src/lib/server/
git commit -m "feat: rename TKA Scribe to TKA Composer — shared UI components"
```

---

### Task 6: Public Route Pages

**Files:**
- Modify: `src/routes/+page.svelte` (JSON-LD schema, multiple instances)
- Modify: `src/routes/(public)/about/+page.svelte` (3 instances)
- Modify: `src/routes/(public)/terms/+page.svelte` (7+ instances)
- Modify: `src/routes/(public)/privacy/+page.svelte` (10+ instances)
- Modify: `src/routes/(public)/delete-account/+page.svelte` (5+ instances)
- Modify: `src/routes/(public)/roots/+page.svelte`
- Modify: `src/routes/sequence/[id]/+page.svelte` (3 instances)
- Modify: `src/routes/p/[code]/+page.svelte` (5 instances)
- Modify: `src/routes/[...path]/+page.svelte`
- Modify: `src/routes/demo/promo-generator/+page.svelte`
- Modify: `src/routes/test/progress-variants/+page.svelte`
- Modify: `src/routes/test/progress-in-context/+page.svelte`
- Modify: `src/routes/test/infinite-worlds/+page.svelte`
- Modify: `src/routes/test/3d-animation/+page.svelte`

- [ ] **Step 1: Update homepage structured data**

In `src/routes/+page.svelte` JSON-LD schema:
- Replace "TKA Scribe" with "TKA Composer" in all instances EXCEPT:
- **Add or keep** `"alternateName": "TKA Scribe"` for search continuity
- Update FAQ answers, HowTo steps, SoftwareApplication name

- [ ] **Step 2: Update about page**

Replace all "TKA Scribe" in `(public)/about/+page.svelte`.

- [ ] **Step 3: Update legal pages**

- `(public)/terms/+page.svelte`: Replace all instances
- `(public)/privacy/+page.svelte`: Replace all instances
- `(public)/delete-account/+page.svelte`: Replace all instances

- [ ] **Step 4: Update other public routes**

- `(public)/roots/+page.svelte`: Replace CTA button text
- `sequence/[id]/+page.svelte`: Replace title and meta
- `p/[code]/+page.svelte`: Replace title and meta

- [ ] **Step 5: Update test/demo route titles**

Replace "TKA Scribe" in `<title>` tags for:
- `[...path]/+page.svelte`
- `demo/promo-generator/+page.svelte`
- `test/progress-variants/+page.svelte`
- `test/progress-in-context/+page.svelte`
- `test/infinite-worlds/+page.svelte`
- `test/3d-animation/+page.svelte`

- [ ] **Step 6: Commit**

```bash
git add src/routes/
git commit -m "feat: rename TKA Scribe to TKA Composer — public routes, SEO, legal"
```

---

### Task 7: Landing Page Components

**Files:**
- Modify: `src/routes/landing/components/FeaturesSection.svelte`
- Modify: `src/routes/landing/components/PropsSection.svelte`
- Modify: `src/routes/landing/components/HeroInstallFlow.svelte` (2 instances)
- Modify: `src/routes/landing/components/LandingFooter.svelte`

- [ ] **Step 1: Update all landing page components**

- `FeaturesSection.svelte`: "Meet TKA Scribe" heading to "Meet TKA Composer"
- `PropsSection.svelte`: Replace body text reference
- `HeroInstallFlow.svelte`: Replace install instruction text (2 instances)
- `LandingFooter.svelte`: Replace CTA text

- [ ] **Step 2: Commit**

```bash
git add src/routes/landing/
git commit -m "feat: rename TKA Scribe to TKA Composer — landing page"
```

---

### Task 8: Share & Export Watermarks

**Files:**
- Modify: `src/lib/features/choreo-card/services/implementations/PrintCardRenderer.ts` (lines 67-68)
- Modify: `src/lib/shared/share/state/image-composition-state.svelte.ts` (lines 30, 61)
- Modify: `src/lib/shared/share/services/implementations/Sharer.ts` (lines 229, 237, 277, 285)
- Modify: `src/lib/shared/share/domain/models/ShareOptions.ts` (lines 82, 130)
- Modify: `src/lib/shared/render/services/implementations/TextRenderer.ts` (line 525)
- Modify: `src/lib/shared/render/domain/models/SequenceExportOptions.ts` (line 37)
- Modify: `src/lib/shared/settings/domain/AppSettings.ts` (line 137)

- [ ] **Step 1: Update PrintCardRenderer.ts**

Replace both "Created with TKA Scribe" with "Created with TKA Composer"

- [ ] **Step 2: Update image-composition-state.svelte.ts**

Replace "Created using TKA Scribe" with "Created using TKA Composer" (comment and default value)

- [ ] **Step 3: Update Sharer.ts**

Replace all 4 instances:
- `"TKA Scribe User"` to `"TKA Composer User"` (2 instances)
- `"Created with TKA Scribe"` to `"Created with TKA Composer"` (2 instances)

- [ ] **Step 4: Update ShareOptions.ts**

Replace both instances of "TKA Scribe" with "TKA Composer"

- [ ] **Step 5: Update TextRenderer.ts**

`"Created using TKA Scribe"` to `"Created using TKA Composer"`

- [ ] **Step 6: Update SequenceExportOptions.ts**

Replace comment: "TKA Scribe" to "TKA Composer"

- [ ] **Step 7: Update AppSettings.ts**

Replace comment: "TKA Scribe" to "TKA Composer"

- [ ] **Step 8: Commit**

```bash
git add src/lib/features/choreo-card/ src/lib/shared/share/ src/lib/shared/render/ src/lib/shared/settings/
git commit -m "feat: rename TKA Scribe to TKA Composer — share & export watermarks"
```

---

### Task 9: Android TWA Brand Strings

**Files:**
- Modify: `android-twa/twa-manifest.json` (lines 4-5)
- Modify: `android-twa/app/build.gradle` (lines 27-28)
- Modify: `android-twa/app/src/main/res/raw/web_app_manifest.json`
- Modify: `android-twa/build-twa.ps1`

- [ ] **Step 1: Update twa-manifest.json**

- `"name": "TKA Scribe"` to `"name": "TKA Composer"`
- `"launcherName": "TKA Scribe"` to `"launcherName": "TKA Composer"`
- **DO NOT** change `packageId`, icon URLs, keystore references, or domain references

- [ ] **Step 2: Update build.gradle**

- `name: 'TKA Scribe'` to `name: 'TKA Composer'`
- `launcherName: 'TKA Scribe'` to `launcherName: 'TKA Composer'`
- **DO NOT** change `applicationId`, `hostName`, keystore, or URL references

- [ ] **Step 3: Update web_app_manifest.json**

- `"name": "TKA Scribe"` to `"name": "TKA Composer"`
- `"short_name": "TKA Scribe"` to `"short_name": "TKA Composer"`

- [ ] **Step 4: Update build-twa.ps1**

Replace any "TKA Scribe" output strings.

- [ ] **Step 5: Commit**

```bash
git add android-twa/
git commit -m "feat: rename TKA Scribe to TKA Composer — Android TWA brand strings"
```

---

### Task 10: MCP Server & Workspace Packages

**Files:**
- Modify: `mcp-server/src/core/text-renderer.ts` ("Created with TKA Scribe" default)
- Modify: `mcp-server/src/core/sequence-renderer.ts` (comment)
- Modify: `mcp-server-pkg/src/core/text-renderer.ts` ("Created with TKA Scribe" default)
- Modify: `mcp-server-pkg/src/core/sequence-renderer.ts` (comment)
- Modify: `mcp-server-pkg/data/tka-glossary.json` (2 instances)
- Modify: `mcp-server-pkg/src/tools/educational-tools.ts` (2 instances)
- Modify: `packages/domain/src/data/glossary.ts` (2 instances)
- Modify: `packages/domain/src/constants/position-groups.ts` (2 instances)
- Modify: `packages/mcp-tika-talk/src/tika-bridge.ts`

- [ ] **Step 1: Update MCP server text renderers**

Replace "Created with TKA Scribe" with "Created with TKA Composer" in:
- `mcp-server/src/core/text-renderer.ts`
- `mcp-server-pkg/src/core/text-renderer.ts`

- [ ] **Step 2: Update MCP server comments**

Replace "TKA Scribe" in:
- `mcp-server/src/core/sequence-renderer.ts`
- `mcp-server-pkg/src/core/sequence-renderer.ts`

- [ ] **Step 3: Update glossary and domain data**

Replace "TKA Scribe" in:
- `mcp-server-pkg/data/tka-glossary.json`
- `mcp-server-pkg/src/tools/educational-tools.ts`
- `packages/domain/src/data/glossary.ts`
- `packages/domain/src/constants/position-groups.ts`

- [ ] **Step 4: Update Tika bridge**

Replace "TKA Scribe" in `packages/mcp-tika-talk/src/tika-bridge.ts`.

- [ ] **Step 5: Commit**

```bash
git add mcp-server/ mcp-server-pkg/ packages/
git commit -m "feat: rename TKA Scribe to TKA Composer — MCP server & workspace packages"
```

---

### Task 11: Source Code Comments & Misc TypeScript

**Files:**
- Modify: `src/hooks.client.ts` (comment)
- Modify: `src/lib/features/learn/domain/concepts.ts` (comment)
- Modify: `src/lib/features/tika/knowledge/app-capabilities-manifest.ts` (comment)
- Modify: `src/lib/shared/auth/domain/models/UsernameValidation.ts` (comment)
- Modify: `src/lib/shared/gamification/domain/constants/achievement-definitions.ts` (comment)
- Modify: `src/routes/api/tika/ask/+server.ts` (tool description)
- Modify: `.env.example` (lines 2, 24)

- [ ] **Step 1: Update source code comments**

Replace "TKA Scribe" with "TKA Composer" in all comment-only references:
- `hooks.client.ts`
- `concepts.ts`
- `app-capabilities-manifest.ts`
- `UsernameValidation.ts`
- `achievement-definitions.ts`

- [ ] **Step 2: Update Tika API server**

Replace "TKA Scribe" with "TKA Composer" in tool description string in `+server.ts`.

- [ ] **Step 3: Update .env.example**

- `# TKA Scribe - Environment Variables` to `# TKA Composer - Environment Variables`
- `PUBLIC_APP_NAME=TKA Scribe` to `PUBLIC_APP_NAME=TKA Composer`

- [ ] **Step 4: Commit**

```bash
git add src/ .env.example
git commit -m "feat: rename TKA Scribe to TKA Composer — comments & env"
```

---

### Task 12: Scripts & Config Files

**Files:**
- Modify: `scripts/fetch-feedback.js` (2 instances)
- Modify: `scripts/archive-feedback.js`
- Modify: `scripts/submit-feedback.js`
- Modify: `scripts/setup-release-workflow.js`
- Modify: `config/feedback.config.js`
- Modify: `renovate.json`
- Modify: `.cursorrules`

- [ ] **Step 1: Update feedback scripts**

Replace "TKA Scribe" with "TKA Composer" in:
- `scripts/fetch-feedback.js`
- `scripts/archive-feedback.js`
- `scripts/submit-feedback.js`

- [ ] **Step 2: Update setup and config**

- `scripts/setup-release-workflow.js`: Replace brand reference
- `config/feedback.config.js`: Replace thank-you message
- `renovate.json`: Replace description
- `.cursorrules`: Replace header

- [ ] **Step 3: Commit**

```bash
git add scripts/ config/ renovate.json .cursorrules
git commit -m "feat: rename TKA Scribe to TKA Composer — scripts & config"
```

---

### Task 13: Developer & AI Tooling

**Files:**
- Modify: `CLAUDE.md` (line 1 header)
- Modify: `.claude/skills.config.json` (line 2)
- Modify: `.claude/agents/audit-fixer/AGENT.md`
- Modify: `.claude/agents/audit-evaluator/AGENT.md`
- Modify: `.claude/agents/module-auditor.md`
- Modify: `.claude/agents/feedback-triager.md`
- Modify: `.claude/agents/release-notes-writer.md`
- Modify: `.claude/agents/accessibility-auditor.md`
- Modify: `.github/copilot-instructions.md`
- Modify: `.claude/rules/project-patterns.md`

- [ ] **Step 1: Update CLAUDE.md**

`# TKA Scribe - Claude Code Guidelines` to `# TKA Composer - Claude Code Guidelines`

- [ ] **Step 2: Update skills.config.json**

`"projectName": "TKA Scribe"` to `"projectName": "TKA Composer"`

- [ ] **Step 3: Update all agent files**

Replace "TKA Scribe" with "TKA Composer" in all `.claude/agents/` files that reference the brand.

- [ ] **Step 4: Update copilot-instructions.md**

Replace "TKA Scribe" with "TKA Composer".

- [ ] **Step 5: Update project-patterns.md**

Replace any "TKA Scribe" references.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md .claude/ .github/
git commit -m "feat: rename TKA Scribe to TKA Composer — developer tooling"
```

---

### Task 14: Active Documentation

**Files:**
- Modify: `docs/about-page-three-versions.md`
- Modify: `docs/grant-copy.md`
- Modify: `docs/FEEDBACK-WORKFLOW.md`
- Modify: `docs/features/deep-linking.md`
- Modify: `docs/I18N-SYSTEM.md`
- Modify: `docs/I18N-IMPLEMENTATION.md`
- Modify: `docs/DESTINATIONS-VISION.md`
- Modify: `docs/RTL-MIGRATION.md`
- Modify: `docs/OFFLINE-FIRST-ARCHITECTURE.md`
- Modify: `LANDING-EXTRACTION-PLAN.md`
- Modify: `src/lib/shared/persistence/README.md`
- Modify: `src/lib/features/premium/README.md`
- Modify: `src/lib/features/learn/IMPLEMENTATION_SUMMARY.md`
- Modify: `tests/performance/README.md`

- [ ] **Step 1: Update all active docs**

Replace "TKA Scribe" with "TKA Composer" in every file listed above.

**DO NOT touch:**
- `docs/superpowers/specs/` (historical specs)
- `docs/superpowers/plans/` (historical plans)
- `docs/grants/drafts/` (historical grant drafts)
- `docs/grants/grant-tracker.md` (historical tracking)
- `docs/museum/` (lore)
- `docs/adr/` (architectural decision records)
- `docs/plans/2026-02-26-retro-*` (historical)

- [ ] **Step 2: Commit**

```bash
git add docs/ LANDING-EXTRACTION-PLAN.md src/lib/shared/persistence/README.md src/lib/features/premium/README.md src/lib/features/learn/IMPLEMENTATION_SUMMARY.md tests/performance/README.md
git commit -m "feat: rename TKA Scribe to TKA Composer — documentation"
```

---

### Task 15: Verification

- [ ] **Step 1: Run build**

```bash
npm run build
```

Expected: Clean build with no errors.

- [ ] **Step 2: Run typecheck**

```bash
npm run check
```

Expected: No type errors.

- [ ] **Step 3: Verify no remaining brand references in source code**

Search all source/config files (excluding retro, historical docs, lore, node_modules, build artifacts):

```bash
grep -r "TKA Scribe" --include="*.ts" --include="*.svelte" --include="*.json" --include="*.html" --include="*.js" src/ static/ firebase-functions/ messages/ android-twa/ .claude/ .github/ scripts/ config/ packages/ mcp-server/ mcp-server-pkg/ | grep -v node_modules | grep -v .svelte-kit | grep -v "alternateName" | grep -v "src/lib/features/retro/"
```

Expected: Zero results (except the SEO alternateName we intentionally kept).

- [ ] **Step 4: Verify no remaining brand references in active markdown**

```bash
grep -r "TKA Scribe" --include="*.md" . | grep -v node_modules | grep -v docs/superpowers/ | grep -v docs/grants/ | grep -v docs/museum | grep -v docs/adr | grep -v docs/plans/2026-02-26-retro
```

Expected: Zero results.

- [ ] **Step 5: Spot-check key user-facing strings**

Verify these specific strings exist in the codebase:
- `"TKA Composer"` in `domains.ts`
- `"Welcome to TKA Composer"` in `first-run-types.ts`
- `"Created with TKA Composer"` in `PrintCardRenderer.ts`
- `"TKA Composer"` in `messages/en.json` app_name
- `"TKA Composer"` in `manifest.webmanifest` name field
- `"tka-scribe-2025"` still in `manifest.webmanifest` id field (preserved)
- `"TKA Composer"` in `SidebarHeader.svelte`
- `"TKA Composer"` in `LandingPage.svelte`
- `"Created with TKA Composer"` in `mcp-server/src/core/text-renderer.ts`

- [ ] **Step 6: Fix any remaining references found by verification**

If steps 3-4 found anything, fix and commit.
