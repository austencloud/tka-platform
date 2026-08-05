import { existsSync } from "node:fs";
import { resolve } from "node:path";

export function readInlineGoogleCredentials(): object | undefined {
  const raw =
    process.env.GSC_SERVICE_ACCOUNT_JSON?.trim() ||
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return undefined;

  try {
    return JSON.parse(raw) as object;
  } catch {
    throw new Error(
      "GSC_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON"
    );
  }
}

export function findGoogleKeyFile(): string | undefined {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) {
    return resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  }

  const candidates = [
    "serviceAccountKey.json",
    "firebase-service-account.json",
  ].map((path) => resolve(process.cwd(), path));
  return candidates.find((path) => existsSync(path));
}
