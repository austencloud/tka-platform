/**
 * Moves non-public root profile fields to protected documents and marks only
 * profiles that exactly satisfy the public-profile v2 allowlist.
 *
 *   npx tsx scripts/migrations/migrate-public-user-profiles-v2.ts
 *   npx tsx scripts/migrations/migrate-public-user-profiles-v2.ts --apply
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type {
  DocumentData,
  FieldValue as AdminFieldValue,
  Firestore,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { initFirestore } from "../lib/firestore-provider.js";
import {
  ADMIN_PRIVATE_PROFILE_FIELDS,
  FEATURE_OVERRIDE_FIELDS,
  MODERATION_STATUS_FIELDS,
  NOTIFICATION_PREFERENCE_FIELDS,
  OWNER_PRIVATE_PROFILE_FIELDS,
  PUBLIC_PROFILE_FIELDS,
  PUBLIC_PROFILE_VERSION,
} from "../../src/lib/shared/community/domain/models/public-profile-contract";

type Data = Record<string, unknown>;

export interface UserProfileMigrationPlan {
  ownerPrivatePatch: Data | null;
  adminPrivatePatch: Data | null;
  notificationPreferencesPatch: Data | null;
  featureOverridesPatch: Data | null;
  moderationStatusPatch: Data | null;
  publicPatch: Data;
  deleteFields: string[];
  unknownFields: string[];
  changed: boolean;
}

const hasOwn = (value: Data, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

function preservedPatch(
  publicData: Data,
  privateData: Data,
  fields: Set<string>
): Data | null {
  const patch: Data = {};
  for (const field of fields) {
    if (hasOwn(publicData, field) && !hasOwn(privateData, field)) {
      patch[field] = publicData[field];
    }
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

function preservedObjectValuePatch(
  publicData: Data,
  destinationData: Data,
  sourceField: string
): Data | null {
  if (!hasOwn(publicData, sourceField)) return null;
  const sourceValue = publicData[sourceField];
  if (
    !sourceValue ||
    typeof sourceValue !== "object" ||
    Array.isArray(sourceValue)
  ) {
    return null;
  }

  const patch = Object.fromEntries(
    Object.entries(sourceValue as Data).filter(
      ([field]) => !hasOwn(destinationData, field)
    )
  );
  return Object.keys(patch).length > 0 ? patch : null;
}

export function buildUserProfileMigrationPlan(
  publicData: Data,
  ownerPrivateData: Data = {},
  adminPrivateData: Data = {},
  notificationPreferencesData: Data = {},
  featureOverridesData: Data = {},
  moderationStatusData: Data = {}
): UserProfileMigrationPlan {
  const featureOverridesValue = publicData.featureOverrides;
  const featureOverridesAreMovable =
    !hasOwn(publicData, "featureOverrides") ||
    (featureOverridesValue !== null &&
      typeof featureOverridesValue === "object" &&
      !Array.isArray(featureOverridesValue));
  const movableFields = [
    ...OWNER_PRIVATE_PROFILE_FIELDS,
    ...ADMIN_PRIVATE_PROFILE_FIELDS,
    ...NOTIFICATION_PREFERENCE_FIELDS,
    ...(featureOverridesAreMovable ? FEATURE_OVERRIDE_FIELDS : []),
    ...MODERATION_STATUS_FIELDS,
  ];
  const privateDeleteFields = movableFields.filter((field) =>
    hasOwn(publicData, field)
  );
  const remainingFields = Object.keys(publicData).filter(
    (field) => !privateDeleteFields.includes(field)
  );
  const unknownFields = remainingFields.filter(
    (field) => !PUBLIC_PROFILE_FIELDS.has(field)
  );
  const canMarkPublic = unknownFields.length === 0;
  const needsMarker =
    canMarkPublic && publicData.publicProfileVersion !== PUBLIC_PROFILE_VERSION;
  const mustRemoveMarker =
    !canMarkPublic &&
    publicData.publicProfileVersion === PUBLIC_PROFILE_VERSION;
  const deleteFields = [
    ...privateDeleteFields,
    ...(mustRemoveMarker ? ["publicProfileVersion"] : []),
  ];

  return {
    ownerPrivatePatch: preservedPatch(
      publicData,
      ownerPrivateData,
      OWNER_PRIVATE_PROFILE_FIELDS
    ),
    adminPrivatePatch: preservedPatch(
      publicData,
      adminPrivateData,
      ADMIN_PRIVATE_PROFILE_FIELDS
    ),
    notificationPreferencesPatch: preservedPatch(
      publicData,
      notificationPreferencesData,
      NOTIFICATION_PREFERENCE_FIELDS
    ),
    // Feature override documents use their own fields at the document root;
    // unlike notification preferences, there is no `featureOverrides` wrapper.
    featureOverridesPatch: preservedObjectValuePatch(
      publicData,
      featureOverridesData,
      "featureOverrides"
    ),
    moderationStatusPatch: preservedPatch(
      publicData,
      moderationStatusData,
      MODERATION_STATUS_FIELDS
    ),
    publicPatch: needsMarker
      ? { publicProfileVersion: PUBLIC_PROFILE_VERSION }
      : {},
    deleteFields,
    unknownFields,
    changed: deleteFields.length > 0 || needsMarker,
  };
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const { db, FieldValue, isAdmin, sdk } = (await initFirestore()) as {
    db: Firestore;
    FieldValue: { delete(): AdminFieldValue };
    isAdmin: boolean;
    sdk: string;
  };
  if (!isAdmin)
    throw new Error("This migration requires Admin SDK credentials.");

  const pageSize = 75;
  let cursor: QueryDocumentSnapshot<DocumentData> | undefined;
  let scanned = 0;
  let changed = 0;
  const unresolved = new Map<string, number>();

  do {
    let usersQuery = db.collection("users").orderBy("__name__").limit(pageSize);
    if (cursor) usersQuery = usersQuery.startAfter(cursor);
    const users = await usersQuery.get();
    if (users.empty) break;

    const ownerRefs = users.docs.map((user) =>
      db.collection("userPrivateProfiles").doc(user.id)
    );
    const adminRefs = users.docs.map((user) =>
      db.collection("userAdminMetadata").doc(user.id)
    );
    const notificationRefs = users.docs.map((user) =>
      db.doc(`users/${user.id}/settings/notificationPreferences`)
    );
    const featureOverrideRefs = users.docs.map((user) =>
      db.doc(`users/${user.id}/settings/featureOverrides`)
    );
    const moderationRefs = users.docs.map((user) =>
      db.doc(`users/${user.id}/moderation/status`)
    );
    const [
      ownerDocs,
      adminDocs,
      notificationDocs,
      featureOverrideDocs,
      moderationDocs,
    ] = await Promise.all([
      db.getAll(...ownerRefs),
      db.getAll(...adminRefs),
      db.getAll(...notificationRefs),
      db.getAll(...featureOverrideRefs),
      db.getAll(...moderationRefs),
    ]);
    const batch = apply ? db.batch() : null;

    users.docs.forEach((user, index) => {
      scanned += 1;
      const plan = buildUserProfileMigrationPlan(
        user.data(),
        ownerDocs[index]!.exists ? (ownerDocs[index]!.data() ?? {}) : {},
        adminDocs[index]!.exists ? (adminDocs[index]!.data() ?? {}) : {},
        notificationDocs[index]!.exists
          ? (notificationDocs[index]!.data() ?? {})
          : {},
        featureOverrideDocs[index]!.exists
          ? (featureOverrideDocs[index]!.data() ?? {})
          : {},
        moderationDocs[index]!.exists
          ? (moderationDocs[index]!.data() ?? {})
          : {}
      );
      for (const field of plan.unknownFields) {
        unresolved.set(field, (unresolved.get(field) ?? 0) + 1);
      }
      if (!plan.changed) return;
      changed += 1;
      if (plan.ownerPrivatePatch)
        batch?.set(ownerRefs[index]!, plan.ownerPrivatePatch, { merge: true });
      if (plan.adminPrivatePatch)
        batch?.set(adminRefs[index]!, plan.adminPrivatePatch, { merge: true });
      if (plan.notificationPreferencesPatch)
        batch?.set(
          notificationRefs[index]!,
          plan.notificationPreferencesPatch,
          { merge: true }
        );
      if (plan.featureOverridesPatch)
        batch?.set(featureOverrideRefs[index]!, plan.featureOverridesPatch, {
          merge: true,
        });
      if (plan.moderationStatusPatch)
        batch?.set(moderationRefs[index]!, plan.moderationStatusPatch, {
          merge: true,
        });
      batch?.update(user.ref, {
        ...plan.publicPatch,
        ...Object.fromEntries(
          plan.deleteFields.map((field) => [field, FieldValue.delete()])
        ),
      });
    });

    if (apply && batch) await batch.commit();
    cursor = users.docs.at(-1);
    if (users.size < pageSize) break;
  } while (true);

  console.log(
    `${sdk} ${apply ? "APPLY" : "DRY-RUN"}: scanned=${scanned} changed=${changed}`
  );
  if (unresolved.size > 0) {
    console.log(
      "Unmarked unknown root fields:",
      Object.fromEntries(unresolved)
    );
  }
  if (!apply) console.log("Re-run with --apply to write changes.");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
