import { auth } from "../../firebase";
import type { IProfileApiClient } from "../contracts/IProfileApiClient";

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

/**
 * Client for making authenticated API calls to /api/account/* endpoints
 */
export class ProfileApiClient implements IProfileApiClient {
  async request<T = unknown>(path: string, body?: unknown): Promise<T> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("Not signed in");
    }

    const token = await user.getIdToken();
    const res = await fetch(path, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : "{}",
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
}
