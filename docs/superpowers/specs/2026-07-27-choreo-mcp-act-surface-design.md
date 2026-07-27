# Choreo — MCP Act Surface: authorization, consolidation, act tools (design)

**Date:** 2026-07-27
**Status:** Phase 0 + Phase 1 specced to implementation depth. Phases 2–3 sketched; each gets its own spec.
**Supersedes the fork left open by:** `docs/superpowers/specs/2026-07-26-choreo-mcp-and-performance-variants-handoff.md` (Part 1, "The fork that has to be decided first")
**Prerequisite already landed:** note/cue addressing moved to absolute step indices (`67d4ca3103`), so annotations no longer depend on layout. Everything below assumes that.

---

## Why this exists

The 07-26 handoff wanted an MCP surface where an agent can do to an act anything a
human can do in the UI. Investigating how to get there turned up two facts that
change the shape of the work, both verified in the code rather than assumed.

### 1. The MCP server's HTTP transport is unauthenticated

`mcp-server/index.ts` runs two transports. Stdio (≈70–73) is a local pipe used by
Claude Code — fine. The HTTP branch (≈76–142) serves `/mcp` with
`Access-Control-Allow-Origin: *` and **no authorization check of any kind**; any
POST without a session id allocates a new session and gets a live MCP server.

Today that is low-consequence: every tool is read-only domain knowledge and
pictograph rendering. There is no user data behind it and nothing to write.

It stops being low-consequence the moment act tools exist, because acts live in
Firestore under `users/{uid}`. Reaching them requires Firebase Admin credentials
in the MCP process, and an unauthenticated endpoint holding admin credentials is
a read/write path into the whole database for anyone who can reach the port.
`MCP_HTTP_PORT` defaults to `0` (off), but the deployed NSSM service sets it to
3333 precisely so claude.ai can reach it — see `reference_flow_arts_mcp_deploy`.

**So authorization is not a nice-to-have alongside act tools. It is the gate.**

### 2. There are two MCP server codebases, and they have already drifted

| | `mcp-server/` | `mcp-server-pkg/` |
|---|---|---|
| Package | `flow-arts-knowledge-mcp` 3.0.0 | `@austencloud/tka-domain-mcp` 2.3.0 |
| Last commit | `c795328af1`, 2026-07-27 | `b45281a6bb`, 2026-07-18 |
| Shape | plain source | `bin` + `files` + esbuild bundle — publishable |
| Tools | includes `vtg-tools.ts` | **missing `vtg-tools.ts`** |
| Launched by | the NSSM service | `.mcp.json` → `tka-domain-local` (stdio) |

Both are tracked. Both carry a full copy of `src/tools/`. The only file-level
difference is `vtg-tools.ts`, and `mcp-server-pkg`'s last commit message is
*"chore: snapshot before consolidating to main."*

`mcp-server-pkg` is therefore not a second product. It is a hand-copied
distribution snapshot that someone began consolidating and did not finish, and
hand-copying is exactly why it is missing a tool file. Adding `act-tools.ts` to
one of the two would deepen a split that is already causing loss.

---

## Decisions

| Decision | Who / when | Rationale |
|---|---|---|
| Full capability: compose, edit, render/export, and variants groundwork | Austen, 2026-07-27 ("All of this") | No narrowing to one verb; the design covers the whole surface and sequences it |
| Approach **C** — authenticate `/mcp` first, then full remote Firestore-backed tools | Austen, 2026-07-27 | Most capable end state. Chosen over stdio-only gating (A) and Firestore-now (B) with the "auth before feature" cost stated and accepted |
| Delegate to a **managed authorization server** via the SDK's `proxyProvider` | Austen, 2026-07-27 (took the recommendation) | We write zero token-issuing code. The alternative — implementing our own AS — is the hand-rolled option and was declined |
| One source, one build, zero copies | Austen, 2026-07-27 ("give me the 10-year plan") | Structural fix rather than a tactical pick; see Phase 0 |
| Phase 1 specced deep, Phases 2–3 sketched | Austen, 2026-07-27 | One executable plan at a time; later phases depend on decisions only makeable once auth is real |
| Robustness over speed | Austen, 2026-07-27 | Phase 1 delivers no user-visible act capability and that is accepted |

### On "are we hand-rolling something our other servers already solved?"

Asked during the brainstorm, answered with evidence, recorded here because it
will be asked again:

- **No in-house precedent exists.** Our server is registered over stdio
  (`.mcp.json`), which needs no authorization. Nothing we have built does MCP
  auth today.
- **The `authenticate` / `complete_authentication` tools visible on the Flow Arts
  Knowledge connector are not ours.** No such tool is defined anywhere in our
  source. They are claude.ai's connector-layer OAuth affordance — the same pair
  appears on Stripe, Cloudflare-observability, and Ahrefs.
- **Third-party servers do implement this properly**, but we consume them as a
  client. They are not a precedent we are deviating from.
- The chosen path (delegate verification to a managed AS) is the
  *non*-hand-rolled option, per `never-hand-roll.md`.

---

## What the MCP spec actually requires

From the 2025-11-25 specification, `basic/authorization`:

- A protected MCP server is an **OAuth 2.1 resource server**. It handles
  resource requests bearing access tokens.
- It **MUST implement OAuth 2.0 Protected Resource Metadata** (RFC 9728) to
  advertise where its authorization server lives. The document must carry an
  `authorization_servers` field with at least one entry.
- The **authorization server is a separate role** and its implementation is
  explicitly outside the scope of the specification.

That last point is what makes this tractable: we are building a resource server,
not an authorization server.

Firebase Auth cannot fill the AS role directly. It issues ID tokens to its own
SDK clients; it does not expose an OAuth authorize endpoint a third-party client
such as claude.ai could drive. Firebase remains the *user identity* (Phase 2),
reached through the AS rather than instead of it.

---

## Phase 0 — Consolidate to one source (prerequisite)

**Goal:** make tool drift structurally impossible before adding tools.

`mcp-server/` becomes the single source of truth. `mcp-server-pkg/` keeps only
what makes it a *package* — `package.json`, `build.mjs`, `LICENSE`, `assets/`,
`data/` — and its esbuild step bundles `../mcp-server/index.ts`.
`mcp-server-pkg/src/` is deleted.

This is the repo's own anti-drift doctrine applied one directory over. The
07-26 handoff put it as *"preview and PDF must agree by construction, not by
inspection"*; `sequence-viewer-shell.md` and `crossfade-primitive.md` are the
same rule for viewer chrome and transitions. Two hand-synced copies of a
directory drift every time, and these already have.

**Steps**

1. Repoint `mcp-server-pkg/build.mjs` at `../mcp-server/index.ts`.
2. Reconcile the delta first — confirm `vtg-tools.ts` is the *only* real
   difference by diffing file contents, not just names, and that nothing in
   `mcp-server-pkg/src/` is uniquely newer. If anything is, port it to
   `mcp-server/` before deleting.
3. Delete `mcp-server-pkg/src/`.
4. Rebuild; verify the bundle boots over stdio and now advertises `vtg-tools`.
5. Verify `.mcp.json`'s `tka-domain-local` still resolves and lists tools.

**Done when:** one `src/` exists, the published bundle is generated from it, and
the local stdio server exposes the same tool set as the service.

**Licensing note:** both packages already declare `Elastic-2.0`, so consolidation
does not change what ships under which license. Worth one confirmation pass with
the `license` skill after the merge, since the published bundle will then be
generated from a source tree it did not previously read — but this is a check,
not a known problem.

---

## Phase 1 — `/mcp` becomes an OAuth 2.1 resource server

**Goal:** the HTTP transport rejects unauthenticated callers, fail-closed, using
the SDK's own machinery. No act capability lands here. This closes the hole and
unblocks everything after it.

### Transport migration (forced, not stylistic)

The SDK's `requireBearerAuth` is typed as an Express `RequestHandler`
(`@modelcontextprotocol/sdk@1.25.2`,
`dist/esm/server/auth/middleware/bearerAuth.d.ts`). The HTTP branch currently
uses raw `node:http` `createServer`. Using the SDK's auth therefore requires
hosting the HTTP transport on Express.

We take the SDK's path rather than reimplementing verification against the raw
server: token verification is security-critical code and the SDK ships it.

**Stdio is untouched.** It stays unauthenticated because it is a local pipe with
no network surface, and it is how Claude Code talks to the server. Any design
that authenticates stdio breaks the local workflow for no security gain.

### The pieces

| Concern | Mechanism |
|---|---|
| Discovery | `/.well-known/oauth-protected-resource` (RFC 9728) with an `authorization_servers` entry |
| Verification | `requireBearerAuth({ verifier, resourceMetadataUrl })` mounted on `/mcp` |
| Verifier | SDK `proxyProvider`, delegating to the managed AS |
| Challenge | 401 + `WWW-Authenticate` referencing the metadata URL — the SDK emits this when `resourceMetadataUrl` is supplied |

### Invariants (these are the spec, not preferences)

1. **Fail closed.** No token, bad token, or unreachable AS ⇒ 401. There is no
   "allow when no AS is configured" fallback. Such a fallback recreates today's
   open port the first time an env var is missing in deployment, which is
   precisely the failure being fixed.
2. **Auth runs before session allocation.** Sessions are keyed by
   `mcp-session-id` and created by any POST lacking one (`index.ts` ≈99–137). If
   auth ran after, an unauthenticated caller could still allocate sessions and
   exhaust memory. The middleware must sit in front of the session branch.
3. **Auth is scoped to `/mcp`.** The metadata document itself must stay publicly
   readable — clients fetch it precisely because they are unauthenticated yet.
4. **CORS stops being `*`.** An origin allowlist replaces the wildcard. A
   wildcard with credentials is the combination that turns any visited web page
   into a client.
5. **Stdio behaviour is unchanged.** Verified by test, not by reading.

### Testing

- **Unit:** the protected-resource metadata document has the required shape and a
  non-empty `authorization_servers`.
- **Unit:** the verifier is constructed against the configured AS, and a
  malformed token is rejected rather than passed through.
- **Integration (the regression guard):** a POST to `/mcp` with no
  `Authorization` header returns 401 and allocates no session; the same POST with
  a valid token reaches the MCP server. This test *is* the proof the
  vulnerability is closed, and it is the one to write first.
- **Integration:** stdio still connects and lists tools with no token.

### Done when

`MCP_HTTP_PORT=3333` with no credentials returns 401, the same request with a
valid token succeeds, stdio is unaffected, and the integration tests above run in
CI.

---

## Phase 2 — Firestore bridge and identity (sketch)

Firebase Admin enters the MCP process. The access token verified in Phase 1
resolves to a **uid**, and that uid — not a configured constant — scopes every
read and write. That ordering matters: identity derived from the token means the
surface is correct for any user by construction, rather than hardcoded to
Austen's account and later retrofitted.

Existing precedent to respect: the server's current user data lives in a local
JSON file with atomic writes (`mcp-server/src/core/user-presets/storage.ts`).
Acts do **not** follow that pattern — they already live in Firestore and the app
is their other client.

Open, to settle in that spec: how Admin credentials are provisioned and stored;
whether reads are scoped by security rules or by admin bypass plus explicit uid
filtering (the latter is easy to get wrong and needs a single chokepoint).

## Phase 3 — The act tool surface (sketch)

Tools over the **shared pure functions**, never a reimplementation:
`planSheet` / `planBands` / `getSheetPageLayout` / `SHEET_CELL_VISIBILITY` /
`buildActSequence`. The 07-26 handoff is emphatic and correct: a third surface
that re-derives layout will drift from the preview and the PDF exactly the way
page chrome did.

Shape, from the 07-26 handoff and unchanged by this design:

- `create_act` / `get_act` / `list_acts` / `save_act`
- `act_add_sequences(ids[], atIndex?)` / `act_remove_sequence` / `act_reorder`
- `act_set_layout(patch)` — one partial-patch tool covering every toggle
- `act_set_header(patch)`, cue and note tools
- `export_act_pdf(actId)` — the real porting work; the exporter is browser-coupled
- `render_act_page(actId, pageIndex)` → PNG, so an agent can *look* at a sheet
- `animate_act(actId)` via `buildActSequence`

Then performance variants — **their own brainstorm first**, per
`brainstorming-gate.md`. Part 2 of the 07-26 handoff is a design sketch, not a
spec.

---

## Risks

| Risk | Handling |
|---|---|
| Express migration regresses the working HTTP transport | Integration test asserts a valid-token request still reaches the server; the stdio test proves the local path is untouched |
| Managed-AS vendor choice not yet made | Phase 1 depends on the *role*, not the vendor. `proxyProvider` isolates the choice to configuration; picking the vendor is the plan's first task |
| Consolidation loses work unique to `mcp-server-pkg/src/` | Step 2 diffs file contents before any deletion, and nothing is deleted until the delta is reconciled |
| Phase 1 ships no visible capability | Stated and accepted. Robustness over speed |

## Explicitly out of scope

- Performance variants (own brainstorm, own spec).
- Making the MCP server an authorization server. Declined as hand-rolled.
- Authenticating stdio.
- Any act tool before Phase 1 lands — the ordering is the point of the design.

## Related

- `docs/superpowers/specs/2026-07-26-choreo-mcp-and-performance-variants-handoff.md`
- `.claude/rules/never-hand-roll.md`, `.claude/rules/research-before-building.md`
- `.claude/rules/brainstorming-gate.md`, `.claude/rules/verification-protocol.md`
- MCP specification 2025-11-25 → `basic/authorization`
- Memory: `reference_flow_arts_mcp_deploy`, `reference_flow_arts_mcp_host`
