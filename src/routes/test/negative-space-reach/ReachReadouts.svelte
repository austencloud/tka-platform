<script lang="ts">
  /**
   * What one route is doing, right now, in the document's own vocabulary.
   *
   * Palm facing leads and is the largest thing on the panel. That is not a
   * layout preference: §6 of
   * `docs/reference/negative-space-and-wall-plane-reach.md` says palm facing is
   * "really important element" and treats it as the state variable that
   * distinguishes and terminates the two routes. Everything under it is
   * supporting evidence for that line.
   *
   * Each row carries the phrase from the document it answers, so a number that
   * disagrees with the source can be argued with rather than accepted. Rows the
   * rig cannot answer read as an em dash instead of a zero — a missing
   * measurement and a measurement of nothing are not the same finding.
   */

  import {
    FACING_SHORT,
    POCKET_CLEARANCE_MM,
    ROUTE_DEADBAND_MM,
    ROUTE_VERDICT_LABEL,
    facingSentence,
    formatReach,
    routeVerdict,
    type ReachFrame,
  } from "./reach-telemetry";

  interface Props {
    frame: ReachFrame;
    /** Shown above the headline so a pane is identifiable on its own. */
    routeLabel: string;
  }

  let { frame, routeLabel }: Props = $props();

  const verdict = $derived(routeVerdict(frame));

  const palmSentence = $derived(facingSentence(frame.palmFacing));

  const extensionPercent = $derived(
    frame.armExtension === null
      ? null
      : Math.max(0, Math.min(100, frame.armExtension * 100))
  );

  /**
   * §5 calls full extension a requirement of its route: "by the time my arm is
   * fully extended, which is what's required to get through the move this way".
   * A real elbow never reaches a mathematical 1.0, so the bar names a band
   * rather than a point, and the number stays visible beside it.
   */
  const extensionNote = $derived(
    extensionPercent === null
      ? "No reading"
      : extensionPercent >= 97
        ? "Straight"
        : extensionPercent >= 90
          ? "Nearly straight"
          : "Bent"
  );

  const pocketNote = $derived(
    frame.thumbEndAboveShoulderMm === null
      ? "No reading"
      : frame.inPocket
        ? "Clear above the shoulder and upstage of the forearm"
        : frame.thumbEndAboveShoulderMm > POCKET_CLEARANCE_MM
          ? "Clear above the shoulder, but not behind the forearm"
          : frame.thumbEndAboveShoulderMm > 0
            ? "Level with the shoulder, not over it"
            : "Below the shoulder"
  );

  const planeSideNote = $derived(
    frame.thumbEndAboveForearmMm === null
      ? "No reading"
      : frame.thumbEndAboveForearmMm > 0
        ? "Above the forearm"
        : "Below the forearm"
  );

  /**
   * Reported because §1 is about what a shoulder will give. A reach that only
   * works by twisting the chest most of the way round is a different claim
   * from one the shoulder makes on its own.
   */
  const twistNote = $derived(
    frame.shoulderTwistDeg === null
      ? "No reading"
      : Math.abs(frame.shoulderTwistDeg) < 5
        ? "Square to the audience"
        : frame.shoulderTwistDeg > 0
          ? "Chest turned to the performer's left"
          : "Chest turned to the performer's right"
  );

  const gripNote = $derived(
    frame.thumbEndIsRadiallyIn === null
      ? "No reading"
      : frame.thumbEndIsRadiallyIn
        ? "Thumb end is the inner end"
        : "Thumb end is the outer end"
  );
</script>

<section
  class="readouts"
  aria-label={`Measurements for ${routeLabel}`}
  data-verdict={verdict}
>
  <p class="route">{routeLabel}</p>

  <div class="headline">
    <p class="headline-label">Palm facing</p>
    <p class="headline-value">{palmSentence}</p>
    <p class="headline-note">
      §6 — the state variable that separates the two routes
    </p>
  </div>

  <div class="predicate">
    <p class="predicate-label">Thumb end vs the forearm</p>
    <p class="predicate-value">{ROUTE_VERDICT_LABEL[verdict]}</p>
    <p class="predicate-number">
      {formatReach(frame.thumbEndVsForearmMm)} mm
      <span class="predicate-unit"
        >· upstage is negative · ±{ROUTE_DEADBAND_MM} mm reads as neither</span
      >
    </p>
    <p class="predicate-quote">
      §4 — “that thumb end can’t pass on the downstage side of the body”
    </p>
  </div>

  <div class="predicate secondary">
    <p class="predicate-label">Side of the forearm, seen in the plane</p>
    <p class="predicate-value">{planeSideNote}</p>
    <p class="predicate-number">
      {formatReach(frame.thumbEndAboveForearmMm)} mm
      <span class="predicate-unit">· above the forearm line is positive</span>
    </p>
    <p class="predicate-quote">
      Not a question the document asks. On a plane-locked prop it is where the
      difference between the two notations actually lands.
    </p>
  </div>

  <dl class="rows">
    <div class="row">
      <dt>In the pocket</dt>
      <dd>
        <span class="value">{pocketNote}</span>
        <span class="detail">
          {formatReach(frame.thumbEndAboveShoulderMm)} mm above the shoulder
        </span>
      </dd>
    </div>

    <div class="row">
      <dt>Arm extension</dt>
      <dd>
        <span class="value">
          {extensionNote}
          <span class="number"
            >{extensionPercent === null
              ? "—"
              : `${extensionPercent.toFixed(0)}%`}</span
          >
        </span>
        <span class="meter" aria-hidden="true">
          <span class="meter-fill" style:width={`${extensionPercent ?? 0}%`}
          ></span>
        </span>
        <span class="detail">§5 — full extension is required that way</span>
      </dd>
    </div>

    <div class="row">
      <dt>Palm roll</dt>
      <dd>
        <span class="value">
          <span class="number">{formatReach(frame.palmRollDeg, 0)}°</span>
          about the forearm
        </span>
        <span class="detail">
          0° is palm to the sky, ±180° palm to the floor, positive rolls
          downstage
        </span>
      </dd>
    </div>

    <div class="row">
      <dt>Inner elbow</dt>
      <dd>
        <span class="value">
          {frame.innerElbowFacing
            ? FACING_SHORT[frame.innerElbowFacing.axis]
            : "Arm is straight"}
        </span>
        <span class="detail">
          §4 — “the inner elbow faces up toward the sky” ·
          {formatReach(frame.elbowOffsetMm, 0)} mm off the shoulder-to-wrist line
        </span>
      </dd>
    </div>

    <div class="row">
      <dt>Pinky end</dt>
      <dd>
        <span class="value">
          <span class="number">{formatReach(frame.pinkyEndPastElbowMm)} mm</span>
          past the elbow
        </span>
        <span class="detail">
          §4 — “the staff’s pinky end is in front of the elbow”; positive is
          downstage
        </span>
      </dd>
    </div>

    <div class="row">
      <dt>Past the shoulder</dt>
      <dd>
        <span class="value">
          <span class="number"
            >{formatReach(frame.thumbEndPastShoulderMm)} mm</span
          >
          downstage
        </span>
        <span class="detail">
          The thumb end against the shoulder’s own frontal plane
        </span>
      </dd>
    </div>

    <div class="row">
      <dt>Shoulder twist</dt>
      <dd>
        <span class="value">
          {twistNote}
          <span class="number">{formatReach(frame.shoulderTwistDeg, 0)}°</span>
        </span>
        <span class="detail">
          §1 — how much the upper body had to give to make the reach
        </span>
      </dd>
    </div>

    <div class="row">
      <dt>Grip agrees with the notation</dt>
      <dd>
        <span class="value">{gripNote}</span>
        <span class="detail">
          Read from the rig, not from the notated orientation
        </span>
      </dd>
    </div>
  </dl>

  <p class="provenance">
    Shoulder joint read {frame.shoulderSource === "bone"
      ? "from the rendered rig"
      : "from reported shoulder width — the bone was not found, so depth past the shoulder assumes no chest offset"}.
  </p>
</section>

<style>
  .readouts {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.85rem 0.95rem 0.95rem;
    border: var(--glass-border, 1px solid rgba(255, 255, 255, 0.08));
    border-radius: 0.75rem;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.05));
    color: var(--theme-text, #fff);
    /* Numbers change every frame; equal-width digits keep the rows still. */
    font-variant-numeric: tabular-nums;
  }

  .route {
    margin: 0;
    font-size: var(--font-size-compact, 0.75rem);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
  }

  .headline {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .headline-label {
    margin: 0;
    font-size: var(--font-size-xs, 0.75rem);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
  }

  .headline-value {
    margin: 0;
    /* The largest thing on the panel, and a direction rather than a number. */
    font-size: clamp(1.35rem, 1.05rem + 0.9vw, 1.9rem);
    line-height: 1.15;
    font-weight: 650;
    /*
      Two lines of headroom, held whether the sentence needs one line or two,
      so a tilt appearing mid-scrub cannot shove the rows below it.
    */
    min-height: 2.3em;
  }

  .headline-note {
    margin: 0;
    font-size: var(--font-size-xs, 0.75rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
  }

  .predicate {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    padding: 0.6rem 0.7rem;
    border: 1px solid var(--predicate-edge, var(--theme-stroke, rgba(255, 255, 255, 0.08)));
    border-radius: 0.55rem;
    background: var(--predicate-wash, transparent);
  }

  /*
    The verdict tints the whole box — a full border and a wash, not a strip on
    one edge (`.claude/rules/no-left-edge-accent-bar.md`). The words carry the
    reading on their own; the colour only makes a scrub easier to follow.
  */
  .readouts[data-verdict="negative-space"] .predicate {
    --predicate-edge: color-mix(in srgb, var(--semantic-success) 55%, transparent);
    --predicate-wash: color-mix(in srgb, var(--semantic-success) 12%, transparent);
  }

  .readouts[data-verdict="downstage"] .predicate {
    --predicate-edge: color-mix(in srgb, var(--semantic-warning) 55%, transparent);
    --predicate-wash: color-mix(in srgb, var(--semantic-warning) 12%, transparent);
  }

  /*
    The secondary box stays visually quieter than the document's own question:
    it is supporting evidence, not the headline, and must not be mistaken for
    the §4 predicate.
  */
  .predicate.secondary {
    border-style: dashed;
  }

  .predicate-label {
    margin: 0;
    font-size: var(--font-size-xs, 0.75rem);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
  }

  .predicate-value {
    margin: 0;
    font-size: var(--font-size-base, 1rem);
    font-weight: 600;
    /* One line, held: the three verdicts are different widths. */
    min-height: 1.5em;
  }

  .predicate-number {
    margin: 0;
    font-size: var(--font-size-sm, 0.875rem);
  }

  .predicate-unit {
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
  }

  .predicate-quote {
    margin: 0.15rem 0 0;
    font-size: var(--font-size-xs, 0.75rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
  }

  .rows {
    display: grid;
    gap: 0.55rem;
    margin: 0;
  }

  .row {
    display: grid;
    gap: 0.1rem;
  }

  dt {
    font-size: var(--font-size-xs, 0.75rem);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
  }

  dd {
    display: grid;
    gap: 0.2rem;
    margin: 0;
  }

  .value {
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 550;
    /* Held, so a verdict word swapping length never moves the row below. */
    min-height: 1.4em;
  }

  .number {
    font-weight: 650;
  }

  .detail {
    font-size: var(--font-size-xs, 0.75rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
  }

  .meter {
    display: block;
    height: 4px;
    border-radius: 2px;
    background: var(--theme-stroke, rgba(255, 255, 255, 0.12));
    overflow: hidden;
  }

  .meter-fill {
    display: block;
    height: 100%;
    background: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
    transition: width var(--transition-fast, 120ms) ease-out;
  }

  @media (prefers-reduced-motion: reduce) {
    .meter-fill {
      transition: none;
    }
  }

  .provenance {
    margin: 0;
    font-size: var(--font-size-xs, 0.75rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
  }
</style>
