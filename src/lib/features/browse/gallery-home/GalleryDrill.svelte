<!--
  GalleryDrill — the newcomer front door, a faithful port of the legacy desktop
  app's InitialFilterChoiceWidget: a "series of presets" drill-down.
  Screen 1 = pick HOW to browse (a filter category). Screen 2 = pick the value
  (live counts, never a dead end). Then hand off to the real filtered grid.
  "Show all" + search are always available (no gating). One dimension at a time
  — mobile-first, no card wall, no horizontal scroll.

  Visual layer (2026-07-01 content-peek redesign): every visual carries data.
  Category tiles preview REAL sequences from their bucket (deterministic picks,
  fixed tilts). Level tiles wear the canonical DIFFICULTY_LEVELS gradients —
  the same coding as every difficulty badge and printed card. Counts render as
  density bars (fill = count ÷ largest bucket) + tabular-nums figures. The
  Timing & Direction tile's six dots are the six TnD family colors; the
  LOOPs tile's dots are the loop-component colors present in the catalog.
  Both are real composable filters; families derive per step from arc geometry
  (browse-filter's getSequenceTnDFamilies), and the canonical T&D alphabet
  lives IN the community pool as first-class cards (canonical-tnd-pool.ts) —
  one card per word, 49 turn combos in the standard variation picker.
  Class names are drill-prefixed: the app carries GLOBAL `.tile`/`.head` rules
  that leak column layout into unprefixed names.
  Spec: docs/superpowers/specs/active/2026-07-01-gallery-drill-content-peek-design.md
-->
<script lang="ts">
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import DifficultyBadge from "$lib/shared/components/DifficultyBadge.svelte";
  import TKAWordGlyph from "$lib/shared/choreo-card/components/TKAWordGlyph.svelte";
  import SequencePeek from "./SequencePeek.svelte";
  import { DURATION } from "$lib/shared/transitions/transitions";
  import { DIFFICULTY_LEVELS } from "$lib/shared/config/difficulty-styles";
  import { TND_ELEMENTS } from "$lib/features/choreo-card/domain/tnd-element";
  import { LOOPComponent } from "$lib/shared/foundation/domain/models/generation/generate-models";
  import { LOOP_COMPONENT_MAP } from "$lib/shared/browse/domain/constants/loop-constants";
  import { BrowseFilterType } from "$lib/shared/persistence/domain/enums/filtering-enums";
  import { resolveStepCount } from "$lib/shared/browse/services/browse-sorter";
  import {
    deriveCreators,
    deriveStartingLetters,
    pickCollage,
    pickCreatorSamples,
    pickLengthPair,
    pickLevelRepresentatives,
  } from "./pick-representatives";
  import { generateAvatarUrl } from "$lib/shared/foundation/utils/avatar-generator";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import {
    getDrillSection,
    setDrillSection,
  } from "$lib/features/browse/shared/services/gallery-view-persister";
  import { communityCollectionsState } from "$lib/features/browse/collections/state/community-collections-state.svelte";

  interface Props {
    pool?: readonly SequenceData[];
    /** Live count of results if this filter value were applied. */
    getCount: (type: BrowseFilterType, value: string | number) => number;
    /** Apply the chosen filter and hand off to the grid. Values with a
     * canonical color (loop components) pass it for the applied-filter chip. */
    onApply: (
      type: BrowseFilterType,
      value: string | number,
      label: string,
      color?: string,
    ) => void;
    onShowAll?: () => void;
    onSearch?: (query: string) => void;
    /** Loop-component values currently applied (e.g. "component:mirrored").
     * LOOP rows render active and toggle off on re-tap. */
    activeLoopValues?: ReadonlySet<string>;
    /** Sheet: toggle a loop component in place — the sheet stays open so
     * LOOPs STACK (a sequence can be mirrored AND swapped). When absent,
     * LOOP rows fall back to onApply like every other category. */
    onToggleLoop?: (value: string, label: string, color: string, nowActive: boolean) => void;
    /** TnD family ids currently applied (e.g. "split-same"). Family rows
     * render active and toggle off on re-tap. */
    activeFamilyValues?: ReadonlySet<string>;
    /** Sheet: toggle a family in place — same stacking contract as LOOPs
     * (a sequence can touch several families). */
    onToggleFamily?: (
      familyId: string,
      label: string,
      color: string,
      nowActive: boolean,
    ) => void;
    /** Community-collections discovery: open a collection's detail view.
     * NAVIGATES AWAY (it's not an engine filter), so only the page variant
     * wires it — a filter sheet must never navigate. The category renders
     * only when this is provided. */
    onOpenCollection?: (
      ownerId: string,
      collectionId: string,
      name: string,
      ownerName: string,
    ) => void;
    /** "page" = the gallery front door (with search). "sheet" = the grid's
     * filter bottom sheet — same filter categories, no search. */
    variant?: "page" | "sheet";
  }
  let {
    pool = [],
    getCount,
    onApply,
    onShowAll,
    onSearch,
    activeLoopValues,
    onToggleLoop,
    activeFamilyValues,
    onToggleFamily,
    onOpenCollection,
    variant = "page",
  }: Props = $props();

  type Section =
    | "chooser"
    | "level"
    | "length"
    | "letter"
    | "position"
    | "gridmode"
    | "author"
    | "loop"
    | "family"
    | "collections";
  const SECTIONS: readonly Section[] = [
    "chooser",
    "level",
    "length",
    "letter",
    "position",
    "gridmode",
    "author",
    "loop",
    "family",
    "collections",
  ];
  /** Page variant restores its sub-screen across reload/HMR (sessionStorage);
   * a stale/unknown stored value degrades to the chooser. Sheet always opens
   * fresh — it's a transient drawer. */
  function restoreSection(): Section {
    if (variant !== "page") return "chooser";
    const stored = getDrillSection();
    return stored && (SECTIONS as readonly string[]).includes(stored)
      ? (stored as Section)
      : "chooser";
  }
  let section = $state<Section>(restoreSection());
  $effect(() => {
    if (variant === "page") setDrillSection(section);
  });
  // A host without onOpenCollection can't act on the collections screen —
  // a stale restore of it degrades to the chooser.
  if (section === "collections" && !onOpenCollection) {
    section = "chooser";
  }
  // Community collections load lazily, only when the screen is opened.
  $effect(() => {
    if (section === "collections" && onOpenCollection) {
      void communityCollectionsState.ensureLoaded();
    }
  });
  let query = $state("");

  const LEVELS = [1, 2, 3];

  // Legacy desktop app's level descriptions, verbatim (filter_by_level_section).
  const LEVEL_DESCRIPTIONS: Record<number, string> = {
    1: "Base letters with no turns.",
    2: "Turns added with only radial orientations.",
    3: "Non-radial orientations.",
  };

  // Legacy starting_position_section values + descriptions, verbatim.
  const POSITIONS = [
    { value: "alpha", label: "Alpha", desc: "Hands apart.", img: "/images/position_images/alpha.png" },
    { value: "beta", label: "Beta", desc: "Hands together.", img: "/images/position_images/beta.png" },
    { value: "gamma", label: "Gamma", desc: "Hands form a right angle.", img: "/images/position_images/gamma.png" },
  ];

  // Legacy grid_mode_section values + descriptions (same grid SVGs, already in static/).
  const GRID_MODES = [
    { value: "diamond", label: "Diamond", desc: "Cardinal points — N, E, S, W", img: "/images/grid/diamond_grid.svg" },
    { value: "box", label: "Box", desc: "Diagonal points — NE, SE, SW, NW", img: "/images/grid/box_grid.svg" },
  ];

  // Loop structure — the same component catalog the LOOP filter chip exposes
  // (labels/icons/colors from the canonical LOOP_COMPONENT_MAP; rotated splits
  // into halved/quartered exactly like the chip). Applies the composable
  // cap_type engine filter, so in the sheet it stacks with level/length picks.
  // Halved/quartered descs restate the filter's own selection (rotated +
  // period 2 / period 4).
  const LOOP_OPTIONS = (() => {
    const rotated = LOOP_COMPONENT_MAP.get(LOOPComponent.ROTATED)!;
    return [
      {
        value: "component:rotated_halved",
        label: "Rotated (halved)",
        desc: "Repeats in two rotated halves.",
        icon: "fa-rotate",
        color: rotated.color,
      },
      {
        value: "component:rotated_quartered",
        label: "Rotated (quartered)",
        desc: "Repeats in four rotated quarters.",
        icon: "fa-arrows-spin",
        color: rotated.color,
      },
      ...[
        LOOPComponent.MIRRORED,
        LOOPComponent.FLIPPED,
        LOOPComponent.SWAPPED,
        LOOPComponent.INVERTED,
        LOOPComponent.REWOUND,
      ].map((comp) => {
        const info = LOOP_COMPONENT_MAP.get(comp)!;
        return {
          value: `component:${comp}`,
          label: info.label,
          desc: info.description,
          icon: `fa-${info.icon}`,
          color: info.color,
        };
      }),
    ];
  })();

  const levelValues = $derived(
    LEVELS.map((lvl) => ({
      value: lvl,
      label: `Level ${lvl}`,
      count: getCount(BrowseFilterType.DIFFICULTY, lvl),
    })).filter((v) => v.count > 0),
  );
  const maxLevelCount = $derived(
    Math.max(1, ...levelValues.map((v) => v.count)),
  );

  const lengthValues = $derived.by(() => {
    const lengths = new Set<number>();
    for (const seq of pool) {
      const n = resolveStepCount(seq);
      if (n > 0) lengths.add(n);
    }
    return [...lengths]
      .sort((a, b) => a - b)
      .map((n) => ({
        value: n,
        label: `${n} steps`,
        count: getCount(BrowseFilterType.LENGTH, n),
      }))
      .filter((v) => v.count >= 3);
  });
  const maxLengthCount = $derived(
    Math.max(1, ...lengthValues.map((v) => v.count)),
  );

  const letterValues = $derived(
    deriveStartingLetters(pool)
      .map((letter) => ({
        value: letter,
        count: getCount(BrowseFilterType.STARTING_LETTER, letter),
      }))
      .filter((v) => v.count > 0),
  );

  const positionValues = $derived(
    POSITIONS.map((p) => ({
      ...p,
      count: getCount(BrowseFilterType.STARTING_POSITION, p.value),
    })).filter((v) => v.count > 0),
  );
  const maxPositionCount = $derived(
    Math.max(1, ...positionValues.map((v) => v.count)),
  );

  const gridModeValues = $derived(
    GRID_MODES.map((g) => ({
      ...g,
      count: getCount(BrowseFilterType.GRID_MODE, g.value),
    })).filter((v) => v.count > 0),
  );
  const maxGridModeCount = $derived(
    Math.max(1, ...gridModeValues.map((v) => v.count)),
  );

  // Keep APPLIED values in the list even at count 0 — counts compose with the
  // other active filters, so a later pick can zero out an applied structure;
  // its row must stay visible (and toggleable) or the filter becomes invisible
  // inside the very sheet that owns it.
  const loopValues = $derived(
    LOOP_OPTIONS.map((o) => ({
      ...o,
      count: getCount(BrowseFilterType.LOOP_TYPE, o.value),
    })).filter((v) => v.count > 0 || (activeLoopValues?.has(v.value) ?? false)),
  );
  const maxLoopCount = $derived(
    Math.max(1, ...loopValues.map((v) => v.count)),
  );

  // Timing & Direction — the six families as a real, composable catalog
  // filter (contains-semantics, derived per step from arc geometry). Same
  // applied-at-zero retention as LOOPs so an active family can't vanish
  // from the very sheet that owns it.
  const familyValues = $derived(
    TND_ELEMENTS.map((el) => ({
      value: el.familyId,
      label: el.name,
      element: el.element.charAt(0).toUpperCase() + el.element.slice(1),
      color: el.accentColor,
      icon: el.iconPath,
      count: getCount(BrowseFilterType.TND_FAMILY, el.familyId),
    })).filter((v) => v.count > 0 || (activeFamilyValues?.has(v.value) ?? false)),
  );
  const maxFamilyCount = $derived(
    Math.max(1, ...familyValues.map((v) => v.count)),
  );

  // Most-prolific first: with a skewed catalog the ordering itself says
  // "who made all this", and the density bars carry the proportions.
  const creatorValues = $derived(
    deriveCreators(pool)
      .map((name) => ({
        value: name,
        count: getCount(BrowseFilterType.OWNER, name),
      }))
      .filter((v) => v.count > 0)
      .sort((a, b) => b.count - a.count),
  );
  const maxCreatorCount = $derived(
    Math.max(1, ...creatorValues.map((v) => v.count)),
  );
  // Each creator's row is fronted by their own work — a bare name + count on
  // a wide screen reads as an unfinished list, not a choice.
  const creatorSamples = $derived(pickCreatorSamples(pool, 3));

  // Single-value categories apply directly from the chooser (legacy behavior
  // for Favorites / Most Recent). Hidden at zero — never a dead end.
  const recentCount = $derived(getCount(BrowseFilterType.RECENT, "recent"));
  const favoritesCount = $derived(
    getCount(BrowseFilterType.FAVORITES, "favorites"),
  );

  // Dots on the "Structure" mini tile: one per loop component actually present
  // in the catalog, wearing its canonical color (rotated variants share one).
  const loopDotColors = $derived(
    [...new Set(loopValues.map((v) => v.color))].slice(0, 4),
  );

  // Glyph sample on the "Starting letter" mini tile: the first three real
  // letters of the catalog, rendered as actual TKA glyphs.
  const letterSample = $derived(
    letterValues.slice(0, 3).map((v) => v.value).join(""),
  );

  // Deterministic content peeks — same real sequences every visit.
  const levelReps = $derived(pickLevelRepresentatives(pool, LEVELS));
  const lengthPair = $derived(pickLengthPair(pool));
  const collage = $derived(pickCollage(pool, 4));
  // Fixed 4 slots so the collage box is reserved before the pool loads.
  const collageSlots = $derived([0, 1, 2, 3].map((i) => collage[i]));

  const lengthSub = $derived(
    lengthPair.min !== undefined && lengthPair.max !== undefined
      ? `${lengthPair.min} to ${lengthPair.max} steps`
      : "Short to long",
  );

  // Fixed per-slot tilts (deterministic; random tilt reads as instability).
  const FAN_TILTS = [-8, -2, 6];

  // Peek art scales with the layout tier (the CSS container queries widen the
  // tiles past 900px / 1600px, but SequencePeek's box is a prop — phone-sized
  // art inside desktop tiles reads as an afterthought). Same thresholds as the
  // @container rules so art and layout switch together. Thumbnails come from
  // the 1024px static/cloud renders, so bigger boxes stay sharp.
  const PEEK_TIERS = {
    base: { fanW: 76, fanH: 92, shortW: 56, shortH: 84, longW: 118, longH: 84, collW: 44, collH: 34, levelW: 62, levelH: 56, creatorW: 44, creatorH: 54, badge: "18px" },
    // Level-screen art jumps hardest with width: on the desktop monument
    // columns a mini card is unreadable filler — at 150/200px the word and the
    // motions actually read, so the art argues for the level instead of
    // decorating it.
    wide: { fanW: 112, fanH: 136, shortW: 82, shortH: 122, longW: 172, longH: 122, collW: 60, collH: 46, levelW: 150, levelH: 140, creatorW: 58, creatorH: 72, badge: "24px" },
    ultra: { fanW: 132, fanH: 160, shortW: 96, shortH: 144, longW: 204, longH: 144, collW: 84, collH: 64, levelW: 200, levelH: 186, creatorW: 72, creatorH: 90, badge: "28px" },
  } as const;
  let drillWidth = $state(0);
  const PEEK = $derived(
    drillWidth >= 1600
      ? PEEK_TIERS.ultra
      : drillWidth >= 900
        ? PEEK_TIERS.wide
        : PEEK_TIERS.base,
  );

  function submitSearch(event: Event) {
    event.preventDefault();
    const q = query.trim();
    if (q) onSearch?.(q);
  }

  function pickLoop(v: { value: string; label: string; color: string }) {
    if (onToggleLoop) {
      onToggleLoop(v.value, v.label, v.color, !(activeLoopValues?.has(v.value) ?? false));
    } else {
      onApply(BrowseFilterType.LOOP_TYPE, v.value, v.label, v.color);
    }
  }

  function pickFamily(v: { value: string; label: string; color: string }) {
    if (onToggleFamily) {
      onToggleFamily(v.value, v.label, v.color, !(activeFamilyValues?.has(v.value) ?? false));
    } else {
      onApply(BrowseFilterType.TND_FAMILY, v.value, v.label, v.color);
    }
  }
</script>

<div class="drill" class:sheet={variant === "sheet"} bind:clientWidth={drillWidth}>
  <!-- Search renders wherever the host wires it — the page front door AND the
       filter sheet (the grid toolbar carries no search input; the sheet is the
       grid's complete find-surface). -->
  {#if onSearch}
    <form class="drill-search" role="search" onsubmit={submitSearch}>
      <i class="fas fa-magnifying-glass" aria-hidden="true"></i>
      <input
        type="search"
        bind:value={query}
        placeholder="Search sequences…"
        aria-label="Search sequences"
      />
    </form>
  {/if}

  {#snippet valueHead(title: string, hint?: string)}
    <!-- Back lives IN the screen header (same spot on every value screen, part
         of the crossfading layer) — a persistent bar above the stage burned
         ~44px on the chooser where Back doesn't exist (iPhone: shoved the
         chooser down for nothing). -->
    <header class="drill-head with-back">
      <button
        class="head-back"
        type="button"
        onclick={() => (section = "chooser")}
        aria-label="Back to browse options"
      >
        <i class="fas fa-arrow-left" aria-hidden="true"></i>
        <!-- Icon-only reads as an anonymous circle when the wide stage strands
             it far from the title — the label makes it unmistakably a button.
             Hidden on phones where the 44px circle sits right next to the title. -->
        <span class="head-back-label">Back</span>
      </button>
      <h2>{title}</h2>
      {#if hint}<p>{hint}</p>{/if}
    </header>
  {/snippet}

  <div class="drill-stage">
    <!-- fill mode: screens differ in height, so the content-sized grid-stack
         would resize (and shove neighbors) at every section change. The stage
         is the sized box; layers fill it and each screen scrolls itself. -->
    <Crossfade key={section} duration={DURATION.normal} fill>
      {#if section === "chooser"}
        <div class="drill-screen">
          <header class="drill-head">
            <h2>{variant === "sheet" ? "Filter sequences" : "How do you want to browse?"}</h2>
            <p>
              {variant === "sheet"
                ? "Counts update with your current filters."
                : "Pick one to narrow it down."}
            </p>
          </header>

          <!-- hero-grid: single column on phones (identical to the old stacked
               flow), two-up on wide containers so the front door actually uses
               a desktop monitor instead of floating as a 520px ribbon. -->
          <div class="hero-grid">
            <button class="choice-tile" type="button" onclick={() => (section = "level")}>
              <span class="choice-main">
                <span class="choice-title">By level</span>
                <span class="choice-sub">Beginner to advanced</span>
              </span>
              <span class="peek-fan" aria-hidden="true">
                {#each LEVELS as lvl, i (lvl)}
                  <SequencePeek
                    sequence={levelReps.get(lvl)}
                    width={PEEK.fanW}
                    height={PEEK.fanH}
                    tilt={FAN_TILTS[i]}
                  >
                    {#snippet overlay()}
                      <DifficultyBadge level={lvl} size={PEEK.badge} />
                    {/snippet}
                  </SequencePeek>
                {/each}
              </span>
              <i class="fas fa-chevron-right drill-chev" aria-hidden="true"></i>
            </button>

            <button class="choice-tile" type="button" onclick={() => (section = "length")}>
              <span class="choice-main">
                <span class="choice-title">By length</span>
                <span class="choice-sub">{lengthSub}</span>
              </span>
              <span class="peek-fan pair" aria-hidden="true">
                <SequencePeek sequence={lengthPair.short} width={PEEK.shortW} height={PEEK.shortH} tilt={-3} />
                <SequencePeek sequence={lengthPair.long} width={PEEK.longW} height={PEEK.longH} tilt={3} />
              </span>
              <i class="fas fa-chevron-right drill-chev" aria-hidden="true"></i>
            </button>

            <!-- Show-all lives IN the hero rank: it's the main door, not a
                 footnote. Phone: third stacked tile (same order as before).
                 Two-up tier: spans the full row. Ultra-wide: third hero door. -->
            <button class="choice-tile compact" type="button" onclick={() => onShowAll?.()}>
              <span class="choice-main">
                <span class="choice-title">Show all {pool.length} sequences</span>
                <span class="choice-sub">The whole gallery, one grid</span>
              </span>
              <span class="peek-collage" aria-hidden="true">
                {#each collageSlots as seq, i (i)}
                  <SequencePeek sequence={seq} width={PEEK.collW} height={PEEK.collH} />
                {/each}
              </span>
              <i class="fas fa-chevron-right drill-chev" aria-hidden="true"></i>
            </button>
          </div>

          {#if pool.length > 0}
            <p class="more-head">More ways to browse</p>
            <div class="mini-grid">
              {#if letterValues.length > 1}
                <button class="mini-tile" type="button" onclick={() => (section = "letter")}>
                  <span class="mini-art" aria-hidden="true">
                    <TKAWordGlyph word={letterSample} height={20} darkMode />
                  </span>
                  <span class="mini-main">
                    <span class="mini-title">Starting letter</span>
                    <span class="mini-sub">{letterValues.length} letters</span>
                  </span>
                </button>
              {/if}
              <!-- A one-value category is a dead-end picker (its only value
                   = the whole catalog) — require at least two real values. -->
              {#if positionValues.length > 1}
                <button class="mini-tile" type="button" onclick={() => (section = "position")}>
                  <span class="mini-art plate" aria-hidden="true">
                    <img src={positionValues[0]?.img} alt="" width="32" height="32" loading="lazy" />
                  </span>
                  <span class="mini-main">
                    <span class="mini-title">Start position</span>
                    <span class="mini-sub">Alpha, beta, gamma</span>
                  </span>
                </button>
              {/if}
              {#if gridModeValues.length > 1}
                <button class="mini-tile" type="button" onclick={() => (section = "gridmode")}>
                  <span class="mini-art plate" aria-hidden="true">
                    {#each gridModeValues as g (g.value)}
                      <img src={g.img} alt="" width="20" height="20" loading="lazy" />
                    {/each}
                  </span>
                  <span class="mini-main">
                    <span class="mini-title">Grid mode</span>
                    <span class="mini-sub">Diamond or box</span>
                  </span>
                </button>
              {/if}
              <!-- Structure filters to a subset even with one value, so no
                   two-value gate like the categories above. (loopValues
                   already retains applied-at-zero values, so the tile can't
                   disappear while a structure filter is active.) -->
              {#if loopValues.length > 0}
                <button class="mini-tile" type="button" onclick={() => (section = "loop")}>
                  <span class="mini-art" aria-hidden="true">
                    <span class="element-dots">
                      {#each loopDotColors as color (color)}
                        <span class="element-dot" style:background={color}></span>
                      {/each}
                    </span>
                  </span>
                  <span class="mini-main">
                    <span class="mini-title">LOOPs</span>
                    <span class="mini-sub">Mirrored, rotated, swapped…</span>
                  </span>
                </button>
              {/if}
              {#if creatorValues.length > 1}
                <button class="mini-tile" type="button" onclick={() => (section = "author")}>
                  <span class="mini-art" aria-hidden="true">
                    <i class="fas fa-users"></i>
                  </span>
                  <span class="mini-main">
                    <span class="mini-title">Creator</span>
                    <span class="mini-sub">{creatorValues.length} creators</span>
                  </span>
                </button>
              {/if}
              {#if recentCount > 0}
                <button
                  class="mini-tile"
                  type="button"
                  onclick={() => onApply(BrowseFilterType.RECENT, "recent", "Recently added")}
                >
                  <span class="mini-art" aria-hidden="true">
                    <i class="fas fa-clock-rotate-left"></i>
                  </span>
                  <span class="mini-main">
                    <span class="mini-title">Recently added</span>
                    <span class="mini-sub">Last 30 days · {recentCount}</span>
                  </span>
                </button>
              {/if}
              {#if favoritesCount > 0}
                <button
                  class="mini-tile"
                  type="button"
                  onclick={() => onApply(BrowseFilterType.FAVORITES, "favorites", "Favorites")}
                >
                  <span class="mini-art" aria-hidden="true">
                    <i class="fas fa-heart"></i>
                  </span>
                  <span class="mini-main">
                    <span class="mini-title">Favorites</span>
                    <span class="mini-sub">{favoritesCount} saved</span>
                  </span>
                </button>
              {/if}
              <!-- Real composable filter (families derived per step from
                   arc geometry) — available in page AND sheet, like LOOPs. -->
              {#if familyValues.length > 0}
                <button class="mini-tile" type="button" onclick={() => (section = "family")}>
                  <span class="mini-art" aria-hidden="true">
                    <span class="element-dots">
                      {#each TND_ELEMENTS as el (el.familyId)}
                        <span class="element-dot" style:background={el.accentColor}></span>
                      {/each}
                    </span>
                  </span>
                  <span class="mini-main">
                    <span class="mini-title">Timing &amp; Direction</span>
                    <span class="mini-sub">The six families</span>
                  </span>
                </button>
              {/if}
              <!-- Discovery, not a filter: tapping a collection navigates to
                   its detail view — so only hosts that wire onOpenCollection
                   (the page front door) show it. -->
              {#if onOpenCollection}
                <button class="mini-tile" type="button" onclick={() => (section = "collections")}>
                  <span class="mini-art" aria-hidden="true">
                    <i class="fas fa-folder"></i>
                  </span>
                  <span class="mini-main">
                    <span class="mini-title">Collections</span>
                    <span class="mini-sub">Curated by the community</span>
                  </span>
                </button>
              {/if}
            </div>
          {/if}
        </div>
      {:else if section === "level"}
        <div class="drill-screen">
          {@render valueHead("Pick a level")}
          <div class="value-list">
            {#each levelValues as v (v.value)}
              {@const style = DIFFICULTY_LEVELS[v.value]}
              <button
                class="level-tile"
                type="button"
                style:background={style?.cssBg}
                style:color={style?.text ?? "#000"}
                onclick={() => onApply(BrowseFilterType.DIFFICULTY, v.value, v.label)}
              >
                <span class="value-numeral">{v.value}</span>
                <span class="value-main">
                  <span class="value-label">Level {v.value}</span>
                  <span class="value-desc on-gradient">{LEVEL_DESCRIPTIONS[v.value]}</span>
                  <span class="density-bar on-gradient">
                    <span
                      class="density-fill"
                      style:width="{(v.count / maxLevelCount) * 100}%"
                    ></span>
                  </span>
                </span>
                <span class="value-count">{v.count}</span>
                <SequencePeek sequence={levelReps.get(v.value)} width={PEEK.levelW} height={PEEK.levelH} />
              </button>
            {/each}
          </div>
        </div>
      {:else if section === "length"}
        <div class="drill-screen">
          {@render valueHead("Pick a length")}
          <div class="value-list">
            {#each lengthValues as v (v.value)}
              <button
                class="length-row monument"
                type="button"
                onclick={() => onApply(BrowseFilterType.LENGTH, v.value, v.label)}
              >
                <span class="value-numeral small">{v.value}</span>
                <span class="value-main">
                  <span class="value-label muted">steps</span>
                  <span class="density-bar">
                    <span
                      class="density-fill"
                      style:width="{(v.count / maxLengthCount) * 100}%"
                    ></span>
                  </span>
                </span>
                <span class="value-count">{v.count}</span>
              </button>
            {/each}
          </div>
        </div>
      {:else if section === "letter"}
        <div class="drill-screen">
          {@render valueHead("Pick a starting letter")}
          <div class="letter-grid">
            {#each letterValues as v (v.value)}
              <button
                class="letter-chip"
                type="button"
                aria-label="{v.value} — {v.count} sequences"
                onclick={() => onApply(BrowseFilterType.STARTING_LETTER, v.value, v.value)}
              >
                <span class="letter-glyph">
                  <TKAWordGlyph word={v.value} height={26} darkMode />
                </span>
                <span class="letter-count">{v.count}</span>
              </button>
            {/each}
          </div>
        </div>
      {:else if section === "position"}
        <div class="drill-screen">
          {@render valueHead("Pick a start position")}
          <div class="value-list">
            {#each positionValues as v (v.value)}
              <button
                class="length-row tall monument"
                type="button"
                onclick={() => onApply(BrowseFilterType.STARTING_POSITION, v.value, v.label)}
              >
                <img class="value-img" src={v.img} alt="" width="56" height="56" loading="lazy" />
                <span class="value-main">
                  <span class="value-label">{v.label}</span>
                  <span class="value-desc">{v.desc}</span>
                  <span class="density-bar">
                    <span
                      class="density-fill"
                      style:width="{(v.count / maxPositionCount) * 100}%"
                    ></span>
                  </span>
                </span>
                <span class="value-count">{v.count}</span>
              </button>
            {/each}
          </div>
        </div>
      {:else if section === "author"}
        <div class="drill-screen">
          {@render valueHead("Pick a creator")}
          <div class="value-list">
            {#each creatorValues as v (v.value)}
              <button
                class="length-row tall creator-row"
                type="button"
                onclick={() => onApply(BrowseFilterType.OWNER, v.value, v.value)}
              >
                <img
                  class="creator-avatar"
                  src={generateAvatarUrl(v.value, 96)}
                  alt=""
                  width="44"
                  height="44"
                  loading="lazy"
                />
                <span class="value-main">
                  <span class="value-label">{v.value}</span>
                  <span class="density-bar">
                    <span
                      class="density-fill"
                      style:width="{(v.count / maxCreatorCount) * 100}%"
                    ></span>
                  </span>
                </span>
                <span class="value-count">{v.count}</span>
                <!-- The creator's own work, not stock art — same peek primitive
                     as the chooser fans, clipped by the row's overflow. -->
                <span class="peek-fan creator-fan" aria-hidden="true">
                  {#each creatorSamples.get(v.value) ?? [] as seq, i (seq.id)}
                    <SequencePeek
                      sequence={seq}
                      width={PEEK.creatorW}
                      height={PEEK.creatorH}
                      tilt={FAN_TILTS[i]}
                    />
                  {/each}
                </span>
              </button>
            {/each}
          </div>
        </div>
      {:else if section === "gridmode"}
        <div class="drill-screen">
          {@render valueHead("Pick a grid mode")}
          <div class="value-list">
            {#each gridModeValues as v (v.value)}
              <button
                class="length-row tall monument"
                type="button"
                onclick={() => onApply(BrowseFilterType.GRID_MODE, v.value, v.label)}
              >
                <img class="value-img plate" src={v.img} alt="" width="56" height="56" loading="lazy" />
                <span class="value-main">
                  <span class="value-label">{v.label}</span>
                  <span class="value-desc">{v.desc}</span>
                  <span class="density-bar">
                    <span
                      class="density-fill"
                      style:width="{(v.count / maxGridModeCount) * 100}%"
                    ></span>
                  </span>
                </span>
                <span class="value-count">{v.count}</span>
              </button>
            {/each}
          </div>
        </div>
      {:else if section === "loop"}
        <div class="drill-screen">
          {@render valueHead(
            "Pick a LOOP type",
            onToggleLoop ? "LOOPs stack — tap several to combine them." : undefined,
          )}
          <div class="value-list">
            {#each loopValues as v (v.value)}
              {@const isOn = activeLoopValues?.has(v.value) ?? false}
              <button
                class="length-row tall monument tinted"
                class:loop-active={isOn}
                style:--row-color={v.color}
                type="button"
                aria-pressed={onToggleLoop ? isOn : undefined}
                onclick={() => pickLoop(v)}
              >
                <span class="loop-icon" style:color={v.color} aria-hidden="true">
                  <i class="fas {v.icon}"></i>
                </span>
                <span class="value-main">
                  <span class="value-label">{v.label}</span>
                  <span class="value-desc">{v.desc}</span>
                  <span class="density-bar">
                    <span
                      class="density-fill"
                      style:width="{(v.count / maxLoopCount) * 100}%"
                      style:background={v.color}
                    ></span>
                  </span>
                </span>
                <span class="value-count">{v.count}</span>
                <!-- Slot reserved either way — appearing check must not shift the row. -->
                {#if onToggleLoop}
                  <span class="loop-check" class:on={isOn} aria-hidden="true">
                    <i class="fas fa-check"></i>
                  </span>
                {/if}
              </button>
            {/each}
          </div>
        </div>
      {:else if section === "family"}
        <div class="drill-screen">
          {@render valueHead(
            "Pick a family",
            onToggleFamily
              ? "Timing is how far apart the hands are; direction is whether they rotate the same way or opposite ways. Tap several to combine them."
              : "Timing is how far apart the hands are; direction is whether they rotate the same way or opposite ways.",
          )}
          <div class="value-list">
            {#each familyValues as v (v.value)}
              {@const isOn = activeFamilyValues?.has(v.value) ?? false}
              <button
                class="length-row tall family-row monument tinted"
                class:loop-active={isOn}
                style:--row-color={v.color}
                type="button"
                aria-pressed={onToggleFamily ? isOn : undefined}
                onclick={() => pickFamily(v)}
              >
                <img class="value-img family-icon" src={v.icon} alt="" width="44" height="44" loading="lazy" />
                <span class="value-main">
                  <span class="value-label">
                    {v.label}
                    <span class="element-tag">{v.element}</span>
                  </span>
                  <span class="density-bar">
                    <span
                      class="density-fill"
                      style:width="{(v.count / maxFamilyCount) * 100}%"
                      style:background={v.color}
                    ></span>
                  </span>
                </span>
                <span class="value-count">{v.count}</span>
                {#if onToggleFamily}
                  <span class="loop-check" class:on={isOn} aria-hidden="true">
                    <i class="fas fa-check"></i>
                  </span>
                {/if}
              </button>
            {/each}
          </div>
        </div>
      {:else if section === "collections"}
        <div class="drill-screen">
          {@render valueHead("Pick a collection", "Sequences curated by other people.")}
          {#if communityCollectionsState.loading}
            <div class="value-list" aria-hidden="true">
              {#each Array(4) as _}
                <span class="collection-skeleton"></span>
              {/each}
            </div>
          {:else if communityCollectionsState.error}
            <p class="collections-empty">{communityCollectionsState.error}</p>
          {:else if communityCollectionsState.items.length === 0}
            <p class="collections-empty">
              No public collections yet. Make one of yours public from its card
              menu in Library and it shows up here for everyone.
            </p>
          {:else}
            <div class="value-list">
              {#each communityCollectionsState.items as item (item.ownerId + item.collection.id)}
                <button
                  class="length-row tall monument tinted"
                  style:--row-color={item.collection.color ?? "#c084fc"}
                  type="button"
                  onclick={() =>
                    onOpenCollection?.(
                      item.ownerId,
                      item.collection.id,
                      item.collection.name,
                      item.ownerName,
                    )}
                >
                  <span class="value-folder" aria-hidden="true">
                    <i class={`fas ${item.collection.icon ?? "fa-folder"}`}></i>
                  </span>
                  <span class="value-main">
                    <span class="value-label">{item.collection.name}</span>
                    <span class="value-desc">by {item.ownerName}</span>
                  </span>
                  <span class="value-count">{item.collection.sequenceCount}</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </Crossfade>
  </div>
</div>

<style>
  /* The drill box never scrolls — each screen scrolls inside its Crossfade
     fill layer, so the stage keeps ONE fixed size across section changes and
     the transition can't shift anything. */
  .drill {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    padding: 0.9rem 1rem 1.25rem;
    overflow: hidden;
    /* Width-driven desktop layout below. inline-size containment only — the
       drill's height keeps flexing normally. The filter-sheet variant lives in
       a ≤480px drawer, so the ≥900px rules can never fire there. */
    container-type: inline-size;
    container-name: drill;
  }
  /* Sheet variant: fills the fixed-height drawer body, top-aligned. */
  .drill.sheet {
    padding: 0.5rem 1rem 1rem;
  }
  .drill.sheet .drill-screen {
    justify-content: flex-start;
  }
  .drill-search {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.6rem;
    padding: 0.55rem 0.9rem;
    border-radius: 999px;
    border: 1px solid var(--theme-border, #2a3140);
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text-muted, #9aa6b8);
    max-width: 520px;
    margin: 0 auto;
    width: 100%;
    flex: 0 0 auto;
  }
  .drill-search input {
    flex: 1;
    min-width: 0;
    background: transparent;
    border: none;
    outline: none;
    color: var(--theme-text, #e8edf6);
    font-size: 0.95rem;
  }
  .drill-stage {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    max-width: 520px;
    margin: 0 auto;
    width: 100%;
  }
  /* Collection rows: folder glyph in the same 44px plate the value images use. */
  .value-folder {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    border-radius: 12px;
    background: color-mix(in srgb, var(--row-color, #c084fc) 20%, transparent);
    color: var(--row-color, #c084fc);
    font-size: 17px;
  }
  .collection-skeleton {
    min-height: 64px;
    border-radius: 14px;
    background: color-mix(in srgb, var(--theme-text-muted, #9aa6b8) 12%, transparent);
    animation: drill-skeleton-pulse 1.2s ease-in-out infinite;
  }
  @keyframes drill-skeleton-pulse {
    0%,
    100% {
      opacity: 0.5;
    }
    50% {
      opacity: 0.85;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .collection-skeleton {
      animation: none;
    }
  }
  .collections-empty {
    margin: 0 auto;
    max-width: 380px;
    text-align: center;
    font-size: 0.9rem;
    line-height: 1.5;
    color: var(--theme-text-muted, #9aa6b8);
  }

  /* Each screen fills its (absolute, stage-sized) crossfade layer and owns its
     own scroll; short screens center, tall ones scroll from the top. */
  .drill-screen {
    display: flex;
    flex-direction: column;
    justify-content: safe center;
    gap: 0.75rem;
    width: 100%;
    height: 100%;
    overflow-y: auto;
  }
  .drill-head {
    display: block;
    text-align: center;
  }
  .drill-head h2 {
    margin: 0 0 0.2rem;
    font-size: 1.25rem;
    font-weight: 800;
    text-transform: none;
    color: var(--theme-text, #e8edf6);
  }
  .drill-head p {
    margin: 0;
    font-size: 0.88rem;
    color: var(--theme-text-muted, #9aa6b8);
  }
  /* Value-screen header: back control left of the centered title (mirrored
     1fr columns keep the title truly centered whatever the button's width);
     hint spans the full row. */
  .drill-head.with-back {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    row-gap: 0.3rem;
  }
  .drill-head.with-back h2 {
    grid-column: 2;
    margin: 0;
  }
  .drill-head.with-back p {
    grid-column: 1 / -1;
  }
  .head-back {
    grid-column: 1;
    grid-row: 1;
    justify-self: start;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-width: 44px;
    height: 44px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-border, #2a3140);
    border-radius: 999px;
    color: var(--theme-text, #e8edf6);
    font-size: 0.95rem;
    cursor: pointer;
  }
  /* Phone: icon-only circle (sits right next to the title, no room needed). */
  .head-back-label {
    display: none;
    font-weight: 600;
  }
  .head-back:hover {
    border-color: var(--theme-accent, #6aa0ff);
  }
  .head-back:focus-visible {
    outline: 2px solid var(--theme-accent, #6aa0ff);
    outline-offset: 2px;
  }

  /* ── Chooser tiles ─────────────────────────────────────────────── */
  /* Phone: one column, same rhythm as the old stacked flow (gap matches the
     drill-screen gap so the wrapper is visually invisible). */
  .hero-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
    width: 100%;
  }
  .choice-tile {
    position: relative;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    gap: 0.75rem;
    width: 100%;
    min-height: 116px;
    padding: 0.9rem 2rem 0.9rem 1.1rem;
    text-align: left;
    border-radius: 18px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #e8edf6);
    cursor: pointer;
    overflow: hidden;
    transition:
      border-color 0.16s ease,
      transform 0.16s ease;
  }
  .choice-tile:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
    transform: translateY(-1px);
  }
  .choice-tile:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }
  .choice-tile.compact {
    min-height: 84px;
  }
  .choice-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.2rem;
  }
  .choice-title {
    font-size: 1.05rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .choice-sub {
    font-size: 0.82rem;
    color: var(--theme-text-muted, #9aa6b8);
    font-variant-numeric: tabular-nums;
  }
  .drill-chev {
    position: absolute;
    right: 0.85rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--theme-text-muted, #9aa6b8);
    font-size: 0.85rem;
  }

  /* Peek fan: fixed tilts, overlapping, bleeding off the tile's right edge
     (the tile's overflow:hidden does the clipping). */
  .peek-fan {
    display: flex;
    flex-direction: row;
    align-items: center;
    margin-right: -1.4rem;
    flex: 0 0 auto;
  }
  .peek-fan > :global(.peek + .peek) {
    margin-left: -1.4rem;
  }
  .peek-fan.pair > :global(.peek + .peek) {
    margin-left: -0.6rem;
  }
  .peek-collage {
    display: grid;
    grid-template-columns: repeat(2, auto);
    gap: 3px;
    margin-right: 0.4rem;
    flex: 0 0 auto;
  }

  /* ── Tier 2: more ways to browse ───────────────────────────────── */
  .more-head {
    margin: 0.35rem 0 -0.25rem;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--theme-text-muted, #9aa6b8);
    text-align: center;
  }
  .mini-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.6rem;
  }
  .mini-tile {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.6rem;
    min-height: 64px;
    padding: 0.6rem 0.7rem;
    text-align: left;
    border-radius: 14px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #e8edf6);
    cursor: pointer;
    transition: border-color 0.16s ease, transform 0.16s ease;
  }
  .mini-tile:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
    transform: translateY(-1px);
  }
  .mini-tile:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }
  .mini-art {
    flex: 0 0 auto;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-width: 44px;
    height: 32px;
    color: var(--theme-text-muted, #9aa6b8);
    font-size: 1rem;
  }
  /* Legacy PNGs/SVGs draw dark lines — give them the same white plate the
     legacy app rendered them on. */
  .mini-art.plate {
    background: #fff;
    border-radius: 8px;
    padding: 3px 4px;
  }
  .mini-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .mini-title {
    font-size: 0.9rem;
    font-weight: 700;
  }
  .mini-sub {
    font-size: 0.75rem;
    color: var(--theme-text-muted, #9aa6b8);
    font-variant-numeric: tabular-nums;
  }

  /* ── Family / loop color dots (mini-tile art) ──────────────────── */
  .element-dots {
    display: flex;
    flex-direction: row;
    gap: 4px;
  }
  .element-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .value-list {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    width: 100%;
  }

  /* Level tiles wear the canonical difficulty gradients (light backgrounds,
     black text per the canonical config). */
  .level-tile {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.85rem;
    width: 100%;
    min-height: 76px;
    padding: 0.7rem 0.9rem;
    text-align: left;
    border-radius: 16px;
    border: 1px solid rgba(0, 0, 0, 0.35);
    cursor: pointer;
    transition: transform 0.16s ease, filter 0.16s ease;
  }
  .level-tile:hover {
    transform: translateY(-1px);
    filter: brightness(1.05);
  }
  .level-tile:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  .length-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.85rem;
    width: 100%;
    min-height: 56px;
    padding: 0.55rem 0.9rem;
    text-align: left;
    border-radius: 14px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #e8edf6);
    cursor: pointer;
    transition: border-color 0.16s ease, transform 0.16s ease;
  }
  .length-row:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
    transform: translateY(-1px);
  }
  .length-row:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* Monument numeral — same face as DifficultyBadge (Cambria serif). */
  .value-numeral {
    font-family: Cambria, Georgia, serif;
    font-weight: 700;
    font-size: 2.4rem;
    line-height: 1;
    min-width: 2ch;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  .value-numeral.small {
    font-size: 1.6rem;
  }

  .value-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.35rem;
  }
  .value-label {
    font-size: 0.95rem;
    font-weight: 700;
  }
  .value-label.muted {
    color: var(--theme-text-muted, #9aa6b8);
    font-weight: 600;
    font-size: 0.8rem;
  }
  .value-desc {
    font-size: 0.75rem;
    line-height: 1.25;
    color: var(--theme-text-muted, #9aa6b8);
    /* Centered monument descriptions (levels, families) wrap to two lines in
       their narrow column — balance splits them evenly instead of orphaning
       the last word ("…the same / way."). No-op on single-line rows. */
    text-wrap: balance;
  }
  /* On the light level gradients, descriptions read in dark ink. */
  .value-desc.on-gradient {
    color: rgba(0, 0, 0, 0.65);
  }
  .value-img {
    flex: 0 0 auto;
    width: 56px;
    height: 56px;
    object-fit: contain;
    border-radius: 10px;
  }
  .value-img.plate {
    background: #fff;
    padding: 4px;
  }
  /* Family rows lead with the element PNG at the loop-icon footprint so the
     two stacking screens (LOOPs / families) share one row rhythm. */
  .value-img.family-icon {
    width: 44px;
    height: 44px;
    border-radius: 0;
  }
  /* Colored value rows (families, loops, collections) wear their accent at
     rest, not just when active — panel tinted and edged in the row's color at
     every tier. Identical charcoal bars undersold the color-coded systems. */
  .length-row.tinted {
    background: color-mix(
      in srgb,
      var(--row-color) 10%,
      var(--theme-card-bg, rgba(255, 255, 255, 0.04))
    );
    border-color: color-mix(in srgb, var(--row-color) 35%, transparent);
  }
  .length-row.tinted:hover {
    border-color: color-mix(in srgb, var(--row-color) 65%, transparent);
  }
  .element-tag {
    margin-left: 0.45rem;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--row-color);
  }
  .length-row.tall {
    min-height: 76px;
  }
  /* Creator rows: monogram disc + the creator's own work as a trailing fan. */
  .creator-row {
    overflow: hidden;
  }
  .creator-avatar {
    flex: 0 0 auto;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
  }
  .peek-fan.creator-fan {
    margin-right: -0.4rem;
  }
  .peek-fan.creator-fan > :global(.peek + .peek) {
    margin-left: -0.8rem;
  }
  /* Tight rows (phones, the filter sheet): one sample is flavor, three is a
     squeeze — keep the lead peek, drop the rest. */
  @container drill (max-width: 560px) {
    .peek-fan.creator-fan > :global(.peek:nth-child(n + 2)) {
      display: none;
    }
  }
  /* Loop-structure rows lead with the component's canonical icon + color —
     the same coding as the LOOP icon strip and deck labels. */
  .loop-icon {
    flex: 0 0 auto;
    width: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
  }
  /* Applied structure (sheet toggles): border + tint in the component's color. */
  /* Selected reads stronger than the resting .tinted panel. */
  .length-row.loop-active {
    border-color: color-mix(in srgb, var(--row-color) 60%, transparent);
    background: color-mix(in srgb, var(--row-color) 20%, transparent);
  }
  .loop-check {
    flex: 0 0 auto;
    width: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--row-color);
    font-size: 0.9rem;
    visibility: hidden;
  }
  .loop-check.on {
    visibility: visible;
  }

  /* ── Letter grid ───────────────────────────────────────────────── */
  .letter-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
    gap: 0.5rem;
  }
  .letter-chip {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    min-height: 60px;
    padding: 0.45rem 0.3rem;
    border-radius: 12px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #e8edf6);
    cursor: pointer;
    transition: border-color 0.16s ease, transform 0.16s ease;
  }
  .letter-chip:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
    transform: translateY(-1px);
  }
  .letter-chip:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }
  .letter-glyph {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 26px;
  }
  .letter-count {
    font-size: 0.72rem;
    font-variant-numeric: tabular-nums;
    color: var(--theme-text-muted, #9aa6b8);
  }

  /* Density bar: fill = count ÷ largest bucket on screen. Fixed track. */
  .density-bar {
    display: block;
    width: 100%;
    max-width: 160px;
    height: 5px;
    border-radius: 999px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.1));
    overflow: hidden;
  }
  .density-fill {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: var(--theme-text-muted, #9aa6b8);
  }
  .density-bar.on-gradient {
    background: rgba(0, 0, 0, 0.15);
  }
  .density-bar.on-gradient .density-fill {
    background: rgba(0, 0, 0, 0.55);
  }

  .value-count {
    flex: 0 0 auto;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    font-size: 0.95rem;
  }
  .length-row .value-count {
    color: var(--theme-text, #e8edf6);
  }

  /* Instant tap feedback — touch has no :hover, so a press must register
     visually the moment it lands (the grid paints a beat later). */
  .choice-tile:active,
  .mini-tile:active,
  .length-row:active,
  .letter-chip:active {
    transform: scale(0.985);
  }
  .level-tile:active {
    transform: scale(0.985);
    filter: brightness(1.08);
  }

  @media (prefers-reduced-motion: reduce) {
    .choice-tile,
    .level-tile,
    .length-row,
    .mini-tile,
    .letter-chip {
      transition: none;
    }
    .choice-tile:hover,
    .level-tile:hover,
    .length-row:hover,
    .mini-tile:hover,
    .letter-chip:hover,
    .choice-tile:active,
    .level-tile:active,
    .length-row:active,
    .mini-tile:active,
    .letter-chip:active {
      transform: none;
    }
  }

  /* ── Desktop (wide container) ──────────────────────────────────────
     The drill was born mobile-first and shipped as a 520px ribbon on every
     screen size — on a 4K monitor that's a strip floating in empty ocean.
     Past 900px of container width the stage earns real estate: hero tiles go
     two-up, the mini-grid spreads to four columns, and every value screen
     lays its choices out as a multi-column wall instead of a phone list.
     Nothing here touches the phone layout, and the filter-sheet variant's
     drawer (≤480px) can never reach these rules. */
  @container drill (min-width: 900px) {
    .drill {
      gap: 1.25rem;
      padding: 1.5rem 2rem 2rem;
    }
    .drill-search {
      max-width: 640px;
      padding: 0.7rem 1.1rem;
    }
    .drill-stage {
      max-width: 1160px;
    }
    .drill-head h2 {
      font-size: 1.6rem;
    }
    .drill-head p {
      font-size: 0.95rem;
    }
    .drill-screen {
      gap: 1rem;
    }

    /* Chooser: the two big doors side by side, taller and roomier.
       Show-all spans the full row beneath them at this tier. */
    .hero-grid {
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
    .choice-tile {
      min-height: 158px;
      padding: 1.15rem 2.4rem 1.15rem 1.5rem;
      border-radius: 22px;
    }
    .choice-tile.compact {
      min-height: 92px;
      grid-column: 1 / -1;
    }
    .choice-title {
      font-size: 1.3rem;
    }
    .choice-sub {
      font-size: 0.92rem;
    }
    .more-head {
      margin-top: 0.75rem;
    }
    .mini-grid {
      grid-template-columns: repeat(4, 1fr);
      gap: 0.8rem;
    }
    .mini-tile {
      min-height: 78px;
      padding: 0.75rem 0.9rem;
    }
    .mini-title {
      font-size: 0.98rem;
    }

    /* Back earns its label once the wide stage strands it away from the title. */
    .head-back {
      padding: 0 1.1rem 0 0.95rem;
    }
    .head-back-label {
      display: inline;
    }
    .creator-avatar {
      width: 56px;
      height: 56px;
    }
    .creator-row {
      min-height: 96px;
    }

    /* Value screens: choices tile the width instead of stacking as a phone
       list. auto-fill keeps short catalogs (3 positions, 2 grid modes)
       centered-looking without stranding one giant row. */
    .value-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 0.8rem;
    }
    /* Groups of exactly 6 (the six T&D families, a 6-tile mini-grid) square
       up as 3x2 — a 4+2 ragged break reads as an accident, not a set. */
    .value-list:has(> :nth-child(6):last-child),
    .mini-grid:has(> :nth-child(6):last-child) {
      grid-template-columns: repeat(3, 1fr);
    }

    /* Levels: three monument columns — the numeral and gradient carry the
       screen the way the difficulty badges carry the cards. */
    .value-list:has(.level-tile) {
      grid-template-columns: repeat(3, 1fr);
    }
    .level-tile {
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 0.6rem;
      min-height: 230px;
      padding: 1.4rem 1.2rem;
      border-radius: 20px;
    }
    .level-tile .value-numeral {
      font-size: 3.6rem;
      min-width: 0;
    }
    /* Monument order: rank numeral → showcase card → description → count.
       (DOM keeps the phone row order; flex `order` re-stacks the column.) */
    .level-tile .value-numeral { order: 1; }
    .level-tile :global(.peek) { order: 2; }
    .level-tile .value-main { order: 3; }
    .level-tile .value-count { order: 4; }
    .level-tile .value-main {
      align-items: center;
      gap: 0.45rem;
    }
    .level-tile .value-label {
      font-size: 1.1rem;
    }
    .level-tile .value-desc {
      font-size: 0.85rem;
    }
    .level-tile .value-count {
      font-size: 1.05rem;
    }

    .letter-grid {
      grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
      gap: 0.6rem;
    }
    .letter-chip {
      min-height: 70px;
    }

    /* Every value screen joins the levels as monument panels: lead media on
       top, label (+ desc / tag), density, count — centered in a tall column
       instead of a thin horizontal bar stranded in the wide grid. Creators are
       the deliberate exception (kept horizontal — the trailing work-fan is the
       identity, and there are too many for tall panels).
       (.length-row.monument: must outweigh the base .length-row.tall
       min-height, and @container adds no specificity.) */
    .length-row.monument {
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: 0.55rem;
      min-height: 220px;
      padding: 1.3rem 1.2rem;
      border-radius: 20px;
    }
    .monument .value-main {
      align-items: center;
      gap: 0.4rem;
    }
    .monument .density-bar {
      margin-inline: auto;
    }
    .monument .value-label {
      font-size: 1.05rem;
    }
    .monument .value-count {
      font-size: 1.05rem;
    }
    /* Lead media grows to monument scale, per screen. */
    .monument .value-numeral.small {
      font-size: 3rem;
    }
    .monument .value-img,
    .monument .value-img.family-icon {
      width: 64px;
      height: 64px;
    }
    .monument .loop-icon {
      font-size: 2.6rem;
    }
    .monument .value-folder {
      width: 60px;
      height: 60px;
      font-size: 24px;
    }
  }

  /* ── Ultra-wide (4K-class) ─────────────────────────────────────────
     Past 1600px the two-up tier starts leaving real acreage unused, so the
     chooser becomes a three-door hub: level / length / show-all as equal hero
     panels in one row, with the ultra PEEK art tier filling them. The stage
     itself widens to ~1760px — wider still just stretches travel distance
     between choices without adding information. */
  @container drill (min-width: 1600px) {
    .drill-stage {
      max-width: 1760px;
    }
    .drill-search {
      max-width: 720px;
    }
    .drill-head h2 {
      font-size: 1.85rem;
    }
    .drill-head p {
      font-size: 1.05rem;
    }
    .hero-grid {
      grid-template-columns: repeat(3, 1fr);
      gap: 1.1rem;
    }
    .choice-tile,
    .choice-tile.compact {
      min-height: 216px;
      grid-column: auto;
      padding: 1.3rem 2.6rem 1.3rem 1.7rem;
      border-radius: 24px;
    }
    .choice-title {
      font-size: 1.45rem;
    }
    .choice-sub {
      font-size: 1rem;
    }
    .mini-grid {
      gap: 1rem;
    }
    .mini-tile {
      min-height: 92px;
      padding: 0.9rem 1.1rem;
      border-radius: 16px;
    }
    .mini-art {
      min-width: 52px;
      font-size: 1.2rem;
    }
    .mini-title {
      font-size: 1.05rem;
    }
    .mini-sub {
      font-size: 0.82rem;
    }
    .element-dot {
      width: 10px;
      height: 10px;
    }

    .value-list {
      grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
      gap: 1rem;
    }
    /* Exactly-6 rule again at this tier — the wider auto-fill would break
       the six families 4+2. */
    .value-list:has(> :nth-child(6):last-child),
    .mini-grid:has(> :nth-child(6):last-child) {
      grid-template-columns: repeat(3, 1fr);
    }
    .level-tile {
      min-height: 290px;
    }
    .level-tile .value-numeral {
      font-size: 4.4rem;
    }
    .length-row {
      min-height: 64px;
    }
    .length-row.tall {
      min-height: 88px;
    }
    .letter-grid {
      grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
      gap: 0.7rem;
    }
    .letter-chip {
      min-height: 78px;
    }
    .length-row.monument {
      min-height: 260px;
      padding: 1.6rem 1.5rem;
    }
    .monument .value-img,
    .monument .value-img.family-icon {
      width: 76px;
      height: 76px;
    }
    .monument .value-numeral.small {
      font-size: 3.6rem;
    }
    .monument .loop-icon {
      font-size: 3rem;
    }
    .monument .value-folder {
      width: 72px;
      height: 72px;
    }
    .monument .value-label {
      font-size: 1.15rem;
    }
  }
</style>
