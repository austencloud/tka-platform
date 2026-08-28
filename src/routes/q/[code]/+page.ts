import type { PageLoad } from "./$types";

/**
 * Preserve the server payload without importing scan analytics into the
 * initial route graph. The neutral loading gate stays up while the lazy scan
 * ingress validates the code and hands off to the canonical /sequence route.
 */
export const load: PageLoad = ({ data }) => data;
