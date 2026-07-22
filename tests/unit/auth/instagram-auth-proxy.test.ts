import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isInstagramAuthProxyPath,
  proxyInstagramAuthRequest,
} from "$lib/server/auth/instagram-auth-proxy";

const FUNCTION_ORIGIN =
  "https://us-central1-the-kinetic-alphabet.cloudfunctions.net";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Instagram auth worker proxy", () => {
  it("matches only the three registered Meta callback paths", () => {
    expect(isInstagramAuthProxyPath("/api/auth/instagram/callback")).toBe(true);
    expect(isInstagramAuthProxyPath("/api/auth/instagram/deauthorize")).toBe(
      true
    );
    expect(isInstagramAuthProxyPath("/api/auth/instagram/data-deletion")).toBe(
      true
    );
    expect(isInstagramAuthProxyPath("/api/auth/instagram/complete")).toBe(
      false
    );
    expect(isInstagramAuthProxyPath("/api/auth/instagram/callback/extra")).toBe(
      false
    );
  });

  it("forwards OAuth query values to the callback function", async () => {
    const upstreamResponse = new Response("callback page", {
      headers: { "content-type": "text/html" },
    });
    const fetchMock = vi.fn().mockResolvedValue(upstreamResponse);
    vi.stubGlobal("fetch", fetchMock);

    const response = await proxyInstagramAuthRequest(
      new Request(
        "https://tkaflowarts.com/api/auth/instagram/callback?code=abc&state=xyz",
        { headers: { host: "tkaflowarts.com", "x-test": "1" } }
      )
    );

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      `${FUNCTION_ORIGIN}/instagramAuthCallback?code=abc&state=xyz`
    );
    expect(init.method).toBe("GET");
    expect((init.headers as Headers).has("host")).toBe(false);
    expect(response).toBe(upstreamResponse);
  });

  it("forwards Meta's signed deauthorization body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("OK"));
    vi.stubGlobal("fetch", fetchMock);

    await proxyInstagramAuthRequest(
      new Request("https://tkaflowarts.com/api/auth/instagram/deauthorize", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "signed_request=signed.payload",
      })
    );

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${FUNCTION_ORIGIN}/instagramDeauthorizeCallback`);
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(ArrayBuffer);
  });

  it("supports Meta's POST and the public GET deletion-status contract", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("OK"));
    vi.stubGlobal("fetch", fetchMock);

    await proxyInstagramAuthRequest(
      new Request("https://tkaflowarts.com/api/auth/instagram/data-deletion", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "signed_request=signed.payload",
      })
    );
    await proxyInstagramAuthRequest(
      new Request(
        "https://tkaflowarts.com/api/auth/instagram/data-deletion?code=confirmation"
      )
    );

    expect(fetchMock.mock.calls[0][0]).toBe(
      `${FUNCTION_ORIGIN}/instagramDataDeletionCallback`
    );
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
    expect(fetchMock.mock.calls[1][0]).toBe(
      `${FUNCTION_ORIGIN}/instagramDataDeletionCallback?code=confirmation`
    );
    expect(fetchMock.mock.calls[1][1].method).toBe("GET");
  });

  it("rejects the wrong method before reaching Firebase", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await proxyInstagramAuthRequest(
      new Request("https://tkaflowarts.com/api/auth/instagram/callback", {
        method: "POST",
      })
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
