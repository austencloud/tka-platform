# MCP Resource-Server Authorization Implementation Plan (v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the unauthenticated `/mcp` HTTP endpoint on the Flow Arts Knowledge MCP server, using the MCP SDK's own primitives, with tokens validated locally against the authorization server's JWKS.

**Architecture:** The HTTP branch of `mcp-server/index.ts` moves onto the SDK's `createMcpExpressApp()`, which binds `127.0.0.1` and applies DNS-rebinding protection by default. The SDK's `metadataHandler` serves the RFC 9728 document at the path `getOAuthProtectedResourceMetadataUrl()` computes. `requireBearerAuth` guards `/mcp` ahead of session allocation, backed by a verifier that validates the JWT locally with `jose` against the AS's JWKS — asserting issuer, **audience**, expiry and scope. Sessions register through `onsessioninitialized` and carry their authenticated principal. Stdio is untouched.

**Tech Stack:** TypeScript (ESM, NodeNext), `@modelcontextprotocol/sdk@1.25.2`, Express 5.2.1, `jose` 6.x, Vitest (a new node-environment config inside `mcp-server`), `supertest`.

**Spec:** `docs/superpowers/specs/2026-07-27-choreo-mcp-act-surface-design.md` → Phase 1.
**Audit that produced this revision:** `docs/superpowers/specs/2026-07-27-mcp-auth-plan-audit.md`.
**Working directory:** primary checkout on `main`. Per `.claude/rules/worktree-workflow.md`, do **not** create a branch or worktree.

---

## What changed from v1, and why

v1 was audited adversarially and failed on 15 findings, 2 of them critical. This version exists because of them. The corrections that shape it:

| v1 defect | v2 |
|---|---|
| Verifier accepted any "active" token — **no audience check**. A token minted by the same AS for another API authorized every MCP tool. | JWT validated locally with explicit `audience` and `issuer`. Task 3. |
| Deploying it would have **taken the live service down** — unprovisioned env + fail-closed config = NSSM restart loop, and the new app deleted `GET /`, which `install-service.ps1:64` health-checks. | `GET /` preserved; env provisioned in `run-mcp-http.cmd` before restart. Task 7. |
| The regression test lived in `tests/integration/`, which `tests/config/vitest.config.ts:44` **excludes outright**. It would never have run. | Tests live in `mcp-server/tests/` with their own vitest config. Task 1, done first. |
| Hand-rolled the Express app, the metadata document, and the metadata URL. | `createMcpExpressApp`, `metadataHandler`, `getOAuthProtectedResourceMetadataUrl`. Tasks 4. |
| Metadata served at the bare well-known path, dropping `/mcp`. | SDK helper computes `/.well-known/oauth-protected-resource/mcp`. Task 4. |
| Verifier threw plain `Error` → the middleware maps that to **500, not 401**. | `InvalidTokenError`. Task 3. |
| Session `Map` with no eviction; DELETE re-inserted the closed transport; sessions bound to no principal. | `onsessioninitialized` registration, principal binding, idle eviction. Task 4. |
| RFC 7662 introspection, hardcoded and unauthenticated, before a vendor existed. | JWKS validation — vendor-neutral, no per-request outbound call, no introspection credentials. |

**Every SDK signature used below was read from the installed package**, not recalled. That distinction is what separated v1's correct parts from its defective ones.

---

## Context an engineer needs

**The server.** `mcp-server/` exposes flow-arts domain knowledge over MCP. `main()` in `mcp-server/index.ts` runs two transports:

- **stdio** (≈70–73) — a local pipe. **Not touched by this plan.** Note: `.mcp.json` points Claude Code at the *other* server, `mcp-server-pkg/`, which is stdio-only and entirely out of scope.
- **HTTP** (≈76–142) — active only when `MCP_HTTP_PORT` is set. `deploy/run-mcp-http.cmd` sets it to 3333 and NSSM runs it as `FlowArtsKnowledgeMCP`, reached by claude.ai through a Cloudflare tunnel.

**The bug.** The HTTP branch has no authorization. Any POST to `/mcp` without a session id builds a fresh `McpServer` and a session. It also sends `Access-Control-Allow-Origin: *`.

**Why now.** Later phases put Firebase Admin credentials in this process to reach acts under `users/{uid}`. An open endpoint holding admin credentials is a path into the whole database.

**Roles.** *AS* = authorization server (issues tokens; a managed vendor). *RS* = this server (validates them). We are building an RS. Per the MCP spec (2025-11-25, `basic/authorization`) the AS is explicitly out of scope.

**Why JWKS and not introspection.** RFC 7662 introspection requires authenticating to the AS on every request, which needs vendor-specific credentials and turns each invalid token into an outbound call. JWKS validation is local: fetch the AS's public keys once, cache them, verify signatures in-process. Vendor-neutral, and unauthenticated traffic costs nothing.

**Critical detail:** `requireBearerAuth` validates **scopes and expiry only**. It does *not* compare `AuthInfo.resource` to anything. Audience enforcement is entirely the verifier's job — verified by reading `bearerAuth.js`. Getting this wrong is what made v1's first critical.

---

## File Structure

| File | Responsibility |
|---|---|
| `mcp-server/vitest.config.ts` | **Create.** Node-environment test config scoped to `mcp-server/tests/`. |
| `mcp-server/src/http/auth-config.ts` | **Create.** Reads and validates auth env. Returns normalized `URL`s. Throws on anything partial. |
| `mcp-server/src/http/jwks-verifier.ts` | **Create.** `OAuthTokenVerifier` backed by `jose`. Validates issuer, audience, expiry, scopes. |
| `mcp-server/src/http/create-http-app.ts` | **Create.** Builds the app from SDK primitives; owns session lifecycle. |
| `mcp-server/index.ts` | **Modify.** HTTP branch delegates here. Stdio untouched. |
| `mcp-server/deploy/run-mcp-http.cmd` | **Modify.** Provision the new env vars. |
| `mcp-server/tests/auth-config.test.ts` | **Create.** Config validation. |
| `mcp-server/tests/jwks-verifier.test.ts` | **Create.** Audience/issuer/expiry/scope rejection — the critical-1 guard. |
| `mcp-server/tests/http-auth.test.ts` | **Create.** The regression guard, in a directory that actually runs. |

---

## Task 1: Test infrastructure that actually runs

Do this first. In v1 every later test was written into a directory the runner excludes, so the whole suite was theatre. Nothing else in this plan is trustworthy until this task is done.

**Files:**
- Create: `mcp-server/vitest.config.ts`
- Modify: `mcp-server/package.json`

- [ ] **Step 1: Install dependencies**

```bash
cd mcp-server && npm install express@^5.2.1 jose@^6.1.3 && npm install -D vitest@^4.0.18 supertest@^7.1.1 @types/express@^5.0.0 @types/supertest@^6.0.2
```

- [ ] **Step 2: Create the test config**

Create `mcp-server/vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";

// The root config (tests/config/vitest.config.ts) is jsdom-based and excludes
// tests/integration/** outright. This server is Node-only and lives outside the
// pnpm workspace, so it owns its own runner.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 15_000,
  },
});
```

- [ ] **Step 3: Add the test script**

In `mcp-server/package.json` `"scripts"`, add:

```json
"test": "vitest run",
"typecheck": "tsc --noEmit"
```

Do **not** add a `--testNamePattern` filter. v1 used one and it silently excluded every suite it was meant to select.

- [ ] **Step 4: Prove the runner works**

Create `mcp-server/tests/smoke.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

describe("test infrastructure", () => {
  it("runs tests in this package", () => {
    expect(true).toBe(true);
  });
});
```

Run: `cd mcp-server && npm test`
Expected: 1 file, 1 test, passing. If this does not run, stop — everything downstream depends on it.

- [ ] **Step 5: Commit**

```bash
git add mcp-server/package.json mcp-server/package-lock.json mcp-server/vitest.config.ts mcp-server/tests/smoke.test.ts
git commit -m "test(mcp): give the server a test runner that actually executes" -- mcp-server/package.json mcp-server/package-lock.json mcp-server/vitest.config.ts mcp-server/tests/smoke.test.ts
```

---

## Task 2: Auth configuration

Fails closed, and returns normalized `URL`s so downstream code cannot disagree about what the resource is.

**Files:**
- Create: `mcp-server/src/http/auth-config.ts`
- Test: `mcp-server/tests/auth-config.test.ts`

- [ ] **Step 1: Write the failing test**

Create `mcp-server/tests/auth-config.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { resolveAuthConfig, resolveHttpPort } from "../src/http/auth-config.js";

const valid = {
  MCP_AUTH_ISSUER: "https://as.example.com",
  MCP_AUTH_RESOURCE_URL: "https://mcp.example.com/mcp",
  MCP_AUTH_JWKS_URI: "https://as.example.com/.well-known/jwks.json",
};

describe("resolveAuthConfig", () => {
  it("returns normalized URLs for a complete config", () => {
    const c = resolveAuthConfig(valid);
    expect(c.issuer.href).toBe("https://as.example.com/");
    expect(c.resourceUrl.href).toBe("https://mcp.example.com/mcp");
    expect(c.jwksUri.href).toBe("https://as.example.com/.well-known/jwks.json");
  });

  it.each(["MCP_AUTH_ISSUER", "MCP_AUTH_RESOURCE_URL", "MCP_AUTH_JWKS_URI"])(
    "throws when %s is missing",
    (missing) => {
      const env: Record<string, string | undefined> = { ...valid };
      delete env[missing];
      expect(() => resolveAuthConfig(env)).toThrow(new RegExp(missing));
    },
  );

  it("throws on entirely absent config rather than defaulting", () => {
    expect(() => resolveAuthConfig({})).toThrow();
  });

  it("rejects a non-HTTPS issuer off localhost", () => {
    expect(() => resolveAuthConfig({ ...valid, MCP_AUTH_ISSUER: "http://as.example.com" })).toThrow(/https/i);
  });

  it("allows http on loopback for local development", () => {
    expect(resolveAuthConfig({ ...valid, MCP_AUTH_ISSUER: "http://localhost:8080" }).issuer.href)
      .toBe("http://localhost:8080/");
  });

  it("rejects a non-http scheme even on loopback", () => {
    // v1 let ftp://localhost through while claiming only http was allowed.
    expect(() => resolveAuthConfig({ ...valid, MCP_AUTH_ISSUER: "ftp://localhost" })).toThrow();
  });

  it("rejects credentials embedded in a URL", () => {
    expect(() => resolveAuthConfig({ ...valid, MCP_AUTH_ISSUER: "https://user:pw@as.example.com" })).toThrow(/credential/i);
  });

  it("rejects a URL with a fragment", () => {
    expect(() => resolveAuthConfig({ ...valid, MCP_AUTH_RESOURCE_URL: "https://mcp.example.com/mcp#x" })).toThrow(/fragment/i);
  });

  it("rejects a non-URL", () => {
    expect(() => resolveAuthConfig({ ...valid, MCP_AUTH_ISSUER: "not-a-url" })).toThrow();
  });
});

describe("resolveHttpPort", () => {
  it("treats unset as disabled", () => {
    expect(resolveHttpPort(undefined)).toBe(0);
  });

  it("treats 0 as disabled", () => {
    expect(resolveHttpPort("0")).toBe(0);
  });

  it("parses a valid port", () => {
    expect(resolveHttpPort("3333")).toBe(3333);
  });

  it("throws on a malformed port instead of silently disabling HTTP", () => {
    // v1 used parseInt, so "abc" became NaN and NaN > 0 quietly skipped the
    // whole HTTP branch — a typo would disable the server with no error.
    expect(() => resolveHttpPort("abc")).toThrow();
    expect(() => resolveHttpPort("99999")).toThrow();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mcp-server && npm test -- auth-config`
Expected: FAIL — cannot resolve `../src/http/auth-config.js`

- [ ] **Step 3: Implement**

Create `mcp-server/src/http/auth-config.ts`:

```typescript
/**
 * Authorization configuration for the HTTP transport.
 *
 * There is deliberately NO unauthenticated fallback. If HTTP is enabled and this
 * cannot be resolved, the process refuses to start. A fallback would reopen the
 * endpoint the first time a deployment lost an env var.
 */

export type AuthConfig = {
  issuer: URL;
  resourceUrl: URL;
  jwksUri: URL;
};

type Env = Record<string, string | undefined>;

function parseUrl(raw: string, name: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`[MCP] ${name} must be an absolute URL, got: ${raw}`);
  }

  const isLoopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback)) {
    throw new Error(`[MCP] ${name} must use https (http permitted only on loopback), got: ${raw}`);
  }
  if (url.username || url.password) {
    throw new Error(`[MCP] ${name} must not embed credentials`);
  }
  if (url.hash) {
    throw new Error(`[MCP] ${name} must not contain a fragment`);
  }
  return url;
}

function required(env: Env, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(
      `[MCP] ${name} is required when MCP_HTTP_PORT is set. Refusing to start an unauthenticated HTTP transport.`,
    );
  }
  return value;
}

export function resolveAuthConfig(env: Env): AuthConfig {
  return {
    issuer: parseUrl(required(env, "MCP_AUTH_ISSUER"), "MCP_AUTH_ISSUER"),
    resourceUrl: parseUrl(required(env, "MCP_AUTH_RESOURCE_URL"), "MCP_AUTH_RESOURCE_URL"),
    jwksUri: parseUrl(required(env, "MCP_AUTH_JWKS_URI"), "MCP_AUTH_JWKS_URI"),
  };
}

/** 0 means "HTTP disabled". A malformed value is an error, never a silent disable. */
export function resolveHttpPort(raw: string | undefined): number {
  const value = raw?.trim();
  if (!value) return 0;
  if (!/^\d+$/.test(value)) {
    throw new Error(`[MCP] MCP_HTTP_PORT must be an integer, got: ${value}`);
  }
  const port = Number(value);
  if (port !== 0 && (port < 1 || port > 65535)) {
    throw new Error(`[MCP] MCP_HTTP_PORT must be 0 or 1-65535, got: ${value}`);
  }
  return port;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd mcp-server && npm test -- auth-config`
Expected: PASS, 16 tests.

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/http/auth-config.ts mcp-server/tests/auth-config.test.ts
git commit -m "feat(mcp): validate auth config strictly, refusing partial setups" -- mcp-server/src/http/auth-config.ts mcp-server/tests/auth-config.test.ts
```

---

## Task 3: The JWKS verifier — audience enforcement

This task fixes the audit's first critical. `requireBearerAuth` does **not** check audience; if this verifier does not, nothing does, and any token from the same AS opens every tool.

Errors must be `InvalidTokenError`. The middleware maps only that to 401 — a plain `Error` becomes a 500 with no challenge.

**Files:**
- Create: `mcp-server/src/http/jwks-verifier.ts`
- Test: `mcp-server/tests/jwks-verifier.test.ts`

- [ ] **Step 1: Write the failing test**

Create `mcp-server/tests/jwks-verifier.test.ts`:

```typescript
import { describe, expect, it, beforeAll } from "vitest";
import { SignJWT, exportJWK, generateKeyPair, type JWK } from "jose";
import { InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";

import { createJwksVerifier } from "../src/http/jwks-verifier.js";

const ISSUER = "https://as.example.com";
const AUDIENCE = "https://mcp.example.com/mcp";

let privateKey: CryptoKey;
let publicJwk: JWK;

// Local key set — no network. createJwksVerifier accepts an injected key
// resolver so the unit tests never reach out.
beforeAll(async () => {
  const pair = await generateKeyPair("RS256", { extractable: true });
  privateKey = pair.privateKey;
  publicJwk = await exportJWK(pair.publicKey);
  publicJwk.alg = "RS256";
});

async function mint(overrides: {
  aud?: string;
  iss?: string;
  exp?: string | number;
  scope?: string;
  sub?: string;
} = {}) {
  return new SignJWT({ scope: overrides.scope ?? "mcp:use" })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(overrides.iss ?? ISSUER)
    .setAudience(overrides.aud ?? AUDIENCE)
    .setSubject(overrides.sub ?? "user-123")
    .setIssuedAt()
    .setExpirationTime(overrides.exp ?? "5m")
    .sign(privateKey);
}

function verifier() {
  return createJwksVerifier({
    issuer: new URL(ISSUER),
    audience: new URL(AUDIENCE),
    keyResolver: async () => publicJwk,
  });
}

describe("createJwksVerifier", () => {
  it("accepts a correctly-audienced token and reports its principal", async () => {
    const info = await verifier().verifyAccessToken(await mint());
    expect(info.clientId).toBe("user-123");
    expect(info.scopes).toContain("mcp:use");
    expect(info.resource?.href).toBe(AUDIENCE);
    expect(info.extra?.sub).toBe("user-123");
  });

  it("REJECTS a token minted for a different audience", async () => {
    // The audit's first critical. A token the same AS issued for another API
    // must not open this one.
    await expect(verifier().verifyAccessToken(await mint({ aud: "https://other-api.example.com" })))
      .rejects.toThrow(InvalidTokenError);
  });

  it("rejects a token from a different issuer", async () => {
    await expect(verifier().verifyAccessToken(await mint({ iss: "https://evil.example.com" })))
      .rejects.toThrow(InvalidTokenError);
  });

  it("rejects an expired token", async () => {
    await expect(verifier().verifyAccessToken(await mint({ exp: Math.floor(Date.now() / 1000) - 60 })))
      .rejects.toThrow(InvalidTokenError);
  });

  it("rejects a structurally invalid token", async () => {
    await expect(verifier().verifyAccessToken("not.a.jwt")).rejects.toThrow(InvalidTokenError);
  });

  it("rejects a token signed by the wrong key", async () => {
    const other = await generateKeyPair("RS256", { extractable: true });
    const forged = await new SignJWT({ scope: "mcp:use" })
      .setProtectedHeader({ alg: "RS256" })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setSubject("attacker")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(other.privateKey);
    await expect(verifier().verifyAccessToken(forged)).rejects.toThrow(InvalidTokenError);
  });

  it("throws InvalidTokenError, not a plain Error", async () => {
    // The middleware maps only InvalidTokenError to 401. A plain Error becomes
    // a 500 with no WWW-Authenticate challenge.
    await expect(verifier().verifyAccessToken("garbage")).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it("returns an empty scope list when the token carries no scope claim", async () => {
    const info = await verifier().verifyAccessToken(await mint({ scope: "" }));
    expect(info.scopes).toEqual([]);
  });

  it("surfaces expiry so the middleware can enforce it", async () => {
    const info = await verifier().verifyAccessToken(await mint());
    expect(typeof info.expiresAt).toBe("number");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mcp-server && npm test -- jwks-verifier`
Expected: FAIL — cannot resolve `jwks-verifier.js`

- [ ] **Step 3: Implement**

Create `mcp-server/src/http/jwks-verifier.ts`:

```typescript
/**
 * Local JWT validation against the authorization server's JWKS.
 *
 * Chosen over RFC 7662 introspection because introspection needs authenticated,
 * vendor-specific credentials and turns every invalid token into an outbound
 * request. Verification here is in-process; `jose` caches the key set.
 *
 * IMPORTANT: `requireBearerAuth` checks scopes and expiry but does NOT compare
 * AuthInfo.resource to anything. Audience enforcement happens HERE or nowhere.
 */

import { createRemoteJWKSet, jwtVerify, type JWK, type JWTPayload } from "jose";
import { InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import type { OAuthTokenVerifier } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

export type JwksVerifierOptions = {
  issuer: URL;
  /** The canonical resource identifier this server accepts tokens for. */
  audience: URL;
  jwksUri?: URL;
  /** Test seam: supply a key directly instead of fetching a remote key set. */
  keyResolver?: () => Promise<JWK>;
};

function scopesOf(payload: JWTPayload): string[] {
  const raw = payload.scope;
  if (typeof raw !== "string" || raw.trim() === "") return [];
  return raw.split(" ").filter(Boolean);
}

export function createJwksVerifier(options: JwksVerifierOptions): OAuthTokenVerifier {
  const { issuer, audience, jwksUri, keyResolver } = options;

  if (!keyResolver && !jwksUri) {
    throw new Error("[MCP] createJwksVerifier requires either jwksUri or keyResolver");
  }

  // createRemoteJWKSet caches and refreshes on unknown kid, so this is one
  // fetch amortised across every request rather than a per-request call.
  const remoteKeySet = jwksUri ? createRemoteJWKSet(jwksUri) : undefined;

  return {
    async verifyAccessToken(token: string): Promise<AuthInfo> {
      try {
        const key = keyResolver ? await keyResolver() : remoteKeySet!;
        const { payload } = await jwtVerify(token, key as never, {
          issuer: issuer.href.replace(/\/$/, ""),
          audience: audience.href,
          clockTolerance: 5,
        });

        if (typeof payload.exp !== "number") {
          throw new InvalidTokenError("Token has no expiration time");
        }
        const sub = typeof payload.sub === "string" ? payload.sub : undefined;
        if (!sub) {
          throw new InvalidTokenError("Token has no subject");
        }

        return {
          token,
          clientId: sub,
          scopes: scopesOf(payload),
          expiresAt: payload.exp,
          resource: audience,
          extra: { sub, iss: payload.iss, clientId: payload.client_id },
        };
      } catch (error) {
        if (error instanceof InvalidTokenError) throw error;
        // Every jose failure — bad signature, wrong audience, wrong issuer,
        // expired, malformed — becomes a 401 with a challenge. A plain Error
        // would surface as a 500 instead.
        const reason = error instanceof Error ? error.message : "token verification failed";
        throw new InvalidTokenError(reason);
      }
    },
  };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd mcp-server && npm test -- jwks-verifier`
Expected: PASS, 9 tests. The audience-rejection test is the one that matters; if it passes for the wrong reason (e.g. every token rejected), the acceptance test above catches that.

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/http/jwks-verifier.ts mcp-server/tests/jwks-verifier.test.ts
git commit -m "feat(mcp): validate tokens against JWKS, enforcing audience" -- mcp-server/src/http/jwks-verifier.ts mcp-server/tests/jwks-verifier.test.ts
```

---

## Task 4: The HTTP app, built from SDK primitives

**Files:**
- Create: `mcp-server/src/http/create-http-app.ts`

- [ ] **Step 1: Implement**

Create `mcp-server/src/http/create-http-app.ts`:

```typescript
/**
 * The HTTP surface.
 *
 * Built on the SDK's own primitives rather than a hand-rolled Express app:
 * createMcpExpressApp binds loopback and applies DNS-rebinding protection,
 * metadataHandler serves the RFC 9728 document, and
 * getOAuthProtectedResourceMetadataUrl computes the path clients actually look
 * at (which includes the resource path — a bare well-known path 404s).
 *
 * Route order is load-bearing:
 *   1. GET /                     — health, public (install-service.ps1 probes it)
 *   2. metadata                  — public; clients read it before holding a token
 *   3. requireBearerAuth on /mcp — BEFORE any session is allocated
 *   4. session handling
 */

import { randomUUID } from "node:crypto";
import type { Express, Request } from "express";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { metadataHandler } from "@modelcontextprotocol/sdk/server/auth/handlers/metadata.js";
import { getOAuthProtectedResourceMetadataUrl } from "@modelcontextprotocol/sdk/server/auth/router.js";
import type { OAuthTokenVerifier } from "@modelcontextprotocol/sdk/server/auth/provider.js";

import type { AuthConfig } from "./auth-config.js";

/** Sessions idle longer than this are closed and evicted. */
export const SESSION_IDLE_MS = 30 * 60 * 1000;

type SessionRecord = {
  transport: StreamableHTTPServerTransport;
  /** Subject this session was opened by. Another principal may not reuse it. */
  principal: string;
  lastSeen: number;
};

export type CreateHttpAppOptions = {
  config: AuthConfig;
  verifier: OAuthTokenVerifier;
  createMcpServer: () => McpServer;
  allowedHosts?: string[];
  /** Test seam: observe construction without a real transport. */
  onServerConstructed?: () => void;
};

export function createHttpApp({
  config,
  verifier,
  createMcpServer,
  allowedHosts,
  onServerConstructed,
}: CreateHttpAppOptions): Express {
  // Defaults to host 127.0.0.1 with DNS-rebinding protection. allowedHosts is
  // needed because the service sits behind a Cloudflare tunnel, so the Host
  // header arrives as the public name.
  const app = createMcpExpressApp(allowedHosts ? { allowedHosts } : {});
  const sessions = new Map<string, SessionRecord>();

  function evictIdle(now: number): void {
    for (const [id, record] of sessions) {
      if (now - record.lastSeen > SESSION_IDLE_MS) {
        sessions.delete(id);
        void record.transport.close();
      }
    }
  }

  // (1) Health. install-service.ps1 probes this and throws if it does not answer;
  // deleting it turns a deploy into a failed install.
  app.get("/", (_req, res) => {
    res.status(200).type("text/plain").send("Flow Arts Knowledge MCP Server");
  });

  // (2) Public discovery, at the canonical RFC 9728 path.
  const metadataUrl = getOAuthProtectedResourceMetadataUrl(config.resourceUrl);
  const metadataPath = new URL(metadataUrl).pathname;
  const serveMetadata = metadataHandler({
    resource: config.resourceUrl.href,
    authorization_servers: [config.issuer.href],
    bearer_methods_supported: ["header"],
  });
  app.get(metadataPath, serveMetadata);
  // Root alias: some clients probe the bare path before the path-specific one.
  if (metadataPath !== "/.well-known/oauth-protected-resource") {
    app.get("/.well-known/oauth-protected-resource", serveMetadata);
  }

  // (3) Auth, ahead of anything that allocates.
  app.all("/mcp", requireBearerAuth({ verifier, resourceMetadataUrl: metadataUrl }), async (req, res) => {
    const auth = (req as Request & { auth?: { clientId: string } }).auth;
    const principal = auth?.clientId ?? "";
    const now = Date.now();
    evictIdle(now);

    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId) {
      const record = sessions.get(sessionId);
      if (!record) {
        res.status(404).json({ error: "Session not found" });
        return;
      }
      // A session belongs to the principal that opened it. Without this, anyone
      // holding a valid token for this resource could drive someone else's
      // stateful server — which becomes a data boundary in Phase 2.
      if (record.principal !== principal) {
        res.status(403).json({ error: "Session belongs to a different principal" });
        return;
      }
      record.lastSeen = now;
      await record.transport.handleRequest(req, res, req.body);
      return;
    }

    if (req.method !== "POST") {
      res.status(400).json({ error: "Bad request — missing session" });
      return;
    }

    // (4) New session. Registration happens in onsessioninitialized, not after
    // handleRequest: registering afterwards races initialization and re-inserts
    // transports that DELETE just closed.
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id: string) => {
        sessions.set(id, { transport, principal, lastSeen: Date.now() });
      },
    });
    transport.onclose = () => {
      if (transport.sessionId) sessions.delete(transport.sessionId);
    };

    onServerConstructed?.();
    await createMcpServer().connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  return app;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd mcp-server && npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add mcp-server/src/http/create-http-app.ts
git commit -m "feat(mcp): build the HTTP app on the SDK's own primitives" -- mcp-server/src/http/create-http-app.ts
```

---

## Task 5: The regression guard

v1's tests asserted on mocks and on absent headers. These assert on observable behaviour: whether a server was constructed at all, and whether the status is the one the OAuth spec requires.

**Files:**
- Create: `mcp-server/tests/http-auth.test.ts`

- [ ] **Step 1: Write the test**

Create `mcp-server/tests/http-auth.test.ts`:

```typescript
import { describe, expect, it, beforeEach } from "vitest";
import request from "supertest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

import { createHttpApp } from "../src/http/create-http-app.js";

const config = {
  issuer: new URL("https://as.example.com"),
  resourceUrl: new URL("https://mcp.example.com/mcp"),
  jwksUri: new URL("https://as.example.com/.well-known/jwks.json"),
};

const VALID = "valid-token";
const OTHER_PRINCIPAL = "other-token";

let constructed = 0;

const verifier = {
  async verifyAccessToken(token: string): Promise<AuthInfo> {
    if (token === VALID || token === OTHER_PRINCIPAL) {
      return {
        token,
        clientId: token === VALID ? "user-a" : "user-b",
        scopes: ["mcp:use"],
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
        resource: config.resourceUrl,
      };
    }
    throw new InvalidTokenError("invalid token");
  },
};

function buildApp() {
  return createHttpApp({
    config,
    verifier,
    createMcpServer: () => new McpServer({ name: "test", version: "0.0.0" }),
    allowedHosts: ["127.0.0.1", "localhost"],
    onServerConstructed: () => {
      constructed++;
    },
  });
}

const INITIALIZE = {
  jsonrpc: "2.0" as const,
  method: "initialize",
  id: 1,
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "test", version: "0.0.0" },
  },
};

describe("MCP HTTP authorization", () => {
  beforeEach(() => {
    constructed = 0;
  });

  it("answers the health probe install-service.ps1 depends on", async () => {
    const res = await request(buildApp()).get("/");
    expect(res.status).toBe(200);
  });

  it("serves metadata at the RFC 9728 path including the resource path", async () => {
    const res = await request(buildApp()).get("/.well-known/oauth-protected-resource/mcp");
    expect(res.status).toBe(200);
    expect(res.body.authorization_servers).toEqual([config.issuer.href]);
    expect(res.body.resource).toBe(config.resourceUrl.href);
  });

  it("also answers the bare well-known path for clients that probe it", async () => {
    expect((await request(buildApp()).get("/.well-known/oauth-protected-resource")).status).toBe(200);
  });

  it("rejects a POST with no Authorization header", async () => {
    const res = await request(buildApp()).post("/mcp").send(INITIALIZE);
    expect(res.status).toBe(401);
  });

  it("CONSTRUCTS NOTHING for an unauthenticated caller", async () => {
    // The real invariant. v1 only checked for an absent response header, which
    // would have passed even if a server had been built and then rejected.
    await request(buildApp()).post("/mcp").send(INITIALIZE);
    expect(constructed).toBe(0);
  });

  it("returns 401 — not 500 — for a bad token", async () => {
    // Only InvalidTokenError maps to 401. A plain Error becomes a 500 with no
    // challenge, which is what v1's verifier would have produced.
    const res = await request(buildApp()).post("/mcp").set("Authorization", "Bearer nope").send(INITIALIZE);
    expect(res.status).toBe(401);
  });

  it("challenges with the metadata URL so a client can discover the AS", async () => {
    const res = await request(buildApp()).post("/mcp").send(INITIALIZE);
    expect(res.headers["www-authenticate"]).toContain(
      "https://mcp.example.com/.well-known/oauth-protected-resource/mcp",
    );
  });

  it("lets a valid token through and constructs exactly one server", async () => {
    const res = await request(buildApp())
      .post("/mcp")
      .set("Authorization", `Bearer ${VALID}`)
      .set("Accept", "application/json, text/event-stream")
      .send(INITIALIZE);
    expect(res.status).toBeLessThan(400);
    expect(constructed).toBe(1);
  });

  it("refuses a session id belonging to a different principal", async () => {
    const app = buildApp();
    const first = await request(app)
      .post("/mcp")
      .set("Authorization", `Bearer ${VALID}`)
      .set("Accept", "application/json, text/event-stream")
      .send(INITIALIZE);

    const sessionId = first.headers["mcp-session-id"];
    expect(sessionId).toBeTruthy();

    const res = await request(app)
      .post("/mcp")
      .set("Authorization", `Bearer ${OTHER_PRINCIPAL}`)
      .set("mcp-session-id", sessionId)
      .set("Accept", "application/json, text/event-stream")
      .send({ jsonrpc: "2.0", method: "ping", id: 2 });

    expect(res.status).toBe(403);
  });

  it("404s an unknown session rather than opening a new one", async () => {
    const res = await request(buildApp())
      .post("/mcp")
      .set("Authorization", `Bearer ${VALID}`)
      .set("mcp-session-id", "does-not-exist")
      .send({ jsonrpc: "2.0", method: "ping", id: 2 });
    expect(res.status).toBe(404);
    expect(constructed).toBe(0);
  });
});
```

- [ ] **Step 2: Run**

Run: `cd mcp-server && npm test -- http-auth`
Expected: PASS, 11 tests. If the `www-authenticate` assertion fails, confirm `resourceMetadataUrl` reaches `requireBearerAuth` — the SDK emits that header only when it is supplied.

- [ ] **Step 3: Commit**

```bash
git add mcp-server/tests/http-auth.test.ts
git commit -m "test(mcp): prove /mcp rejects and allocates nothing without a token" -- mcp-server/tests/http-auth.test.ts
```

---

## Task 6: Wire it into the entrypoint

**Files:**
- Modify: `mcp-server/index.ts`

- [ ] **Step 1: Replace the HTTP branch**

Replace the whole `if (HTTP_PORT > 0) { ... }` block and the `HTTP_PORT` constant (line 38):

```typescript
const HTTP_PORT = resolveHttpPort(process.env.MCP_HTTP_PORT);
```

```typescript
  // HTTP transport (for Claude.ai via remote MCP). Authorization is mandatory —
  // see docs/superpowers/specs/2026-07-27-choreo-mcp-act-surface-design.md.
  if (HTTP_PORT > 0) {
    const authConfig = resolveAuthConfig(process.env);
    const allowedHosts = (process.env.MCP_ALLOWED_HOSTS ?? "")
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean);

    const app = createHttpApp({
      config: authConfig,
      verifier: createJwksVerifier({
        issuer: authConfig.issuer,
        audience: authConfig.resourceUrl,
        jwksUri: authConfig.jwksUri,
      }),
      createMcpServer,
      allowedHosts: allowedHosts.length > 0 ? allowedHosts : undefined,
    });

    app.listen(HTTP_PORT, "127.0.0.1", () => {
      console.error(`[MCP-HTTP] Listening on 127.0.0.1:${HTTP_PORT} (authorization required)`);
    });
  }
```

Add the imports, and remove the now-unused `createServer` and `StreamableHTTPServerTransport` imports:

```typescript
import { resolveAuthConfig, resolveHttpPort } from "./src/http/auth-config.js";
import { createHttpApp } from "./src/http/create-http-app.js";
import { createJwksVerifier } from "./src/http/jwks-verifier.js";
```

- [ ] **Step 2: Typecheck**

Run: `cd mcp-server && npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Verify stdio is unaffected**

```powershell
cd mcp-server
$env:MCP_HTTP_PORT = ""
'{"jsonrpc":"2.0","method":"tools/list","id":1}' | npx tsx index.ts
```

Expected: a JSON-RPC response listing tools, no auth involved. Stdio must keep working — it is a local pipe and authenticating it would break the local workflow for no gain.

- [ ] **Step 4: Verify it refuses to start unconfigured**

```powershell
cd mcp-server
$env:MCP_HTTP_PORT = "3399"
$env:MCP_AUTH_ISSUER = ""
npx tsx index.ts
```

Expected: throws `MCP_AUTH_ISSUER is required when MCP_HTTP_PORT is set`. A server that starts here is the bug this phase exists to prevent. Use 3399, **not 3333** — 3333 is the live service and binding it either fails or leaves you testing the old process.

- [ ] **Step 5: Commit**

```bash
git add mcp-server/index.ts
git commit -m "feat(mcp): require authorization on the HTTP transport" -- mcp-server/index.ts
```

---

## Task 7: Deployment, without taking the service down

The service is live and `Automatic`. Shipping the code without this task causes an outage: `resolveAuthConfig` throws, NSSM restarts every few seconds, and `install-service.ps1` fails its probe.

**Files:**
- Modify: `mcp-server/deploy/run-mcp-http.cmd`
- Modify: `mcp-server/deploy/README.md`

- [ ] **Step 1: Provision the environment in the launcher**

`run-mcp-http.cmd` already sets `MCP_HTTP_PORT` inline, so it is the natural place for the rest — it is version-controlled, unlike NSSM's registry `AppEnvironment`. Replace its body with:

```bat
@echo off
REM Launcher for the Flow Arts Knowledge MCP server in HTTP mode.
REM Invoked by NSSM as a Windows service. Do not run directly.

set MCP_HTTP_PORT=3333

REM Authorization is mandatory when HTTP is enabled; the server refuses to
REM start without these. Replace the placeholders with the real authorization
REM server before installing.
set MCP_AUTH_ISSUER=https://REPLACE-ME.example.com
set MCP_AUTH_RESOURCE_URL=https://REPLACE-ME-tunnel-host/mcp
set MCP_AUTH_JWKS_URI=https://REPLACE-ME.example.com/.well-known/jwks.json

REM Host header allowlist — the tunnel presents the public hostname, and the
REM installer probes localhost.
set MCP_ALLOWED_HOSTS=REPLACE-ME-tunnel-host,localhost,127.0.0.1

cd /d "E:\tka-platform\mcp-server"
"C:\Program Files\nodejs\npx.cmd" --no-install tsx index.ts
```

- [ ] **Step 2: Document the contract**

Add to `mcp-server/deploy/README.md`:

```markdown
## Authorization (required for HTTP mode)

When `MCP_HTTP_PORT` is set, all of these are required and the server refuses to
start without them:

| Variable | Meaning |
|---|---|
| `MCP_AUTH_ISSUER` | Authorization server base URL. https, except on loopback. |
| `MCP_AUTH_RESOURCE_URL` | This server's canonical public `/mcp` URL. Tokens must carry it as their audience. |
| `MCP_AUTH_JWKS_URI` | The AS's JWKS endpoint. Keys are fetched once and cached. |
| `MCP_ALLOWED_HOSTS` | Comma-separated Host header allowlist. Include the tunnel hostname and localhost. |

There is no unauthenticated HTTP mode. Refusing to start is deliberate — a silent
downgrade would reopen the endpoint.

**Before installing or restarting:** fill in the placeholders in
`run-mcp-http.cmd`. Leaving them will restart-loop the service.

The **stdio** transport needs none of this. It is a local pipe.
```

- [ ] **Step 3: Commit**

```bash
git add mcp-server/deploy/run-mcp-http.cmd mcp-server/deploy/README.md
git commit -m "chore(mcp): provision auth env before the service needs it" -- mcp-server/deploy/run-mcp-http.cmd mcp-server/deploy/README.md
```

---

## Task 8: Full verification

- [ ] **Step 1: Run the server's whole suite**

Run: `cd mcp-server && npm test`
Expected: 4 files, 37 tests, all passing.

- [ ] **Step 2: Typecheck**

Run: `cd mcp-server && npm run typecheck`
Expected: no errors. (Root `svelte-check` does **not** cover `mcp-server` — its tsconfig includes only root `src/**` — so it is not the gate here.)

- [ ] **Step 3: End-to-end against a real key set, on a free port**

This exercises the path the unit tests stub: a genuine JWT verified against a served JWKS.

Create `mcp-server/tests/manual/e2e-check.md` documenting this, and run it once by hand:

1. Start a throwaway JWKS server and mint a token with `jose` (issuer/audience matching the env below).
2. Start the MCP server on **3399**, never 3333.
3. `curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:3399/mcp -d '{}'` → **401**
4. `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3399/.well-known/oauth-protected-resource/mcp` → **200**
5. `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3399/` → **200** (the installer's probe)
6. The same POST with `Authorization: Bearer <token>` → **not 401**
7. A token minted for a different audience → **401**

Step 7 is the one that proves the first critical is actually fixed.

Stop the server afterwards — per `.claude/rules/resource-budget.md`, reap what you spawn.

- [ ] **Step 4: Push**

```bash
git push origin main
```

---

## Self-review

**Audit coverage.** Critical 1 → Task 3 (audience, with a dedicated rejection test). Critical 2 → Task 7 plus the preserved `GET /` in Task 4. High 3 → JWKS replaces introspection entirely. High 4 → `InvalidTokenError`, tested. High 5 → Task 1, done first. High 6 → construction spy and principal-reuse tests. High 7 → `onsessioninitialized` + idle eviction. High 8 → principal on the session record. Medium 10 → SDK metadata helper. Medium 11 → `createMcpExpressApp` + explicit loopback bind. Medium 12 → strict config and port parsing. Medium 14 → port 3399 and PowerShell syntax. Low 15 → the stdio ambiguity is stated in Context.

**Partially addressed, deliberately.** High 9 (rate limiting, body caps, circuit breaker) is reduced but not eliminated: JWKS removes the outbound-AS amplification, and `createMcpExpressApp` supplies bounded JSON parsing, but there is still no rate limit on authenticated session creation. That is a hardening task for a service that is loopback-bound behind a tunnel with a single expected user — worth doing, not worth blocking Phase 1. Medium 13 (separate CORS policy for metadata) is not implemented; `createMcpExpressApp` does not set CORS at all, so browser-based discovery from an arbitrary origin will fail. Acceptable while the only client is claude.ai's server-side connector. Both are recorded here rather than silently dropped.

**Still unverified.** The AS vendor. `MCP_AUTH_JWKS_URI` is written as explicit configuration precisely so the plan does not depend on a vendor's discovery-document shape, but the exact issuer string, the claim carrying scopes, and whether the vendor issues JWTs at all (a few issue opaque tokens, which would force introspection back) must be confirmed against the vendor before Task 7 is filled in.
