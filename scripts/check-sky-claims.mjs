// Read-only: is Sky's tester claim live, and would his client have picked it up?
import admin from "firebase-admin";
import { readFileSync } from "fs";
const serviceAccount = JSON.parse(
  readFileSync("E:/tka-platform/serviceAccountKey.json", "utf8")
);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const auth = admin.auth();

const users = await db.collection("users").get();
const matches = users.docs.filter((d) => {
  const x = d.data();
  return /sky/i.test(`${x.displayName ?? ""} ${x.username ?? ""} ${x.email ?? ""}`);
});

for (const d of matches) {
  const x = d.data();
  const u = await auth.getUser(d.id);
  console.log(`\nusers/${d.id}`);
  console.log("  displayName :", x.displayName, "| username:", x.username);
  console.log("  email       :", x.email);
  console.log("  firestore   : role =", x.role);
  console.log("  auth claims :", JSON.stringify(u.customClaims ?? {}));
  console.log("  lastSignIn  :", u.metadata.lastSignInTime);
  console.log("  lastRefresh :", u.metadata.lastRefreshTime);
  console.log("  tokensValidAfter:", u.tokensValidAfterTime);
}
console.log("\nnow:", new Date().toISOString());
process.exit(0);
