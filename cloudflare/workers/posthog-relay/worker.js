/* global caches, fetch, Headers, Request, Response, URL */

const API_HOST = "us.i.posthog.com";
const ASSET_HOST = "us-assets.i.posthog.com";
const ALLOWED_METHODS = new Set(["GET", "POST", "OPTIONS"]);

/** PostHog serves SDK assets and remote config from a separate origin. */
export function resolvePostHogOrigin(pathname) {
  return pathname.startsWith("/static/") || pathname.startsWith("/array/")
    ? ASSET_HOST
    : API_HOST;
}

function withCors(response) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "*");
  headers.set("Vary", "Origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function preflightResponse() {
  return withCors(new Response(null, { status: 204 }));
}

function methodNotAllowedResponse() {
  return withCors(
    new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "GET, POST, OPTIONS" },
    })
  );
}

/**
 * Fixed-upstream PostHog relay. Dependencies are injectable so routing and
 * byte-preservation stay unit-testable outside Cloudflare's runtime.
 */
export async function relayPostHogRequest(
  request,
  { fetchImpl = fetch, cache, waitUntil = () => {} } = {}
) {
  if (!ALLOWED_METHODS.has(request.method)) {
    return methodNotAllowedResponse();
  }
  if (request.method === "OPTIONS") return preflightResponse();

  const incomingUrl = new URL(request.url);
  const upstreamHost = resolvePostHogOrigin(incomingUrl.pathname);
  const upstreamUrl = new URL(request.url);
  upstreamUrl.protocol = "https:";
  upstreamUrl.hostname = upstreamHost;
  upstreamUrl.port = "";

  const isCacheableAsset =
    request.method === "GET" && upstreamHost === ASSET_HOST && cache;
  if (isCacheableAsset) {
    const cached = await cache.match(request);
    if (cached) return withCors(cached);
  }

  const headers = new Headers(request.headers);
  headers.delete("cookie");
  headers.delete("host");
  headers.set("X-Forwarded-For", request.headers.get("CF-Connecting-IP") || "");

  // Cloudflare ReadableStreams have lost encoded PostHog bodies when forwarded
  // directly. Buffer the bytes exactly as PostHog's Worker guide requires.
  const body = request.method === "POST" ? await request.arrayBuffer() : null;
  const upstreamRequest = new Request(upstreamUrl, {
    method: request.method,
    headers,
    body,
    redirect: request.redirect,
  });
  const response = await fetchImpl(upstreamRequest);

  if (isCacheableAsset && response.ok) {
    waitUntil(cache.put(request, response.clone()));
  }

  return withCors(response);
}

export default {
  async fetch(request, _env, context) {
    return relayPostHogRequest(request, {
      cache: caches.default,
      waitUntil: (promise) => context.waitUntil(promise),
    });
  },
};
