import { env } from "$env/dynamic/private";
import { dev } from "$app/environment";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { type FirestoreFields } from "./firestore-value-codec";

export {
  fromFirestoreFields,
  fromFirestoreValue,
  toFirestoreFields,
  toFirestoreValue,
  type FirestoreFields,
  type FirestoreGeoPoint,
  type FirestoreValue,
} from "./firestore-value-codec";

const FIRESTORE_HOST = "https://firestore.googleapis.com/v1";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DATASTORE_SCOPE = "https://www.googleapis.com/auth/datastore";
const TOKEN_REFRESH_SKEW_MS = 5 * 60 * 1000;

interface ServiceAccountCredentials {
  project_id: string;
  client_email: string;
  private_key: string;
}

export interface FirestoreDocument {
  name: string;
  fields?: FirestoreFields;
  createTime?: string;
  updateTime?: string;
}

export interface FirestoreWrite {
  update?: {
    name: string;
    fields: FirestoreFields;
  };
  delete?: string;
  transform?: {
    document: string;
    fieldTransforms: Array<Record<string, unknown>>;
  };
  updateMask?: {
    fieldPaths: string[];
  };
  updateTransforms?: Array<Record<string, unknown>>;
  currentDocument?: {
    exists?: boolean;
    updateTime?: string;
  };
}

export class FirestoreRestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly responseBody: string
  ) {
    super(message);
    this.name = "FirestoreRestError";
  }
}

function encodeBase64Url(value: string | Uint8Array): string {
  const bytes =
    typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function encodeDocumentPath(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function parseServiceAccount(
  raw: string | undefined
): ServiceAccountCredentials {
  if (!raw) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not configured");
  }

  let parsed: Partial<ServiceAccountCredentials>;
  try {
    parsed = JSON.parse(raw) as Partial<ServiceAccountCredentials>;
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON");
  }

  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new Error("Firebase service account credentials are incomplete");
  }

  return parsed as ServiceAccountCredentials;
}

function loadCredentialSource(platformCredential?: string): string | undefined {
  // Cloudflare Pages exposes request bindings on event.platform.env. Prefer
  // that source so credentialed routes do not depend on adapter env hydration.
  const requestScoped = platformCredential?.trim();
  if (requestScoped) return requestScoped;

  const configured = env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (configured) return configured;
  if (!dev) return undefined;

  const keyPath = [
    resolve("serviceAccountKey.json"),
    resolve("../../serviceAccountKey.json"),
  ].find((candidate) => existsSync(candidate));
  if (!keyPath) return undefined;

  try {
    return readFileSync(keyPath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not read local Firebase credentials: ${message}`);
  }
}

async function signServiceAccountJwt(
  credentials: ServiceAccountCredentials,
  nowSeconds: number
): Promise<string> {
  const header = encodeBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = encodeBase64Url(
    JSON.stringify({
      iss: credentials.client_email,
      sub: credentials.client_email,
      scope: DATASTORE_SCOPE,
      aud: TOKEN_URL,
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    })
  );
  const unsigned = `${header}.${payload}`;
  const pemContents = credentials.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binaryKey = Uint8Array.from(atob(pemContents), (char) =>
    char.charCodeAt(0)
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned)
  );

  return `${unsigned}.${encodeBase64Url(new Uint8Array(signature))}`;
}

export function readFirestoreString(
  document: FirestoreDocument,
  field: string
): string | null {
  const value = document.fields?.[field];
  return value && "stringValue" in value ? value.stringValue : null;
}

export function readFirestoreInteger(
  document: FirestoreDocument,
  field: string
): number | null {
  const value = document.fields?.[field];
  if (!value || !("integerValue" in value)) return null;
  const parsed = Number(value.integerValue);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function readFirestoreBoolean(
  document: FirestoreDocument,
  field: string
): boolean | null {
  const value = document.fields?.[field];
  return value && "booleanValue" in value ? value.booleanValue : null;
}

export class FirestoreRest {
  private accessToken: { value: string; expiresAt: number } | null = null;
  private tokenRequest: Promise<string> | null = null;

  constructor(
    private readonly credentials: ServiceAccountCredentials,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  get projectId(): string {
    return this.credentials.project_id;
  }

  documentName(path: string): string {
    return `projects/${this.projectId}/databases/(default)/documents/` + path;
  }

  async getDocument(
    path: string,
    fieldPaths: readonly string[] = []
  ): Promise<FirestoreDocument | null> {
    const mask = fieldPaths
      .map((field) => `mask.fieldPaths=${encodeURIComponent(field)}`)
      .join("&");
    const url =
      `${FIRESTORE_HOST}/${this.documentName(encodeDocumentPath(path))}` +
      (mask ? `?${mask}` : "");
    const response = await this.authorizedFetch(url, {
      headers: { accept: "application/json" },
    });

    if (response.status === 404) return null;
    if (!response.ok) await this.throwResponseError("read", response);
    return (await response.json()) as FirestoreDocument;
  }

  async commit(writes: FirestoreWrite[]): Promise<{ commitTime: string }> {
    if (writes.length === 0) {
      throw new Error("Firestore commit requires at least one write");
    }

    const url =
      `${FIRESTORE_HOST}/projects/${this.projectId}/databases/(default)` +
      "/documents:commit";
    const response = await this.authorizedFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ writes }),
    });

    if (!response.ok) await this.throwResponseError("commit", response);
    return (await response.json()) as { commitTime: string };
  }

  private async authorizedFetch(
    input: string,
    init: RequestInit
  ): Promise<Response> {
    const token = await this.getAccessToken();
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    return this.fetchImpl(input, { ...init, headers });
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (
      this.accessToken &&
      this.accessToken.expiresAt - TOKEN_REFRESH_SKEW_MS > now
    ) {
      return this.accessToken.value;
    }
    if (this.tokenRequest) return this.tokenRequest;

    this.tokenRequest = this.requestAccessToken().finally(() => {
      this.tokenRequest = null;
    });
    return this.tokenRequest;
  }

  private async requestAccessToken(): Promise<string> {
    const jwt = await signServiceAccountJwt(
      this.credentials,
      Math.floor(Date.now() / 1000)
    );
    const response = await this.fetchImpl(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });
    const body = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
    };
    if (!response.ok || !body.access_token) {
      throw new Error(
        `Firebase service-account token exchange failed (${response.status})`
      );
    }

    this.accessToken = {
      value: body.access_token,
      expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
    };
    return body.access_token;
  }

  private async throwResponseError(
    operation: string,
    response: Response
  ): Promise<never> {
    const body = (await response.text()).slice(0, 1500);
    throw new FirestoreRestError(
      `Firestore REST ${operation} failed (${response.status})`,
      response.status,
      body
    );
  }
}

let client: FirestoreRest | null = null;
let credentialSource: string | null = null;

export function getFirestoreRest(platformCredential?: string): FirestoreRest {
  const raw = loadCredentialSource(platformCredential);
  if (!client || credentialSource !== raw) {
    client = new FirestoreRest(parseServiceAccount(raw));
    credentialSource = raw ?? null;
  }
  return client;
}

export async function hashPrivateValue(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return encodeBase64Url(new Uint8Array(digest));
}
