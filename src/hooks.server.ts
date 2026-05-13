// import { getRedirectURL, shouldRedirectToPrimary } from "$config/domains"; // TODO: Fix config path
import { dev } from "$app/environment";
import type { Handle } from "@sveltejs/kit";

/**
 * Check if a request is for a font file that needs CORS headers.
 * PostHog session replay needs to load these files from their replay domain.
 */
function isFontRequest(pathname: string): boolean {
  return (
    pathname.endsWith(".woff2") ||
    pathname.endsWith(".woff") ||
    pathname.endsWith(".ttf") ||
    pathname.endsWith(".otf") ||
    pathname.endsWith(".eot")
  );
}

/**
 * Check if a request is for a CSS file that needs CORS headers.
 * PostHog needs to read CSS rules for accurate replay.
 */
function isCssRequest(pathname: string): boolean {
  return pathname.endsWith(".css");
}

export const handle: Handle = async ({ event, resolve }) => {
  // Handle console forwarding endpoint
  if (dev && event.url.pathname === "/api/console-forward") {
    if (event.request.method === "POST") {
      try {
        const body = await event.request.text();
        const data = JSON.parse(body) as { level?: string; message?: string };

        // Write directly to stdout (terminal)
        const timestamp = new Date().toLocaleTimeString();
        const logLine = `[${timestamp}] BROWSER ${data.level ?? "LOG"}: ${data.message ?? ""}`;
        process.stdout.write(logLine + "\n");

        return new Response("OK", { status: 200 });
      } catch {
        return new Response("Error", { status: 500 });
      }
    }
  }

  // Resolve the request with security headers
  const response = await resolve(event);

  // =========================================================================
  // CORS HEADERS FOR SESSION REPLAY (PostHog)
  // PostHog's replay loads fonts/CSS from their domain to reconstruct the page.
  // Without these headers, fonts don't render and CSS rules can't be read.
  // =========================================================================

  const pathname = event.url.pathname;
  if (isFontRequest(pathname) || isCssRequest(pathname)) {
    // Allow PostHog replay domains to load these resources
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  }

  // Set security headers for OAuth authentication flows
  // These headers allow OAuth popups (Google, Facebook, etc.) to properly communicate
  // with the parent window during authentication while maintaining security
  response.headers.set(
    "Cross-Origin-Opener-Policy",
    "same-origin-allow-popups"
  );

  // COEP header - allows cross-origin resources needed for OAuth
  response.headers.set("Cross-Origin-Embedder-Policy", "unsafe-none");

  // Additional security headers for production-ready app
  response.headers.set("X-Frame-Options", "SAMEORIGIN");

  response.headers.set("X-Content-Type-Options", "nosniff");

  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Content Security Policy
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://accounts.google.com https://apis.google.com https://us-assets.i.posthog.com https://*.posthog.com https://*.firebaseio.com https://cdn.jsdelivr.net https://maps.googleapis.com https://static.cloudflareinsights.com",
      "worker-src 'self' blob:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
      "connect-src 'self' blob: data: https://*.firebaseio.com https://*.googleapis.com https://*.google.com https://*.cloudfunctions.net https://firestore.googleapis.com https://firebasestorage.googleapis.com https://us.i.posthog.com https://*.posthog.com https://pub-f5505ed75927471cb198c54336317370.r2.dev https://*.r2.cloudflarestorage.com https://cdn.jsdelivr.net https://cloudflareinsights.com wss://*.firebaseio.com wss://*.peerjs.com ws://localhost:*",
      "img-src 'self' data: blob: https: http:",
      "media-src 'self' blob: https://firebasestorage.googleapis.com https://storage.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "frame-src 'self' https://accounts.google.com https://*.firebaseapp.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  );

  // Permissions Policy - block unused browser APIs
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(self), geolocation=(), payment=()",
  );

  return response;
};
