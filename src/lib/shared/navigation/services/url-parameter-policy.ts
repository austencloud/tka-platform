interface RouteScopedParameter {
  name: string;
  isValidForPath: (pathname: string) => boolean;
}

const startsWith = (prefix: string) => (pathname: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

const isLoopLabelerPath = (pathname: string) =>
  startsWith("/admin/loop-labeler")(pathname) ||
  startsWith("/test/loop-labeler")(pathname);

const ROUTE_SCOPED_PARAMETERS: readonly RouteScopedParameter[] = [
  { name: "scan", isValidForPath: startsWith("/browse/library") },
  { name: "handoff", isValidForPath: startsWith("/compose") },
  { name: "feedback", isValidForPath: startsWith("/feedback") },
  { name: "openFeedback", isValidForPath: startsWith("/feedback") },
  { name: "theme", isValidForPath: startsWith("/settings/theme") },
  { name: "pack", isValidForPath: startsWith("/choreo_card/releaser") },
  { name: "room", isValidForPath: startsWith("/museum") },
  { name: "seq", isValidForPath: isLoopLabelerPath },
  { name: "filter", isValidForPath: isLoopLabelerPath },
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
