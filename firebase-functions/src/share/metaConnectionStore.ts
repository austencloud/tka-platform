/**
 * Where a person's Meta publishing credentials live.
 *
 * Two documents per user, deliberately:
 *
 *   metaPublishConnections/{uid} — the access tokens. Firestore rules deny the
 *     client every operation on this collection; only the Admin SDK reads it.
 *   metaPublishStatus/{uid} — what the UI needs to render (which accounts are
 *     connected, under what name, until when). Owner-readable, token-free.
 *
 * Splitting them means the share sheet can subscribe to connection state with
 * an ordinary onSnapshot and still have no path to a credential.
 */

import * as admin from "firebase-admin";
import {
  buildInstagramCapabilitySnapshot,
  type InstagramCapabilitySnapshot,
} from "./instagramCapabilities";

const CONNECTIONS = "metaPublishConnections";
const STATUS = "metaPublishStatus";

export interface InstagramPublishConnection {
  igUserId: string;
  username: string;
  accountType?: "BUSINESS" | "CREATOR" | "UNKNOWN";
  graphVersion?: string;
  appAccess?: "standard" | "advanced" | "unknown";
  permissions?: Record<string, "granted" | "declined" | "expired" | "unknown">;
  accessToken: string;
  /** When this token was minted. A token under 24h old cannot be refreshed. */
  issuedAt: admin.firestore.Timestamp;
  expiresAt: admin.firestore.Timestamp;
  connectedAt: admin.firestore.Timestamp;
  verifiedAt?: admin.firestore.Timestamp;
  lastRefreshedAt?: admin.firestore.Timestamp;
}

export interface FacebookPageRecord {
  id: string;
  name: string;
  accessToken: string;
}

export interface FacebookPublishConnection {
  /** Long-lived user token. Page tokens are derived from it and outlive it
   *  only as long as it stays valid, so it is what gets refreshed. */
  userAccessToken: string;
  issuedAt: admin.firestore.Timestamp;
  expiresAt: admin.firestore.Timestamp;
  connectedAt: admin.firestore.Timestamp;
  pages: FacebookPageRecord[];
  selectedPageId: string;
}

export interface MetaPublishConnections {
  instagram?: InstagramPublishConnection;
  facebookPage?: FacebookPublishConnection;
}

export type MetaConnectionTarget = "instagram" | "facebook-page";

export async function readConnections(
  uid: string
): Promise<MetaPublishConnections> {
  const snapshot = await admin
    .firestore()
    .collection(CONNECTIONS)
    .doc(uid)
    .get();
  return snapshot.exists ? (snapshot.data() as MetaPublishConnections) : {};
}

export async function writeInstagramConnection(
  uid: string,
  connection: InstagramPublishConnection
): Promise<void> {
  await admin
    .firestore()
    .collection(CONNECTIONS)
    .doc(uid)
    .set({ instagram: connection }, { merge: true });
  await syncStatus(uid);
}

export async function writeFacebookConnection(
  uid: string,
  connection: FacebookPublishConnection
): Promise<void> {
  await admin
    .firestore()
    .collection(CONNECTIONS)
    .doc(uid)
    .set({ facebookPage: connection }, { merge: true });
  await syncStatus(uid);
}

/** Rotates a refreshed token in place without disturbing the rest of the doc. */
export async function updateInstagramToken(
  uid: string,
  token: { accessToken: string; issuedAtMs: number; expiresAtMs: number }
): Promise<void> {
  await admin
    .firestore()
    .collection(CONNECTIONS)
    .doc(uid)
    .set(
      {
        instagram: {
          accessToken: token.accessToken,
          issuedAt: admin.firestore.Timestamp.fromMillis(token.issuedAtMs),
          expiresAt: admin.firestore.Timestamp.fromMillis(token.expiresAtMs),
          lastRefreshedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      },
      { merge: true }
    );
  await syncStatus(uid);
}

export async function selectFacebookPage(
  uid: string,
  pageId: string
): Promise<boolean> {
  const connections = await readConnections(uid);
  const page = connections.facebookPage?.pages.find(
    (candidate) => candidate.id === pageId
  );
  if (!page) return false;

  await admin
    .firestore()
    .collection(CONNECTIONS)
    .doc(uid)
    .set({ facebookPage: { selectedPageId: pageId } }, { merge: true });
  await syncStatus(uid);
  return true;
}

export async function clearConnection(
  uid: string,
  target: MetaConnectionTarget
): Promise<void> {
  const field = target === "instagram" ? "instagram" : "facebookPage";
  await admin
    .firestore()
    .collection(CONNECTIONS)
    .doc(uid)
    .set({ [field]: admin.firestore.FieldValue.delete() }, { merge: true });
  await syncStatus(uid);
}

/** Every connection holding an Instagram token, for the refresh sweep. */
export async function listInstagramConnections(): Promise<
  Array<{ uid: string; instagram: InstagramPublishConnection }>
> {
  const snapshot = await admin
    .firestore()
    .collection(CONNECTIONS)
    .where("instagram.igUserId", "!=", "")
    .get();

  return snapshot.docs.flatMap((doc) => {
    const instagram = (doc.data() as MetaPublishConnections).instagram;
    return instagram ? [{ uid: doc.id, instagram }] : [];
  });
}

export interface MetaPublishStatus {
  instagram: {
    accountId: string;
    username: string;
    accountType: "BUSINESS" | "CREATOR" | "UNKNOWN";
    route: "instagram-login";
    expiresAtMs: number;
    capabilities: InstagramCapabilitySnapshot;
  } | null;
  facebookPage: {
    selectedPageId: string;
    selectedPageName: string;
    pages: Array<{ id: string; name: string }>;
    expiresAtMs: number;
  } | null;
}

/**
 * Rewrites the client-readable mirror from the credential doc. Called after
 * every write so the two can never disagree about what is connected.
 */
export async function syncStatus(uid: string): Promise<MetaPublishStatus> {
  const connections = await readConnections(uid);
  const facebook = connections.facebookPage;
  const selected = facebook?.pages.find(
    (page) => page.id === facebook.selectedPageId
  );

  const status: MetaPublishStatus = {
    instagram: connections.instagram
      ? {
          accountId: connections.instagram.igUserId,
          username: connections.instagram.username,
          accountType: connections.instagram.accountType ?? "UNKNOWN",
          route: "instagram-login",
          expiresAtMs: connections.instagram.expiresAt.toMillis(),
          capabilities: buildInstagramCapabilitySnapshot(connections.instagram),
        }
      : null,
    facebookPage: facebook
      ? {
          selectedPageId: facebook.selectedPageId,
          selectedPageName: selected?.name ?? "",
          pages: facebook.pages.map((page) => ({
            id: page.id,
            name: page.name,
          })),
          expiresAtMs: facebook.expiresAt.toMillis(),
        }
      : null,
  };

  await admin
    .firestore()
    .collection(STATUS)
    .doc(uid)
    .set(
      { ...status, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: false }
    );

  return status;
}
