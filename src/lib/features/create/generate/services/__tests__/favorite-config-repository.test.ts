import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => {
  const batch = {
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn(),
  };

  return {
    batch,
    writeBatch: vi.fn(() => batch),
    firestoreList: vi.fn(),
    firestoreGet: vi.fn(),
    firestoreSet: vi.fn(),
    firestoreDelete: vi.fn(),
    updateDoc: vi.fn(async () => undefined),
  };
});

vi.mock("firebase/firestore", () => ({
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({
    path: segments.join("/"),
  })),
  updateDoc: harness.updateDoc,
  deleteField: vi.fn(() => "__DELETE__"),
  serverTimestamp: vi.fn(() => "__SERVER_TS__"),
  writeBatch: harness.writeBatch,
}));

vi.mock("$lib/shared/auth/firebase", () => ({
  getFirestoreInstance: vi.fn(async () => ({})),
}));

vi.mock("$lib/shared/offline/state/sync-status-state.svelte", () => ({
  trackWrite: vi.fn((operation: () => Promise<unknown>) => operation()),
}));

vi.mock("$lib/shared/error/services/error-telemetry-reporter", () => ({
  reportErrorTelemetry: vi.fn(),
}));

vi.mock("$lib/shared/firestore", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  firestoreList: harness.firestoreList,
  firestoreGet: harness.firestoreGet,
  firestoreSet: harness.firestoreSet,
  firestoreDelete: harness.firestoreDelete,
}));

import {
  deleteSetup,
  loadCommunity,
  loadPersonal,
  shareSetup,
  updateSetup,
} from "../favorite-config-repository";
import type { SavedGeneratorSetup } from "../../domain/models/favorite-config";

const NOW = new Date();
const A_SETUP = {
  id: "s1",
  name: "Setup 1",
  config: {
    level: 2,
  } as unknown as SavedGeneratorSetup["config"],
  startEndOptions: null,
  createdAt: NOW,
  updatedAt: NOW,
} satisfies SavedGeneratorSetup;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loadPersonal migration commit", () => {
  it("returns the migrated snapshot without awaiting the batch commit", async () => {
    harness.firestoreList.mockResolvedValue([]);
    harness.firestoreGet.mockResolvedValue({
      id: "u1",
      favoriteConfig: {
        config: { level: 3 },
        startEndOptions: null,
      },
    });
    harness.batch.commit.mockReturnValue(new Promise(() => {}));

    const result = await loadPersonal("migration-user", {
      allowMigration: true,
    });

    expect(result.sharedSetupId).toBe("legacy-favorite");
    expect(result.setups.map((setup) => setup.id)).toEqual([
      "legacy-favorite",
    ]);
    expect(harness.batch.set).toHaveBeenCalledTimes(1);
    expect(harness.batch.update).toHaveBeenCalledWith(
      expect.anything(),
      {
        "favoriteConfig.sourceSetupId": "legacy-favorite",
      }
    );
  });

  it("orders the first mutation after a pending migration", async () => {
    harness.firestoreList.mockResolvedValue([]);
    harness.firestoreGet.mockResolvedValue({
      id: "ordered-user",
      favoriteConfig: {
        config: { level: 3 },
        startEndOptions: null,
      },
    });
    let finishMigration!: () => void;
    harness.batch.commit.mockReturnValue(
      new Promise<void>((resolve) => {
        finishMigration = resolve;
      })
    );

    await loadPersonal("ordered-user", {
      allowMigration: true,
    });
    const share = shareSetup("ordered-user", A_SETUP);
    await Promise.resolve();

    expect(harness.updateDoc).not.toHaveBeenCalled();
    finishMigration();
    await share;
    expect(harness.updateDoc).toHaveBeenCalledOnce();
  });

  it("skips migration writes during admin preview", async () => {
    harness.firestoreList.mockResolvedValue([]);
    harness.firestoreGet.mockResolvedValue({
      id: "u1",
      favoriteConfig: {
        config: { level: 3 },
        startEndOptions: null,
      },
    });

    const result = await loadPersonal("u1", {
      allowMigration: false,
    });

    expect(result.sharedSetupId).toBe("legacy-favorite");
    expect(harness.writeBatch).not.toHaveBeenCalled();
  });
});

describe("shared batches", () => {
  it("updates private and public snapshots in one batch", async () => {
    harness.batch.commit.mockResolvedValue(undefined);

    await updateSetup("u1", A_SETUP, true);

    expect(harness.batch.set).toHaveBeenCalledTimes(1);
    expect(harness.batch.update).toHaveBeenCalledTimes(1);
    expect(harness.batch.commit).toHaveBeenCalledTimes(1);
    const projection = harness.batch.update.mock.calls[0]?.[1] as {
      favoriteConfig: { sourceSetupId: string };
    };
    expect(projection.favoriteConfig.sourceSetupId).toBe("s1");
  });

  it("deletes private data and removes the public projection in one batch", async () => {
    harness.batch.commit.mockResolvedValue(undefined);

    await deleteSetup("u1", "s1", true);

    expect(harness.batch.delete).toHaveBeenCalledTimes(1);
    expect(harness.batch.update).toHaveBeenCalledWith(
      expect.anything(),
      { favoriteConfig: "__DELETE__" }
    );
    expect(harness.batch.commit).toHaveBeenCalledTimes(1);
  });
});

describe("loadCommunity", () => {
  it("rejects read failures instead of returning an empty list", async () => {
    harness.firestoreList.mockRejectedValue(
      new Error("permission-denied")
    );

    await expect(loadCommunity()).rejects.toThrow("permission-denied");
  });
});
