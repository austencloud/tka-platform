import type { PageLoad } from "./$types";

/**
 * Preserve the server payload without importing analytics into the initial
 * route graph. QScanPage opens the visit after the server-rendered card is
 * stable; loading PostHog before the first visual made the scanner download the
 * entire general vendor chunk ahead of its pictographs.
 */
export const load: PageLoad = ({ data }) => data;
