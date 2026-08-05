/**
 * Reduce a Firestore document path to collection names only.
 *
 * Document IDs can identify a user or their data, so analytics receives
 * `users/{id}/sequences/{id}` instead of the original path. Collection names
 * remain intact because they are the stable fingerprint used by production
 * verification.
 */
export function toFirestorePathShape(path: unknown): string | undefined {
  if (typeof path !== "string") return undefined;

  const segments = path
    .trim()
    .split("/")
    .filter((segment) => segment.length > 0);
  const documentsIndex = segments.lastIndexOf("documents");
  const documentPath =
    documentsIndex >= 0 ? segments.slice(documentsIndex + 1) : segments;

  if (documentPath.length === 0) return undefined;

  return documentPath
    .map((segment, index) => (index % 2 === 0 ? segment : "{id}"))
    .join("/");
}
