import type { RequestHandler } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";
import { requireFirebaseUser } from "$lib/server/auth/requireFirebaseUser";
import { RATE_LIMITS } from "$lib/server/security/rate-limiter";
import { withRateLimit } from "$lib/server/security/withRateLimit";
import { getConfiguredTikaModels } from "$lib/features/tika/domain/tika-model-catalog";

export const GET: RequestHandler = async (event) => {
  const caller = await requireFirebaseUser(event);
  const blocked = await withRateLimit(
    event,
    RATE_LIMITS.GENERAL,
    "user",
    caller.uid
  );
  if (blocked) return blocked;

  return Response.json({
    models: getConfiguredTikaModels({
      anthropic: Boolean(env.ANTHROPIC_API_KEY),
      deepseek: Boolean(env.DEEPSEEK_API_KEY),
    }),
  });
};
