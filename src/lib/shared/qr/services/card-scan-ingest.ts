import { auth } from "$lib/shared/auth/firebase";
import { authedFetch } from "$lib/shared/auth/services/authed-fetch";
import {
  PHYSICAL_CARD_SCHEMA_VERSION,
  type CardScanIngestResponse,
} from "../domain/physical-card";

export async function recordCardScan(input: {
  shortCode: string;
  physicalCardId: string | null;
  deviceId: string;
}): Promise<CardScanIngestResponse> {
  const init: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({
      schemaVersion: PHYSICAL_CARD_SCHEMA_VERSION,
      ...input,
    }),
  };
  const response = auth.currentUser
    ? await authedFetch("/api/physical-cards/scan", init)
    : await fetch("/api/physical-cards/scan", init);

  if (!response.ok) {
    let message = `Scan ingestion failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: unknown };
      if (typeof body.error === "string") message = body.error;
    } catch {
      // Keep the stable status-based fallback.
    }
    throw new Error(message);
  }

  return (await response.json()) as CardScanIngestResponse;
}
