# Profile, person first

**Date:** 2026-07-29
**Surface:** `/creators/[id]` — `UserProfilePanel` and everything under
`features/creators/components/profile/`
**Supersedes the composition of:** `2026-07-27-profile-lobby-design.md` (the
doorway and strips it produced are kept verbatim; only the page's composition
changes)

## The problem

The profile is a showcase. It opens on the person's work and it is built on the
assumption that work exists.

Most accounts have no work. For those people the page is a header over two grey
sentences — "Nothing published yet." — and nothing else. Austen (2026-07-29):

> *"once you get to it it's like straight up immediately on a look at my stuff
> that I've created but what if I haven't created anything yet ... Most of the
> people in this app have not created anything yet so it should just show how
> long they've been on and all that kind of stuff I worry that we have gone so
> far into making a showcase experience that we forgot that we can just have
> this profile page share you know who's following you and what sequences
> you've liked and what collections you might own."*

The material to fix this is already loaded and thrown away. `getUserProfile`
returns `joinedDate`, `lastActiveAt`, `location`, `pronouns`, and
`favoriteCatdog`; the hero renders none of them. `createdAt` is the only field
populated on 100% of user documents — it is why the creators directory sorts by
it — so tenure is the one thing every profile can always show.

A second complaint, same message: *"maybe redesign the whole 4K experience so
it's more balanced."* The page is a single tall stack of full-width bands inside
a hardcoded `max-width: 1920px`. At 3840 that is 960px of dead rail per side
(measured 2026-07-28) and the page uses half its width.

## Decisions taken

| Question | Decision |
|---|---|
| Likes | **Out of scope.** No like feature exists — see Non-goals. |
| One layout or two? | **One layout for everyone.** Work is one section among many; Austen's profile and a new account's differ only in which sections have content. |
| Wide composition | **Identity rail + work column.** |
| Empty profile | **Collapse to the rail, centred.** No work column when there is no work. |
| Follower faces | **Counts only**, clickable, opening the existing `FollowersModal`. No added Firestore reads. |

The last one contradicts the mockup Austen picked for the empty state, which
drew a row of faces; his explicit answer to the avatars question was
counts-only, and the explicit answer wins. Flagged to him at design time.

## Non-goals

- **Likes.** There is no like system. `favorites-manager.ts` is the only thing
  close and it writes to **sessionStorage** — per-device, per-session, invisible
  to anyone else, and gone when the tab closes. A profile cannot show it. Real
  likes are a social feature with Firestore rules, denormalized counts, and a
  moderation surface; they get their own spec.
- **Promoting favorites to per-account Firestore.** Considered and declined for
  this pass.
- **Fixing the `collectionCount` counter** (`reference_collection_count_broken`
  — it never increments). This spec stops *displaying* the broken number; it
  does not repair the writer.
- **Collecting new activity data** (recently followed, viewed, jams attended).
  A layout change must not smuggle in a data-collection feature.

## Information architecture

Everything about the person goes in the rail. Everything they made goes in the
column.

**Rail, top to bottom:**

1. Avatar, display name, `@username`, pronouns when set
2. Bio when set
3. Location when set (coarse, IP-derived — already public on creator cards)
4. **Tenure:** joined date, and last-active when genuinely known
5. Props they spin with, favourite prop starred, catdog combo when set
6. Instagram when set
7. Stat counts: Sequences, Collections, Followers, Following — the last two
   clickable into `FollowersModal`
8. Follow / Report actions
9. Connection section (mutual status, notes, shared sequences) when viewing
   someone else while signed in

**Work column, unchanged from `2026-07-27-profile-lobby-design.md`:** Showcase
grid, Archive doorway, Collections strips. This spec does not touch their
contents, counts, or handoffs.

**Admin** keeps its own separate column, admin-only. 1157 lines of moderation
tooling does not belong wedged into an identity card, and a third column at 4K
is affordable for the two people who ever see it.

## Components

### `ProfileHeroSection` becomes the rail

A rewrite of the existing component, not a new one. Grep evidence: the creators
hero has exactly one real consumer (`UserProfilePanel`) plus
`routes/test/profile-stage`. The `ProfileHeroSection` under
`shared/settings/components/tabs/profile/` is a **different file** that shares
the name — `ProfileTab` imports its own local copy and is unaffected.

The `fill` prop is deleted. It existed to widen the wide-banner form; the banner
form is what goes away. Net −1 concept, per `never-hand-roll.md`.

### `ProfileStage` keeps its content, reports its emptiness

The stage owns the three bands and loads its own library and collections. It
gains one outward signal — a bindable `hasWork` — so the panel can drop the
work column. Emptiness is `showcase + sequences + collections` all zero, which
the stage already derives; the panel must not recompute it from a second query.

### `UserProfilePanel` composes

Rail column, work column, admin column. It keeps the data loading, follow
toggle, and modal wiring it already owns.

## Two bugs this must fix rather than work around

### `capFor()` measures the wrong box

`ProfileStage` derives every band's column count from `window.innerWidth`
(`ProfileStage.svelte:227`). A 400px rail makes every count an over-estimate:
tiles squeeze or the row overflows. It must measure the stage's own element.

This is the one piece of load-bearing plumbing in the change. The tier
thresholds themselves stay as they are — they are already tuned and verified;
only the width fed into them changes.

### `lastActiveAt` silently becomes `joinedDate`

`user-repository.ts:157` falls back to `joinedDate` when `lastActivityDate` is
absent. Rendering both lines then produces "Member since July 2026 / Active
July 2026" — a profile that looks broken.

Worse, the two read paths disagree. The directory path preserves the absence,
which is why `CreatorCell.svelte:84` has a live `"never returned"` branch and
`creator-recency.ts:51` handles the null. Only the single-profile path
collapses it.

Fix: stop collapsing it in `getUserProfile`, and hide the Active line when
`lastActivityDate` is genuinely missing. The interface already types
`lastActiveAt` optional and every other consumer already tolerates undefined.

### And one display honesty fix

The Collections stat renders `collectionCount`, which never increments — the
header says **0** while the band beneath it says **46**, visible in Austen's own
screenshot. The stat takes its number from the band's real total instead. Same
invariant the doorway work established: a count comes from the pool it
describes.

## Layout

`max-width: 1920px` becomes `var(--shell-w)` — the documented site-wide band
(floor 1720px, fluid 88vw, ceiling 2600px). Hardcoding a band is forbidden by
`4k-native-layout.md`; this is the mechanism that rule names.

Two things then use the width the cap was refusing:

- The rail absorbs a fixed slice, so the work column's tiles grow rather than
  multiply.
- The panel's existing `cqi` clamps scale type and padding with the panel. The
  lockstep root ramp does **not** reach here — it is scoped to `.mkt-shell`,
  `.legal-container`, and `.qft-app` — but the container queries already in
  place are the equivalent mechanism.

Tiers, all on the `profile-panel` container query that already exists:

| Container width | Composition |
|---|---|
| ≥ 1100px | rail + work (+ admin column for admins) |
| < 1100px | stacked, identity first |
| Empty profile, any width | rail only, centred, capped so it reads as a card |

## Testing

- Unit: the emptiness predicate, and the tenure lines' presence/absence given
  present, absent, and equal-to-joined `lastActivityDate`.
- Reuse `formatTimeAgo` from `shared/i18n/i18n-formatters` for relative dates.
  Do not hand-roll.
- The seven-viewport screenshot pass from `visual-verification-mandatory.md`,
  run twice: once on a populated profile, once on an **empty** one. The empty
  case is what the redesign is for and it cannot be verified by arithmetic.

## Risks

- **The rail is a new fixed cost on narrow screens.** Stacked, identity now
  sits above the work every time. Mitigated by keeping the rail's stacked form
  compact — it must not push the Showcase below the fold at 375.
- **`capFor` rewiring touches all three bands at once.** A wrong measurement
  degrades every band simultaneously rather than one. Screenshots at all seven
  viewports are the check, not the column arithmetic.
- **Absent optional fields are the common case.** Location, bio, pronouns,
  Instagram, and props are all sparse. Every one must collapse cleanly, or the
  rail becomes a column of gaps — which would be a worse empty state than the
  one being replaced.

## Related

- `2026-07-27-profile-lobby-design.md` — the doorway and strips this keeps
- `.claude/rules/4k-native-layout.md`, `visual-verification-mandatory.md`,
  `no-layout-shift.md`, `never-hand-roll.md`
- `reference_collection_count_broken`
