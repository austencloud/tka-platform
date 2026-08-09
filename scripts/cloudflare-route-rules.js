function removeRedundantRules(rules) {
  const uniqueRules = [...new Set(rules)];
  const wildcardRules = uniqueRules.filter((rule) => rule.endsWith("*"));

  return uniqueRules.filter((rule) => {
    return !wildcardRules.some((wildcard) => {
      if (wildcard === rule) return false;
      return rule.startsWith(wildcard.slice(0, -1));
    });
  });
}

/**
 * Cloudflare rejects a Pages deployment when one route rule is already covered
 * by another rule in the same list. SvelteKit can generate that shape when a
 * static directory wildcard and `<prerendered>` both describe the same page.
 */
export function normalizeCloudflareRouteRules(routes) {
  return {
    ...routes,
    include: removeRedundantRules(routes.include ?? []),
    exclude: removeRedundantRules(routes.exclude ?? []),
  };
}
