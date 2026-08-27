<script lang="ts">
  /**
   * GaitReadout
   *
   * The 2D half of the instrument. Three views of the same buffer, because no
   * one of them catches everything:
   *
   *   - the verdict table, which says how far each number is from a human;
   *   - the footfall strip, where a stance that should be one solid block
   *     shows up as a row of flickers and every twitch gets a tick;
   *   - the floor trace, where a foot that is supposed to be pinned draws a
   *     line instead of a dot, and the length of that line is the skate.
   */

  import type { GaitReport } from "./gait-analysis";
  import {
    countFailing,
    verdictRows,
    type GaitReportScope,
  } from "./gait-verdicts";
  import type { Vec3 } from "./gait-frame";

  interface Props {
    report: GaitReport | null;
    label?: string;
    /** Recent root positions, for scaling the floor trace. */
    trail?: readonly Vec3[];
    scope?: GaitReportScope;
  }

  let {
    report,
    label = "performer",
    trail = [],
    scope = "gait",
  }: Props = $props();

  const rows = $derived(verdictRows(report, scope));
  const failing = $derived(countFailing(report, scope));

  const STRIP_W = 1000;
  const window = $derived.by(() => {
    const r = report;
    if (!r || r.duration <= 0) return { t0: 0, t1: 1 };
    const t1 =
      r.stances.length > 0 ? r.stances[r.stances.length - 1]!.endT : r.duration;
    return { t0: Math.max(0, t1 - 8), t1: Math.max(t1, 1) };
  });
  const xOf = (t: number) =>
    ((t - window.t0) / Math.max(1e-6, window.t1 - window.t0)) * STRIP_W;

  const TRACE = 320;
  const traceBox = $derived.by(() => {
    const points: Vec3[] = [...trail];
    for (const stance of report?.stances ?? []) {
      points.push(stance.strike, stance.release);
    }
    if (points.length === 0) return { minX: -1, minZ: -1, span: 2 };
    const xs = points.map((p) => p.x);
    const zs = points.map((p) => p.z);
    const minX = Math.min(...xs);
    const minZ = Math.min(...zs);
    // One scale for both axes, so a slip vector on screen is a slip vector on
    // the floor and cannot be flattered by a stretched aspect.
    const span = Math.max(0.6, Math.max(...xs) - minX, Math.max(...zs) - minZ);
    return { minX, minZ, span };
  });
  const tx = (x: number) =>
    ((x - traceBox.minX) / traceBox.span) * (TRACE - 24) + 12;
  const tz = (z: number) =>
    ((z - traceBox.minZ) / traceBox.span) * (TRACE - 24) + 12;
</script>

<div class="readout">
  <header>
    <h3>{label}</h3>
    {#if report && report.stances.length > 0}
      <span class="score" class:clean={failing === 0}>
        {failing} of {rows.length} outside human range
      </span>
    {:else}
      <span class="score waiting">waiting for footfalls</span>
    {/if}
  </header>

  {#if report && report.stances.length > 0}
    <!-- Row labels are HTML, not SVG text: the plot stretches to the panel
         width with preserveAspectRatio="none", which would squash any glyph
         inside it and let the stance bars paint straight over the top. -->
    <div class="plots">
      <div class="strip-wrap">
        <div class="strip-keys">
          <span>left</span>
          <span>right</span>
          <span>twitch</span>
          <span>jump</span>
        </div>
        <svg
          class="strip"
          viewBox="0 0 {STRIP_W} 114"
          preserveAspectRatio="none"
          role="img"
          aria-label="Footfall timeline"
        >
          <line x1="0" y1="20" x2={STRIP_W} y2="20" class="rule" />
          <line x1="0" y1="50" x2={STRIP_W} y2="50" class="rule" />
          {#each report.stances as stance (stance.foot + stance.startT)}
            <rect
              x={xOf(stance.startT)}
              y={stance.foot === "left" ? 4 : 34}
              width={Math.max(1.5, xOf(stance.endT) - xOf(stance.startT))}
              height="16"
              class="stance"
              class:skating={stance.slip > 0.02}
            />
          {/each}
          <!-- Drawn under the bars and full height on purpose: a teleport is
               only diagnosable next to what the feet were doing at the time,
               and the moment it lines up with is usually a plant. -->
          {#each report.jolts as jolt (jolt.t + jolt.joint)}
            <line
              x1={xOf(jolt.t)}
              y1="0"
              x2={xOf(jolt.t)}
              y2="104"
              class="jolt-line"
            />
            <line
              x1={xOf(jolt.t)}
              y1="86"
              x2={xOf(jolt.t)}
              y2="104"
              class="jolt"
            />
          {/each}
          {#each report.twitches as twitch (twitch.t + twitch.foot)}
            <line
              x1={xOf(twitch.t)}
              y1={twitch.foot === "left" ? 62 : 72}
              x2={xOf(twitch.t)}
              y2={twitch.foot === "left" ? 72 : 82}
              class="twitch"
            />
          {/each}
        </svg>
      </div>

      <svg
        class="trace"
        viewBox="0 0 {TRACE} {TRACE}"
        role="img"
        aria-label="Footfall trace on the floor"
      >
        {#if trail.length > 1}
          <polyline
            class="path"
            points={trail.map((p) => `${tx(p.x)},${tz(p.z)}`).join(" ")}
          />
        {/if}
        {#each report.stances as stance (stance.foot + stance.startT + "trace")}
          <line
            x1={tx(stance.strike.x)}
            y1={tz(stance.strike.z)}
            x2={tx(stance.release.x)}
            y2={tz(stance.release.z)}
            class="slip"
            class:skating={stance.slip > 0.02}
          />
          <circle
            cx={tx(stance.strike.x)}
            cy={tz(stance.strike.z)}
            r="3.5"
            class="plant"
            class:left={stance.foot === "left"}
          />
        {/each}
      </svg>
    </div>

    <table>
      <tbody>
        {#each rows as row (row.name)}
          <tr class={row.verdict}>
            <th scope="row" title={row.tell}>{row.name}</th>
            <td class="num">{row.value}<span class="unit">{row.unit}</span></td>
            <td class="human">{row.human}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<style>
  .readout {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    border-radius: 0.75rem;
    background: color-mix(in srgb, #0b0f16 88%, transparent);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #e8edf5;
    font-size: 0.8125rem;
  }

  header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
  }

  h3 {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 650;
    letter-spacing: 0.01em;
  }

  .score {
    font-variant-numeric: tabular-nums;
    color: #ff8b8b;
  }
  .score.clean {
    color: #7ee0a0;
  }
  .score.waiting {
    color: #8b97a8;
  }

  .strip-wrap {
    display: grid;
    grid-template-columns: 3.25rem 1fr;
    align-items: stretch;
    gap: 0.375rem;
  }

  .strip-keys {
    /* Anchored to the plot's own coordinate system rather than to fractions of
       whatever height the row happens to have: the svg is 92px for 92 viewBox
       units, so a label at 12px sits on the band drawn at y=12. Proportional
       rows drifted the moment the row gained a taller sibling. */
    position: relative;
    height: 5.75rem;
    font-size: 0.6875rem;
    line-height: 1;
    color: #8b97a8;
    text-align: right;
  }

  .strip-keys span {
    position: absolute;
    right: 0;
    transform: translateY(-50%);
  }

  /* Band centres: left 4-20, right 34-50, twitch 62-82, jump 86-104. */
  .strip-keys span:nth-child(1) {
    top: 12px;
  }

  .strip-keys span:nth-child(2) {
    top: 42px;
  }

  .strip-keys span:nth-child(3) {
    top: 72px;
  }

  .strip-keys span:nth-child(4) {
    top: 95px;
  }

  .strip {
    width: 100%;
    height: 7.125rem;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 0.375rem;
  }

  .axis {
    fill: #8b97a8;
    font-size: 11px;
  }
  .rule {
    stroke: rgba(255, 255, 255, 0.08);
    stroke-width: 1;
  }
  .stance {
    fill: #5ea9ff;
  }
  .stance.skating {
    fill: #ffb020;
  }
  .twitch {
    stroke: #ff5f5f;
    stroke-width: 2;
  }
  .jolt {
    stroke: #ff2fd0;
    stroke-width: 2.5;
  }
  .jolt-line {
    stroke: rgba(255, 47, 208, 0.28);
    stroke-width: 1;
  }

  .plots {
    display: flex;
    gap: 0.75rem;
    /* The trace is square and the strip is fixed at its viewBox height, so the
       row is taller than the strip; centring reads as padding, top-aligning
       reads as a hole. */
    align-items: center;
  }

  .plots .strip-wrap {
    flex: 1 1 auto;
    min-width: 0;
  }

  .trace {
    flex: 0 0 auto;
    width: 9rem;
    height: 9rem;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 0.375rem;
  }

  .path {
    fill: none;
    stroke: rgba(255, 255, 255, 0.22);
    stroke-width: 1.5;
  }
  .slip {
    stroke: #7ee0a0;
    stroke-width: 2.5;
    stroke-linecap: round;
  }
  .slip.skating {
    stroke: #ffb020;
    stroke-width: 3.5;
  }
  .plant {
    fill: #ff5f5f;
  }
  .plant.left {
    fill: #5ea9ff;
  }

  table {
    flex: 1 1 auto;
    border-collapse: collapse;
    width: 100%;
  }

  th {
    text-align: left;
    font-weight: 500;
    color: #c3ccd9;
    padding: 0.1rem 0.5rem 0.1rem 0;
    cursor: help;
    /* A metric name wrapped over three lines is unreadable at a glance, and
       the wrapping is what pushed the last rows off the bottom of the panel.
       The name column takes the slack; the two number columns hug content. */
    white-space: nowrap;
    width: 100%;
  }

  td {
    padding: 0.1rem 0;
  }

  .num {
    /* Reserved so a value going from 9.9 to 10.0 cannot shove the column. */
    min-width: 5.5ch;
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }

  .unit {
    color: #8b97a8;
    font-weight: 400;
    font-size: 0.6875rem;
    margin-left: 0.2rem;
  }

  .human {
    color: #8b97a8;
    padding-left: 0.75rem;
    white-space: nowrap;
  }

  tr.good .num {
    color: #7ee0a0;
  }
  tr.warn .num {
    color: #ffb020;
  }
  tr.bad .num {
    color: #ff5f5f;
  }
  tr.none .num {
    color: #c3ccd9;
  }
</style>
