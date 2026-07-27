# Adversarial audit round 2 — MCP auth plan v2

**Date:** 2026-07-27
**Auditor:** Codex CLI 0.145.0 (`codex exec --sandbox read-only`), 322k tokens
**Subject:** plan v2, rewritten in response to round 1
**Verdict:** v2 fails. 3 of 15 prior findings fully fixed; finding 10 newly broken.

Independently verified: metadataHandler IS an express.Router with its route at '/'
and it applies cors() itself — so app.get() mounting 404s, and v2's self-review claim
that the SDK supplies no CORS was false. Confirmed by reading
node_modules/@modelcontextprotocol/sdk/dist/esm/server/auth/handlers/metadata.js.

---

V2 fails the second audit. Only findings 4, 11, and 15 are fully fixed. Finding 10 is broken in a new way. The remaining findings are partial.

## Part A: Regression check

| Finding | Verdict | Evidence |
|---:|---|---|
| 1 | **PARTIALLY FIXED** | [`jwtVerify`](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:506) now checks issuer, audience, signature, and expiry; `sub` and `AuthInfo.resource` are populated. But [`requireBearerAuth`](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:655) receives no `requiredScopes`, and the unit test explicitly accepts an empty scope list. A direct middleware probe accepted `scopes: []` with HTTP 204. |
| 2 | **PARTIALLY FIXED** | `GET /` is restored and variables were added to the launcher. However, the [`REPLACE-ME` values](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:995) are syntactically valid URLs, so startup succeeds with unusable configuration. The installer still [removes the existing service before validation](E:/tka-platform/mcp-server/deploy/install-service.ps1:31) and verifies only the public health route. Installation can report success while tunnel traffic is rejected and JWKS lookup is impossible. |
| 3 | **PARTIALLY FIXED** | The broken `ProxyOAuthServerProvider` and introspection call are gone. The plain `OAuthTokenVerifier` backed by `createRemoteJWKSet` is valid for a JWT-issuing AS. But no vendor or token format is chosen, contrary to the first audit and the Phase 1 spec. V2 admits the selected AS might issue opaque tokens, which would invalidate Task 3. |
| 4 | **FIXED** | [`jose` failures are converted to `InvalidTokenError`](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:528), which the installed middleware maps to 401. `createRemoteJWKSet` has a default five-second fetch timeout. The malformed challenge introduced by forwarding raw `jose` messages is a new defect below. |
| 5 | **PARTIALLY FIXED** | Tests now have a package-local Vitest config and dependencies. But no CI workflow is modified. The existing [web CI](E:/tka-platform/.github/workflows/web-ci.yml:35) runs only the root pnpm workspace, while [`mcp-server` remains outside it](E:/tka-platform/pnpm-workspace.yaml:1). CI can still merge auth regressions without compiling or running these tests. |
| 6 | **PARTIALLY FIXED** | The test reuses one app and requires a response below 400. A direct probe confirmed the cross-subject 403 works. But `onServerConstructed` is a manually fired hook, called after transport allocation and before `createMcpServer()`. It is not a spy on either constructor. There is no same-principal positive follow-up, DELETE test, eviction test, or production-verifier integration. |
| 7 | **PARTIALLY FIXED** | `onsessioninitialized` removes the post-request insertion bug. Direct probing confirmed DELETE removes the map entry and later requests return 404. However, [`evictIdle`](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:625) runs only when another authenticated request arrives. There is no absolute lifetime, size cap, per-principal cap, shutdown cleanup, or test. |
| 8 | **PARTIALLY FIXED** | A session stores `sub` and rejects a different `sub`. It does not bind OAuth client ID, resource, scopes, or token expiry. An open SSE request can still outlive its access token. Tokens for the same `sub` but different clients or privilege sets are treated as the same authorization context. |
| 9 | **PARTIALLY FIXED** | `createMcpExpressApp` gives JSON bodies the Express default 100 KB limit, and steady-state JWT verification avoids per-request introspection. But any authenticated POST without a session still constructs a transport and server before checking `isInitializeRequest`. There is no rate limit, concurrency limit, or session cap. A cold or failed JWKS cache still performs outbound requests for attacker-supplied JWTs. |
| 10 | **NOT FIXED** | The SDK URL helper computes the right URL, but v2 mounts `metadataHandler` with [`app.get(...)`](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:648). `metadataHandler` is a nested router intended for `app.use`. Against the installed SDK, the canonical GET returned **404** and OPTIONS bypassed the handler. Both advertised metadata paths are broken. |
| 11 | **FIXED** | The installed [`createMcpExpressApp` signature](E:/tka-platform/mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm/server/express.d.ts:5) accepts `allowedHosts`; the middleware validates Host headers; [`app.listen`](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:929) explicitly binds `127.0.0.1`. The factory itself does not bind a socket, despite v2 wording, but Task 6 does. |
| 12 | **PARTIALLY FIXED** | Port parsing, schemes, fragments, and embedded credentials are improved. Queries are still accepted; issuer query rules are absent; the resource is not required to identify `/mcp`; trailing-slash semantics are undefined; and the same value is used both for RFC 9728 resource identity and JWT audience. |
| 13 | **PARTIALLY FIXED** | The old global wildcard and catch-all OPTIONS handler are removed. V2's acknowledgement is factually wrong: the installed [`metadataHandler` already adds public CORS and GET/OPTIONS handling](E:/tka-platform/mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm/server/auth/handlers/metadata.js:4). The incorrect `app.get` mount prevents that policy from working, while `/mcp` has no origin allowlist at all. |
| 14 | **PARTIALLY FIXED** | Port 3399, package-local typecheck, and PowerShell syntax fix several old problems. The proposed E2E still provides no executable JWKS/token setup or environment block, despite saying “matching the env below.” Its valid-token criterion is only “not 401” and reuses a POST containing `{}`, so 400, 415, or 500 would count as success. |
| 15 | **FIXED** | [V2 context](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:38) now distinguishes the modified `mcp-server` runtime from the [`.mcp.json` packaged runtime](E:/tka-platform/.mcp.json:3). Testing the modified server’s stdio branch is now described as a regression test for that branch, not proof of the configured package. |

Neither finding 9 nor finding 13 qualifies as **DEFERRED WITH ACKNOWLEDGEMENT**. Finding 9 understates the remaining outbound and construction amplification. Finding 13 misreads the installed SDK and leaves a stated Phase 1 invariant unmet.

## Part B: Defects in v2

The named SDK calls are type-compatible with the installed SDK 1.25.2. `metadataHandler` accepts the object, the URL helper takes a `URL` and returns a string, and `onsessioninitialized` is supported. `jose` 6.1.3 accepts either a direct JWK or a resolver, so `as never` hides an overload-union typing nuisance rather than a runtime key mismatch. The resulting application still does not run correctly because of the defects below.

1. **Severity:** CRITICAL  
   **Location:** [Task 4 metadata mounting](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:640); [SDK metadata handler](E:/tka-platform/mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm/server/auth/handlers/metadata.js:4)  
   **The defect:** `metadataHandler` returns a router whose internal route is `/`. Mounting it as an exact `app.get(path, router)` does not strip the mount path. A direct probe returned GET 404 with v2’s code. Changing only `get` to `use` returned GET 200 and OPTIONS 204.  
   **Why it matters:** OAuth discovery is dead. The `WWW-Authenticate` challenge points clients at a 404, and both Task 5 metadata assertions fail. RFC 9728 requires a successful metadata GET to return 200 with the document. [RFC 9728](https://www.rfc-editor.org/rfc/rfc9728.html)  
   **The fix:** Mount freshly created handlers with `app.use(metadataPath, metadataHandler(metadata))` and `app.use(rootAlias, metadataHandler(metadata))`. Keep explicit GET and OPTIONS integration tests.

2. **Severity:** CRITICAL  
   **Location:** [Task 7 launcher](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:986); [installer replacement sequence](E:/tka-platform/mcp-server/deploy/install-service.ps1:31)  
   **The defect:** The placeholders pass every v2 URL validator. The process starts, `GET /` passes the installer, and the configured JWKS host is nonexistent. The written Host allowlist also rejects `mcp.tkaflowarts.com`; its uppercase placeholder rejects itself because the SDK normalizes the parsed hostname to lowercase before a case-sensitive comparison. There is no preflight, staged restart, or rollback.  
   **Why it matters:** Running the documented installer can produce a green “SUCCESS” message while the remote MCP endpoint is unusable. It still replaces the live service before proving the replacement.  
   **The fix:** Parameterize installation, reject placeholder text case-insensitively, normalize allowed hostnames, derive the public hostname from the resource URL, validate AS metadata/JWKS, start the candidate on a free port, perform a signed initialization, then switch the service with rollback on failure.

3. **Severity:** HIGH  
   **Location:** [Task 3 empty-scope test](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:438); [Task 4 auth middleware](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:654)  
   **The defect:** V2 parses scopes but authorizes without requiring one. It also omits `scopes_supported` from metadata. A valid token with the correct issuer and audience but no `mcp:use` scope is accepted.  
   **Why it matters:** Audience answers which resource may receive a token. Scope answers what the token may do there. V2 enforces only the first. The MCP authorization specification recommends advertising required scopes, and the installed middleware already implements 403 `insufficient_scope`. [MCP authorization specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)  
   **The fix:** Define the actual Phase 1 scope, pass it through `requiredScopes`, publish it in `scopes_supported`, provision it at the AS, and add missing/wrong-scope HTTP tests.

4. **Severity:** HIGH  
   **Location:** [Task 2 URL normalization](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:260); [Task 3 issuer/audience comparison](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:506)  
   **The defect:** `issuer.href.replace(/\/$/, "")` mutates an identifier that must be compared exactly. V2 advertises `config.issuer.href`, including its slash, while verifying against the stripped form. A direct `jose` probe rejected a correctly signed token whose `iss` retained the configured slash. The code also assumes the JWT `aud` must equal the RFC 9728 resource URL, although RFC 8707 permits an AS to map the resource indicator to another audience identifier. The SDK helper drops queries even though Task 2 permits them.  
   **Why it matters:** A valid real-AS token can be rejected forever. Conversely, one configuration value cannot represent both the public MCP resource and an AS-specific audience mapping. RFC 8414 issuer matching is exact; RFC 8707 explicitly permits audience mapping. [RFC 8414](https://www.rfc-editor.org/rfc/rfc8414.html), [RFC 8707](https://www.rfc-editor.org/rfc/rfc8707.html)  
   **The fix:** Preserve the exact issuer string obtained from validated AS metadata. Enforce one canonical public `/mcp` resource with no query or trailing-slash ambiguity. Add a separate expected-audience setting if the chosen AS maps resource indicators.

5. **Severity:** HIGH  
   **Location:** [Task 3 JWT verification options](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:491); [Phase 1 proxyProvider decision](E:/tka-platform/docs/superpowers/specs/2026-07-27-choreo-mcp-act-surface-design.md:189)  
   **The defect:** V2 has no accepted-algorithm list, no `typ` check, and no defined access-token profile. It does not require `client_id`, `iat`, or `jti`. It also silently replaces the spec’s proxyProvider architecture without updating the spec or choosing a vendor. Direct probing found no classic `none` or RSA-to-HMAC bypass: `jwtVerify` rejects `alg:none`, and production remote JWKS rejects HMAC. The remaining defect is that any compatible asymmetric algorithm and any JWT class carrying matching claims can pass.  
   **Why it matters:** This leaves cross-JWT confusion and algorithm policy to library defaults. JWT BCP requires an application-selected algorithm set and explicit typing; RFC 9068 defines `at+jwt` and required access-token claims when that profile is used. [RFC 8725](https://www.rfc-editor.org/rfc/rfc8725), [RFC 9068](https://www.rfc-editor.org/rfc/rfc9068.html)  
   **The fix:** Choose the AS first, amend the Phase 1 spec, and define its token profile. Pass `algorithms`, `typ`, and required claims to `jwtVerify`, or implement the vendor’s documented equivalent.

6. **Severity:** HIGH  
   **Location:** [Task 6 IPv4-only listener](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:929); [deployment origin remains localhost](E:/tka-platform/mcp-server/deploy/README.md:39)  
   **The defect:** V2 binds only `127.0.0.1`, while the tunnel instructions still point cloudflared at `localhost:3333`. The repository already records that cloudflared resolves `localhost` to `::1` first and requires `127.0.0.1` for IPv4-only listeners.  
   **Why it matters:** Correct auth configuration can still produce a tunnel-origin 502. This failure occurs before Host validation or OAuth code runs.  
   **The fix:** Change the tunnel origin to `http://127.0.0.1:3333`, update the README and installer probes consistently, and include a public-tunnel request in deployment verification.

7. **Severity:** HIGH  
   **Location:** [Task 1 test setup](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:71); [Task 5 tests](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:722); [current CI](E:/tka-platform/.github/workflows/web-ci.yml:35)  
   **The defect:** The security suite remains local-only. Unit tests inject a direct JWK rather than exercising `createRemoteJWKSet`. `onServerConstructed` is fired before the real factory and does not observe transport construction. The cross-principal test lacks a same-principal success control. Task 8’s manual JWKS exercise is unspecified and accepts any non-401 result.  
   **Why it matters:** Key selection, network timeout, cache behavior, route mounting, CI installation, and successful MCP initialization can all be broken while the intended guard remains absent or misleading.  
   **The fix:** Add a CI job with `working-directory: mcp-server`, `npm ci`, typecheck, and the full test suite. Start a local HTTP JWKS server inside an automated test and use the real `jwksUri` path. Spy directly on transport and server factories. Assert a 200 initialize result, session header, same-principal ping, cross-principal 403, DELETE, expiry, and eviction.

8. **Severity:** HIGH  
   **Location:** [Task 3 AuthInfo construction](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:520); [Task 4 session record](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:596)  
   **The defect:** V2 writes JWT `sub` into `AuthInfo.clientId`, even though the SDK defines `clientId` as the OAuth client identifier. Session ownership compares only this substituted value. Tokens with the same `sub` but different `client_id` or scopes collide. A vendor using client-specific pairwise subjects can also treat the same human as different session owners.  
   **Why it matters:** The session is not bound to the complete authorization context. That becomes a user-data boundary in Phase 2.  
   **The fix:** Validate and preserve `client_id`, store the subject separately, and define a stable binding such as issuer plus subject plus OAuth client. Recheck required scopes on every request and define how refreshed or reduced-scope tokens affect an existing session.

9. **Severity:** HIGH  
   **Location:** [Task 4 eviction](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:625); [SDK close behavior](E:/tka-platform/mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm/server/webStandardStreamableHttp.js:604)  
   **The defect:** “Thirty-minute idle expiration” is not an expiration mechanism. With no later request, the record and SSE connection live forever. Token expiry is not stored. There are no absolute or capacity limits. `void transport.close()` discards a potentially rejected promise.  
   **Why it matters:** Abandoned sessions consume memory indefinitely, active SSE streams can receive data after token expiry, and one authenticated caller can create an unbounded number of sessions.  
   **The fix:** Use an unref’d timer or deadline queue, enforce global and per-principal caps, close SSE at token expiry, add absolute lifetime, catch or await close failures, and close all transports during shutdown.

10. **Severity:** HIGH  
    **Location:** [Task 4 new-session branch](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:681); [installed SDK example](E:/tka-platform/mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm/examples/server/simpleStreamableHttp.js:493)  
    **The defect:** Any authenticated POST without a session constructs and connects a server before establishing that the body is an initialize request. The SDK’s own example checks `isInitializeRequest(req.body)` first. There is no rate limiter or creation semaphore. During a cold cache or JWKS outage, sequential invalid JWTs can repeatedly trigger five-second outbound JWKS fetches.  
    **Why it matters:** A low-privilege user can force expensive server construction. During AS trouble, unauthenticated traffic can still amplify outbound work despite v2 claiming otherwise.  
    **The fix:** Validate a single initialize message before construction, rate-limit before expensive work, cap verification and session-creation concurrency, warm or preflight the JWKS cache, and add bounded backoff or a circuit breaker for JWKS outages.

11. **Severity:** MEDIUM  
    **Location:** [Task 4 route setup](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:640); [v2 self-review](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:1089)  
    **The defect:** `/mcp` has no configured CORS policy, and OPTIONS is protected by bearer auth. The stated origin allowlist invariant from the Phase 1 spec is not implemented. The claim that metadata lacks CORS is wrong because the SDK handler supplies it; v2 merely mounts that handler incorrectly.  
    **Why it matters:** Browser MCP clients cannot preflight the protected endpoint, and the implementation contradicts its governing spec. Host validation is not a substitute for CORS.  
    **The fix:** Correctly mount metadata with its public SDK CORS policy. Add a route-scoped origin allowlist for `/mcp`, including Authorization and MCP headers, and test allowed and rejected preflights.

12. **Severity:** MEDIUM  
    **Location:** [Task 3 error translation](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:528); [SDK header construction](E:/tka-platform/mcp-server/node_modules/@modelcontextprotocol/sdk/dist/esm/server/auth/middleware/bearerAuth.js:41)  
    **The defect:** Raw `jose` messages are copied into `InvalidTokenError`. The SDK inserts them into a quoted `WWW-Authenticate` value without escaping. A direct wrong-audience probe produced `error_description="unexpected "aud" claim value"`, which is malformed. Network and key-selection details are also exposed to clients.  
    **Why it matters:** OAuth clients may fail to parse the challenge precisely when a token is rejected, and internal verification details leak unnecessarily.  
    **The fix:** Return a constant, header-safe client description such as `The access token is invalid`; log the internal `jose` error separately.

13. **Severity:** LOW  
    **Location:** [Task 2 expected count](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:314); [Task 5 expected count](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:881); [Task 8](E:/tka-platform/docs/superpowers/plans/2026-07-27-mcp-resource-server-auth.md:1047)  
    **The defect:** The proposed suite contains 35 tests, not 37: auth config has 15, not 16; HTTP auth has 10, not 11. Task 8 also creates `tests/manual/e2e-check.md` after the final commit task and then pushes without committing it.  
    **Why it matters:** Expected output cannot match the written plan, and the manual procedure will remain untracked.  
    **The fix:** Correct the counts and replace the manual document with the automated remote-JWKS integration test. If retained, add it to an explicit scoped commit.

## What I could not verify

- No authorization-server vendor, registration, metadata document, token sample, or claim contract exists. Exact issuer, audience mapping, scope claim, token type, signing algorithms, and opaque-versus-JWT behavior remain unknown.
- The proposed TypeScript files and dependencies do not exist yet, so the complete suite and package typecheck could not be run. Installed declarations and focused runtime probes were used instead.
- The literal stdio command could not run because the read-only sandbox prevented `tsx` from creating its cache directory.
- The external `mcp.tkaflowarts.com` route and claude.ai OAuth handshake were not reachable. The remote-managed tunnel’s current origin and Host-header overrides could not be inspected.
- No live service restart or installation was attempted.
