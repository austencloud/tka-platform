import type { RequestHandler } from "./$types";
import { requireFirebaseUser } from "$lib/server/auth/requireFirebaseUser";

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB
const HASH_RE = /^[0-9a-f]{64}$/;

export const PUT: RequestHandler = async (event) => {
  // Require authenticated user — prevents anonymous R2 uploads
  await requireFirebaseUser(event);

  const { params, request, platform } = event;
  const hash = params.hash;
  if (!hash || !HASH_RE.test(hash)) {
    return new Response("Invalid hash", { status: 400 });
  }

  const bucket = platform?.env?.QR_VIDEOS;
  if (!bucket) {
    return new Response("R2 not configured", { status: 503 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_SIZE) {
    return new Response("Payload too large", { status: 413 });
  }

  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_SIZE) {
    return new Response("Payload too large", { status: 413 });
  }

  await bucket.put(`qr-videos/${hash}.mp4`, body, {
    httpMetadata: { contentType: "video/mp4" },
  });

  return new Response(null, { status: 204 });
};
