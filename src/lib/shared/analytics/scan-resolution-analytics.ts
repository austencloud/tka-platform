export type ScanResolutionFailureCategory =
  | "missing_code"
  | "offline"
  | "not_found"
  | "load_error";

export function scanResolutionFailureCategory(input: {
  hasShortCode: boolean;
  online: boolean;
  sequenceMissing?: boolean;
}): ScanResolutionFailureCategory {
  if (!input.hasShortCode) return "missing_code";
  if (!input.online) return "offline";
  return input.sequenceMissing ? "not_found" : "load_error";
}
