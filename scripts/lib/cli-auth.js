/**
 * CLI Authentication Module (PKCE)
 *
 * Handles developer identity for CLI operations using OAuth 2.0 with PKCE
 * (Proof Key for Code Exchange). No client secret needed — the security comes
 * from a one-time random verifier + SHA-256 challenge, not an embedded secret.
 *
 * Resolution order:
 *   1. ~/.tka/credentials.json (personal Google OAuth login)
 *   2. ./serviceAccountKey.json (admin service account, legacy/backward compatible)
 *   3. Error with login instructions
 *
 * Usage:
 *   import cliAuth from "./lib/cli-auth.js";
 *   const identity = await cliAuth.resolveIdentity();
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { randomBytes, createHash } from "crypto";
import http from "http";
import { URL } from "url";

// Firebase & OAuth Configuration

const OAUTH_CONFIG = {
  // Desktop OAuth client with PKCE (OAuth 2.1 standard for CLI tools)
  // Google's token endpoint requires client_secret even for desktop/PKCE flows.
  // For desktop clients this is NOT a real secret — Google documents it as safe to embed.
  // Same pattern used by gcloud CLI, firebase-tools, and other Google CLI tools.
  clientId: "664225703033-i9had4ijqua22fge706s7ugtn1isjhs5.apps.googleusercontent.com",
  clientSecret: "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",
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

// Paths

const TKA_DIR = join(homedir(), ".tka");
const CREDENTIALS_PATH = join(TKA_DIR, "credentials.json");
const SERVICE_ACCOUNT_PATH = "./serviceAccountKey.json";

// Helpers

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
    console.warn("  ⚠️  Credentials file is corrupted — will re-authenticate.");
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

function successPage(title, message, isSuccess) {
  const bg = isSuccess ? "#0a0a1a" : "#1a0a0a";
  const accent = isSuccess ? "#22c55e" : "#ef4444";
  const glow = isSuccess ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)";
  const icon = isSuccess ? "&#10003;" : "&#10007;";
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${title}</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:${bg};font-family:system-ui,-apple-system,sans-serif;">
  <div style="text-align:center;padding:3rem 4rem;border-radius:16px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);box-shadow:0 0 80px ${glow};">
    <div style="width:64px;height:64px;margin:0 auto 1.5rem;border-radius:50%;background:${accent};display:flex;align-items:center;justify-content:center;">
      <span style="font-size:32px;color:#fff;line-height:1;">${icon}</span>
    </div>
    <h1 style="color:#f0f0f0;font-size:1.5rem;font-weight:600;margin:0 0 0.5rem;">${title}</h1>
    <p style="color:rgba(255,255,255,0.5);font-size:0.95rem;margin:0;">${message}</p>
  </div>
</body></html>`;
}

// ---------------------------------------------------------------------------
// PKCE (Proof Key for Code Exchange)
// ---------------------------------------------------------------------------

/**
 * Generate a cryptographically random code verifier (43-128 chars, URL-safe).
 * RFC 7636 Section 4.1
 */
function generateCodeVerifier() {
  return randomBytes(32).toString("base64url");
}

/**
 * Derive the code challenge from the verifier using SHA-256.
 * RFC 7636 Section 4.2
 */
function generateCodeChallenge(verifier) {
  return createHash("sha256").update(verifier).digest("base64url");
}

// ---------------------------------------------------------------------------
// OAuth Login Flow (PKCE — no client secret needed)
// ---------------------------------------------------------------------------

/**
 * Interactive OAuth login flow using PKCE.
 *
 * PKCE eliminates the need for a client secret. Instead:
 * 1. Generate a random code_verifier (kept in memory, never sent to Google)
 * 2. Hash it to create a code_challenge (sent with the auth request)
 * 3. After user signs in, exchange the auth code + original verifier for tokens
 * 4. Google verifies: SHA256(verifier) === challenge it received earlier
 *
 * This is the OAuth 2.1 standard for public clients (CLI tools, mobile apps).
 * Same pattern used by gcloud, gh, firebase-tools, and every modern CLI.
 */
async function login() {
  const { clientId, scopes } = OAUTH_CONFIG;

  // Generate PKCE pair — verifier stays in memory, challenge goes to Google
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

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
        `&prompt=consent` +
        `&code_challenge=${encodeURIComponent(codeChallenge)}` +
        `&code_challenge_method=S256`;

      console.log(`\n  Opening browser for Google sign-in...`);
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

  // Exchange auth code for Google tokens (PKCE: send verifier, not secret)
  console.log("  Exchanging auth code for tokens...");

  const { clientSecret } = OAUTH_CONFIG;
  let googleTokens;
  try {
    googleTokens = await postFormHttps("https://oauth2.googleapis.com/token", {
      code: authCode,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: capturedRedirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    });
  } catch (err) {
    console.error(`\n  Token exchange failed: ${err.message}\n`);
    process.exit(1);
  }

  if (googleTokens.error) {
    console.error(`\n  Google token exchange error: ${googleTokens.error_description || googleTokens.error}\n`);
    process.exit(1);
  }

  // Decode Google ID token to get user info (it's a JWT — middle segment is the payload)
  console.log("  Resolving Firebase identity...");

  let googleProfile;
  try {
    const payload = googleTokens.id_token.split(".")[1];
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    googleProfile = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch (err) {
    console.error(`\n  Failed to decode Google token: ${err.message}\n`);
    process.exit(1);
  }

  // Sign into Firebase using the Google ID token to get the Firebase UID.
  // Uses Client SDK compat — no service account key required.
  let firebaseUid;
  try {
    const firebase = (await import("firebase/compat/app")).default;
    await import("firebase/compat/auth");

    if (firebase.apps.length === 0) {
      firebase.initializeApp({
        apiKey: "AIzaSyBSFcJ4T0ssj1adw_KrxWColIu8GKiJI30",
        authDomain: "the-kinetic-alphabet.firebaseapp.com",
        projectId: "the-kinetic-alphabet",
      });
    }

    const credential = firebase.auth.GoogleAuthProvider.credential(googleTokens.id_token);
    const userCredential = await firebase.auth().signInWithCredential(credential);
    firebaseUid = userCredential.user.uid;
  } catch (err) {
    console.error(`\n  Could not sign into Firebase for ${googleProfile.email}.`);
    console.error("  Sign into the web app at least once first, then try again.\n");
    process.exit(1);
  }

  // Save credentials (Google refresh token for future re-auth, Firebase UID for identity)
  const credentials = {
    uid: firebaseUid,
    email: googleProfile.email,
    displayName: googleProfile.name || googleProfile.email.split("@")[0],
    photoUrl: googleProfile.picture || null,
    googleRefreshToken: googleTokens.refresh_token,
    expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // credentials don't expire (re-login to refresh)
  };

  saveCredentials(credentials);

  console.log(`\n  Logged in as ${credentials.displayName} (${credentials.email})`);
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
 * Returns identity without role — the caller looks up the role from Firestore
 * after initializing the database connection.
 *
 * @returns {Promise<{uid, email, displayName, photoUrl, authMethod}>}
 */
async function resolveIdentity() {
  // Path 1: Personal OAuth credentials
  const creds = loadCredentials();
  if (creds) {
    // Credentials are identity-only (Firebase UID, email, display name).
    // Firestore access uses Admin SDK, so no Firebase ID token refresh needed.
    // If credentials are very old (past expiresAt), prompt re-login.
    if (isExpired(creds)) {
      console.log("  ⚠️  Credentials expired — re-authenticating...");
      return null;
    }

    return {
      uid: creds.uid,
      email: creds.email,
      displayName: creds.displayName,
      photoUrl: creds.photoUrl,
      authMethod: "oauth",
    };
  }

  // Path 2: Service account fallback (legacy — admin access)
  if (existsSync(SERVICE_ACCOUNT_PATH)) {
    const { uid, email, displayName, photoUrl, authMethod } = ADMIN_IDENTITY;
    return { uid, email, displayName, photoUrl, authMethod };
  }

  // Path 3: No credentials — return null so caller can trigger auto-login
  return null;
}

// ---------------------------------------------------------------------------
// Whoami
// ---------------------------------------------------------------------------

/**
 * Print identity info to console.
 * Expects an identity object (with optional `role` field set by the caller).
 */
function whoami(identity) {
  const role = identity.role || "unknown";

  console.log(`\n  ╭─────────────────────────────────────╮`);
  console.log(`  │  TKA CLI Identity                    │`);
  console.log(`  ├─────────────────────────────────────┤`);
  console.log(`  │  Name:   ${identity.displayName.padEnd(27)}│`);
  console.log(`  │  Email:  ${identity.email.padEnd(27)}│`);
  console.log(`  │  UID:    ${identity.uid.slice(0, 25).padEnd(27)}│`);
  console.log(`  │  Role:   ${role.padEnd(27)}│`);
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
