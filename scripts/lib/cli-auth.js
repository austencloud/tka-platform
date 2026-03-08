/**
 * CLI Authentication Module
 *
 * Handles developer identity for CLI operations.
 *
 * Resolution order:
 *   1. ~/.tka/credentials.json (personal Google OAuth login)
 *   2. ./serviceAccountKey.json (admin service account, legacy/backward compatible)
 *   3. Error with login instructions
 *
 * Usage:
 *   import cliAuth from "./lib/cli-auth.js";
 *   const identity = await cliAuth.resolveIdentity(db);
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import http from "http";
import { URL } from "url";

// ---------------------------------------------------------------------------
// Firebase & OAuth Configuration
// ---------------------------------------------------------------------------

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDKUM9pf0e_KgFjW1OBKChvrU75SnR12v4",
  projectId: "the-kinetic-alphabet",
};

const OAUTH_CONFIG = {
  clientId: "PLACEHOLDER_FILL_FROM_FIREBASE_CONSOLE",
  clientSecret: "PLACEHOLDER_FILL_FROM_FIREBASE_CONSOLE",
  scopes: ["openid", "email", "profile"],
};

// Admin fallback identity (Austen Cloud — service account path)
const ADMIN_UID = "PBp3GSBO6igCKPwJyLZNmVEmamI3";
const ADMIN_IDENTITY = {
  uid: ADMIN_UID,
  email: "austencloud@gmail.com",
  displayName: "Austen Cloud",
  photoUrl: null,
  role: "admin",
  authMethod: "service-account",
};

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const TKA_DIR = join(homedir(), ".tka");
const CREDENTIALS_PATH = join(TKA_DIR, "credentials.json");
const SERVICE_ACCOUNT_PATH = "./serviceAccountKey.json";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureTkaDir() {
  if (!existsSync(TKA_DIR)) {
    mkdirSync(TKA_DIR, { recursive: true });
  }
}

function loadCredentials() {
  if (!existsSync(CREDENTIALS_PATH)) return null;
  try {
    return JSON.parse(readFileSync(CREDENTIALS_PATH, "utf8"));
  } catch {
    return null;
  }
}

function saveCredentials(creds) {
  ensureTkaDir();
  writeFileSync(CREDENTIALS_PATH, JSON.stringify(creds, null, 2), "utf8");
}

function isExpired(creds) {
  if (!creds.expiresAt) return true;
  // Refresh 5 minutes before actual expiry
  return Date.now() > creds.expiresAt - 5 * 60 * 1000;
}

/**
 * POST a form-encoded request over HTTPS. Returns parsed JSON.
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
            reject(new Error(`Invalid JSON response from ${url}: ${data.slice(0, 200)}`));
          }
        });
      }
    );

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

/**
 * POST a JSON body over HTTPS. Returns parsed JSON.
 */
async function postJsonHttps(url, jsonBody) {
  const https = await import("https");
  const mod = https.default || https;
  const body = JSON.stringify(jsonBody);
  const parsed = new URL(url);

  return new Promise((resolve, reject) => {
    const req = mod.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname + parsed.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const result = JSON.parse(data);
            if (result.error) {
              reject(new Error(result.error.message || JSON.stringify(result.error)));
            } else {
              resolve(result);
            }
          } catch {
            reject(new Error(`Invalid response from ${url}: ${data.slice(0, 200)}`));
          }
        });
      }
    );

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function successPage(title, message, isSuccess) {
  const color = isSuccess ? "#4caf50" : "#f44336";
  const icon = isSuccess ? "✓" : "✗";
  return (
    `<html><body style="font-family:system-ui;text-align:center;padding:3rem;">` +
    `<h2 style="color:${color};">${icon} ${title}</h2>` +
    `<p>${message}</p>` +
    `</body></html>`
  );
}

// ---------------------------------------------------------------------------
// Token Refresh
// ---------------------------------------------------------------------------

/**
 * Refresh an expired Firebase ID token using the refresh token.
 * Uses the Firebase secure token endpoint.
 */
async function refreshIdToken(refreshToken) {
  const url = `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_CONFIG.apiKey}`;
  const result = await postFormHttps(url, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  if (result.error) {
    throw new Error(`Token refresh failed: ${result.error.message || result.error}`);
  }

  return {
    idToken: result.id_token,
    refreshToken: result.refresh_token,
    expiresAt: Date.now() + Number(result.expires_in) * 1000,
  };
}

// ---------------------------------------------------------------------------
// OAuth Login Flow
// ---------------------------------------------------------------------------

/**
 * Interactive OAuth login flow.
 *
 * 1. Starts local HTTP server on random port
 * 2. Opens browser to Google OAuth consent URL
 * 3. Receives redirect with auth code at /callback
 * 4. Exchanges auth code for Google tokens via googleapis
 * 5. Exchanges Google ID token for Firebase Auth credentials via identitytoolkit
 * 6. Saves credentials to ~/.tka/credentials.json
 */
async function login() {
  const { clientId, clientSecret, scopes } = OAUTH_CONFIG;

  if (clientId.startsWith("PLACEHOLDER")) {
    console.error("\n  ❌ OAuth client not configured yet.");
    console.error("  Fill in clientId and clientSecret in scripts/lib/cli-auth.js");
    console.error("  (Task 7 — get these from Firebase Console > Authentication > Sign-in method > Google)\n");
    process.exit(1);
  }

  let capturedRedirectUri = null;

  // Start local callback server on a random port and wait for the auth code
  const authCode = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const reqUrl = new URL(req.url, `http://127.0.0.1`);

      if (reqUrl.pathname !== "/callback") {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const code = reqUrl.searchParams.get("code");
      const error = reqUrl.searchParams.get("error");

      if (error) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(successPage("Login failed", error, false));
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      if (!code) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(successPage("Missing auth code", "No authorization code received.", false));
        server.close();
        reject(new Error("No auth code received"));
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(successPage("Logged in to TKA CLI", "You can close this tab and return to your terminal.", true));
      server.close();
      resolve(code);
    });

    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      capturedRedirectUri = `http://127.0.0.1:${port}/callback`;

      const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(capturedRedirectUri)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(scopes.join(" "))}` +
        `&access_type=offline` +
        `&prompt=consent`;

      console.log(`\n  🔐 Opening browser for Google sign-in...`);
      console.log(`  If the browser doesn't open, visit:\n  ${authUrl}\n`);

      // Open browser (cross-platform)
      const openCmd =
        process.platform === "win32" ? `start "" "${authUrl}"`
        : process.platform === "darwin" ? `open "${authUrl}"`
        : `xdg-open "${authUrl}"`;

      import("child_process").then(({ execSync: exec }) => {
        try {
          exec(openCmd, { stdio: "ignore" });
        } catch {
          // Browser open failed — user can copy the URL manually
        }
      });
    });

    // Timeout after 2 minutes
    setTimeout(() => {
      server.close();
      reject(new Error("Login timed out — no callback received within 2 minutes"));
    }, 120_000);
  });

  // Exchange auth code for Google tokens
  console.log("  Exchanging auth code for tokens...");

  const googleTokens = await postFormHttps("https://oauth2.googleapis.com/token", {
    code: authCode,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: capturedRedirectUri,
    grant_type: "authorization_code",
  });

  if (googleTokens.error) {
    throw new Error(`Google token exchange failed: ${googleTokens.error_description || googleTokens.error}`);
  }

  // Exchange Google ID token for Firebase Auth credentials
  console.log("  Signing in to Firebase...");

  const firebaseAuth = await postJsonHttps(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${FIREBASE_CONFIG.apiKey}`,
    {
      postBody: `id_token=${googleTokens.id_token}&providerId=google.com`,
      requestUri: "http://localhost",
      returnIdpCredential: true,
      returnSecureToken: true,
    }
  );

  // Save credentials
  const credentials = {
    uid: firebaseAuth.localId,
    email: firebaseAuth.email,
    displayName: firebaseAuth.displayName,
    photoUrl: firebaseAuth.photoUrl || null,
    idToken: firebaseAuth.idToken,
    refreshToken: firebaseAuth.refreshToken,
    expiresAt: Date.now() + Number(firebaseAuth.expiresIn) * 1000,
  };

  saveCredentials(credentials);

  console.log(`\n  ✅ Logged in as ${credentials.displayName} (${credentials.email})`);
  console.log(`  Credentials saved to ${CREDENTIALS_PATH}\n`);
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

/**
 * Delete saved credentials.
 */
function logout() {
  if (existsSync(CREDENTIALS_PATH)) {
    unlinkSync(CREDENTIALS_PATH);
    console.log(`\n  ✅ Logged out. Credentials removed from ${CREDENTIALS_PATH}\n`);
  } else {
    console.log(`\n  No credentials found at ${CREDENTIALS_PATH}\n`);
  }
}

// ---------------------------------------------------------------------------
// Identity Resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the current developer's identity.
 *
 * Priority:
 *   1. ~/.tka/credentials.json (personal OAuth login)
 *   2. ./serviceAccountKey.json (admin service account fallback)
 *   3. Error — must log in
 *
 * @param {FirebaseFirestore.Firestore} db - Firestore instance for role lookup
 * @returns {Promise<{uid, email, displayName, photoUrl, role, authMethod}>}
 */
async function resolveIdentity(db) {
  // Path 1: Personal OAuth credentials
  const creds = loadCredentials();
  if (creds) {
    // Refresh token if expired
    if (isExpired(creds)) {
      try {
        const refreshed = await refreshIdToken(creds.refreshToken);
        creds.idToken = refreshed.idToken;
        creds.refreshToken = refreshed.refreshToken;
        creds.expiresAt = refreshed.expiresAt;
        saveCredentials(creds);
      } catch (err) {
        console.error(`\n  ⚠️  Token refresh failed: ${err.message}`);
        console.error("  Run: node scripts/fetch-feedback.js login\n");
        process.exit(1);
      }
    }

    // Look up role from developers collection
    const role = await lookupRole(db, creds.uid);

    return {
      uid: creds.uid,
      email: creds.email,
      displayName: creds.displayName,
      photoUrl: creds.photoUrl,
      role,
      authMethod: "oauth",
    };
  }

  // Path 2: Service account fallback (legacy — admin access)
  if (existsSync(SERVICE_ACCOUNT_PATH)) {
    return { ...ADMIN_IDENTITY };
  }

  // Path 3: No credentials at all
  console.error("\n  ❌ Not authenticated.");
  console.error("  Run: node scripts/fetch-feedback.js login");
  console.error("  Or place serviceAccountKey.json in the project root.\n");
  process.exit(1);
}

/**
 * Look up a developer's role from the developers Firestore collection.
 * Falls back to "contributor" if not found.
 */
async function lookupRole(db, uid) {
  try {
    const doc = await db.collection("developers").doc(uid).get();
    if (doc.exists) {
      return doc.data().role || "contributor";
    }
    return "contributor";
  } catch {
    // If Firestore lookup fails, default to contributor (safe fallback)
    return "contributor";
  }
}

// ---------------------------------------------------------------------------
// Whoami
// ---------------------------------------------------------------------------

/**
 * Print current identity info to console.
 */
async function whoami(db) {
  const identity = await resolveIdentity(db);

  console.log(`\n  ╭─────────────────────────────────────╮`);
  console.log(`  │  TKA CLI Identity                    │`);
  console.log(`  ├─────────────────────────────────────┤`);
  console.log(`  │  Name:   ${identity.displayName.padEnd(27)}│`);
  console.log(`  │  Email:  ${identity.email.padEnd(27)}│`);
  console.log(`  │  UID:    ${identity.uid.slice(0, 25).padEnd(27)}│`);
  console.log(`  │  Role:   ${identity.role.padEnd(27)}│`);
  console.log(`  │  Auth:   ${identity.authMethod.padEnd(27)}│`);
  console.log(`  ╰─────────────────────────────────────╯\n`);
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export default {
  login,
  logout,
  whoami,
  resolveIdentity,
};
