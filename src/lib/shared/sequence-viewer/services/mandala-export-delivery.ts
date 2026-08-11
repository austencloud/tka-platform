export type MandalaExportDeliveryOutcome = "completed" | "failed" | "canceled";

export interface MandalaExportDelivery {
  outcome: MandalaExportDeliveryOutcome;
  /**
   * `handoff` = the render was returned to its caller rather than saved or
   * shared here. That is the share sheet's path: it uploads the same blob, so
   * a second delivery would be a duplicate file. It reaches analytics as
   * `delivery_method`, which is the point — a mandala rendered to post is not
   * the same event as one rendered to keep.
   */
  method: "share" | "download" | "handoff" | null;
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
