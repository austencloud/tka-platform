const STANDALONE_APP_SURFACES = new Set(["/start"]);

// Whole subtrees that own their URL. /tools/* holds operator pages such as the
// thumbnail warm pass: they need Firebase and auth, but they are not navigation
// modules, and the first segment must never be reinterpreted as a module id.
const STANDALONE_APP_SUBTREES = ["/tools"];

/**
 * These screens use the authenticated app bootstrap, but own their page rather
 * than rendering a navigation module. Module persistence leaves their URLs
 * alone while Firebase and the shared auth state still initialize normally.
 */
export function isStandaloneAppSurface(pathname: string): boolean {
  const normalized =
    pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (STANDALONE_APP_SURFACES.has(normalized)) return true;
  return STANDALONE_APP_SUBTREES.some(
    (root) => normalized === root || normalized.startsWith(root + "/")
  );
}
