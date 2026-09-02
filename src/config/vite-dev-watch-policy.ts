import type { Stats } from "node:fs";
import path from "node:path";

export const ARROW_SPRITE_WATCH_PATH = path.join(
  "static",
  "images",
  "arrows-sprite.svg"
);
export const I18N_MESSAGES_WATCH_PATH = "messages";

const APP_SOURCE_WATCH_PATH = "src";
// SvelteKit rewrites its generated client/server route manifest here whenever
// a route file is added or removed. Vite only invalidates a cached module when
// its watcher reports the change, so this subtree must stay watched or every
// brand-new route serves the stale manifest until the server restarts.
const SVELTEKIT_OUTPUT_PATH = ".svelte-kit";
const SVELTEKIT_GENERATED_PATH = "generated";
const PACKAGES_WATCH_PATH = "packages";
const PACKAGE_SOURCE_WATCH_PATH = "src";

function isInside(parentPath: string, candidatePath: string): boolean {
  const relativePath = path.relative(parentPath, candidatePath);
  return (
    relativePath === "" ||
    (relativePath !== ".." &&
      !relativePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativePath))
  );
}

function isFileOrNeedsStat(stats?: Stats): boolean {
  return stats === undefined || stats.isFile();
}

export function createViteDevWatchIgnoredMatcher(projectRoot: string) {
  const resolvedRoot = path.resolve(projectRoot);
  const arrowSpritePath = path.resolve(resolvedRoot, ARROW_SPRITE_WATCH_PATH);

  return (candidatePath: string, stats?: Stats): boolean => {
    const resolvedCandidate = path.isAbsolute(candidatePath)
      ? path.normalize(candidatePath)
      : path.resolve(resolvedRoot, candidatePath);

    // Vite adds config dependencies and environment files separately. If one
    // lives outside this checkout, leave it alone rather than hiding it from
    // Vite's own restart logic.
    if (!isInside(resolvedRoot, resolvedCandidate)) return false;

    const relativePath = path.relative(resolvedRoot, resolvedCandidate);
    if (relativePath === "") return false;

    // The sprite is the only static asset with custom HMR. Keep each parent in
    // scope so Chokidar can reach the file without scanning sibling assets.
    if (isInside(resolvedCandidate, arrowSpritePath)) return false;

    const pathParts = relativePath.split(path.sep);
    const rootEntry = pathParts[0];

    if (
      rootEntry === APP_SOURCE_WATCH_PATH ||
      rootEntry === I18N_MESSAGES_WATCH_PATH
    ) {
      return false;
    }

    if (rootEntry === PACKAGES_WATCH_PATH) {
      // Package roots and their config files stay visible, but generated
      // output, tests, and package-local dependencies do not need app HMR.
      if (pathParts.length <= 2) return false;
      if (pathParts[2] === PACKAGE_SOURCE_WATCH_PATH) return false;
      if (pathParts.length === 3) return !isFileOrNeedsStat(stats);
      return true;
    }

    if (rootEntry === SVELTEKIT_OUTPUT_PATH) {
      // Keep the generated manifest in HMR scope; types and build output stay
      // out of it.
      if (pathParts.length === 1) return false;
      return pathParts[1] !== SVELTEKIT_GENERATED_PATH;
    }

    // Chokidar calls a two-argument matcher once before and once after stat.
    // Let the first call inspect a root entry, then prune every unlisted
    // directory or junction while preserving root config and environment files.
    if (pathParts.length === 1) return !isFileOrNeedsStat(stats);

    return true;
  };
}
