# Fan Letter Relations — The Alphabet of Tech

Research archive for the fan-spinning letter-relation system, captured because it
is almost entirely undocumented in writing and the only complete source is a
single 3.5-minute video that could disappear.

## Provenance

| | |
|---|---|
| **Source** | "Intro To Tech Fans: Letter Relations" |
| **Creator** | Clarissa Ohm — instructor/performer, Columbus OH ([Forged Fans profile](https://forgedfans.com/pages/clarissa-ohm)) |
| **URL** | https://www.youtube.com/watch?v=z96BBi5TM6I |
| **Channel** | https://www.youtube.com/@clarissaohm9529 |
| **Length** | 3:30 (210s) |
| **Captions** | English, **auto-generated (ASR)** — no manual caption track exists |
| **Captured** | 2026-08-02, Chrome DevTools MCP, Show-transcript DOM panel |

Capture note: YouTube's `api/timedtext` endpoint returns an empty body for this
video even with a valid `baseUrl` from `ytInitialPlayerResponse`. The working
route is clicking **Show transcript** in the UI and reading
`ytd-transcript-segment-renderer` nodes out of the DOM.

## Attribution — documenter, not originator

**Clarissa Ohm documented this system. There is no evidence she originated it,
and good reason to think she did not.** Keep those two claims separate in
everything written from this file.

What is actually known:

- Her video is the only complete published enumeration of the seven relations
  that could be found anywhere online (searched 2026-08-02).
- The system predates her video in at least one other lineage. Home of Fans
  (Russian school) documents a partly overlapping set — X, O, I, S — with
  different geometry language and no C, CC or W. Two partial vocabularies
  described in different terms is the signature of communal development, not a
  single inventor.
- The phrase "alphabet of tech" appears nowhere on the searchable web except her
  video description. It reads as oral tradition that she was first to write down.
- Who coined "relations," who added C/CC/W, and how the Russian and Western sets
  diverged are all **unknown**. Do not fill these in by inference.

Phrasing to use on the public page:

- Correct: "the fullest published account is Clarissa Ohm's tutorial"
- Correct: "documented by Clarissa Ohm"
- Wrong: "Clarissa Ohm's system" / "developed by" / "invented by" — credits her
  with authorship of the system rather than of the explanation
- Wrong: naming any originator at all, including "the Russian school," as though
  origin were settled

**Usage boundary.** This transcript is retained for research and attribution.
The words in it are hers. The public `/notation/fans` write-up cites and links
her video and quotes only the short definitional phrases needed to state each
relation — it does not republish this transcript, and it does not paraphrase her
explanations into our voice and present them as ours. Anything beyond short
attributed quotes needs her go-ahead.

**Before publishing, ask her.** She is an active instructor and this is her
explainer; she would rather be asked than find it. Two things worth asking while
we're at it: who she learned the relations from, and whether she considers the
seven a settled set. That is the only realistic path to the origin question, and
her answer belongs in this file.

## Positioning — why the /notation/fans section exists

**Working assumption: the seven are a closed set.** Absent research showing
otherwise, treat C, CC, I, S, X, O and W as the fan alphabet. Revisit only on new
evidence, not on speculation.

**The risk being managed.** TKA has "alphabet" in its name. If TKA succeeds, the
plausible failure mode is that it becomes the de facto flow arts alphabet, the
fan alphabet fades, and fan practitioners are left quietly resentful that
somebody else's alphabet ate theirs. Austen's explicit goal (2026-08-02) is to
prevent that: fan spinners should keep using the fan alphabet, keep teaching it,
keep being stoked on it, and the boundary between the two systems should be
unmistakable.

**The strategy: be the on-ramp, not the eraser.** The written record of the fan
alphabet is currently one FAQ paragraph and one 3.5-minute video. A page that
ranks for "fan alphabet" and sends readers to Clarissa's video and Home of Fans
gives the system more reach than it has ever had. Displacement and promotion are
decided by where the links point, not by whether TKA exists.

**Naming discipline.** Never call TKA "the flow arts alphabet" or any phrase that
claims the whole category — that generic framing is what would actually swallow
the fan alphabet. "The Kinetic Alphabet" is a proper name and claims nothing
beyond itself. The page should state plainly that these are two different things:
the fan alphabet names static configurations of a fan pair; TKA notates motion
over time for dual-wielded props generally.

## The seven relations (cleaned)

Her governing definition: *"these relations are formed based on which way that
the wicks are facing."*

| Letter | Definition |
|---|---|
| **C** | Wicks stacked one in front of the other |
| **CC** | One fan beside the other, wicks facing the same direction — two C's side by side |
| **I** | Wicks stacked, facing outward toward the viewer |
| **S** | Wicks stacked, facing opposite directions — the curves of an S |
| **X** | Fans beside each other, middle wicks parallel, wicks facing toward each other |
| **O** | Fans beside each other, middle wicks parallel, wicks facing away from each other |
| **W** | Fans beside each other, end wicks parallel |

Two families: **stacked** (C, I, S) and **beside** (CC, X, O, W).

## The three invariance claims

Stated explicitly at 1:08 and restated over the demo footage. A relation is
unchanged by:

1. **Grip orientation** — "at any grip orientation"
2. **Grid location** — "on any part of the grid"
3. **Together vs extended** — "either together or extended"

Plus: *"your letter relations will stay the same no matter which way they are
facing."*

### Why this matters for TKA

Rotation-invariance corresponds directly to TKA position families — `alpha1`,
`alpha3` and `alpha5` are all alpha, i.e. rotations of one relative
configuration. That much maps for free.

The together/extended invariance is the open question. If together/extended is
the beta/alpha axis, a relation does **not** determine position, and reduces to
the relative *orientation pair* alone — which would make TKA strictly more
expressive than the Alphabet of Tech, with each relation naming a set of
pictograph states rather than one.

The stacked family (C, I, S) is the second open question. If "stacked" means one
fan in front of the other in depth, it uses the plane/depth axis that TKA does
not yet encode — the same gap `/notation/fans` already names around folds and
hand orientation. Working hypothesis: CC, X, O and W are grid-native; C, I and S
wait on the same machinery folds wait on.

Both questions are answerable at the props, not from the video.

## Caption-error key

The ASR track mangles letter names badly, especially over the demo section. Read
the raw transcript below with these substitutions:

| ASR text | Almost certainly |
|---|---|
| "see" / "see relation" | C / C relation |
| "to seize next to each other" | two C's next to each other |
| "endlichs" | end wicks |
| "ex relation" / "accidental ex relation" | X relation |
| "my relation" | I relation |
| "a relation" | S relation (from context/ordering) |
| "will also say the same" | will also stay the same |

The demo-section labels (1:21 onward) are low-confidence — they are spoken over
music while she demonstrates, and the ordering does not cleanly match the
teaching order. Treat only the 0:00–1:08 definitional block as reliable.

## Raw transcript (auto-generated, verbatim)

```
0:00  today I want to talk about the different
0:01  fan relations also known as the alphabet
0:04  of tech these relations are formed based
0:06  on which way that the wicks are facing
0:07  first I'm going to show you each
0:09  relation and then I'm going to show you
0:11  different ways that it can be made
0:12  across the grid the first relation is
0:15  see this occurs when the wicks are
0:17  stacked one in front of the other
0:18  imitating the letter C the next relation
0:21  is CC this occurs by moving one fan
0:24  beside the other with the wicks facing
0:25  the same direction
0:26  imitating to seize next to each other
0:29  next is I this occurs when the wicks are
0:32  stacked in facing outwards toward your
0:34  viewer imitating the letter I next is s
0:37  this occurs when the wicks are stacked
0:39  in facing in opposite directions to
0:41  imitate the curves of the letter S next
0:44  is X this occurs when the fans are next
0:46  to each other with the middle wick
0:47  parallel and the wicks are facing
0:49  towards each other imitating the letter
0:51  X next is o this occurs when the fans
0:54  are next to each other with the middle
0:56  wick parallel and are facing away from
0:58  each other
0:58  imitating the letter O last is W this
1:02  occurs when the fans are next to each
1:03  other with the endlichs parallel
1:05  imitating the letter W
1:08  these letter relations can be made at
1:11  any grip orientation on any part of the
1:13  grid either together or extended the
1:15  following clip is just showing some of
1:17  these possibilities see relation your
1:21  letter relations will stay the same
1:23  no matter which way they are facing see
1:36  see relation s relation your relations
2:04  will also say the same whether they are
2:06  extended or they are together my
2:19  relation
2:20  [Music]
2:29  a relation accidental ex relation ex
2:52  relations W relation if you found this
3:24  video useful and want to see more
3:25  content like it
3:26  take a second to like and subscribe
3:27  below
```

## Second source (different school)

[Home of Fans — Grips, relations, and theory of fan spinning](https://homeoffans.com/faq/grips-relations-theory/),
the wiki attached to REM's tutorial database. Calls them "relations," lists only
"X, O, I, S etc.", and never defines I or S. Its X/O geometry is described from
handle-and-wick adjacency rather than wick facing, which reads as the same
configurations arrived at differently.

It documents a real schism worth citing:

- **Russian school** — a relation is a *mode of a whole move*. A flower begun in
  X is an X-relation flower throughout, whether or not the relation persists.
- **Western school** — a relation is the *instantaneous* relative orientation, so
  a move starts in one relation and passes through others.

TKA resolves this natively rather than picking a side: a step carries a start
state and an end state, and the letter names the transition between them.

## Warning

AI overviews of "the fan alphabet" are unreliable. They typically render it as
"paths and stalls mimic letter shapes to build muscle memory," which inverts the
concept — relations are static configurations of wick facing, not paths — and
they drop CC from the set.
