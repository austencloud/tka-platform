# Creators Discovery — Design Specification

**Date:** 2026-07-25
**Surface:** `/creators` — a first-class tabless app module
**Entry:** `src/lib/features/creators/CreatorsModule.svelte` → `components/CreatorsPanel.svelte`
**Status:** Committed design. Supersedes the rejected draft (CreatorsPanel hero + CreatorCard + VirtualizedCreatorGrid + FeaturedCreatorsSection + CreatorsSortBar).
**Codename:** The Floor

---

## 1. The decision this page helps someone make

*"Whose work do I want to look at next, and who in this community is actually around?"*

The top of the page answers the first question with evidence you can literally see — 25 real
sequence thumbnails, every one signed by its maker, newest first, with a hard per-creator cap so
no single person owns the room. The bottom answers the second with the only honest reachability
signal the dataset contains: how recently someone was here. A visitor can tell the difference
between a person who spun yesterday and a person who signed up last spring and left. The page
deliberately does **not** try to answer "who is most popular" or "who is most prolific" — follower
counts top out at 3 across the entire directory, and `sequenceCount` is a private-library denorm
that would be a lie if labelled public.

---

## 2. What the data actually is

Every number below was re-verified read-only against production Firestore on **2026-07-25**, after
the original census, using `firebase-admin` and the same visibility rules the directory itself
applies. **Several figures in the original census brief were wrong. These supersede them.**

### 2.1 The directory is 56 people, not 58 and not 53

`CreatorsPanel.svelte:63-69` defines a `HIDDEN_USERNAMES` list applied to every non-admin viewer
at `:74-76`. It names five usernames. **Only two of them exist in the visible directory:**
`cirqueaflame_603` and `tka.flowarts`. The other three (`netsua07`, `flowtacocat`,
`tkascribe.review`) match no visible user.

| Set | Count |
|---|---|
| `users` docs total | 73 |
| hidden / disabled | 0 |
| anonymous guests (excluded) | 15 |
| Admin-visible directory | 58 |
| `HIDDEN_USERNAMES` present in that set | 2 |
| **Visitor-facing population** | **56** |

Every count rendered on this page derives from the post-filter array. The number **56** is never
hardcoded; an admin sees 58 and the page says 58.

### 2.2 Field coverage on the visitor-facing 56

| Field | Present | % | Verdict |
|---|---|---|---|
| `displayName`, `username` | 56 | 100% | universal |
| `createdAt` | 56 | **100%** | universal — the only field that can never drop a doc from a Firestore `orderBy` |
| `photoURL` | 53 | 94.6% | near-universal; the one reliable visual asset |
| `activeProp` | 54 | 96.4% | broad |
| `lastActivityDate` | 54 | 96.4% | broad, and genuinely discriminating |
| `pronouns` | 18 | 32.1% | too sparse to render as a slot |
| `favoriteProp` | 9 | 16.1% | **never sortable** — an `orderBy` drops 47 of 56 |
| `instagramUsername` | 4 | 7.1% | too sparse |
| `profileColor` | 1 | 1.8% | effectively absent |
| `bio` | **0** | **0.0%** | permanently empty |
| `pinnedItems` | **0** | **0.0%** | permanently empty |
| `isFeatured` | **0** | **0.0%** | `getFeaturedCreators()` always returns `[]` |

`followerCount` **maxes out at 3** across all 56 — lower than the original census reported. It
carries zero ranking information. `sequenceCount` is 0 on 42 of 56 (75%) and disagrees with the
real public count on every creator who has published. `collectionCount` is a known-broken counter.
Residual gamification fields (`totalXP`, `currentLevel`, `currentStreak`, `achievementCount`) are
dead — XP was torn out of the product.

### 2.3 Activity and join spread (visitor set)

| `lastActivityDate` | n | | `createdAt` | n |
|---|---|---|---|---|
| ≤ 1 day | 1 | | ≤ 7 days | 4 |
| ≤ 7 days | 7 | | ≤ 30 days | 4 |
| ≤ 30 days | 7 | | ≤ 90 days | 4 |
| ≤ 90 days | 6 | | ≤ 365 days | 44 |
| ≤ 365 days | 33 | | older | **0** |
| missing | 2 | | missing | **0** |

**Nobody in the directory is older than one year.** 44 of 56 joined inside a single 275-day band.
Any design premised on comparing tenure across years has nothing to compare.

### 2.4 Effective prop, family-collapsed (`getBasePropType`)

staff **37 (66.1%)** · fan 6 · club 4 · buugeng 2 · eightrings 2 · none 2 · torch 1 · sword 1 · hoop 1

Prop is the broadest identity signal available and a terrible partition. A prop filter yields one
37-person bucket and six buckets of 1–2. It is texture, never a control.

### 2.5 Public work — the central asymmetry

```
publicSequences docs ........... 467   (100% have publishedAt, ownerId, ownerDisplayName;
                                        99.8% have ownerAvatarUrl)
distinct owners ................   8   ALL EIGHT ARE VISITOR-VISIBLE
per-owner counts ............... 431, 11, 8, 6, 6, 3, 1, 1
creators WITH public work ......   8 of 56  (14.3%)
creators WITHOUT public work ...  48 of 56  (85.7%)
```

**One creator owns 431 of 467 = 92.3% of all public work.** The top five own 462 of 467.

**The asymmetry that governs everything:** the *creator* record is barren — a name, a face, a prop,
two dates, and nothing else that survives a coverage check. The *sequence* record is rich —
thumbnails, word, difficulty, loop type, props, tags, stars, views, forks, publish date, all at
100% coverage. But only 14.3% of creators have any sequence at all, and one person owns 92% of
them. A design that leans on creator-side richness renders empty for everyone. A design that leans
naively on work renders one person's portfolio with seven guests. The page has to be honest about
both facts at once.

### 2.6 Three facts that unblock this design

Previously flagged as unverified and now settled:

1. **`publishedAt` is 100% populated** on all 467 docs. Ordering the wall by publish date is sound.
2. **`loadSequenceMetadata()` returns `SequenceData[]`**, not `PublicSequenceIndex`
   (`public-sequences-loader.ts:55`), and `SequenceData` carries `ownerId` / `ownerDisplayName` /
   `ownerAvatarUrl` (`sequence-data.ts:149-151`, mapped at `:294-299`). No adapter needed, and the
   wall can render its signatures without waiting on the users query.
3. **Zero overlap between hidden accounts and public-work owners.** All 8 owners are visitor-
   visible. The wall keeps all 25 tiles for every viewer. (`netsua07_334` is a distinct username
   from the hidden `netsua07`.)

### 2.7 Machine facts that constrain the build

- The module box is **exact-height with `overflow: hidden`** and never page-scrolls
  (`MainInterface.svelte:445-452`, `ModuleRenderer.svelte:472-483` — `position:absolute; inset:0`,
  `CreatorsModule.svelte:9-16`). Any scrolling region must own an internal scroller.
- `/creators` is **100% client-rendered** (`[...appPath]/+layout.ts` sets `ssr:false;
  prerender:false`). No SSR markup exists, which rules out hydration-mismatch bugs and makes first
  paint entirely JS-dependent.
- The site-wide 4K root ramp (`app.css:768-773`) is scoped to `html:has(.mkt-shell)` /
  `.legal-container`. `.mkt-shell` is mounted only by MarketingChrome for `siteMode==='landing'`.
  **It never reaches an in-app module.** Verified in the rule's own comment at `app.css:758-763`.
- Desktop reserves **0 / 64 / 220px** on the left (0 below 1280 viewport, 64px collapsed rail —
  the default — 220px when the user pins it).
- `SequencePeek.svelte:48` hardcodes `eager` on `PropAwareThumbnail`, bypassing its
  IntersectionObserver gate. `PropAwareThumbnail` already declares `eager?: boolean = false`
  (`:76`, `:107`).
- **The shared thumbnail queue runs 8 concurrent, not 3.** `thumbnail-render-queue.ts:36` sets
  `DEFAULT_MAX_CONCURRENT = 8`; the "max 3 concurrent" claim in `PropAwareThumbnail`'s header
  comment is stale and is corrected in Phase 0.
- `CreatorCard.svelte` has a **live external consumer**:
  `src/routes/(public)/composer/_sections/ConnectSection.svelte:9` renders five instances with
  fictional placeholder creators on the public `/composer` marketing route.

---

## 3. The design

### 3.1 The model

Two regions in one vertical scroller. The top is the work; the bottom is the room. The scroll from
one to the other is the page's argument.

- **The Wall** — 25 real sequence thumbnails, each signed with its maker's face and name, ordered
  newest-published first, with a **hard cap of 4 pieces per creator**. The cap is the mechanism
  that structurally neutralises the 92% concentration: the 431-sequence creator gets 4 tiles, the
  same as the 11-sequence creator and only four times the 1-sequence creators. Their share of the
  wall is capped at 16%. The rule is printed on the page.
- **The Roster** — all 56, banded by last activity, in **two densities**. The 21 people active
  within 90 days get portrait cells; the 35 in the long tail get index cells. Weight follows
  evidence: recency is the ranking signal, so recency drives visual size.

### 3.2 Region anatomy

**REGION 1 — COMMAND ROW** (56px, sticky to the scroller top when container height ≥ 560px)

Left: `Creators` + `· 56` in `--theme-text-dim` with `font-variant-numeric: tabular-nums`. That is
the only population figure on the page and it is the population, not an achievement. Centre-right:
`PanelSearch`. Right: `SegmentedControl`, three options — **Active · New here · Following** —
`semantics="radiogroup"`, `aria-label="Roster view"`.

Search filters **both** regions: the roster through the existing `matchesCreatorQuery` (which
already covers username, displayName, pronouns, location and prop labels), the wall through owner
name plus the simplified word. Typing `buugeng` narrows the directory to the two buugeng spinners
with zero added chrome — which is precisely why there is no prop filter control.

One row. No eyebrow, no `<h1>`, no description paragraph, no aggregate stat block.

**REGION 2 — THE WALL** (`<section aria-labelledby="wall-heading">`)

Label row (40px): `On the floor` at `--cr-name` weight 600, then dim meta:
`25 recent pieces · 8 of 56 creators have shared work`. Tabular-nums on all three numbers. **This
is where the page is honest about the 14.3%, out loud, above the fold.**

Grid of `WorkTile`s. The newest overall piece is promoted to a **2×2 anchor**; at ≥2600px container
width it promotes to 3×2, because at 12 columns a 2×2 tile stops reading as an anchor. Orphan rule
is computed, not hardcoded: if `cellCount % columns === 1`, the second tile promotes to 2×1 to
absorb it.

Each tile: a reserved 4:5 art box holding a lazy `SequencePeek`, then a fixed 34px signature strip
— 24px `RobustAvatar` + display name + a **pre-reserved** 20px chevron slot that fades in on hover.
The whole tile is one link to that creator's profile. The tile routes to the *person*, not to the
sequence viewer; this module's job is people and the tile says so on hover.

**REGION 3 — THE ROSTER** (`<section aria-labelledby="roster-heading">`), all 56, banded:

| Band | n | Density |
|---|---|---|
| This week | 8 | portrait |
| This month | 7 | portrait |
| Last 90 days | 6 | portrait |
| Earlier | 35 | index |

Bands come from disjoint recency buckets, merged by `mergeSmallBands(3)` so no band is ever
smaller than three — the design survives data drift rather than being tuned to one snapshot. The
two creators with no `lastActivityDate` sort to the end of *Earlier* ordered by join date and read
as **"joined, never came back"**, which is the honest description of those records.

Band header: name + count in tabular-nums + a hairline rule filling the remaining width. Not
sticky — the page has a bottom and should feel finite.

- **Portrait cell**: `RobustAvatar` at `calc(6 * var(--cr-u))` with a recency ring, display name,
  and **one** evidence line — prop glyph + prop label + `formatTimeAgo(lastActiveAt)`.
- **Index cell**: 40px avatar, no ring, name on one line, prop glyph with an `aria-label`, no time
  text (the band header already states it).

No follow button. No sequence count. No follower count. No bio. No location. No pronouns. Exactly
one badge on the entire page: `New` on creators who joined within 30 days (8 of 56), backed by the
only 100%-populated field.

**REGION 4 — PROFILE**: the existing `UserProfilePanel`, swapped in place through
`<Crossfade fill>`. Shallow routing (`creators-routing.svelte.ts:57-78`) is unchanged.

### 3.3 Hierarchy

Five weights, strictly enforced, nothing at equal weight:

1. Wall art (the anchor is the single largest object on the page)
2. Portrait-cell display names
3. Band-header names + index-cell names
4. Evidence lines and signature names (dim, tabular)
5. Chrome — command row, label meta, counts

### 3.4 Desktop wireframe — 1920 viewport, 64px collapsed rail, module ≈ 1856 × 1024

```
┌── module box 1856 × ~1024 · overflow:hidden · ONE internal scroller ─────────────┐
│  Creators · 56      [ ⌕ search…              ]    [ Active │ New here │ Follow ] │  56px  ← the ONLY chrome row
├──────────────────────────────────────────────────────────────────────────────────┤
│  On the floor      25 recent pieces · 8 of 56 creators have shared work           │  40px  ← the honest denominator
│                                                                                  │
│  ╔═════════════════╗ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ │
│  ║                 ║ │  ART  │ │  ART  │ │  ART  │ │  ART  │ │  ART  │ │  ART  │ │
│  ║     ANCHOR      ║ │  4:5  │ │       │ │       │ │       │ │       │ │       │ │
│  ║  newest piece   ║ ├───────┤ ├───────┤ ├───────┤ ├───────┤ ├───────┤ ├───────┤ │
│  ║      2 × 2      ║ │◉ name│ │◉ name│ │◉ name│ │◉ name│ │◉ name│ │◉ name│      │  ← 34px signature
│  ║                 ║ └───────┘ └───────┘ └───────┘ └───────┘ └───────┘ └───────┘ │
│  ║                 ║ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ │
│  ╠═════════════════╣ │  ART  │ │  ART  │ │  ART  │ │  ART  │ │  ART  │ │  ART  │ │
│  ║ ◉ austencloud   ║ ├───────┤ ├───────┤ ├───────┤ ├───────┤ ├───────┤ ├───────┤ │
│  ╚═════════════════╝ │◉ name│ │◉ name│ │◉ name│ │◉ name│ │◉ name│ │◉ name│      │
│  ┌───────┐ ┌───────┐ └───────┘ └───────┘ └───────┘ └───────┘ └───────┘ └───────┘ │
│  │  ART  │ │  ART  │ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐           │
│ ══════════════════════════════ fold ≈ 1024px ═══════════════════════════════════ │
│  │◉ name│ │◉ name│ ...                                       (wall row 3)        │
│                                                                                  │
│  ── This week ───────────────────────────────────────────────────────── 8 ────   │
│    ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐                    │
│    │  ◉   │  │  ◉   │  │  ◉   │  │  ◉   │  │  ◉   │  │  ◉   │   PORTRAIT, 6 col  │
│    │ Name │  │ Name │  │ Name │  │ Name │  │ Name │  │ Name │                    │
│    │⚊ Staff · 2h│ ...                                                            │
│    └──────┘  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘                    │
│  ── This month ──────────────────────────────────────────────────────── 7 ────   │
│    (5 columns — fitColumns(7,6) drops to 5 so the last row is never one)          │
│  ── Last 90 days ────────────────────────────────────────────────────── 6 ────   │
│  ── Earlier ─────────────────────────────────────────────────────────── 35 ───   │
│    ◉ Name  ◉ Name  ◉ Name  ◉ Name  ◉ Name  ◉ Name  ◉ Name  …   INDEX, 13 col      │
└──────────────────────────────────────────────────────────────────────────────────┘
```

Above the fold at 1920: 8 columns × ~209px tiles, three wall rows with the third cropping as the
scroll affordance, and **both** community numbers — `Creators · 56` and `8 of 56 creators have
shared work` — stated in the first 96px. A visitor never has to count faces to learn the size of
the community.

### 3.5 Short-landscape wireframe — Z Fold 7 folded, ~960 × 412 viewport

Routes through `isLandscapeMobile()` (aspect > 1.7 **and** height ≤ 600,
`device-detector.ts:217-244`). 960 is below the 1024 DESKTOP floor, so the desktop rail never
engages; a **fixed 72px `SideNavigation`** renders and `MainInterface.svelte:454-458` compensates
with `padding-left: 72px`. Module ≈ 888 × 380.

```
 ←72px fixed SideNavigation (owned by MainInterface, not this module)
┌──────────────────────────────────────────────────────────────────────┐
│ 56 [ ⌕ search…        ] [Active│New│Follow]   25 pieces · 8 of 56    │  44px  ← label row DELETED,
├──────────────────────────────────────────────────────────────────────┤          its meta moves inline
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                        │
│ │ ART  │ │ ART  │ │ ART  │ │ ART  │ │ ART  │   5 columns             │
│ │      │ │      │ │      │ │      │ │      │   anchor DEMOTED to 1×1 │  234px
│ ├──────┤ ├──────┤ ├──────┤ ├──────┤ ├──────┤   signature → 30px      │
│ │◉ name│ │◉ name│ │◉ name│ │◉ name│ │◉ name│                        │
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘                        │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  ← row 2 crops = the    │  ~102px
│ │ ART  │ │ ART  │ │ ART  │ │ ART  │ │ ART  │     scroll affordance   │
└──────────────────────────────────────────────────────────────────────┘  380px
   ONE horizontal chrome row · ONE scroll axis · no horizontal strip
   Portrait density is DISABLED — all four roster bands render at index density, 7 columns
```

Budget: 44 chrome + 234 first wall row = 278 of 380. Nothing is clipped mid-element. The failure
this branch exists to prevent — a hero plus a subheader plus a filter bar stacked before any
content — cannot occur, because there is exactly one chrome row at every breakpoint.

---

## 4. Why this and not the alternatives

Four concepts were developed and put through three adversarial judges (data-truth, rule-compliance,
build-feasibility). Aggregate out of 300:

| Concept | truth | rules | feasible | **total** |
|---|---|---|---|---|
| **The Floor** (workfront) | 90 | 83 | 86 | **259** |
| Front Page (editorial) | 78 | 76 | 84 | 238 |
| The Roster (roster) | **93** | 62 | 71 | 226 |
| Index rail + standing profile (explorer) | 63 | 72 | 75 | 210 |

**The Floor wins and survives.** Its three flagged fatal risks were all unverified-data risks, and
all three resolved in its favour when I queried production (§2.6): `publishedAt` is 100% populated,
the pool is already `SequenceData[]`, and — the big one — **no hidden account is among the eight
public-work owners**, so the wall keeps all 25 tiles for every viewer. The census strengthened the
winner rather than breaking it.

**What each runner-up did better, and what has been grafted:**

*The Roster* won the truth lens outright (93) and was the only concept to discover
`HIDDEN_USERNAMES` at all. Its counting discipline — derive every number from the post-filter array,
never print a census figure — is adopted wholesale here. It also caught the `--shell-w` overflow
trap and the un-lazy avatar problem, both grafted. It lost on rules (62) because its scale
mechanism was a four-step function of exactly the kind `app.css:765-767` explicitly rejects, and
because two thirds of its clickables had no rest-state affordance.

*Front Page* had the best no-layout-shift discipline in the set and the lightest render budget —
its page still reads as intentional when the thumbnail pipeline is cold. Both are grafted: the
reserved-but-hidden numeric slot pattern, and the hard rule that the roster never blocks on the
sequence pool. It also found that `getAvatarColor` (`inbox/utils/format.ts:77`) is verified dead
code, and proposed the `PropGlyph` extraction that retires four inline copies — the glyph is
grafted; the colour hash is not (see §10). It lost points for issuing two Firestore queries to
fetch the same 56 documents, the second against an admittedly unverified composite index.

*Explorer* had the sharpest technical reasoning anywhere in the set — the `em`-not-`rem` rationale,
the `cqi` structural footgun, the exact 8/2160 coefficient, and the localised-ghost-sizer catch are
all grafted. Its `FollowButton` extraction is the single best structural move any concept made and
is adopted. But its load-bearing mechanism — a shared tenure axis — **cannot work against this
data**: nothing in the directory is older than 365 days and 44 of 56 joined inside one 275-day
band, so its comparison instrument has nothing to compare. It also routed 12 eager thumbnails
through a `Crossfade` `{#key}` remount on every arrow-key press, a direct
`crossfade-primitive.md` violation on the page's primary interaction.

**Every fatal flaw raised against The Floor is fixed in this spec:** the `CreatorCard` deletion
(§7), the `2200` tier boundary (§5), the `PanelGrid` miscitation (§7), the stale queue-concurrency
figure (§2.7), and the population count (§2.1).

---

## 5. Responsive model

### 5.1 The 4K scale strategy — explicit

The site-wide root ramp **does not reach this module** (`app.css:768-773`, scoped to
`html:has(.mkt-shell)` / `.legal-container`; `.mkt-shell` is MarketingChrome, `siteMode==='landing'`
only). The module supplies its own, keyed to its own container so the 64/220px sidebar reservation
is already subtracted with no JS measurement:

```css
/* CreatorsModule.svelte root — the container */
.creators-module { container-type: inline-size; container-name: creators; }

/* .floor-shell — a CHILD of the container. cqi resolves against the ancestor.
   Inverting these two yields silently zero scaling — invisible at 1080p,
   only visible as a stunted 3840 layout. Verify by LOOKING at 3840. */
.floor-shell {
  --cr-u: clamp(1rem, calc(1rem + (100cqi - 1616px) * 8 / 2160), 1.5rem);
  font-size: var(--cr-u);

  /* Semantic sizes resolved ONCE here, so children consume absolute lengths
     and em can never compound down the tree. */
  --cr-name:  1em;       /* 16 → 24px */
  --cr-band:  0.9375em;  /* 15 → 22.5px */
  --cr-meta:  0.8125em;  /* 13 → 19.5px  (supplementary floor is 12px) */
  --cr-micro: 0.75em;    /* 12 → 18px    (absolute floor) */
}
```

**Honouring the 1680 seam.** `4k-native-layout.md` mandates 1680 as the big-screen seam and it is a
*viewport* figure. This module sizes off its own box, so the seam is translated into the module's
coordinate space: **1680 viewport − 64px default collapsed rail = 1616px container**. That is the
ramp's engagement point. The coefficient is exactly `8 / 2160`, identical to `app.css:771`, so the
module scales in lockstep with the rest of the product rather than on a nearby-but-different curve.
At 3776px container (a 3840 viewport) the ramp lands on exactly 24px.

Sizes are expressed in `em` off `--cr-u`, not `rem`. This is a deliberate, reasoned deviation from
the rule's "express sizes in rem" instruction: `rem` is root-relative, the root ramp never reaches
an app module, so `rem` cannot move here and would freeze the module at 1080p proportions forever.
`em` off a container-derived root is the only mechanism that delivers the lockstep the rule
actually asks for. `px` is reserved for hairlines, `var(--min-touch-target)` (44px,
`app.css:261`), and the fixed 24px signature avatar.

**Recomposition tiers are 1616 and 2600 only.** There is deliberately **no 2200 tier** — that seam
is a named anti-pattern already present in seven in-app files and this design does not spread it.
Everything between 1616 and 2600 is handled continuously by the ramp; bigger tiles, not more of
them.

**Column counts are pinned per tier. No `repeat(auto-fill, minmax())` anywhere** — the item counts
are known and fixed, which is exactly the case the rule forbids auto-fill for.

### 5.2 `fitColumns` — never a row of one, computed not hardcoded

```
fitColumns(count, maxCols):
  for c from maxCols down to 2:
    if count % c !== 1: return c
  return maxCols            // and the trailing item spans all tracks
```

Worked against the real band sizes: `fitColumns(7, 6) → 5` (rows 5+2, not 6+1).
`fitColumns(6, 5) → 4` (rows 4+2). `fitColumns(7, 3) → 3` with the trailing item spanning three
tracks, because no reduction avoids the orphan at that width. The wall uses the same helper over
`cellCount` (24 tiles + 4 anchor cells = 28, or 30 at the 3×2 anchor tier, or 25 when the anchor is
demoted to 1×1). At 25 tiles today the wall's promotion branch is inert — which is the point of
computing it rather than hardcoding to this snapshot.

### 5.3 The table

Module width = viewport − sidebar (0 below 1280 viewport; 64px collapsed, the default; 220px
pinned). All tiers are `@container creators` queries, so all three sidebar states resolve in one
measurement.

| Viewport | Module | Composition | wall / portrait / index | Promoted or hidden | `--cr-u` | The one risk at this size |
|---|---|---|---|---|---|---|
| **3840** (4K @100%, TV) | 3776 | Whole wall (2.5 rows) **and** two roster bands on one screen. Roster grows, does not lengthen. | **12 / 8 / 16** | Anchor promotes to **3×2**. "This week" (8) is exactly one full portrait row. | **24.0px** (ceiling) | `cqi` declared on the wrong element yields zero scaling and is invisible at every width you'd normally test. Verify by looking at 3840, not by arithmetic. |
| **2560** (4K @150%) | 2496 | Same tier as 1920 — bigger tiles, not more of them. | 8 / 6 / 13 | — | 19.3px | Tempting to add a mid-tier here. Don't; that is how 2200 got into seven files. |
| **1920** (4K @200% — the most common case) | 1856 | 3 wall rows with the third cropping; roster one short scroll down. ~209px tiles. | 8 / 6 / 13 | — | 16.9px | The roster is below the fold. Mitigated by stating both counts in the top 96px; see §11 Q2. |
| **1680** (the seam) | 1616 | Ramp engages exactly here. Identical composition to 1920, one step smaller. | 8 / 6 / 13 | — | 16.0px (floor) | A pinned 220px rail at 1680 gives 1460 → drops to the 6/5/11 tier. Correct, but check it looks deliberate. |
| **1440** (MacBook Air default) | 1376 | Desktop tier. Also covers **1536** — the real common Windows laptop width (125% OS default on "1080p" panels), not 1920. | 6 / 5 / 11 | — | 16.0px | Designing for 1920 and assuming laptops follow is the classic miss. 1376–1472 is where a large share of desktop traffic actually lives. |
| **Tablet landscape** — iPad Pro 13 (1376), Tab S10+ (1400), iPad Pro 11 (1194), iPad mini (1133) | 1133–1336 | Full desktop-tier grid. Not lumped into one "tablet breakpoint". | 6 / 5 / 11 | — | 16.0px | The rail engages at ≥1280 viewport, so 1376 → 1312 module while 1194 → 1194. Both land in the same tier; verify the crossing looks continuous. |
| **Tablet portrait** — iPad Pro 11 (834), iPad mini (744), **Z Fold 7 inner** (750 portrait / 832 landscape) | 744–834 | Comfortable mid grid. The Fold's near-square inner screen needs **no special case** — both orientations land in the same tier because tiers key off width alone. | 4 / 3 / 7 | — | 16.0px | A grid built for "wide and short" landscape breaks on a near-square 832×750. This one doesn't, because nothing assumes landscape means wide. |
| **Z Fold 7 folded landscape** (~960×412) | ~888 × 380 | **Own layout branch** via `@media (max-height: 520px) and (orientation: landscape)`. 44px chrome, label row deleted, anchor demoted to 1×1, signature 30px, portrait density disabled. | **5 / — / 7** (index only) | Label row **hidden** (meta moves inline). Anchor **demoted**. Portrait density **hidden**. | 16.0px | Only ~380px of height. A second scroll axis here is the documented killer — there is none. Also covers iPhone landscape (844×390 → 772 module) and Android split-screen. |
| **iPhone SE** (375×667) / **iPhone 17e·16e** (390×844) | 375–390 × ~600 | Command row wraps to two 44px rows (92px); label meta on a second line. Anchor becomes a **full-width 2×1 hero banner**. | **2 / 2 / 4** | Anchor **2×1**, not 2×2 — a 2×2 would consume the whole screen. | 16.0px | The SE line was discontinued in 2025; 390 is the 2026-forward target, but 375 hardware persists. Check both. Zero-slack arithmetic at 375 fails on real devices — leave margin. |

Bottom navigation on mobile portrait reserves `min 64px + env(safe-area-inset-bottom)` as real flex
space (`BottomNavigation.svelte:226,245-246` — `position: relative`), and Creators always renders it
(`sections: []` but `moduleHasPrimaryNav` returns true). The module box already excludes it; no
compensation needed here.

**The Viewport Segments API is deliberately not used.** It models a hardware seam between two
physical panels (Surface Duo); the Fold's single seamless flexible OLED reports one segment, so it
would not fire even in Chrome 138+, and it has no Firefox or Safari support. An honest `max-height`
query is the correct and only real answer.

---

## 6. Data plan

**Two network operations for the entire page. Zero per-creator queries. No N+1 is possible by
construction.**

### Query A — the wall

`getBrowseLoader().loadSequenceMetadata()`
(`src/lib/shared/browse/services/public-sequences-loader.ts:55`) → `Promise<SequenceData[]>`.
One unpaged `getDocs(query(publicSeqRef, orderBy('word','asc')))` for all 467 docs (`:254-287`),
cached in memory **and** IndexedDB and **shared with the Browse module** — so on any session that
has touched Browse this is free. There is no server-side pagination primitive for public sequences
and this design adds none.

One pass over the returned array produces both:
- `dealByOwner(pool, 4)` — new pure function in
  `src/lib/features/browse/gallery-home/pick-representatives.ts`. Group by `ownerId`, take each
  owner's four most recent by `publishedAt`, merge, sort `publishedAt` desc, tiebreak with the
  existing `sortSequencesByKineticAlphabet`. → 25 tiles: 4+4+4+4+4+3+1+1.
- `Map<ownerId, number>` of true public counts.

**Signature identity comes off the sequence document itself** — `ownerId`, `ownerDisplayName`
(100%), `ownerAvatarUrl` (99.8%) on `SequenceData` (`sequence-data.ts:149-151`). The architectural
consequence is the important part: **the wall does not wait on the users query.** Two independent
loads, two independent skeletons, and the front door paints from one already-cached array.

The stored `thumbnails` field on `PublicSequenceIndex` is **not used**. It is written
(`public-sequences-loader.ts:230,314,421`) and never read anywhere — dead data for rendering. Every
visible image goes through `SequencePeek` → `PropAwareThumbnail` → the four-tier
`ThumbnailRenderOrchestrator` cache (memory → static manifest → IndexedDB → Firebase Storage →
canvas render).

### Query B — the roster

`getUsersPaginated({ sortBy: "joinedDate", sortDirection: "desc", limit: 200, cursor: null }, currentUserId)`
via `creatorsDataState.loadCreators()`.

**The default-sort fix.** The current default is `lastActive`. Firestore's `orderBy` **excludes
documents missing the sort field**, and `lastActivityDate` is present on 54 of 56 — so the current
default silently drops two creators from a page whose entire premise is "this is the community".
`createdAt` is present on 56 of 56. Ordering the *query* by `createdAt` guarantees everyone comes
back; the *display* order (last-active desc) and the band bucketing are then applied client-side
over the complete set, at zero extra reads. This is the only change to the data layer the brief
said to keep, and it is one line plus two derivations.

`limit: 200` — the existing `favoriteProp` branch (`creators-data-state.svelte.ts:96-110`) already
proves the full-fetch shape works at `limit: 1000`; 200 is ample at 56 and keeps the read bounded.
The cursor / `hasMore` path stays live as a growth valve with a trailing `PanelButton`
("Load the rest"), never an infinite-scroll sentinel.

**`favoriteProp` is never used as a Firestore `orderBy` or `where`** — 16.1% coverage would
silently vanish 47 of 56. Prop is display texture and a search term only. The existing
`favoriteProp` sort branch is deleted along with `CreatorsSortBar`.

Follow-status patching across lists is retained unchanged (the *Following* view needs it).

### Region → source

| Region | Source |
|---|---|
| Command-row count | `displayUsers.length` after `filterHiddenAccounts` — **never a hardcoded figure** |
| Roster order, bands, ring tone | Query B + `creator-recency.ts` derivations |
| Portrait evidence line | `getEffectiveProp` → `getBasePropType` → `getPropTypeDisplayInfo`; `formatTimeAgo` |
| `New` badge | `createdAt` (100%) |
| Wall tiles, order, per-owner cap | Query A + `dealByOwner` |
| Wall signature | `ownerDisplayName` / `ownerAvatarUrl` on the sequence doc |
| Wall label denominator | `publicCounts.size` and `displayUsers.length` |
| Tile caption | `simplifyRepeatedWord(deriveWord(seq))` — called directly, because the caption is our own text node |
| Search | `matchesCreatorQuery` (roster) + owner name / simplified word (wall) |

### What is explicitly NOT claimed

- **Search is client-side over the loaded set only.** It is not a server query, not a full-text
  index, and does not reach creators outside the loaded page. At 56 that is the whole directory;
  the limitation becomes real only past 200.
- **There is no ranking.** Order is recency. No score, no popularity, no relevance model, no
  "featured", no "top creator". Nothing on the page implies one.
- No follower/following subcollection read for the roster.
- No per-creator sequence query. No `users/{id}/sequences` read.
- `getFeaturedCreators()` is never called (`isFeatured` 0/56 — it always returns `[]`).
- `collectionCount` is never read (known-broken counter).
- No `bio`, `pinnedItems`, `sequenceCount`, `location`, `instagramUsername`, `totalXP`,
  `currentLevel`, `currentStreak`, `achievementCount`, or `thumbnails[]` is read anywhere.
- No new Firestore index — both sorts are existing `SORT_FIELD_MAP` entries
  (`user-repository.ts:104-110`).
- **No follow write from this surface at all.** Follow lives on the profile only. This also
  sidesteps rather than resolves the open question of whether Firestore rules block an
  anonymous-guest follow write (`UserProfilePanel.svelte:126-128` gates only on a truthy
  `currentUserId`, and guests hold a real anonymous uid). That verification is still owed by
  whoever ships the profile's follow path — see §11.

---

## 7. Component plan

| Component | Verdict | Path | Justification |
|---|---|---|---|
| `RobustAvatar` | **EXTEND** | `shared/components/avatar/RobustAvatar.svelte` | Every face (24 / 40 / 64–144px via `customSize`); `ring`/`ringColor` carry recency. Verified pure `$derived` with no canvas and no colour extraction (`:70-134`), so 56 avatars cost nothing. **Extend with `loading?: "lazy" \| "eager"`** — no such prop exists today, and ~56 `<img>` firing on mount with no lazy gate is the dominant cold-cache mobile-data cost of a page whose job is faces. |
| `SequencePeek` | **EXTEND** | `shared/browse/components/SequencePeek.svelte` | Every thumbnail. Fixed reserved box, deterministic tilt, `allowQR={false}`. **Extend with `eager?: boolean = true`** — `:48` hardcodes `eager`, and `PropAwareThumbnail` already declares `eager?: boolean = false` (`:76`,`:107`), so this is a **one-line passthrough of an existing prop**, not a fork. The default preserves every current call site (`CreatorCard.svelte:147-159`, `GalleryDrill.svelte:521-531,895-904`). The wall then passes `eager={false}` so the IntersectionObserver and the queue actually gate the cost. |
| `pick-representatives.ts` | **EXTEND** | `features/browse/gallery-home/pick-representatives.ts` | Add `dealByOwner(pool, perOwner)`. `pickCreatorSamplesByOwnerId` (`:139-152`) already buckets by `ownerId` but sorts kinetic-alphabet and returns a `Map` without a merged `publishedAt`-desc ordering. Same file, same family, reuses `sortSequencesByKineticAlphabet` for the tiebreak. |
| `creators-data-state` | **EXTEND** | `features/creators/state/creators-data-state.svelte.ts` | Default query → `{ sortBy: "joinedDate", limit: 200 }` (§6); add `bandedRoster` and `publicCounts` derivations; delete the `favoriteProp` sort branch. No new query type, no new repository code. |
| `PanelSearch` | REUSE | `shared/components/panel/PanelSearch.svelte` | The search input. Preferred over `GalleryDrill.svelte:459-469`'s hand-rolled `<form>`, which is a one-off, not a primitive. |
| `SegmentedControl` | REUSE | `shared/ui/components/SegmentedControl.svelte` | The Active / New here / Following selector. Mutually exclusive, exactly one active → `chip-primitives.md` routes here, not to N toggle chips. `var(--min-touch-target)` already consumed at `:266`. |
| `Crossfade` | REUSE | `shared/components/Crossfade.svelte` | Roster ↔ profile swap, **`fill` mode** (sized parent). Never two in-flow `transition:fade` siblings. The wall is **never** routed through its `{#key}` remount — see §8. |
| `PanelState` | REUSE | `shared/components/panel/PanelState.svelte` | `compact` variant, roster no-results only. Never per-cell. |
| `PanelButton` | REUSE | `shared/components/panel/PanelButton.svelte` | "Load the rest". Verified there is **no** generic `Button.svelte` under `shared/components` or `shared/ui` (only `HelpButton`, `StepperButtonVisual`, `ActionButton`, `PanelButton`, `LightsToggleButton`), so `PanelButton` is the correct panel-scale primitive rather than a third button style. |
| `prop-type-display-registry` | REUSE | `shared/pictograph/prop/domain/prop-type-display-registry.ts` | `getBasePropType` (`:335`) collapses SIMPLESTAFF/BIGSTAFF/STAFF2 → STAFF; `getPropTypeDisplayInfo` (`:27`) supplies the SVG. |
| `getEffectiveProp` · `matchesCreatorQuery` · `formatTimeAgo` · `simplifyRepeatedWord` + `deriveWord` | REUSE | `shared/community/domain/get-effective-prop.ts` · `features/creators/domain/creator-search.ts` · `shared/i18n/i18n-formatters.ts` · `shared/foundation/utils/word-simplifier.ts`, `word-deriver.ts` | All existing. `matchesCreatorQuery` already covers prop labels, which is why `buugeng` works as a search term with zero new code. |
| `DURATION` / `STAGGER` / `motion.ts` | REUSE | `shared/transitions/` | All timing. No raw `svelte/transition` imports, no magic numbers. |
| `view-transitions.css` + manual trigger | REUSE | `shared/transitions/view-transitions.css` · `navigation-coordinator.svelte.ts:294,311,334` | Extends the existing `sequence-{id}` (`:303-330`) and `launchpad-*` (`:332-348`) naming convention. No new transition infrastructure. |
| `UserProfilePanel` | REUSE | `features/creators/components/UserProfilePanel.svelte` | Unchanged as the detail view, plus two `view-transition-name` bindings. |
| **`WorkWall.svelte`** | **NEW** | `features/creators/components/` | Grepped `Grid` / `Wall` / `mosaic` / `masonry` / `Bento`. **`PanelGrid.svelte` does have a `columns` prop emitting `repeat(N, 1fr)` (`:34-38`)** — it is a correct primitive for a fixed row of cards (and stays in use by `ConnectSection`) — but it has no span placement, no per-tier pinning, no orphan promotion, no owner attribution, and no internal scroller. `BrowseGrid` / `VirtualizedSequenceGrid` / `SectionedVirtualGrid` are all `BrowseEngine`-bound and render `ChoreoCardThumbnail`. `BentoPropGrid` / `LoopBentoBoard` / `RailBentoSheet` are deck-releaser-specific. |
| **`WorkTile.svelte`** | **NEW** | `features/creators/components/` | Grepped `Tile` / `Card` / `Thumbnail`. `ChoreoCardThumbnail` is the heavy interactive browse card (context menu, variation pill, sync badge, collection sheet — `:1-41`), far too heavy to repeat 25×. `SequencePeek` is a bare box with no attribution. Nothing pairs a thumbnail with an owner signature. ~90 lines. |
| **`RosterBand.svelte`** | **NEW** | `features/creators/components/` | Grepped `SectionHeader` / `Section` / `Band` / `Group`. `SectionHeader.svelte:1-33` parses Browse title strings like `R (8 STEPS) (3 SEQUENCES)` and renders `TKAWordGlyph` — coupled to that string format, not reusable. Owns the header, `fitColumns`, and the density switch. |
| **`CreatorCell.svelte`** | **NEW** | `features/creators/components/` | Grepped `UserCard` / `Cell` / `Profile`. `shared/community/components/UserCard.svelte` is a follow-oriented row with a hand-rolled follow button and stat cluster. Deliberately ~60 lines, because it renders four fields. |
| **`PropGlyph.svelte`** | **NEW** | `shared/pictograph/prop/components/` | `PROP_TYPE_DISPLAY_REGISTRY` has four `.svelte` consumers (`ArenaBattleView`, `AvatarGenerator`, `AvatarGeneratorWizard`, `CreatorCard.svelte:381-387`) and **all four inline their own `<img>`**. `PropSvg.svelte` is the animated in-pictograph renderer with a position cache, not an icon. This NEW component **retires four duplicates** — a net reduction. |
| **`FollowButton.svelte`** | **NEW** | `shared/community/components/` | Glob `**/FollowButton*.svelte` returns **nothing**, yet the identical idle/following/loading state machine and `aria-busy` contract is hand-rolled twice: `UserCard.svelte:114-136,301-335` and `CreatorCard.svelte:182-204,489-543`. Extracted and `UserCard` migrated onto it. This design has no roster-level follow, so it adds no fourth copy — but the extraction is exactly what `never-hand-roll.md` calls for. |
| **`creator-recency.ts`** | **NEW** | `features/creators/domain/` | `bandOf(lastActiveAt)`, `mergeSmallBands(bands, 3)`, `ringToneFor(band)`. Grepped `bucket` / `band` / `recency` / `activityGroup` across `src/lib` — nothing bucketises dates. ~40 lines, pure. |
| **`fit-columns.ts`** | **NEW** | `features/creators/domain/` | `fitColumns(count, maxCols)` + the wall's promotion rule. Grepped `fitColumns\|columnsFor\|resolveColumns\|orphan` across `src/lib/**/*.ts` — zero column-fitting helpers exist. ~15 lines. Lives in the creators domain until a second consumer justifies promoting it to shared. |

### Verdicts on the rejected draft

| File | Verdict | Reason |
|---|---|---|
| `VirtualizedCreatorGrid.svelte` | **DELETE** | TanStack Virtual for 56 rows. Hardcapped at 2 columns regardless of viewport (`:68-71`) — the 4K dead-rail violation itself. Its own comments (`:154-193`) document a card-overlap bug class caused by stale height estimates when auth/follow/sample state populates after first measure. 56 unvirtualised cells is a few hundred DOM nodes, and `PropAwareThumbnail` lazy-loads regardless. Deleting it removes the bug class and the uniform-row-height constraint for zero perceptible cost. **Before removing, grep the repo for other `@tanstack/svelte-virtual` consumers** — `SectionedVirtualGrid` and Browse surfaces almost certainly still import it, so the dependency stays. |
| `FeaturedCreatorsSection.svelte` | **DELETE** | Double-dead. Grep across all of `src` returns only its own docblock — **zero import sites** — *and* `isFeatured` is 0/56, so `shouldShow` would always be false even if it were wired. Delete, do not restyle. |
| `CreatorsSortBar.svelte` | **DELETE** | Imported only by `CreatorsPanel.svelte:34`. Of its five options, "Most Followed" cannot discriminate (nobody has more than 3 followers) and "Group by prop" is backed by a 16.1%-populated field. Replaced by the three-option `SegmentedControl`. |
| `CreatorCard.svelte` | **MOVE — do not delete** | **This is the flaw every concept including the winner had.** `src/routes/(public)/composer/_sections/ConnectSection.svelte:9` imports it and renders five instances inside a `PanelGrid` on the **public `/composer` marketing route**. Deleting it breaks a public page. It is pure-props there (fictional placeholder creators, `currentUserId={undefined}`, no auth, no Firestore, no context), so the correct move is to **relocate it to `src/routes/(public)/composer/_sections/ConnectCreatorCard.svelte`** as a marketing-only component and update the one import. It leaves `src/lib/features/creators/` entirely. |
| `CreatorsPanel.svelte` | **REWRITE in place** | Becomes the shell: command row + two regions + the `Crossfade` profile swap. Loses the hero (`:258-264`), the aggregate stat block (`:265-281`,`:426-466`), the hardcoded `max-width: 1240px` (`:382`), and the viewport `@media` breakpoints (`:546`,`:581`) in favour of `@container creators` tiers. Keeps `filterHiddenAccounts` (`:63-76`) — it is load-bearing for every count on the page. |

### Adjacent fix, same PR

`ProfileTabs.svelte:79` and `ConnectionSharedSequences.svelte:63,89` render raw `sequence.word`,
violating `simplified-word-display.md`. This redesign does not extend that pattern, but those three
lines are inside this feature and should be routed through `simplifyRepeatedWord` in the same
change.

---

## 8. Motion and delight

Every duration is a `DURATION` / `STAGGER` token (`shared/transitions/transitions.ts`); every custom
transition uses a `motion.ts` helper, which owns `prefers-reduced-motion` collapse internally. No
raw `svelte/transition` imports, no magic numbers.

1. **Wall mount** — each tile enters with `popIn`, `delay = min(index, 11) * STAGGER.micro` (30ms),
   so the whole wall settles in ≤330ms regardless of tile count. The anchor has zero delay: it
   lands first, the field fills in around it.
2. **Roster mount** — bands enter with `growFade` at `DURATION.normal` (200ms), staggered
   band-to-band by `STAGGER.normal` (50ms). Four bands = 150ms total. **Cells inside a band do not
   individually stagger.** 56 staggered cells at 50ms is 2.8 seconds of noise and reads as a
   loading bar. This rule goes in the component doc so a future session does not add it back.
3. **The reorder — the signature moment.** Switching Active → New here → Following animates roster
   cells with `animate:flip={{ duration: flipDuration() }}` keyed by `user.id`. The same 56 faces
   physically travel to their new positions. It is delightful precisely because it is honest —
   nothing appears, nothing vanishes, the room re-sorts and you can watch a specific person move.
   **The wall does not reorder during this**; it holds still, which teaches without copy that the
   two regions answer different questions. This is only possible because there is no virtualisation.
4. **Search** — non-matching cells and tiles exit via `growFade` out at `DURATION.fast` (150ms);
   survivors `flip` into place.
5. **Wall tile hover / focus-visible** — `translateY(-2px) scale(1.015)` over `DURATION.fast`,
   border to `--theme-stroke-strong`, and the chevron in its **pre-reserved 20px slot** goes
   `opacity: 0 → 1`. Nothing enters or leaves flow; zero layout shift. No text swap on hover — a
   "See X's work" label would need a ghost-sizer and would be noisier than a chevron.
6. **Roster cell hover / focus-visible** — the recency ring thickens 3px → 4px via `box-shadow`
   spread (`RobustAvatar`'s ring is already a box-shadow, so it costs no layout) and the name goes
   `--theme-text-dim` → `--theme-text`. That is the entire treatment. No lift, no glow, no reveal
   panel.
7. **Tile / cell → profile morph.** The highest-value delight lever, and it extends an existing
   pattern rather than inventing one. The list ↔ profile swap uses SvelteKit shallow routing
   (`creators-routing.svelte.ts:57-78` uses `pushState`/`replaceState`, not `goto()`), so the root
   layout's `onNavigate` hook (`+layout.svelte:95-116`) **never fires** and the morph must be
   triggered manually — the same pattern as `navigation-coordinator.svelte.ts:294,311,334`:
   ```js
   if (reducedMotion() || typeof document.startViewTransition !== "function") {
     creatorsViewState.viewUserProfile(id);
   } else {
     morphingCreatorId = id;                    // applies the name to ONE element
     document.startViewTransition(() => creatorsViewState.viewUserProfile(id))
       .finished.finally(() => { morphingCreatorId = null; });
   }
   ```
   **Critical:** `view-transition-name: creator-avatar-{id}` is applied to the activated element
   **only**, never to all 56 at once — duplicate names on the page invalidate the transition
   entirely. Same-document View Transitions are Baseline (Chrome 111+ / Firefox 133+ / Safari 18+).
8. **The swap itself** — roster ↔ profile through `<Crossfade fill mode="crossfade"
   duration={DURATION.normal}>`. `fill` is mandatory: default content-sized mode with a
   variable-height panel inside a fixed module box is the documented first-time crossfade failure.
   `UserProfilePanel` remounting on key change is acceptable (a full view change with its own load).
   **The wall is never routed through a `{#key}` remount** — its in-flight thumbnail renders must
   survive a filter change. This is the routing call that decides the whole page's runtime
   behaviour, and it is made on remount cost, not on sizing.
9. **Any future selection-to-thumbnail binding must be debounced at 150ms.** Not needed today (there
   is no hover-preview), but written down because it is exactly how a comparison mode or a preview
   affordance would burst the render queue.

**Reduced motion** — every helper collapses to instant. The flip becomes an immediate reposition,
`popIn`/`growFade` become instant opacity, the view transition is skipped, and the hover transform
is dropped in favour of the border and ring change alone, so state stays legible without movement.

**Forced colours** — hover and focus never rely on `box-shadow` alone for meaning: every
interactive element also changes border colour, and `focus-visible` uses `outline`, which survives
`forced-colors: active`. The recency tier is never carried by colour alone — the band header states
it in words and the portrait cell repeats it as text.

**Deliberately absent** — no pulsing "live" dot (exactly one creator qualifies as active-today; a
pulse for one person is manufactured liveness), no count-up numbers, no parallax, no scroll-driven
animation (not in Firefox stable as of mid-2026, and this page does not need it), no card
tilt-on-mousemove, no shimmer on anything that is not actually loading.

---

## 9. Empty and degraded states

**The 85.7%-no-work case is not a state. It is the design.** 48 of 56 creators have no public
sequence, so work never appears in a roster cell — there is no work column, no dashed placeholder,
no "No public sequences yet" string, and nothing to be empty. A publisher and a non-publisher with
the same last-active date render identically: same cell, same size, same four fields. The 48 are
not a degraded version of the 8; they are the same thing.

| Case | Frequency today | Treatment |
|---|---|---|
| Creator has no public work | **48 of 56 (85.7%)** | Not represented. No slot exists. The roster does not rank by work and carries no "has work" badge. |
| Creator has no `photoURL` | 3 of 56 | `RobustAvatar`'s generated-initials data URL (`:70-134`) — a real styled monogram, zero async cost. At 3-of-56 it reads as variety. |
| Creator has no prop | 2 of 56 | The glyph slot is simply empty. No placeholder icon, no "unknown" label. |
| Creator has no `lastActivityDate` | 2 of 56 | Sorted to the end of *Earlier*, ordered by join date, and read as **"joined, never came back"** — the honest description, not a hidden record. |
| `bio`, `pinnedItems`, `isFeatured`, `location`, `pronouns`, `instagram` | 0–32% | Never rendered anywhere on this page. A field present on a quarter of records makes the other three quarters look damaged. Location and pronouns remain **searchable** via `matchesCreatorQuery`, so they add capability without adding ragged UI. |
| Thumbnail pipeline cold | first visit | Skeleton mirrors the **real geometry** — same column count for the current width, same 4:5 boxes, same 34px signature strip, same anchor span — per the `BrowseThumbnailSkeleton.svelte:1-53` convention. **The roster does not block on the sequence pool**: two independent loads, two independent skeletons, so a cold wall still sits above a complete, real page. |
| Search returns nothing | occasional | `PanelState` `compact` **inside the roster region only**. The wall shows a single dim inline line ("no work from creators matching that"). Two full-size empty states on one screen reads broken. |
| `publicSequences` empty (hypothetical) | never today | The wall section and its label are **removed entirely** — not an empty state, a removed section. The roster slides up and becomes the whole page, and it still works, because the roster never depended on work. |
| Roster load error | rare | `PanelState` error at page level. |
| Directory grows past 200 | future | `hasMore` goes true and a trailing `PanelButton` appears. Never infinite scroll. |

**Named scale ceiling:** this design is correct at 56 and degrades predictably. Around 150 the
*Earlier* band grows long enough to dominate the scroller — the remedy is a per-band cap of ~60
visible with a "Show all 35" `PanelButton`, and CSS multi-column (column-major, self-balancing,
`break-inside: avoid`) is the right mechanism for that tail because the orphan problem cannot occur
in it. Past ~400 creators, virtualisation has to come back and the single `limit: 200` query has to
become paged. **Write this threshold into the component doc** so a future session does not discover
it the hard way.

---

## 10. What we deliberately are NOT doing

| Not doing | Why |
|---|---|
| Marketing hero — eyebrow, `<h1>`, description paragraph | An in-app module the user just clicked does not introduce itself. Reclaims ~180px for work. |
| Aggregate stat block | "467 public sequences" is 92.3% one person's output dressed as community activity. The only aggregates that survive are the population and the wall's honest denominator, printed as a label rather than a hero stat. |
| Uniform card grid, one radius, one padding, 56 times | The archetypal AI-slop tell. Replaced by three structurally different cell types — work tile, portrait cell, index cell — where which one you get is determined by **real data**, not by position. |
| A repeated CTA pill at the same corner of every card | The most recognisable AI-slop artifact. Follow appears **once**, on the profile, where the decision is actually made. Removing it also removes a security question from this surface. |
| A bio slot, or synthesised filler in its place | `bio` is 0% populated. The rejected card's `summary` fallback (`CreatorCard.svelte:60-68`) rendered the identical string on ~75% of cards. There is no text slot here that can render a fallback, because there is no field below 94.6% coverage in use. |
| A featured section | `isFeatured` is 0/56 and `getFeaturedCreators()` always returns `[]`. Not a fallback case — the only case. |
| Follower count or sequence count as a reputation stat | Followers max out at **3** across the whole directory (zero discriminating power). `sequenceCount` is a private-library denorm, 0 on 42 of 56, and disagrees with the real public count on every publisher. |
| A prop filter or a prop partition | Staff is 66.1%. A prop filter is one 37-person bucket plus six buckets of one or two. Prop is identity texture (a mono SVG glyph at 96.4% coverage) and a **search term** — typing `buugeng` already does what a filter would, with zero chrome. |
| A per-creator accent colour, hashed or authored | `profileColor` is 1 of 56, so 55 cards would share one theme accent while pretending to individuality. And a hue derived from a user-id hash *looks* like data and encodes nothing — decoration cosplaying as data. Instead the one coloured element per cell (the recency ring) carries a real signal. Every coloured pixel on this page means something. |
| Virtualisation | 56 people. TanStack Virtual buys a documented row-overlap bug class and a hardcoded 2-column ceiling in exchange for solving a scale problem that does not exist — and it makes the reorder animation (§8.3) impossible. |
| Infinite scroll / pagination chrome | 56 is a roster, not a feed. The page should have a bottom and feel finite. |
| A `--shell-w` content band | Its 2600px ceiling inside a 3776px module box (already inset by the sidebar) leaves 1176px = **31% dead rail** — the precise failure `4k-native-layout.md` exists to prevent, reintroduced by following its letter. Uncapped fluid band with a `clamp()` gutter instead. Flagged for sign-off in §11. |
| A `2200px` tier | Named anti-pattern, dead on 4K@200%, already in seven in-app files. Seams are 1616 (= the 1680 viewport seam) and 2600, and nothing else. |
| The Viewport Segments API | Models a seam between two physical panels; the Fold's single flexible OLED reports one segment, so it would not fire even in supporting Chrome, and it has no Firefox or Safari support. |
| Scroll-driven animation, cross-document view transitions | Not in Firefox stable as of mid-2026. Fine as decoration, never as load-bearing mechanics. |
| A cross-region "constellation" hover | Hovering a roster cell to highlight that creator's wall tiles — the wall is scrolled off-screen by the time you are in the roster. Cleverness that does not survive the actual scroll position is not delight. |

### The cost of the fairness cap, stated plainly

427 of one creator's 431 sequences never appear on this surface. That is the deliberate price of the
room not belonging to one person, and Browse is where their full body of work lives. `perOwner` is a
single knob if the judgement changes (see §11).

---

## 11. Open decisions for Fable review

Two genuine either/ors. Both are judgement calls a second design opinion materially improves; the
rest of this spec is settled.

### Q1 — The content band: uncapped fluid, or `--shell-w`?

`4k-native-layout.md` names `--shell-w` as the mechanism. This design refuses it, with arithmetic:
`--shell-w` resolves to `min(92vw, max(1720px, min(88vw, 2600px)))` (`app.css:201`), which **ceilings
at 2600px**. The module box at a 3840 viewport is 3776px. That is 1176px of dead rail — 31% — inside
a box that has *already* been inset by the app sidebar.

- **(A) Ship as specified** — `padding-inline: clamp(1rem, 2.2cqi, 3.5rem)`, no cap, fluid growth
  above the floor, zero dead rail. Wall runs 12 columns at 3840.
- **(B) Adopt `--shell-w`** — rule-literal, one band shared with the rest of the product. Wall drops
  to ~8 columns at 3840 and roughly a third of a 4K screen is empty rail.

If (B), it **must** be consumed as `max-width: min(100%, var(--shell-w))`. `--shell-w` is
viewport-relative (`92vw`), so at a 1280 viewport with a 220px pinned rail it resolves to ~1178px
inside a 1060px module box — overflowing a container that is `overflow: hidden`, clipping content
with no scrollbar. That guard is non-negotiable in either direction for any `vw`-based measure.

**My recommendation: (A).** The rule's *intent* is "fill the canvas, no dead rail"; applying its
named mechanism here produces exactly the failure it forbids.

### Q2 — The fold split at 1920: work owns the first screen, or does the roster peek?

At 1920 (module 1856) the wall at 8 columns is ~209px tiles and 3.5 rows tall, so it fills the
first screen and the roster begins one short scroll down. That *is* the concept's argument — you
meet the output first, then the room — and both community numbers are stated in the top 96px so a
visitor never learns the size of the community by counting faces.

- **(A) Ship as specified** — 8 columns, 209px tiles, wall owns the first screen at 1920. At 3840
  the question dissolves: the whole wall *and* two roster bands are on one screen.
- **(B) 10 columns at the 1616–2599 tier** — 165px tiles, wall becomes 3 rows, so the first band
  header ("This week — 8") and a partial portrait row sit above the fold at 1920. Costs ~21% of the
  art's linear size on the tier most people use.

Bundled with this, since it moves the same lever: **the per-owner cap.** 4 → 25 tiles, top creator
at 16% of the wall (specified). 6 → 35 tiles, 17%. 3 → 21 tiles, 14%.

**My recommendation: (A) with cap 4.** The stated denominator does the honesty work that shrinking
the art would do worse. But this is the one place where seeing real pixels should override the
argument, and it is cheap to try both in Phase 3.

### Carried forward, not a design question

**Guest follow is unverified.** `UserProfilePanel.svelte:126-128` gates only on a truthy
`currentUserId`, and guests hold a real anonymous Firebase uid, so nothing in client code
demonstrably blocks a guest-triggered follow write. Whether Firestore rules reject it was not
inspected. This design removes follow from the discovery surface entirely, which shrinks the
exposure but does not resolve it. **Owed by whoever ships the profile's follow path**, and
`FollowButton` should hide for `authState.user?.isAnonymous` in the meantime.

---

## 12. Build order

Each phase is independently shippable and independently verifiable.

### Phase 0 — Primitive repairs (no visible change to `/creators`)
1. `SequencePeek`: add `eager?: boolean = true`, pass through to `PropAwareThumbnail`. Default
   preserves all existing call sites.
2. `RobustAvatar`: add `loading?: "lazy" | "eager"` on the `<img>`.
3. Correct `PropAwareThumbnail`'s stale header comment — the queue is 8 concurrent
   (`thumbnail-render-queue.ts:36`), not 3.
4. **Relocate `CreatorCard.svelte`** to `routes/(public)/composer/_sections/ConnectCreatorCard.svelte`
   and update the one import at `ConnectSection.svelte:9`.
5. Extract `shared/community/components/FollowButton.svelte`; migrate `UserCard` onto it.

**Verify:** `npm run check` green; `/composer` Connect section renders five cards unchanged;
existing `SequencePeek` consumers (`GalleryDrill`) unchanged.

### Phase 1 — Data layer
1. `creators-data-state`: default query → `{ sortBy: "joinedDate", limit: 200 }`; delete the
   `favoriteProp` branch; add `bandedRoster` and `publicCounts` derivations.
2. `pick-representatives.ts`: add `dealByOwner`.
3. New `creator-recency.ts` and `fit-columns.ts`.

**Verify:** unit tests for `dealByOwner` (431/11/8/6/6/3/1/1 → exactly 25, capped at 4),
`fitColumns` (7@6→5, 6@5→4, 7@3→3+span), `mergeSmallBands`, and a runtime assertion that the
loaded roster length equals the admin census (58) / visitor count (56).

### Phase 2 — The Roster (a complete page on its own)
1. `PropGlyph`, `CreatorCell`, `RosterBand`.
2. Rewrite `CreatorsPanel`: command row + roster + `Crossfade fill` profile swap. Remove the hero,
   the stat block, the 1240px cap, and the viewport media queries. Keep `filterHiddenAccounts`.
3. Delete `VirtualizedCreatorGrid`, `FeaturedCreatorsSection`, `CreatorsSortBar` (after a
   repo-wide grep for other `@tanstack/svelte-virtual` consumers — the dependency stays).
4. Container ramp, tier columns, the short-landscape branch.

**Verify:** screenshots at 3840 / 2560 / 1920 / 1680 / 1440 / 834 / 888×380 / 390 / 375. Band counts
match the census (8/7/6/35). No band ends in a row of one. Confirm the ramp actually moves at 3840
by looking, not by arithmetic.

### Phase 3 — The Wall
1. `WorkTile`, `WorkWall`, geometry-matched skeleton.
2. Wire `dealByOwner` + `publicCounts`; label denominator from live data.
3. `eager={false}` on all tiles.

**Verify:** exactly 25 tiles; the top creator holds exactly 4; captions route through
`simplifyRepeatedWord`; DevTools network shows the wall painting before the users query resolves;
throttled cold-cache run shows the roster fully rendered while the wall is still skeletons.
Try Q2 (A) vs (B) here at 1920 and pick from pixels.

### Phase 4 — Motion
1. Mount stagger, band `growFade`, reorder `flip`, hover states.
2. The manual `startViewTransition` morph with a single-element `view-transition-name`.
3. Reduced-motion and `forced-colors` passes.

**Verify:** the reorder animates all 56 with no reflow; the morph fires on tile and cell activation
and is skipped under reduced motion; `forced-colors: active` keeps every state legible.

### Phase 5 — Close-out
1. Fix the three raw `sequence.word` sites (`ProfileTabs.svelte:79`,
   `ConnectionSharedSequences.svelte:63,89`).
2. Localised ghost-sizer audit: `formatTimeAgo` is `Intl`-backed, so "about 2 years ago" is not the
   longest string in every locale — any reserved slot for a recency phrase must be measured from
   the localised variant set at runtime, not a hardcoded English string.
3. Component-doc notes: the ~150 / ~400 scale ceilings; "never stagger 56 cells"; the 150ms
   selection-to-thumbnail debounce rule; the `cqi` container/child structural rule.
4. Full `npm run check` + `npm run build`.

---

## Related

- `.claude/rules/4k-native-layout.md` · `never-hand-roll.md` · `no-layout-shift.md` ·
  `crossfade-primitive.md` · `chip-primitives.md` · `clickables-look-like-buttons.md` ·
  `simplified-word-display.md` · `no-fabrication.md`
- `docs/reference/styling-guide.md` — the 3-layer variable hierarchy and typography floors
- Census verified read-only against production Firestore, 2026-07-25.
