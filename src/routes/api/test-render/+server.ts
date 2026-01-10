import type { ISequencePersister } from "$lib/features/create/shared/services/contracts/ISequencePersister";
import { container } from "$lib/shared/di";
import type { ISequenceRenderer } from "$lib/shared/render/services/contracts/ISequenceRenderer";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from "$lib/server/security/rate-limiter";

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
  // Rate limit to prevent resource exhaustion
  const clientIp = getClientAddress();
  const rateCheck = checkRateLimit(
    `test-render:${clientIp}`,
    RATE_LIMITS.GENERAL
  );
  if (!rateCheck.allowed) {
    return rateLimitResponse(rateCheck.resetAt);
  }
  try {
    const body = (await request.json()) as { beatSize?: unknown };
    const beatSizeValue = body.beatSize;

    // Resolve services
    const renderService = container.items.sequenceRenderer as ISequenceRenderer;
    const persistenceService = container.items.sequencePersister as ISequencePersister;

    // Load current sequence
    const state = await persistenceService.loadCurrentState();
    if (!state?.currentSequence) {
      return json({ error: "No sequence loaded" }, { status: 400 });
    }

    // Render with specified beatSize
    const beatSize =
      typeof beatSizeValue === "string"
        ? parseInt(beatSizeValue, 10)
        : typeof beatSizeValue === "number"
          ? beatSizeValue
          : 144;

    const blob = await renderService.renderSequenceToBlob(
      state.currentSequence,
      {
        beatSize,
        includeStartPosition: true,
        addBeatNumbers: false,
        addWord: false,
        addUserInfo: false,
        beatScale: 1.0,
        format: "PNG",
        quality: 1.0,
      }
    );

    return new Response(blob, {
      headers: {
        "Content-Type": "image/png",
      },
    });
  } catch (error) {
    console.error("Test render failed:", error);
    return json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
};
