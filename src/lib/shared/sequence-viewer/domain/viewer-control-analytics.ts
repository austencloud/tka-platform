export type ViewerControlValue = string | number | boolean | null;

export interface ViewerControlEventOptions {
  coalesce?: boolean;
  count?: boolean;
}

export type ViewerControlSink = (
  group: string,
  setting: string,
  previousValue: ViewerControlValue,
  value: ViewerControlValue,
  options?: ViewerControlEventOptions
) => void;

export type ViewerActionSink = (
  action: string,
  properties?: Record<string, ViewerControlValue>,
  options?: ViewerControlEventOptions
) => void;

/** Report a real scalar transition and ignore re-selecting the active value. */
export function reportViewerControlChange(
  sink: ViewerControlSink | undefined,
  group: string,
  setting: string,
  previousValue: ViewerControlValue,
  value: ViewerControlValue,
  options?: ViewerControlEventOptions
): boolean {
  if (previousValue === value) return false;
  sink?.(group, setting, previousValue, value, options);
  return true;
}
