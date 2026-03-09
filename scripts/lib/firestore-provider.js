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

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDKUM9pf0e_KgFjW1OBKChvrU75SnR12v4",
  authDomain: "the-kinetic-alphabet.firebaseapp.com",
  projectId: "the-kinetic-alphabet",
};

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
  const { URL } = await import("url");
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

let _cached = null;
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
  const serviceAccount = JSON.parse(
    readFileSync(SERVICE_ACCOUNT_PATH, "utf8")
  );

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  _adminAuth = admin.auth();

  return {
    db: admin.firestore(),
    FieldValue: admin.firestore.FieldValue,
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
 * @returns {Promise<{ db: any, FieldValue: any, auth: any, isAdmin: boolean, sdk: "client" | "admin" }>}
 */
export async function initFirestore() {
  if (_cached) return _cached;

  // Priority 1: Client SDK via saved OAuth credentials
  const credentials = loadCredentials();
  if (credentials?.googleRefreshToken) {
    _cached = await initClientSdk(credentials);
    return _cached;
  }

  // Priority 2: Admin SDK via service account key
  if (existsSync(SERVICE_ACCOUNT_PATH)) {
    _cached = await initAdminSdk();
    return _cached;
  }

  // Priority 3: No credentials available
  throw new Error(
    [
      "No Firebase credentials found.",
      "",
      "Contributors: run `node scripts/cli-login.js` to authenticate with Google.",
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
  // If we haven't initialized yet, do so now
  if (!_cached) {
    await initFirestore();
  }
  return _adminAuth;
}
