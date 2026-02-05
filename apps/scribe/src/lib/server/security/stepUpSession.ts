import crypto from "node:crypto";

export type StepUpClaims = {
  uid: string;
  iat: number;
  exp: number;
};

function base64urlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64urlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + "=".repeat(padLen), "base64");
}

function sign(payloadB64: string, secret: string): string {
  return base64urlEncode(
    crypto.createHmac("sha256", secret).update(payloadB64).digest()
  );
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function createStepUpToken(params: {
  uid: string;
  ttlSeconds: number;
  secret: string;
  now?: number;
}): string {
  const now = params.now ?? Math.floor(Date.now() / 1000);
  const claims: StepUpClaims = {
    uid: params.uid,
    iat: now,
    exp: now + params.ttlSeconds,
  };

  const payloadB64 = base64urlEncode(Buffer.from(JSON.stringify(claims)));
  const sigB64 = sign(payloadB64, params.secret);
  return `${payloadB64}.${sigB64}`;
}

export function verifyStepUpToken(params: {
  token: string | null | undefined;
  secret: string;
  now?: number;
}): StepUpClaims | null {
  if (!params.token) return null;

  const parts = params.token.split(".");
  const payloadB64 = parts[0];
  const sigB64 = parts[1];
  if (!payloadB64 || !sigB64 || parts.length !== 2) return null;

  const expectedSig = sign(payloadB64, params.secret);
  if (!safeEqual(sigB64, expectedSig)) return null;

  try {
    const claims = JSON.parse(
      base64urlDecode(payloadB64).toString("utf8")
    ) as StepUpClaims;
    const now = params.now ?? Math.floor(Date.now() / 1000);
    if (!claims?.uid || typeof claims.uid !== "string") return null;
    if (typeof claims.exp !== "number" || typeof claims.iat !== "number")
      return null;
    if (now >= claims.exp) return null;
    return claims;
  } catch {
    return null;
  }
}
