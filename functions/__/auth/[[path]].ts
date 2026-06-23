/**
 * Firebase Auth Handler Reverse Proxy — Cloudflare Pages Function
 *
 * Transparently forwards  /__/auth/*  on the app's own host
 *   → https://the-kinetic-alphabet.firebaseapp.com/__/auth/*
 *
 * Why: Firebase's OAuth popup/redirect runs against the `authDomain` handler.
 * When that handler lives on the default *.firebaseapp.com (a different site
 * from the app), iOS Safari's ITP partitions its storage and the OAuth
 * handshake can't complete — the popup closes with auth/popup-closed-by-user.
 * Serving the handler first-party (same site as the app) through this proxy
 * fixes it. `resolveAuthDomain()` in src/lib/shared/auth/firebase.ts points
 * authDomain at the app host so the SDK requests the handler here.
 *
 * This is a true pass-through (not a 302), per Firebase's reverse-proxy recipe:
 * https://firebase.google.com/docs/auth/web/redirect-best-practices
 *
 * Catch-all route: [[path]] matches every segment under /__/auth/.
 */

const UPSTREAM_ORIGIN = "https://the-kinetic-alphabet.firebaseapp.com";

export const onRequest: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  const upstream = new URL(url.pathname + url.search, UPSTREAM_ORIGIN);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  // redirect: "manual" keeps any upstream redirect transparent to the browser
  // instead of the proxy silently following it server-side.
  return fetch(upstream.toString(), {
    method: request.method,
    headers: request.headers,
    body: hasBody ? request.body : undefined,
    redirect: "manual",
  });
};
