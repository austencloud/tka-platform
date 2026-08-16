<script lang="ts">
  import type {
    AutomatedPursuitReport,
    AutomatedPursuitState,
    CursorCaptureState,
    LiveCursorCaptureReport,
  } from "./cursor-escape-capture";
  import { automatedPursuitPassed } from "./cursor-escape-capture";

  interface Props {
    state: CursorCaptureState;
    report: LiveCursorCaptureReport | null;
    status: string;
    ready: boolean;
    controlledTrialActive: boolean;
    expectedManeuverMilliseconds: number;
    maximumStageThreeStepDegrees: number;
    pursuitState: AutomatedPursuitState;
    pursuitReport: AutomatedPursuitReport | null;
    onArm: () => void;
    onCancel: () => void;
    onRunPursuit: () => void;
  }

  let {
    state,
    report,
    status,
    ready,
    controlledTrialActive,
    expectedManeuverMilliseconds,
    maximumStageThreeStepDegrees,
    pursuitState,
    pursuitReport,
    onArm,
    onCancel,
    onRunPursuit,
  }: Props = $props();

  const busy = $derived(state === "armed" || state === "recording");
  const buttonLabel = $derived(
    busy
      ? "Cancel capture"
      : state === "complete"
        ? "Arm another capture"
        : "Arm cursor capture"
  );
  const pursuitPassed = $derived(automatedPursuitPassed(pursuitReport));
  const pursuitButtonLabel = $derived(
    pursuitState === "running"
      ? "Running auto chase"
      : pursuitState === "complete"
        ? "Run auto chase again"
        : "Run auto chase"
  );
  const endedEarly = $derived(
    report !== null &&
      report.firstManeuverDurationMilliseconds !== null &&
      report.firstManeuverDurationMilliseconds <
        expectedManeuverMilliseconds - 20
  );
  const weakScamper = $derived(
    report !== null &&
      (report.firstResponseNetDisplacementBodyLengths === null ||
        report.firstResponseNetDisplacementBodyLengths < 5.5 ||
        report.firstResponseClearanceGainBodyLengths === null ||
        report.firstResponseClearanceGainBodyLengths < 5.5 ||
        report.firstResponseTravelEfficiency === null ||
        report.firstResponseTravelEfficiency < 0.9)
  );

  function format(value: number | null | undefined, digits = 2): string {
    return value === null || value === undefined || !Number.isFinite(value)
      ? "—"
      : value.toFixed(digits);
  }
</script>

<section
  class="cursor-capture-block"
  data-capture-state={state}
  data-capture-report={report ? JSON.stringify(report) : undefined}
  data-pursuit-state={pursuitState}
  data-pursuit-report={pursuitReport
    ? JSON.stringify(pursuitReport)
    : undefined}
>
  <div class="section-heading">
    <div>
      <p class="eyebrow">LIVE CURSOR CAPTURE</p>
      <h2>Measure the full scamper</h2>
    </div>
    <strong class={`capture-state ${state}`}>{state}</strong>
  </div>
  <div class="capture-actions">
    <button
      class="capture-action"
      type="button"
      onclick={busy ? onCancel : onArm}
      disabled={!ready || controlledTrialActive || pursuitState === "running"}
      >{buttonLabel}</button
    >
    <button
      class="pursuit-action"
      type="button"
      onclick={onRunPursuit}
      disabled={!ready ||
        controlledTrialActive ||
        busy ||
        pursuitState === "running"}>{pursuitButtonLabel}</button
    >
  </div>
  <p class="capture-instruction" aria-live="polite">{status}</p>

  <div class="capture-metrics" aria-label="Live cursor escape measurements">
    <div>
      <span>Scamper net</span>
      <strong
        >{format(report?.firstResponseNetDisplacementBodyLengths)} BL</strong
      >
    </div>
    <div>
      <span>Scamper clearance</span>
      <strong>{format(report?.firstResponseClearanceGainBodyLengths)} BL</strong
      >
    </div>
    <div>
      <span>Scamper efficiency</span>
      <strong
        >{format(
          report?.firstResponseTravelEfficiency === null ||
            report?.firstResponseTravelEfficiency === undefined
            ? null
            : report.firstResponseTravelEfficiency * 100,
          0
        )}%</strong
      >
    </div>
    <div>
      <span>First turn</span>
      <strong
        >{format(report?.firstManeuverTurnLatencyMilliseconds, 0)} ms</strong
      >
    </div>
    <div>
      <span>First fast-start</span>
      <strong>{format(report?.firstManeuverDurationMilliseconds, 0)} ms</strong>
    </div>
    <div>
      <span>Escape events</span>
      <strong>{report?.escapeEventCount ?? "—"}</strong>
    </div>
    <div>
      <span>Peak speed</span>
      <strong>{format(report?.peakSpeedBodyLengths)} BL/s</strong>
    </div>
    <div>
      <span>Full response</span>
      <strong>{format(report?.firstResponseDurationMilliseconds, 0)} ms</strong>
    </div>
    <div>
      <span>Cursor travel</span>
      <strong>{format(report?.pointerPathBodyLengths)} BL</strong>
    </div>
    <div>
      <span>Stage-three turn</span>
      <strong>{format(report?.stageThreeHeadingChangeDegrees, 0)}°</strong>
    </div>
    <div>
      <span>Largest swim step</span>
      <strong>{format(report?.maximumStageThreeHeadingStepDegrees)}°</strong>
    </div>
    <div>
      <span>Live clearance</span>
      <strong>{format(report?.minimumLiveClearanceBodyLengths)} BL</strong>
    </div>
  </div>
  <div
    class="capture-metrics pursuit-metrics"
    class:passed={pursuitPassed}
    aria-label="Automated pursuit measurements"
  >
    <div>
      <span>Retarget latency</span>
      <strong>{format(pursuitReport?.retargetLatencyMilliseconds, 0)} ms</strong
      >
    </div>
    <div>
      <span>Largest heading step</span>
      <strong>{format(pursuitReport?.maximumHeadingStepDegrees)}°</strong>
    </div>
    <div>
      <span>Course change</span>
      <strong>{format(pursuitReport?.retargetDegrees, 0)}°</strong>
    </div>
    <div>
      <span>Late chase speed</span>
      <strong
        >{format(pursuitReport?.minimumLateChaseSpeedBodyLengths)} BL/s</strong
      >
    </div>
    <div>
      <span>Response at 6 s</span>
      <strong
        >{pursuitReport
          ? pursuitReport.activeAfterBaseline
            ? "active"
            : "ended"
          : "—"}</strong
      >
    </div>
    <div>
      <span>Escape events</span>
      <strong>{pursuitReport?.escapeEventCount ?? "—"}</strong>
    </div>
  </div>
  <p class:passed={pursuitPassed} class="pursuit-note">
    {pursuitState === "running"
      ? "The cursor is changing sides while the same fish remains in one escape."
      : pursuitReport
        ? pursuitPassed
          ? `PASS: one continuous escape, capped at ${format(maximumStageThreeStepDegrees)}° per simulation step.`
          : "CHECK: at least one pursuit gate fell outside its measured limit."
        : "The automatic chase crosses behind the fish, keeps pursuing, then measures recovery."}
  </p>
  <p class="capture-note">
    {report?.wrapped
      ? "The fish crossed a screen edge, so net displacement is withheld."
      : endedEarly
        ? `Fast-start ended early. Expected ${Math.round(expectedManeuverMilliseconds)} ms.`
        : weakScamper
          ? "The fish is still folding back or failing to make enough distance."
          : report && report.escapeEventCount > 1
            ? `${report.escapeEventCount} separate escape events were captured.`
            : report
              ? "One fast-start became one committed scamper away from the threat."
              : "The green line is the fish. The pale dashed line is your cursor."}
  </p>
</section>

<style>
  .cursor-capture-block {
    padding: clamp(0.9rem, 1.15vw, 1.35rem);
    border-bottom: 1px solid var(--line-subtle);
    background: color-mix(
      in srgb,
      var(--cursor-capture) 5%,
      var(--surface-panel)
    );
  }

  .section-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.9rem;
  }

  .eyebrow {
    margin: 0 0 0.35rem;
    color: #6f9eb2;
    font:
      700 0.68rem/1 ui-monospace,
      SFMono-Regular,
      Consolas,
      monospace;
    letter-spacing: 0.16em;
  }

  h2,
  p {
    margin-top: 0;
  }

  h2 {
    margin-bottom: 0;
    font-size: clamp(0.98rem, 1.15vw, 1.2rem);
    line-height: 1.15;
    letter-spacing: -0.018em;
  }

  .capture-state {
    color: var(--text-secondary);
    font:
      700 0.66rem/1 ui-monospace,
      SFMono-Regular,
      Consolas,
      monospace;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .capture-state.armed,
  .capture-state.recording,
  .capture-state.complete {
    color: var(--cursor-capture);
  }

  button {
    width: 100%;
    min-height: 3rem;
    border: 1px solid color-mix(in srgb, var(--cursor-capture) 52%, transparent);
    border-radius: 0.7rem;
    color: var(--text-primary);
    background: var(--surface-raised);
    font:
      700 var(--font-size-min, 0.875rem) / 1 ui-sans-serif,
      system-ui,
      sans-serif;
    cursor: pointer;
  }

  .capture-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.55rem;
  }

  .pursuit-action {
    border-color: color-mix(in srgb, var(--cursor-capture) 52%, transparent);
  }

  button:hover:not(:disabled) {
    border-color: rgba(210, 240, 251, 0.58);
    background: rgba(16, 54, 75, 0.96);
  }

  button:focus-visible {
    outline: 2px solid var(--burst);
    outline-offset: 2px;
  }

  button:disabled {
    cursor: wait;
    opacity: 0.42;
  }

  .capture-instruction {
    min-height: 2.4rem;
    margin: 0.7rem 0;
    color: var(--text-secondary);
    font-size: var(--font-size-compact, 0.75rem);
    line-height: 1.45;
  }

  .capture-metrics {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    overflow: hidden;
    border: 1px solid var(--line-subtle);
    border-radius: 0.7rem;
  }

  .pursuit-metrics {
    margin-top: 0.7rem;
  }

  .pursuit-metrics.passed {
    border-color: color-mix(in srgb, var(--cursor-capture) 42%, transparent);
  }

  .capture-metrics div {
    display: grid;
    gap: 0.25rem;
    min-width: 0;
    padding: 0.6rem;
    border-right: 1px solid var(--line-subtle);
    border-bottom: 1px solid var(--line-subtle);
  }

  .capture-metrics div:nth-child(3n) {
    border-right: 0;
  }

  .capture-metrics div:nth-last-child(-n + 3) {
    border-bottom: 0;
  }

  .capture-metrics span,
  .pursuit-note,
  .capture-note {
    color: var(--text-secondary);
    font-size: var(--font-size-compact, 0.75rem);
  }

  .capture-metrics strong {
    overflow: hidden;
    color: var(--text-primary);
    font:
      700 var(--font-size-min, 0.875rem) / 1.1 ui-monospace,
      SFMono-Regular,
      Consolas,
      monospace;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .capture-note {
    margin: 0.65rem 0 0;
    line-height: 1.4;
  }

  .pursuit-note {
    margin: 0.65rem 0 0;
    line-height: 1.4;
  }

  .pursuit-note.passed {
    color: var(--cursor-capture);
  }

  @media (min-width: 2200px) {
    .cursor-capture-block {
      padding: 1.55rem;
    }

    button {
      min-height: 3.2rem;
      font-size: 0.86rem;
    }
  }

  @media (min-width: 3000px) {
    .cursor-capture-block {
      padding: 2.1rem;
    }

    h2 {
      font-size: 1.6rem;
    }

    .eyebrow {
      font-size: 0.76rem;
    }

    button {
      min-height: 3.8rem;
      font-size: 1.05rem;
    }

    .capture-instruction,
    .capture-note,
    .capture-metrics span {
      font-size: 0.9rem;
    }
  }

  @media (max-height: 950px) and (min-width: 901px) {
    .cursor-capture-block {
      padding: 0.72rem 1rem;
    }
  }

  @media (max-width: 560px) {
    .capture-metrics {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .capture-metrics div:nth-child(3n) {
      border-right: 1px solid var(--line-subtle);
    }

    .capture-metrics div:nth-child(2n) {
      border-right: 0;
    }

    .capture-metrics div:nth-last-child(-n + 3) {
      border-bottom: 1px solid var(--line-subtle);
    }

    .capture-metrics div:nth-last-child(-n + 2) {
      border-bottom: 0;
    }
  }

  @media (max-height: 520px) and (min-width: 700px) {
    .cursor-capture-block {
      padding: 0.7rem;
    }
  }
</style>
