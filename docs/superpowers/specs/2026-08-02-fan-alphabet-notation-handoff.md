# Fan Alphabet (Letter Relations) → Notation Archive — Handoff (2026-08-02)

## Mission

Fan spinners have a real, named, letter-based system for describing fan pair
configurations: **letter relations**, colloquially **the Alphabet of Tech** or
"the fan alphabet." Austen has encountered it in person at festivals. It is
almost entirely undocumented in writing — the complete set appears in exactly one
place on the internet, a 3.5-minute YouTube video with auto-generated captions.

This session researched it from scratch, established what the system actually is,
identified and archived the sources, and worked out how it relates to The Kinetic
Alphabet. The next step is deciding how it enters the notation archive.

**No design spec exists yet.** This handoff is the research input to that
decision. There is a research archive at
`docs/reference/fan-letter-relations.md` — read it before anything else; it holds
the definitions, provenance, invariance claims, caption-error key, and the raw
transcript.

**The strategic frame matters as much as the content.** Austen's explicit concern
is that TKA, which has "alphabet" in its name, could grow to become the de facto
flow arts alphabet and quietly bury the fan alphabet, leaving fan practitioners
resentful. Everything below is shaped by preventing that. Read "Decisions already
made" before designing anything.

## Done — verified

**Identified the system and its correct name.** The community term is
*relations* / *letter relations*, not "fan alphabet" as a formal name. Evidence:
[Home of Fans FAQ](https://homeoffans.com/faq/grips-relations-theory/) uses
"relations"; the video title is "Intro To Tech Fans: Letter Relations."

**Found the only complete enumeration and recovered its content.** Clarissa Ohm,
[Intro To Tech Fans: Letter Relations](https://www.youtube.com/watch?v=z96BBi5TM6I),
3:30. Video metadata pulled from `ytInitialPlayerResponse` via Chrome DevTools
MCP; transcript pulled from the Show-transcript DOM panel (51 segments, 0:00 to
3:27). Her description reads: *"In this video cover all of the Fan Letter
Relations, Also known as the Alphabet of Tech."* Full transcript archived in
`docs/reference/fan-letter-relations.md`.

**The seven relations.** C, CC, I, S, X, O, W. Governing definition, her words:
*"these relations are formed based on which way that the wicks are facing."* Two
families — **stacked** (C, I, S) and **beside** (CC, X, O, W). Definitions
tabulated in the archive doc.

**Three invariance claims, stated explicitly by her at 1:08 and over the demo
footage.** A relation is unchanged by (1) grip orientation, (2) where on the grid
it happens, (3) whether the hands are together or extended.

**Second, independent source documenting a schism.**
[Home of Fans](https://homeoffans.com/faq/grips-relations-theory/), the wiki
attached to REM's tutorial database, lists only "X, O, I, S etc.", never defines
I or S, and describes X/O by handle-and-wick adjacency rather than wick facing.
It documents two schools: **Russian** (a relation is a mode of a whole move — a
flower begun in X is an X-relation flower throughout) versus **Western** (a
relation is the instantaneous relative orientation; a move passes through
relations).

**Origin is unknown and Clarissa is almost certainly not the originator.**
Searched 2026-08-02 across ~12 queries for earlier attestation, coinage, or
history. Nothing. The two partial vocabularies described in different geometric
language is the signature of communal development. The phrase "alphabet of tech"
appears nowhere on the searchable web except her video description.

**"Fan alphabet" has no flow-arts search surface whatsoever.** Every search for
the phrase returns classroom letter-fans, fire-styled display fonts, and
Pinterest. Zero flow arts results. "Alphabet of tech" returns Google's Alphabet.
"Fan letter relations" returns nothing. Only "relations" + a fan-spinning
qualifier retrieves the concept, and it surfaces the one Home of Fans page.

**Ahrefs API is unusable on the current plan.** `keywords-explorer-overview` and
even `subscription-info-limits-and-usage` both return
`MCP error -32001: Insufficient plan`. No keyword volume data is available. Do
not attempt to size demand through the Ahrefs MCP.

**TKA position semantics confirmed via MCP** (`get_position_info`): alpha = 180°,
hands at opposite grid points; beta = 0°, both hands at one grid point; gamma =
90°, adjacent points, asymmetric. Position families are rotation classes —
alpha1/alpha3/alpha5 are all alpha. VTG shapes were checked and ruled out as the
analogue: they are beat-traced forms, not static configurations.

## Believed done — unverified

**The X and O mapping — and it now has a contradiction in it.** Early in the
session, working only from the Home of Fans geometry, the derivation offered was:
O = beta with an opposed orientation pair (one `in`, one `out`); X = alpha with
both fans `in`. Austen confirmed on 2026-08-02: *"you got o and x completely
correct."*

**That confirmation predates Clarissa's fuller definitions, which appear to
contradict it.** She states a relation is invariant to whether hands are together
or extended. If together/extended is the beta/alpha axis, then a relation cannot
pin position, and O = beta / X = alpha cannot be the whole story. Either
together/extended means something outside the grid (a body-mechanics distinction,
arms in versus arms out), or a relation reduces to the relative *orientation
pair* alone with placement free.

**Do not build on the X/O mapping until this is resolved.** It is the single most
load-bearing unknown in the whole body of work.

**Working hypothesis, untested:** the beside family (CC, X, O, W) is grid-native;
the stacked family (C, I, S) may use a depth axis TKA does not encode — the same
gap `/notation/fans` already names around folds and hand orientation. If true,
the honest public claim is "TKA absorbs four cleanly, and three land on the same
open plane problem the page already admits to," which is a better and truer piece
of writing than a clean sweep.

**Seven treated as a closed set.** Austen's call, 2026-08-02, absent contrary
research. It rests on a single source, so it is a load-bearing assumption. Public
phrasing should be "the seven relations," never "all relations."

## In flight

Everything is on `main` in the primary checkout. Two new files, both committed
with this handoff:

- `docs/reference/fan-letter-relations.md` — the research archive. Provenance,
  attribution rules, positioning, the seven definitions, invariance claims,
  caption-error key, raw transcript, second source.
- `docs/superpowers/specs/2026-08-02-fan-alphabet-notation-handoff.md` — this doc.

Memory written outside the repo: `reference_fan_letter_relations.md` plus an
index line in `MEMORY.md`.

No application code was touched. `/notation/fans` is unmodified.

## Loose ends (ranked)

**1. Get the props answer from Austen.** Two questions gate the entire mapping:
does **stacked** (C, I, S) mean one fan in front of the other in depth, or
something that stays flat on the grid? And does **together vs extended** mean
beta vs alpha, or a body-mechanics distinction that is not a grid concept? He has
fans and can reproduce all seven. Nothing downstream is safe until this lands.

**2. Decide the placement.** See "The placement decision" below — this is the
main design call and it is genuinely contested.

**3. Verify the full mapping against pictograph data via MCP** once #1 lands.
Every relation should resolve to a set of start/end states, or be explicitly
marked as unrepresentable.

**4. Outreach to Clarissa.** Austen writes it himself in his own voice — he does
not send AI-generated messages to non-clients (see Decisions). Beats agreed:
the props question, who she learned the relations from, whether seven is settled,
and that she is being credited as documenter not inventor. Not a blocker on
publishing, but should precede it.

**5. Design the visual treatment.** Seven relations is a diagram set, not prose.
Nothing exists yet. Note `/notation/fans` already renders a live
`SequenceHeroDemo` with `bluePropType="fan"`.

**6. Free SEO groundwork** — Ahrefs Webmaster Tools (free for verified owners)
and Google Search Console. Recommended over any paid plan; see Decisions.

## The placement decision

Austen asked whether this should be "a whole fan alphabet section." There is a
real tension and the next agent should weigh it rather than inherit an answer.

The `/notation/` tree currently has two families: **prop pages** (letters,
staves, clubs, fans, poi, buugeng) and **concept pages** (caps, loops,
shape-matrix). The fan alphabet is neither — it is *a different notation system
belonging to another community*.

- **Nested inside `/notation/fans`** signals correctly that this is not TKA's,
  but will never rank for "fan alphabet," which defeats the on-ramp strategy.
- **A dedicated page** ranks and becomes the front door, but a `/notation/*`
  sibling risks reading as annexation into TKA's taxonomy.

**Recommendation: dedicated page, framed as documentation of someone else's
system.** The framing carries more weight than the URL depth. Title and H1 should
name it as the fan community's system, credit should sit above the fold, and
`/notation/fans` should link to it prominently. The entire strategic goal is to
be the page that resolves "fan alphabet" — a section buried in a TKA prop page
cannot do that job.

## Decisions already made

All Austen, 2026-08-02, unless noted.

**Attribution is a hard requirement, not a nicety.** *"I never want to put my
words and claim that her words were actually my words and I never want to give
the wrong person credit."* Documenter and originator are separate claims and must
stay separate. Correct: "documented by Clarissa Ohm," "the fullest published
account." Forbidden: "Clarissa Ohm's system," "developed by," "invented by," or
naming any originator as though origin were settled. Paraphrasing her
explanations into TKA's voice and presenting them as ours is the same violation
wearing a disguise.

**The transcript is a research archive, not publishable material.** The public
page cites and links her video and quotes only the short definitional phrases
needed to state each relation. It does not republish the transcript.

**Anti-displacement is the governing goal.** *"I want fan spinners to keep using
the fan alphabet stoked on it to teach it... I want to make it so the distinction
between the kinetic alphabet and the fan alphabet is totally clear."* The
strategy settled on: be the on-ramp, not the eraser. The written record of the
fan alphabet is currently one FAQ paragraph and one video; a page that ranks and
sends readers to Clarissa and Home of Fans gives the system more reach than it
has ever had.

**Naming discipline.** Never call TKA "the flow arts alphabet" or any phrase
claiming the whole category — that generic framing is what would actually swallow
the fan alphabet. "The Kinetic Alphabet" is a proper name and claims only itself.

**Seven is treated as closed** absent contrary research.

**Austen writes his own outreach.** He does not send AI-generated messages to
anyone except clients. Provide beats and encouragement, never draft prose. (This
matches the existing `feedback_no_ghostwriting_austen` memory.)

**No paid Ahrefs plan for now.** The API is a separate expensive add-on —
third-party roundups put Advanced + API Standard near $949/mo — so a normal
subscription will not fix the MCP error. Free Ahrefs Webmaster Tools plus Google
Search Console cover the real needs at this stage, and the actual bottleneck is
unwritten copy, not missing data.

## Gotchas

**YouTube's timedtext API returns an empty body for this video**, even with a
valid `baseUrl` from `ytInitialPlayerResponse`. `fetch(baseUrl + '&fmt=json3')`
throws on `.json()`. The working route is clicking **Show transcript** in the UI
and reading `ytd-transcript-segment-renderer` nodes out of the DOM. Do not burn
time re-deriving this.

**Plain `WebFetch` on any YouTube watch URL returns only the page footer.** It is
a JS app; the fetcher gets nothing useful. The `oembed` endpoint does work and is
the cheap way to get title and author:
`https://www.youtube.com/oembed?url=<watch-url>&format=json`.

**The captions are ASR and mangle the letter names badly** — "see" for C,
"endlichs" for end wicks, "ex" for X, "to seize" for two C's. A substitution key
is in the archive doc. **Only the 0:00–1:08 definitional block is reliable.** The
demo-section labels from 1:21 on are spoken over music and their ordering does
not match her teaching order; treat them as low-confidence.

**AI overviews of this topic are actively wrong** and are what started this
session. They render it as "paths and stalls mimic letter shapes to build muscle
memory," which inverts the concept — relations are static configurations of wick
facing, not paths — and they drop CC from the set. Do not seed any part of this
work from an AI summary.

**An early claim in this session was wrong and got corrected**: W and C were
described as likely fabrications because they appeared in no source found at the
time. They are real, and they are two of the seven. The AI overview Austen pasted
had six of seven letters right; what it mangled was the framing. If any earlier
note contradicts the archive doc, the archive doc wins.

**`pwsh` is not on PATH in Git Bash.** Use the PowerShell tool for
`scripts/launch-chrome-debug.ps1`.

**Ahrefs MCP returns `Insufficient plan` for everything**, including
`subscription-info-limits-and-usage`. There is no keyword data available through
it. Do not plan around it.

## Every source that matters

- [Clarissa Ohm — Intro To Tech Fans: Letter Relations](https://www.youtube.com/watch?v=z96BBi5TM6I)
  — the only complete enumeration. 3:30.
- [Her channel](https://www.youtube.com/@clarissaohm9529)
- [Her Forged Fans profile](https://forgedfans.com/pages/clarissa-ohm) —
  instructor and performer, Columbus OH
- [Home of Fans — Grips, relations, and theory of fan spinning](https://homeoffans.com/faq/grips-relations-theory/)
  — second source, Russian school, four of the seven
- [Home of Fans — Stars, relations and geometry tutorials](https://homeoffans.com/tut/rem-fire-fan-tutorials-3)
- [Home of Fans wiki index](https://homeoffans.com/wiki/)
- [5 Easy S-Relation Tricks](https://www.youtube.com/watch?v=4LmcCv-yY_o) —
  evidence S is taught in practice, not just named
- [ABCs of Fan Tech](https://www.youtube.com/watch?v=qTGlZu2Q8qg) — "ABCs" here
  means fundamentals, NOT a letter system. Do not cite as a relations source.
- [Bonobo Flow — What are Fans?](https://bonoboflow.com/what-are-fans/) — Russian
  vs Tech grip background
- [Ahrefs Webmaster Tools](https://ahrefs.com/webmaster-tools) — free tier
- Local: `docs/reference/fan-letter-relations.md`
- Local: `src/routes/(public)/notation/fans/+page.svelte` — already carries an
  `OpenChapter` inviting exactly this work, and already states plainly that folds
  and hand orientation are outside the notation. That existing honesty is the
  hook the new material should attach to.
