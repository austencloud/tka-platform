export type MandalaExportDeliveryOutcome =
  | "completed"
  | "failed"
  | "canceled";

export interface MandalaExportDelivery {
  outcome: MandalaExportDeliveryOutcome;
  method: "share" | "download" | null;
}

export function resolveMandalaExportDelivery(result: {
  success: boolean;
  canceled?: boolean;
  method: "share" | "download";
}): MandalaExportDelivery {
  return {
    outcome: result.canceled
      ? "canceled"
      : result.success
        ? "completed"
        : "failed",
    method: result.method,
  };
}
