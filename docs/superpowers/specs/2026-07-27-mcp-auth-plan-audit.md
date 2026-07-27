# Adversarial audit — MCP resource-server auth plan

**Date:** 2026-07-27
**Auditor:** Codex CLI 0.145.0 (`codex exec --sandbox read-only`), 268k tokens
**Subject:** `docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md`

Findings verified independently by spot-check: #2 (deploy/ exists, installer probes GET /),
#4 (bearerAuth maps only InvalidTokenError→401; plain Error→500), #5 (tests/integration is
excluded by tests/config/vitest.config.ts:44), #10 (metadata URL drops the resource path),
#11 (createMcpExpressApp exists in the SDK). All confirmed.

---

1. **Severity:** CRITICAL  
   **Location:** [Plan Task 6 Step 1](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:643); [SDK bearer middleware](E:/tka-platform/mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm/server/auth/middleware/bearerAuth.js:21)  
   **The defect:** The verifier accepts any response with truthy `active` and numeric future `exp`. It never validates `aud`/resource, issuer, subject, or an MCP-specific scope. The TypeScript cast provides no runtime validation, so even `"active": "false"` is accepted. No `requiredScopes` are passed to `requireBearerAuth`.  
   **Why it matters:** A token issued by the same AS for another API can authorize every MCP tool. The MCP specification requires servers to validate that the token was issued specifically for their resource. [MCP authorization specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)  
   **The fix:** Require `active === true`; validate exact canonical audience/resource, issuer, numeric expiry, stable subject, and required scopes. Return the subject in `AuthInfo.extra`, set `AuthInfo.resource`, and add wrong-audience and missing-scope rejection tests.

2. **Severity:** CRITICAL  
   **Location:** [Plan Task 7](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:711); [NSSM launcher](E:/tka-platform/mcp-server/deploy/run-mcp-http.cmd:5); [installer health check](E:/tka-platform/mcp-server/deploy/install-service.ps1:62)  
   **The defect:** The plan documents new variables but never provisions them. The live `FlowArtsKnowledgeMCP` service is Running/Automatic; read-only registry inspection found empty `AppEnvironment` and `AppEnvironmentExtra`, and the required machine/user variables are unset. After restart, `resolveAuthConfig` will terminate the process and NSSM will restart it every three seconds. The replacement app also removes `GET /`, while the installer requires that route to return 200.  
   **Why it matters:** Deployment causes a production outage and restart loop. Reinstalling still fails its smoke test.  
   **The fix:** Add an atomic deployment task that provisions validated AS configuration and introspection credentials before restart. Add a public `/healthz` route or update all probes. Verify the new environment, then restart and test through the tunnel.

3. **Severity:** HIGH  
   **Location:** [Plan Task 6 Step 1](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:645); [plan self-review](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:801); [Proxy provider implementation](E:/tka-platform/mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm/server/auth/providers/proxyProvider.js:151)  
   **The defect:** `ProxyOAuthServerProvider` adds no verification here. Its `authorizationUrl`, `tokenUrl`, and `getClient` settings are unused because no proxy authorization router is mounted; `verifyAccessToken` merely forwards to the plan’s custom callback. That callback hardcodes `${issuer}/introspect`, supplies no introspection authentication, and is written before an AS vendor has been chosen. RFC 7662 requires authorization for introspection requests. [RFC 7662](https://www.rfc-editor.org/info/rfc7662/)  
   **Why it matters:** A compliant managed AS will reject the request. Valid-token success is not implementable as written, and the claim that SDK `proxyProvider` delegates the security-sensitive work is false.  
   **The fix:** Choose the AS before Task 6. Discover or explicitly configure its introspection/JWKS endpoint and required authentication. Use a plain `OAuthTokenVerifier` unless authorization endpoints are genuinely being proxied. Add a production-verifier test with a mock AS that asserts URL, credentials, request body, and claims.

4. **Severity:** HIGH  
   **Location:** [Plan production verifier](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:647); [Task 5 bad-token test](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:544); [SDK error handling](E:/tka-platform/mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm/server/auth/middleware/bearerAuth.js:39)  
   **The defect:** Production and test verifiers throw plain `Error`. The installed middleware converts plain errors to HTTP 500. A direct middleware probe confirmed: missing header returns 401, while a verifier throwing `Error("inactive")` returns 500. Therefore bad token, `active: false`, non-JSON response, failed HTTP status, and network failure do not satisfy the claimed 401 contract. Fetch also has no explicit timeout and may leave requests pending.  
   **Why it matters:** Task 5’s bad-token test fails immediately. OAuth clients receive the wrong response and no challenge for inactive tokens. Access remains denied, so this is not a fail-open path, but it is not the stated behavior.  
   **The fix:** Throw SDK `InvalidTokenError` for inactive, malformed, expired, and wrong-audience tokens. Use a bounded timeout. Represent AS outages separately as a controlled 503, or explicitly revise the specification if it truly requires every outage to masquerade as 401.

5. **Severity:** HIGH  
   **Location:** [Plan Task 1 test script](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:68); [Task 5 execution](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:600); [Vitest exclusion](E:/tka-platform/tests/config/vitest.config.ts:37); [workspace definition](E:/tka-platform/pnpm-workspace.yaml:1); [CI workflow](E:/tka-platform/.github/workflows/web-ci.yml:35)  
   **The defect:** The regression test is excluded by `tests/config/vitest.config.ts`, which ignores every `tests/integration/**/*` file. The test resides at the root but its dependencies are installed only under sibling `mcp-server`; a resolution probe from `tests/integration` returned `MODULE_NOT_FOUND` for both `supertest` and the MCP SDK. `mcp-server` does not declare Vitest, is outside the pnpm workspace, and CI neither installs nor tests it. The lowercase `--testNamePattern mcp` also excludes the named unit suites and the uppercase `"MCP HTTP authorization"` suite.  
   **Why it matters:** CI can remain green without compiling the server or executing the security regression.  
   **The fix:** Put MCP tests and dependencies inside `mcp-server`, add Vitest there, and create a Node-environment config. Alternatively make `mcp-server` a real workspace package. Add an explicit CI install, typecheck, unit-test, HTTP integration, and stdio integration step. Remove the test-name filter.

6. **Severity:** HIGH  
   **Location:** [Task 5 assertions](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:552); [fake session counter](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:447)  
   **The defect:** The tests do not prove their named invariants. “No allocation” only checks for an absent response header. `sessionCountOf` always returns zero because `_sessionCount` is never assigned, and no test calls it. “Valid token reaches MCP” accepts HTTP 500 because it asserts only “not 401/403.” The verifier-call assertion checks the mock, not whether its result controls access. Every request gets a fresh app, so existing-session behavior is untested.  
   **Why it matters:** Middleware could allocate a server before rejecting, or the MCP handler could crash, and these tests would pass.  
   **The fix:** Inject a transport factory and spy on both transport and `McpServer` construction. Assert zero calls for unauthenticated requests. Reuse one app across initialize/follow-up/DELETE requests. Require a successful initialize response and session header. Test missing, invalid, expired, inactive, wrong-audience, and valid tokens.

7. **Severity:** HIGH  
   **Location:** [Plan session map and lifecycle](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:380); [post-request insertion](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:436); [SDK close behavior](E:/tka-platform/mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm/server/webStandardStreamableHttp.js:604)  
   **The defect:** The `Map` has no idle eviction, absolute lifetime, or maximum size. Registration after `handleRequest` also creates a race during initialization. Worse, DELETE closes the transport, `onclose` removes it, and lines 438–440 immediately reinsert the closed transport because the SDK does not clear `sessionId` on close.  
   **Why it matters:** DELETE does not reliably terminate sessions, abandoned clients grow memory indefinitely, and concurrent initialization can receive false 404s.  
   **The fix:** Register through `onsessioninitialized`, as the installed SDK example does. Never insert after every request. Add idle and absolute expiration, global/per-principal caps, explicit close on eviction, and graceful shutdown cleanup. Test DELETE, concurrent initialization, and eviction.

8. **Severity:** HIGH  
   **Location:** [Plan bare transport map](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:380); [session lookup](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:417)  
   **The defect:** Sessions are keyed only by session ID. They retain no authenticated subject, client, resource, scopes, or token expiry. A different valid principal possessing a session ID can reuse the same stateful `McpServer`. An already-open SSE request can continue receiving data after its token expires because expiry is checked only when the HTTP request begins.  
   **Why it matters:** This becomes a cross-user data boundary once Firebase Admin and user acts are added. Token refresh, revocation, and expiration have undefined session semantics.  
   **The fix:** Store a session record containing subject, client, audience, scopes, expiry, and timestamps. Compare the current authenticated principal on every request. Close SSE streams and transports at expiry and reject cross-principal reuse. Do not store raw bearer tokens.

9. **Severity:** HIGH  
   **Location:** [Plan session allocation](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:423); [introspection fetch](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:648)  
   **The defect:** Any authenticated POST without a session ID constructs and connects a complete server before the transport validates content type, `Accept`, JSON, or whether the message is `initialize`. Random invalid bearer tokens also trigger an outbound introspection request. There is no rate limit, concurrency bound, body limit, AS timeout, or circuit breaker.  
   **Why it matters:** Invalid-token traffic can exhaust outbound AS capacity. A low-privilege valid user can repeatedly force server construction and consume memory or CPU.  
   **The fix:** Parse with a bounded JSON body, require a valid initialization message before construction, rate-limit `/mcp` ahead of introspection, cap concurrent verification and session creation, and apply an abort timeout plus outage circuit breaker.

10. **Severity:** MEDIUM  
    **Location:** [Plan metadata route](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:362); [URL construction](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:406); [SDK canonical helper](E:/tka-platform/mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm/server/auth/router.js:103)  
    **The defect:** The leading slash passed to `new URL()` discards `/mcp`. A direct comparison produced:

    `plan=https://mcp.example.com/.well-known/oauth-protected-resource`  
    `sdk=https://mcp.example.com/.well-known/oauth-protected-resource/mcp`

    RFC 9728 derives the path-specific location by inserting the well-known segment before the resource path. [RFC 9728](https://www.rfc-editor.org/rfc/rfc9728.html) The MCP specification permits a root fallback, so challenge-following clients may still work, but the first canonical discovery request returns 404. Tests only check that the header contains the parameter, not its value.  
    **Why it matters:** Discovery becomes client-dependent and the claim of SDK/RFC-conformant construction is false.  
    **The fix:** Use `getOAuthProtectedResourceMetadataUrl(new URL(config.resourceUrl))`, mount that exact path, and test it. A root alias can remain for compatibility.

11. **Severity:** MEDIUM  
    **Location:** [Plan Express construction](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:379); [listener](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:669); [SDK Express factory](E:/tka-platform/mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm/server/express.js:26)  
    **The defect:** The plan uses bare `express()` instead of the installed `createMcpExpressApp`, losing the SDK’s JSON parsing and Host-header protection. `app.listen(HTTP_PORT)` binds to every interface; a runtime probe bound to `::`. CORS does not prevent DNS rebinding or non-browser requests.  
    **Why it matters:** A service intended to sit behind a local Cloudflare tunnel is exposed to LAN interfaces and accepts arbitrary Host headers.  
    **The fix:** Use the SDK factory with explicit allowed hosts, and call `listen(HTTP_PORT, "127.0.0.1")`. Include the public tunnel host and localhost probe hosts in the Host allowlist.

    The three-argument `transport.handleRequest(req, res, req.body)` call itself is valid. The installed declaration accepts the optional third argument, and undefined body falls back to reading the untouched request stream. That call is not the compile failure.

12. **Severity:** MEDIUM  
    **Location:** [Plan URL validation](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:190); [current port parsing](E:/tka-platform/mcp-server/index.ts:38)  
    **The defect:** Localhost bypasses the protocol check entirely, so `ftp://localhost` is accepted despite the error message saying only HTTP is allowed. Issuer and resource URLs may contain credentials, fragments, queries, arbitrary paths, or trailing-slash ambiguity. `MCP_AUTH_RESOURCE_URL` is not required to identify `/mcp`. Endpoint string concatenation can produce double slashes. Invalid ports such as `abc` silently disable HTTP through `NaN > 0`.  
    **Why it matters:** Startup validation can pass while discovery, introspection, and audience comparison refer to different resources. Invalid port configuration fails silently. It does not create an unauthenticated listener, but it does violate the stated startup contract.  
    **The fix:** Return normalized `URL` objects. Permit only `https:`, or exactly `http:` on loopback. Reject userinfo and fragments; define query/path policy; require the canonical MCP resource path. Parse the port as a strict integer from 1–65535 and throw when a nonempty value is malformed.

13. **Severity:** MEDIUM  
    **Location:** [Plan CORS middleware](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:384); [metadata route](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:400)  
    **The defect:** One global CORS policy is applied to both protected requests and public discovery. The metadata document is publicly readable without auth but cannot be read by browser clients outside the configured origin list. `Vary: Origin` is set only for allowed origins. The middleware also returns 204 to every OPTIONS request before route matching.  
    **Why it matters:** Public OAuth discovery can fail in browser clients, and caches can mishandle responses with inconsistent `Vary`. OPTIONS behavior is broader than the documented surface.  
    **The fix:** Give metadata GET/OPTIONS its own public CORS policy, safely using `Access-Control-Allow-Origin: *`. Apply the restricted policy only to `/mcp`, always set `Vary: Origin` for dynamic responses, and scope preflight handling to known routes.

14. **Severity:** MEDIUM  
    **Location:** [Task 6 manual checks](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:692); [Task 8 manual verification](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:768); [root TypeScript scope](E:/tka-platform/tsconfig.json:45)  
    **The defect:** Task 8 tries to start another server on live port 3333, so it will either fail with `EADDRINUSE` or curl the old service. Its fake issuer has no AS running, but the only protected request omits a token, so introspection is never exercised. It never proves valid-token success. The Windows checkout instructions use POSIX environment syntax. The final `svelte-check` includes only root `src/**`, not `mcp-server` or these tests.  
    **Why it matters:** “Full verification” can test the wrong process and still never exercise the managed-AS path.  
    **The fix:** Use a free port and a local mock AS. Test no token, inactive token, wrong audience, AS outage, malformed response, and valid initialization. Use a dedicated MCP typecheck/test command and PowerShell-compatible environment setup.

15. **Severity:** LOW  
    **Location:** [Plan context](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:19); [stdio check](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:692); [repo MCP configuration](E:/tka-platform/.mcp.json:3); [packaged server entrypoint](E:/tka-platform/mcp-server-pkg/index.ts:21)  
    **The defect:** The plan says `mcp-server`’s stdio transport is the local Claude Code path, but the repository configuration points to `mcp-server-pkg/dist/index.js`. Task 6 tests the stdio branch in the NSSM codebase, not the repo-configured packaged server.  
    **Why it matters:** The documentation and “local workflow verified” claim conflate two runtimes.  
    **The fix:** State which consumer uses each stdio server. Keep a child-process regression for the modified `mcp-server` branch, and a separate smoke test for the configured package if local workflow continuity is part of the done condition. No direct change to `mcp-server-pkg` was found; it remains stdio-only and untouched.

## What I could not verify

- No managed AS vendor or deployment exists, so its discovery document, client-registration compatibility, introspection authentication method, claim names, scopes, and outage semantics could not be checked.
- The external Cloudflare route and claude.ai OAuth handshake were not reachable from this restricted environment.
- The proposed source and test files do not exist yet, so their complete compile and runtime behavior could not be executed. The relevant installed SDK signatures and JavaScript implementations were checked directly.
- Vitest execution could not start because the read-only sandbox prevented Vite from creating `.vite-temp`. The exclusion and dependency-resolution defects were established from the loaded configuration, installed runner source, and a direct Node resolution probe.
