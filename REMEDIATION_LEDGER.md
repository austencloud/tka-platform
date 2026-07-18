# Notation Redesign — Remediation Ledger (Codex audit → fixes)

Owner: ME = main loop. A = subagent (route tooling). B = subagent (/roots/software chrome + labels).
Decisions: #3 = FULL recompose (continuous prose). #2 = real 12×12 Shape Matrix (see #16 note).
Status: ALL 24 applied + verified live on :5176. `npm run check` running for final confirm.

| # | Sev | Finding | Owner | Status |
|---|-----|---------|-------|--------|
| 1 | Crit | QFT clock rotated → 8=top, 1=UR clockwise; arrow 8→1 redrawn | ME | done |
| 2 | Crit | Fake 8×8 grid → real 144 Shape Matrix, 12×12, correct axes/diagonal, 324+P.H.A.T. separated w/ credits | ME | done |
| 3 | Crit | 11 episodes → 6 sections, continuous uneven prose, cabooses/teasers cut | ME | done |
| 4 | Crit | "gap none filled" → peer framing, TKA states its own choice | ME | done |
| 5 | High | Siteswap: Klimek 1981 / Caltech ~1985 / Cambridge (Wright) | ME | done |
| 6 | High | "ancestor"/music-descent → analogy + "what TKA borrows" | ME | done |
| 7 | High | VTG: collaborative (Yee + Vulcan Lofts); scoped to Type 1; same/opp = hand paths | ME | done |
| 8 | High | /roots/software added to MARKETING_EXACT | B | done |
| 9 | High | Inbound link to /roots/software ("their own lineage") | ME | done |
| 10 | High | devices.ts, screenshot-orchestrator, landing-preview, manifest regen | A | done |
| 11 | High | Real PoiNotation input excerpt (~ / *), CS course framing | ME | done |
| 12 | High | Music: scores encode cues; dropped note-name causal claim | ME | done |
| 13 | Med | Bounded language (no every/nobody/whole) | ME | done |
| 14 | Med | "grid of up to nine points" | ME | done |
| 15 | Med | Split-same = same dir, half cycle out of phase; QFT fields = radius/direction (no "which hand") | ME | done |
| 16 | Med | ShapeMatrixGrid evaluated: lab-coupled (canvas render + interactive) → faithful static 12×12, not a duplicate. NOTE below. | ME | done |
| 17 | Med | prop-links removed; props folded to inline prose links | ME | done |
| 18 | Med | .resource-chip min-height:44px + box-sizing (shared CSS) | ME | done |
| 19 | Med | .section-kicker + .vtg labels floored to 0.75rem. Panel-blur NOT touched (music panel removed here; shared .panel unchanged to avoid cross-page visual change) — FLAG | ME | done/flag |
| 20 | Med | /roots/software breadcrumb → "Notation", copy → "Notation lineage" | B | done |
| 21 | Med | /notation/letters linked (letter A caption + letter index) | ME | done |
| 22 | Med | prettier --write on changed source files | ME | done |
| 23 | Low | 144-cell loop keyed with (i) | ME | done |
| 24 | Low | "Not X, but Y" flip removed | ME | done |
| — | — | Cushing = Charlie (not Ben) | ME | done |

## Notes / flags for Austen
- **#16 (ShapeMatrixGrid reuse):** the existing component canvas-renders flower images from computed `ShapeMatrixData` and is fully interactive (buttons/selection). Importing it into a public SEO page would drag the lab flower pipeline into the public bundle. Per #16's own fallback, represented the real 12×12 faithfully (correct axes, diagonal, 144 count) as a static figure instead of a duplicate. The interactive grid stays in the lab.
- **#19b (panel blur):** shared `.editorial-section.panel` still has `backdrop-filter: blur(14px)`. This page no longer uses `.panel` (music folded into prose), so it's moot here. Left shared CSS alone to avoid changing other pages' look. Fix globally if wanted (separate task).
- **Prettier reach:** `git diff` vs origin/main included unrelated in-flight files (OptionPicker, poi-lab) already dirty from another session; prettier reformatted them too. NOT mine to commit — scope the commit to notation files only.

## Verified live (:5176, HMR)
present: "eight at the top", "144 Shape Matrix", "twelve by twelve", "extended: true", "their own lineage", "letter index", "Charlie Cushing".
absent: "Quadrant", "gap none", "eight by eight", "Illustrative pseudocode", "prop-link". em/en dashes: 0.
