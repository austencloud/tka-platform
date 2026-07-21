import { LAUNCHPAD_TILES } from "$lib/shared/landing/components/launchpad/launchpad-tiles";

/** Landing destinations with a shared-element counterpart on the home page. */
export const LAUNCHPAD_MORPH_PATHS: readonly string[] = Object.freeze(
  LAUNCHPAD_TILES.filter((tile) => tile.morphName).map((tile) => tile.href)
);

const launchpadMorphPaths = new Set(LAUNCHPAD_MORPH_PATHS);

type RouteLocation = Pick<URL, "pathname">;

function isRouteWithin(pathname: string, root: string): boolean {
  return pathname === root || pathname.startsWith(`${root}/`);
}

/**
 * True only when both ends of a client navigation provide the same named
 * transition participant. Keeping this pure makes allowlist drift testable.
 */
export function navigationMorphs(
  from: RouteLocation | null | undefined,
  to: RouteLocation | null | undefined
): boolean {
  if (!from || !to || from.pathname === to.pathname) return false;

  const a = from.pathname;
  const b = to.pathname;
  const sequencePair = (x: string, y: string): boolean =>
    isRouteWithin(x, "/browse") && isRouteWithin(y, "/sequence");
  if (sequencePair(a, b) || sequencePair(b, a)) return true;

  const launchpadPair = (x: string, y: string): boolean =>
    x === "/" && launchpadMorphPaths.has(y);
  return launchpadPair(a, b) || launchpadPair(b, a);
}
