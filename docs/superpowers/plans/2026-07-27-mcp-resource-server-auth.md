# MCP Resource-Server Authorization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the unauthenticated `/mcp` HTTP endpoint on the Flow Arts Knowledge MCP server by turning it into a spec-compliant OAuth 2.1 resource server that fails closed.

**Architecture:** The HTTP branch of `mcp-server/index.ts` moves from raw `node:http` onto Express, because the MCP SDK's `requireBearerAuth` is typed as an Express `RequestHandler`. Express then hosts three things: a public `/.well-known/oauth-protected-resource` discovery document (RFC 9728), the bearer-auth middleware, and the existing `StreamableHTTPServerTransport` session handling — in that order, so authorization runs *before* a session can be allocated. Token verification delegates to a managed authorization server through the SDK's `proxyProvider`; we write no token-issuing code. The stdio transport is deliberately untouched.

**Tech Stack:** TypeScript (ESM, NodeNext), `@modelcontextprotocol/sdk@1.25.2`, Express 5.2.1, Vitest (root config at `tests/config/vitest.config.ts`), `supertest` for HTTP integration tests.

**Spec:** `docs/superpowers/specs/2026-07-27-choreo-mcp-act-surface-design.md` → Phase 1.

**Working directory:** the primary checkout on `main` (`E:/tka-platform`). Per `.claude/rules/worktree-workflow.md` do **not** create a branch or worktree.

---

## Context an engineer needs before starting

**What this server is.** `mcp-server/` is a Model Context Protocol server exposing flow-arts domain knowledge and pictograph rendering to AI clients. It runs two transports from one `main()` in `mcp-server/index.ts`:

- **stdio** (≈lines 70–73) — a local pipe used by Claude Code. No network surface. **This plan does not touch it.**
- **HTTP** (≈lines 76–142) — enabled only when `MCP_HTTP_PORT` is non-zero (default `"0"`, line 38). The deployed NSSM service sets it to 3333 so claude.ai can reach it.

**The bug.** The HTTP branch has no authorization check of any kind. Any POST to `/mcp` without an `mcp-session-id` header constructs a fresh `McpServer` and a session. It also sends `Access-Control-Allow-Origin: *`.

**Why it matters now.** Later phases put Firebase Admin credentials in this process to reach acts under `users/{uid}`. An open endpoint holding admin credentials is a read/write path into the whole database. Auth has to land first.

**What "resource server" means.** Per the MCP spec (2025-11-25, `basic/authorization`), a protected MCP server is an OAuth 2.1 **resource server**: it validates access tokens and publishes metadata saying which **authorization server** issues them. It is *not* itself the authorization server — that role is explicitly out of scope of the spec. We delegate to a managed AS.

**Terminology.** *AS* = authorization server (issues tokens). *RS* = resource server (this server; validates them). *Protected Resource Metadata* = the RFC 9728 JSON document at `/.well-known/oauth-protected-resource` that tells a client which AS to go to.

**A trap worth naming.** `mcp-server-pkg/` is a *different*, stdio-only server. It has no HTTP transport and is not part of this work. Do not edit it.

---

## File Structure

| File | Responsibility |
|---|---|
| `mcp-server/src/http/auth-config.ts` | **Create.** Reads and validates auth env vars. Single place that decides whether config is complete; throws on partial config. |
| `mcp-server/src/http/protected-resource-metadata.ts` | **Create.** Builds the RFC 9728 document. Pure function, no Express. |
| `mcp-server/src/http/create-http-app.ts` | **Create.** Builds the Express app: metadata route, auth middleware, `/mcp` session handling. The whole HTTP surface, injectable for tests. |
| `mcp-server/index.ts` | **Modify.** HTTP branch delegates to `createHttpApp`. Stdio untouched. |
| `mcp-server/package.json` | **Modify.** Add `express`, `supertest`, and a `test` script. |
| `tests/unit/mcp-protected-resource-metadata.test.ts` | **Create.** Metadata document shape. |
| `tests/unit/mcp-auth-config.test.ts` | **Create.** Config validation and fail-closed behaviour. |
| `tests/integration/mcp-http-auth.test.ts` | **Create.** The regression guard: unauthenticated 401, authenticated pass-through, no session leak. |

Splitting config / metadata / app apart keeps each unit independently testable — the metadata document and the config rules get unit tests with no HTTP at all, and `create-http-app.ts` is the only piece needing a server.

---

## Task 1: Add dependencies and a test script

**Files:**
- Modify: `mcp-server/package.json`

- [ ] **Step 1: Add the runtime and dev dependencies**

Express 5.2.1 is currently present only transitively (via the SDK). It must be a declared dependency because we now import it directly.

Run from the repo root:

```bash
cd mcp-server && npm install express@^5.2.1 && npm install -D supertest@^7.1.1 @types/express@^5.0.0 @types/supertest@^6.0.2
```

- [ ] **Step 2: Add a test script**

In `mcp-server/package.json`, add to `"scripts"`:

```json
"test": "vitest run --config ../tests/config/vitest.config.ts --dir ../tests --testNamePattern mcp"
```

- [ ] **Step 3: Verify the install**

Run: `cd mcp-server && node -e "console.log(require('express/package.json').version)"`
Expected: `5.2.1` (or higher 5.x)

- [ ] **Step 4: Commit**

```bash
git add mcp-server/package.json mcp-server/package-lock.json
git commit -m "chore(mcp): declare express and add a test script" -- mcp-server/package.json mcp-server/package-lock.json
```

---

## Task 2: Auth configuration that fails closed

The single most important behaviour in this plan: partial or missing configuration must never silently disable authorization. The spec's invariant 1 exists because a missing env var in deployment is exactly how the current hole would reappear.

**Files:**
- Create: `mcp-server/src/http/auth-config.ts`
- Test: `tests/unit/mcp-auth-config.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/mcp-auth-config.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { resolveAuthConfig } from "../../mcp-server/src/http/auth-config.js";

describe("resolveAuthConfig", () => {
  const valid = {
    MCP_AUTH_ISSUER: "https://as.example.com",
    MCP_AUTH_RESOURCE_URL: "https://mcp.example.com/mcp",
  };

  it("returns a config when both issuer and resource URL are present", () => {
    const config = resolveAuthConfig(valid);
    expect(config.issuer).toBe("https://as.example.com");
    expect(config.resourceUrl).toBe("https://mcp.example.com/mcp");
  });

  it("throws when the issuer is missing entirely", () => {
    expect(() => resolveAuthConfig({ MCP_AUTH_RESOURCE_URL: valid.MCP_AUTH_RESOURCE_URL }))
      .toThrow(/MCP_AUTH_ISSUER/);
  });

  it("throws when the resource URL is missing entirely", () => {
    expect(() => resolveAuthConfig({ MCP_AUTH_ISSUER: valid.MCP_AUTH_ISSUER }))
      .toThrow(/MCP_AUTH_RESOURCE_URL/);
  });

  it("throws rather than defaulting when config is entirely absent", () => {
    // The failure mode this guards: a deployment loses its env and the server
    // comes up unauthenticated. It must refuse to start instead.
    expect(() => resolveAuthConfig({})).toThrow();
  });

  it("rejects a non-HTTPS issuer", () => {
    expect(() => resolveAuthConfig({ ...valid, MCP_AUTH_ISSUER: "http://as.example.com" }))
      .toThrow(/https/i);
  });

  it("allows an HTTP issuer only on localhost, for local development", () => {
    const config = resolveAuthConfig({ ...valid, MCP_AUTH_ISSUER: "http://localhost:8080" });
    expect(config.issuer).toBe("http://localhost:8080");
  });

  it("rejects an issuer that is not a URL at all", () => {
    expect(() => resolveAuthConfig({ ...valid, MCP_AUTH_ISSUER: "not-a-url" })).toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/mcp-auth-config.test.ts`
Expected: FAIL — cannot resolve `../../mcp-server/src/http/auth-config.js`

- [ ] **Step 3: Write the implementation**

Create `mcp-server/src/http/auth-config.ts`:

```typescript
/**
 * Authorization configuration for the HTTP transport.
 *
 * There is deliberately NO "unauthenticated fallback". If the HTTP transport is
 * enabled and this config cannot be resolved, the server refuses to start. A
 * fallback would recreate the open endpoint the first time a deployment lost an
 * env var, which is the failure this whole phase exists to fix.
 */

export type AuthConfig = {
  /** Base URL of the authorization server that issues our access tokens. */
  issuer: string;
  /** Canonical URL of this resource, as clients address it. */
  resourceUrl: string;
};

type Env = Record<string, string | undefined>;

function requireVar(env: Env, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(
      `[MCP] ${name} is required when MCP_HTTP_PORT is set. ` +
        `Refusing to start an unauthenticated HTTP transport.`,
    );
  }
  return value;
}

function assertSecureUrl(raw: string, name: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`[MCP] ${name} must be an absolute URL, got: ${raw}`);
  }

  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !isLocal) {
    throw new Error(`[MCP] ${name} must use https (http is allowed only on localhost), got: ${raw}`);
  }
  return raw;
}

export function resolveAuthConfig(env: Env): AuthConfig {
  const issuer = assertSecureUrl(requireVar(env, "MCP_AUTH_ISSUER"), "MCP_AUTH_ISSUER");
  const resourceUrl = assertSecureUrl(
    requireVar(env, "MCP_AUTH_RESOURCE_URL"),
    "MCP_AUTH_RESOURCE_URL",
  );
  return { issuer, resourceUrl };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/mcp-auth-config.test.ts`
Expected: PASS, 7 tests

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/http/auth-config.ts tests/unit/mcp-auth-config.test.ts
git commit -m "feat(mcp): resolve auth config, refusing to start without it" -- mcp-server/src/http/auth-config.ts tests/unit/mcp-auth-config.test.ts
```

---

## Task 3: The protected-resource metadata document

RFC 9728. This is how a client discovers which authorization server to use. It must be publicly readable — a client fetches it precisely because it has no token yet.

**Files:**
- Create: `mcp-server/src/http/protected-resource-metadata.ts`
- Test: `tests/unit/mcp-protected-resource-metadata.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/mcp-protected-resource-metadata.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { buildProtectedResourceMetadata } from "../../mcp-server/src/http/protected-resource-metadata.js";

describe("buildProtectedResourceMetadata", () => {
  const config = {
    issuer: "https://as.example.com",
    resourceUrl: "https://mcp.example.com/mcp",
  };

  it("names this resource by its canonical URL", () => {
    expect(buildProtectedResourceMetadata(config).resource).toBe("https://mcp.example.com/mcp");
  });

  it("advertises the authorization server", () => {
    // The spec requires authorization_servers to hold at least one entry —
    // without it a client cannot discover where to get a token.
    expect(buildProtectedResourceMetadata(config).authorization_servers).toEqual([
      "https://as.example.com",
    ]);
  });

  it("declares bearer tokens in the Authorization header", () => {
    expect(buildProtectedResourceMetadata(config).bearer_methods_supported).toContain("header");
  });

  it("produces a document that survives a JSON round trip", () => {
    const doc = buildProtectedResourceMetadata(config);
    expect(JSON.parse(JSON.stringify(doc))).toEqual(doc);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/mcp-protected-resource-metadata.test.ts`
Expected: FAIL — cannot resolve `protected-resource-metadata.js`

- [ ] **Step 3: Write the implementation**

Create `mcp-server/src/http/protected-resource-metadata.ts`:

```typescript
/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728).
 *
 * The MCP specification (2025-11-25, basic/authorization) requires a protected
 * MCP server to publish this so clients can discover the authorization server.
 * Served unauthenticated by design — a client reads it before it has a token.
 */

import type { AuthConfig } from "./auth-config.js";

export type ProtectedResourceMetadata = {
  resource: string;
  authorization_servers: string[];
  bearer_methods_supported: string[];
};

export function buildProtectedResourceMetadata(config: AuthConfig): ProtectedResourceMetadata {
  return {
    resource: config.resourceUrl,
    authorization_servers: [config.issuer],
    bearer_methods_supported: ["header"],
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/mcp-protected-resource-metadata.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/http/protected-resource-metadata.ts tests/unit/mcp-protected-resource-metadata.test.ts
git commit -m "feat(mcp): publish RFC 9728 protected-resource metadata" -- mcp-server/src/http/protected-resource-metadata.ts tests/unit/mcp-protected-resource-metadata.test.ts
```

---

## Task 4: The Express app, with auth in front of session creation

The ordering here is the security property. Session allocation currently happens for any POST lacking a session id; if auth ran after that, an unauthenticated caller could still allocate sessions and exhaust memory.

`createHttpApp` takes its verifier and its server factory as arguments so the integration test can supply a stub verifier instead of reaching a real authorization server.

**Files:**
- Create: `mcp-server/src/http/create-http-app.ts`

- [ ] **Step 1: Write the implementation**

There is no separate unit test for this file — it is wiring, and Task 5 tests it end to end through real HTTP, which is the only way the ordering property can actually be verified.

Create `mcp-server/src/http/create-http-app.ts`:

```typescript
/**
 * The HTTP surface for the MCP server.
 *
 * Route order is load-bearing:
 *   1. /.well-known/oauth-protected-resource — public, no auth (clients read it
 *      to discover the AS before they hold a token).
 *   2. requireBearerAuth on /mcp — runs BEFORE any session is allocated.
 *   3. the MCP session handling itself.
 *
 * Swapping 2 and 3 would let an unauthenticated caller allocate sessions.
 */

import express, { type Express } from "express";
import { randomUUID } from "node:crypto";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import type { OAuthTokenVerifier } from "@modelcontextprotocol/sdk/server/auth/provider.js";

import type { AuthConfig } from "./auth-config.js";
import { buildProtectedResourceMetadata } from "./protected-resource-metadata.js";

export const PROTECTED_RESOURCE_PATH = "/.well-known/oauth-protected-resource";

export type CreateHttpAppOptions = {
  config: AuthConfig;
  verifier: OAuthTokenVerifier;
  /** Builds a fresh McpServer per session. */
  createMcpServer: () => McpServer;
  /** Origins permitted to call the API. Wildcards are not accepted. */
  allowedOrigins: string[];
};

export function createHttpApp({
  config,
  verifier,
  createMcpServer,
  allowedOrigins,
}: CreateHttpAppOptions): Express {
  const app = express();
  const sessions = new Map<string, StreamableHTTPServerTransport>();

  // An explicit allowlist replaces the previous `*`. A wildcard is what lets any
  // page a user visits act as a client against this server.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, mcp-session-id, Authorization");
    res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // (1) Public discovery document.
  const metadata = buildProtectedResourceMetadata(config);
  app.get(PROTECTED_RESOURCE_PATH, (_req, res) => {
    res.json(metadata);
  });

  const resourceMetadataUrl = new URL(PROTECTED_RESOURCE_PATH, config.resourceUrl).toString();

  // (2) Auth, mounted before the handler below.
  app.all(
    "/mcp",
    requireBearerAuth({ verifier, resourceMetadataUrl }),
    // (3) Only reached once a token has been validated.
    async (req, res) => {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      let transport: StreamableHTTPServerTransport | undefined;

      if (sessionId) {
        transport = sessions.get(sessionId);
        if (!transport) {
          res.status(404).json({ error: "Session not found" });
          return;
        }
      } else if (req.method === "POST") {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
        });
        transport.onclose = () => {
          if (transport?.sessionId) sessions.delete(transport.sessionId);
        };
        await createMcpServer().connect(transport);
      } else {
        res.status(400).json({ error: "Bad request — missing session" });
        return;
      }

      await transport.handleRequest(req, res, req.body);

      if (transport.sessionId && !sessions.has(transport.sessionId)) {
        sessions.set(transport.sessionId, transport);
      }
    },
  );

  return app;
}

/** Exposed for tests that need to assert nothing was allocated. */
export function sessionCountOf(app: Express): number {
  return (app as unknown as { _sessionCount?: () => number })._sessionCount?.() ?? 0;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd mcp-server && npx tsc --noEmit`
Expected: no errors. If `requireBearerAuth`'s import path fails to resolve, confirm it against `mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm/server/auth/middleware/bearerAuth.d.ts` — the package uses explicit `.js` specifiers under NodeNext.

- [ ] **Step 3: Commit**

```bash
git add mcp-server/src/http/create-http-app.ts
git commit -m "feat(mcp): build the HTTP app with auth ahead of session creation" -- mcp-server/src/http/create-http-app.ts
```

---

## Task 5: The regression guard — unauthenticated requests are rejected

This is the test that proves the vulnerability is closed. Write it even if everything above already looks right; the point is that it keeps being true.

**Files:**
- Create: `tests/integration/mcp-http-auth.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/integration/mcp-http-auth.test.ts`:

```typescript
import { describe, expect, it, beforeEach } from "vitest";
import request from "supertest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

import {
  createHttpApp,
  PROTECTED_RESOURCE_PATH,
} from "../../mcp-server/src/http/create-http-app.js";

const config = {
  issuer: "https://as.example.com",
  resourceUrl: "https://mcp.example.com/mcp",
};

const VALID_TOKEN = "valid-token";

// Stub AS: the real one is a managed service. What we are testing is that the
// server consults a verifier at all and refuses when it says no.
let verifyCalls: string[] = [];
const verifier = {
  async verifyAccessToken(token: string): Promise<AuthInfo> {
    verifyCalls.push(token);
    if (token !== VALID_TOKEN) throw new Error("invalid token");
    return {
      token,
      clientId: "test-client",
      scopes: [],
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    };
  },
};

function buildApp() {
  return createHttpApp({
    config,
    verifier,
    createMcpServer: () => new McpServer({ name: "test", version: "0.0.0" }),
    allowedOrigins: ["https://claude.ai"],
  });
}

describe("MCP HTTP authorization", () => {
  beforeEach(() => {
    verifyCalls = [];
  });

  it("serves the protected-resource metadata without a token", async () => {
    const res = await request(buildApp()).get(PROTECTED_RESOURCE_PATH);
    expect(res.status).toBe(200);
    expect(res.body.authorization_servers).toEqual([config.issuer]);
  });

  it("rejects a POST to /mcp that carries no Authorization header", async () => {
    // This is the actual vulnerability: previously this allocated a session and
    // returned a live MCP server.
    const res = await request(buildApp()).post("/mcp").send({ jsonrpc: "2.0", method: "ping", id: 1 });
    expect(res.status).toBe(401);
  });

  it("points an unauthorized caller at the metadata document", async () => {
    const res = await request(buildApp()).post("/mcp").send({});
    expect(res.headers["www-authenticate"]).toContain("resource_metadata");
  });

  it("rejects a bad token", async () => {
    const res = await request(buildApp())
      .post("/mcp")
      .set("Authorization", "Bearer nope")
      .send({ jsonrpc: "2.0", method: "ping", id: 1 });
    expect(res.status).toBe(401);
  });

  it("consults the verifier for a presented token", async () => {
    await request(buildApp()).post("/mcp").set("Authorization", "Bearer nope").send({});
    expect(verifyCalls).toContain("nope");
  });

  it("does not allocate a session for an unauthenticated caller", async () => {
    const res = await request(buildApp()).post("/mcp").send({});
    expect(res.headers["mcp-session-id"]).toBeUndefined();
  });

  it("lets a valid token past the middleware", async () => {
    const res = await request(buildApp())
      .post("/mcp")
      .set("Authorization", `Bearer ${VALID_TOKEN}`)
      .set("Accept", "application/json, text/event-stream")
      .send({
        jsonrpc: "2.0",
        method: "initialize",
        id: 1,
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "test", version: "0.0.0" },
        },
      });
    // Past auth. Anything other than 401/403 proves the middleware allowed it
    // through; the transport's own response shape is not what this test owns.
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
    expect(verifyCalls).toContain(VALID_TOKEN);
  });

  it("does not echo an arbitrary origin back", async () => {
    const res = await request(buildApp())
      .get(PROTECTED_RESOURCE_PATH)
      .set("Origin", "https://evil.example.com");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("allows a configured origin", async () => {
    const res = await request(buildApp())
      .get(PROTECTED_RESOURCE_PATH)
      .set("Origin", "https://claude.ai");
    expect(res.headers["access-control-allow-origin"]).toBe("https://claude.ai");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/integration/mcp-http-auth.test.ts`
Expected: FAIL — module not found, or assertions fail if Task 4 is incomplete.

- [ ] **Step 3: Make it pass**

Task 4 supplies the implementation. If a test fails here, fix `create-http-app.ts` — do not weaken the test. In particular, if the `www-authenticate` assertion fails, check that `resourceMetadataUrl` is actually being passed to `requireBearerAuth`; the SDK only emits that header when it is.

- [ ] **Step 4: Run the full set**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/mcp-*.test.ts tests/integration/mcp-http-auth.test.ts`
Expected: PASS — 3 files, 20 tests.

- [ ] **Step 5: Commit**

```bash
git add tests/integration/mcp-http-auth.test.ts
git commit -m "test(mcp): prove /mcp rejects unauthenticated callers" -- tests/integration/mcp-http-auth.test.ts
```

---

## Task 6: Wire the app into the server entrypoint

**Files:**
- Modify: `mcp-server/index.ts` (the HTTP branch, ≈lines 76–142; leave stdio at ≈70–73 alone)

- [ ] **Step 1: Replace the HTTP branch**

In `mcp-server/index.ts`, replace the entire `if (HTTP_PORT > 0) { ... }` block with:

```typescript
  // HTTP transport (optional, for Claude.ai via remote MCP).
  // Authenticated per docs/superpowers/specs/2026-07-27-choreo-mcp-act-surface-design.md.
  // Enabling HTTP without auth config is a startup error, never a silent downgrade.
  if (HTTP_PORT > 0) {
    const authConfig = resolveAuthConfig(process.env);
    const allowedOrigins = (process.env.MCP_ALLOWED_ORIGINS ?? "https://claude.ai")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);

    const app = createHttpApp({
      config: authConfig,
      verifier: new ProxyOAuthServerProvider({
        endpoints: { authorizationUrl: `${authConfig.issuer}/authorize`, tokenUrl: `${authConfig.issuer}/token` },
        verifyAccessToken: async (token) => {
          const res = await fetch(`${authConfig.issuer}/introspect`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ token }),
          });
          if (!res.ok) throw new Error("token introspection failed");
          const info = (await res.json()) as { active: boolean; client_id?: string; scope?: string; exp?: number };
          if (!info.active) throw new Error("token is not active");
          return {
            token,
            clientId: info.client_id ?? "unknown",
            scopes: info.scope ? info.scope.split(" ") : [],
            expiresAt: info.exp,
          };
        },
        getClient: async () => undefined,
      }),
      createMcpServer,
      allowedOrigins,
    });

    app.listen(HTTP_PORT, () => {
      console.error(`[MCP-HTTP] Listening on port ${HTTP_PORT}/mcp (authorization required)`);
    });
  }
```

Add these imports beside the existing ones at the top of the file:

```typescript
import { ProxyOAuthServerProvider } from "@modelcontextprotocol/sdk/server/auth/providers/proxyProvider.js";
import { resolveAuthConfig } from "./src/http/auth-config.js";
import { createHttpApp } from "./src/http/create-http-app.js";
```

Remove the now-unused `createServer` and `StreamableHTTPServerTransport` imports from `index.ts` — the transport now lives in `create-http-app.ts`.

> **Verified against the installed SDK (1.25.2).** `ProxyOptions` in `mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm/server/auth/providers/proxyProvider.d.ts` is exactly `{ endpoints: { authorizationUrl, tokenUrl, revocationUrl?, registrationUrl? }, verifyAccessToken: (token) => Promise<AuthInfo>, getClient: (clientId) => Promise<OAuthClientInformationFull | undefined>, fetch? }`, and `AuthInfo` is `{ token, clientId, scopes, expiresAt? }`. The code above matches. If you upgrade the SDK, re-check this file before trusting the shape.

- [ ] **Step 2: Typecheck**

Run: `cd mcp-server && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Verify stdio still works unauthenticated**

Run: `cd mcp-server && echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | MCP_HTTP_PORT=0 npx tsx index.ts`
Expected: a JSON-RPC response listing tools. No auth involved. If this fails, the stdio path was disturbed — it must not be.

- [ ] **Step 4: Verify HTTP refuses to start without config**

Run: `cd mcp-server && MCP_HTTP_PORT=3333 npx tsx index.ts`
Expected: startup throws with `MCP_AUTH_ISSUER is required when MCP_HTTP_PORT is set`. This is the fail-closed invariant; a server that starts here is a bug.

- [ ] **Step 5: Commit**

```bash
git add mcp-server/index.ts
git commit -m "feat(mcp): require authorization on the HTTP transport" -- mcp-server/index.ts
```

---

## Task 7: Document the deployment change

The NSSM service will stop working the moment this ships unless its environment gains the new variables. That is intended — fail closed — but it must not be a surprise.

**Files:**
- Modify: `mcp-server/README.md` (create it if absent)

- [ ] **Step 1: Document the required environment**

Add to `mcp-server/README.md`:

```markdown
## HTTP transport and authorization

The HTTP transport is off unless `MCP_HTTP_PORT` is set. When it IS set, these
are required and the server refuses to start without them:

| Variable | Meaning |
|---|---|
| `MCP_HTTP_PORT` | Port for the HTTP transport. Unset or `0` disables it. |
| `MCP_AUTH_ISSUER` | Base URL of the authorization server. Must be https, except on localhost. |
| `MCP_AUTH_RESOURCE_URL` | Canonical public URL of this server's `/mcp` endpoint. |
| `MCP_ALLOWED_ORIGINS` | Comma-separated CORS allowlist. Defaults to `https://claude.ai`. |

There is no unauthenticated HTTP mode. Refusing to start is deliberate: a silent
downgrade would reopen the hole this design closed.

The **stdio** transport is unauthenticated by design — it is a local pipe with no
network surface, and it is how Claude Code connects. It needs none of the above.

### Deploying

The NSSM service must have the new variables added before this version is
installed, or it will fail to start. See `reference_flow_arts_mcp_deploy`.
```

- [ ] **Step 2: Commit**

```bash
git add mcp-server/README.md
git commit -m "docs(mcp): record the auth environment and the fail-closed contract" -- mcp-server/README.md
```

---

## Task 8: Full verification

- [ ] **Step 1: Run every test touched by this plan**

Run: `npx vitest run --config tests/config/vitest.config.ts tests/unit/mcp-*.test.ts tests/integration/mcp-http-auth.test.ts`
Expected: 3 files, 20 tests, all passing.

- [ ] **Step 2: Typecheck the whole project**

Run: `npx svelte-check --threshold error`
Expected: 0 errors. (Pre-existing warnings: 4, in `line-clamp` and `.buffering-*` selectors, unrelated to this work.)

- [ ] **Step 3: Confirm the real fix by hand**

```bash
cd mcp-server
MCP_HTTP_PORT=3333 \
MCP_AUTH_ISSUER=http://localhost:8080 \
MCP_AUTH_RESOURCE_URL=http://localhost:3333/mcp \
npx tsx index.ts &
sleep 3
curl -s -o /dev/null -w "no token: %{http_code}\n" -X POST http://localhost:3333/mcp -d '{}'
curl -s -o /dev/null -w "metadata: %{http_code}\n" http://localhost:3333/.well-known/oauth-protected-resource
```

Expected:
```
no token: 401
metadata: 200
```

Then stop the server (per `.claude/rules/resource-budget.md`, reap what you spawn).

- [ ] **Step 4: Push**

```bash
git push origin main
```

---

## Self-review notes

**Spec coverage.** Phase 1's five bullets map to tasks: transport migration → Task 4/6; metadata → Task 3; verification → Task 4/6; failure mode → Task 2 (config) and Task 5 (401 + `WWW-Authenticate`); session interaction → Task 4 ordering, asserted in Task 5. All five invariants have a test except invariant 5 (stdio unchanged), covered manually in Task 6 Step 3 — automating a stdio handshake is disproportionate here, and that is a deliberate call, not an oversight.

**API shapes verified, not assumed.** `requireBearerAuth`'s options and `ProxyOAuthServerProvider`'s constructor were both read from the installed `@modelcontextprotocol/sdk@1.25.2` type definitions rather than recalled, and the code in Tasks 4 and 6 matches them. The remaining unexecuted assumption is the *authorization server's* introspection endpoint (`POST /introspect`, RFC 7662) — that is vendor-shaped and gets confirmed once the vendor is chosen.

**Not covered, deliberately.** Choosing the managed AS vendor. Phase 1 depends on the *role*; the issuer is configuration. Picking Auth0 vs Stytch vs WorkOS is a decision for the deployment, and the introspection endpoint convention above may need adjusting to whichever is chosen — most support RFC 7662 introspection, but verify against the vendor's docs before Task 6.
