/**
 * Pure URL rewriting for the offline desktop asset bundle.
 *
 * The desktop build ships runtime 3D assets under a Tauri custom scheme
 * (`tka-assets`, see `src-tauri/src/asset_protocol.rs`). Product code keeps
 * loading `/models/...` paths and `https://assets.tkaflowarts.com/...` URLs
 * exactly as it does on the web; this resolver maps those onto the bundle when,
 * and only when, the bundle manifest lists the file. Anything else passes
 * through untouched, so a surface whose assets were not bundled behaves exactly
 * as it does today instead of hitting a local 404.
 *
 * Bundle layout (mirrors `scripts/desktop-asset-bundle.mjs`):
 *   `<path>`     for files copied from `static/`
 *   `r2/<path>`  for files mirrored from the R2 CDN
 */

export const DESKTOP_ASSET_SCHEME = "tka-assets";

/** Static roots the bundle can hold; matches the collector's scan. */
const BUNDLED_STATIC_ROOTS =
  /^\/(?:models|textures|animations|environments|draco|basis)\//;

const R2_BUNDLE_PREFIX = "r2";

function isR2Host(hostname: string): boolean {
  return (
    hostname === "assets.tkaflowarts.com" || hostname.endsWith(".r2.dev")
  );
}

export interface DesktopAssetResolverOptions {
  /** Scheme origin with no trailing slash, e.g. `https://tka-assets.localhost`. */
  origin: string;
  /** Membership test against the bundle manifest (paths without a leading slash). */
  has: (bundlePath: string) => boolean;
  /** The webview's own origin, so absolute same-origin URLs also resolve. */
  pageOrigin?: string;
}

/**
 * Convert a runtime asset URL into its bundle path, or null when the URL is
 * not something the bundle can hold.
 */
export function toBundlePath(
  url: string,
  pageOrigin?: string
): string | null {
  if (!url || url.startsWith("data:") || url.startsWith("blob:")) return null;

  let pathname: string;
  let fromR2 = false;
  if (url.startsWith("/") && !url.startsWith("//")) {
    pathname = url;
  } else {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }
    if (isR2Host(parsed.hostname)) {
      fromR2 = true;
      pathname = parsed.pathname;
    } else if (pageOrigin && parsed.origin === pageOrigin) {
      pathname = parsed.pathname;
    } else {
      return null;
    }
  }

  const cleanPath = pathname.split(/[?#]/)[0] ?? pathname;
  if (!fromR2 && !BUNDLED_STATIC_ROOTS.test(cleanPath)) return null;
  if (cleanPath.endsWith("/")) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(cleanPath);
  } catch {
    return null;
  }
  const relative = decoded.replace(/^\/+/, "");
  if (relative.split("/").includes("..")) return null;
  return fromR2 ? `${R2_BUNDLE_PREFIX}/${relative}` : relative;
}

export function createDesktopAssetResolver({
  origin,
  has,
  pageOrigin,
}: DesktopAssetResolverOptions): (url: string) => string {
  const base = origin.replace(/\/+$/, "");
  return (url: string): string => {
    const bundlePath = toBundlePath(url, pageOrigin);
    if (!bundlePath || !has(bundlePath)) return url;
    const encoded = bundlePath.split("/").map(encodeURIComponent).join("/");
    return `${base}/${encoded}`;
  };
}

/**
 * Wrap `fetch` so plain requests for bundled assets also land on the bundle.
 * The scene package probes optional animation packs with HEAD requests and
 * reads `.motion.json` / `.contact.json` sidecars through `fetch` directly,
 * none of which pass through a three.js loading manager. Off-bundle requests
 * are forwarded untouched.
 */
export function createDesktopFetch(
  resolve: (url: string) => string,
  baseFetch: typeof fetch
): typeof fetch {
  return function desktopFetch(input, init) {
    if (typeof input === "string") {
      return baseFetch(resolve(input), init);
    }
    if (input instanceof URL) {
      const resolved = resolve(input.href);
      return baseFetch(resolved === input.href ? input : resolved, init);
    }
    if (input instanceof Request) {
      const resolved = resolve(input.url);
      return baseFetch(
        resolved === input.url ? input : new Request(resolved, input),
        init
      );
    }
    return baseFetch(input, init);
  };
}
