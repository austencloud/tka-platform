export interface ScanPropProperties {
  blue_prop: string | null;
  red_prop: string | null;
  mixed_props: boolean | null;
}

/** Canonical compact prop identity used by scan, export, and super properties. */
export function scanPropProperties(
  blueProp: unknown,
  redProp: unknown
): ScanPropProperties {
  const blue = blueProp === null || blueProp === undefined ? null : String(blueProp);
  const red = redProp === null || redProp === undefined ? null : String(redProp);
  return {
    blue_prop: blue,
    red_prop: red,
    mixed_props: blue !== null && red !== null ? blue !== red : null,
  };
}
