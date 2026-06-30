/**
 * Firestore Provider
 *
 * Abstracts Firestore initialization behind a unified interface so the CLI
 * tools work with either the Client SDK (contributor path, respects security
 * rules) or the Admin SDK (admin fallback, bypasses rules).
 *
 * Priority:
 *   1. ~/.tka/credentials.json  → Client SDK compat (contributor)
 *   2. ./serviceAccountKey.json → Admin SDK (admin)
 *   3. Error with login instructions
 *
 * Usage:
 *   import { initFirestore, getAdminAuth } from "./lib/firestore-provider.js";
 *   const { db, FieldValue, isAdmin, sdk } = await initFirestore();
 */

import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// CLI API key — unrestricted by referrer, limited to Identity Toolkit + Firestore + Token Service.
// The web app uses a separate key with referrer restrictions.
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBSFcJ4T0ssj1adw_KrxWColIu8GKiJI30",
  authDomain: "the-kinetic-alphabet.firebaseapp.com",
  projectId: "the-kinetic-alphabet",
};

// Google's token endpoint requires client_secret even for desktop/PKCE flows.
// For desktop clients this is NOT a real secret — Google documents it as safe to embed.
// Same pattern used by gcloud CLI, firebase-tools, and other Google CLI tools.
const OAUTH_CONFIG = {
  clientId:
    "664225703033-i9had4ijqua22fge706s7ugtn1isjhs5.apps.googleusercontent.com",
  clientSecret: "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",
};

const CREDENTIALS_PATH = join(homedir(), ".tka", "credentials.json");
const SERVICE_ACCOUNT_PATH = "./serviceAccountKey.json";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * POST a form-encoded request over HTTPS. Returns parsed JSON.
 * Same pattern as cli-auth.js.
 */
async function postFormHttps(url, params) {
  const https = await import("https");
  const mod = https.default || https;
  const body = new URLSearchParams(params).toString();
  const parsed = new URL(url);

  return new Promise((resolve, reject) => {
    const req = mod.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname + parsed.search,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(
              new Error(
                `Invalid JSON response from ${url}: ${data.slice(0, 200)}`
              )
            );
          }
        });
      }
    );

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function loadCredentials() {
  if (!existsSync(CREDENTIALS_PATH)) return null;
  try {
    return JSON.parse(readFileSync(CREDENTIALS_PATH, "utf8"));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cached singleton — both initFirestore() and getAdminAuth() share this.
// ---------------------------------------------------------------------------

let _initPromise = null;
let _adminAuth = null;

// ---------------------------------------------------------------------------
// Client SDK initialization (contributor path)
// ---------------------------------------------------------------------------

async function initClientSdk(credentials) {
  const tokens = await postFormHttps("https://oauth2.googleapis.com/token", {
    client_id: OAUTH_CONFIG.clientId,
    client_secret: OAUTH_CONFIG.clientSecret,
    refresh_token: credentials.googleRefreshToken,
    grant_type: "refresh_token",
  });

  if (tokens.error) {
    throw new Error(
      `Token refresh failed: ${tokens.error} — ${tokens.error_description || "unknown"}`
    );
  }

  if (!tokens.id_token) {
    throw new Error(
      "Token refresh succeeded but no id_token returned. The refresh token may be invalid — try logging in again."
    );
  }

  const firebase = (await import("firebase/compat/app")).default;
  await import("firebase/compat/auth");
  await import("firebase/compat/firestore");

  if (firebase.apps.length === 0) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }

  const googleCredential = firebase.auth.GoogleAuthProvider.credential(
    tokens.id_token
  );
  await firebase.auth().signInWithCredential(googleCredential);

  return {
    db: firebase.firestore(),
    FieldValue: firebase.firestore.FieldValue,
    Timestamp: firebase.firestore.Timestamp,
    auth: null,
    isAdmin: false,
    sdk: "client",
  };
}

// ---------------------------------------------------------------------------
// Admin SDK initialization (admin fallback)
// ---------------------------------------------------------------------------

async function initAdminSdk() {
  const admin = (await import("firebase-admin")).default;

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, "utf8"));
  } catch (err) {
    throw new Error(`Failed to read service account key: ${err.message}`);
  }

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  _adminAuth = admin.auth();

  return {
    db: admin.firestore(),
    FieldValue: admin.firestore.FieldValue,
    Timestamp: admin.firestore.Timestamp,
    auth: _adminAuth,
    isAdmin: true,
    sdk: "admin",
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize Firestore and return a unified interface.
 *
 * @returns {Promise<{ db: any, FieldValue: any, Timestamp: any, auth: any, isAdmin: boolean, sdk: "client" | "admin" }>}
 */
export async function initFirestore() {
  if (!_initPromise) {
    _initPromise = _initFirestoreImpl();
  }
  return _initPromise;
}

async function _initFirestoreImpl() {
  // Opt-in override: force the Admin SDK (bypasses security rules) for repairs
  // that the contributor/client SDK can't perform — e.g. fixing other users'
  // publicSequences docs. Requires the service account key. Set TKA_ADMIN=1.
  if (process.env.TKA_ADMIN === "1") {
    if (!existsSync(SERVICE_ACCOUNT_PATH)) {
      throw new Error("TKA_ADMIN=1 set but serviceAccountKey.json not found in repo root.");
    }
    return await initAdminSdk();
  }

  // Priority 1: Client SDK via saved OAuth credentials
  const credentials = loadCredentials();
  if (credentials?.googleRefreshToken) {
    return await initClientSdk(credentials);
  }

  // Priority 2: Admin SDK via service account key
  if (existsSync(SERVICE_ACCOUNT_PATH)) {
    return await initAdminSdk();
  }

  // Priority 3: No credentials available
  throw new Error(
    [
      "No Firebase credentials found.",
      "",
      "Contributors: run `node scripts/fetch-feedback.js login` to authenticate with Google.",
      "Admins: place serviceAccountKey.json in the project root.",
    ].join("\n")
  );
}

/**
 * Get the Admin SDK auth instance for admin-only operations (e.g. getUserByEmail).
 * Returns null if running with the Client SDK.
 *
 * @returns {Promise<import("firebase-admin").auth.Auth | null>}
 */
export async function getAdminAuth() {
  // Ensure initialization has run
  if (_initPromise) {
    await _initPromise;
  }
  return _adminAuth;
}
