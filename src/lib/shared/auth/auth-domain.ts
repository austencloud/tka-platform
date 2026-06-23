/**
 * Resolve the Firebase auth handler domain (`/__/auth/`) per environment.
 *
 * iOS Safari (ITP) partitions third-party storage, so when the OAuth popup runs
 * against the default `*.firebaseapp.com` handler from an app on a different
 * site, the handler can't read back its own handshake state — the popup closes
 * with auth/popup-closed-by-user. Serving the handler first-party (same site as
 * the app, via the Cloudflare Pages reverse proxy at functions/__/auth/) fixes it.
 *
 * - Native (Capacitor): no browser ITP; keep the default handler untouched.
 * - tkaflowarts.com / dev.tkaflowarts.com: use the app's own host (proxied,
 *   first-party). Self-maintaining for any future *.tkaflowarts.com host.
 * - Everything else (localhost dev, *.pages.dev previews): not whitelisted and
 *   desktop popup to the default handler already works — keep the default.
 */
import { Capacitor } from "@capacitor/core";

export const DEFAULT_AUTH_DOMAIN = "the-kinetic-alphabet.firebaseapp.com";

export function resolveAuthDomain(): string {
  if (typeof window !== "undefined" && !Capacitor.isNativePlatform()) {
    const host = window.location.hostname;
    if (host === "tkaflowarts.com" || host.endsWith(".tkaflowarts.com")) {
      return host;
    }
  }
  return DEFAULT_AUTH_DOMAIN;
}
