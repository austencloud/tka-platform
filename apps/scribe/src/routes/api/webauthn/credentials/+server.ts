import type { RequestHandler } from "@sveltejs/kit";
import { json } from "@sveltejs/kit";
import { requireFirebaseUser } from "$lib/server/auth/requireFirebaseUser";
import { listPasskeys } from "$lib/server/webauthn/passkeysStore";

export const GET: RequestHandler = async (event) => {
  try {
    const user = await requireFirebaseUser(event);
    const passkeys = await listPasskeys(user.uid);

    return json({
      count: passkeys.length,
      passkeys: passkeys.map((p) => ({
        credentialId: p.credentialId,
        name: p.name ?? null,
        createdAt: p.createdAt?.toDate?.()?.toISOString?.() ?? null,
        lastUsedAt: p.lastUsedAt?.toDate?.()?.toISOString?.() ?? null,
      })),
    });
  } catch (err: unknown) {
    const status =
      typeof err === "object" && err && "status" in err
        ? Number((err as { status: unknown }).status)
        : 500;
    const code =
      typeof err === "object" && err && "code" in err
        ? String((err as { code: unknown }).code)
        : "internal_error";
    const message =
      err instanceof Error ? err.message : "Failed to list passkeys";
    return json({ error: message, code }, { status });
  }
};
