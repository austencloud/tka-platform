import { describe, expect, it } from "vitest";
import { getFirestoreRest } from "$lib/server/firestore/firestore-rest";

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
