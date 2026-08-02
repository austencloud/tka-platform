import type { PageLoad } from "./$types";

/**
 * Preserve the server payload without importing analytics into the initial
 * route graph. The neutral loading gate stays up until QScanPage reports the
 * complete viewer ready; loading PostHog before then would pull the general
 * vendor chunk into the viewer's critical path.
 */
export const load: PageLoad = ({ data }) => data;
