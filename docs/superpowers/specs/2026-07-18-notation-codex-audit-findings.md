# Codex Audit Findings: Notation / Roots Merge

**Date:** 2026-07-18  
**Scope:** Uncommitted redesign on `feat/notation-roots-merge`  
**Verdict:** **Not ready to ship.** Both centerpiece historical diagrams are misleading or wrong, several lineage claims exceed the evidence, the page still has the exact AI-template structure the redesign was meant to remove, and the Roots merge leaves public content and active tooling orphaned.

> **Superseded 2026-08-02:** The recommendation below to link the standalone
> `/notation/letters` index is obsolete. That duplicate was removed; the
> interactive letter catalog lives in the Composer Guide Codex.

No application source files were modified by this audit.

## Critical

### 1. The QFT diagram teaches the wrong numbering and the wrong `8 to 1` move

**Status:** Fixed 2026-07-18. Regression contract passes 2/2; full Svelte check reports 0 errors and 0 warnings.

**File:** `src/routes/(public)/notation/+page.svelte:116`, `:132-145`, `:152-153`

**Problem:** The SVG and its accessible label put `1` at the top and `8` at upper-left. The arrow therefore runs upper-left to top.

**Hard evidence:** DrexFactor's primary guide to Charlie Cushing's QFT assigns `1` to up-right, `2` to right, continuing clockwise through `8` at up. Its `8 to 1` move therefore runs from top to upper-right. The current visual is rotated by one position, and the ARIA label repeats the error. [DrexFactor QFT guide](https://www.drexfactor.com/weirdscience/2011/05/18/beginners_guide_poi_qft_notation)

**Concrete fix:** Put `8` at top and `1` at upper-right, continue clockwise through `7`, redraw the arrow from top to upper-right, and correct the comment, caption, and ARIA label.

### 2. The blank 8 by 8 "Shape Matrix" conflates three different artifacts

**File:** `src/routes/(public)/notation/+page.svelte:309`, `:315-319`, `:331-336`

**Problem:** The page labels a blank 64-cell grid as Lorq Nichols' Shape Matrix, then says the 324 Patterns and Book of P.H.A.T. came from it. Those are distinct catalogs with different dimensions, formulas, and credits.

**Hard evidence:** Lorq's primary material calls the even-petal flower artifact the **144 Shape Matrix**, built from 12 left-hand by 12 right-hand driving styles. The **324 Patterns** page instead derives its count from 27 arm paths combined with 1:1 club-spinning shapes (`18 x 10 + 9 x 16`). The separate **P.H.A.T. Chart** is an 8 by 8 catalog of 64 1:3 patterns. The Book of P.H.A.T. explicitly expands to Patterns, Hybrids, and Transitions and credits Brian Thompson, Lorq Nichols, David Cantor, and Noel Yee. [144 Shape Matrix](https://sirlorq.wordpress.com/2014/07/16/144-shape-matrix-even-petaled-flowers-rework/), [324 Patterns](https://sirlorq.wordpress.com/324-patterns/), [64-pattern P.H.A.T. chart](https://sirlorq.wordpress.com/2014/01/02/64-vtg2-patternshybrids-teaser/), [Book of P.H.A.T.](https://sirlorq.wordpress.com/vtg-book-of-p-h-a-t-vol-1-in-tech-tiles/)

**Concrete fix:** Choose one sourced artifact and represent that artifact faithfully. For a Shape Matrix example, show the actual 12 by 12 parameter space with meaningful row and column labels. Treat 324 Patterns and P.H.A.T. as separate related works, state their scopes, and retain the collaborator credits.

### 3. Eleven sections repeat the same AI-authored topic template

**File:** `src/routes/(public)/notation/+page.svelte:97-471`, especially `:98-99`, `:213-214`, `:252-253`, `:282-283`, `:308-309`, `:345-346`, `:372-373`, `:387-388`, `:412-413`, `:438-439`, `:460-461`

**Problem:** Every section opens with `section-kicker` plus H2, then prose followed by a figure, resource row, or summary. The artifacts vary, but the page still reads as eleven topic episodes generated from one recipe. Several sections end with summary cabooses at `:232-235`, `:262-265`, `:293-295`, `:317-319`, and `:404-405`.

**Hard evidence:** `.agents/skills/ai-bust/SKILL.md` classifies repeated header-per-topic episodes and uniform section development as Category 7, **CRITICAL**. The source contains eleven consecutive kicker/headline pairs. The transition at `:205-214` is particularly mechanical: "The ancestor lived one discipline over" is immediately restated as "The ancestor, one discipline over."

**Concrete fix:** Recompose the history as continuous, uneven editorial prose with at most a few meaningful internal headers. Let primary artifacts interrupt the narrative, group shorter systems together, and remove teaser and recap sentences that announce the next title card or summarize the section just read.

### 4. The synthesis restores the TKA-as-conqueror hierarchy

**File:** `src/routes/(public)/notation/+page.svelte:391-405`

**Problem:** "Each nailed one facet. The gap none of them filled" reduces every prior system to a partial attempt and presents TKA as the first complete, sequentially readable answer. That contradicts the requested peer framing.

**Hard evidence:** QFT explicitly serializes movement increments for writing and reading. PoiNotation sequences moves with concatenation and repetition operators and emits simulator-ready choreography data. The supported distinction is that TKA uses per-beat pictographs and pronounceable word labels, not that no predecessor could be read start to finish. [DrexFactor QFT guide](https://www.drexfactor.com/weirdscience/2011/05/18/beginners_guide_poi_qft_notation), [PoiNotation README](https://github.com/tiffanyfong/PoiNotation)

**Concrete fix:** State TKA's particular choices and tradeoffs without `gap`, `none`, or `slot`. A defensible version is that TKA combines pictographic per-beat sequencing, spatial references, and pronounceable labels for practitioners trained in its conventions.

## High

### 5. Siteswap's origin date and inventors are materially incomplete

**File:** `src/routes/(public)/notation/+page.svelte:217-220`

**Problem:** "Around 1985" and "worked out independently by Bengt Magnusson, Bruce Tiemann, and others" omit Paul Klimek's earlier system and the independent Cambridge branch. Magnusson and Tiemann were in the same Caltech group, not two of the independent origin points.

**Hard evidence:** Historical accounts identify Paul Klimek's Quantum Juggling in 1981, the Caltech group around Bruce Tiemann and Bengt Magnusson in 1985, and the Cambridge group including Mike Day, Colin Wright, and Adam Chalcraft. [BnF/CNAC history](https://cirque-cnac.bnf.fr/en/node/5050), [Allen Knutson's Siteswap FAQ](https://www.jonglage.net/theorie/notation/siteswap-avancee/refs/Allen%20Knutson%20-%20Siteswap%20FAQ.pdf)

**Concrete fix:** Name the three independent origin branches and use "early-to-mid 1980s": Paul Klimek in 1981, the Caltech group in 1985, and the Cambridge group in the same period.

### 6. Siteswap and music analogies are presented as proven ancestry

**File:** `src/routes/(public)/notation/+page.svelte:206-214`, `:232-235`, `:370-380`, `:391-394`

**Problem:** The page calls siteswap "the ancestor," says every later spinning system borrowed its beat model, says the underlying idea came from music, and says music "lent the letters." The cited histories do not establish any of those lines of descent.

**Hard evidence:** QFT's authorial account explains its own quantization and does not cite siteswap. The inspected VTG, Lorq, and PoiNotation primary sources do not establish siteswap ancestry. Music references describe note letters as pitch nomenclature, not a device invented to shorten rehearsal descriptions. [DrexFactor QFT guide](https://www.drexfactor.com/weirdscience/2011/05/18/beginners_guide_poi_qft_notation), [Open Music Theory on pitch notation](https://openmusictheory.github.io/pitches.html), [Juggling Lab siteswap notation](https://jugglinglab.org/html/ssnotation.html)

**Concrete fix:** Mark these as analogies or documented TKA design influences: "TKA uses a beat-by-beat structure analogous to siteswap" and "TKA uses score-like sequencing and compact letter labels." Do not claim universal borrowing or direct descent without a source.

### 7. VTG is overcredited to Noel Yee, and TKA's derivation from it is overstated

**File:** `src/routes/(public)/notation/+page.svelte:256-269`, `:293-295`

**Problem:** "Led by Noel Yee" and the chip label "Noel Yee, VTG creator" flatten a collaborative body of work. "TKA's letter types are built straight on it" overstates the relationship between the displayed timing/direction quadrant and all six TKA letter types. The page also says position is exactly what QFT covers and VTG does not, although VTG includes positional snapshots and broader pattern/transition theory.

**Hard evidence:** Noel Yee's own VTG overview names collaborators and documents timing, direction, patterns, snapshots, Minimal Beat Shapes, and Transition Theory. DrexFactor describes VTG as work created by residents of the Vulcan Lofts. TKA-domain MCP `get_alphabet_info` returned six letter types defined by shift, cross-shift, dash, dual-dash, and static hand-path topology; the displayed VTG split/together and same/opposite quadrant directly explains Type 1 dual-shifts such as A, not the construction of every letter type. [Noel Yee VTG overview](https://noelyee.com/instruction/vulcan-tech-gospel/), [DrexFactor VTG overview](https://drexfactor.com/weirdscience/2015/11/25/vulcan_tech_gospel_vtg_explained)

**Concrete fix:** Credit VTG as collaborative work from the Vulcan Lofts, with Noel as a principal compiler/publisher. Scope the claim to the shown example: VTG timing/direction terms describe TKA Type 1 letters such as A. Avoid implying that the quadrant defines all six letter types or exhausts VTG.

### 8. `/roots/software` now renders outside the shared marketing chrome

**File:** `src/config/domains.ts:57-59`, `src/routes/+layout.svelte:99-117`, `src/routes/+layout.svelte:591-599`, `src/routes/(public)/roots/software/+page.svelte:76-80`

**Problem:** `PUBLIC_PATH_PREFIXES` keeps `/roots`, so `/roots/software` correctly boots in public/landing mode. However, `MARKETING_EXACT` and `MARKETING_SUBTREES` omit `/roots/software`, and the page does not mount its own `MarketingChrome`. It therefore falls through the bare-child branch with no shared public header, footer, or cosmic shell.

**Hard evidence:** The route registries and render branch disagree in source. A fresh Vite instance returned HTTP 200 for `/roots/software`, confirming that the retained route exists; its source begins directly with `.editorial` content.

**Concrete fix:** Add exact `/roots/software` chrome registration, or give that route a public layout that mounts the same shared shell. Keep exact `/roots` itself excluded because it only redirects.

### 9. The merge removes the only visitor-facing link to the software lineage

**File:** `src/routes/(public)/notation/+page.svelte:385-408`; deleted `src/routes/(public)/roots/+page.svelte:185-195`

**Problem:** The old Roots page linked to `/roots/software`. The new Notation page does not. Header and footer Roots links were repointed to Notation, so the retained software-history page is reachable only from the sitemap or a direct URL.

**Hard evidence:** Whole-repository source search finds no Svelte `href="/roots/software"`. The old page's lines 185-195 contained a visible Software Lineage section, while `src/routes/sitemap.xml/+server.ts` still intentionally lists the route.

**Concrete fix:** Restore a concise, descriptive link to the software history near the comparative history or "Where TKA fits" passage.

### 10. Active capture and preview tooling was not migrated from Roots to Notation

**File:** `tests/screenshots/devices.ts:213-217`, `tests/screenshots/capture.spec.ts:452-454`, `src/lib/features/lab/services/screenshot-orchestrator.ts:23-30`, `src/lib/features/landing-preview/LandingPreviewModule.svelte:21-49`, `scripts/component-manifest.json:30419`

**Problem:** Screenshot capture still visits `/roots` and waits for deleted `.roots-page`; the lab route tree still exposes `roots`. The Landing Preview removed its Roots tab/loader/map without replacing it with Notation. The generated component manifest still records the deleted Roots component.

**Hard evidence:** `/roots` now redirects to `/notation`, whose root selector is `.editorial`, so the capture's critical selector wait cannot succeed. The active registries and stale manifest are direct whole-repo matches.

**Concrete fix:** Replace active Roots capture/preview registrations with Notation (`/notation`, label `notation`, and a stable Notation selector), add a Notation loader and route map to Landing Preview, then regenerate the component manifest with its canonical generator.

### 11. PoiNotation is described with invented syntax after the design required real examples

**File:** `src/routes/(public)/notation/+page.svelte:345-359`

**Problem:** The section calls PoiNotation "the one that stayed on the whiteboard" and shows `spin(inspin) then flower(antispin)`, explicitly labeled invented pseudocode. The project was implemented and released with documented input syntax. "You would type a move" and "compile it into circular-motion building blocks" are not its documented mechanism, while "never shipped past the coursework" is an unsupported absolute.

**Hard evidence:** Tiffany Fong's repository documents JSON-like move-property inputs, Scala case-class intermediate representations, `~` concatenation, `*` repetition, and output for two simulators. Its tagged v1.0 is labeled the final CS111 product, and the public commit history ends in December 2016; that supports "the public repository stops with the course release," not proof that it never existed elsewhere. [PoiNotation repository](https://github.com/tiffanyfong/PoiNotation), [final writeup](https://github.com/tiffanyfong/PoiNotation/wiki/Final-writeup), [v1.0 release](https://github.com/tiffanyfong/PoiNotation/releases/tag/v1.0)

**Concrete fix:** Show a short real input excerpt from the repository with attribution. Describe it as an archived Fall 2016 Scala DSL course project whose public repository ends with the CS111 release.

### 12. The music section makes false claims about scores and note names

**File:** `src/routes/(public)/notation/+page.svelte:373-380`

**Problem:** "Sheet music writes down what to play, not how to feel" ignores dynamics, articulation, phrasing, tempo, expression, and performance directions. "The entire reason the notes on a staff have names" is unsupported causal history.

**Hard evidence:** Standard notation encodes pitch and rhythm plus dynamics, tempo, articulation, expression, and special performance directions. Letter names identify pitches or pitch classes; the reviewed theory sources do not attribute their existence to rehearsal brevity. [Open Music Theory, other aspects of notation](https://viva.pressbooks.pub/openmusictheory/chapter/other-aspects-of-notation/), [Open University, performance directions](https://www.open.edu/openlearn/mod/oucontent/view.php?id=1791&section=8)

**Concrete fix:** Say that scores encode pitch, rhythm, and selected performance instructions while still leaving interpretive decisions to performers. Present TKA's compact letter labels as its own mnemonic and rehearsal choice.

## Medium

### 13. Universal language repeatedly exceeds the sources

**File:** `src/routes/(public)/notation/+page.svelte:86-88`, `:232-235`, `:252-259`, `:289-290`, `:309`, `:317-319`

**Problem:** "Nobody," "every spinning system," "everyone borrowed," "the whole community," "every spinner," "the whole space," and "the full space" turn influence and bounded catalogs into universal claims.

**Hard evidence:** The primary sources call VTG influential and define finite QFT and Lorq parameter spaces. None demonstrates universal adoption, exhaustive movement coverage, or universal borrowing.

**Concrete fix:** Use bounded language: "an influential vocabulary," "a familiar clock-face shorthand," and "a combinatorial catalog under these constraints." Delete claims that require proving a universal negative.

### 14. The TKA grid claim excludes supported grid modes

**File:** `src/routes/(public)/notation/+page.svelte:397-401`

**Problem:** "Every beat is a pictograph on a nine-point grid" states one grid form as universal.

**Hard evidence:** TKA-domain MCP `get_alphabet_info` describes grids with **up to nine points**, including diamond, box, centric, and skewed modes, with advanced conjoined grids. The rest of the sentence about per-beat pictographs and pronounceable sequence words is supported.

**Concrete fix:** Use "a spatial grid of up to nine reference points" and, if the page intends only the canonical introductory grid, label that scope explicitly.

### 15. Split-same and QFT fields are described imprecisely

**File:** `src/routes/(public)/notation/+page.svelte:152-175`, `:191-203`, `:286-290`

**Problem:** "Both hands turning the same direction" is ambiguous about what turns; in VTG, same/opposite describes hand-path direction, not prop rotation. Split time is merely called "offset" rather than half a cycle out of phase. QFT lists "which hand" as a field even though the documented columns track poi and hand-path positions, radius, and direction, not a left/right hand-identity field.

**Hard evidence:** TKA-domain MCP `get_alphabet_info`, `get_letter_explanation("A")`, `tka_to_vtg("A")`, and `get_pictograph_data("A", 0)` returned Type 1 Dual-Shift, Split Same, both prop motions pro, variation 0 `alpha3` to `alpha5`; the domain definition says VTG same/opposite applies to hand paths and split is 180 degrees out of phase. DrexFactor's QFT guide documents poi origin/arrival and direction plus hand-path origin, arrival, and radius. [DrexFactor QFT guide](https://www.drexfactor.com/weirdscience/2011/05/18/beginners_guide_poi_qft_notation)

**Concrete fix:** Say "the hand paths travel the same direction, half a cycle out of phase." For QFT, list poi origin/arrival and direction plus the hand path's origin, arrival, and radius; use "reaches" rather than "lands."

### 16. Primitive discovery missed the existing Shape Matrix implementation

**File:** `src/routes/(public)/notation/+page.svelte:330-336`, `:639-667`; `src/lib/features/lab/vtg-lab/components/ShapeMatrixGrid.svelte:70-113`

**Problem:** The page hand-rolls 64 blank spans and local matrix CSS even though the repository already has `ShapeMatrixGrid`, which renders real left/right axes and semantic, keyed cells. The redesign's primitive-search ledger never discusses this exact-name match.

**Hard evidence:** This conflicts with `.claude/rules/never-hand-roll.md` and `.claude/rules/primitive-discovery.md`, which require reviewers to flag duplicate implementations and evaluate reuse or extension of substantial matches.

**Concrete fix:** Evaluate the existing grid explicitly. If its interactive dependencies are unsuitable for editorial use, extract one read-only presentation layer or use a sourced static historical figure. Do not keep a second unlabeled matrix implementation.

### 17. The prop navigation duplicates an existing link-row treatment

**File:** `src/routes/(public)/notation/+page.svelte:449-455`, `:669-700`; `src/lib/shared/landing/styles/public-editorial.css:280-309`

**Problem:** The page adds local `prop-links` and `prop-link` styles for a pill link row. The source comment calls this an established editorial pattern, but no shared `prop-links` primitive exists. The existing `resource-row`/`resource-chip` treatment covers most of the same layout and affordance.

**Hard evidence:** Repository search finds the local class only on this page and the shared resource treatment in `public-editorial.css`. That fails the primitive-discovery requirement to reuse or deliberately extend existing substantial matches.

**Concrete fix:** Reuse the sanctioned shared link treatment after correcting its touch target, or create one shared editorial navigation component/treatment and migrate both uses. Remove the local clone.

### 18. Source-link chips miss the 44px touch-target floor

**File:** `src/routes/(public)/notation/+page.svelte:238-245`, `:268-275`, `:298-301`, `:322-325`, `:362-365`; `src/lib/shared/landing/styles/public-editorial.css:287-309`

**Problem:** `.resource-chip` has no `min-height`. At its minimum font size, inherited line-height, padding, and border, its computed height is about 40px.

**Hard evidence:** `.claude/rules/clickables-look-like-buttons.md:18-22` requires a 44px minimum touch target.

**Concrete fix:** Add `min-height: 44px` and `box-sizing: border-box` to the shared resource-chip treatment and preserve visible focus styles for every consumer.

### 19. New and reused styles violate project typography and panel rules

**File:** `src/routes/(public)/notation/+page.svelte:371`, `:569-577`; `src/lib/shared/landing/styles/public-editorial.css:108-123`

**Problem:** VTG labels can shrink to `0.7rem` (11.2px), and every section kicker can shrink to `0.72rem` (11.52px). The music content panel inherits a 14px backdrop blur.

**Hard evidence:** `.agents/skills/styling/SKILL.md` sets 12px as the absolute floor for supplementary text and prohibits blur on content panels.

**Concrete fix:** Keep supplementary labels at or above `0.75rem`/`--font-size-compact`; use theme panel/card tokens without backdrop blur for editorial content.

### 20. Software-history breadcrumb and link labels still say Roots while pointing to Notation

**File:** `src/routes/(public)/roots/software/+page.svelte:69`, `:136-138`

**Problem:** Structured data names breadcrumb item 2 "Roots" while its item URL is `/notation`. Visible copy calls the same destination the "roots page."

**Hard evidence:** `/roots` now returns 301 to `/notation`; `/notation` is the canonical destination and page identity.

**Concrete fix:** Rename both labels to "Notation" or "Notation lineage."

### 21. The approved per-letter cross-link is missing

**File:** `src/routes/(public)/notation/+page.svelte:178-193`, `:458-470`; `docs/superpowers/specs/2026-07-17-notation-roots-merge-design.md:174`

**Problem:** The design says the per-letter pages remain and should be cross-linked. The page displays the A asset but never links the letter index.

**Hard evidence:** Whole-repository search of this page finds no `href="/notation/letters"`.

**Concrete fix:** Link the A example or final learning path to `/notation/letters` with a descriptive label.

### 22. Four changed files fail the formatting gate

**File:** `src/routes/(public)/notation/+page.svelte:1`, `src/config/domains.ts:1`, `src/routes/+layout.svelte:1`, `src/routes/sitemap.xml/+server.ts:1`

**Problem:** The touched code is not Prettier-clean.

**Hard evidence:** Targeted `npm exec prettier -- --check` reported all four files and exited 1 on 2026-07-18. `git diff --check` is clean, so this is formatter output rather than whitespace-error output.

**Concrete fix:** Format the four touched files with the repository's Prettier version and rerun the targeted check.

## Low

### 23. The 64-cell loop is unkeyed

**File:** `src/routes/(public)/notation/+page.svelte:332-334`

**Problem:** The loop is static and Svelte accepts it, but the audit brief explicitly requires the 64 cells to be keyed.

**Hard evidence:** The source uses `{#each Array.from({ length: 64 }) as _, i}` with no key expression. It does produce 64 cells and eight diagonal cells.

**Concrete fix:** Use `(i)` as the key, or remove the illustrative loop when replacing the historically inaccurate matrix.

### 24. A banned negative-to-positive AI flip remains

**File:** `src/routes/(public)/notation/+page.svelte:202-203`

**Problem:** "Not how the hands relate to each other, but which..." uses negation to manufacture a contrast before stating the point directly.

**Hard evidence:** `.agents/skills/ai-bust/SKILL.md` identifies "Not X, but Y" correction framing as Category 1 AI prose. This is the only direct instance found; the larger structural failure is finding 3.

**Concrete fix:** State the comparison directly: "QFT records which of the eight circle points a prop passes through, while VTG classifies the relationship between the hand paths."

## Verified claim ledger and clean dimensions

- **TKA letter A:** TKA-domain MCP `get_letter_explanation("A")`, `tka_to_vtg("A")`, and `get_pictograph_data("A", 0)` agree that A is Type 1 Dual-Shift, Split Same, both prop motions pro, with variation 0 moving from `alpha3` to `alpha5`. The A identity and displayed `SS` quadrant are sound.
- **TKA core model:** TKA-domain MCP confirms the canonical double-staff pictograph model, one pictograph per beat, six letter types, pronounceable sequence words, and the supported grid modes. The page's per-beat/word claims are sound after qualifying the grid as described in finding 14.
- **TKA prop scope:** TKA-domain MCP confirms the multi-prop alphabet framing and that poi use a restricted subset. No contradiction was found in `src/routes/(public)/notation/+page.svelte:442-446`.
- **Siteswap mechanics:** A digit records the number of beats until the same object is thrown again; repeating `3` is the three-ball cascade; `531` is a valid three-ball pattern. Ben Beever's Generalised Siteswap adds rows/attributes such as spin and orientation. [Juggling Lab](https://jugglinglab.org/html/ssnotation.html), [Ben Beever's Guide to Juggling Patterns](https://www.jonglage.net/theorie/notation/siteswap-avancee/refs/BenBeeversGuidetoJugglingPatterns.pdf)
- **QFT identity:** Quantized Field Theory is the correct expansion. The primary guide calls it Charlie Cushing's QFT. Charlie Cushing also developed 9-Square Theory. The audit brief's references to **Ben Cushing** are mistaken. [DrexFactor QFT guide](https://www.drexfactor.com/weirdscience/2011/05/18/beginners_guide_poi_qft_notation), [Spin More Poi](https://www.spinmorepoi.com/advanced/)
- **Lorq identities:** Sir Lorq is Lorq Nichols. Shape Matrix, 324 Patterns, and the Book of P.H.A.T. are real names; the defect is the page's conflation, dimensions, causal wording, and missing collaborator credit, not invented artifact names.
- **PoiNotation basics:** Tiffany Fong authored PoiNotation in 2016 as a Scala DSL course project, and it translates text-file move descriptions into output for visualizers. Those core statements are verified; finding 11 covers the inaccurate mechanism and framing.
- **Source-link health:** All seven URLs in the page's `src` object returned HTTP 200 on 2026-07-18. There is no dead-link finding for those exact URLs. The Lorq biography link is live but too generic to substantiate the adjacent matrix/count claims; use the direct primary pages cited above.
- **AI micro-patterns:** Zero user-visible em dashes, unsigned first person, blacklisted words, robotic transition words, hedging phrases, sycophantic openers, or `Whether you're` endings were found. Sentence-length variation is healthy. Category 7 macro-structure and the negative-to-positive sentence at `:202-203` remain.
- **Redirect/runtime:** A fresh isolated Vite server on port 5174 returned HTTP 301 with `Location: /notation` for `/roots`, HTTP 200 for `/notation`, and HTTP 200 for `/roots/software`. `prerender = false` is sane with the Cloudflare adapter because it preserves a real HTTP redirect.
- **Sitemap/SEO:** A fresh `/sitemap.xml` contains `/notation` and `/roots/software`, not `/roots`. `/notation` retains canonical, Open Graph, Twitter, Article JSON-LD, and BreadcrumbList JSON-LD; the OG image exists. The software breadcrumb mismatch is isolated in finding 20.
- **Svelte/code health:** `npm run check` completed with **0 errors and 0 warnings**. Targeted Vitest coverage passed **3 files and 18 tests** (`image-sitemap`, `notation-letters-page-contract`, `notation-letters-seo`). No changed Svelte file uses legacy `$:`, `export let`, or `on:` syntax.
- **Layout/interaction:** The A image has intrinsic dimensions; Rosetta art and `SequenceHeroDemo` reserve their footprints. No new checkboxes or crossfades were introduced. `SequenceHeroDemo.svelte:46` correctly sends `sequence.word` through `simplifyRepeatedWord`.
- **Inline figure mechanics:** The VTG grid order and accessible label are internally sound. The matrix loop produces 64 cells and eight diagonals and its wrapper is labeled; its failures are historical accuracy, duplication, and the missing key. The QFT SVG is mechanically labeled but factually wrong as described in finding 1.
- **Browser:** No browser was launched, as requested.
