# MCP Host: Deploy the Loop-Closure Engine Fix — Handoff (2026-07-17)

## Mission

Get the sequence-engine loop-closure fix (commit `c9c7f735eb`, design:
`2026-07-16-loop-closure-start-draw-fix-design.md`) actually LOADED by the
running "Flow Arts Knowledge" MCP server. The fix is merged and pushed on
branch `feat/generate-tour-per-account-sync`; the running server still serves
pre-fix code. This session (on the C: laptop) proved the server does not run
on the C: machine at all - it runs on the machine you are on now (Austen's
home desktop), under the SYSTEM account. You have access to the process; the
laptop session did not. Deploying this unblocks fully-random LOOP generation
(the guide example-pools rollout currently works around it, see
`2026-07-16-guide-example-pools-rollout.md` section 8a).

## Done - verified

- **Fix implemented + committed:** `c9c7f735eb` on
  `feat/generate-tour-per-account-sync`,
  `packages/sequence-engine/src/generation/builder/SequenceBuilder.ts`
  (`enumerateLoopStartTargets` + closure-valid start draw + closure guard).
  Evidence recorded in the fix design doc: engine test suite passed (86
  tests) and the repro words generated on every attempt when driven against
  the fixed engine directly.
- **C:-machine dist rebuilt and resolvable:** `pnpm build` (tsc -b) in
  `packages/sequence-engine` on 2026-07-17; grep proof:
  `enumerateLoopStartTargets` present in
  `dist/generation/builder/SequenceBuilder.js`, and
  `mcp-server/node_modules/@tka/sequence-engine` is a SYMLINK to
  `packages/sequence-engine`, so the compiled fix is exactly what a freshly
  started server would import. (This matters for the desktop too - see
  Gotchas: symlinked dep means build-then-restart is the whole deploy.)
- **Running server is still pre-fix:** `generate_sequence(word: "ΔZΩX",
  loopType: "swapped", constraintPreset: "smooth")` failed on 2026-07-17,
  AFTER a full Claude Code restart, with the exact pre-fix signature:
  `Position pair alpha3 -> alpha3 not valid for swapped LOOP` (same pair every
  attempt = the deterministic pre-fix start draw).
- **Server does NOT run on the C: laptop** (why restarts there changed
  nothing). Evidence chain, all 2026-07-17:
  - No flow-arts/tka process in a full `Win32_Process` listing (node, tsx,
    bun, plus a commandline regex sweep).
  - No matching Windows service (`Win32_Service` path scan) and no matching
    scheduled task.
  - No `claude_desktop_config.json`, no desktop extensions dir, no
    `mcpServers` entry in `~/.claude.json` on that machine.
  - `Temp\tka-mcp` (where `saveAndOpenImage` writes; see
    `mcp-server/src/shared/server-context.ts` `resolveTempDir`) does not
    exist under the laptop user's profile.
  - The tool's own output names the real location: generated PNGs land in
    `C:\WINDOWS\system32\config\systemprofile\AppData\Local\Temp\tka-mcp\`
    - a Windows SYSTEM-account profile on the machine that hosts the server.
- **Guide example-pools wave 1 shipped despite the bug** (context, not your
  job): specs + 31 verified candidates `9ea909640a`, adapter factory
  `f80beb4e1a` (115/115 tests), page wiring `91eb92418e` (194/194 guide
  tests). None of the wave-1 draws happened to hit the closure bug.

## Believed done - unverified

- Nothing. Everything claimed above carries its evidence; the deploy itself
  is entirely not-started (that is this handoff's mission).

## In flight

- Nothing uncommitted. `feat/generate-tour-per-account-sync` is pushed
  through `91eb92418e` and contains everything referenced here.

## Loose ends (ranked)

1. **Find how the server runs on this machine.** It executes as SYSTEM
   (temp-path proof above), so look for: a Windows service (non-obvious
   name), a scheduled task running as SYSTEM, or an NSSM/`sc`-wrapped node
   process. `Get-CimInstance Win32_Process | ? { $_.CommandLine -match
   'flow|tka|mcp' }` from an ELEVATED shell (unelevated shells cannot read
   SYSTEM processes' command lines - this is exactly how the laptop session
   nearly missed it). The server package is `flow-arts-knowledge-mcp`
   (`mcp-server/` in the repo; `main: dist/index.js`, `dev: tsx index.ts`).
2. **Deploy the fix:** in the checkout the server runs from, `git fetch` and
   pull/merge `feat/generate-tour-per-account-sync` (or cherry-pick
   `c9c7f735eb` if that checkout tracks a different line), then
   `pnpm build` in `packages/sequence-engine`, then restart the server
   process/service.
3. **Verify with the repro, through MCP:** `generate_sequence(word: "ΔZΩX",
   loopType: "swapped", constraintPreset: "smooth")` with NO
   startPosition/endPosition, several times. Pre-fix: deterministic
   `Position pair X -> X not valid for swapped LOOP` error. Post-fix: it
   generates. Run it ~5x (the bug was deterministic per turn-allocation, but
   don't accept a single lucky pass).
4. **Write down what you found** so no future session repeats this forensics:
   a memory file (`reference_flow_arts_mcp_host.md`) recording which machine,
   how the process is registered, how to restart it, and which checkout it
   serves from. Link it from MEMORY.md.
5. If the server checkout's `mcp-server` start path turns out to BUNDLE the
   engine (e.g. it runs `mcp-server-pkg`, `@austencloud/tka-domain-mcp`,
   whose `build.mjs` bundles deps) rather than symlinking `mcp-server/`,
   rebuild THAT package too - symbol check:
   `grep -r enumerateLoopStartTargets <whatever dist it runs>` must hit
   before you restart.

## Decisions already made

- Austen (2026-07-17): pass this to the desktop agent "who can pick it up
  with access to all that stuff" - i.e., deploy on the host rather than keep
  working around the bug from the laptop.
- The pools rollout does NOT block on this. Wave 1 shipped with the
  documented fallback (probe `validate_loop_options`, force positions);
  future waves prefer the fixed engine but can fall back the same way.
- Nomenclature: a "step" is one pictograph in a sequence, never "beat"
  (MCP wire format still emits `beat:` keys until the nomenclature server
  phase - do not "fix" that as a side effect of this deploy; it is specced
  separately in `2026-07-16-beat-to-step-nomenclature-design.md`).

## Gotchas

- **Restarting Claude Code does not restart this server.** It is a claude.ai
  connector backed by an independently-running SYSTEM process. Two laptop
  restarts proved this the hard way.
- **Unelevated process listings hide SYSTEM command lines.** Elevate before
  concluding "no such process".
- **The deterministic failure signature** is the tell: the SAME position pair
  in the error on every retry. The old code drew a random start, computed
  turn allocation OUTSIDE the retry loop, and re-failed identically 500
  times. If you see rotating pairs across retries, you are already on new
  code and something else is wrong.
- **The engine dep is a symlink** (`mcp-server/node_modules/@tka/sequence-engine
  -> ../packages/sequence-engine`) in the laptop checkout and, per pnpm
  `file:` protocol in `mcp-server/package.json`, most likely on the desktop
  too - meaning no `pnpm install` is needed after pulling: build + restart is
  the whole deploy. Confirm with `ls -la node_modules/@tka/` before assuming.
- **`mcp-server/dist` is stale by design** (Feb 2026): the `dev` script runs
  `tsx index.ts`, compiling mcp-server's own TS on the fly. Only the ENGINE
  package needs a build; if the desktop launches via `node dist/index.js`
  instead, rebuild mcp-server as well (`npm run build` there, plain tsc).
- **Canvas is broken on the C: laptop** (pnpm 10 blocks build scripts;
  `reference_canvas_native_broken_c_machine.md`), which is consistent with
  the server intentionally living on the desktop. Do not try to relocate the
  server to the laptop as a "fix".

## Related

- Fix design + adversarial verification:
  `docs/superpowers/specs/2026-07-16-loop-closure-start-draw-fix-design.md`
- Rollout status + Phase 0 findings:
  `docs/superpowers/specs/2026-07-16-guide-example-pools-rollout.md` (8a/8b)
- Wave 1 data: `docs/superpowers/specs/2026-07-17-guide-example-pools-wave1-data.json`
