export interface CreatorPath {
  creatorId: string | null;
  canonicalPath: string;
  isLegacy: boolean;
}

export function buildCreatorPath(creatorId?: string | null): string {
  return creatorId
    ? `/creators/${encodeURIComponent(creatorId)}`
    : "/creators";
}

export function parseCreatorPathname(pathname: string): CreatorPath | null {
  const parts = pathname
    .replace(/^\/+/, "")
    .split("/")
    .filter(Boolean);

  if (parts[0] === "app") {
    parts.shift();
  }

  const isCanonical = parts[0] === "creators";
  const isLegacy =
    (parts[0] === "browse" || parts[0] === "social") &&
    parts[1] === "creators";

  if (!isCanonical && !isLegacy) return null;

  const encodedId = isCanonical ? parts[1] : parts[2];
  let creatorId: string | null = null;
  if (encodedId) {
    try {
      creatorId = decodeURIComponent(encodedId);
    } catch {
      creatorId = encodedId;
    }
  }

  return {
    creatorId,
    canonicalPath: buildCreatorPath(creatorId),
    isLegacy,
  };
}
