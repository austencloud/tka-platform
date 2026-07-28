import { beforeEach, describe, expect, it, vi } from "vitest";
import { authedFetch } from "$lib/shared/auth/services/authed-fetch";
import { PHYSICAL_CARD_SCHEMA_VERSION } from "$lib/shared/qr/domain/physical-card";
import {
  createPhysicalCardPrintRunFinalizer,
  finalizePhysicalCardPrintRun,
} from "../serialized-print-run";

vi.mock("$lib/shared/auth/services/authed-fetch", () => ({
  authedFetch: vi.fn(),
}));
vi.mock("$lib/shared/qr/get-qr-code-generator", () => ({
  getQRCodeGenerator: vi.fn(),
}));
vi.mock("$lib/shared/qr/get-short-code-manager", () => ({
  getShortCodeManager: vi.fn(),
}));
vi.mock("../serialized-card-front", () => ({
  renderSerializedCardFront: vi.fn(),
}));

const PRINT_RUN_ID = "0123456789ABCDEFGHIJ";

describe("physical card print-run finalization", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("posts the ready result through the authenticated boundary", async () => {
    vi.mocked(authedFetch).mockResolvedValue(
      new Response(JSON.stringify({ status: "ready" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await finalizePhysicalCardPrintRun(PRINT_RUN_ID, "ready");

    expect(authedFetch).toHaveBeenCalledOnce();
    expect(authedFetch).toHaveBeenCalledWith(
      "/api/physical-cards/complete",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          schemaVersion: PHYSICAL_CARD_SCHEMA_VERSION,
          printRunId: PRINT_RUN_ID,
          result: "ready",
        }),
      })
    );
  });

  it("coalesces matching calls and rejects a contradictory terminal result", async () => {
    const sendResult = vi.fn().mockResolvedValue(undefined);
    const finalizer = createPhysicalCardPrintRunFinalizer(
      PRINT_RUN_ID,
      sendResult
    );

    await Promise.all([finalizer.complete(), finalizer.complete()]);
    await expect(finalizer.fail()).rejects.toThrow(
      "Print run is already finalized as ready"
    );
    expect(sendResult).toHaveBeenCalledOnce();
    expect(sendResult).toHaveBeenCalledWith(PRINT_RUN_ID, "ready");
  });

  it("retries completion when the first response is lost", async () => {
    vi.mocked(authedFetch)
      .mockRejectedValueOnce(new Error("connection reset"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "ready" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

    await expect(
      finalizePhysicalCardPrintRun(PRINT_RUN_ID, "ready")
    ).resolves.toBeUndefined();
    expect(authedFetch).toHaveBeenCalledTimes(2);
  });

  it("allows the same result to retry after a transport failure", async () => {
    const sendResult = vi
      .fn()
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce(undefined);
    const finalizer = createPhysicalCardPrintRunFinalizer(
      PRINT_RUN_ID,
      sendResult
    );

    await expect(finalizer.complete()).rejects.toThrow("network unavailable");
    await expect(finalizer.complete()).resolves.toBeUndefined();
    expect(sendResult).toHaveBeenCalledTimes(2);
  });

  it("rejects a successful HTTP response with the wrong state", async () => {
    vi.mocked(authedFetch).mockResolvedValue(
      new Response(JSON.stringify({ status: "failed" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(
      finalizePhysicalCardPrintRun(PRINT_RUN_ID, "ready")
    ).rejects.toThrow(
      "Physical-card finalization returned an invalid response"
    );
  });
});
