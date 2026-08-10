/**
 * Meta OAuth reverse proxy inside the SvelteKit Cloudflare worker.
 *
 * Meta receives stable first-party URLs on tkaflowarts.com. The worker passes
 * those requests to the Firebase HTTP functions that own secrets, state, and
 * token exchange. This must live in the worker because adapter-cloudflare's
 * advanced-mode _worker.js shadows the repository's functions/ directory.
 *
 * Two independent handshakes come through here:
 *   /api/auth/instagram/*  — Instagram sign-in (mints a Firebase session)
 *   /api/share/meta/*      — publish-connect (attaches a posting credential)
 * They share this proxy and nothing else.
 */

const FUNCTION_ORIGIN =
  "https://us-central1-the-kinetic-alphabet.cloudfunctions.net";

const FUNCTION_BY_PATH = new Map([
  ["/api/auth/instagram/callback", "instagramAuthCallback"],
  ["/api/auth/instagram/deauthorize", "instagramDeauthorizeCallback"],
  ["/api/auth/instagram/data-deletion", "instagramDataDeletionCallback"],
  ["/api/share/meta/callback", "metaConnectCallback"],
] as const);

type MetaProxyPath =
  | "/api/auth/instagram/callback"
  | "/api/auth/instagram/deauthorize"
  | "/api/auth/instagram/data-deletion"
  | "/api/share/meta/callback";

export function isMetaOAuthProxyPath(pathname: string): boolean {
  return FUNCTION_BY_PATH.has(pathname as MetaProxyPath);
}

function isAllowedMethod(pathname: string, method: string): boolean {
  if (pathname.endsWith("/data-deletion")) {
    return method === "GET" || method === "POST";
  }
  return method === (pathname.endsWith("/deauthorize") ? "POST" : "GET");
}

function allowedMethods(pathname: string): string {
  return pathname.endsWith("/data-deletion")
    ? "GET, POST"
    : pathname.endsWith("/deauthorize")
      ? "POST"
      : "GET";
}

export async function proxyMetaOAuthRequest(
  request: Request
): Promise<Response> {
  const requestUrl = new URL(request.url);
  const functionName = FUNCTION_BY_PATH.get(requestUrl.pathname as MetaProxyPath);
  if (!functionName) return new Response("Not found", { status: 404 });

  if (!isAllowedMethod(requestUrl.pathname, request.method)) {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: allowedMethods(requestUrl.pathname) },
    });
  }

  const upstream = new URL(
    `/${functionName}${requestUrl.search}`,
    FUNCTION_ORIGIN
  );
  const headers = new Headers(request.headers);
  headers.delete("host");

  return fetch(upstream.toString(), {
    method: request.method,
    headers,
    body: request.method === "POST" ? await request.arrayBuffer() : undefined,
    redirect: "manual",
  });
}
