# i18n Adoption Plan: Prune, Sync, Migrate

**Date:** 2026-05-23
**Status:** Backlog
**Impact:** Unlocks localization for 87.5% of the app currently stuck in English-only

---

## Problem

The i18n system (`src/lib/shared/i18n/i18n.svelte.ts`) is well-engineered: type-safe `t()` with IDE autocomplete, lazy locale loading, fallback chain (regional -> base -> en), RTL support, HMR, and Intl-based formatters. But adoption is stuck at 12.5%.

| Metric | Current | Target |
|---|---|---|
| Svelte files importing i18n | 261 of ~2,087 (12.5%) | 80%+ of user-facing files |
| en.json keys | 2,694 | ~1,500 (pruned) + new extracted keys |
| Keys actually referenced in code | 905 static + 254 dynamic = 1,159 | All keys referenced |
| Truly unused keys | 1,159 (43%) | 0 |
| i18n-types.ts key count | 2,618 (76 behind en.json) | Matches en.json exactly |
| Non-English locale coverage | es: 1,585 keys (59%), fr: 1,605 (60%), rest similar | 100% of used keys |
| Non-English locales missing keys | ~1,110 per locale | 0 |

### Feature modules ranked by i18n adoption

Modules at 0% adoption that are user-facing and contain hardcoded strings:

| Module | Svelte files | i18n adoption | User-facing? |
|---|---|---|---|
| choreo-card | 58 | 0% | Yes |
| learn | 179 | 2% (4 files) | Yes |
| create | 174 | 5% (10 files) | Yes |
| landing-preview | 26 | 0% | Yes |
| settings (shared) | 21+ | partial | Yes |
| lab | 89 | 0% | Yes |
| museum | 49 | 0% | Yes (premium) |
| retro | 72 | 0% | Yes (premium) |
| compose | 99 | 12% | Yes |
| video | 20 | 0% | Yes |

Modules with good adoption (>50%): train (77%), arena (93%), connect (100%), moderation (100%), watch (68%), browse (45%).

### Shared layer

670 Svelte files in `src/lib/shared/`, only 51 import i18n. Shared components (navigation, settings, sequence-viewer, onboarding, 3D panels) are reused across modules. Localizing them has outsized impact.

---

## Fix 1: Prune ~1,159 Unused Keys

### Approach

The existing `scripts/validate-i18n.cjs` already has an unused-key detector (Check 2), but it greps for exact `t("key")` patterns and misses dynamic usage. A refined prune script must account for three usage patterns:

1. **Static `t("key")`** -- direct grep match
2. **Dynamic `tDynamic(\`module_${id}\`)`** -- keys matching `module_*`, `tab_*`, `tab_desc_*`, `module_desc_*`, `settings_tab_*` are constructed at runtime and must be preserved
3. **Content-match** -- some keys are referenced as string values in switch statements, config objects, or as partial key names

### Safe prune algorithm

```
For each key in en.json:
  1. If key matches a dynamic prefix (module_, tab_, tab_desc_, module_desc_, settings_tab_) -> KEEP
  2. If key appears as a string literal anywhere in src/ -> KEEP
  3. Otherwise -> mark STALE
```

The content-match approach (step 2) is conservative: it catches keys referenced as object property names, in comments, or in dead code. This produces false negatives (keeps some unused keys) but never false positives (never prunes a used key).

### Implementation

Add `scripts/prune-i18n-keys.cjs`:

```js
// 1. Load en.json keys
// 2. Read all .svelte + .ts files in src/ into a single string
// 3. For each key: check dynamic prefix OR substring match
// 4. Collect stale keys
// 5. With --dry-run: report count and list
// 6. With --apply: remove stale keys from ALL locale files (en, es, fr, de, pt, zh, ja, ko, ar, ru, it)
// 7. Run npm run i18n:types to regenerate types
```

Add npm scripts:
- `"i18n:prune"` -- dry run, reports stale keys
- `"i18n:prune:apply"` -- removes stale keys from all locale files

### Expected outcome

~1,159 keys removed from en.json (dropping from 2,694 to ~1,535). All 10 non-English locale files pruned in sync. Type definitions regenerated to match.

---

## Fix 2: Sync Type Definitions

The `i18n-types.ts` file was last generated 2026-03-21 and reports 2,618 keys. en.json now has 2,694. The 76-key drift means 76 keys lack IDE autocomplete and type safety.

### Implementation

1. Run `npm run i18n:types` (invokes `scripts/generate-i18n-types.cjs`)
2. This should be run as part of Fix 1 (after pruning) so the types match the pruned key set

### Future prevention

Add `i18n:types` as a pre-commit check or as part of `npm run check`. The script runs in <100ms and produces a single file change. A CI check that diffs the generated output against the committed file catches drift.

Add to `package.json` scripts:
```json
"i18n:check-types": "npm run i18n:types && git diff --exit-code src/lib/shared/i18n/i18n-types.ts"
```

---

## Fix 3: Module-by-Module Migration Plan

### Priority tiers

Migration order is based on three factors: user-facing traffic, string density, and shared-component leverage.

**Tier A -- Shared infrastructure (highest leverage)**

| Target | Files | Why first |
|---|---|---|
| `src/lib/shared/navigation/` | ~20 | Every user sees nav labels, tooltips, section headers on every page |
| `src/lib/shared/settings/` | ~15 | Settings panel is user-facing, already partially localized |
| `src/lib/shared/onboarding/` | ~10 | First-run wizard is the first thing new users see |
| `src/lib/shared/foundation/ui/` | ~10 | ErrorScreen, ConfirmDialog -- reused everywhere |
| `src/lib/shared/sequence-viewer/` | ~15 | Viewer controls, export overlay, tempo labels |

Estimated keys to extract: 100-150

**Tier B -- High-traffic feature modules**

| Target | Files | Current adoption | Hardcoded string density |
|---|---|---|---|
| create | 174 | 5% | High (53 files flagged) |
| learn | 179 | 2% | High (52 files, educational content) |
| browse | 46 (remaining) | 45% | Medium |
| settings | 21 | partial | Medium |
| compose | 87 (remaining) | 12% | Medium (38 files flagged) |

Estimated keys to extract: 400-600

**Tier C -- Product differentiators**

| Target | Files | Notes |
|---|---|---|
| choreo-card | 58 | Card designer, deck browser, print preview labels |
| lab | 89 | Scene lab, themes lab, effects panels |
| landing-preview | 26 | Public-facing, SEO-relevant |

Estimated keys to extract: 200-300

**Tier D -- Premium/internal (lowest priority)**

| Target | Files | Notes |
|---|---|---|
| museum | 49 | Narrative content -- may need creative translation, not mechanical |
| retro | 72 | Era-specific UI, niche audience |
| video | 20 | Technical tool |
| admin (remaining) | ~15 | Internal only |

Estimated keys to extract: 150-250

### Per-module migration checklist

For each module in priority order:

1. Grep all `.svelte` files for hardcoded English text patterns:
   - `>[A-Z][a-z]` (text content in HTML)
   - `placeholder="` / `title="` / `aria-label="` with English strings
   - Template literals with user-visible text
2. Extract strings into en.json using the module's namespace prefix (e.g., `create_spell_generate`, `learn_guide_chapter_title`)
3. Replace hardcoded strings with `t("key")` calls
4. Run `npm run i18n:types` to regenerate types
5. Run `npm run check` to verify no type errors
6. Run the locale sync workflow (Fix 5) to propagate new keys to all locales

---

## Fix 4: Codemod for Hardcoded String Detection

A fully automated extract-and-replace codemod for Svelte is brittle (Svelte templates mix HTML, JS, and reactive blocks). Instead, a detection-and-report tool that flags extraction candidates works reliably.

### Approach: `scripts/i18n-extract-report.cjs`

Scans `.svelte` files for hardcoded English strings and outputs a structured report.

**Detection patterns:**

```
1. HTML text content:     >Text Here<     (between tags, not inside {expressions})
2. HTML attributes:       placeholder="Text" | title="Text" | aria-label="Text"
3. JS string literals:    "Text with spaces"  (in template expressions, not imports/paths)
```

**Exclusions (false positive reduction):**

- CSS class names, file paths, import specifiers
- Single words that are likely enum values or identifiers
- Strings inside `console.log`, `console.warn`, `console.error`
- Strings that are URLs or contain `/`
- Svelte directive values (`bind:`, `on:`, `use:`)
- Strings shorter than 3 characters

**Output format:**

```
src/lib/features/create/spell/components/SpellPanel.svelte
  L381: >Generating...</span>         -> create_spell_generating
  L384: >Generate</span>              -> create_spell_generate_button

src/lib/features/create/record/components/CameraSettingsDialog.svelte
  L77:  >Camera Settings</h3>         -> create_record_camera_settings_title
  L91:  >Mirror Video</label>         -> create_record_mirror_video
  L133: >Adjust your camera...        -> create_record_camera_help_text
```

The report suggests key names following the existing convention (`{module}_{submodule}_{concept}`). The developer reviews and applies each extraction manually. This is safer than an auto-replace codemod because:

- Svelte template parsing edge cases (snippets, `{@html}`, `{#each}` blocks) don't break anything
- Developers can merge strings that should share a key
- Educational/narrative content (learn module) may need different granularity than UI labels

### Key naming convention (observed from en.json)

```
{module}_{noun}                       -- module_create, module_browse
{module}_{action}                     -- action_save, action_edit
{module}_{noun}_{detail}              -- train_step_complete, browse_sort_newest
{module}_{context}_{action}           -- feedback_submit_send, connect_invite_copy
{section}_{noun}_{qualifier}          -- settings_toggle_dark_mode
empty_{context}                       -- empty_no_sequences, empty_no_results
form_{element}_{context}              -- form_placeholder_search
```

---

## Fix 5: Translation Workflow for Non-English Locales

### Current state

- 10 non-English locale files exist with 1,580-1,605 keys each
- en.json has 2,694 keys, meaning ~1,110 keys per locale are missing
- No automated translation pipeline exists
- No CI check prevents shipping untranslated keys

### Recommended workflow

**Option A: LLM batch translation (recommended for this project)**

When new keys are added to en.json:

1. A script diffs en.json against each locale file to find missing keys
2. For each locale, the missing keys + their English values are sent to Claude API as a batch
3. Translations are written into the locale files
4. A human reviewer (or community contributor) spot-checks the output

Implementation: `scripts/translate-missing-keys.cjs`

```
1. Load en.json and target locale file
2. Find keys in en that are missing from target
3. Batch keys in groups of 50 (to stay within context limits)
4. For each batch:
   - Prompt: "Translate these UI strings from English to {locale}. 
     Preserve {param} placeholders exactly. 
     Return JSON object with same keys."
   - Write results into locale file
5. Sort keys alphabetically
6. Report count of translated keys
```

This can use the Anthropic SDK (already used in the project workflow) or be run as a Claude Code skill.

**Option B: Community translation platform**

Services like Crowdin, Transifex, or Lokalise can ingest JSON locale files, provide a translation UI, and export updated files. This is better for ongoing community contributions but adds a SaaS dependency and cost.

**Option C: Hybrid**

Use LLM translation for initial bulk fill, then expose a community translation interface for corrections and new strings. The `translate` skill already exists in this project's skill list.

### CI integration

Add to CI pipeline:

```json
"i18n:check-completeness": "node scripts/validate-i18n.cjs --ci"
```

This runs the existing validation suite in CI mode (exits 1 on errors). It catches:
- Missing keys in any locale
- Parameter mismatches (`{name}` present in en but missing in es)
- Unsorted keys

### Preventing drift

Add a pre-commit hook or CI step:

```
1. npm run i18n:types        -- regenerate type file
2. git diff --exit-code      -- fail if types changed (developer forgot to run it)
```

---

## Fix 6: Locale File Hygiene

### Extra keys in locale files

The analysis found 1 extra key per locale (keys present in es.json etc. but not in en.json). These should be removed during the prune step.

### Key sorting

The existing `validate-i18n.cjs --fix` auto-sorts keys. Run this after any bulk key addition.

### Schema validation

en.json has a `$schema` key pointing to `https://inlang.com/schema/inlang-message-format`. This is a leftover from the Paraglide migration (the cookie is still named `PARAGLIDE_LOCALE`). The schema reference is harmless but could be removed if inlang tooling is no longer used.

---

## Implementation Order

| Phase | Work | Effort | Prerequisite |
|---|---|---|---|
| 1 | Prune unused keys from all locale files | 1 hour | None |
| 2 | Run `npm run i18n:types` to sync types | 5 min | Phase 1 |
| 3 | Build `i18n-extract-report.cjs` detection tool | 2-3 hours | None |
| 4 | Migrate Tier A (shared infrastructure) | 4-6 hours | Phase 3 |
| 5 | Build `translate-missing-keys.cjs` | 2-3 hours | None |
| 6 | Migrate Tier B (high-traffic modules) | 8-12 hours | Phase 3 |
| 7 | Run bulk LLM translation for all locales | 1-2 hours | Phase 5, after Tier A+B |
| 8 | Add CI checks (type drift, completeness) | 1 hour | Phase 2 |
| 9 | Migrate Tier C (product differentiators) | 4-6 hours | Phase 3 |
| 10 | Migrate Tier D (premium/internal) | 4-6 hours | Phase 3 |

Phases 1-2 are quick wins that can ship independently. Phase 3 unblocks all migration work. Phase 5 can be built in parallel with migration phases.

---

## Risks

**Museum/retro narrative content.** These modules contain creative, tone-specific text (see `project_museum_tone_references.md`). Mechanical extraction into i18n keys works for UI labels but not for narrative prose. These modules may need a separate content-localization strategy with professional translators.

**Learn module educational content.** The learn module has long-form instructional text (chapter content, concept explanations). Extracting every paragraph into a flat key-value file creates maintenance burden. Consider whether learn content should use a different format (Markdown files per locale, or a CMS).

**Dynamic key patterns.** The `tDynamic()` function bypasses type safety by design. Any new dynamic key prefix must be added to the prune script's preservation list, or the prune will incorrectly remove those keys.

**LLM translation quality.** Machine-translated UI strings work well for button labels and short phrases but degrade for domain-specific terms (TKA terminology like "pictograph," "LOOP type," "grid mode"). A glossary of TKA terms with approved translations per locale should be provided to the translation prompt.

---

## Files Referenced

- `src/lib/shared/i18n/i18n.svelte.ts` -- main i18n system (t, tDynamic, setLocale, initI18n)
- `src/lib/shared/i18n/i18n-types.ts` -- auto-generated type definitions (76 keys behind)
- `src/lib/shared/i18n/translate.ts` -- helper functions for dynamic key construction
- `src/lib/shared/i18n/i18n-formatters.ts` -- Intl-based date/number/currency formatters
- `src/lib/shared/i18n/locale-state.svelte.ts` -- backwards-compatibility re-exports
- `scripts/generate-i18n-types.cjs` -- type generation script
- `scripts/validate-i18n.cjs` -- validation suite (completeness, unused keys, params, sorting, coverage)
- `messages/en.json` -- 2,694 keys, source of truth
- `messages/{es,fr,de,pt,zh,ja,ko,ar,ru,it}.json` -- 10 non-English locale files
