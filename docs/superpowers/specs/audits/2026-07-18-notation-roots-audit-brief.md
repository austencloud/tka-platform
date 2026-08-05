# Codex Audit Brief — Notation / Roots Merge Redesign

You are auditing a flow-arts notation page that Claude just rewrote. Austen wants it
"audited tf out of." Be adversarial and skeptical. Find factual errors, AI-writing
tells, rule violations, dead links, code bugs, and layout/a11y problems. **Do not fix
anything** — report. Write your findings to
`docs/superpowers/specs/audits/2026-07-18-notation-roots-audit-findings.md`,
ranked most-severe first, each with `file:line`, the problem, hard evidence (MCP output /
source URL / rule citation), and a concrete fix. Claude applies the fixes.

## Where you are
- Worktree: `C:\worktrees\tka-platform\notation-redesign`, branch `feat/notation-roots-merge`.
- The redesign is **uncommitted working-tree changes** on top of HEAD (HEAD only adds the
  design spec). See it:
  - `git diff HEAD` — Claude's uncommitted redesign
  - `git diff origin/main -- .` — net change a visitor gets (16 files, +762/-300)
  - Old page for merge-completeness checks: `git show origin/main:"src/routes/(public)/roots/+page.svelte"`

## What changed, in one paragraph
`/notation` was rewritten from an AI-toned, uniform "H2 + two same-size paragraphs"
explainer into a comparative "family of systems for writing movement down" page that
frames TKA as a **peer** among prior notation systems (siteswap, VTG, QFT, Ben Cushing's
system, Lorq's Shape Matrix, Tiffany Fong's poi notation, music theory) — not the
be-all/end-all, no FAQ-conqueror tone. The old `/roots` page was folded in:
`roots/+page.svelte` deleted, replaced by `roots/+page.ts` that 301-redirects to
`/notation`; `roots/software` stays. `/roots` links across the site were repointed.

Primary file: `src/routes/(public)/notation/+page.svelte` (+612). Everything else is the
roots merge + link sweep + SEO/sitemap.

## Audit dimensions (cover all; priority order)

### 1. Factual accuracy of every notation-history claim  [HIGHEST VALUE]
Every claim about a notation system or about TKA must be true, attributed, and not
overstated. For each, verify and cite a source; flag anything wrong/unverifiable/inflated.
- **TKA / VTG / letter claims** → verify with the `tka-domain` MCP (see Tools). The page
  says letter A is a "split-same" move — confirm. Check every letter/position/type/VTG
  assertion it makes.
- **External systems** → web-search and confirm names, attributions, descriptions:
  siteswap, **Quantized Field Theory** (DrexFactor — confirm this is the right expansion of
  "QFT"; Claude already corrected it from a wrong "Quadrant Flow Theory," double-check),
  Ben Cushing's system, Lorq's **Shape Matrix** (sirlorq.wordpress.com), Tiffany Fong's
  **poi notation** (GitHub), the music-theory analogy.
- **Attributions/people** → confirm each named person/handle is real and correctly
  credited. Do NOT invent or accept invented bios; flag any unverifiable person claim.

### 2. AI-writing tells
Apply the ai-bust canon (Categories 1-7). The criteria (in case the in-repo skill under
`.claude/skills/ai-bust/` is older than the local patch):
- **Zero em dashes (U+2014)** anywhere user-visible. Grep the diff.
- **Category 7 (CRITICAL) structural/template tells** — header-per-topic "episodes,"
  uniform section development, cross-page template reuse, "Here's…" pivots, topic-label
  headers, summary-caboose sentences. Killing these was the entire point of the rewrite;
  verify they are actually gone and sections have deliberately unequal weight/burstiness.
- **No unsigned first person** (I/we/my/our) in page copy that carries no byline.
- Blacklisted words, hedging, sycophantic openers, perfect-threes.

### 3. Rule / primitive compliance  (read the cited files in `.claude/rules/`)
- `never-hand-roll.md` + `primitive-discovery.md` — did it hand-roll UI (chips, buttons,
  crossfades, filter bars, the inline SVG/grid figures) that an existing shared primitive
  already covers?
- `no-layout-shift.md` — variable-width/dynamic content reserves space.
- `clickables-look-like-buttons.md`, `no-checkboxes.md`, `clickable-links.md`.
- `simplified-word-display.md` — any raw `.word` in display code (e.g. the live
  SequenceHeroDemo) that should route through `simplifyRepeatedWord`.

### 4. Code correctness
- `roots/+page.ts` — correct SvelteKit 301 redirect; is the `prerender` setting sane for a
  redirect route?
- **Link-sweep completeness** — grep the WHOLE repo (not just the diff) for remaining
  `/roots` references that would now 404 or should point to `/notation`. Only
  `roots/software` should survive as a live `/roots/*` route.
- SEO: `/notation` `<svelte:head>` canonical / og:* / twitter:* / JSON-LD intact and
  correct; sitemap change (dropped `/roots`) correct.
- The 8x8 Shape Matrix grid (`{#each Array.from({length:64})}`) — 64 cells, keyed, no a11y
  hole; the inline QFT numbered-circle SVG and VTG 2x2 grid are sound.
- Svelte 5 runes correctness; no leftover Svelte 4 patterns.
- `+layout.svelte` public-route registration still correct after removing `/roots` (there
  is a known dual-registry gotcha: MARKETING_EXACT in +layout.svelte AND
  PUBLIC_PATH_PREFIXES in domains.ts — confirm removing /roots didn't half-register it).

### 5. Merge completeness
Diff the deleted `roots/+page.svelte` (via `git show origin/main:...`) against the new
`/notation`. Did folding `/roots` in drop any content that now has no home? Flag orphans.

## Already verified (don't redo unless you doubt it)
- "Quadrant Flow Theory" → "Quantized Field Theory" fixed (~line 286 of the notation page).
- `tka_to_vtg("A")` → Split Same; A is Type 1 dual-shift, both pro → "A is split-same" holds.
- Grep found zero em dashes in the new notation page.
- `/roots` returns 301 to `/notation`.

## Tools you have
- **`tka-domain` MCP** (32 tools) — ground truth for TKA. Use `list_available_letters`,
  `get_letter_explanation`, `get_alphabet_info`, `tka_to_vtg`, `vtg_to_tka`,
  `compare_letters`, `get_pictograph_data`, `analyze_word_feasibility`, etc. instead of
  guessing any TKA fact.
  - **Gap:** this build LACKS `get_domain_topic` and the `get_vtg_*` family
    (pattern/shape/category/transition). Don't call them; for VTG concepts lean on
    `tka_to_vtg` + `get_letter_explanation` + web.
- **Web search** for external notation systems and attribution checks.
- Full read access to the worktree, `.claude/rules/`, `.claude/skills/`.

## Deliverable
`docs/superpowers/specs/audits/2026-07-18-notation-roots-audit-findings.md`.
Ranked findings, evidence per finding, concrete fixes, no code changes. If a
dimension is clean, say so in one line.
