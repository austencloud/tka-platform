/**
 * Reconcile Firebase Auth custom claims with the `role` field on users/{uid}.
 *
 * The app's runtime role comes ONLY from Auth custom claims
 * (auth-state.svelte.ts reads `idTokenResult.claims.role`); the Firestore
 * `role` field is what the admin UI and the F9 preview panel display. When a
 * role is set by anything other than POST /api/admin/user-auth/[uid] — which
 * writes both — the two drift, and the user keeps the privileges of the
 * claim, not the ones the admin sees. That drift is invisible in every admin
 * surface, which is what makes it worth a dedicated tool.
 *
 * Usage:
 *   node scripts/sync-role-claims.mjs                 # dry run (default)
 *   node scripts/sync-role-claims.mjs --apply         # write claims
 *   node scripts/sync-role-claims.mjs --apply --allow-demote
 *
 * Demotions (claim role stronger than the Firestore role, e.g. an admin whose
 * doc says "user") are REFUSED unless --allow-demote, so a stale or
 * partially-written user doc can never quietly strip an administrator.
 */
import admin from "firebase-admin";
import { readFileSync } from "fs";

const APPLY = process.argv.includes("--apply");
const ALLOW_DEMOTE = process.argv.includes("--allow-demote");

const ROLE_HIERARCHY = ["user", "premium", "tester", "admin"];
const rank = (role) => ROLE_HIERARCHY.indexOf(role);

const serviceAccount = JSON.parse(
  readFileSync("E:/tka-platform/serviceAccountKey.json", "utf8")
);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const auth = admin.auth();
const db = admin.firestore();

const snap = await db.collection("users").get();
const withRole = snap.docs.filter((d) => ROLE_HIERARCHY.includes(d.data().role));

const planned = [];
const refused = [];

for (const d of withRole) {
  const target = d.data().role;
  const name = d.data().displayName ?? d.id;
  let user;
  try {
    user = await auth.getUser(d.id);
  } catch {
    continue; // Firestore doc with no Auth record — nothing to sync.
  }
  const claims = user.customClaims ?? {};
  const current = claims.admin === true ? "admin" : (claims.role ?? "user");
  if (current === target) continue;

  const entry = { uid: d.id, name, current, target, claims };
  if (rank(target) < rank(current) && !ALLOW_DEMOTE) refused.push(entry);
  else planned.push(entry);
}

console.log(`users with a role field: ${withRole.length} / ${snap.size}`);
console.log(`in sync: ${withRole.length - planned.length - refused.length}`);
console.log(`to change: ${planned.length}   refused (demotion): ${refused.length}\n`);

for (const p of planned) console.log(`  ${p.current} -> ${p.target}   ${p.name}`);
for (const r of refused)
  console.log(`  REFUSED ${r.current} -> ${r.target}   ${r.name} (pass --allow-demote)`);

if (!APPLY) {
  console.log("\nDry run. Re-run with --apply to write these claims.");
  process.exit(0);
}

console.log("\nApplying...");
for (const p of planned) {
  const next = {
    ...p.claims,
    role: p.target,
    admin: p.target === "admin",
    isAdmin: p.target === "admin",
  };
  await auth.setCustomUserClaims(p.uid, next);
  console.log(`  set ${p.name} -> ${p.target}`);
}
console.log(`\nDone: ${planned.length} updated.`);
console.log(
  "Claims reach a client on its next ID-token refresh (hourly, or immediately\n" +
    "on a forced getIdToken(true) / fresh sign-in)."
);
process.exit(0);
