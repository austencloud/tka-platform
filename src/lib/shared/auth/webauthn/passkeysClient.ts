import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/types";
import { auth } from "../firebase";

/**
 * API response error with status and code
 */
interface ApiErrorResponse {
  error?: string;
  code?: string;
}

/**
 * Extended Error with HTTP status and API error code
 */
interface ApiError extends Error {
  status?: number;
  code?: string;
}

async function getIdToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Not signed in");
  }
  return user.getIdToken();
}

async function apiFetch<T>(
  url: string,
  init?: RequestInit & { json?: unknown }
): Promise<T> {
  const token = await getIdToken();
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init?.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, {
    ...init,
    headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });

  const data = (await res.json().catch(() => ({}))) as (T & ApiErrorResponse);
  if (!res.ok) {
    const err: ApiError = new Error(data?.error || `Request failed: ${res.status}`);
    err.status = res.status;
    err.code = data?.code;
    throw err;
  }
  return data as T;
}

export type PasskeyListResponse = {
  count: number;
  passkeys: Array<{
    credentialId: string;
    name: string | null;
    createdAt: string | null;
    lastUsedAt: string | null;
  }>;
};

export async function listPasskeys(): Promise<PasskeyListResponse> {
  return apiFetch<PasskeyListResponse>("/api/webauthn/credentials", {
    method: "GET",
  });
}

export async function registerPasskey(params?: {
  name?: string;
}): Promise<void> {
  const options = await apiFetch<PublicKeyCredentialCreationOptionsJSON>(
    "/api/webauthn/registration/options",
    { method: "POST" }
  );

  const response: RegistrationResponseJSON = await startRegistration({
    optionsJSON: options,
  });

  await apiFetch<{ ok: true }>("/api/webauthn/registration/verify", {
    method: "POST",
    json: { ...response, name: params?.name },
  });
}

export async function stepUpWithPasskey(): Promise<void> {
  const options = await apiFetch<PublicKeyCredentialRequestOptionsJSON>(
    "/api/webauthn/authentication/options",
    { method: "POST" }
  );

  const response: AuthenticationResponseJSON = await startAuthentication({
    optionsJSON: options,
  });

  await apiFetch<{ ok: true; ttlSeconds: number }>(
    "/api/webauthn/authentication/verify",
    {
      method: "POST",
      json: response,
    }
  );
}
