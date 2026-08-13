import { createHmac, timingSafeEqual } from "node:crypto";

export type InstagramAuthIntent = "signin" | "link" | "reauth";

export type InstagramAuthFailureCode =
  | "instagram/account-type-required"
  | "instagram/already-linked"
  | "instagram/cancelled"
  | "instagram/invalid-response"
  | "instagram/provider-error"
  | "instagram/reauth-mismatch"
  | "instagram/state-expired"
  | "instagram/state-invalid";

export class InstagramAuthPolicyError extends Error {
  constructor(public readonly code: InstagramAuthFailureCode) {
    super(code);
    this.name = "InstagramAuthPolicyError";
  }
}

export interface InstagramTokenExchange {
  accessToken: string;
  userId: string;
}

export interface InstagramIdentityResolution {
  resolvedUid: string;
  collision: boolean;
  createLink: boolean;
}

/**
 * Only app-owned origins may receive the callback wake-up message. The message
 * contains no credential, but keeping the allowlist tight avoids teaching this
 * OAuth flow to communicate with arbitrary sites.
 */
export function isAllowedInstagramReturnOrigin(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.origin !== value || url.protocol !== "https:") return false;

  const hostname = url.hostname.toLowerCase();
  if (hostname === "tkaflowarts.com" || hostname.endsWith(".tkaflowarts.com")) {
    return true;
  }

  if (
    hostname === "tka-platform.pages.dev" ||
    hostname.endsWith(".tka-platform.pages.dev")
  ) {
    return true;
  }

  if (hostname !== "localhost") return false;
  const port = Number(url.port);
  return Number.isInteger(port) && port >= 5173 && port <= 5199;
}

/**
 * Instagram IDs exceed JavaScript's safe-integer range. Extract user_id from
 * the raw response text so JSON.parse cannot round two different accounts onto
 * the same number before we turn it into a string.
 */
export function parseInstagramTokenResponse(
  text: string
): InstagramTokenExchange {
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new InstagramAuthPolicyError("instagram/invalid-response");
  }

  const topLevel =
    typeof payload === "object" && payload !== null ? payload : undefined;
  const data =
    topLevel && "data" in topLevel && Array.isArray(topLevel.data)
      ? topLevel.data
      : [];
  const tokenPayload =
    topLevel &&
    "access_token" in topLevel &&
    typeof topLevel.access_token === "string"
      ? topLevel
      : data[0];
  const accessToken =
    typeof tokenPayload === "object" &&
    tokenPayload !== null &&
    "access_token" in tokenPayload &&
    typeof tokenPayload.access_token === "string"
      ? tokenPayload.access_token
      : "";

  const idMatch = text.match(
    /"user_id"\s*:\s*(?:"([0-9]{1,30})"|([0-9]{1,30}))/
  );
  const userId = idMatch?.[1] ?? idMatch?.[2] ?? "";

  if (!accessToken || !userId) {
    throw new InstagramAuthPolicyError("instagram/invalid-response");
  }

  return { accessToken, userId };
}

/** Decide which Firebase uid owns an Instagram identity without merging users. */
export function resolveInstagramIdentity(input: {
  intent: InstagramAuthIntent;
  requesterUid: string;
  requesterWasAnonymous: boolean;
  existingUid: string | null;
}): InstagramIdentityResolution {
  const { intent, requesterUid, requesterWasAnonymous, existingUid } = input;

  if (intent === "reauth") {
    if (!existingUid || existingUid !== requesterUid) {
      throw new InstagramAuthPolicyError("instagram/reauth-mismatch");
    }
    return { resolvedUid: requesterUid, collision: false, createLink: false };
  }

  if (intent === "link") {
    if (existingUid && existingUid !== requesterUid) {
      throw new InstagramAuthPolicyError("instagram/already-linked");
    }
    return {
      resolvedUid: requesterUid,
      collision: false,
      createLink: existingUid === null,
    };
  }

  if (!requesterWasAnonymous) {
    throw new InstagramAuthPolicyError("instagram/state-invalid");
  }

  if (existingUid) {
    return {
      resolvedUid: existingUid,
      collision: existingUid !== requesterUid,
      createLink: false,
    };
  }

  return { resolvedUid: requesterUid, collision: false, createLink: true };
}

function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

export function instagramSignedRequestFromBody(body: unknown): string {
  if (typeof body === "object" && body !== null && "signed_request" in body) {
    const value = (body as { signed_request?: unknown }).signed_request;
    return typeof value === "string" ? value : "";
  }
  if (typeof body === "string") {
    return new URLSearchParams(body).get("signed_request") ?? "";
  }
  if (Buffer.isBuffer(body)) {
    return (
      new URLSearchParams(body.toString("utf8")).get("signed_request") ?? ""
    );
  }
  return "";
}

/** Validate Meta's signed_request and return its lossless Instagram user ID. */
export function verifyInstagramSignedRequest(
  signedRequest: string,
  appSecret: string
): string {
  const [encodedSignature, encodedPayload, extra] = signedRequest.split(".");
  if (
    !encodedSignature ||
    !encodedPayload ||
    extra !== undefined ||
    !appSecret
  ) {
    throw new InstagramAuthPolicyError("instagram/invalid-response");
  }

  let suppliedSignature: Buffer;
  let payloadBuffer: Buffer;
  try {
    suppliedSignature = decodeBase64Url(encodedSignature);
    payloadBuffer = decodeBase64Url(encodedPayload);
  } catch {
    throw new InstagramAuthPolicyError("instagram/invalid-response");
  }

  const expectedSignature = createHmac("sha256", appSecret)
    .update(encodedPayload)
    .digest();

  if (
    suppliedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(suppliedSignature, expectedSignature)
  ) {
    throw new InstagramAuthPolicyError("instagram/invalid-response");
  }

  const payloadText = payloadBuffer.toString("utf8");
  let payload: unknown;
  try {
    payload = JSON.parse(payloadText);
  } catch {
    throw new InstagramAuthPolicyError("instagram/invalid-response");
  }

  const algorithm =
    typeof payload === "object" &&
    payload !== null &&
    "algorithm" in payload &&
    typeof payload.algorithm === "string"
      ? payload.algorithm.toUpperCase()
      : "";
  if (algorithm !== "HMAC-SHA256") {
    throw new InstagramAuthPolicyError("instagram/invalid-response");
  }

  const idMatch = payloadText.match(
    /"user_id"\s*:\s*(?:"([0-9]{1,30})"|([0-9]{1,30}))/
  );
  const userId = idMatch?.[1] ?? idMatch?.[2] ?? "";
  if (!userId) {
    throw new InstagramAuthPolicyError("instagram/invalid-response");
  }

  return userId;
}
