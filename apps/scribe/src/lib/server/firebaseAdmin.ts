import admin from "firebase-admin";
import { existsSync, readFileSync } from "node:fs";

let initialized = false;

function loadServiceAccount(): unknown {
  const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (fromEnv) {
    return JSON.parse(fromEnv);
  }

  if (existsSync("serviceAccountKey.json")) {
    try {
      return JSON.parse(readFileSync("serviceAccountKey.json", "utf8"));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to read serviceAccountKey.json: ${message}`);
    }
  }

  throw new Error(
    "Missing Firebase Admin credentials (set FIREBASE_SERVICE_ACCOUNT_JSON or provide serviceAccountKey.json)"
  );
}

export function getFirebaseAdminApp(): admin.app.App {
  if (initialized && admin.apps.length) {
    return admin.apps[0]!;
  }

  if (!admin.apps.length) {
    const serviceAccount = loadServiceAccount();
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    });
  }

  initialized = true;
  return admin.apps[0]!;
}

export function getAdminAuth(): admin.auth.Auth {
  return getFirebaseAdminApp().auth();
}

export function getAdminDb(): admin.firestore.Firestore {
  return getFirebaseAdminApp().firestore();
}
