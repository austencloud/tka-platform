import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../../../cloudflare/workers/shortcode-redirect.js";

describe("shortcode Worker Android association", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("serves the canonical asset links document without redirecting", async () => {
    const association = JSON.stringify([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: { package_name: "com.tkaflowarts.composer" },
      },
    ]);
    const upstreamFetch = vi.fn().mockResolvedValue(
      new Response(association, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", upstreamFetch);

    const response = await worker.fetch(
      new Request("https://tka.run/.well-known/assetlinks.json"),
      {}
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("content-type")).toBe("application/json");
    await expect(response.text()).resolves.toBe(association);
    expect(upstreamFetch).toHaveBeenCalledWith(
      "https://tkaflowarts.com/.well-known/assetlinks.json"
    );
  });
});
