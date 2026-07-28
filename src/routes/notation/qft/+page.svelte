<script lang="ts">
  /**
   * QfT Notation — one app, three modes.
   *
   * Guide walks the eight canonical moves, each restored animation running
   * beside a model that computes the same move from the published rules.
   * Instrument unlocks the knobs. The step from watching to playing is one
   * click, not one URL.
   *
   * Matrix is the argument the other two set up: TKA's shape matrix and QfT
   * describe the same geometry, so any of its cells can be read as a pair of
   * QfT hands. Pick two flowers and a VTG mode and the stage draws the move in
   * Charlie's notation, which is the form it was meant to be written in.
   *
   * No narrator: the only prose is quoted from the source, and every label
   * states a fact rather than an interpretation.
   *
   * Design: docs/superpowers/specs/2026-07-27-qft-archive-app-design.md
   *         docs/superpowers/specs/2026-07-28-qft-shape-matrix-bridge-design.md
   * Sources: docs/reference/archive/qft-notation/README.md
   */
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import {
    GUIDE_MOVES,
    SOURCES,
    TIMELINE,
    type GuideMove,
  } from "$lib/shared/notation/qft/qft-guide";
  import {
    buildIncrements,
    buildPendulum,
    type Convention,
    type QftKnobs,
    type Spin,
  } from "$lib/shared/notation/qft/qft-model";
  import {
    LAYER_KEYS,
    LAYER_LABELS,
    normalizeLayers,
    type QftLayers,
  } from "$lib/shared/notation/qft/qft-layers";
  import { nameFor } from "$lib/shared/notation/qft/qft-naming";
  import {
    loadQftSession,
    saveQftSession,
    type QftSession,
  } from "$lib/shared/notation/qft/qft-session";
  import ControlDock, {
    type ControlDockTab,
  } from "$lib/shared/sequence-viewer/components/ControlDock.svelte";
  import HorizontalTransportRow from "$lib/shared/sequence-viewer/components/HorizontalTransportRow.svelte";
  import QftFrames from "$lib/shared/notation/qft/components/QftFrames.svelte";
  import QftGuidePane from "$lib/shared/notation/qft/components/QftGuidePane.svelte";
  import QftStage from "$lib/shared/notation/qft/components/QftStage.svelte";
  import QftFlowerPicker from "$lib/shared/notation/qft/components/QftFlowerPicker.svelte";
  import QftTable from "$lib/shared/notation/qft/components/QftTable.svelte";
  import {
    buildFlowerAxis,
    ratioLabel,
  } from "$lib/shared/shape-matrix/domain/flower-signature";
  import {
    MODE_LABEL,
    MODE_ORDER,
    type VtgMode,
  } from "$lib/shared/shape-matrix/services/shape-matrix-realizations";
  import { realizationToHands } from "$lib/shared/notation/qft/qft-flower-bridge";

  type AppMode = "guide" | "instrument" | "matrix";

  /*
   * Restored synchronously at init rather than in an effect, so the first paint
   * is already the right shape. Restoring afterwards would show the default
   * move for a frame and then jump, which is exactly the seam this removes.
   */
  const restored = loadQftSession(GUIDE_MOVES.length);

  let appMode = $state<AppMode>(restored?.appMode ?? "guide");
  let moveIndex = $state(restored?.moveIndex ?? 0);
  let showInfo = $state(false);
  let showArchive = $state(false);

  /* Instrument state. Seeded from the move on screen when the mode switches, so
     the knobs open on whatever the reader was just looking at. */
  let radius = $state(restored?.radius ?? 1);
  let downbeats = $state(restored?.downbeats ?? 3);
  let spin = $state<Spin>(restored?.spin ?? "antispin");
  let phase = $state(restored?.phase ?? 0);
  let pendulum = $state(restored?.pendulum ?? false);
  let convention = $state<Convention>(restored?.convention ?? "drex");

  /*
   * Raw and unwrapped: a scrub backwards off zero runs negative for a few
   * hundred milliseconds before it lands. Consumers get `pos`, normalised.
   */
  let cursor = $state(restored?.cursor ?? 0);
  let playing = $state(restored?.playing ?? true);

  const pos = $derived(((cursor % 8) + 8) % 8);

  /*
   * Which layers the stage draws. Independent booleans rather than a
   * single-select, so these are toggle chips and not a SegmentedControl
   * (.claude/rules/chip-primitives.md).
   */
  let layers = $state<QftLayers>(normalizeLayers(restored?.layers));

  const toggleLayer = (key: keyof QftLayers) => {
    layers = { ...layers, [key]: !layers[key] };
  };

  /*
   * Indexing is possibly-undefined under strict index access, and the guide is
   * meaningless without a move, so the fallback is the first entry rather than
   * a nullable that every consumer then has to guard.
   */
  const FIRST = GUIDE_MOVES[0] as GuideMove;
  const move = $derived<GuideMove>(GUIDE_MOVES[moveIndex] ?? FIRST);

  const knobs = $derived<QftKnobs>({ radius, downbeats, spin, phase });

  const guideIncrements = $derived(
    move.pendulum ? buildPendulum() : buildIncrements(move.knobs, "drex")
  );
  const instrumentIncrements = $derived(
    pendulum ? buildPendulum() : buildIncrements(knobs, convention)
  );
  const step = $derived(Math.floor(pos) % 8);

  /*
   * The matrix mode.
   *
   * The twelve flowers of the shape matrix's `large` size preset — diamond
   * grid, turns 0/1/2, both styles and both orientations — on each axis, which
   * is where its 144 cells come from. Six VTG modes on top of that makes 864
   * distinct moves, every one of which lands on the eight-point compass without
   * rounding. See qft-flower-bridge.ts.
   */
  const MATRIX_AXIS = buildFlowerAxis().filter(
    (f) => f.grid === "diamond" && [0, 1, 2].includes(f.turns)
  );

  let blueIndex = $state(restored?.blueIndex ?? 6);
  let redIndex = $state(restored?.redIndex ?? 7);
  let vtgMode = $state<VtgMode>(restored?.vtgMode ?? "SS");

  const blueFlower = $derived(MATRIX_AXIS[blueIndex] ?? MATRIX_AXIS[0]!);
  const redFlower = $derived(MATRIX_AXIS[redIndex] ?? MATRIX_AXIS[0]!);

  const cell = $derived(realizationToHands(blueFlower, redFlower, vtgMode));

  /*
   * Charlie's convention rather than the instrument's toggle: his rule reads
   * the tangent of the path the head actually traces, and an out-of-resolution
   * step is a real fact about a flower that the reader should see. Drex's rule
   * never returns `n`, which would quietly hide it.
   */
  const blueHand = $derived({
    knobs: cell.blue,
    increments: buildIncrements(cell.blue, convention),
    tone: "blue" as const,
  });
  const redHand = $derived({
    knobs: cell.red,
    increments: buildIncrements(cell.red, convention),
    tone: "red" as const,
  });
  const matrixHands = $derived([blueHand, redHand]);

  /* Short forms carry the row: six full "Split · Same" labels in one control
     is the kind of thing that stretches into a progress bar at 4K. */
  const MODE_OPTIONS = MODE_ORDER.map((m) => ({
    value: m,
    label: MODE_LABEL[m],
    shortLabel: m,
  }));

  const styleWord = (style: "pro" | "anti") =>
    style === "pro" ? "inspin" : "antispin";

  const instrumentName = $derived(
    pendulum
      ? { label: "Pendulum", provenance: "sourced" as const }
      : nameFor(knobs)
  );

  function openInstrument() {
    radius = move.knobs.radius;
    downbeats = move.knobs.downbeats;
    spin = move.knobs.spin;
    phase = move.knobs.phase ?? 0;
    pendulum = move.pendulum ?? false;
    appMode = "instrument";
  }

  function selectMove(i: number) {
    moveIndex = i;
    cursor = 0;
    scrubbing = false;
    appMode = "guide";
  }

  /*
   * Motion.
   *
   * A steady spin is genuinely constant-velocity — a prop mid-drill is not
   * accelerating, and easing inside each increment would put a stutter into
   * motion that does not have one, and would make the frame pairing look like a
   * machine tick. So the steady state stays linear on purpose.
   *
   * What has no business being instant is every TRANSITION between states:
   * pressing play, pressing pause, and scrubbing a step. Those were snaps. A
   * prop with mass spools up, coasts down, and slides to the increment you asked
   * for rather than teleporting there.
   *
   * Frame index stays locked to step index throughout, because none of this
   * touches how the cursor maps to a step — only how fast it gets there.
   */
  const STEP_MS = 1100;
  /** Time constant of the play/pause spool. Long enough to read as weight. */
  const RAMP_MS = 380;
  const SCRUB_MS = 340;

  const easeOut = (t: number) => 1 - (1 - t) ** 3;

  /* Non-reactive: written every frame, and nothing should re-render on them. */
  let velocity = 0;
  let scrubbing = false;
  let scrubFrom = 0;
  let scrubTo = 0;
  let scrubStart = 0;

  /** Drives the rAF loop's existence, so an idle page is not waking 60x/second. */
  let animating = $state(false);

  const reducedMotion = () =>
    typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;

  /**
   * Move the cursor by `delta` increments, animated.
   *
   * A fractional delta quantizes to its own grid, so repeated half-steps land
   * on .0 / .5 rather than drifting off wherever playback happened to be
   * paused. Half-steps are worth having here: an increment is a quarter of a
   * circle, and the midpoint of one is where the prop's direction reading is
   * easiest to see against the compass.
   */
  const step8 = (delta: number) => {
    playing = false;
    velocity = 0;
    const grid = Number.isInteger(delta) ? 1 : 2;
    const base = scrubbing ? scrubTo : Math.floor(cursor * grid) / grid;
    const target = base + delta;

    if (reducedMotion()) {
      cursor = target;
      scrubbing = false;
      return;
    }

    scrubFrom = cursor;
    scrubTo = target;
    scrubStart = performance.now();
    scrubbing = true;
    animating = true;
  };

  /**
   * Below this the notation collapses to the step on screen. Matched to where
   * eight rows of seven numbers stop being legible, not to a device.
   */
  let compact = $state(false);
  $effect(() => {
    const q = matchMedia("(max-width: 48rem), (max-height: 32rem)");
    const sync = () => (compact = q.matches);
    sync();
    q.addEventListener("change", sync);
    return () => q.removeEventListener("change", sync);
  });

  /**
   * Phones, by width alone — deliberately NOT `compact`.
   *
   * On a phone the controls move into a bottom dock and open over the stage.
   * Laid out in flow they cost more than the pane has: on an SE the matrix
   * mode's two flower axes, mode control and tables made the pane 3.8 screens
   * tall and left the stage — the entire subject — at 160×160.
   *
   * `compact` also fires on wide-and-short (fold landscape), and that tier has
   * the width to lay the same controls out flat, which it already does. Docking
   * there would trade a layout that works for one that hides things.
   */
  let phone = $state(false);
  $effect(() => {
    const q = matchMedia("(max-width: 48rem)");
    const sync = () => (phone = q.matches);
    sync();
    q.addEventListener("change", sync);
    return () => q.removeEventListener("change", sync);
  });

  /* Which dock tray is open, or null for a collapsed bar. */
  let dockTab = $state<string | null>(null);

  /**
   * The cosmic background and its theme, which this route now owns.
   *
   * It used to inherit both from MarketingChrome. Opting out of that to become
   * a full-screen app took the background with it and left the body's saved
   * theme showing through — a maroon page under a purple drawing. The theme
   * pipeline is what sets every `--theme-*` var the stage and the transport
   * read, so a standalone host has to run it itself (same as GuideShell).
   */
  type BackgroundHostComponent =
    (typeof import("$lib/shared/background/shared/components/BackgroundHost.svelte"))["default"];

  let LiveBackground = $state<BackgroundHostComponent | null>(null);

  $effect(() => {
    let mounted = true;
    /* After first paint: the animated canvas is an enhancement, and its
       renderer graph is large enough to delay the drawing if loaded eagerly. */
    const frame = requestAnimationFrame(() => {
      void import(
        "$lib/shared/background/shared/components/BackgroundHost.svelte"
      ).then(({ default: BackgroundHost }) => {
        if (mounted) LiveBackground = BackgroundHost;
      });
      void Promise.all([
        import("$lib/shared/settings/utils/background-theme-calculator"),
        import("@austencloud/backgrounds"),
      ]).then(([{ applyThemeForBackground }, { BackgroundType }]) => {
        if (mounted) applyThemeForBackground(BackgroundType.COSMIC);
      });
    });
    return () => {
      mounted = false;
      cancelAnimationFrame(frame);
    };
  });

  const LAYERS_TAB: ControlDockTab = {
    id: "layers",
    label: "Layers",
    icon: "fa-layer-group",
  };

  const CELL_TABS: ControlDockTab[] = [
    { id: "blue", label: "Blue", accentColor: "var(--dm-motion-blue, #3575E2)" },
    { id: "red", label: "Red", accentColor: "var(--dm-motion-red, #ED1C24)" },
    { id: "timing", label: "Timing", icon: "fa-arrows-left-right" },
    { id: "table", label: "Table", icon: "fa-table-list" },
    LAYERS_TAB,
  ];

  const INSTRUMENT_TABS: ControlDockTab[] = [
    { id: "knobs", label: "Knobs", icon: "fa-sliders" },
    { id: "table", label: "Table", icon: "fa-table-list" },
    LAYERS_TAB,
  ];

  /* The guide's controls ARE its eight moves, so they get a tray of their own
     rather than the horizontally-scrolling strip they were. */
  const GUIDE_TABS: ControlDockTab[] = [
    { id: "moves", label: "Moves", icon: "fa-list" },
    { id: "table", label: "Table", icon: "fa-table-list" },
    LAYERS_TAB,
  ];

  /* Guide · Knobs · Matrix. On a docked phone this takes the row the guide's
     move chips vacate, so "which mode" stays visible without costing a row. */
  const APP_MODE_OPTIONS = [
    { value: "guide" as const, label: "Guide" },
    { value: "instrument" as const, label: "Knobs" },
    { value: "matrix" as const, label: "Matrix" },
  ];

  function goToMode(next: AppMode) {
    if (next === "guide") selectMove(moveIndex);
    else if (next === "instrument") openInstrument();
    else appMode = "matrix";
  }

  const dockTabs = $derived(
    appMode === "matrix"
      ? CELL_TABS
      : appMode === "instrument"
        ? INSTRUMENT_TABS
        : GUIDE_TABS
  );

  /* Re-selecting the open tab closes it — the toggle every dock consumer owns. */
  const selectDockTab = (id: string) => {
    dockTab = dockTab === id ? null : id;
  };

  /* A tab that does not exist in the mode you just switched to cannot stay open. */
  $effect(() => {
    if (dockTab && !dockTabs.some((t) => t.id === dockTab)) dockTab = null;
  });

  const snapshot = (): QftSession => ({
    appMode,
    moveIndex,
    blueIndex,
    redIndex,
    vtgMode,
    radius,
    downbeats,
    spin,
    phase,
    pendulum,
    convention,
    /* Normalised: the raw cursor runs unbounded while playing and negative mid-scrub. */
    cursor: pos,
    playing,
    layers,
  });

  /*
   * Discrete state saves the moment it changes. Reading `cursor` here as well
   * would re-run this every animation frame, so the cursor is left to the
   * throttle below and picked up from the same snapshot.
   */
  $effect(() => {
    void [
      appMode,
      moveIndex,
      blueIndex,
      redIndex,
      vtgMode,
      radius,
      downbeats,
      spin,
      phase,
      pendulum,
      convention,
      playing,
      layers,
    ];
    saveQftSession(snapshot());
  });

  /*
   * The cursor moves 60 times a second, which is far too often to write. Twice
   * a second is close enough that a reload lands within a few degrees of where
   * you left off, and a final write on hide catches the common case of closing
   * or navigating away mid-cycle.
   */
  $effect(() => {
    const id = setInterval(() => saveQftSession(snapshot()), 500);
    const flush = () => saveQftSession(snapshot());
    addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      clearInterval(id);
      removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
      flush();
    };
  });

  /* Play is a request for motion; the loop below decides when motion is over. */
  $effect(() => {
    if (playing && reducedMotion()) {
      playing = false;
      return;
    }
    if (playing) animating = true;
  });

  $effect(() => {
    if (!animating) return;

    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      /* Clamped so a backgrounded tab does not resume by lurching forward. */
      const dt = Math.min(64, now - last);
      last = now;

      if (scrubbing) {
        const t = Math.min(1, (now - scrubStart) / SCRUB_MS);
        cursor = scrubFrom + (scrubTo - scrubFrom) * easeOut(t);
        if (t >= 1) {
          cursor = scrubTo;
          scrubbing = false;
        }
      } else {
        const target = playing ? 1 : 0;
        /*
         * Exponential approach rather than a fixed ramp: the spool-up reads the
         * same whether it starts from rest or from a half-slowed coast, which a
         * timed ramp cannot do without tracking where it was interrupted.
         */
        velocity += (target - velocity) * Math.min(1, dt / RAMP_MS);
        if (velocity < 0.001 && !playing) {
          velocity = 0;
          animating = false;
          return;
        }
        cursor += (velocity * dt) / STEP_MS;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });

  const DOWNBEAT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
    value: String(n),
    label: String(n),
    ariaLabel: `${n} prop rotation${n === 1 ? "" : "s"} per hand rotation`,
  }));

  const SPIN_OPTIONS: Array<{ value: Spin; label: string }> = [
    { value: "inspin", label: "Inspin" },
    { value: "antispin", label: "Antispin" },
  ];

  const CONVENTION_OPTIONS: Array<{ value: Convention; label: string }> = [
    { value: "charlie", label: "Charlie" },
    { value: "drex", label: "Drex" },
  ];
</script>

<svelte:head>
  <title>QfT Notation — Flow Arts Composer</title>
  <meta
    name="description"
    content="Charlie Cushing's 2011 poi notation, written up by Drex, running beside a model that computes the same moves from the published rules."
  />
</svelte:head>

<!--
  The control groups, defined once.

  Each is rendered either in the reading column (wide) or inside the dock's
  tray (phone). Writing them twice is how the two paths would drift, and these
  are the controls the whole mode is made of.
-->
{#snippet cellBlue()}
  <QftFlowerPicker
    label="Blue hand"
    flowers={MATRIX_AXIS}
    value={blueIndex}
    onchange={(i) => (blueIndex = i)}
    tone="blue"
  />
{/snippet}

{#snippet cellRed()}
  <QftFlowerPicker
    label="Red hand"
    flowers={MATRIX_AXIS}
    value={redIndex}
    onchange={(i) => (redIndex = i)}
    tone="red"
  />
{/snippet}

{#snippet cellTiming()}
  <div class="knob">
    <span class="knob-label" id="vtg-label">Timing and direction</span>
    <div class="fit">
      <SegmentedControl
        options={MODE_OPTIONS}
        value={vtgMode}
        onchange={(v) => (vtgMode = v)}
        size="sm"
        ariaLabelledby="vtg-label"
      />
    </div>
  </div>
{/snippet}

<!--
  Two tables, because a cell is two hands and QfT reads one hand at a time.
  Side by side once the column can hold both, stacked before that.
-->
{#snippet cellTable()}
  <div class="notation duet">
    <div class="hand-table" data-tone="blue">
      <span class="hand-name">Blue</span>
      <QftTable increments={blueHand.increments} activeStep={step} {compact} />
    </div>
    <div class="hand-table" data-tone="red">
      <span class="hand-name">Red</span>
      <QftTable increments={redHand.increments} activeStep={step} {compact} />
    </div>
  </div>
{/snippet}

{#snippet instrumentKnobs()}
  <!--
    Paired at wide sizes. Stacked, the four control groups plus the notation
    are taller than a 1000px-high window can hold, and the table lost its last
    row off the bottom.
  -->
  <div class="knob-pair">
    <label class="knob" for="radius">
      <span class="knob-label">Hand path radius</span>
      <input
        id="radius"
        type="range"
        min="0"
        max="1.5"
        step="0.05"
        bind:value={radius}
        oninput={() => (pendulum = false)}
      />
    </label>

    <div class="knob">
      <span class="knob-label" id="downbeats-label"
        >Prop rotations per hand rotation</span
      >
      <div class="fit">
        <SegmentedControl
          options={DOWNBEAT_OPTIONS}
          value={String(downbeats)}
          onchange={(v) => {
            downbeats = Number(v);
            pendulum = false;
          }}
          size="sm"
          ariaLabelledby="downbeats-label"
        />
      </div>
    </div>
  </div>

  <div class="knob-row">
    <div class="knob">
      <span class="knob-label" id="spin-label">Direction</span>
      <div class="fit">
        <SegmentedControl
          options={SPIN_OPTIONS}
          value={spin}
          onchange={(v) => {
            spin = v;
            pendulum = false;
          }}
          size="sm"
          ariaLabelledby="spin-label"
        />
      </div>
    </div>

    <div class="knob">
      <span class="knob-label" id="convention-label">Direction convention</span>
      <div class="fit">
        <SegmentedControl
          options={CONVENTION_OPTIONS}
          value={convention}
          onchange={(v) => (convention = v)}
          size="sm"
          ariaLabelledby="convention-label"
        />
      </div>
    </div>
  </div>
{/snippet}

{#snippet instrumentTable()}
  <div class="notation">
    <QftTable increments={instrumentIncrements} activeStep={step} {compact} />
  </div>
{/snippet}

<!--
  The transport, shared by every mode and both layouts.

  HorizontalTransportRow is the app's own — the same control the sequence
  viewer runs, down to the play/pause glyph crossfade — rather than a second
  set of buttons that does the same job in a different shape. Its half-step
  chevrons map onto QfT cleanly: an increment is a quarter circle, and the
  midpoint is where the direction reading is easiest to check.
-->
{#snippet transportRow()}
  <div class="transport">
    <span class="counter">{step + 1} / 8</span>
    <HorizontalTransportRow
      isPlaying={playing}
      onPlaybackToggle={() => (playing = !playing)}
      onStepHalfBack={() => step8(-0.5)}
      onStepHalfFwd={() => step8(0.5)}
      onStepFullBack={() => step8(-1)}
      onStepFullFwd={() => step8(1)}
    />
  </div>
{/snippet}

{#snippet dockTray()}
  <div class="tray">
    {#if dockTab === "blue"}{@render cellBlue()}
    {:else if dockTab === "red"}{@render cellRed()}
    {:else if dockTab === "timing"}{@render cellTiming()}
    {:else if dockTab === "knobs"}{@render instrumentKnobs()}
    {:else if dockTab === "moves"}{@render moveList()}
    {:else if dockTab === "table"}
      {#if appMode === "matrix"}
        {@render cellTable()}
      {:else if appMode === "instrument"}
        {@render instrumentTable()}
      {:else}
        <div class="notation">
          <QftTable increments={guideIncrements} activeStep={step} {compact} />
        </div>
      {/if}
    {:else if dockTab === "layers"}{@render layerSwitches()}
    {/if}
  </div>
{/snippet}

<!--
  The eight canonical moves. A tray rather than the row they used to be: at
  375px that row scrolled sideways and showed four and a half of them, which
  is no way to offer a list of eight.
-->
{#snippet moveList()}
  <div class="move-list">
    {#each GUIDE_MOVES as m, i (m.id)}
      <button
        type="button"
        class="move"
        class:active={appMode === "guide" && i === moveIndex}
        onclick={() => {
          selectMove(i);
          dockTab = null;
        }}
      >
        <span class="move-title">{m.title}</span>
        <span class="move-spec">{m.spec}</span>
      </button>
    {/each}
    <button
      type="button"
      class="move archive"
      onclick={() => {
        showArchive = true;
        dockTab = null;
      }}
    >
      <span class="move-title">See the 2011 diagram</span>
      <span class="move-spec">The published animation for this move</span>
    </button>
  </div>
{/snippet}

<!--
  Layers. Independent switches, so toggle chips rather than a segmented
  control (.claude/rules/chip-primitives.md).
-->
{#snippet layerSwitches()}
  <nav class="layers" aria-label="Stage layers">
    {#each LAYER_KEYS as key (key)}
      <FilterChipBase
        label={LAYER_LABELS[key]}
        mode="toggle"
        size="sm"
        active={layers[key]}
        onclick={() => toggleLayer(key)}
      />
    {/each}
  </nav>
{/snippet}

<!-- The CSS cosmos paints immediately; the animated canvas swaps in after. -->
<div class="cosmos" aria-hidden="true">
  {#if LiveBackground}
    {@const Background = LiveBackground}
    <Background />
  {/if}
</div>

<div class="app" class:docked={phone}>
  <!--
    Toggles rather than a SegmentedControl: in instrument mode NO move is
    selected, and a segmented indicator has nowhere to sit in that state
    (.claude/rules/chip-primitives.md, the "at most one" case). Solid emphasis
    because the selected move is a hard selection, not a filter that is merely
    switched on.
  -->
  <!--
    The app's own top bar, since this route no longer carries the site header.

    One row, three jobs: the way back out, which mode you are in, and the
    colophon. The mode switch lives HERE rather than in the transport because
    changing mode is not a transport action — and entering a mode from a button
    at the bottom of the page, below the controls of the mode you were already
    in, was the thing that read as backwards.
  -->
  <div class="topbar">
    <a class="exit" href="/notation" aria-label="Leave the QfT app">
      <i class="fas fa-chevron-left" aria-hidden="true"></i>
    </a>

    <SegmentedControl
      options={APP_MODE_OPTIONS}
      value={appMode}
      onchange={goToMode}
      size="sm"
      ariaLabel="Mode"
    />

    <button
      type="button"
      class="about"
      onclick={() => (showInfo = true)}
      aria-label="About QfT">?</button
    >
  </div>

  {#if !phone && appMode === "guide"}
    <nav class="chips" aria-label="Moves">
      {#each GUIDE_MOVES as m, i (m.id)}
        <FilterChipBase
          label={m.title}
          mode="toggle"
          emphasis="solid"
          size="sm"
          active={i === moveIndex}
          onclick={() => selectMove(i)}
        />
      {/each}
    </nav>
  {/if}

  <main class="surface">
    <Crossfade key={appMode === "guide" ? move.id : appMode} fill>
      {#if appMode === "matrix"}
        <!--
          A shape-matrix cell, read as QfT.

          Same layout as the instrument — header, stage, controls — because it
          is the same kind of surface and the 4K composition is already tuned
          for that shape. What changes is what the knobs are: instead of four
          free parameters, two flowers off the matrix axis and the VTG mode
          that relates them.
        -->
        <div class="instrument cell">
          <header>
            <h2>
              {ratioLabel(blueFlower.turns)} × {ratioLabel(redFlower.turns)}
            </h2>
            <p class="spec">
              {MODE_LABEL[vtgMode]} · {blueFlower.petals}-petal {styleWord(
                blueFlower.style
              )} and {redFlower.petals}-petal {styleWord(redFlower.style)}
            </p>
          </header>

          <div class="stage-box">
            <QftStage hands={matrixHands} cursor={pos} {layers} />
          </div>

          {#if !phone}
            <div class="knobs">
              {@render cellBlue()}
              {@render cellRed()}
              {@render cellTiming()}
              {@render cellTable()}
            </div>
          {/if}
        </div>
      {:else if appMode === "guide"}
        <QftGuidePane
          {move}
          increments={guideIncrements}
          cursor={pos}
          {compact}
          {layers}
          showNotation={!phone}
          onShowArchive={() => (showArchive = true)}
        />
      {:else}
        <div class="instrument">
          <header>
            <h2>{instrumentName.label}</h2>
            <p class="spec">
              {radius.toFixed(2)} prop lengths · {downbeats} prop rotation{downbeats ===
              1
                ? ""
                : "s"} per hand rotation
            </p>
          </header>

          <div class="stage-box">
            <QftStage
              {knobs}
              increments={instrumentIncrements}
              cursor={pos}
              {pendulum}
              {layers}
            />
          </div>

          {#if !phone}
            <div class="knobs">
              {@render instrumentKnobs()}
              {@render instrumentTable()}
            </div>
          {/if}
        </div>
      {/if}
    </Crossfade>

    <!--
      One piece of bottom chrome, edge to edge, holding the transport and the
      dock together.

      It is anchored to the bottom of the stage's own box and overlays it, so
      the drawing never resizes when a tray opens — the failure the previous
      in-flow version had, where opening Knobs shrank the stage to 123px
      exactly while you drag a radius slider whose purpose is to change the
      thing you can then no longer see.

      Transport above the tabs, because the transport is always live and the
      tabs are a drawer handle. Every mode gets the same one, including the
      guide: its eight moves are a tray like everything else now.
    -->
    {#if phone}
      <div class="bottom-chrome">
        {@render transportRow()}
        <ControlDock
          tabs={dockTabs}
          activeTab={dockTab}
          onTabSelect={selectDockTab}
          tray={dockTray}
          labelMinWidth={0}
          trayMaxHeight="42vh"
        />
      </div>
    {/if}
  </main>

  <!--
    Wide screens keep the layer switches and the transport as their own rows
    under the stage: there is room, and a control you can see is better than
    one you have to open. The phone gets both inside the dock instead.
  -->
  {#if !phone}
    <div class="layers-row">{@render layerSwitches()}</div>
    {@render transportRow()}
  {/if}
</div>

{#if showArchive}
  <!--
    The archive view. All eight animations as published, running off the same
    step as the stage behind it, with the rendering toggle and the source.
    They are not the page's subject any more, but they are still restored, still
    sourced, and still one click away — which is the whole reason this page
    exists.
  -->
  <div
    class="scrim"
    role="button"
    tabindex="0"
    aria-label="Close"
    onclick={() => (showArchive = false)}
    onkeydown={(e) => e.key === "Escape" && (showArchive = false)}
  ></div>
  <aside class="archive-panel" aria-label="The 2011 diagrams">
    <header class="archive-head">
      <div>
        <h2>The 2011 diagrams</h2>
        <p class="archive-note">
          By Drex, from <a
            href="https://drexfactor.com/weirdscience/2011/05/18/beginners_guide_poi_qft_notation"
            rel="noreferrer"
            target="_blank">A Beginner's Guide to Prop QFT Notation</a
          >, where they are still served. The forum copy of the same post lost
          every image.
        </p>
      </div>
      <div class="archive-controls">
        <button
          type="button"
          class="close"
          onclick={() => (showArchive = false)}>Close</button
        >
      </div>
    </header>

    <div class="archive-grid">
      {#each GUIDE_MOVES as m (m.id)}
        <figure class:current={m.id === move.id}>
          <div class="archive-box" style={`--aspect: ${m.aspect}`}>
            <QftFrames
              stem={m.stem}
              {step}
              alt={`${m.title}, as published in Drex's 2011 guide`}
            />
          </div>
          <figcaption>{m.title}</figcaption>
        </figure>
      {/each}
    </div>
  </aside>
{/if}

{#if showInfo}
  <div
    class="scrim"
    role="button"
    tabindex="0"
    aria-label="Close"
    onclick={() => (showInfo = false)}
    onkeydown={(e) => e.key === "Escape" && (showInfo = false)}
  ></div>
  <aside class="info-panel" aria-label="About QfT notation">
    <h2>QfT Notation</h2>
    <p>
      A poi notation devised by Charlie Cushing and written up by Ben
      "DrexFactor" Drexler in 2011. The guide was posted to the Home of Poi
      forum and to Drex's blog. The forum's copy has since lost every image; the
      blog still serves them. Each move here runs against a model that computes
      the same move from the published rules.
    </p>
    <p class="note">
      The article credits Charlie with devising the system and does not say who
      drew the diagrams, so they are attributed to the guide rather than to a
      person.
    </p>

    <h3>Sources</h3>
    <ul class="sources">
      {#each SOURCES as s (s.href)}
        <li><a href={s.href} rel="noreferrer" target="_blank">{s.label}</a></li>
      {/each}
    </ul>

    <h3>Dates</h3>
    <ol class="timeline">
      {#each TIMELINE as t (t.when)}
        <li><span class="when">{t.when}</span><span>{t.what}</span></li>
      {/each}
    </ol>

    <p class="note">
      As published, the direction column has two variants: Charlie's, in which a
      direction that does not land on the eight-point compass is written <em
        >n</em
      >, and Drex's, in which direction is always a right angle to the tether
      and every cell resolves. The guide uses Drex's; the instrument offers
      both.
    </p>

    <button type="button" class="close" onclick={() => (showInfo = false)}
      >Close</button
    >
  </aside>
{/if}

<style>
  /*
   * An app, not a page. Fixed to the viewport with no scroll, so a reader is
   * always looking at one whole concept rather than the tail of one and the
   * head of the next.
   */
  /*
   * The site header is fixed and overlays the top of the viewport, so the app
   * subtracts it rather than assuming the full screen — otherwise the move
   * chips sit underneath it and the page gains a scrollbar it should not have.
   */
  /*
   * Behind everything, and fixed so it never scrolls with a tray. The gradient
   * is the same cosmos the marketing chrome paints, so leaving that shell does
   * not change what the app looks like — only what wraps it.
   */
  /* z-index 0, not -1: negative would put it behind the BODY's own saved-theme
     gradient, which is what left a maroon page under a purple drawing. */
  .cosmos {
    position: fixed;
    inset: 0;
    z-index: 0;
    background:
      radial-gradient(
        ellipse at 50% 0%,
        rgb(46 26 84 / 0.55) 0%,
        transparent 60%
      ),
      linear-gradient(180deg, #0b0a1a 0%, #10142e 45%, #0a1024 100%);
  }

  .app {
    /*
     * The whole viewport. This route opts out of the marketing chrome (see
     * MARKETING_EXCLUDE in src/routes/+layout.svelte), so there is no site
     * header to sit under — the app's own top bar carries the way back out.
     */
    --app-pad: clamp(0.75rem, 2vw, 2rem);
    height: 100dvh;
    position: relative;
    z-index: 1;
    display: grid;
    /*
     * Named, not positional. Two of these children come and go — the chips row
     * hides on a docked phone, the dock only exists there — and with rows
     * assigned by order, hiding the chips slid every child up one: the surface
     * inherited `auto`, collapsed to nothing against Crossfade's absolutely
     * positioned layers, and the dock inherited the `1fr` meant for the stage.
     */
    grid-template-rows: auto auto minmax(0, 1fr) auto auto;
    grid-template-areas:
      "topbar"
      "chips"
      "surface"
      "layers"
      "transport";
    gap: clamp(0.5rem, 1.5vh, 1.25rem);
    padding: clamp(0.5rem, 1.5vh, 1.25rem) var(--app-pad);
    overflow: hidden;
  }

  /*
   * The app's own header. Back / mode / colophon, with the mode switch centred
   * against the two icon buttons rather than pushed off-centre by them.
   */
  .topbar {
    grid-area: topbar;
    display: grid;
    grid-template-columns: 2.75rem minmax(0, 1fr) 2.75rem;
    align-items: center;
    gap: 0.5rem;
  }

  /*
   * `width: auto` as well as the centring. SegmentedControl sets `width: 100%`
   * on itself, and a grid item's `justify-self: center` cannot beat an explicit
   * width — three short labels stretched across 1300px of a 1440 screen, which
   * is the progress-bar failure `visual-verification-mandatory.md` is about.
   */
  .topbar :global(> :nth-child(2)) {
    justify-self: center;
    width: auto;
    max-width: 100%;
    min-width: 0;
  }

  .exit,
  .about {
    display: flex;
    align-items: center;
    justify-content: center;
    /* Touch-target floor, per the design system. */
    width: 2.75rem;
    height: 2.75rem;
    border-radius: 50%;
    border: 1px solid var(--semantic-border, rgb(255 255 255 / 0.2));
    background: var(--semantic-surface-raised, rgb(0 0 0 / 0.28));
    color: var(--semantic-text-secondary, rgb(255 255 255 / 0.75));
    font-size: 1rem;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    transition:
      border-color 140ms ease,
      color 140ms ease;
  }

  .exit:hover,
  .about:hover {
    border-color: var(--semantic-border-strong, rgb(255 255 255 / 0.4));
    color: var(--semantic-text-primary, #fff);
  }

  /*
   * One piece of bottom chrome, edge to edge — the negative inline margin
   * escapes the app's own padding so it meets both sides of the screen rather
   * than floating as an island with the page visible either side of it.
   */
  .bottom-chrome {
    position: absolute;
    left: calc(-1 * var(--app-pad));
    right: calc(-1 * var(--app-pad));
    bottom: calc(-1 * var(--app-pad));
    display: grid;
    gap: 0.5rem;
    padding-bottom: env(safe-area-inset-bottom, 0px);
    /*
     * Opaque, with only a short fade at the very top. A percentage-based fade
     * looked right with the tray shut and fell apart with it open: the chrome
     * grows to half the screen, so 18% of it left the transport sitting on
     * bare stage with a transparent gap under it, reading as a floating card
     * rather than as the bottom of the app.
     */
    background: linear-gradient(
      to bottom,
      transparent 0,
      rgb(8 10 24 / 0.92) 1.5rem,
      rgb(8 10 24 / 0.96) 100%
    );
  }

  .bottom-chrome .transport {
    padding-inline: var(--app-pad);
  }

  /*
   * The eight moves as a tray list. Two lines each, because the spec line is
   * what tells them apart — the titles alone ("Extension", "Isolation") are
   * names you have to already know.
   */
  .move-list {
    display: grid;
    gap: 0.4rem;
  }

  .move {
    display: grid;
    gap: 0.1rem;
    text-align: left;
    min-height: 44px;
    padding: 0.5rem 0.75rem;
    border-radius: 0.6rem;
    border: 1px solid var(--semantic-border, rgb(255 255 255 / 0.16));
    background: var(--semantic-surface-raised, rgb(0 0 0 / 0.22));
    color: var(--semantic-text-secondary, rgb(255 255 255 / 0.72));
    cursor: pointer;
  }

  .move.active {
    border-color: var(--theme-accent, #8b5cf6);
    background: color-mix(in srgb, var(--theme-accent, #8b5cf6) 20%, transparent);
    color: var(--semantic-text-primary, #fff);
  }

  .move-title {
    font-size: 0.92rem;
    font-weight: 600;
  }

  .move-spec {
    font-size: 0.74rem;
    opacity: 0.7;
    font-variant-numeric: tabular-nums;
  }

  .move.archive {
    margin-top: 0.35rem;
    border-style: dashed;
  }

  .chips {
    grid-area: chips;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
  }

  .surface {
    grid-area: surface;
    position: relative;
    min-height: 0;
  }

  /*
   * Room for the collapsed bottom chrome — transport plus tab bar — so the
   * drawing is never underneath it. A constant rather than the dock's measured
   * height: measured, the reserve would grow with the open tray and shrink the
   * stage again, which is the thing overlaying the chrome was meant to stop.
   */
  .app.docked .surface {
    padding-bottom: 11.5rem;
  }

  /*
   * A pill, because it sits above the chrome's own background and over the
   * drawing. Tabular so the digits do not jitter as the step advances
   * (.claude/rules/no-layout-shift.md).
   */
  .bottom-chrome .counter {
    justify-self: center;
    padding: 0.1rem 0.6rem;
    border-radius: 999px;
    background: rgb(0 0 0 / 0.55);
  }

  /*
   * The dock's tray holds one control group at a time, so it gets the room the
   * flat layout could not give it: a flower axis opens three across at a size
   * you can actually hit, instead of twelve chips crushed into a phone width.
   */
  .tray {
    display: grid;
    gap: 0.75rem;
    padding: 0.25rem 0.1rem 0.5rem;
  }

  /*
   * With the controls in the dock there is nothing under the stage, so the
   * stage takes the pane instead of sitting at a fixed 24vh in the middle of
   * it. On an SE that is the difference between 160×160 and filling the width.
   *
   * `aspect-ratio: auto` because the box no longer needs to be square: the
   * SVG's own viewBox letterboxes the drawing inside whatever shape it gets.
   */
  .app.docked .instrument {
    justify-content: flex-start;
    overflow: hidden;
  }

  .app.docked .stage-box {
    flex: 1 1 auto;
    height: auto;
    min-height: 0;
    width: 100%;
    aspect-ratio: auto;
  }

  .instrument {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    /*
     * `safe`, and scrollable. Four controls and the notation are taller than a
     * 900px-high pane, and plain centring clips a too-tall child at BOTH ends
     * with no way to reach either — the title went under the move chips and the
     * last row of the table under the layer switches.
     */
    justify-content: safe center;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: none;
    gap: clamp(0.75rem, 2vh, 1.5rem);
    /* Sized off the viewport's height, like the guide's figure, so the stage
       grows with the screen instead of sitting at one fixed size in a large
       dark field (.claude/rules/4k-native-layout.md). */
    --box-h: clamp(9rem, 30vh, 22rem);
  }

  .instrument header {
    text-align: center;
  }

  .instrument h2 {
    margin: 0;
    font-size: clamp(1.3rem, 1rem + 1.1vw, 2.2rem);
    font-weight: 600;
  }

  .spec {
    margin: 0.4rem 0 0;
    font-size: 0.85rem;
    color: var(--semantic-text-secondary, rgb(255 255 255 / 0.6));
    font-variant-numeric: tabular-nums;
  }

  .stage-box {
    height: var(--box-h);
    aspect-ratio: 1;
  }

  .knobs {
    display: grid;
    gap: clamp(0.6rem, 1.5vh, 1.1rem);
    width: min(100%, 42rem);
  }

  .knob-label {
    display: block;
    margin-bottom: 0.35rem;
    font-size: 0.82rem;
    color: var(--semantic-text-secondary, rgb(255 255 255 / 0.62));
  }

  /* Stacked by default; side by side once there is width for it. */
  .knob-pair {
    display: grid;
    gap: clamp(0.6rem, 1.5vh, 1.1rem);
  }

  .knob-row {
    display: grid;
    grid-template-columns: repeat(2, auto);
    justify-content: start;
    gap: 1.5rem;
  }

  /*
   * SegmentedControl sets width: 100% internally, which defeats a consumer's
   * flex sizing — a row of short labels otherwise stretches across the panel.
   */
  .fit {
    display: inline-flex;
    align-self: flex-start;
  }

  /*
   * The one native control on the page, and it looked it — a default slider
   * next to a row of segmented controls reads as a different decade. Track and
   * thumb are drawn from the same tokens as everything else, and the width is
   * capped so it stops spanning the whole panel for a 0–1.5 range.
   */
  input[type="range"] {
    width: min(100%, 26rem);
    height: 44px; /* touch-target floor; the visible track is the ::-thumb/track */
    margin: 0;
    background: transparent;
    appearance: none;
    cursor: pointer;
  }

  input[type="range"]::-webkit-slider-runnable-track {
    height: 0.35rem;
    border-radius: 999px;
    background: var(--semantic-surface-raised, rgb(255 255 255 / 0.14));
    border: 1px solid var(--semantic-border-subtle, rgb(255 255 255 / 0.14));
  }

  input[type="range"]::-moz-range-track {
    height: 0.35rem;
    border-radius: 999px;
    background: var(--semantic-surface-raised, rgb(255 255 255 / 0.14));
    border: 1px solid var(--semantic-border-subtle, rgb(255 255 255 / 0.14));
  }

  input[type="range"]::-webkit-slider-thumb {
    appearance: none;
    width: 1.1rem;
    height: 1.1rem;
    margin-top: calc((0.35rem - 1.1rem) / 2);
    border-radius: 50%;
    background: var(--theme-accent, #8b5cf6);
    border: 2px solid var(--semantic-text-primary, #fff);
  }

  input[type="range"]::-moz-range-thumb {
    width: 1.1rem;
    height: 1.1rem;
    border-radius: 50%;
    background: var(--theme-accent, #8b5cf6);
    border: 2px solid var(--semantic-text-primary, #fff);
  }

  input[type="range"]:focus-visible {
    outline: 2px solid var(--theme-accent, #8b5cf6);
    outline-offset: 3px;
    border-radius: 0.4rem;
  }

  .notation {
    width: 100%;
  }

  /*
   * A cell's two tables. Side by side once both genuinely fit, stacked before
   * that — each is seven numeric columns, and two of them squeezed into one
   * reading column makes both unreadable rather than one.
   *
   * A container query, not a media query. The tables care about the width of
   * the COLUMN they sit in, and that column is `clamp(26rem, 32vw, 46rem)` —
   * a fraction of the viewport that varies by tier. Keyed to viewport width
   * this went two-up at 1440, where the column is only 430px, and the tables
   * came out ~200px each: the RADIUS and ARRIVE headers collided and the last
   * column was clipped to "Pro".
   */
  .notation.duet {
    display: grid;
    gap: clamp(0.6rem, 1.6vh, 1.1rem);
  }

  @container cell-knobs (min-width: 40rem) {
    .notation.duet {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: clamp(0.8rem, 2vw, 2rem);
    }
  }

  /* The measure the duet above is keyed to. */
  .instrument.cell .knobs {
    container-type: inline-size;
    container-name: cell-knobs;
  }

  .hand-table {
    display: grid;
    gap: 0.3rem;
    min-width: 0;
  }

  .hand-name {
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: var(--dm-motion-blue, #3575e2);
  }

  .hand-table[data-tone="red"] .hand-name {
    color: var(--dm-motion-red, #ed1c24);
  }

  /*
   * The cell pane runs its reading column tighter than the instrument's.
   *
   * It carries two flower axes, a mode control and TWO eight-row tables where
   * the instrument carries four controls and one table, and at the instrument's
   * spacing that column overran the pane — putting the notation, on a page
   * about notation, below the fold. The stage is untouched: it was never the
   * thing that did not fit.
   */
  @media (min-width: 90rem) and (min-height: 45rem) {
    .instrument.cell {
      row-gap: clamp(0.6rem, 1.4vh, 1.25rem);
      /*
       * Wider than the guide's and the instrument's column, deliberately.
       *
       * Those two carry one table; this carries two, side by side, and at the
       * shared 32vw/46rem the column could not fit them — so they stacked and
       * the pane scrolled past a screen and a half. The extra width buys the
       * side-by-side back, and it also closes most of the dead rail this tier
       * left at 4K, where 32vw capped at 46rem and the whole app sat as a
       * band in the middle of the screen.
       *
       * The three modes no longer share a column width, so they no longer stay
       * registered across the crossfade. That is the right trade: a mode that
       * has twice the notation to show should not be held to the width of one
       * that does not.
       */
      grid-template-columns: auto clamp(26rem, 46vw, 74rem);
    }

    .instrument.cell .knobs {
      gap: clamp(0.4rem, 1vh, 0.7rem);
    }

    .instrument.cell h2 {
      font-size: clamp(1.8rem, 1rem + 1.9vw, 3.6rem);
    }
  }

  /*
   * Wide and short — fold-open landscape, a squashed laptop window.
   *
   * The pane is about 220px tall here. Two flower axes, a mode control and two
   * eight-row tables do not go into that, and the tables are the part that
   * stops being readable first: eight rows of seven numbers at this height is
   * not notation anyone can use. So the cell keeps what this size can actually
   * serve — the stage and the two choices that drive it — and the tables come
   * back the moment there is room. Same call the guide makes with its quote at
   * this tier.
   *
   * Revisit when the controls move into a bottom dock: a picker that opens
   * over the stage would give the notation its height back.
   */
  @media (min-width: 44rem) and (max-height: 32rem) {
    .instrument.cell .notation.duet {
      display: none;
    }

    /*
     * Both axes on one row, using width this tier had spare — the shared
     * two-column tier left ~380px of the viewport unused while the controls
     * ran off the bottom of a 220px pane. Trading the horizontal it has for
     * the vertical it does not.
     */
    .instrument.cell {
      grid-template-columns: auto minmax(0, 1fr);
    }

    .instrument.cell .knobs {
      grid-template-columns: 1fr 1fr;
      column-gap: clamp(0.75rem, 2vw, 1.5rem);
    }

    .instrument.cell .knob {
      grid-column: 1 / -1;
    }

    /* The petal counts are on the chips; the sentence restating them is not
       worth a row of a pane this short. */
    .instrument.cell .spec {
      display: none;
    }
  }

  /*
   * Wide screens: the same arrangement the guide uses, for the same reasons.
   * The stage anchors the left at whatever height the viewport can give it, the
   * title opens the column you read, and the knobs and the notation stack under
   * it. The previous version centred a title band over a small stage and a much
   * larger table, which at 4K read as a phone layout dropped into the middle of
   * a monitor.
   */
  @media (min-width: 90rem) and (min-height: 45rem) {
    .instrument {
      /* Ceiling deliberately above any real screen, so the viewport governs and
         the stage keeps growing rather than capping out at 4K. */
      --box-h: clamp(16rem, 54vh, 64rem);
      display: grid;
      /*
       * The ceiling is generous on purpose. rem already ramps with the viewport
       * on this route, so a 38rem cap still left roughly 1100px of dead rail on
       * either side at 3840 — the band has to grow with the screen, not just
       * the type inside it (.claude/rules/4k-native-layout.md).
       */
      grid-template-columns: auto clamp(26rem, 32vw, 46rem);
      grid-template-areas: "stage head" "stage knobs";
      grid-template-rows: auto auto;
      align-content: safe center;
      justify-content: center;
      column-gap: clamp(2rem, 4vw, 5rem);
      row-gap: clamp(1rem, 2.5vh, 2rem);
    }

    .instrument header {
      grid-area: head;
      text-align: left;
      align-self: end;
    }

    .instrument h2 {
      font-size: clamp(2rem, 1.1rem + 2.2vw, 4.2rem);
      line-height: 1.02;
    }

    .spec {
      font-size: 0.95rem;
    }

    .stage-box {
      grid-area: stage;
      align-self: center;
    }

    .knobs {
      grid-area: knobs;
      align-self: start;
      width: auto;
    }

    .knob-pair {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: end;
      column-gap: clamp(1.5rem, 2.5vw, 3rem);
    }
  }

  .layers-row {
    grid-area: layers;
    min-width: 0;
  }

  .layers {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
  }

  /* Only the wide layout's copy is a grid child; the phone's lives in the
     bottom chrome, which places it itself. */
  .app > .transport {
    grid-area: transport;
  }

  .transport {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .transport button {
    min-height: 44px;
    min-width: 44px;
    padding-inline: 0.9rem;
    border-radius: 0.6rem;
    border: 1px solid var(--semantic-border, rgb(255 255 255 / 0.22));
    background: var(--semantic-surface-raised, rgb(0 0 0 / 0.24));
    color: var(--semantic-text-primary, rgb(255 255 255 / 0.9));
    font-size: 0.9rem;
    cursor: pointer;
  }

  .transport button:hover {
    border-color: var(--semantic-border-strong, rgb(255 255 255 / 0.4));
  }

  .counter {
    min-width: 4ch;
    text-align: center;
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
    color: var(--semantic-text-secondary, rgb(255 255 255 / 0.6));
  }

  .scrim {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.55);
    border: 0;
    z-index: 40;
  }

  /*
   * A sheet rather than the About panel's side drawer: eleven drawings of very
   * different proportions need the width, and at 4K a 34rem rail would show
   * them as thumbnails in a column.
   */
  .archive-panel {
    position: fixed;
    inset: 0;
    z-index: 41;
    overflow-y: auto;
    /* Clears the fixed site header, which paints above this panel. */
    padding: calc(65px + clamp(1.25rem, 3vh, 2.5rem)) clamp(1.25rem, 4vw, 4rem)
      clamp(1.25rem, 3vh, 2.5rem);
    background: var(--semantic-surface, #14162b);
  }

  .archive-head {
    display: flex;
    flex-wrap: wrap;
    align-items: start;
    justify-content: space-between;
    gap: 1rem 2rem;
    max-width: var(--shell-w, min(1720px, 92vw));
    margin: 0 auto 1.75rem;
  }

  .archive-head h2 {
    margin: 0 0 0.4rem;
    font-size: clamp(1.4rem, 1rem + 1vw, 2.4rem);
  }

  /*
   * No reading cap. A 46rem measure broke this two-sentence credit line mid
   * phrase with most of the row still empty beside it
   * (memory: feedback_no_text_max_width).
   */
  .archive-note {
    margin: 0;
    font-size: 0.85rem;
    line-height: 1.55;
    color: var(--semantic-text-secondary, rgb(255 255 255 / 0.68));
  }

  .archive-note a {
    color: var(--theme-accent, #8b5cf6);
  }

  .archive-controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .archive-controls .close {
    margin-top: 0;
  }

  .fit {
    display: inline-flex;
  }

  .fit :global(button) {
    white-space: nowrap;
  }

  /*
   * A pinned count per tier rather than auto-fill, so the last row is never a
   * single orphan (.claude/rules/4k-native-layout.md). Eight items: 2 and 4
   * divide evenly, 3 leaves two on the last row, which is fine — never one.
   */
  .archive-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    /* Plates are different heights now; they hang from a shared top edge. */
    align-items: start;
    gap: clamp(1rem, 2vw, 2rem);
    max-width: var(--shell-w, min(1720px, 92vw));
    margin: 0 auto;
  }

  @media (min-width: 48rem) {
    .archive-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (min-width: 80rem) {
    .archive-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  .archive-grid figure {
    margin: 0;
  }

  /*
   * No height: the plate is as tall as its drawing. These are archival
   * materials of eight different shapes, and a single fixed box turned most of
   * them into a small figure adrift in white.
   */
  .archive-box {
    display: block;
  }

  .archive-grid figcaption {
    margin-top: 0.6rem;
    text-align: center;
    font-size: 0.82rem;
    color: var(--semantic-text-secondary, rgb(255 255 255 / 0.6));
  }

  /* The move the stage behind this is showing. */
  .archive-grid figure.current figcaption {
    color: var(--theme-accent, #8b5cf6);
    font-weight: 600;
  }

  .info-panel {
    position: fixed;
    inset-block: 0;
    inset-inline-end: 0;
    z-index: 41;
    width: min(34rem, 92vw);
    overflow-y: auto;
    padding: 2rem clamp(1.25rem, 3vw, 2.5rem);
    background: var(--semantic-surface, #14162b);
    border-left: 1px solid
      var(--semantic-border-subtle, rgb(255 255 255 / 0.12));
  }

  .info-panel h2 {
    margin: 0 0 0.75rem;
    font-size: 1.6rem;
  }

  .info-panel h3 {
    margin: 1.75rem 0 0.6rem;
    font-size: 0.95rem;
    color: var(--semantic-text-secondary, rgb(255 255 255 / 0.62));
  }

  .info-panel p {
    margin: 0;
    line-height: 1.6;
    color: var(--semantic-text-secondary, rgb(255 255 255 / 0.78));
  }

  .sources,
  .timeline {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.5rem;
    font-size: 0.92rem;
  }

  .timeline li {
    display: grid;
    grid-template-columns: 6.5rem minmax(0, 1fr);
    gap: 0.75rem;
  }

  .when {
    color: var(--semantic-text-secondary, rgb(255 255 255 / 0.55));
    font-variant-numeric: tabular-nums;
  }

  .info-panel a {
    color: var(--theme-accent, #8b5cf6);
  }

  .note {
    margin-top: 1.75rem;
    font-size: 0.88rem;
  }

  .close {
    margin-top: 2rem;
    min-height: 44px;
    padding-inline: 1.25rem;
    border-radius: 0.6rem;
    border: 1px solid var(--semantic-border, rgb(255 255 255 / 0.22));
    background: transparent;
    color: var(--semantic-text-primary, #fff);
    cursor: pointer;
  }

  /*
   * The instrument carries four controls and the notation under its stage,
   * which is more than a phone's shell can hold — it was running off the bottom
   * and under the move chips at the top. The knobs are the point of this mode,
   * so the pane scrolls here rather than being clipped, and the stage gives up
   * the height to make the first control visible without scrolling at all.
   */
  @media (max-width: 48rem), (max-height: 32rem) {
    .instrument {
      --box-h: clamp(6rem, 24vh, 12rem);
      justify-content: flex-start;
      overflow-y: auto;
      overscroll-behavior: contain;
      scrollbar-width: none;
    }
  }

  /*
   * Wide and short — fold-open landscape, or a squashed laptop window. Stacking
   * here put the title and a thumbnail-sized stage on screen with every control
   * below the fold. Same answer as the guide: turn it on its side.
   */
  @media (min-width: 44rem) and (max-height: 32rem) {
    .instrument {
      --box-h: min(52vh, 11rem);
      display: grid;
      grid-template-columns: auto minmax(15rem, 32rem);
      grid-template-areas: "stage head" "stage knobs";
      grid-template-rows: auto auto;
      /* `safe`, because at this height the knobs can be taller than the pane:
         plain centring would push the title off the top with no way to scroll
         back to it. */
      align-content: safe center;
      justify-content: center;
      column-gap: clamp(1rem, 3vw, 2.5rem);
      row-gap: 0.5rem;
    }

    .instrument header {
      grid-area: head;
      text-align: left;
      align-self: end;
    }

    .instrument h2 {
      font-size: clamp(1.1rem, 0.8rem + 1.4vw, 1.9rem);
    }

    .spec {
      margin-top: 0.15rem;
      font-size: 0.75rem;
    }

    .stage-box {
      grid-area: stage;
      /* Start, not centre: the knob column is the taller of the two here, and a
         centred stage hangs below the fold with only its top edge on screen. */
      align-self: start;
    }

    .knobs {
      grid-area: knobs;
      align-self: start;
      width: auto;
      gap: 0.5rem;
    }
  }

  @media (max-width: 48rem) {
    .chips {
      flex-wrap: nowrap;
      overflow-x: auto;
      justify-content: flex-start;
      scrollbar-width: none;
    }

    .chips :global(.filter-chip) {
      flex: none;
    }

    /* Six labels do not fit a 375px row; scroll them rather than stack them. */
    .layers {
      flex-wrap: nowrap;
      overflow-x: auto;
      justify-content: flex-start;
      scrollbar-width: none;
    }

    .layers :global(.filter-chip) {
      flex: none;
    }
  }
</style>
