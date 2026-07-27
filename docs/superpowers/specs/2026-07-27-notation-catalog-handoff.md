# /notation catalog rebuild — Handoff (2026-07-27)

## Mission

`/notation` was gated on 2026-07-26 because it explained notation systems its
author does not own, and got them wrong. It is being rebuilt as a **chronological
catalog** — a record of who wrote flow arts down, with links out to their own
material, explaining nothing.

Austen, 2026-07-26: *"framing it as a catalog seems more honest and short than
trying to explain the previous systems."* And on the old page: *"a little
pretentious to try to actually explain QFT ... a little reductive to explain
[VTG] as a two by two grid."*

Design spec: `docs/superpowers/specs/2026-07-26-notation-catalog-design.md`

**The catalog has not been built.** What exists is the gate, the spec, a layout
sketch, and a completed source fact-check. The next agent implements.

## Done — verified

### 1. `/notation` gated behind a reusable component — `b4c870dfb7`

Production renders `src/lib/shared/landing/components/UnderConstruction.svelte`;
dev renders the old page, preserved verbatim as
`src/routes/(public)/notation/_components/NotationHubDraft.svelte`. Nine
sub-pages untouched and still live.

Evidence:
- `curl https://localhost:5173/notation` → `200`, contains "Three notation
  languages" (the dev draft renders).
- Screenshotted at 3840×2160, 2560×1440, 1920×1080, 1440×900, 820×1180,
  960×412, and 375×667 by temporarily forcing the gate branch. Two defects
  found and fixed in that pass: a stranded fifth destination button on tablet
  (cut to four) and ragged button widths stacked on mobile (now full-width
  below 30rem).
- Sitemap: `{ url: "notation" }` removed; sub-pages retained. Verified by grep —
  no exact match remains.
- `noindex, follow` on the gated branch only.
- Tests: `npx vitest run tests/unit/notation-roots-remediation-contract.test.ts
  tests/unit/seo-measurement.test.ts tests/unit/seo-indexing-controls.test.ts
  tests/unit/image-sitemap.test.ts` → **35 passed / 35**. The contract test was
  repointed at the draft file and a new `notation hub gate` describe block added.
- `npm run check` → 5 errors, **none in this diff**: 4 in
  `src/lib/features/write/components/sheet/ChoreoSheetView.svelte` and 1 in
  `src/routes/test/profile-stage/+page.svelte`, both another session's in-flight
  work (`M` and `??` in git status, not touched here).

Preview harness for the gate: `/test/under-construction`. Needed because the
real route shows the draft in dev.

### 2. Spec written and fact-checked — `b575d6df86`, `a1d8f4a6c0`

Includes `static/sketches/2026-07-26-notation-spine.html`, the sketch the Lorq
granularity decision was made from (rendered and screenshotted at 1920).

### 3. Two Home of Poi threads archived — wiki repo `1d6f0fe`

`E:\flow-arts-wiki\content\sources\homeofpoi\932537-qft-notation.md` and
`891193-what-are-caps.md`, with URL, retrieval date, and method in frontmatter.

Evidence they needed archiving: the Wayback availability API returns
`"archived_snapshots": {}` for all three candidate threads, and the CDX index
(`web.archive.org/cdx/search/cdx?url=homeofpoi.com*`) returns forum **user**
pages only — no topic page has ever been captured.

## Believed done — unverified

Nothing. Every claim above has evidence inline. The catalog itself is not
started, so there is nothing half-built to distrust.

## In flight

**Nothing of mine.** Working tree is clean for every file this work touched;
all three commits are pushed to `main`. Verified: `git status --short` over the
touched paths returns empty, `git log origin/main..HEAD` is empty.

Other sessions have uncommitted work in the tree (`ChoreoSheetView.svelte` and
others). **Do not stage or commit those.** Use explicit pathspecs
(`.claude/rules/commit-only-your-own-changes.md`).

## Loose ends (ranked)

**1. Pull the three remaining Home of Poi threads.** This is where you start —
it's the only thing blocking a complete entry list, and the material is
genuinely at risk.

- `907828` — A mathematical approach to advanced flower patterns
- `886966` — Poi Theory of Everything
- `934076` — 8-step CAPs

The goal is a date for **Unit Circle Theory** (Alien Jon), the last entry with
no year. Under the spec's sourcing rules it ships undated or not at all — never
with a guess. Archive each to `content/sources/homeofpoi/<id>-<slug>.md` in the
same format as the two already there.

**How:** Claude in Chrome, not DevTools MCP. See Gotchas.

**2. Ask Austen what year he started TKA.** The spec currently carries "c. 2022"
from his own wiki, which he has called slop. He is right here; ask him. Do not
ship a hedged c-date about this site's own author.

**3. Build the catalog.** Data file
`src/lib/shared/notation/notation-catalog.ts` per the spec's `CatalogEntry`
shape, then the spine component. Entry list and row anatomy are in the spec.

**4. Solve the 4K width problem.** In the sketch, rows use ~800px of a 1720px
band at 1920 and the right half is empty — worse at 3840. Likely fix is moving
sources and the video strip into a right-hand column so a row spans the band.
Resolve against real viewports with screenshots, not arithmetic.

**5. Promote `CapsVideoCard` to a shared component.** Move
`src/routes/(public)/notation/caps/_components/CapsVideoCard.svelte` to
`src/lib/shared/components/SourceVideoCard.svelte` and have the CAPs page
consume the shared one. Do not fork it.

**6. Delete `NotationHubDraft.svelte`** once the catalog ships, and un-gate:
remove the `dev` branch, drop `noindex`, restore JSON-LD, re-add
`{ url: "notation" }` to the sitemap, and replace the gate contract test.

**7. Separately, and arguably more valuable than this page:** `linkkeeper` in
the wiki repo (`scripts/linkkeeper/jobs/snapshot_critical.py`) exists to WARC
eleven priority domains — drexfactor, sirlorq, noelyee, playpoi, homeofpoi and
more — to R2. It has **never run**: no `.warc`, `.db`, or `.sqlite` anywhere in
the repo, and it needs a MySQL table plus R2 credentials. Today proved Wayback
is not covering Home of Poi at all. Worth its own session.

## Decisions already made

Do not re-litigate these.

- **Catalog, not explainer** (2026-07-26). A record of what came before. No
  system is explained. *"I don't even understand [QFT] well enough to explain
  ... VTG ... probably deserves to just be linked to its original sources so
  that the original author gets a little more credit instead."*
- **Chronological spine layout**, year in a left rail. Chosen over a ledger
  table and a card grid.
- **Lorq is one entry, not four** (2026-07-26, after seeing both rendered).
  Four rows required inventing three years and broke the chronology. Austen:
  *"I'm agreeing with you that a is the move. We just need to make sure that we
  put the proper date in so it's 2012 until whenever"* — hence `2012–`,
  open-ended.
- **Siteswap is not an entry.** *"I don't know if that would be considered a
  flowart ... it's not like Flow Arts existed when they created Siteswap."* It
  becomes one line above the spine acknowledging borrowed ideas, with music.
- **Do not lean on DrexFactor as the standing citation.** Austen, 2026-07-26:
  *"I don't want to have my page just covered in links to his work all of the
  time as though he's the primary source."* Use creators' own material; Drex
  appears where he is genuinely the author. Note his significant contributions
  where real. (Austen gave a reason and asked that it not be written down; it is
  deliberately omitted here. Just follow the rule.)
- **Video strips are wanted.** *"if we can find links to specific videos that
  explain these that would be absolutely sexy as hell."* Every video ID must be
  loaded and confirmed before shipping.
- **The TKA row links to `/guide`** — every row links to its creator's own
  material and TKA's is this site. Consistency, not a funnel. No CTA button.
- **Gate shows a note, not a 404** (2026-07-26): *"there should be a nice little
  note that says this page is currently under construction and we can reuse that
  elsewhere when it comes to gating other features on the front page."*

## Gotchas

**Home of Poi is behind Cloudflare and DevTools MCP cannot get through.** A
CDP-driven Chrome is flagged as automation; the interstitial never clears — I
waited 21 seconds on a clean load and it stayed on "Performing security
verification." `curl` gets 403 regardless of user-agent.

**What works: Claude in Chrome, in Austen's real browser, where he is already
logged in as `austencloud`.** Full flow: `list_connected_browsers` →
`AskUserQuestion` to let him pick → `select_browser` → `tabs_context_mcp` →
`navigate` → `get_page_text`. Note the extension's browser list is unstable —
the deviceId he picked had disconnected by the time I called `select_browser`,
and the names shifted. Re-list and confirm rather than trusting a stale id.

**`E:\flow-arts-wiki\content\drafts\*.wiki` is not a source.** 181 articles,
every one `{{AI generated}}`. It is wrong about CAPs' coiner, Zaltymbunk's
date, and TKA's founding year, and `Poi_notation.wiki` — the one file shaped
exactly like this page — is the least reliable of the lot. Austen: *"My wiki is
slop bro."*

**But `E:\flow-arts-wiki\flow-arts-transcripts\transcripts` is gold.** 615
subtitle files of creators actually speaking: DrexFactor 328, PlayPoi 113, Noel
Yee 86, SpinMorePoi 43, Leonardo Icaza 37, Charlie Cushing 4. This is where the
VTG correction came from. Strip SRT numbering with
`sed -e 's/<[^>]*>//g' | grep -v "^[0-9]*$" | grep -v -- "-->" | awk '!seen[$0]++'`.

**Never source a claim from the page you are replacing.** The whole QFT mess
started because the first factual claim was lifted from
`NotationHubDraft.svelte`. See memory `feedback_source_tiering`.

**`sirlorq.com` does not resolve.** The old page links it in a figcaption.
`sirlorq.wordpress.com` is live.

**`/test/*` routes are captured by a Lab shell.** Navigating to
`/test/under-construction` in the browser can land you on a Lab tab instead of
your page. To see a gated page's production branch, temporarily invert the `dev`
condition in the route and revert after — that is how the gate was screenshotted.

**Reaching a real 3840 viewport** needs Chrome launched with
`--force-device-scale-factor=1`, and `resize_page` (page dimensions), not
`resize_window`. The window has a ~500px minimum width, so 375px must be reached
with `emulate` and a viewport override, not `resize_page`.

**Another session shipped a QFT instrument** — `1b635ee299`, `/test/qft-notation`
plus `src/lib/shared/notation/qft/qft-model.ts` and 250 lines of tests. It is
**consistent with the archived primary**, including the Charlie-vs-Drex
disagreement about direction at the odd-numbered points, which it exposes as a
`Convention` toggle. Two notes: it writes the acronym as "QfT" where the 2011
source writes "QFT", and it lives under `src/lib/shared/notation/`, which is
where the spec puts `notation-catalog.ts` — check for collisions before adding
files there. There is also a live tension worth raising with Austen: the catalog
is explicitly *not* an explainer, and that instrument explains QFT beautifully.
It may belong linked from the QFT row, or on its own destination page. Ask; do
not decide it silently.

## Facts established this session (all archived or primary-sourced)

- **QFT = Quantized Field Theory.** Drex's 2011 primer: *"Charlie's Quantized
  Field Theory for poi and one of its applications: notation for props."*
  Cushing created it, Drexler wrote the primer, Alien Jon and Noel Yee gave
  feedback on their Kinetic Fire class.
- **"CAP" was coined by Damien, handle French_Saltimbanque**, 2009 — not Nick
  Woolsey, not Alien Jon. Alien Jon: *"I got the term from Damien."* Pre-history
  is Burning Man 2007, the OMCC crew (Noel, Greg, Jordan, Zan, Alien Jon).
- **Zaltymbunk's trochoid model is 2009, not 2017**, and it is a full parametric
  notation — `Theta1 Theta2 ; Rho1 Rho2 ; d`, a wrap table, a cycloid condition,
  feasibility rules. He posts as "TrochoÏd Master" from Angers, France. Danny_
  of Brighton modelled the same thing independently against the ground. Any
  "trigonometric model, 2017, Zaltymbunk + Drex" attribution is wrong.
- **VTG 1 is 2010** per noelyee.com, so **CAPs open the spine, not VTG.** VTG
  volume 1 is ten minimal beat shapes (four base — isolation, extension,
  vertical antispin, horizontal antispin — plus six hybrids); the VTG 3 app is a
  6×6 grid of 36 patterns crossing *hand* timing and direction against *prop*
  timing and direction.
- **Transition Theory is Jordan Campbell's**, 2010, per Yee's own site.
- **Unit Circle Theory is Alien Jon's** — "a method of categorizing a specific
  set of hybrids." Undated.
- **David "Tankboy" Cantor is one person.** Earlier lists double-counted him.
- **Tech Tiles and the Book of P.H.A.T. are one project**, published as *Vulcan
  Tech Gospel Book of P.H.A.T. Volume 1* with Thompson, Cantor, and Yee — a VTG
  collaboration, not an independent Lorq catalog.
- **9-Square precedes QFT.** Drex, on the Leo Icaza video: Cushing developed
  "nine square Theory and its successor QFT." The old page said the reverse.
  Recorded here; **not stated on the page**, per the spec's no-relationship-
  claims rule.

## Related

- Memory: `feedback_source_tiering`, `project_notation_catalog`
- Rules: `visual-verification-mandatory.md`, `4k-native-layout.md`,
  `commit-only-your-own-changes.md`, `never-hand-roll.md`
- No expert agent in `.claude/rules/expert-routing.md` owns notation-history
  canon, so no expert file needed updating. If one is ever created, these facts
  are its seed.
