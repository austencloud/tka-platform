interface RouteScopedParameter {
  name: string;
  isValidForPath: (pathname: string) => boolean;
}

const startsWith = (prefix: string) => (pathname: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

const ROUTE_SCOPED_PARAMETERS: readonly RouteScopedParameter[] = [
  {
    name: "letter",
    isValidForPath: (pathname) =>
      startsWith("/glossary")(pathname) ||
      pathname === "/browse/explore/sequences",
  },
  { name: "grid", isValidForPath: startsWith("/glossary") },
  { name: "variation", isValidForPath: startsWith("/glossary") },
  { name: "leftTurns", isValidForPath: startsWith("/glossary") },
  { name: "rightTurns", isValidForPath: startsWith("/glossary") },
  { name: "leftRotation", isValidForPath: startsWith("/glossary") },
  { name: "rightRotation", isValidForPath: startsWith("/glossary") },
  // Preserve published legacy links until the route parser normalizes them.
  { name: "blueTurns", isValidForPath: startsWith("/glossary") },
  { name: "redTurns", isValidForPath: startsWith("/glossary") },
  { name: "blueRotation", isValidForPath: startsWith("/glossary") },
  { name: "redRotation", isValidForPath: startsWith("/glossary") },
  {
    name: "scan",
    isValidForPath: (pathname) =>
      startsWith("/browse/you/collections")(pathname) ||
      startsWith("/browse/library")(pathname) ||
      startsWith("/browse/collections")(pathname),
  },
  { name: "handoff", isValidForPath: startsWith("/compose") },
  { name: "feedback", isValidForPath: startsWith("/feedback") },
  { name: "openFeedback", isValidForPath: startsWith("/feedback") },
  { name: "theme", isValidForPath: startsWith("/settings/theme") },
  { name: "pack", isValidForPath: startsWith("/choreo_card/releaser") },
  { name: "room", isValidForPath: startsWith("/museum") },
  { name: "inspectUser", isValidForPath: startsWith("/admin/users") },
  { name: "inspectSession", isValidForPath: startsWith("/admin/users") },
];

const ONE_REQUEST_PARAMETERS = ["fresh", "from", "code", "section"] as const;

export function pruneRouteScopedParams(url: URL, pathname: string): void {
  for (const parameter of ROUTE_SCOPED_PARAMETERS) {
    if (!parameter.isValidForPath(pathname)) {
      url.searchParams.delete(parameter.name);
    }
  }
}

export function pruneParamsForNavigation(url: URL, pathname: string): void {
  for (const name of ONE_REQUEST_PARAMETERS) {
    url.searchParams.delete(name);
  }

  pruneRouteScopedParams(url, pathname);
}
