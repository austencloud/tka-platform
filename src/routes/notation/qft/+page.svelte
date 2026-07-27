<script lang="ts">
  /**
   * QfT Notation — one app, two modes.
   *
   * Guide walks the eight canonical moves, each restored animation running
   * beside a model that computes the same move from the published rules.
   * Instrument unlocks the knobs. The step from watching to playing is one
   * click, not one URL.
   *
   * No narrator: the only prose is quoted from the source, and every label
   * states a fact rather than an interpretation.
   *
   * Design: docs/superpowers/specs/2026-07-27-qft-archive-app-design.md
   * Sources: docs/reference/archive/qft-notation/README.md
   */
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import FilterChipBase from "$lib/shared/browse/components/filter-chips/FilterChipBase.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import {
    GUIDE_MOVES,
    SOURCES,
    TIMELINE,
    type GuideMove
  } from "$lib/shared/notation/qft/qft-guide";
  import {
    buildIncrements,
    buildPendulum,
    type Convention,
    type QftKnobs,
    type Spin
  } from "$lib/shared/notation/qft/qft-model";
  import { nameFor } from "$lib/shared/notation/qft/qft-naming";
  import {
    loadQftSession,
    saveQftSession,
    type QftSession
  } from "$lib/shared/notation/qft/qft-session";
  import QftGuidePane from "$lib/shared/notation/qft/components/QftGuidePane.svelte";
  import QftStage from "$lib/shared/notation/qft/components/QftStage.svelte";
  import QftTable from "$lib/shared/notation/qft/components/QftTable.svelte";

  type AppMode = "guide" | "instrument";

  /*
   * Restored synchronously at init rather than in an effect, so the first paint
   * is already the right shape. Restoring afterwards would show the default
   * move for a frame and then jump, which is exactly the seam this removes.
   */
  const restored = loadQftSession(GUIDE_MOVES.length);

  let appMode = $state<AppMode>(restored?.appMode ?? "guide");
  let moveIndex = $state(restored?.moveIndex ?? 0);
  let showInfo = $state(false);

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
   * Composed by default: the restored drawings are keyed off their white card
   * and re-inked so they sit in the page rather than on it. The published card
   * stays one click away, because a page whose claim is faithful restoration
   * cannot make a recoloured artifact the only version it offers.
   */
  let asPublished = $state(restored?.asPublished ?? false);

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
  const increments = $derived(appMode === "guide" ? guideIncrements : instrumentIncrements);

  const step = $derived(Math.floor(pos) % 8);

  const instrumentName = $derived(
    pendulum ? { label: "Pendulum", provenance: "sourced" as const } : nameFor(knobs)
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
    typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  const step8 = (delta: number) => {
    playing = false;
    velocity = 0;
    const target = Math.round(scrubbing ? scrubTo : Math.floor(cursor)) + delta;

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

  const snapshot = (): QftSession => ({
    appMode,
    moveIndex,
    radius,
    downbeats,
    spin,
    phase,
    pendulum,
    convention,
    /* Normalised: the raw cursor runs unbounded while playing and negative mid-scrub. */
    cursor: pos,
    playing,
    asPublished
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
      radius,
      downbeats,
      spin,
      phase,
      pendulum,
      convention,
      playing,
      asPublished
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
    ariaLabel: `${n} prop rotation${n === 1 ? "" : "s"} per hand rotation`
  }));

  const SPIN_OPTIONS: Array<{ value: Spin; label: string }> = [
    { value: "inspin", label: "Inspin" },
    { value: "antispin", label: "Antispin" }
  ];

  const CONVENTION_OPTIONS: Array<{ value: Convention; label: string }> = [
    { value: "charlie", label: "Charlie" },
    { value: "drex", label: "Drex" }
  ];
</script>

<svelte:head>
  <title>QfT Notation — Flow Arts Composer</title>
  <meta
    name="description"
    content="Charlie Cushing's 2011 poi notation, with the lost diagrams restored and running beside a model that computes the same moves."
  />
</svelte:head>

<div class="app">
  <!--
    Toggles rather than a SegmentedControl: in instrument mode NO move is
    selected, and a segmented indicator has nowhere to sit in that state
    (.claude/rules/chip-primitives.md, the "at most one" case). Solid emphasis
    because the selected move is a hard selection, not a filter that is merely
    switched on.
  -->
  <nav class="chips" aria-label="Moves">
    {#each GUIDE_MOVES as m, i (m.id)}
      <FilterChipBase
        label={m.title}
        mode="toggle"
        emphasis="solid"
        size="sm"
        active={appMode === "guide" && i === moveIndex}
        onclick={() => selectMove(i)}
      />
    {/each}
  </nav>

  <main class="surface">
    <Crossfade key={appMode === "guide" ? move.id : "instrument"} fill>
      {#if appMode === "guide"}
        <QftGuidePane
          {move}
          increments={guideIncrements}
          cursor={pos}
          {step}
          {compact}
          {asPublished}
          onRendering={(v) => (asPublished = v)}
        />
      {:else}
        <div class="instrument">
          <header>
            <h2>{instrumentName.label}</h2>
            <p class="spec">
              {radius.toFixed(2)} prop lengths · {downbeats} prop rotation{downbeats === 1
                ? ""
                : "s"} per hand rotation
            </p>
          </header>

          <div class="instrument-body">
            <div class="stage-box">
              <QftStage {knobs} increments={instrumentIncrements} cursor={pos} {pendulum} />
            </div>

            <div class="knobs">
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
                <span class="knob-label" id="downbeats-label">Prop rotations per hand rotation</span
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

              <div class="notation">
                <QftTable increments={instrumentIncrements} activeStep={step} {compact} />
              </div>
            </div>
          </div>
        </div>
      {/if}
    </Crossfade>
  </main>

  <div class="transport">
    <button type="button" onclick={() => step8(-1)} aria-label="Previous increment">‹</button>
    <span class="counter">{step + 1} / 8</span>
    <button type="button" onclick={() => step8(1)} aria-label="Next increment">›</button>
    <button type="button" class="play" onclick={() => (playing = !playing)}>
      {playing ? "Pause" : "Play"}
    </button>

    {#if appMode === "guide"}
      <button type="button" class="mode" onclick={openInstrument}>Turn the knobs</button>
    {:else}
      <button type="button" class="mode" onclick={() => selectMove(moveIndex)}>Back to guide</button>
    {/if}

    <button type="button" class="mode info" onclick={() => (showInfo = true)}>About</button>
  </div>
</div>

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
      A poi notation devised by Charlie Cushing and written up by Ben "DrexFactor" Drexler in 2011.
      The diagrams no longer load on the forum where they were posted. They are restored here, each
      running beside a model that computes the same move from the published rules.
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
      As published, the direction column has two variants: Charlie's, in which a direction that does
      not land on the eight-point compass is written <em>n</em>, and Drex's, in which direction is
      always a right angle to the tether and every cell resolves. The guide uses Drex's; the
      instrument offers both.
    </p>

    <button type="button" class="close" onclick={() => (showInfo = false)}>Close</button>
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
  .app {
    --site-header: 65px;
    height: calc(100dvh - var(--site-header));
    margin-top: var(--site-header);
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: clamp(0.5rem, 1.5vh, 1.25rem);
    padding: clamp(0.5rem, 1.5vh, 1.25rem) clamp(0.75rem, 2vw, 2rem);
    overflow: hidden;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
  }

  .surface {
    position: relative;
    min-height: 0;
  }

  .instrument {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: clamp(0.75rem, 2vh, 1.5rem);
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

  .instrument-body {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    justify-items: center;
    gap: clamp(1rem, 3vh, 2rem);
    width: 100%;
  }

  .stage-box {
    width: clamp(9rem, 30vh, 22rem);
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

  @media (min-width: 90rem) and (min-height: 45rem) {
    .instrument-body {
      grid-template-columns: auto minmax(24rem, 34rem);
      align-items: center;
      justify-items: stretch;
      column-gap: clamp(2rem, 4vw, 4rem);
      width: auto;
    }

    .stage-box {
      width: clamp(14rem, 38vh, 30rem);
    }
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

  .mode {
    border-color: var(--theme-accent, #8b5cf6) !important;
    color: var(--theme-accent, #8b5cf6) !important;
  }

  .scrim {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.55);
    border: 0;
    z-index: 40;
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
    border-left: 1px solid var(--semantic-border-subtle, rgb(255 255 255 / 0.12));
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
  }
</style>
