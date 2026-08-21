import { describe, expect, it, vi } from "vitest";
import {
  FirestoreRest,
  getFirestoreRest,
} from "$lib/server/firestore/firestore-rest";
import { ServiceAccountAuthorizer } from "$lib/server/google/service-account-authorizer";

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
    const authorizer = new ServiceAccountAuthorizer(
      {
        project_id: "test",
        client_email: "cards@example.invalid",
        private_key: "not-used-by-this-test",
      },
      fetchImpl
    );
    vi.spyOn(authorizer, "getAccessToken").mockResolvedValue("cached-token");
    const firestore = new FirestoreRest(authorizer);

    await expect(
      firestore.getDocument("shortcodes/ABCD")
    ).resolves.toMatchObject({
      name: expect.stringContaining("shortcodes/ABCD"),
    });

    expect(receivers).toEqual([undefined]);
  });

  it("lists a collection with masks and pagination", async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        Response.json({
          documents: [
            {
              name: "projects/test/databases/(default)/documents/users/user-1",
            },
          ],
          nextPageToken: "next-page",
        })
      )
    ) as unknown as typeof fetch;
    const authorizer = new ServiceAccountAuthorizer(
      {
        project_id: "test",
        client_email: "cards@example.invalid",
        private_key: "not-used-by-this-test",
      },
      fetchImpl
    );
    vi.spyOn(authorizer, "getAccessToken").mockResolvedValue("cached-token");
    const firestore = new FirestoreRest(authorizer);

    await expect(
      firestore.listDocuments("users", {
        pageSize: 1000,
        pageToken: "current-page",
        fieldPaths: ["isAnonymous"],
      })
    ).resolves.toMatchObject({
      documents: [{ name: expect.stringContaining("users/user-1") }],
      nextPageToken: "next-page",
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://firestore.googleapis.com/v1/projects/test/databases/(default)/documents/users?pageSize=1000&pageToken=current-page&mask.fieldPaths=isAnonymous",
      expect.any(Object)
    );
  });
});
