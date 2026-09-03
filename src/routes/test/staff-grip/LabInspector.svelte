<!--
  The numbers, in four views the URL can name.

  Fit is the new one and the reason the lab exists: this body's measured
  segments beside the prop it is actually holding. Grip and Turn are the
  readouts and the stance-timing lanes that already worked, re-laid out to fit
  the rail. Matrix is the sweep mount.
-->
<script lang="ts">
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import Crossfade from "$lib/shared/components/Crossfade.svelte";

  import CoverageMatrixMount from "./CoverageMatrixMount.svelte";
  import StanceTimingChart from "./StanceTimingChart.svelte";
  import type { CoverageMatrix } from "./coverage-matrix-contract";
  import type { BodyPropFit, FitVerdict } from "./lab-body-fit";
  import type { GripMetric, PoseMetric } from "./lab-metrics";
  import type { LabPanel, StaffLabState } from "./lab-state.svelte";
  import type {
    describeStanceYawTrack,
    StanceYawTrack,
  } from "$lib/shared/3d/collision/stance-yaw-track";

  interface Props {
    lab: StaffLabState;
    fit: BodyPropFit | null;
    verdict: FitVerdict;
    deltaCm: number | null;
    /** What this configuration asks the prop to be. Drives the drawn mesh. */
    configuredLengthCm: number | null;
    /** What the collision model is using. Does not follow the configuration. */
    collisionLengthCm: number | null;
    /** Signed gap between the two, or null when they agree. */
    lengthDivergenceCm: number | null;
    leftMetric: GripMetric;
    rightMetric: GripMetric;
    poseMetric: PoseMetric;
    stanceTrack: StanceYawTrack | null;
    stanceSummary: ReturnType<typeof describeStanceYawTrack>;
    stanceVelocity: number | null;
    coverageMatrix: CoverageMatrix | null;
  }

  let {
    lab,
    fit,
    verdict,
    deltaCm,
    configuredLengthCm,
    collisionLengthCm,
    lengthDivergenceCm,
    leftMetric,
    rightMetric,
    poseMetric,
    stanceTrack,
    stanceSummary,
    stanceVelocity,
    coverageMatrix,
  }: Props = $props();

  const PANEL_OPTIONS: { value: LabPanel; label: string; ariaLabel: string }[] =
    [
      { value: "fit", label: "Fit", ariaLabel: "Body and prop fit" },
      { value: "grip", label: "Grip", ariaLabel: "Grip and collision readout" },
      { value: "turn", label: "Turn", ariaLabel: "Stance turn timing" },
      { value: "matrix", label: "Matrix", ariaLabel: "Coverage matrix" },
    ];

  const VERDICT_COPY: Record<FitVerdict, string> = {
    fits: "Inside this body's hug",
    over: "Longer than this body clears",
    under: "Shorter than this body could hold",
    unsupported: "No supported length fits this body",
    unknown: "Measuring",
  };

  function mm(value: number | null, digits = 0): string {
    return value === null ? "—" : value.toFixed(digits);
  }

  function cm(value: number | null | undefined, digits = 1): string {
    return value === null || value === undefined ? "—" : value.toFixed(digits);
  }

  function deg(value: number | null, digits = 0): string {
    return value === null ? "—" : value.toFixed(digits);
  }

  function radToDeg(value: number): string {
    return ((value * 180) / Math.PI).toFixed(1);
  }
</script>

<section class="inspector" aria-label="Measurements">
  <SegmentedControl
    options={PANEL_OPTIONS}
    value={lab.panel}
    size="sm"
    semantics="tabs"
    ariaLabel="Which measurements to show"
    onchange={(panel) => lab.setPanel(panel)}
  />

  <div class="panel-stage">
    <Crossfade key={lab.panel} animateHeight>
      {#if lab.panel === "fit"}
        <div class="panel">
          <p class="verdict" data-verdict={verdict}>
            <b>{cm(configuredLengthCm)} cm</b> configured ·
            {VERDICT_COPY[verdict]}{deltaCm !== null && verdict !== "fits"
              ? ` by ${Math.abs(deltaCm).toFixed(1)} cm`
              : ""}
          </p>
          <dl class="readout">
            <div class="metric">
              <dt>Reach (shoulder to grip)</dt>
              <dd>{cm(fit ? fit.measurements.reachM * 100 : null)} cm</dd>
            </div>
            <div class="metric">
              <dt>Upper arm / forearm</dt>
              <dd>
                {cm(fit ? fit.measurements.upperArmM * 100 : null)} / {cm(
                  fit ? fit.measurements.forearmM * 100 : null
                )} cm
              </dd>
            </div>
            <div class="metric">
              <dt>Shoulder half-span</dt>
              <dd>
                {cm(fit ? fit.geometry.shoulderHalfSpanM * 100 : null)} cm
              </dd>
            </div>
            <div class="metric">
              <dt>Torso depth to clear</dt>
              <dd>{cm(fit ? fit.torsoDepthM * 100 : null)} cm</dd>
            </div>
            <div class="metric">
              <dt>Hug lane / separation</dt>
              <dd>
                {cm(fit ? fit.geometry.laneM * 100 : null)} / {cm(
                  fit ? fit.geometry.separationM * 100 : null
                )} cm
              </dd>
            </div>
            <div class="metric">
              <dt>Grips forward of chest</dt>
              <dd>{cm(fit ? fit.geometry.forwardM * 100 : null)} cm</dd>
            </div>
            <div class="metric is-wide">
              <dt>Longest this body clears</dt>
              <dd>
                {cm(fit?.fit.maxStaffLengthCm ?? null)} cm
                {#if fit?.fit.fits}
                  <span class="sub"
                    >· body fit picks {cm(
                      fit.fit.recommendedStaffLengthCm
                    )} cm</span
                  >
                {/if}
              </dd>
            </div>
            <div class="metric is-wide" data-diverged={lengthDivergenceCm !== null}>
              <dt>Collision model staff</dt>
              <dd>
                {cm(collisionLengthCm)} cm
                {#if lengthDivergenceCm !== null}
                  <span class="sub"
                    >· {lengthDivergenceCm > 0 ? "+" : "−"}{Math.abs(
                      lengthDivergenceCm
                    ).toFixed(1)} cm vs configured</span
                  >
                {/if}
              </dd>
            </div>
          </dl>
          <p class="note">
            Two lengths are live at once. The configured one reaches the drawn
            prop through <code>propLength</code>; the collision model builds
            its segment from the scene package's global
            <code>staffLength</code> and ignores it, so a per-body length
            changes the picture and not the physics.
          </p>
          <p class="note">
            The production sequence viewer takes a third route: it sizes the
            prop from the performer's own <code>staffLengthCm</code> setting,
            so a body-derived fit reaches this route and not that one. Expose
            both there before the fit is trusted as a product behaviour.
          </p>
        </div>
      {:else if lab.panel === "grip"}
        <div class="panel">
          <dl class="readout">
            <div class="metric">
              <dt>Blue axis / contact</dt>
              <dd>
                {deg(leftMetric.axisErrorDeg, 1)}° · {mm(
                  leftMetric.contactOffsetMm,
                  1
                )} mm
              </dd>
            </div>
            <div class="metric">
              <dt>Red axis / contact</dt>
              <dd>
                {deg(rightMetric.axisErrorDeg, 1)}° · {mm(
                  rightMetric.contactOffsetMm,
                  1
                )} mm
              </dd>
            </div>
            <div class="metric">
              <dt>Yaw requested → achieved</dt>
              <dd>
                {deg(poseMetric.requestedYawDeg)}° → {deg(
                  poseMetric.achievedYawDeg
                )}°
              </dd>
            </div>
            <div class="metric">
              <dt>Head dodge</dt>
              <dd>{deg(poseMetric.headDodgeDeg)}°</dd>
            </div>
            <div class="metric is-wide">
              <dt>Grip depth of shoulder half-span</dt>
              <dd>
                {mm(poseMetric.blueGripDepthMm)} / {mm(
                  poseMetric.redGripDepthMm
                )} mm of ±{mm(poseMetric.shoulderHalfSpanMm)}
              </dd>
            </div>
            <div class="metric">
              <dt>Wrist inward blue / red</dt>
              <dd>
                {deg(poseMetric.leftWristInwardDeg)}° / {deg(
                  poseMetric.rightWristInwardDeg
                )}°
              </dd>
            </div>
            <div class="metric">
              <dt>Grip separation</dt>
              <dd>{mm(poseMetric.gripSeparationMm)} mm</dd>
            </div>
            <div class="metric">
              <dt>Collisions</dt>
              <dd>{poseMetric.collisionCount}</dd>
            </div>
            <div class="metric">
              <dt>Deepest penetration</dt>
              <dd>{mm(poseMetric.deepestCollisionMm, 1)} mm</dd>
            </div>
          </dl>
          {#if poseMetric.collisionZones}
            <p class="note">{poseMetric.collisionZones}</p>
          {/if}
        </div>
      {:else if lab.panel === "turn"}
        <div class="panel">
          <div class="chart-frame">
            <StanceTimingChart track={stanceTrack} scoreTime={lab.phase} />
          </div>
          <dl class="readout">
            <div class="metric">
              <dt>Chest lead</dt>
              <dd>{stanceSummary.onsetLeadSteps?.toFixed(2) ?? "—"} steps</dd>
            </div>
            <div class="metric">
              <dt>Spine lead</dt>
              <dd>
                {stanceSummary.spineOnsetLeadSteps?.toFixed(2) ?? "—"} steps
              </dd>
            </div>
            <div class="metric">
              <dt>Peak chest</dt>
              <dd>{radToDeg(stanceSummary.peakChestRad)}°</dd>
            </div>
            <div class="metric">
              <dt>Peak head lag</dt>
              <dd>{radToDeg(stanceSummary.peakHeadLagRad)}°</dd>
            </div>
            <div class="metric">
              <dt>Peak spine stagger</dt>
              <dd>{radToDeg(stanceSummary.peakSpineStaggerRad)}°</dd>
            </div>
            <div class="metric">
              <dt>Angular velocity</dt>
              <dd>{stanceVelocity === null ? "—" : stanceVelocity.toFixed(3)}</dd>
            </div>
          </dl>
        </div>
      {:else}
        <div class="panel">
          <CoverageMatrixMount matrix={coverageMatrix} />
        </div>
      {/if}
    </Crossfade>
  </div>
</section>

<style>
  .inspector {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    min-width: 0;
  }

  .panel-stage {
    min-width: 0;
  }

  .panel {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    min-width: 0;
  }

  .verdict {
    margin: 0;
    padding: 0.5rem 0.7rem;
    border-radius: 10px;
    border: var(--glass-border, 1px solid rgba(255, 255, 255, 0.08));
    font-size: var(--font-size-sm, 0.875rem);
    color: var(--theme-text, #fff);
    font-variant-numeric: tabular-nums;
  }

  .verdict[data-verdict="over"],
  .verdict[data-verdict="unsupported"] {
    border-color: color-mix(in srgb, var(--semantic-error) 60%, transparent);
    background: color-mix(in srgb, var(--semantic-error) 16%, transparent);
  }

  .verdict[data-verdict="fits"] {
    border-color: color-mix(in srgb, var(--semantic-success) 55%, transparent);
    background: color-mix(in srgb, var(--semantic-success) 14%, transparent);
  }

  .verdict[data-verdict="under"] {
    border-color: color-mix(in srgb, var(--semantic-warning) 55%, transparent);
    background: color-mix(in srgb, var(--semantic-warning) 14%, transparent);
  }

  .readout {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: 0.45rem;
    margin: 0;
    min-width: 0;
  }

  .metric {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    padding: 0.45rem 0.6rem;
    border-radius: 10px;
    background: var(--card-bg-current, rgba(255, 255, 255, 0.05));
    min-width: 0;
  }

  .metric.is-wide {
    grid-column: 1 / -1;
  }

  /* A number that disagrees with the configuration is the finding, not chrome. */
  .metric[data-diverged="true"] {
    background: color-mix(in srgb, var(--semantic-warning) 18%, transparent);
  }

  .metric dt {
    font-size: var(--font-size-xs, 0.75rem);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
  }

  .metric dd {
    margin: 0;
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 600;
    color: var(--theme-text, #fff);
    /* Changing numbers keep their column so the grid never jitters. */
    font-variant-numeric: tabular-nums;
  }

  .sub {
    font-weight: 400;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
  }

  .note {
    margin: 0;
    font-size: var(--font-size-xs, 0.75rem);
    line-height: 1.5;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.75));
  }

  .note code {
    color: var(--theme-text, #fff);
  }

  /* The chart draws to the box it is given, so the box is reserved up front. */
  .chart-frame {
    min-height: 190px;
    min-width: 0;
  }
</style>
