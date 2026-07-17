# SEO Winning Strategy — Adversarially Tested (2026-07-14)

Product of a 5-front adversarial sweep: analog competitor teardown, durable/
algorithm-proof SEO, AI-search (AEO), a hostile red-team of our own roadmap, and
a keyword-demand reality check. Sources live in the subagent reports; this is the
synthesis. Supersedes the optimistic framing in `seo-content-roadmap.md` where
they conflict.

---

## The one reframe (read this first)

**"Flow arts notation" is not a traffic term. It never was. Stop treating it as
the SEO prize.**

Three independent researchers, searching separately, reached the same verdict:
the phrase has near-zero search demand. Google has no concept of it — it returns
flowchart symbols, sheet-music clip art, GIS "points of interest," quantum field
theory, and Vinyasa yoga. "Zero competition" is true, but it's zero competition
because it's **zero demand**, not an untapped lane. Even Labanotation — a
funded, institutional, decades-old dance notation — is documented as unpopular
with actual practitioners. A brand-new notation term inherits no organic pull.

So split the goal into two funnels that were being fused into one:

| Funnel | Job | Metric | Term examples |
|---|---|---|---|
| **ENTITY play** | Own the *concept* in the knowledge graph + get cited by AI. Durability, not clicks. | AI citations, KG presence, brand recognition | "The Kinetic Alphabet", "flow arts notation" |
| **TRAFFIC play** | Rank where the audience actually searches. Attention + funnel into the app. | Organic clicks, app signups | "staff spinning tutorial", "staff spinning practice tool", "choreography card deck", "which prop to start with" |

The roadmap collapsed these — it chased *traffic* on an *entity-only* term. Keep
notation as the entity/AI-search bet (it's genuinely valuable there, see below),
but win traffic on demand that exists.

---

## What the sweep killed (false assumptions, ranked)

1. **"Own the unclaimed term = win."** Unclaimed = unsearched. Fatal if used as
   the traffic thesis. (Salvageable as an *entity* thesis — see strategy.)
2. **"Poi notation is open."** Already claimed — DrexFactor's QFT notation (2011).
   And DrexFactor is a Tier-1 *backlink* target in our own kit. We can't out-rank
   his term and ask him for a link at the same time.
3. **"The backlink kit builds authority."** Most of it is **nofollow** self-promo
   (Reddit/Discord/FB) with real removal/shadowban risk. Passes little PageRank.
   The two followable, high-value targets (Flow Arts Institute listing, DrexFactor
   collab) need cold outreach with no relationship.
4. **"The 12-week content calendar is a plan."** Content AND links both draw on
   one scarce resource — the founder's writing hours — with no ghostwriter by
   design. One busy week freezes the entire funnel. Single point of failure.
5. **"Text pages win this niche."** The staff/poi SERPs are **video-dominated**
   (YouTube, Playpoi's 12M+ views). We lead with editorial text into a
   video-first vertical.
6. **Keyword cannibalization + brand=category conflation.** 4–5 of our pages fight
   for the same micro-query, and "Flow Arts Notation" is declared a brand
   `alternateName` in five schema blocks. Google ignores self-declared
   category-as-brand and it dilutes the entity.

---

## Entity bugs found (concrete, fixable, urgent — do FIRST)

The AEO/entity research is unanimous: **fragmented naming is the #1 self-inflicted
failure**, and we have it badly. Fix these before writing one word of content —
they poison every entity/AI-citation signal underneath.

- **Split domain.** `thekineticalphabet.com` is still indexed by Google (Facebook
  post, Squarespace slug) but failed DNS on fetch. If Austen controls it →
  **301 → tkaflowarts.com** to consolidate a decade of scattered signal. If not,
  it's a competing brand surface. NEEDS ANSWER — can't verify ownership from code.
- **Handle mismatch.** Schema's `sameAs` points to `instagram.com/tkaflowarts`,
  but the IG Google surfaces for the brand is `@thekineticalphabet`, and the real
  YouTube is `@TheKineticAlphabet`. The brand string is drifting to "The Kinetic
  Alphabet" while schema anchors "tkaflowarts". Pick ONE canonical handle, make
  schema and reality agree everywhere.
- **Founding-date contradiction.** Schema `foundingDate: 2024`; `/about` says
  "2022–present". The entity contradicts its own birthday. (Austen's fact — I
  won't guess it.)
- **Brand-name collisions.** "Kinetic Alphabet" also returns a kottke.org
  kinetic-typography piece and "Kinetic Letters" (handwriting program). The name
  is contested → entity disambiguation needs the sameAs/Wikidata scaffolding
  below to win.

---

## The durable truths (what lasts — the "millennia" part)

From the durability + AEO research. Durability comes from signals that **cannot
be faked at scale**, not from ranking any single term:

1. **Be the original first-hand source, not an aggregator.** The March 2026 core
   update explicitly demoted aggregators (Reddit, TripAdvisor, even Wikipedia
   took losses) and boosted first-party originators. TKA *is* an original system
   with a working tool — this is our strongest durable alignment. Lean into it.
2. **The interactive tool is the moat.** Every notation system that won (Siteswap,
   Labanotation) did so partly because you can input a pattern and *see it render*
   (Juggling Lab's `jugglinglab.org/anim?<pattern>` shareable URLs; LabanWriter).
   **None** of the flow-arts education incumbents (Home of Poi, Playpoi,
   DrexFactor, Flow Arts Institute) has an interactive notation tool. TKA does.
   That is the single asset no competitor can quickly copy.
3. **Topical authority in a narrow lane** (pillar + 15–20 tightly-linked pages,
   zero topic drift) ≈ 3× traffic/page and is the only shape a solo founder can
   execute to depth. Depth is what the algorithm now rewards over breadth.
4. **A named human author (Austen), consistent across the web** = E-E-A-T that
   compounds over years and can't be reset.
5. **Backlinks via relationships + original data**, never schemes. One trade-press
   link (Dance Teacher magazine did a card-deck roundup) > 100 directory links.
6. **A direct audience** (newsletter / community) = branded search (feeds NavBoost)
   + survival of a bad SERP month + the only channel AI Overviews can't intercept.

Fads to avoid (all confirmed dying): keyword stuffing, exact-match-domain tricks,
PBNs, thin/AI mass content, and the next one — **schema/GEO-as-stuffing** (quotable
stats + FAQ schema as a *substitute* for originality). We already ship one legacy
tell: a `<meta name="keywords">` on `/roots` (ignored since ~2009). Remove it.

---

## AI-search / AEO — the forward durability bet

Where a small, sole-authority niche site has a *structural edge* (the citation
step, once you're in the candidate pool). Concrete, evidenced levers:

- **Wikidata item first.** Lowest bar (not Wikipedia's), feeds Google's Knowledge
  Graph + LLM training/RAG. There IS a notability bar (the kit was wrong that
  there's "none") — clear it with 3+ independent sources (Midwest Flow Fest
  teaching it, the sourcetype.com editorial are a start). This is the highest-
  leverage entity action.
- **`DefinedTerm` / `DefinedTermSet` schema** — purpose-built for *coined
  terminology*. Mark up "The Kinetic Alphabet", "flow arts notation", and the
  glossary terms as formal defined terms with TKA as the canonical source. This
  is how a made-up term becomes a citable entity.
- **Quotes + statistics in definitional content** — the one controlled study
  (Princeton GEO paper) found this the biggest citation lift, and it helps
  low-authority sites *disproportionately*.
- **Self-contained answer chunks** — engines retrieve passages, not pages. First
  40–60 words of each section must fully answer one question.
- **Server-render the definitional/glossary pages** — PerplexityBot doesn't
  reliably run JS; client-only pages look empty to a major citation surface.
- **Reddit as accurate answers, not link drops** — LLMs cite Reddit heavily
  (24–46% of Perplexity citations). Being the correct answer *in* an r/flowarts
  thread is an AI-citation signal; the backlink itself is nofollow and worthless.

---

## The winning strategy — three layers

### Layer 1 — Fix the entity (foundation, do before content)
Consolidate domain (pending ownership answer), unify handles + sameAs, resolve the
founding date, create the Wikidata item, add DefinedTerm schema, drop the
brand=category `alternateName` conflation and the `/roots` keywords meta. Mostly
code + a few account actions. This is what makes every later signal count.

### Layer 2 — Win traffic where it lives (staff-first, honest)
Reprioritize the roadmap by *demonstrated demand*:
- **Practice-tool positioning** — rank for "staff spinning practice tool",
  "flow arts practice app". This is TKA's real comparable set (Double Staff LAB)
  and it's product-true, not a stretch. **Highest honesty-to-demand ratio.**
- **Staff trick / tutorial long-tail** — "figure 8 staff", "how to spin a staff",
  per-trick pages. Big long-tail, but **needs video** (the SERP is video). This is
  the layer that depends on Austen producing clips.
- **"Which prop to start with"** comparison content — staff-forward per TKA canon
  (double staves, not poi/fans as equals). Real recurring beginner query.
- **Choreography card deck cluster** — the *one* validated commercial lane with
  real buyers (Moody Street Circus, Dance Ed Tips, Etsy pole cards, Dance Teacher
  press) and zero staff/poi entrant. Currently ranked #2 behind the no-demand
  notation page — **it should lead.**
- Poi content stays honestly scoped and minimal until Poi Lab ships (else bounce/
  overclaim erodes E-E-A-T).

### Layer 3 — The moat + citation engine (the durable core)
- **Ship shareable per-sequence pages** (each a linkable/embeddable URL, à la
  `jugglinglab.org/anim?`). TKA already has short codes (tka.run) — turn every
  sequence into an indexable page. This is the link magnet and the UGC-scale
  content engine simultaneously.
- **A community-submitted sequence gallery** — each entry an indexable page.
  Solves the single-founder content-velocity problem (users generate pages) AND
  builds a Home-of-Poi-style UGC moat at a fraction of the cost.
- **Two pieces of citation bait nobody else has:** (1) "TKA vs Siteswap vs
  Labanotation vs Benesh" comparison (the only existing comparison is a paywalled
  1989 book), (2) a rigorous glossary grounded in MCP ground-truth (beats Flow
  Arts Institute's 11 terms and Bonobo's 80). Both are exactly what Wikipedia
  editors, dance-notation researchers, and jugglers cite and cross-post.
- **Outreach to jugglers**, not just flow artists — the siteswap crowd is
  notation-literate, appreciates the rigor, and is an untapped followable-link
  source. Lead with the interactive tool.

---

## The genuine decisions (Austen's to make — they change the plan)

1. **Do you own/control `thekineticalphabet.com`?** Determines the biggest single
   entity win (301 consolidation) vs a competing-surface problem.
2. **Canonical brand handle: "The Kinetic Alphabet" / `@thekineticalphabet`, or
   "TKA" / `@tkaflowarts`?** Every sameAs + entity fix keys off this.
3. **Will you produce video?** The largest real-demand layer (staff/poi tutorials)
   is video-first. If no, we route the traffic strategy around it (practice-tool +
   card-deck + tool-embed + written comparison), which is viable but narrower.

---

## Bottom line

The durable, adversary-tested win is: **be the original source and the only
interactive tool for a system you own the entity for — while earning traffic on
staff/practice/gear/cards where people actually search, and getting cited by AI
via Wikidata + DefinedTerm + first-hand rigor.** Not: ranking a keyword nobody
types. First-mover on a zero-demand term is a placeholder; first-mover as the
*canonical interactive source of a real system* is a moat.

## Addendum (2026-07-16): the software cluster

The sweep above never examined "flow arts software", and the term turned out to
be an unowned commercial-intent SERP: page one is a video-effects app (AR Flow
Arts), a hoop tutorial platform (Taylor Flows), and flowchart-software noise.
No choreography tool targets it. Shipped response (branch
feat/flow-arts-software-seo, spec 2026-07-16-flow-arts-software-seo-design.md):

- /composer owns the bare phrase: title "Flow Arts Composer | Free Flow Arts
  Software for Choreography"; description, lede, and subtitle lead with it;
  the SoftwareApplication JSON-LD gains a keywords property.
- Internal link web: varied anchors pointing at /composer (new FAQ entry "Is
  there software for flow arts choreography?" on / and /about, wording touches
  on /notation and the per-prop pages). Exactly one exact-match anchor
  site-wide, on /roots/software.
- /roots/software takes the informational intent ("history of flow arts
  software"): a fact-checked lineage page covering the VTG app, the LAB
  simulators, VisualSpinner3D, and today's tools, with every living project
  linked out. Competitor brand names never appear in our title/meta. This is
  also the site's most link-worthy page for community backlinks (Layer 3
  adjacent).
