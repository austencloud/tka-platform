export interface ScanPropProperties {
  left_prop: string | null;
  right_prop: string | null;
  mixed_props: boolean | null;
}

/** Canonical compact prop identity used by scan, export, and super properties. */
export function scanPropProperties(
  leftProp: unknown,
  rightProp: unknown
): ScanPropProperties {
  const left =
    leftProp === null || leftProp === undefined ? null : String(leftProp);
  const right =
    rightProp === null || rightProp === undefined ? null : String(rightProp);
  return {
    left_prop: left,
    right_prop: right,
    mixed_props: left !== null && right !== null ? left !== right : null,
  };
}
