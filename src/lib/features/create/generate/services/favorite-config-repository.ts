import {
  deleteField,
  doc,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { getFirestoreInstance } from "$lib/shared/auth/firebase";
import { reportErrorTelemetry } from "$lib/shared/error/services/error-telemetry-reporter";
import {
  firestoreDelete,
  firestoreGet,
  firestoreList,
  firestoreSet,
} from "$lib/shared/firestore";
import { trackWrite } from "$lib/shared/offline/state/sync-status-state.svelte";
import { PUBLIC_PROFILE_VERSION } from "$lib/shared/community/domain/models/public-profile-contract";
import {
  SavedGeneratorSetupSchema,
  UserWithFavoriteSchema,
} from "../domain/models/favorite-config-schemas";
import type {
  CommunityFavorite,
  PersonalSetupSnapshot,
  SavedGeneratorSetup,
  SavedSetupDraft,
} from "../domain/models/favorite-config";
import {
  planPersonalMigration,
  type LegacyFavoriteRecord,
  type MigrationWrite,
} from "../domain/setup-migration";
import type { UIGenerationConfig } from "../state/generate-config.svelte";
import {
  normalizePersistedGenerationConfig,
  normalizePersistedStartEndOptions,
} from "../domain/generator-persistence-normalizer";

const USERS_COLLECTION = "users";
const SETUP_REPOSITORY_NAME = "favorites";
const pendingMigrationWrites = new Map<string, Promise<void>>();

const setupsPath = (userId: string) => `users/${userId}/generatorSetups`;

export interface GeneratorSetupRepository {
  loadPersonal(
    userId: string,
    options: { allowMigration: boolean }
  ): Promise<PersonalSetupSnapshot>;
  loadCommunity(limit?: number): Promise<CommunityFavorite[]>;
  createSetup(
    userId: string,
    draft: SavedSetupDraft
  ): Promise<SavedGeneratorSetup>;
  renameSetup(userId: string, setupId: string, name: string): Promise<void>;
  updateSetup(
    userId: string,
    setup: SavedGeneratorSetup,
    shared: boolean
  ): Promise<void>;
  deleteSetup(userId: string, setupId: string, shared: boolean): Promise<void>;
  shareSetup(userId: string, setup: SavedGeneratorSetup): Promise<void>;
  unshareSetup(userId: string): Promise<void>;
}

function sharedProjection(setup: SavedGeneratorSetup) {
  return {
    sourceSetupId: setup.id,
    config: setup.config as unknown as Record<string, unknown>,
    startEndOptions: setup.startEndOptions,
    setAt: serverTimestamp(),
  };
}

async function commitMigrationWrite(
  userId: string,
  write: MigrationWrite
): Promise<void> {
  const db = await getFirestoreInstance();
  const batch = writeBatch(db);

  batch.set(
    doc(db, setupsPath(userId), write.setup.id),
    {
      name: write.setup.name,
      config: write.setup.config,
      startEndOptions: write.setup.startEndOptions,
      createdAt: write.setup.createdAt,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  if (write.linkFavoriteToSetupId) {
    batch.update(doc(db, USERS_COLLECTION, userId), {
      "favoriteConfig.sourceSetupId": write.linkFavoriteToSetupId,
    });
  }

  await trackWrite(() => batch.commit(), SETUP_REPOSITORY_NAME);
}

function scheduleMigrationWrite(userId: string, write: MigrationWrite): void {
  if (pendingMigrationWrites.has(userId)) return;

  let operation: Promise<void>;
  operation = commitMigrationWrite(userId, write)
    .catch((error) => {
      void reportErrorTelemetry({
        message: "Generator setup migration failed",
        technicalDetails:
          error instanceof Error ? error.message : String(error),
        severity: "warning",
        context: {
          module: "create",
          action: "generatorSetupMigration",
        },
        error: error instanceof Error ? error : new Error(String(error)),
      });
    })
    .finally(() => {
      if (pendingMigrationWrites.get(userId) === operation) {
        pendingMigrationWrites.delete(userId);
      }
    });

  pendingMigrationWrites.set(userId, operation);
}

async function waitForPendingMigration(userId: string): Promise<void> {
  await pendingMigrationWrites.get(userId);
}

export async function loadPersonal(
  userId: string,
  options: { allowMigration: boolean }
): Promise<PersonalSetupSnapshot> {
  const [setupDocs, userDoc] = await Promise.all([
    firestoreList(setupsPath(userId), SavedGeneratorSetupSchema, {
      orderBy: [{ field: "createdAt" }],
    }),
    firestoreGet(USERS_COLLECTION, userId, UserWithFavoriteSchema),
  ]);

  const setups: SavedGeneratorSetup[] = setupDocs.map((setup) => ({
    id: setup.id,
    name: setup.name,
    config: normalizePersistedGenerationConfig(
      setup.config
    ) as UIGenerationConfig,
    startEndOptions: normalizePersistedStartEndOptions(setup.startEndOptions),
    createdAt: setup.createdAt ?? new Date(),
    updatedAt: setup.updatedAt ?? new Date(),
  }));

  const favorite = (userDoc?.favoriteConfig ??
    null) as LegacyFavoriteRecord | null;
  const plan = planPersonalMigration(setups, favorite, new Date());

  if (plan.write && options.allowMigration) {
    scheduleMigrationWrite(userId, plan.write);
  }

  return {
    setups: plan.setups,
    sharedSetupId: plan.sharedSetupId,
  };
}

export async function loadCommunity(
  limitCount = 20
): Promise<CommunityFavorite[]> {
  const users = await firestoreList(USERS_COLLECTION, UserWithFavoriteSchema, {
    where: [
      {
        field: "publicProfileVersion",
        op: "==",
        value: PUBLIC_PROFILE_VERSION,
      },
      {
        field: "favoriteConfig",
        op: "!=",
        value: null,
      },
    ],
    orderBy: [{ field: "favoriteConfig" }],
    limit: limitCount,
  });

  const results: CommunityFavorite[] = [];

  for (const user of users) {
    const favorite = user.favoriteConfig;
    if (!favorite?.config) continue;

    results.push({
      userId: user.id,
      displayName: user.displayName ?? "Unknown",
      avatar: user.photoURL ?? undefined,
      config: normalizePersistedGenerationConfig(
        favorite.config
      ) as UIGenerationConfig,
      startEndOptions: normalizePersistedStartEndOptions(
        favorite.startEndOptions
      ),
      setAt: favorite.setAt ?? new Date(),
    });
  }

  return results;
}

export async function createSetup(
  userId: string,
  draft: SavedSetupDraft
): Promise<SavedGeneratorSetup> {
  await waitForPendingMigration(userId);
  const id = await firestoreSet(
    setupsPath(userId),
    null,
    {
      name: draft.name,
      config: draft.config as unknown as Record<string, unknown>,
      startEndOptions: draft.startEndOptions,
    },
    {
      trackOffline: true,
      repoName: SETUP_REPOSITORY_NAME,
    }
  );
  const now = new Date();

  return {
    id,
    name: draft.name,
    config: draft.config,
    startEndOptions: draft.startEndOptions,
    createdAt: now,
    updatedAt: now,
  };
}

export async function renameSetup(
  userId: string,
  setupId: string,
  name: string
): Promise<void> {
  await waitForPendingMigration(userId);
  await firestoreSet(
    setupsPath(userId),
    setupId,
    { name },
    {
      merge: true,
      trackOffline: true,
      repoName: SETUP_REPOSITORY_NAME,
    }
  );
}

export async function updateSetup(
  userId: string,
  setup: SavedGeneratorSetup,
  shared: boolean
): Promise<void> {
  await waitForPendingMigration(userId);
  const db = await getFirestoreInstance();
  const batch = writeBatch(db);

  batch.set(
    doc(db, setupsPath(userId), setup.id),
    {
      config: setup.config as unknown as Record<string, unknown>,
      startEndOptions: setup.startEndOptions,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  if (shared) {
    batch.update(doc(db, USERS_COLLECTION, userId), {
      favoriteConfig: sharedProjection(setup),
    });
  }

  await trackWrite(() => batch.commit(), SETUP_REPOSITORY_NAME);
}

export async function deleteSetup(
  userId: string,
  setupId: string,
  shared: boolean
): Promise<void> {
  await waitForPendingMigration(userId);
  if (!shared) {
    await firestoreDelete(setupsPath(userId), setupId, {
      trackOffline: true,
      repoName: SETUP_REPOSITORY_NAME,
    });
    return;
  }

  const db = await getFirestoreInstance();
  const batch = writeBatch(db);
  batch.delete(doc(db, setupsPath(userId), setupId));
  batch.update(doc(db, USERS_COLLECTION, userId), {
    favoriteConfig: deleteField(),
  });

  await trackWrite(() => batch.commit(), SETUP_REPOSITORY_NAME);
}

export async function shareSetup(
  userId: string,
  setup: SavedGeneratorSetup
): Promise<void> {
  await waitForPendingMigration(userId);
  const db = await getFirestoreInstance();
  await trackWrite(
    () =>
      updateDoc(doc(db, USERS_COLLECTION, userId), {
        favoriteConfig: sharedProjection(setup),
      }),
    SETUP_REPOSITORY_NAME
  );
}

export async function unshareSetup(userId: string): Promise<void> {
  await waitForPendingMigration(userId);
  const db = await getFirestoreInstance();
  await trackWrite(
    () =>
      updateDoc(doc(db, USERS_COLLECTION, userId), {
        favoriteConfig: deleteField(),
      }),
    SETUP_REPOSITORY_NAME
  );
}

export const generatorSetupRepository: GeneratorSetupRepository = {
  loadPersonal,
  loadCommunity,
  createSetup,
  renameSetup,
  updateSetup,
  deleteSetup,
  shareSetup,
  unshareSetup,
};
