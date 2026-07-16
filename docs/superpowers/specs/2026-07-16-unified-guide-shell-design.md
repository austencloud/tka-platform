# Unified Guide Shell + Level-2 Parity — 2026-07-16

Austen's directive: Level 1 + Level 2 guide in one navigable experience — persistent left
sidebar (both levels' TOC), content right, reached by clicking Guide from the landing page.
Level 2 presentation brought to parity with Level 1's.

## SEO decision (settled)

NOT a literal single page. Docs-site shell: every topic keeps its prerendered URL, canonical,
and GuideSeo head; the sidebar is real `<a>` links in SSR HTML. SvelteKit client-side routing
makes it feel like one page. A literal SPA guide would collapse the 35-topic crawlable corpus
de-orphaned earlier today — rejected.

## Architecture decisions

- Sidebar data source: the MANIFESTS (`GUIDE_BODY_PAGES`, `LEVEL2_BODY_PAGES`) — not the
  hand-authored `nav-config.ts` chapter lists (third TOC source, links point at retired
  redirect stubs; retire them).
- Level-2 granularity today: `#section-id` anchors under /guide/level-2/turns and
  /double-turns. Per-topic URL split for level 2 is a later, separate step.
- Both level `+layout.svelte` files + guide hub `+page.svelte` carry UNCOMMITTED edits from a
  concurrent session (showcase/nomenclature work). Do NOT edit those three files. The sidebar
  lands by rewriting the two QUIESCENT `GuideNav.svelte` files (each level layout's existing
  <aside> hosts them already) to delegate to one shared component. Crossing levels remounts
  the layout; sessionStorage scroll restore smooths it.
- book/print/poster replicas use `+page@(public).svelte` breakout — untouched by this work.
- The final "click Guide → land directly in the shell" flip (hub redirect or hub-in-shell) is
  DEFERRED until the concurrent session's hub edits land — one small change then. Until then
  the hub links the corpus (from this morning's work), one click from the shell.

## Ledger

### Phase 1 — unified sidebar (SHIPPED 2026-07-16)
- [x] U1 (note: 2 PDFs not 3 — Level 3 guide never finished, matches hub ground truth): `guide/_components/GuideSidebar.svelte` (new dir ok): manifest-generated TOC —
      Level 1 header > groups 1.0/1.1/1.2 > 34 topic links (/guide/level-1/<slug>);
      Level 2 header > groups 2.0/2.1 > section anchor links under /turns, /double-turns;
      Codex link (/guide/codex); Downloads group (the 3 PDF hrefs from the hub).
      Active-route + active-anchor highlight; collapsible level headers (both expanded by
      default); sessionStorage scroll position restore; real anchors, no JS-only nav.
- [x] U2: Level-2 manifest gains `level2BodyPagesByGroup()` mirroring level-1's helper
      (guide-reader-nav-2.ts may already group inline — extract/share, don't duplicate).
      Section→anchor mapping: from the ch20/ch21 GuideSection ids in the two route pages.
- [x] U3: Both `GuideNav.svelte` files (level-1 `_components/`, level-2 route dir) delegate to
      GuideSidebar. `nav-config.ts` files retired from use (delete only if nothing else
      imports them).
- [x] U4: Verify: build; grep prerendered [slug] + turns HTML for the full cross-level link
      set; anchor links resolve to real ids; zero check errors in touched files.

### Phase 2 — level-2 presentation parity
- [x] P1: TurnStrip + ch20/ch21 sections adopt level-1's presentation regime: --ink/--ink-dim
      theme-decoupled palette (match FlowFrame's contract), reading measure for prose
      (34rem cap) with container-query breakout for strips (cqw), GuidePictograph sizing
      conventions. Visual reference: level-1 [slug] pages.
- [ ] P2: DEFERRED to showcase session: SequenceShowcase/GuideStepStrip integration in
      level-2 (their interfaces are in-flux today — pool wiring incomplete).
- [ ] P3: Level-2 per-topic URL split (LEVEL2_BODY_PAGES -> [slug] routes like level-1).
      Not this phase.

### Deferred / gated
- [ ] G1: Hub flip — /guide lands in the shell (gated on concurrent session's hub edits).
- [ ] G2: Chrome unification across hub/topic crossing (MARKETING_EXACT review).

## File ownership
- Executor U: new guide/_components/GuideSidebar.svelte, both GuideNav.svelte, level-2
  guide-manifest.ts (additive helper), guide-reader-nav-2.ts (extract only), nav-config.ts × 2
  (retire). FORBIDDEN: level-1/+layout.svelte, level-2/+layout.svelte, guide/+page.svelte.
- Executor P: TurnStrip.svelte, _sections/ch20/*, _sections/ch21/*. FORBIDDEN: everything
  level-1 except reading it.
