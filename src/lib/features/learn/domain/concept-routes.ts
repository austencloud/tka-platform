export const CONCEPT_LIST_PATH = "/learn/concepts";

export function buildConceptPath(conceptId?: string): string {
  return conceptId
    ? `${CONCEPT_LIST_PATH}/${encodeURIComponent(conceptId)}`
    : CONCEPT_LIST_PATH;
}

export function conceptIdFromPathname(pathname: string): string | null {
  const match = /^\/learn\/concepts\/([^/]+)\/?$/.exec(pathname);
  if (!match?.[1]) return null;

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

export function isConceptPath(pathname: string): boolean {
  return (
    pathname === CONCEPT_LIST_PATH ||
    pathname === `${CONCEPT_LIST_PATH}/` ||
    conceptIdFromPathname(pathname) !== null
  );
}
