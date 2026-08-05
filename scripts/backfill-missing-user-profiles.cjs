#!/usr/bin/env node
/**
 * Backfill `users/{uid}` for Auth accounts that have none.
 *
 * Companion to the reconcileMissingProfiles cloud function, for the accounts
 * that were already lost before that function existed. Same minting rules.
 *
 *   node scripts/backfill-missing-user-profiles.cjs            # dry run, last 30 days
 *   node scripts/backfill-missing-user-profiles.cjs --apply    # write
 *   node scripts/backfill-missing-user-profiles.cjs --all      # widen past 30 days
 *
 * Anonymous/guest accounts are never provisioned — a guest is not a signup.
 * The 30-day window is deliberate: older gaps are dormant test accounts, not
 * the live regression, and minting profiles for them puts stale rows in the
 * admin panel.
 */
const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

const APPLY = process.argv.includes("--apply");
const ALL = process.argv.includes("--all");
const MAX_AGE_DAYS = 30;

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

function generateColorFromString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  const h = Math.abs(hash % 360);
  const s = 65 + (Math.abs(hash) % 20);
  const l = 45 + (Math.abs(hash >> 8) % 15);
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
  const toHex = (n) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? `0${hex}` : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function generateAvatarUrl(name, size = 256) {
  const displayName = name || "Anonymous";
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" fill="${generateColorFromString(displayName)}" />
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

function capitalizeName(name) {
  return name
    .split(" ")
    .map((word) =>
      word.includes("'")
        ? word
            .split("'")
            .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
            .join("'")
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join(" ");
}

async function claimAvailableUsername(base, uid) {
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
  for (const candidate of candidates) {
    const lower = candidate.toLowerCase().trim();
    const ref = db.collection("usernames").doc(lower);
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
  return `${cleanBase}_${uid.substring(0, 6).toLowerCase()}`;
}

(async () => {
  const authUsers = [];
  let page = await admin.auth().listUsers(1000);
  authUsers.push(...page.users);
  while (page.pageToken) {
    page = await admin.auth().listUsers(1000, page.pageToken);
    authUsers.push(...page.users);
  }

  const snap = await db.collection("users").get();
  const haveDoc = new Set(snap.docs.map((d) => d.id));

  const missing = authUsers
    .filter((u) => !haveDoc.has(u.uid))
    .filter((u) => !(u.providerData.length === 0 && !u.email))
    .filter(
      (u) =>
        ALL ||
        Date.parse(u.metadata.creationTime) >=
          Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000
    )
    .sort(
      (a, b) =>
        Date.parse(a.metadata.creationTime) -
        Date.parse(b.metadata.creationTime)
    );

  console.log(
    `${APPLY ? "APPLY" : "DRY RUN"} — ${missing.length} real accounts missing users/{uid}\n`
  );

  for (const user of missing) {
    const rawName =
      user.displayName ||
      user.providerData.find((p) => p.displayName)?.displayName ||
      user.email?.split("@")[0] ||
      "Anonymous User";
    const displayName = capitalizeName(rawName);

    if (!APPLY) {
      console.log(
        `would create  ${user.uid}  ${user.email ?? "(no email)"}  as "${displayName}"  (signed up ${user.metadata.creationTime})`
      );
      continue;
    }

    const username = await claimAvailableUsername(
      user.email?.split("@")[0] || user.uid.substring(0, 8),
      user.uid
    );
    const photo = user.photoURL || generateAvatarUrl(displayName, 256);

    await db
      .collection("users")
      .doc(user.uid)
      .create({
        publicProfileVersion: 2,
        displayName,
        username,
        usernameLowercase: username.toLowerCase().trim(),
        photoURL: photo,
        avatar: photo,
        createdAt: admin.firestore.Timestamp.fromMillis(
          Date.parse(user.metadata.creationTime)
        ),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastActivityDate: admin.firestore.Timestamp.fromMillis(
          Date.parse(user.metadata.lastSignInTime || user.metadata.creationTime)
        ),
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
            user.providerData.find((p) => p.providerId === "facebook.com")
              ?.uid ?? null,
        },
        { merge: true }
      );

    console.log(
      `created  ${user.uid}  ${user.email ?? "(no email)"}  "${displayName}"  @${username}`
    );
  }

  console.log(APPLY ? "\nDone." : "\nNo writes made. Re-run with --apply.");
  process.exit(0);
})().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
