import { describe, expect, it } from "vitest";
import { normalizeCloudflareRouteRules } from "../../scripts/cloudflare-route-rules.js";

describe("Cloudflare Pages route rules", () => {
  it("removes prerendered guide routes already covered by the guide wildcard", () => {
    const normalized = normalizeCloudflareRouteRules({
      version: 1,
      include: ["/*"],
      exclude: [
        "/guide/*",
        "/guide",
        "/guide/__data.json",
        "/guide/level-1",
        "/guide/level-1/__data.json",
      ],
    });

    expect(normalized).toEqual({
      version: 1,
      include: ["/*"],
      exclude: ["/guide/*", "/guide"],
    });
  });

  it("removes duplicate and narrower wildcard rules without reordering owners", () => {
    const normalized = normalizeCloudflareRouteRules({
      version: 1,
      include: ["/api/*", "/api/v1/*", "/api/status", "/api/*"],
      exclude: ["/fonts/*", "/fonts/brand/*", "/favicon.png"],
    });

    expect(normalized.include).toEqual(["/api/*"]);
    expect(normalized.exclude).toEqual(["/fonts/*", "/favicon.png"]);
  });

  it("does not mutate the adapter output object", () => {
    const routes = {
      version: 1,
      include: ["/*"],
      exclude: ["/guide/*", "/guide/__data.json"],
    };

    normalizeCloudflareRouteRules(routes);

    expect(routes.exclude).toEqual(["/guide/*", "/guide/__data.json"]);
  });
});
