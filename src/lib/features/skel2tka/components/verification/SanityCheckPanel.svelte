<!--
  SanityCheckPanel - Display automated pre-verification check results

  Shows pass/warning/fail for each sanity check before
  the user proceeds to manual verification.
  Acts as a gate: if any check fails, warns the user
  that manual verification may not be productive.
-->
<script lang="ts">
  import type { SanityCheckReport, SanityCheckResult } from "../../domain/verification-models";

  let {
    report,
  }: {
    report: SanityCheckReport;
  } = $props();

  function severityIcon(severity: string): string {
    switch (severity) {
      case "pass":
        return "fa-check-circle";
      case "warning":
        return "fa-exclamation-triangle";
      case "fail":
        return "fa-times-circle";
      default:
        return "fa-question-circle";
    }
  }

  function severityColor(severity: string): string {
    switch (severity) {
      case "pass":
        return "#22c55e";
      case "warning":
        return "#f59e0b";
      case "fail":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  }

  const passCount = $derived(report.checks.filter((c) => c.severity === "pass").length);
  const warnCount = $derived(report.checks.filter((c) => c.severity === "warning").length);
  const failCount = $derived(report.checks.filter((c) => c.severity === "fail").length);
</script>

<div class="sanity-panel">
  <div class="panel-header">
    <i
      class="fas {severityIcon(report.overallSeverity)}"
      style="color: {severityColor(report.overallSeverity)};"
    ></i>
    <h4>Sanity Checks</h4>
    <span class="summary">
      {passCount} pass
      {#if warnCount > 0}, {warnCount} warn{/if}
      {#if failCount > 0}, {failCount} fail{/if}
    </span>
  </div>

  {#if report.overallSeverity === "fail"}
    <div class="overall-warning">
      Some checks failed. The detection output may not be usable.
      You can still review it, but consider re-recording or adjusting the video.
    </div>
  {/if}

  <div class="checks-list">
    {#each report.checks as check}
      <div class="check-row {check.severity}">
        <i
          class="fas {severityIcon(check.severity)}"
          style="color: {severityColor(check.severity)};"
        ></i>
        <div class="check-content">
          <span class="check-name">{check.name}</span>
          <span class="check-message">{check.message}</span>
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .sanity-panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
  }

  .panel-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .panel-header h4 {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .summary {
    margin-left: auto;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.5));
  }

  .overall-warning {
    padding: 8px 12px;
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 6px;
    font-size: var(--font-size-compact, 12px);
    color: rgba(239, 68, 68, 0.8);
    line-height: 1.4;
  }

  .checks-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .check-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 6px;
    font-size: var(--font-size-compact, 12px);
  }

  .check-row.fail {
    background: rgba(239, 68, 68, 0.05);
  }

  .check-row.warning {
    background: rgba(245, 158, 11, 0.05);
  }

  .check-row i {
    margin-top: 2px;
    flex-shrink: 0;
    font-size: 12px;
  }

  .check-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .check-name {
    font-weight: 600;
    color: var(--theme-text, #ffffff);
  }

  .check-message {
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    line-height: 1.3;
  }
</style>
