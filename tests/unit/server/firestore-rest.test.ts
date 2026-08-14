import { describe, expect, it, vi } from "vitest";
import {
  FirestoreRest,
  getFirestoreRest,
} from "$lib/server/firestore/firestore-rest";

const PLATFORM_CREDENTIAL = JSON.stringify({
  project_id: "request-scoped-project",
  client_email: "cards@example.invalid",
  private_key: "not-used-by-this-test",
});

describe("getFirestoreRest", () => {
  it("uses request-scoped platform credentials", () => {
    const firestore = getFirestoreRest(PLATFORM_CREDENTIAL);

    expect(firestore.projectId).toBe("request-scoped-project");
  });

  it("validates request-scoped platform credentials", () => {
    expect(() => getFirestoreRest("not-json")).toThrow(
      "FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON"
    );
  });
});

describe("FirestoreRest requests", () => {
  it("does not bind an injected fetch to the Firestore client", async () => {
    const receivers: unknown[] = [];
    const fetchImpl = vi.fn(function (this: unknown) {
      receivers.push(this);
      return Promise.resolve(
        new Response(
          JSON.stringify({
            name: "projects/test/databases/(default)/documents/shortcodes/ABCD",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    }) as unknown as typeof fetch;
    const firestore = new FirestoreRest(
      {
        project_id: "test",
        client_email: "cards@example.invalid",
        private_key: "not-used-by-this-test",
      },
      fetchImpl
    );
    const clientState = firestore as unknown as {
      accessToken: { value: string; expiresAt: number };
    };
    clientState.accessToken = {
      value: "cached-token",
      expiresAt: Date.now() + 60 * 60 * 1000,
    };

    await expect(
      firestore.getDocument("shortcodes/ABCD")
    ).resolves.toMatchObject({
      name: expect.stringContaining("shortcodes/ABCD"),
    });

    expect(receivers).toEqual([undefined]);
  });
});
