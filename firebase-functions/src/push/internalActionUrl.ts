/** Return an app-relative push target, rejecting external and scheme-relative URLs. */
export function safeInternalActionUrl(value: unknown): string | null {
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//")
    ? value
    : null;
}
