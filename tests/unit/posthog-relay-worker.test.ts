import { describe, expect, it, vi } from "vitest";
import {
  relayPostHogRequest,
  resolvePostHogOrigin,
} from "../../cloudflare/workers/posthog-relay/worker.js";

describe("PostHog relay Worker", () => {
  it("uses the asset origin only for static SDK and remote-config paths", () => {
    expect(resolvePostHogOrigin("/static/recorder.js")).toBe(
      "us-assets.i.posthog.com"
    );
    expect(resolvePostHogOrigin("/array/project/config")).toBe(
      "us-assets.i.posthog.com"
    );
    expect(resolvePostHogOrigin("/e/")).toBe("us.i.posthog.com");
    expect(resolvePostHogOrigin("/s/abc")).toBe("us.i.posthog.com");
  });

  it("strips cookies, preserves client IP and forwards POST bytes unchanged", async () => {
    const payload = new Uint8Array([0, 255, 17, 42]);
    const fetchImpl = vi.fn(async (upstream: Request) => {
      expect(upstream.url).toBe(
        "https://us.i.posthog.com/s/?ip=1&compression=gzip"
      );
      expect(upstream.headers.get("cookie")).toBeNull();
      expect(upstream.headers.get("x-forwarded-for")).toBe("203.0.113.7");
      expect(new Uint8Array(await upstream.arrayBuffer())).toEqual(payload);
      return new Response("ok", { status: 200 });
    });

    const response = await relayPostHogRequest(
      new Request("https://rune.tkaflowarts.com/s/?ip=1&compression=gzip", {
        method: "POST",
        headers: {
          cookie: "must-not-leave-the-edge=1",
          "CF-Connecting-IP": "203.0.113.7",
          "Content-Type": "application/octet-stream",
        },
        body: payload,
      }),
      { fetchImpl }
    );

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("caches successful asset responses and reuses the cached response", async () => {
    const cachedResponse = new Response("cached", { status: 200 });
    const cache = {
      match: vi.fn(async () => cachedResponse),
      put: vi.fn(async () => undefined),
    };
    const fetchImpl = vi.fn();

    const response = await relayPostHogRequest(
      new Request("https://rune.tkaflowarts.com/static/recorder.js"),
      { fetchImpl, cache }
    );

    expect(await response.text()).toBe("cached");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(cache.put).not.toHaveBeenCalled();
  });

  it("stores a fresh asset response through waitUntil", async () => {
    const cache = {
      match: vi.fn(async () => undefined),
      put: vi.fn(async () => undefined),
    };
    const waitUntil = vi.fn((promise: Promise<unknown>) => promise);
    const fetchImpl = vi.fn(async () => new Response("fresh", { status: 200 }));

    const response = await relayPostHogRequest(
      new Request("https://rune.tkaflowarts.com/array/project/config"),
      { fetchImpl, cache, waitUntil }
    );

    expect(await response.text()).toBe("fresh");
    expect(waitUntil).toHaveBeenCalledOnce();
    expect(cache.put).toHaveBeenCalledOnce();
  });

  it("handles CORS preflight without contacting PostHog", async () => {
    const fetchImpl = vi.fn();
    const response = await relayPostHogRequest(
      new Request("https://rune.tkaflowarts.com/e/", { method: "OPTIONS" }),
      { fetchImpl }
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-methods")).toBe(
      "GET, POST, OPTIONS"
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects unsupported methods instead of becoming a general relay", async () => {
    const fetchImpl = vi.fn();
    const response = await relayPostHogRequest(
      new Request("https://rune.tkaflowarts.com/e/", { method: "DELETE" }),
      { fetchImpl }
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, POST, OPTIONS");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
