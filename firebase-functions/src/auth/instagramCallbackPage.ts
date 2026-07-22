import { randomBytes } from "node:crypto";
import type { Response } from "express";
import type { InstagramAuthFailureCode } from "./instagramAuthPolicy";

export function instagramFailureMessage(
  code: InstagramAuthFailureCode
): string {
  switch (code) {
    case "instagram/cancelled":
      return "Instagram authorization was cancelled.";
    case "instagram/already-linked":
      return "That Instagram account is connected to another TKA account.";
    case "instagram/account-type-required":
      return "Instagram login requires a creator or business account.";
    case "instagram/reauth-mismatch":
      return "That is not the Instagram account connected to this TKA account.";
    case "instagram/state-expired":
      return "This Instagram sign-in request expired.";
    default:
      return "Instagram could not complete sign-in.";
  }
}

function callbackHtml(input: {
  returnOrigin?: string;
  state?: string;
  status: "complete" | "error";
  message: string;
}): { html: string; nonce: string } {
  const nonce = randomBytes(18).toString("base64url");
  const payload = JSON.stringify({
    type: "tka:instagram-auth",
    version: 1,
    state: input.state ?? null,
    status: input.status,
  }).replace(/</g, "\\u003c");
  const targetOrigin = JSON.stringify(input.returnOrigin ?? "").replace(
    /</g,
    "\\u003c"
  );
  const title =
    input.status === "complete"
      ? "Instagram connected"
      : "Instagram sign-in failed";
  const safeMessage = input.message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

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

export function sendInstagramCallbackPage(
  response: Response,
  input: Parameters<typeof callbackHtml>[0],
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
