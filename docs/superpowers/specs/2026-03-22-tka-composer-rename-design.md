# TKA Composer Rename — Design Spec

**Date:** 2026-03-22
**Status:** Approved
**Scope:** Brand rename only. No architectural or structural changes.

---

## Decision

Rename the application from **TKA Scribe** to **TKA Composer**.

### Rationale

- The app is a creation tool, not a transcription tool. Users compose sequences, choreographies, animations, and decks. "Composer" matches the product's trajectory.
- "Scribe" implies recording what already exists. "Composer" implies creating something new. The app's primary value is creation.
- The Compose module is the app's flagship feature. Elevating "Compose" to the app identity makes the hierarchy honest.
- The "[System] + [Role]" naming pattern (like LabanWriter) reads as academic/utilitarian. "Composer" carries more creative identity.
- Notation reading/writing (the "scribe" activity) is a subset of what the app does, handled by learning tools, books, and choreo cards.

### What stays the same

- **Compose module** stays named "Compose" (ID: `compose`). The verb/noun distinction (Compose the module, Composer the app) is natural and reinforcing, not confusing.
- **All module IDs, routes, and architecture** unchanged.
- **Museum lore** retains "scribe" as a historical role descriptor within The Kinetic Archive fiction. It's a narrative word, not a brand name. Not a faction, not a group — just a word K might use for people who documented movement in the past.
- **Retro mode** stays as-is. "TKA Scribe 98" and "TKA Scribe XP" are fictional historical product names within the museum lore. The software changing names across eras is itself a lore detail.
- **Domain/URLs** — `tkascribe.com` stays. Domain migration is a separate project if pursued later.
- **Android package name** — `com.tkascribe.app` stays. Package name changes require a new Play Store listing.

---

## Rename Surface Area

All changes are string replacements. No logic, routing, or structural changes.

### Category 1: Core App Identity

| File | Location | Before | After |
|------|----------|--------|-------|
| `package.json` | `name` field | `@tka/scribe` | `@tka/composer` |
| `src/app.html` | Apple PWA meta tag | `content="TKA Scribe"` | `content="TKA Composer"` |
| `src/app.html` | Loading screen aria-label | `Loading TKA Scribe` | `Loading TKA Composer` |
| `src/config/domains.ts` | `siteName` + comments | `TKA Scribe` | `TKA Composer` |

### Category 2: PWA Manifests

| File | Fields | Notes |
|------|--------|-------|
| `static/pwa/manifest.webmanifest` | `name`, `short_name` | **Keep `id` as `tka-scribe-2025`** to preserve installed PWA identity. Changing the ID forces reinstall for existing users. |
| `static/pwa/manifest-launcher.webmanifest` | `name` | `TKA Scribe Launcher` → `TKA Composer Launcher` |

### Category 3: Android TWA

| File | Fields |
|------|--------|
| `android-twa/twa-manifest.json` | `name`, `launcherName` |
| `android-twa/app/build.gradle` | `name`, `launcherName` |
| `android-twa/app/src/main/res/raw/web_app_manifest.json` | `name`, `short_name` |
| `android-twa/build-twa.ps1` | Output strings |

### Category 4: Firebase / Email

| File | Instances | Notes |
|------|-----------|-------|
| `firebase-functions/src/templates/magic-link.html` | 3 | User-facing email template |
| `firebase-functions/src/sendMagicLink.ts` | 6 | Email subject and body |
| `firebase-functions/src/index.ts` | 1 | Comment |
| `firebase-functions/package.json` | 1 | Description |
| `static/firebase-messaging-handler.js` | 1 | Push notification fallback title |

### Category 5: i18n Message Files

All language files in `messages/` contain `"app_name": "TKA Scribe"` plus brand references in toasts, descriptions, and placeholders.

Files: `en.json`, `es.json`, `fr.json`, `it.json`, `ja.json`, `ko.json`, `pt.json`, `ru.json`, `zh.json`

### Category 6: User-Facing UI

| File | Context |
|------|---------|
| Onboarding `first-run-types.ts` | "Welcome to TKA Scribe" |
| Onboarding `WelcomeStep.svelte` | Heading and body text |
| Migration `MigrationModal.svelte` | "TKA Studio is now TKA Scribe" → "TKA Studio is now TKA Composer" |
| Migration `MigrationBanner.svelte` | "Update now to keep using TKA Scribe" |
| Voice command prompt | System prompt identifies app as "TKA Scribe" |

### Category 7: Share / Export Watermarks

All files that produce user-shared output with "Created with TKA Scribe":

- `src/lib/shared/share/services/implementations/Sharer.ts`
- `src/lib/shared/share/domain/models/ShareOptions.ts`
- `src/lib/shared/share/state/image-composition-state.svelte.ts`
- `src/lib/shared/render/services/implementations/TextRenderer.ts`
- `src/lib/features/choreo-card/services/implementations/PrintCardRenderer.ts`
- `src/lib/shared/sequence-viewer/components/ChoreoCard.svelte`
- `src/lib/shared/export-panel/components/settings/StaticSettings.svelte`

### Category 8: SEO / Structured Data

| File | Context |
|------|---------|
| `src/routes/+page.svelte` | JSON-LD schema: `alternateName`, FAQ, HowTo, SoftwareApplication |
| `static/sitemap.xml` | Image captions |
| `static/robots.txt` | Comment |
| `static/branding/og-image.html` | OG image template |
| Route `+page.svelte` files | `<title>` tags and `<meta>` descriptions |

**SEO note:** Keep "TKA Scribe" as an `alternateName` in the SoftwareApplication schema for discovery continuity during the transition.

### Category 9: Legal Pages

Terms of Service, Privacy Policy, and Delete Account pages contain "TKA Scribe" throughout. Also `LegalSheet.svelte` which renders the same text.

### Category 10: Developer / AI Tooling

| File | Context |
|------|---------|
| `CLAUDE.md` | Project header |
| `.claude/skills.config.json` | `projectName` |
| `.claude/agents/*.md` | Agent file references (6+ files) |
| `.github/copilot-instructions.md` | GitHub Copilot context |
| `.claude/rules/project-patterns.md` | Pattern references |

### Category 11: Retro Mode

All "TKA Scribe 98" references and retro terminal/DOS mode strings.

---

## Risks and Mitigations

### PWA Identity

**Risk:** Changing the PWA `id` forces existing installed users to reinstall.
**Mitigation:** Keep `id` as `tka-scribe-2025`. The display name changes but the identity persists.

### WebAuthn Relying Party

**Risk:** Changing `rpName` in `src/lib/server/webauthn/webauthnConfig.ts` may invalidate existing passkeys.
**Mitigation:** Research before changing. If uncertain, keep `rpName` as "TKA Scribe" or accept both names.

### SEO Disruption

**Risk:** Structured data changes may cause temporary ranking fluctuation.
**Mitigation:** Keep "TKA Scribe" as `alternateName` in schema. Google will re-index within days.

### Existing Exports in the Wild

**Risk:** Users who already exported images with "Created with TKA Scribe" watermarks have the old name circulating.
**Mitigation:** Not actionable. Natural transition — old exports have old branding.

---

## Document Scope Boundaries

| Category | Action |
|----------|--------|
| Active source code | Rename all brand references |
| Active documentation (README, system docs) | Rename |
| AI tooling config (CLAUDE.md, agents, skills) | Rename |
| Historical/archive documents (grant drafts, ADR records, old specs) | Leave as-is — they reference the name at time of writing |
| Museum lore / game fiction | Leave as-is — "scribe" is an in-world term |

---

## Search Strategy

To find all instances, search for:
- `"Scribe"` (case-sensitive) — catches brand references
- `"scribe"` (case-insensitive) — catches package names, slugs
- `"@tka/scribe"` — package references
- `"TKA Scribe"` — exact brand name
- `"tka-scribe"` — kebab-case variants (PWA id, package slugs)
- `"tkascribe"` — domain and package references

Exclude: museum lore files, game fiction, narrative content where "scribe" is used as an in-world term, historical specs/docs that reference the name at time of writing.
