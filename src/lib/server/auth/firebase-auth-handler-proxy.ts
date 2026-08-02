/**
 * Firebase Auth Handler Reverse Proxy (runs inside the SvelteKit worker)
 *
 * Transparently forwards  /__/auth/*  on the app's own host
 *   → https://the-kinetic-alphabet.firebaseapp.com/__/auth/*
 *
 * Why first-party: Firebase's OAuth popup/redirect runs against the `authDomain`
 * handler. iOS Safari (ITP) partitions third-party storage, so when the handler
 * lives on the default *.firebaseapp.com (a different site from the app) the
 * handshake can't read back its own state and the popup closes with
 * auth/popup-closed-by-user. `resolveAuthDomain()` (auth-domain.ts) points
 * authDomain at the app host on tkaflowarts.com so the SDK requests the handler
 * here, where this proxy forwards it on.
 *
 * Why it lives in the worker (NOT functions/): this was originally a Cloudflare
 * Pages Function (functions/__/auth/[[path]].ts), but @sveltejs/adapter-cloudflare
 * emits an advanced-mode `_worker.js`, and Cloudflare Pages IGNORES the
 * functions/ directory whenever a `_worker.js` is present. So the Pages Function
 * never ran — /__/auth/handler fell through to the SPA and the OAuth popup
 * loaded the whole app instead of completing sign-in. Serving it from the server
 * `handle` hook (before resolve()) is the only path that actually executes on the
 * app host. Running before resolve() also sidesteps SvelteKit's CSRF origin check,
 * which would otherwise 403 the cross-origin POSTs Firebase's handler receives.
 *
 * True pass-through (not a 302), per Firebase's reverse-proxy recipe:
 * https://firebase.google.com/docs/auth/web/redirect-best-practices
 */

const UPSTREAM_ORIGIN = "https://the-kinetic-alphabet.firebaseapp.com";

export const FIREBASE_AUTH_HANDLER_PREFIX = "/__/auth/";

/** True for any request under the Firebase auth handler path. */
export function isFirebaseAuthHandlerPath(pathname: string): boolean {
  return pathname.startsWith(FIREBASE_AUTH_HANDLER_PREFIX);
}

/**
 * Forward a /__/auth/* request to the real Firebase handler and return the
 * upstream response verbatim (status, headers, body, including Set-Cookie so
 * the handshake state lands first-party on the app host).
 */
export async function proxyFirebaseAuthHandler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const upstream = new URL(url.pathname + url.search, UPSTREAM_ORIGIN);

  // Forward headers verbatim, but drop Host: forwarding the app host would break
  // TLS/SNI to firebaseapp.com and Firebase's own host check. Deleting it lets
  // the runtime set Host to the upstream origin.
  const headers = new Headers(request.headers);
  headers.delete("host");

  // A browser's compression preference cannot pass through Node's fetch
  // unchanged. Node exposes decoded response bytes while retaining Firebase's
  // compressed length and encoding headers, so the auth helper arrives
  // truncated or mislabeled and the popup stays blank. Request the helper as
  // identity; Vite or Cloudflare can negotiate client-facing compression on
  // the response they send to the browser.
  headers.set("accept-encoding", "identity");

  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  // redirect: "manual" keeps any upstream redirect transparent to the browser
  // instead of the proxy silently following it server-side.
  return fetch(upstream.toString(), {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    redirect: "manual",
  });
}
