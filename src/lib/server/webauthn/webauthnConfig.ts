import type { RequestEvent } from "@sveltejs/kit";

export function getWebAuthnRP(event: RequestEvent): {
  rpID: string;
  rpName: string;
  origin: string;
} {
  const origin = event.url.origin;
  const rpID = event.url.hostname;
  const rpName = process.env.PUBLIC_APP_NAME?.trim() || "TKA Scribe";

  return { rpID, rpName, origin };
}
