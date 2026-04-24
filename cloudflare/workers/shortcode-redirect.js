/**
 * Cloudflare Worker: QR Short Code Redirect
 *
 * Deployed on: tka.run, tka.to
 * Routes: /{code} → 302 → tkaflowarts.com/q/{code}
 *         /       → 301 → tkaflowarts.com
 *
 * SACRED: This worker is the only thing between a printed QR code and the
 * sequence viewer. Every Choreo Card ever printed encodes a TKA.RUN/{code}
 * URL. If this worker breaks, every card in circulation is dead.
 *
 * The redirect target (/q/{code}) can be changed here without affecting
 * printed cards — cards encode the short domain, not the full target URL.
 */
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/" || path === "") {
      return Response.redirect("https://tkaflowarts.com", 301);
    }

    const code = path.slice(1);
    if (code.includes("/") || code.includes(".")) {
      return new Response("Not Found", { status: 404 });
    }

    const target = new URL(`https://tkaflowarts.com/q/${code}`);
    url.searchParams.forEach((value, key) => {
      target.searchParams.set(key, value);
    });

    return Response.redirect(target.toString(), 302);
  },
};
