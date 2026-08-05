#!/usr/bin/env node
/**
 * Repair display names that were derived from an email local-part.
 *
 * createOrUpdateUserDocument resolved a name as
 * `user.displayName || user.email.split("@")[0]`. Google sign-ins routinely
 * arrive with an empty top-level displayName and the real name only on the
 * provider record, so real people were stored as "Jasminehartart" and
 * "Hairbykevin127" instead of "Jasmine Hart" and "Kevin Wheatley". The name
 * resolution is fixed going forward (provisionUserProfile.ts); this repairs
 * the profiles minted before that.
 *
 *   node scripts/repair-mangled-display-names.cjs            # dry run
 *   node scripts/repair-mangled-display-names.cjs --apply    # write
 *
 * SAFETY: only rewrites a profile whose stored displayName is EXACTLY what the
 * email-local-part fallback would have produced. That proves the name was
 * auto-generated rather than chosen. A user who typed their own name — even a
 * name that happens to look email-ish — is left alone.
 *
 * `username` / `usernameLowercase` are NOT touched. Those are handles, they are
 * claimed in the `usernames` collection, and they appear in URLs.
 */
const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

const APPLY = process.argv.includes("--apply");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

/** Port of capitalizeName in user-document-manager.ts. */
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

/** The name the fixed resolver would produce today. */
function bestName(user) {
  const raw =
    user.displayName ||
    user.providerData.find((p) => p.displayName)?.displayName ||
    user.email?.split("@")[0] ||
    null;
  return raw ? capitalizeName(raw) : null;
}

(async () => {
  const authUsers = [];
  let page = await admin.auth().listUsers(1000);
  authUsers.push(...page.users);
  while (page.pageToken) {
    page = await admin.auth().listUsers(1000, page.pageToken);
    authUsers.push(...page.users);
  }
  const byUid = new Map(authUsers.map((u) => [u.uid, u]));

  const snap = await db.collection("users").get();
  const repairs = [];
  const skipped = [];

  for (const docSnap of snap.docs) {
    const user = byUid.get(docSnap.id);
    if (!user || !user.email) continue;

    const stored = docSnap.get("displayName");
    if (typeof stored !== "string" || !stored) continue;

    const emailLocal = user.email.split("@")[0];
    const emailDerived = capitalizeName(emailLocal);

    // Was this name auto-generated from the email? If not, it is the user's
    // own and we do not touch it.
    const wasEmailDerived =
      stored === emailDerived || stored === emailLocal;
    if (!wasEmailDerived) continue;

    const better = bestName(user);
    if (!better || better === stored) {
      skipped.push({ uid: docSnap.id, email: user.email, stored });
      continue;
    }

    repairs.push({ uid: docSnap.id, email: user.email, stored, better });
  }

  console.log(
    `${APPLY ? "APPLY" : "DRY RUN"} — scanned ${snap.size} profiles, ${repairs.length} to repair\n`
  );

  for (const r of repairs) {
    if (!APPLY) {
      console.log(`would rename  "${r.stored}"  ->  "${r.better}"   (${r.email})`);
      continue;
    }
    await db.collection("users").doc(r.uid).update({
      displayName: r.better,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`renamed  "${r.stored}"  ->  "${r.better}"   (${r.email})`);
  }

  if (skipped.length) {
    console.log(
      `\n${skipped.length} email-derived name(s) left as-is (Auth has no better name to offer):`
    );
    for (const s of skipped) console.log(`  "${s.stored}"  (${s.email})`);
  }

  console.log(APPLY ? "\nDone." : "\nNo writes made. Re-run with --apply.");
  process.exit(0);
})().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
