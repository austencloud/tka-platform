/**
 * Server-side minting of `users/{uid}` — the public profile document.
 *
 * This used to be a client-side write in `createOrUpdateUserDocument`
 * (src/lib/shared/auth/services/user-document-manager.ts), whose failure was
 * swallowed by a `.catch(console.error)` in auth-state. On 2026-08-05 two real
 * Google signups produced an Auth record and a `userPrivateProfiles` doc but no
 * `users/{uid}` doc: the public-profile write reported success from the SDK's
 * local cache and never reached the server before the tab closed. Both users
 * were invisible to the admin panel AND to the signup notification, because
 * both key off this one document.
 *
 * The Admin SDK writes straight to the server with no offline cache and no
 * rules evaluation, so a signup can no longer produce an auth record with no
 * profile. The client write stays — it is faster when it works, and it is
 * idempotent with this one (both no-op when the doc already exists).
 *
 * Field set and shape deliberately mirror the client's create payload so a
 * server-minted profile is indistinguishable from a client-minted one, and
 * satisfies the schema-2 contract enforced in firestore.rules.
 */

import * as admin from "firebase-admin";
import type { UserRecord } from "firebase-admin/auth";

/** Matches PUBLIC_PROFILE_VERSION in src/lib/shared/community/domain/models/public-profile-contract.ts */
const PUBLIC_PROFILE_VERSION = 2;
const USERNAMES_COLLECTION = "usernames";

export type ProvisionOutcome = "created" | "already-exists" | "skipped-anonymous";

/** Port of src/lib/shared/foundation/utils/avatar-generator.ts — byte-identical output. */
function generateAvatarUrl(name: string | undefined | null, size = 64): string {
  const displayName = name || "Anonymous";
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || "")
    .join("");
  const backgroundColor = generateColorFromString(displayName);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" fill="${backgroundColor}" />
      <text
        x="50%"
        y="50%"
        dominant-baseline="central"
        text-anchor="middle"
        fill="#ffffff"
        font-family="system-ui, -apple-system, sans-serif"
        font-size="${size * 0.4}"
        font-weight="500"
      >${initials}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function generateColorFromString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  const h = Math.abs(hash % 360);
  const s = 65 + (Math.abs(hash) % 20);
  const l = 45 + (Math.abs(hash >> 8) % 15);
  return hslToHex(h, s, l);
}

function hslToHex(h: number, s: number, l: number): string {
  const sD = s / 100;
  const lD = l / 100;
  const c = (1 - Math.abs(2 * lD - 1)) * sD;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lD - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? `0${hex}` : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Port of capitalizeName in user-document-manager.ts. */
function capitalizeName(name: string): string {
  return name
    .split(" ")
    .map((word) => {
      if (word.includes("'")) {
        return word
          .split("'")
          .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
          .join("'");
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

/**
 * Claim the first free username derived from `base`, transactionally.
 *
 * The client version checks availability and claims in two steps, which can
 * race. Here the read and the write share one transaction, so two concurrent
 * signups on the same base can never both win.
 */
async function claimAvailableUsername(
  db: admin.firestore.Firestore,
  base: string,
  uid: string
): Promise<string> {
  let cleanBase = base
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .substring(0, 15)
    .replace(/^[-_]+|[-_]+$/g, "");
  if (cleanBase.length < 3) cleanBase = "user";

  const candidates = [cleanBase];
  for (let i = 0; i < 10; i++) {
    candidates.push(`${cleanBase}_${Math.floor(100 + Math.random() * 900)}`);
  }
  candidates.push(`${cleanBase}_${Date.now().toString().slice(-6)}`);

  for (const candidate of candidates) {
    const lower = candidate.toLowerCase().trim();
    const ref = db.collection(USERNAMES_COLLECTION).doc(lower);
    const won = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists && snap.get("userId") !== uid) return false;
      tx.set(ref, {
        userId: uid,
        username: candidate,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return true;
    });
    if (won) return candidate;
  }

  // Every candidate collided — fall back to something that cannot.
  return `${cleanBase}_${uid.substring(0, 6).toLowerCase()}`;
}

/**
 * Ensure `users/{uid}` exists for this account. Idempotent: returns
 * "already-exists" without writing when the profile is already there, so it is
 * safe to call from a trigger, a sweep, and a backfill over the same account.
 */
export async function provisionUserProfile(
  user: UserRecord
): Promise<ProvisionOutcome> {
  const isAnonymous = user.providerData.length === 0 && !user.email;
  if (isAnonymous) return "skipped-anonymous";

  const db = admin.firestore();
  const userDocRef = db.collection("users").doc(user.uid);

  if ((await userDocRef.get()).exists) return "already-exists";

  // Google sign-ins routinely land with an empty top-level displayName and the
  // real name only on the provider record. Reading the email local-part before
  // checking providerData is what named two real users "Jasminehartart" and
  // "Hairbykevin127" in the admin panel. Provider name first.
  const rawName =
    user.displayName ||
    user.providerData.find((p) => p.displayName)?.displayName ||
    user.email?.split("@")[0] ||
    "Anonymous User";
  const displayName = capitalizeName(rawName);
  const fallbackAvatar = generateAvatarUrl(displayName, 256);
  const photo = user.photoURL || fallbackAvatar;

  const username = await claimAvailableUsername(
    db,
    user.email?.split("@")[0] || user.uid.substring(0, 8),
    user.uid
  );

  // `create` (not `set`) so a client write that lands in the same instant wins
  // the race and this one aborts, rather than both writing and the loser
  // clobbering a profile the user has already started editing.
  try {
    await userDocRef.create({
      publicProfileVersion: PUBLIC_PROFILE_VERSION,
      displayName,
      username,
      usernameLowercase: username.toLowerCase().trim(),
      photoURL: photo,
      avatar: photo,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastActivityDate: admin.firestore.FieldValue.serverTimestamp(),
      sequenceCount: 0,
      collectionCount: 0,
      followerCount: 0,
      totalXP: 0,
      currentLevel: 1,
      achievementCount: 0,
      currentStreak: 0,
      longestStreak: 0,
      pronouns: null,
      isAdmin: false,
      isAnonymous: false,
    });
  } catch (err: unknown) {
    // ALREADY_EXISTS = the client got there first. That is a success.
    if ((err as { code?: number }).code === 6) return "already-exists";
    throw err;
  }

  // Private profile is a merge — the client may already have written it, as it
  // did for both 2026-08-05 signups whose public profile was lost.
  await db
    .collection("userPrivateProfiles")
    .doc(user.uid)
    .set(
      {
        email: user.email ?? null,
        googleId:
          user.providerData.find((p) => p.providerId === "google.com")?.uid ??
          null,
        googlePhotoURL:
          user.providerData.find((p) => p.providerId === "google.com")
            ?.photoURL ?? null,
        facebookId:
          user.providerData.find((p) => p.providerId === "facebook.com")?.uid ??
          null,
      },
      { merge: true }
    );

  return "created";
}
