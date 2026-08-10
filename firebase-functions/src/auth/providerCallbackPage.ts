import { randomBytes } from "node:crypto";
import type { Response } from "express";

/**
 * The page an OAuth popup lands on after a provider redirect.
 *
 * It exists to do one thing: hand the result back to the opener and close.
 * Everything about it is defensive — a nonce CSP so nothing else can execute,
 * an explicit target origin so the message cannot leak to whatever else may
 * hold a handle on the window, and `no-store` so a provider code never sits in
 * a cache.
 *
 * Shared by the Instagram sign-in handshake and the Meta publish-connect
 * handshake. The two carry different message types and titles and nothing else.
 */
export interface ProviderCallbackPageInput {
  /** postMessage discriminator, e.g. `tka:instagram-auth`. */
  messageType: string;
  /** Heading and document title. */
  title: string;
  returnOrigin?: string;
  state?: string;
  status: "complete" | "error";
  message: string;
}

function callbackHtml(input: ProviderCallbackPageInput): {
  html: string;
  nonce: string;
} {
  const nonce = randomBytes(18).toString("base64url");
  const payload = JSON.stringify({
    type: input.messageType,
    version: 1,
    state: input.state ?? null,
    status: input.status,
  }).replace(/</g, "\\u003c");
  const targetOrigin = JSON.stringify(input.returnOrigin ?? "").replace(
    /</g,
    "\\u003c"
  );
  const title = escapeHtml(input.title);
  const safeMessage = escapeHtml(input.message);

  return {
    nonce,
    html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${title}</title>
    <style nonce="${nonce}">
      :root{color-scheme:dark}body{font:16px/1.5 system-ui,sans-serif;background:#111827;color:#f9fafb;display:grid;min-height:100vh;place-items:center;margin:0;padding:24px;text-align:center}main{max-width:30rem}h1{font-size:1.35rem;margin:0 0 12px}p{color:#d1d5db;margin:0}
    </style>
  </head>
  <body>
    <main><h1>${title}</h1><p>${safeMessage}</p></main>
    <script nonce="${nonce}">
      (() => {
        const targetOrigin = ${targetOrigin};
        if (targetOrigin && window.opener) {
          window.opener.postMessage(${payload}, targetOrigin);
        }
        window.setTimeout(() => window.close(), 120);
      })();
    </script>
  </body>
</html>`,
  };
}

export function sendProviderCallbackPage(
  response: Response,
  input: ProviderCallbackPageInput,
  statusCode = 200
): void {
  const page = callbackHtml(input);
  response
    .status(statusCode)
    .set({
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${page.nonce}'; style-src 'nonce-${page.nonce}'; base-uri 'none'; frame-ancestors 'none'`,
      "Cross-Origin-Opener-Policy": "unsafe-none",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    })
    .send(page.html);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
