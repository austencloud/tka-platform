const STANDALONE_APP_SURFACES = new Set(["/start"]);

/**
 * These screens use the authenticated app bootstrap, but own their page rather
 * than rendering a navigation module. Module persistence leaves their URLs
 * alone while Firebase and the shared auth state still initialize normally.
 */
export function isStandaloneAppSurface(pathname: string): boolean {
  const normalized =
    pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return STANDALONE_APP_SURFACES.has(normalized);
}
