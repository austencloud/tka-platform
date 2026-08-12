export function resolveNativeDeepLinkTarget(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const originalTarget = parsed.pathname + parsed.search + parsed.hash;
  if (!originalTarget || originalTarget === "/") return null;

  const qMatch = parsed.pathname.match(/^\/q\/([^/?#]+)/);
  if (!qMatch?.[1]) return originalTarget;

  // A printed card carries its prop pair and physical-card identity in the
  // query string. Keep all of that scan intent when Android opens the in-app
  // viewer; dropping it makes a club card fall back to the user's saved prop.
  const searchParams = new URLSearchParams(parsed.search);
  searchParams.set("v", qMatch[1]);
  const search = searchParams.size > 0 ? `?${searchParams.toString()}` : "";
  return `/browse/gallery${search}${parsed.hash}`;
}
