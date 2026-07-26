<!--
  CreatorsPanel — the Creators discovery surface.

  Two things about this page are load-bearing and easy to undo by accident:

  1. IT RENDERS FOUR FIELDS PER PERSON, ON PURPOSE. Against production
     (census 2026-07-25): bio 0%, pinnedItems 0%, isFeatured 0%,
     profileColor 1.7%, and followerCount never exceeds 4. The only signals
     that discriminate across the whole directory are the face (94.8%), the
     prop (96.6%), last-active (96.6%) and join date (100%). Adding a bio
     line or a stat cluster back does not enrich the card; it adds an empty
     row to 56 of 56 cards.

  2. THE 4K SCALE STRATEGY LIVES HERE. The root font ramp in `app.css` is
     scoped to `html:has(.mkt-shell)` and `.legal-container` — it does NOT
     reach in-app modules, so at 3840 an in-app surface gets zero type
     growth and reads as a 1080p layout stretched across a wall. This panel
     ramps its own `font-size` and every descendant sizes in `em`, so one
     declaration scales type, spacing and avatars in lockstep. If you change
     a child to `rem`, it freezes at 1080p proportions and breaks 4K.

  The content band is deliberately NOT `--shell-w`: that token ceilings at
  2600px, which at a 3840 viewport leaves ~31% dead rail inside a box the app
  sidebar has already inset — the exact failure `4k-native-layout.md` exists
  to forbid. Fluid padding above a floor, no cap.
-->
<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import type { HapticFeedback } from "$lib/shared/application/services/haptic-feedback";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { authState } from "$lib/shared/auth/state/auth-state.svelte";
  import { getBrowseLoader } from "$lib/shared/browse/get-browse-loader";
  import {
    followUser,
    unfollowUser,
  } from "$lib/shared/community/services/user-repository";
  import type { EnhancedUserProfile } from "$lib/shared/community/domain/models/enhanced-user-profile";
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import PanelSearch from "$lib/shared/components/panel/PanelSearch.svelte";
  import PanelState from "$lib/shared/components/panel/PanelState.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import { DURATION } from "$lib/shared/transitions/transitions";
  import { creatorsDataState } from "../state/creators-data-state.svelte";
  import {
    openCreatorProfile,
    restoreCreatorProfileFromURL,
    syncCreatorsViewFromURL,
  } from "../state/creators-routing.svelte";
  import { creatorsViewState } from "../state/creators-view-state.svelte";
  import {
    BAND_LABEL,
    bandOf,
    mergeSmallBands,
    type BandKey,
  } from "../domain/creator-recency";
  import { fitColumns } from "../domain/fit-columns";
  import { dealByOwner } from "$lib/features/browse/gallery-home/pick-representatives";
  import { openSequenceViewer } from "$lib/shared/sequence-viewer/services/sequence-viewer-navigator";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import RosterBand from "./RosterBand.svelte";
  import WorkWall from "./WorkWall.svelte";
  import UserProfilePanel from "./UserProfilePanel.svelte";

  type RosterView = "active" | "new" | "following";

  const NEW_WINDOW_DAYS = 30;
  const DAY_MS = 86_400_000;
  const BAND_ORDER: BandKey[] = ["week", "month", "quarter", "earlier"];

  let searchQuery = $state("");
  let view = $state<RosterView>("active");
  let initError = $state<string | null>(null);
  let publicSequences = $state<SequenceData[]>([]);
  // Reassigned wholesale rather than mutated, so a plain Set stays reactive.
  let followPending = $state<Set<string>>(new Set());
  let hapticService: HapticFeedback | undefined;

  // Measured rather than media-queried: the module box is inset by the app
  // sidebar, so its width is not the viewport width and a viewport media
  // query would pick the wrong tier. Column counts are computed from these.
  let boxWidth = $state(0);
  let boxHeight = $state(0);

  const currentUserId = $derived(authState.user?.uid);
  const canFollow = $derived(authState.isFullAccount);
  const users = $derived(creatorsDataState.users);
  const searchResults = $derived(creatorsDataState.searchResults);
  const isLoading = $derived(creatorsDataState.isLoading);
  const error = $derived(creatorsDataState.error);
  const publicCounts = $derived(creatorsDataState.publicCounts);

  // `creatorsDataState.users` is already visitor-filtered (moderated accounts
  // removed unless the viewer is an admin), so every count below is the count
  // the viewer can actually see. An admin sees 58 and the page says 58 —
  // nothing here is hardcoded.
  const roster = $derived(searchResults !== null ? searchResults : users);

  const newCreatorIds = $derived.by(() => {
    const cutoff = Date.now() - NEW_WINDOW_DAYS * DAY_MS;
    return new Set(
      roster
        .filter((creator) => creator.joinedDate.getTime() >= cutoff)
        .map((creator) => creator.id)
    );
  });

  const viewed = $derived.by(() => {
    if (view === "following") return roster.filter((c) => c.isFollowing);
    if (view === "new") {
      return roster
        .filter((c) => newCreatorIds.has(c.id))
        .sort((a, b) => b.joinedDate.getTime() - a.joinedDate.getTime());
    }
    return roster;
  });

  const viewOptions = $derived([
    { value: "active" as const, label: "Active", count: roster.length },
    { value: "new" as const, label: "New here", count: newCreatorIds.size },
    {
      value: "following" as const,
      label: "Following",
      count: roster.filter((c) => c.isFollowing).length,
      disabled: !canFollow,
    },
  ]);

  const isSearching = $derived(searchResults !== null);

  // "New here", "Following" and any SEARCH RESULT are already a single
  // coherent group. Banding them by recency would slice an 8-person list into
  // four bands of two — and on a search it did something worse: `mergeSmallBands`
  // folds any group under three people FORWARD, so a search returning one or
  // two matches carried them all the way into "Earlier". Looking up someone
  // last active four days ago filed them under the long tail, at index
  // density, with no evidence line and no follow button — in the one flow
  // where you most want to follow from the roster. A group with a null heading
  // renders as a plain grid: no header, portrait density, honest per-person
  // recency rings.
  const bands = $derived.by(() => {
    if (view !== "active" || isSearching) {
      return [
        { key: "week" as BandKey, members: viewed, heading: null as string | null },
      ];
    }
    const now = Date.now();
    const byBand = new Map<BandKey, EnhancedUserProfile[]>();
    for (const key of BAND_ORDER) byBand.set(key, []);
    for (const creator of viewed) {
      byBand.get(bandOf(creator.lastActiveAt, now))!.push(creator);
    }
    return mergeSmallBands(
      BAND_ORDER.map((key) => ({ key, members: byBand.get(key)! }))
    ).map((band) => ({ ...band, heading: BAND_LABEL[band.key] as string | null }));
  });

  // A wide, very short box (Z Fold 7 folded in landscape is ~960 x 412) has
  // no room for a stacked portrait cell plus a chrome row. Everything drops
  // to index density and the whole page keeps ONE horizontal chrome row.
  const isShortLandscape = $derived(
    boxHeight > 0 && boxHeight <= 600 && boxWidth / boxHeight > 1.7
  );

  // Columns come from a TARGET CELL WIDTH, not a tier table. Hand-picked
  // caps were the redesign's worst visual bug: a 6-column cap at a 1870px
  // panel produced ~296px cells holding a ~93px face, which reads as a
  // scatter of dots in a field of empty gutter — the "not at home on 4K"
  // failure this page exists to fix.
  //
  // Target width is expressed in `em` so it rides the same ramp as the type:
  // as the panel grows past 1616 the cells grow too, instead of the count
  // climbing forever and the faces staying small.
  /**
   * The same ramp the CSS applies, in JS, because RobustAvatar sizes in px.
   * Without this the type and spacing grow at 4K while every face stays
   * 88px — the "disjointed 4K" failure `4k-native-layout.md` is about. Keep
   * these two in lockstep: this must mirror `.roster-view`'s clamp exactly.
   */
  const unitPx = $derived(
    Math.min(24, Math.max(16, 16 + ((boxWidth || 1616) - 1616) * (8 / 2160)))
  );

  // This is the cell's MINIMUM, not its target: it decides how many fit on a
  // row, while `--cell-max` (12.5em, in RosterBand) bounds how wide they may
  // grow. At 10.5 the two disagreed and a 1440px panel capped at 7 columns,
  // wrapping an 8-person band to 6 + 2 when all eight fit comfortably at
  // 164px. Below ~9.5em the names start truncating.
  const PORTRAIT_CELL_EM = 9.5;
  // Index rows are a face plus a full display name on one line. 9em truncated
  // most of them ("Bryan Ma…", "Tka-Scree…"), which defeats the point of a
  // directory; 13em fixed that but dropped a 1440px panel to 5 columns and
  // stretched the 37-person tail over eight rows. 11em fits the common name
  // and keeps the tail compact.
  const INDEX_CELL_EM = 11;

  // MEASURED, not computed. Deriving it as `boxWidth - 2 * gutter` looks
  // equivalent and is not: `.scroller` also carries `scrollbar-gutter: stable`,
  // so the arithmetic ran ~9px wide and every band overflowed its own padding
  // box by that much once the cells became fixed-width tracks. Binding the
  // real content box removes the whole class of drift between this file's
  // numbers and the stylesheet's.
  //
  // The arithmetic survives only as the pre-measurement fallback, which is
  // what the skeleton renders against on the first frame.
  let measuredContentWidth = $state(0);

  const gutterPx = $derived(Math.min(56, Math.max(16, boxWidth * 0.022)));

  const contentWidth = $derived(
    measuredContentWidth || Math.max(0, boxWidth - 2 * gutterPx)
  );

  const portraitCap = $derived(
    isShortLandscape
      ? 0 // portrait disabled entirely — no vertical room
      : Math.max(2, Math.floor(contentWidth / (PORTRAIT_CELL_EM * unitPx)))
  );

  const indexCap = $derived(
    Math.max(1, Math.floor(contentWidth / (INDEX_CELL_EM * unitPx)))
  );

  // ── the wall ────────────────────────────────────────────────────────────
  // A thumbnail has to be big enough to read a pictograph in, so its target
  // is wider than a roster cell's.
  const WALL_TILE_EM = 16;

  const wallCap = $derived(
    Math.max(2, Math.floor(contentWidth / (WALL_TILE_EM * unitPx)))
  );

  /**
   * ONE row, sized to the canvas rather than a fixed 25 that overflows a
   * phone and underfills a 4K panel. Two rows was tried and buried the roster
   * below the fold — this page is called Creators, so the work is the
   * invitation and the people are the content.
   *
   * The per-owner cap is the important half: 92.3% of the 467 public
   * sequences belong to ONE creator (census 2026-07-25), so without it the
   * wall is that person's feed wearing the community's name.
   */
  const wallItems = $derived.by(() => {
    // The wall answers "what has this community made", which a filtered or
    // searched roster is no longer asking. It shows on the default view only.
    //
    // It is also suppressed on a wide-but-short box for the same reason that
    // branch drops every band to index density: at 960x412 the scroller has
    // ~355px of visible height and one row of tiles consumed all of it, so
    // the page opened on a page called Creators showing zero creators.
    if (
      isShortLandscape ||
      view !== "active" ||
      searchQuery.trim() ||
      publicSequences.length === 0
    ) {
      return [];
    }
    const byOwner = new Map(users.map((user) => [user.id, user]));
    // Exactly one row: asking for the column count means `count % cols` is
    // always 0, so the wall can never strand a tile alone on a second row.
    // (At 375 a `max(3, cap)` floor asked for 3 tiles in a 2-column grid and
    // did exactly that.) When the data yields fewer, `fitColumns` narrows the
    // grid to match and the row is still full.
    const limit = wallCap;
    return dealByOwner(publicSequences, {
      // Breadth beats depth on a ONE-row wall. At perOwner 4 a six-tile row
      // came back as four Adam Molski plus two Austen Cloud — accurate to the
      // publish dates, and a poor advertisement for a community. Allowing
      // roughly six makers into the row is what makes it read as "people",
      // and it still rises above 1 when the row is wide enough at 4K to
      // deserve a second piece from anyone.
      perOwner: Math.max(1, Math.ceil(limit / 6)),
      limit,
    })
      .flatMap((sequence) => {
        // Sequences whose owner is not in the visitor-facing roster are
        // dropped rather than shown uncredited — that includes the moderated
        // accounts `creatorsDataState` filters out.
        const creator = sequence.ownerId
          ? byOwner.get(sequence.ownerId)
          : undefined;
        return creator ? [{ sequence, creator }] : [];
      });
  });

  // ── band geometry ───────────────────────────────────────────────────────
  // Column counts AND cell width are decided here, for every band at once,
  // rather than by each band independently.
  //
  // Independently was the bug: `.cells` carried `margin-inline: auto` inside a
  // column flex parent, which cancels `align-self: stretch`, so each grid sized
  // to its own CONTENT. Three bands ended up three different widths with three
  // different insets (measured at 2560: bands at x=402 / 521 / 499 under a wall
  // at x=119), which reads as misalignment, not as centring.
  //
  // Now: one cell width shared by every band of a density, derived from the
  // BUSIEST band so that band fills the row exactly, and every shorter band
  // centres its identical cells inside the same full-width track. One left
  // edge, one card size, leftover space only where a band genuinely has fewer
  // people than the row holds.
  const GAP_EM = 0.5;
  // How wide a cell may stretch. A portrait card past ~14em is a small face
  // marooned in a large box — the "scatter of dots" failure. An index row is a
  // face plus a whole display name on one line, so its ceiling is generous
  // enough that a one- or two-column phone layout fills the width instead of
  // truncating names inside a 224px column in a 343px row.
  const CELL_MAX_EM: Record<"portrait" | "index", number> = {
    portrait: 14,
    index: 22,
  };

  const bandLayout = $derived.by(() => {
    const rows = bands.map((band) => {
      const density: "portrait" | "index" =
        isShortLandscape || band.key === "earlier" ? "index" : "portrait";
      const cap = Math.max(1, density === "portrait" ? portraitCap : indexCap);
      return {
        ...band,
        density,
        columns: fitColumns(
          band.members.length,
          Math.min(cap, Math.max(1, band.members.length))
        ),
      };
    });

    const cellPxFor = (density: "portrait" | "index") => {
      const widest = Math.max(
        1,
        ...rows.filter((row) => row.density === density).map((row) => row.columns)
      );
      const ceiling = CELL_MAX_EM[density] * unitPx;
      if (contentWidth <= 0) return ceiling;
      const fair = (contentWidth - (widest - 1) * GAP_EM * unitPx) / widest;
      return Math.max(1, Math.min(ceiling, fair));
    };

    const portraitCell = cellPxFor("portrait");
    const indexCell = cellPxFor("index");

    return rows.map((row) => ({
      ...row,
      cellPx: row.density === "portrait" ? portraitCell : indexCell,
    }));
  });

  function handleWorkSelect(sequence: SequenceData) {
    hapticService?.trigger("selection");
    openSequenceViewer(sequence, {
      returnPath: "/creators",
      returnLabel: "Creators",
    });
  }

  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  function handleCreatorsPopState() {
    syncCreatorsViewFromURL();
  }

  /**
   * The public-sequence index is loaded only to learn WHICH creators have
   * shared work, so the header can state its own denominator honestly. The
   * roster never waits on it — if this is slow or fails, the directory still
   * renders and the header simply omits the work clause.
   */
  async function loadPublicWorkOwners() {
    try {
      const sequences = await getBrowseLoader().loadSequenceMetadata();
      publicSequences = sequences;
      creatorsDataState.setPublicWorkOwnerIds(
        new Set(
          sequences
            .map((sequence) => sequence.ownerId)
            .filter((id): id is string => Boolean(id))
        )
      );
    } catch (workError) {
      console.warn("[CreatorsPanel] Public work index unavailable:", workError);
    }
  }

  onMount(() => {
    restoreCreatorProfileFromURL();
    window.addEventListener("popstate", handleCreatorsPopState);
    return () => {
      window.removeEventListener("popstate", handleCreatorsPopState);
      creatorsViewState.reset();
    };
  });

  onMount(async () => {
    hapticService = getHapticFeedback();
    try {
      const creatorsRequest = creatorsDataState.isInitialized
        ? Promise.resolve()
        : creatorsDataState.loadCreators(currentUserId);

      // Not awaited together: the roster is the page, the work index is a
      // caption. Blocking the former on the latter would be backwards.
      void loadPublicWorkOwners();
      await creatorsRequest;
    } catch (loadError) {
      console.error("[CreatorsPanel] Error loading creators:", loadError);
      initError = "Failed to load creators. Please try again.";
    }
  });

  /**
   * Follow state is topped up REACTIVELY, not in `onMount`.
   *
   * `currentUserId` comes from `authState`, which frequently resolves AFTER
   * this component mounts. The old mount-time branch read it once, got
   * `undefined`, loaded the roster without follow state, and never ran again —
   * so an account following 54 people rendered 0 of 20 cards as Following.
   * That was survivable when following required opening a profile; with a
   * follow button on every card it means offering to re-follow people you
   * already follow.
   */
  let followStateLoadedFor: string | null = null;
  $effect(() => {
    const viewerId = currentUserId;
    if (!viewerId) return;
    if (!creatorsDataState.isInitialized) return;
    if (creatorsDataState.hasFollowState) return;
    if (followStateLoadedFor === viewerId) return;

    followStateLoadedFor = viewerId;
    void creatorsDataState.refreshCreators(viewerId).catch((refreshError) => {
      console.error("[CreatorsPanel] Follow state unavailable:", refreshError);
      followStateLoadedFor = null;
    });
  });

  onDestroy(() => {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  });

  function handleSelect(creator: EnhancedUserProfile) {
    hapticService?.trigger("selection");
    void openCreatorProfile(creator.id, creator.displayName);
  }

  /**
   * Follow without leaving the roster. The write is NOT optimistic: the state
   * flips only after Firestore confirms, so a failed write cannot leave the
   * card claiming a relationship that does not exist. `updateUserFollowStatus`
   * patches the main list, the featured list and any live search result at
   * once, which is what keeps the "Following" count in the view switcher
   * honest — it derives from the same array.
   */
  async function handleFollow(creator: EnhancedUserProfile) {
    const viewerId = currentUserId;
    if (!viewerId || followPending.has(creator.id)) return;

    hapticService?.trigger("selection");
    followPending = new Set(followPending).add(creator.id);
    const wasFollowing = creator.isFollowing;

    try {
      if (wasFollowing) await unfollowUser(viewerId, creator.id);
      else await followUser(viewerId, creator.id);
      creatorsDataState.updateUserFollowStatus(
        creator.id,
        !wasFollowing,
        wasFollowing ? -1 : 1
      );
    } catch (followError) {
      console.error("[CreatorsPanel] Follow toggle failed:", followError);
    } finally {
      const next = new Set(followPending);
      next.delete(creator.id);
      followPending = next;
    }
  }

  function handleSearchInput(value: string) {
    searchQuery = value;
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      creatorsDataState.setSearchQuery(value);
    }, 220);
  }

  const activeError = $derived(initError ?? error);
</script>

<div
  class="creators-panel"
  class:short-landscape={isShortLandscape}
  bind:clientWidth={boxWidth}
  bind:clientHeight={boxHeight}
>
  <Crossfade
    key={creatorsViewState.currentView === "user-profile"
      ? `profile:${creatorsViewState.viewingUserId}`
      : "roster"}
    duration={DURATION.normal}
    fill
  >
    {#if creatorsViewState.currentView === "user-profile" && creatorsViewState.viewingUserId}
      <UserProfilePanel userId={creatorsViewState.viewingUserId} />
    {:else}
      <div class="roster-view">
        <!-- ONE chrome row, at every breakpoint. No eyebrow, no <h1>, no
             description paragraph, no aggregate stat block. The population is
             stated as a fact next to the name, not as an achievement. -->
        <header class="command-row">
          <h2 class="title">
            Creators
            <span class="population" aria-label="{roster.length} creators">
              <span class="dot" aria-hidden="true">·</span>{roster.length}
            </span>
          </h2>

          <div class="search-slot">
            <PanelSearch
              value={searchQuery}
              placeholder="Search creators"
              oninput={handleSearchInput}
              maxWidth="100%"
            />
          </div>

          <SegmentedControl
            options={viewOptions}
            value={view}
            onchange={(next) => {
              hapticService?.trigger("selection");
              view = next;
            }}
            size="sm"
            density="compact"
            semantics="radiogroup"
            ariaLabel="Roster view"
          />
        </header>

        <div class="scroller">
          {#if activeError}
            <PanelState
              type="error"
              compact
              title="Couldn't load creators"
              message={activeError}
            />
          {:else if isLoading && roster.length === 0}
            <!-- Skeleton geometry matches the real band structure so the
                 first paint does not jump when data lands. -->
            <div class="skeleton" aria-hidden="true">
              {#each Array(3) as _, bandIndex (bandIndex)}
                <div class="skeleton-band">
                  <span class="skeleton-rule"></span>
                  <div
                    class="skeleton-cells"
                    style:--cols={Math.max(portraitCap, 2)}
                  >
                    {#each Array(Math.max(portraitCap, 2)) as __, cellIndex (cellIndex)}
                      <span class="skeleton-cell"></span>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          {:else if viewed.length === 0}
            <PanelState
              type="empty"
              compact
              icon="fa-user-group"
              title={searchQuery.trim() ? "No matches" : "Nobody here yet"}
              message={searchQuery.trim()
                ? `No creator matches "${searchQuery.trim()}".`
                : view === "following"
                  ? "Creators you follow will collect here."
                  : "New creators will appear as they join."}
            />
          {:else}
            {#if wallItems.length > 0}
              <div class="wall-slot">
                <WorkWall
                  items={wallItems}
                  cap={wallCap}
                  {unitPx}
                  onselect={handleWorkSelect}
                  oncreator={handleSelect}
                />
              </div>
            {/if}

            <div class="bands" bind:clientWidth={measuredContentWidth}>
              {#each bandLayout as band, index (band.key)}
                <RosterBand
                  band={band.key}
                  heading={band.heading}
                  members={band.members}
                  density={band.density}
                  columns={band.columns}
                  cellPx={band.cellPx}
                  {newCreatorIds}
                  {unitPx}
                  loading={index === 0 ? "eager" : "lazy"}
                  onselect={handleSelect}
                  onfollow={handleFollow}
                  {followPending}
                />
              {/each}
            </div>

            {#if publicCounts.creatorsWithWork > 0}
              <!-- The page states its own denominator. 8 of 56 is the real
                   ratio and hiding it would make the directory look emptier
                   than it is when a visitor finds most profiles have no work. -->
              <p class="denominator">
                <span class="tabular">{publicCounts.creatorsWithWork}</span>
                of
                <span class="tabular">{publicCounts.totalCreators}</span>
                creators have shared public work
              </p>
            {/if}
          {/if}
        </div>
      </div>
    {/if}
  </Crossfade>
</div>

<style>
  .creators-panel {
    /* Establishes the query container ONLY. The ramp below cannot live on
       this element: an element cannot query itself, so `cqw` here would
       resolve against the next container up (or the viewport) and silently
       ramp against the wrong width. `inline-size` rather than `size` because
       nothing queries height in CSS — the short-landscape branch is decided
       in JS from the measured box, which avoids `size` containment's
       requirement for a definite height. */
    container-type: inline-size;
    container-name: creators;

    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .roster-view {
    /* The 4K ramp for this surface, on a CHILD of the container so `cqw`
       resolves against the module box. `app.css`'s root ramp is scoped to
       `html:has(.mkt-shell)` / `.legal-container` and does not reach in-app
       modules, so without this the page is frozen at 1080p proportions on a
       4K display. Every descendant sizes in `em`, so this one declaration
       moves type, spacing and avatars together and nothing can outgrow its
       neighbours.

       Floor 1rem below the 1616 seam; grows to 1.5rem by 3840. Same 8/2160
       slope as the marketing ramp so the two surfaces feel like one product
       on the same monitor. */
    font-size: clamp(1rem, calc(1rem + (100cqw - 1616px) * 8 / 2160), 1.5rem);

    /* Three shared primitives on this surface size themselves from these
       tokens in REM, so they were frozen at 1080p while everything around
       them ramped: at a 3840 viewport the title measured 33px and the band
       headers 19.5px, while the search field sat at 14px and the view
       switcher and every follow button at 12px. Redefining the tokens in `em`
       hands them the panel ramp. The values are identical to the global rem
       defaults at the 16px floor, so nothing changes below 1616. */
    --font-size-sm: 0.875em;
    --font-size-compact: 0.75em;

    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  /* ── command row ──────────────────────────────────────────────────────── */
  .command-row {
    display: flex;
    align-items: center;
    gap: 1em;
    flex: 0 0 auto;
    padding: 0.75em clamp(1rem, 2.2cqw, 3.5rem);
    /* The chrome row sits directly on the animated background too, so it gets
       the same scrim treatment as the scroller — otherwise the search field
       and the control float over moving artwork with nothing behind them. */
    border-bottom: 1px solid var(--theme-stroke-strong, rgba(255, 255, 255, 0.1));
    background: color-mix(
      in srgb,
      var(--theme-surface, #0b1622) 72%,
      transparent
    );
    backdrop-filter: blur(14px) saturate(1.1);
  }

  .command-row :global(.segmented-control) {
    /* The control is a set of three short labels, not a layout region.
       SegmentedControl declares `width: 100%` on its own root, which makes
       `flex-basis: auto` resolve to the full row — so `flex: 0 0 auto` alone
       does NOT contain it, and it shipped 1765px wide on an 1846px panel.
       The `width` override is the load-bearing half of this pair. */
    flex: 0 0 auto;
    width: auto;
    margin-left: auto;
  }

  .command-row :global(.segmented-control .segment) {
    /* SegmentedControl defaults to `white-space: normal` so long labels wrap
       rather than clip. Once the control is content-sized that turns "New
       here" into two stacked lines. These labels are two words at most. */
    white-space: nowrap;
  }

  .title {
    margin: 0;
    /* At 1.0625em the page name was smaller than the band headers' visual
       weight and got lost on an 1846px bar. This is the only heading on the
       surface; it can afford to anchor the row. */
    font-size: 1.375em;
    font-weight: 650;
    letter-spacing: -0.01em;
    white-space: nowrap;
    color: var(--theme-text, rgba(255, 255, 255, 0.95));
  }

  .population {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    font-weight: 500;
    /* The count changes with search and view; tabular figures stop the
       search field to its right from shifting on every keystroke. */
    font-variant-numeric: tabular-nums;
  }

  .population .dot {
    margin: 0 0.35em;
  }

  .search-slot {
    /* Grows, but only to a readable field width — a search box stretched
       across a 4K panel is not more usable, just louder. The basis is small
       so the field never claims a whole flex line of its own on a phone; it
       gets whatever the title and the wrapped switcher leave. */
    flex: 1 1 6rem;
    min-width: 0;
    max-width: 26em;
  }

  /* NO negative margin here. PanelSearch insets itself 20px, dropping to 16px
     under a 640px VIEWPORT media query, while this panel is sized by its
     CONTAINER (the module box is inset by the app sidebar) — so the two
     disagree about when the inset changes. The old `margin: 0 -20px` that
     cancelled it pushed the field 40px wider than the row at 375 and
     overflowed the panel. The primitive keeps its own inset; a 20px offset
     mid-row is invisible, and an overflowing search field is not. */

  /* ── scroller ─────────────────────────────────────────────────────────── */
  .scroller {
    /* The module box is `overflow: hidden`, so exactly one element inside it
       owns the scroll. Nesting a second scroll region here would trap the
       wheel and break scroll restoration. */
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior-y: contain;
    padding: 1.25em clamp(1rem, 2.2cqw, 3.5rem) 2em;
    scrollbar-gutter: stable;

    /* The app renders a live 3D/animated background behind every module. With
       a fully transparent panel, jellyfish and bubbles swim between the names
       and the faces — the roster reads as text floating on moving artwork.
       A translucent scrim keeps the background present (it is part of the
       product's character) while giving the content something to sit on. */
    background: color-mix(
      in srgb,
      var(--theme-surface, #0b1622) 62%,
      transparent
    );
    backdrop-filter: blur(10px) saturate(1.05);
  }

  .wall-slot {
    margin-bottom: 2.25em;
  }

  .bands {
    display: flex;
    flex-direction: column;
    gap: 1.75em;
  }

  .denominator {
    margin: 2em 0 0;
    font-size: 0.8125em;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.45));
  }

  .tabular {
    font-variant-numeric: tabular-nums;
  }

  /* ── skeleton ─────────────────────────────────────────────────────────── */
  .skeleton {
    display: flex;
    flex-direction: column;
    gap: 1.75em;
  }

  .skeleton-band {
    display: flex;
    flex-direction: column;
    gap: 0.75em;
  }

  .skeleton-rule {
    height: 1px;
    background: var(--theme-stroke-strong, rgba(255, 255, 255, 0.1));
  }

  .skeleton-cells {
    display: grid;
    grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
    gap: 0.5em;
  }

  .skeleton-cell {
    /* Matches the portrait cell's real height so the swap from skeleton to
       content does not move the page (skeletons-match-layout). */
    height: 9.5em;
    border-radius: 0.75em;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  /* ── narrow: the chrome row wraps ─────────────────────────────────────── */
  /* One row is right until the three things in it stop fitting. The title is
     ~135px and the view switcher ~277px, so on a 375px phone they alone
     overflowed the row by 45px — the switcher's "Following" count was clipped
     off the edge by the panel's own `overflow: hidden` — and the search field,
     the only flexible item, was squeezed to 0px. It was already unusable at
     430 (16px) and thin at 600 (154px).

     Below the seam the switcher takes its own full-width row. Three equal
     segments across the phone is a better control than three crushed ones,
     and the search field gets the whole remainder of row one. */
  @container creators (max-width: 700px) {
    .command-row {
      flex-wrap: wrap;
      row-gap: 0.6em;
    }

    .search-slot {
      max-width: none;
    }

    .command-row :global(.segmented-control) {
      /* Undoes the `width: auto` / `margin-left: auto` pair above: here the
         control IS a layout region, and `flex-basis: 100%` is what forces the
         wrap onto a second line. */
      flex: 1 0 100%;
      width: 100%;
      margin-left: 0;
    }
  }

  /* ── short landscape (Z Fold 7 folded, phone landscape) ───────────────── */
  .creators-panel.short-landscape .command-row {
    padding-block: 0.4em;
  }

  .creators-panel.short-landscape .scroller {
    padding-bottom: 1em;
  }

  .creators-panel.short-landscape .bands {
    gap: 1em;
  }

  .creators-panel.short-landscape .denominator {
    /* At ~400px tall every row counts; the ratio is already stated in the
       roster itself once the wall lands in Phase 3. */
    display: none;
  }
</style>
