// Unit coverage for the Firebase OAuth handler reverse proxy that serves
// /__/auth/* first-party on the app host (replaces the dead Pages Function that
// adapter-cloudflare's _worker.js shadowed). See firebase-auth-handler-proxy.ts.

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isFirebaseAuthHandlerPath,
  proxyFirebaseAuthHandler,
} from "../../../src/lib/server/auth/firebase-auth-handler-proxy";

const UPSTREAM = "https://the-kinetic-alphabet.firebaseapp.com";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isFirebaseAuthHandlerPath", () => {
  it("matches /__/auth/* paths", () => {
    expect(isFirebaseAuthHandlerPath("/__/auth/handler")).toBe(true);
    expect(isFirebaseAuthHandlerPath("/__/auth/iframe")).toBe(true);
  });

  it("does not match app or other paths", () => {
    expect(isFirebaseAuthHandlerPath("/")).toBe(false);
    expect(isFirebaseAuthHandlerPath("/create")).toBe(false);
    expect(isFirebaseAuthHandlerPath("/__/other")).toBe(false);
    expect(isFirebaseAuthHandlerPath("/api/__/auth/")).toBe(false);
  });
});

describe("proxyFirebaseAuthHandler", () => {
  it("forwards path + query to the firebaseapp.com handler as a manual-redirect GET", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);

    await proxyFirebaseAuthHandler(
      new Request(
        "https://tkaflowarts.com/__/auth/handler?apiKey=abc&mode=select",
        { headers: { "x-test": "1" } },
      ),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe(`${UPSTREAM}/__/auth/handler?apiKey=abc&mode=select`);
    expect(init.method).toBe("GET");
    expect(init.redirect).toBe("manual");
    expect(init.body).toBeUndefined(); // GET carries no body
    // Host is stripped so the runtime targets the upstream origin; other headers pass through.
    expect((init.headers as Headers).has("host")).toBe(false);
    expect((init.headers as Headers).get("x-test")).toBe("1");
  });

  it("forwards method + body for the handler's POST exchange", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);

    await proxyFirebaseAuthHandler(
      new Request("https://tkaflowarts.com/__/auth/handler", {
        method: "POST",
        body: "grant=xyz",
        headers: { "content-type": "application/x-www-form-urlencoded" },
      }),
    );

    const [calledUrl, init] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe(`${UPSTREAM}/__/auth/handler`);
    expect(init.method).toBe("POST");
    expect(init.body).toBeDefined();
  });

  it("does not forward browser compression to the Firebase helper", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("helper-script"));
    vi.stubGlobal("fetch", fetchMock);

    await proxyFirebaseAuthHandler(
      new Request("https://dev.tkaflowarts.com/__/auth/handler.js", {
        headers: { "accept-encoding": "gzip, deflate, br" },
      }),
    );

    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Headers).get("accept-encoding")).toBe("identity");
  });

  it("returns the upstream response verbatim (status, headers, body)", async () => {
    const upstreamResponse = new Response("handler-html", {
      status: 200,
      headers: { "content-type": "text/html", "set-cookie": "firebase=1" },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(upstreamResponse));

    const res = await proxyFirebaseAuthHandler(
      new Request("https://tkaflowarts.com/__/auth/handler"),
    );

    expect(res).toBe(upstreamResponse);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html");
    expect(await res.text()).toBe("handler-html");
  });
});
