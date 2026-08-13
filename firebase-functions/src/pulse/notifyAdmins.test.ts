const collection = jest.fn();
const doc = jest.fn();
const runTransaction = jest.fn();

jest.mock("firebase-admin", () => ({
  firestore: Object.assign(
    jest.fn(() => ({ collection, doc, runTransaction })),
    {
      FieldValue: { serverTimestamp: jest.fn() },
    }
  ),
}));

import { notifyAdmins, notifyAdminsScanDigest } from "./notifyAdmins";

describe("Pulse agent activity suppression", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not write admin notifications for agent activity", async () => {
    await expect(
      notifyAdmins({
        type: "admin-content-created",
        message: 'Codex + Claude saved "TEST"',
        fromUserId: "agent-codex-claude",
        fromUserName: "Codex + Claude",
      })
    ).resolves.toBe(0);

    expect(collection).not.toHaveBeenCalled();
    expect(doc).not.toHaveBeenCalled();
  });

  it("does not create scan digests for agent scans", async () => {
    await notifyAdminsScanDigest({
      code: "TEST",
      label: "TEST",
      scannerName: "Codex + Claude",
      fromUserId: "agent-codex-claude",
      city: "Chicago",
      country: "US",
      lat: 41.8781,
      lng: -87.6298,
      windowMs: 600_000,
      windowMinutes: 10,
      now: 0,
    });

    expect(collection).not.toHaveBeenCalled();
    expect(doc).not.toHaveBeenCalled();
    expect(runTransaction).not.toHaveBeenCalled();
  });
});
