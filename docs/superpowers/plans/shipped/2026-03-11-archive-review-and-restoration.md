# Archive Review & Restoration Plan

Created: 2026-03-11

## Context

Dead code scan found 254 files across 20 categories. Files were archived to
`archive/dead-code-2026-03-11/categories/`. Initial triage made superficial
"superseded" claims that turned out to be wrong — deeper comparison revealed
archived code with capabilities missing from live code.

**Lesson learned:** Every category needs a thorough file-by-file comparison
against the live codebase before marking anything as "superseded."

## Completed Reviews

### audio-music (15 files)
- **Status:** RESTORED as lab tab (Audio Toolkit Lab)
- **Location:** `src/lib/features/lab/tabs/audio-lab/`
- **Note:** CSP fix needed for blob: URLs (added to hooks.server.ts)

### 3d-scenes-environments (23 files)
- **Status:** REVIEWED — mixed results
- **Finding:** 12 files contain unique capabilities missing from live code
- **README:** Updated with superseded vs not-superseded breakdown
- **Action needed:** Restore missing capabilities into live 3D system (see separate plan below)

### terrain-world-building (16 files)
- **Status:** REVIEWED — significant unique capabilities
- **Finding:** GPU noise (TSL), CDLOD morphing, geometry clipmaps, procedural
  terrain patterns (dirt/grass/rock/sand/snow), Mapbox loaders — NONE of these
  exist in the live Realm system
- **README:** Not yet written
- **Action needed:** Write README, determine restoration priority

## Remaining Reviews (18 categories)

Each needs the same deep file-by-file comparison before any claims about status.

| Category | Files | Priority | Notes |
|----------|-------|----------|-------|
| gallery-museum | 11 | High | 3D museum gallery, may overlap with museum module |
| decompose-lab | 6 | Medium | Was already a lab, recently removed |
| learn-quiz | 13 | Medium | Grid visualizers, quiz UI — may be useful for Learn tab |
| generate-presets | 13 | Medium | Old preset card system |
| ui-controls-buttons | 26 | Medium | Reusable UI controls |
| navigation-browse | 21 | Medium | Browse gallery UI components |
| feedback-admin | 13 | Low | Admin dashboard components |
| sequence-management | 12 | Medium | Sequence viewer/management UI |
| workspace-toolkit | 11 | Low | Toolbar and design tokens |
| debug-dev-tools | 5 | Low | Dev-only tools |
| transform-help | 5 | Low | Transform tutorial cards |
| retro-theme | 3 | Low | Retro UI elements |
| premium-marketing | 3 | Low | Marketing components |
| misc | 41 | Medium | Large grab bag — needs careful sorting |
| data-models-state | 23 | Medium | Types/state — might include used interfaces |
| auth-social | 6 | Low | Social auth — needs Firebase |
| onboarding-tours | 6 | Low | Tour system — needs sidebar context |
| decompose-lab | 6 | Medium | Animation decomposition |

## Process for Each Category

1. List all files
2. Read each archived file (not just headers — full content)
3. Search live codebase for equivalent functionality
4. For each file, determine: SUPERSEDED / MISSING / PARTIAL
5. Write README in the category directory
6. If missing capabilities found, create restoration action items

## Restoration Priorities

1. **3D system gaps** — GamepadProvider, InputProviderFactory, UI selectors (IN PROGRESS)
2. **Terrain system gaps** — GPU noise, CDLOD, procedural patterns, Mapbox (PENDING REVIEW)
3. **Remaining categories** — TBD after review
