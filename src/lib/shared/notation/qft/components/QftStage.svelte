<script lang="ts">
  /**
   * The stage: home base, the hand path, the tether, and the traced shape.
   *
   * Everything here is computed from qft-model. Nothing is traced from the
   * original 2011 animations.
   */
  import {
    pendulumPosesAt,
    pointAt,
    posesAt,
    tracePath,
    tracePendulum,
    PROP_LENGTH,
    type QftIncrement,
    type QftKnobs
  } from "$lib/shared/notation/qft/qft-model";

  interface Props {
    knobs: QftKnobs;
    increments: QftIncrement[];
    /** Continuous position in the eight-step cycle. */
    cursor: number;
    /**
     * A pendulum swings back along its own arc, which the three knobs cannot
     * express. Drawing it from the knobs sends the head around a full circle
     * while the notation oscillates, so the lit number lands nowhere near the
     * prop it names.
     */
    pendulum?: boolean;
  }

  let { knobs, increments, cursor, pendulum = false }: Props = $props();

  /** Pixels per prop length. The head reaches radius + 1, so 2.5 at the widest. */
  const UNIT = 100;
  const EXTENT = 270;

  const HOME_BASE = [1, 2, 3, 4, 5, 6, 7, 8];
  const RING = PROP_LENGTH * UNIT;

  const step = $derived(Math.floor(cursor) % 8);
  const row = $derived(increments[step]);

  const poses = $derived(pendulum ? pendulumPosesAt(cursor) : posesAt(knobs, cursor));
  const hand = $derived({ x: poses.hand.x * UNIT, y: poses.hand.y * UNIT });
  const head = $derived({ x: poses.head.x * UNIT, y: poses.head.y * UNIT });

  const samples = $derived(pendulum ? tracePendulum() : tracePath(knobs));

  const trail = $derived(
    samples
      .map((p, i) => `${i === 0 ? "M" : "L"}${(p.x * UNIT).toFixed(2)},${(p.y * UNIT).toFixed(2)}`)
      .join(" ")
  );

  /**
   * The trail's recency.
   *
   * A single evenly-lit path says what shape the prop draws but nothing about
   * where it is in drawing it. A spinner does not see that — they see a bright
   * afterimage just behind the head falling away into the older part of the
   * stroke. So the shape stays, dimly, and a short band of light rides the head.
   *
   * The band is placed by arc length rather than by cursor fraction. The head
   * does not move at a constant speed along its own path — an antispin flower
   * crawls through the petal tips and races the middles — so lighting
   * `cursor / 8` of the way along the stroke would leave the highlight visibly
   * detached from the prop exactly where the shape is most interesting.
   */
  const arc = $derived.by(() => {
    const cum = [0];
    let total = 0;
    for (let i = 1; i < samples.length; i += 1) {
      const a = samples[i - 1] as { x: number; y: number };
      const b = samples[i] as { x: number; y: number };
      total += Math.hypot(b.x - a.x, b.y - a.y) * UNIT;
      cum.push(total);
    }
    return { cum, total };
  });

  /** Distance along the stroke that the head has reached, in user units. */
  const headDistance = $derived.by(() => {
    const { cum } = arc;
    const spans = cum.length - 1;
    if (spans < 1) return 0;
    const t = ((cursor % 8) + 8) % 8;
    const x = (t / 8) * spans;
    const i = Math.min(spans - 1, Math.floor(x));
    const a = cum[i] as number;
    const b = cum[i + 1] as number;
    return a + (b - a) * (x - i);
  });

  /*
   * Five bands rather than a gradient: SVG cannot run a gradient along an
   * arbitrary path, and per-segment opacity over 240 samples would rebuild 240
   * nodes every frame. Five dashes with a period of exactly the path length wrap
   * around the closed stroke on their own, which is the whole trick.
   */
  const BANDS = 5;
  /** Share of the whole stroke the afterimage covers. */
  const BAND_SPAN = 0.28;

  const bands = $derived.by(() => {
    const { total } = arc;
    if (total <= 0) return [];
    const band = (total * BAND_SPAN) / BANDS;
    return Array.from({ length: BANDS }, (_, k) => ({
      k,
      dash: `${band} ${Math.max(0.01, total - band)}`,
      offset: -(headDistance - (k + 1) * band),
      opacity: 0.9 * (1 - k / BANDS) ** 1.6,
      width: 5 + 2.5 * (1 - k / BANDS)
    }));
  });

  const labelPoint = (position: number) => {
    const p = pointAt(position, PROP_LENGTH * 1.28);
    return { x: p.x * UNIT, y: p.y * UNIT };
  };

  /**
   * Prop position is measured from the hand, not from the centre of the body.
   * That is the single most misread part of the system — it is why the 4-petal
   * corners read 5, 7, 1, 3 rather than anything intuitive. So the prop gets its
   * own compass, riding along with the hand, and the outer ring is left to say
   * where the hand is. Lighting a hand-relative number on the body-centred ring
   * puts it nowhere near the prop it describes.
   */
  const handLocalPoint = (position: number) => {
    const p = pointAt(position, PROP_LENGTH);
    return { x: hand.x + p.x * UNIT, y: hand.y + p.y * UNIT };
  };

  /**
   * The direction dart.
   *
   * The direction column is the load-bearing half of QfT — it is the only thing
   * separating an inspin flower from an antispin one — but it existed on this
   * stage as a number in a table with nothing in the picture to attach it to.
   * Charlie drew it as a flag off the prop, in separate diagrams, because drawn
   * permanently it competes with the tether and the trail.
   *
   * So it fires rather than persists: a dart leaves the head at each step
   * boundary, pointing along that step's direction value, and fades out over
   * the increment. On Charlie's convention an out-of-resolution cell has no
   * direction to fire, so the absence of a dart IS the `n` — visible rather
   * than merely tabulated.
   */
  const DART_LENGTH = 0.55;

  const dart = $derived.by(() => {
    const current = row;
    const value = current?.propDirDepart;
    if (!current || value === undefined || value === "n") return null;

    const from = handLocalPoint(current.propDepart);
    const along = pointAt(value, DART_LENGTH);
    return {
      x1: from.x,
      y1: from.y,
      x2: from.x + along.x * UNIT,
      y2: from.y + along.y * UNIT
    };
  });

  /** 1 at the instant a step begins, falling to 0 across the increment. */
  const dartLife = $derived(Math.max(0, 1 - (cursor - Math.floor(cursor)) * 2.2));
</script>

<svg
  class="stage"
  viewBox={`${-EXTENT} ${-EXTENT} ${EXTENT * 2} ${EXTENT * 2}`}
  role="img"
  aria-label={`QfT home base. The hand is at position ${row?.handDepart ?? 8} on the body compass, and the prop is at position ${row?.propDepart ?? 8} measured from the hand.`}
>
  <defs>
    <marker
      id="qft-dart-head"
      viewBox="0 0 10 10"
      refX="8"
      refY="5"
      markerWidth="5"
      markerHeight="5"
      orient="auto-start-reverse"
    >
      <path d="M0,0 L10,5 L0,10 z" fill="var(--semantic-warning, #fbbf24)" />
    </marker>
  </defs>

  <circle class="ring" cx="0" cy="0" r={RING} />

  {#if knobs.radius > 0.01}
    <circle class="hand-path" cx="0" cy="0" r={knobs.radius * UNIT} />
  {/if}

  <path class="trail" d={trail} />
  {#each bands as b (b.k)}
    <path
      class="trail-recent"
      d={trail}
      stroke-dasharray={b.dash}
      stroke-dashoffset={b.offset}
      stroke-width={b.width}
      opacity={b.opacity}
    />
  {/each}

  {#each HOME_BASE as position (position)}
    {@const p = labelPoint(position)}
    {@const isOrigin = row?.handDepart === position}
    {@const isArrival = row?.handArrive === position}
    <g class="point" class:origin={isOrigin} class:arrival={isArrival}>
      <circle cx={p.x} cy={p.y} r="26" />
      <text x={p.x} y={p.y} dy="9">{position}</text>
    </g>
  {/each}

  <!-- The prop's own compass, projected from the hand. -->
  <circle class="hand-ring" cx={hand.x} cy={hand.y} r={PROP_LENGTH * UNIT} />
  {#each HOME_BASE as position (position)}
    {#if row?.propDepart !== position}
      {@const p = handLocalPoint(position)}
      <circle class="prop-tick" cx={p.x} cy={p.y} r="4" />
    {/if}
  {/each}

  <!--
    The arm. One stroke from the centre to the hand, so the hand's compass
    position reads at a glance and the radius is legible as a length rather than
    an abstract slider value. Nothing to draw at radius 0 — the hand is the
    centre.
  -->
  {#if knobs.radius > 0.01 && !pendulum}
    <line class="arm" x1="0" y1="0" x2={hand.x} y2={hand.y} />
  {/if}

  <line class="tether" x1={hand.x} y1={hand.y} x2={head.x} y2={head.y} />

  {#if dart && dartLife > 0}
    <line
      class="dart"
      x1={dart.x1}
      y1={dart.y1}
      x2={dart.x2}
      y2={dart.y2}
      opacity={dartLife}
      marker-end="url(#qft-dart-head)"
    />
  {/if}
  <circle class="hand" cx={hand.x} cy={hand.y} r="13" />
  <circle class="head" cx={head.x} cy={head.y} r="22" />

  <!--
    Drawn last. At an integer step this marker and the head coincide exactly,
    which is the whole point — the lit number IS where the prop is. Drawing it
    before the head would bury the label underneath it.
  -->
  {#if row}
    {@const p = handLocalPoint(row.propDepart)}
    <g class="prop-point">
      <circle cx={p.x} cy={p.y} r="21" />
      <text x={p.x} y={p.y} dy="7">{row.propDepart}</text>
    </g>
  {/if}
</svg>

<style>
  /*
   * The container owns the box; the SVG fills it and lets preserveAspectRatio
   * letterbox the square viewBox inside. Sizing from width + aspect-ratio here
   * instead would make the stage as tall as the column is wide, which blows
   * through any height budget the page tries to give it.
   */
  .stage {
    display: block;
    width: 100%;
    height: 100%;
  }

  .ring {
    fill: none;
    stroke: var(--semantic-border-subtle, rgb(255 255 255 / 0.14));
    stroke-width: 2;
    stroke-dasharray: 6 10;
  }

  .hand-path {
    fill: none;
    stroke: var(--semantic-border, rgb(255 255 255 / 0.3));
    stroke-width: 2;
  }

  /* The shape itself: always whole, always quiet. */
  .trail {
    fill: none;
    stroke: var(--theme-accent, #8b5cf6);
    stroke-width: 4;
    stroke-linecap: round;
    stroke-linejoin: round;
    opacity: 0.22;
  }

  /* The afterimage riding the head. Butt caps so the bands abut without pips. */
  .trail-recent {
    fill: none;
    stroke: var(--theme-accent, #8b5cf6);
    stroke-linecap: butt;
    stroke-linejoin: round;
  }

  .point circle {
    fill: var(--semantic-surface-raised, rgb(0 0 0 / 0.5));
    stroke: var(--semantic-border, rgb(255 255 255 / 0.28));
    stroke-width: 2;
    transition: fill 160ms ease, stroke 160ms ease;
  }

  .point text {
    fill: var(--semantic-text-secondary, rgb(255 255 255 / 0.66));
    font-size: 1.75rem;
    font-weight: 600;
    text-anchor: middle;
    font-variant-numeric: tabular-nums;
  }

  /* The body compass says where the HAND is, so it wears the hand's colour. */
  .point.arrival circle {
    stroke: var(--semantic-text-primary, rgb(255 255 255 / 0.85));
  }

  .point.origin circle {
    fill: var(--semantic-text-primary, rgb(255 255 255 / 0.85));
    stroke: #fff;
  }

  .point.origin text {
    fill: #0b1020;
  }

  .hand-ring {
    fill: none;
    stroke: var(--semantic-border-subtle, rgb(255 255 255 / 0.1));
    stroke-width: 2;
  }

  .prop-tick {
    fill: var(--semantic-border, rgb(255 255 255 / 0.26));
  }

  .prop-point circle {
    fill: var(--theme-accent, #8b5cf6);
    stroke: #fff;
    stroke-width: 2;
  }

  .prop-point text {
    fill: #fff;
    font-size: 1.4rem;
    font-weight: 700;
    text-anchor: middle;
    font-variant-numeric: tabular-nums;
  }

  /*
   * Thinner and dimmer than the tether on purpose. The arm is orientation, not
   * the subject — if it reads as strongly as the tether, the eye stops being
   * able to tell which line is the prop.
   */
  .arm {
    stroke: var(--semantic-text-secondary, rgb(255 255 255 / 0.32));
    stroke-width: 2;
    stroke-linecap: round;
    stroke-dasharray: 5 6;
  }

  .tether {
    stroke: var(--semantic-text-primary, rgb(255 255 255 / 0.85));
    stroke-width: 4;
    stroke-linecap: round;
  }

  .dart {
    stroke: var(--semantic-warning, #fbbf24);
    stroke-width: 4;
    stroke-linecap: round;
  }

  .hand {
    fill: var(--semantic-text-primary, rgb(255 255 255 / 0.85));
  }

  .head {
    fill: var(--theme-accent, #8b5cf6);
    stroke: #fff;
    stroke-width: 3;
  }

  @media (prefers-reduced-motion: reduce) {
    .point circle {
      transition: none;
    }
  }
</style>
