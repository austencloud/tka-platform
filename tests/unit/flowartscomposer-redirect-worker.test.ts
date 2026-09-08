import { describe, expect, it } from "vitest";
import worker, {
  resolveLegacyRedirect,
} from "../../cloudflare/workers/flowartscomposer-redirect/worker.js";

describe("flowartscomposer.com redirect Worker", () => {
  it("routes legacy sequence codes through the canonical QR ingress", async () => {
    const response = await worker.fetch(
      new Request("https://flowartscomposer.com/sequence/64UN?prop=staff")
    );

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(
      "https://tkaflowarts.com/q/64UN?prop=staff"
    );
  });

  it("keeps the existing create fallback for unrelated legacy paths", () => {
    expect(
      resolveLegacyRedirect("https://www.flowartscomposer.com/old-composer")
        .href
    ).toBe("https://tkaflowarts.com/create");
  });

  it("does not treat nested sequence paths as short codes", () => {
    expect(
      resolveLegacyRedirect(
        "https://flowartscomposer.com/sequence/64UN/unexpected"
      ).href
    ).toBe("https://tkaflowarts.com/create");
  });
});
