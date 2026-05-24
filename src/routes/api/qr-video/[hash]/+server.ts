import type { RequestHandler } from "./$types";

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB
const HASH_RE = /^[0-9a-f]{64}$/;

function isMP4(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 8) return false;
  const view = new DataView(buf);
  return view.getUint32(4) === 0x66747970; // "ftyp"
}

export const PUT: RequestHandler = async (event) => {
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

  if (!isMP4(body)) {
    return new Response("Not a valid MP4", { status: 400 });
  }

  await bucket.put(`qr-videos/${hash}.mp4`, body, {
    httpMetadata: { contentType: "video/mp4" },
  });

  return new Response(null, { status: 204 });
};
