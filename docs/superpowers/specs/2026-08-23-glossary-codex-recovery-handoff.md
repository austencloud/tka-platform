# Glossary Codex Recovery — Handoff (2026-08-23)

## Mission

Recover the `/glossary` work after a rejected Letter Codex implementation, then finish the original glossary-scope and vocabulary audit without repeating the failed implementation process. Austen wants an honest evolving-scope statement instead of completeness claims, synchronized visible copy/SEO/JSON-LD/counts/search, a categorized Guide/Concepts missing-vocabulary list before any definitions are added, and Flow Arts MCP grounding for every domain definition. For the Letter Codex specifically, Austen requires the established Guide grouping and canonical pictograph/glyph pipeline, a real test harness with alternatives, subagent review, and multi-viewport DevTools screenshots before production integration. The historical architecture decision that governs the Codex is [the approved Guide Codex merge design](shipped/2026-07-10-guide-codex-merge-design.md).

## Done — verified

### Read-only recovery audit

- Commit: none; this was a read-only audit on `main` at `fca6c4a2b75f77fba4fe5e23ad26c8de12610ccc`.
- The actual Guide source was opened at `D:\_THE KINETIC ALPHABET\_GUIDE\exports\level-1.pdf`; pages 19 and 20 were rendered to `tmp/pdfs/glossary-codex-audit/level1-19.png` and `level1-20.png` and visually inspected at original resolution.
- The canonical page composition was verified from the Guide: Types 1–2 are one sheet, Types 3–6 are the second; cells use visible shared borders, exact `ABC | DEF`, `GHI | JKL`, and subsequent groupings, outer-corner transition captions, and canonical TKA glyphs.
- The in-repo canonical owner was traced to:
  - `src/routes/(public)/guide/codex/_data/codex-groups.ts`
  - `src/routes/(public)/guide/codex/_components/CodexSheet.svelte`
  - `CodexBox.svelte`, `CodexCell.svelte`, and `CodexTransitionGlyph.svelte` beside it
  - `src/routes/(public)/guide/codex/parity/+page.svelte` and `static/test/codex-original/sheet1.png`, `sheet2.png` as the existing parity harness/artifacts
- Repository evidence confirmed that the current glossary work resurrected a component that the approved 2026-07-10 design explicitly retired after Austen rejected the explorer/control-bar direction. Commit `136786e591` deleted `CodexExplorer.svelte` and its test route. The current `src/lib/features/learn/codex/components/CodexExplorer.svelte` is untracked and should not be treated as canon.
- Two read-only subagent audits completed:
  - architecture audit: traced canonical owners, historical decisions, current consumers, grid/glyph owners, and responsive failure causes
  - domain audit: cross-checked all six types and the Tau-Dash extension through Flow Arts MCP
- Flow Arts MCP calls in this session verified:
  - Type 1 Dual-Shift: A–V
  - Type 2 Shift: W, X, Y, Z, Σ, Δ, Θ, Ω
  - Type 3 Cross-Shift: their dashed counterparts
  - Type 4 Dash: Φ, Ψ, Λ, plus registered higher-level extension τ- with no current dataframe variations
  - Type 5 Dual-Dash: Φ-, Ψ-, Λ-
  - Type 6 Static: α, β, γ
- Direct MCP `get_letter_explanation` / `list_letter_variations` evidence also verified the distinct Type 4–6 transitions that the rejected picker flattened incorrectly:
  - Type 4: Φ `β→α`, Ψ `α→β`, Λ `γ→γ`
  - Type 5: Φ- `α→α`, Ψ- `β→β`, Λ- `γ→γ`
  - Type 6: α, β, γ remain at their corresponding positions
- The visual failure was traced mechanically:
  - `CodexSheetPicker.svelte` duplicates the group model in a hard-coded `CODEX` array.
  - It uses ordinary Unicode for position captions instead of `CodexTransitionGlyph` or the TKA font.
  - It erases the grouped table borders, even though those borders communicate the Codex hierarchy.
  - It infers one transition per box, which makes Types 4–6 visibly wrong.
  - It forces `showGrid` but omits explicit `showHandPoints`; inherited visibility can make the point grid disappear.
  - The resurrected explorer uses one/two/three/four-column thresholds at pane widths that force two oversized variation cards in Austen's 4K screenshot.

## Believed done — unverified

- Earlier in-flight edits appear to change the glossary's completeness copy, counts, taxonomy, search, and vocabulary data, but the recovery audit did not validate those changes end to end. Treat every completeness/count/search/JSON-LD claim as unverified until Opus re-audits the exact diff.
- Earlier work may have produced a missing-vocabulary inventory, but no approved categorized list was delivered as a stable artifact in this handoff. Reconstruct it from the Guide and Concepts curriculum before adding or restoring definitions.
- The current page reportedly shows 132 terms and a `47+1` Letter Codex count. Neither number is accepted evidence of correct taxonomy or domain completeness.
- No runtime visual state is approved. Existing screenshots document rejection, not success.

## In flight

- Branch: `main`
- HEAD at handoff creation: `fca6c4a2b75f77fba4fe5e23ad26c8de12610ccc`
- The shared worktree is extremely dirty with many unrelated live-agent changes. Do not stage, revert, restore, or clean broadly.
- Glossary/Codex-scoped changes visible at handoff time:
  - modified `packages/domain/src/data/glossary.ts`
  - modified `src/lib/features/learn/codex/components/CodexSheetPicker.svelte`
  - untracked `src/lib/features/learn/codex/components/CodexExplorer.svelte`
  - modified `src/routes/(public)/glossary/+page.server.ts`
  - modified `src/routes/(public)/glossary/+page.svelte`
  - modified `src/routes/(public)/glossary/_components/GlossaryNav.svelte`
  - modified glossary integrity/search/taxonomy tests
  - untracked `src/routes/(public)/glossary/codex-letter-search.ts` and its test
- The bad Codex implementation has not been reverted because the worktree is shared and the recovery pass was deliberately read-only. Inspect each scoped diff before deciding what is safe to remove.
- No production implementation, harness, commit, or push was completed after Austen rejected the visual result.

## Loose ends (ranked)

1. **Re-establish the approval gate with Austen.** The recovery proposal recommended option A below, but Austen did not select an option before asking for this Opus handoff. Do not infer production approval from the handoff request.
   - A, recommended: one canonical Guide sheet page at a time on the left, compact capped four-column variations on the right; dedicated variation view on narrow screens.
   - B: full sheet first; selection opens a desktop drawer/mobile bottom sheet.
   - C: keep the glossary textual and deep-link to the dedicated Guide Codex.
2. **Resolve the Type 3 Guide/MCP conflict with Austen.** The printed Guide places `Σ-/Δ-` left under an `α→γ` caption and `Θ-/Ω-` right under `β→γ`. Current MCP data says `Σ-/Δ-` are `β→γ` and `Θ-/Ω-` are `α→γ`. The recovery recommendation was to preserve the Guide's family placement (`Σ-/Δ- | Θ-/Ω-`) but use MCP-correct captions. This is not yet approved.
3. **Audit the existing scoped diff before writing.** Identify which changes are from the rejected implementation, which are valid glossary scope/copy work, and whether any overlap belongs to another agent. Do not use broad restore/reset commands.
4. **Build a noindex A/B/C harness only after the direction/scope is approved.** Compose the existing Guide Codex owners and existing variation query/renderer. Do not extend the hard-coded `CodexSheetPicker` as canon and do not create another grouping owner.
5. **Review the harness with Austen before production.** Required evidence: screenshots at 3840×2160, 2560×1440, 1920×1080, 1440×900, tablet, 960×412, and 375px; visible canonical point grid; exact grouping/caption placement; canonical glyphs; no two-up giant cards; no nested-scroll first impression. The user explicitly requested DevTools and every-device review, so browser verification permission is present for this work.
6. **Have independent reviewers critique the harness.** Route architecture/domain/accessibility/visual passes through appropriate subagents, then show the actual alternatives and critique to Austen.
7. **Integrate only the approved direction into `/glossary`.** Austen's original ownership instruction was `src/routes/(public)/glossary/**`; touch `packages/domain/src/data/glossary.ts` only for approved term additions; do not edit shared landing navigation. Any need to promote/move a canonical Guide component outside that scope requires explicit expansion.
8. **Remove the rejected resurrection carefully.** After proving authorship/overlap, delete the untracked resurrected explorer and unwind the out-of-scope `CodexSheetPicker` changes rather than polishing them.
9. **Complete the original vocabulary deliverable.** Produce the categorized Guide/Concepts missing-term list before definitions. Obtain term approval, use Flow Arts MCP for every domain definition, and keep visible copy, metadata, JSON-LD, category counts, and search synchronized.
10. **Run proportional verification and commit only explicit owned paths.** Do not run a broad shared-worktree commit. Port 5173 is Austen's HTTPS/2 dev server and must not be restarted or killed.

## Decisions already made

- 2026-08-22/23: Austen rejected the current Codex screen and its process. It is not an acceptable baseline to polish.
- The Codex must be a pictorial reference organized in the established Guide pattern, including the `ABC DEF / GHI JKL` family composition, not a textual glossary list of every letter.
- Clicking a pictograph should reveal that letter's variations, but the first impression must preserve the canonical overview and sensible density.
- Pictographs must show a legible canonical grid. Two enormous variation cards per row and needless scrolling are rejected.
- Alpha/Beta/Gamma and transition labels must use the canonical TKA glyph/font pipeline; ordinary hand-typed Greek and incorrect placement are rejected.
- Production work must follow orientation, brainstorming, alternatives, a test page, screenshot evidence, subagent review, and explicit agreement with Austen. Do not jump directly to full implementation.
- The glossary must describe itself honestly as an evolving glossary for Kinetic Alphabet concepts, not all Flow Arts vocabulary; many entries are also used elsewhere in Flow Arts.
- Every domain definition must be sourced through the Flow Arts MCP, not memory.
- Missing vocabulary must be categorized and presented before definitions are added.
- Shared landing navigation is out of scope.
- Austen's final instruction for this session was: `/handoff to opus who will do it better`.

## Gotchas

- The Guide's current Codex code is route-local under `src/routes/(public)/guide/codex/`, but it is the proven presentation owner with several consumers. Glossary production scope does not automatically authorize moving or editing it.
- The approved 2026-07-10 design explicitly records that Austen rejected the explorer-style page and retired `CodexExplorer`. Do not revive it under a new name.
- `showGrid={true}` alone is insufficient in the current renderer path. A reference surface must explicitly establish hand-point visibility as well.
- Type 4, Type 5, and Type 6 require per-cell captions, not one header per row.
- `τ-` is a registered Level 4 Type 4 extension with no current dataframe variations. It is not a letter type, not a seventh group, and should remain visually subordinate to the 47 base letters.
- The Guide/PDF itself contains the unresolved Type 3 caption/data conflict described above. “Match the PDF” and “match current MCP truth” are not identical requirements here.
- `src/styles/tka-font.css` owns typeable letter glyphs; `CodexTransitionGlyph.svelte` owns transition headers; pictograph-internal TKA labels belong to the renderer. Do not substitute Georgia/Unicode.
- The existing `/guide/codex/parity` route and `static/test/codex-original` sheets are the fastest visual fidelity references.
- `letter-codex-intro` is listed as not started in `docs/learn/concept-status.md`; there is no confirmed Learn lesson that authorizes resurrecting the retired explorer.
- Use `https://localhost:5173`, never HTTP. Do not start, stop, restart, or kill Austen's server. Use a separate Vite port only if truly needed.
- The shared index and worktree contain unrelated agents' files. Every commit must use an explicit pathspec.
