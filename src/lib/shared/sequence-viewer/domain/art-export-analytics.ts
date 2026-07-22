export type ArtExportType = "mandala" | "tunnel";
export type ArtExportStage =
  | "requested"
  | "gated"
  | "started"
  | "completed"
  | "failed"
  | "canceled"
  | "retry";
export type ArtExportAnalyticsValue = string | number | boolean | null;
export type ArtExportEventSink = (
  artType: ArtExportType,
  stage: ArtExportStage,
  properties?: Record<string, ArtExportAnalyticsValue>
) => void;

export function mandalaStageForPhase(
  previous: string,
  phase: string
): "started" | "completed" | "failed" | null {
  if (previous === phase) return null;
  if (phase === "capturing") return "started";
  if (phase === "complete") return "completed";
  if (phase === "error") return "failed";
  return null;
}

export function tunnelStagesForState(input: {
  previousExporting: boolean;
  exporting: boolean;
  error: string | null;
  reportedError: string | null;
}): {
  stages: Array<"started" | "failed">;
  reportedError: string | null;
} {
  const stages: Array<"started" | "failed"> = [];
  if (input.exporting && !input.previousExporting) stages.push("started");
  if (input.error && input.error !== input.reportedError) stages.push("failed");
  return {
    stages,
    reportedError: input.error,
  };
}

export function exportDeliveryStage(result: {
  success: boolean;
  canceled?: boolean;
}): "completed" | "failed" | "canceled" {
  if (result.canceled) return "canceled";
  return result.success ? "completed" : "failed";
}
