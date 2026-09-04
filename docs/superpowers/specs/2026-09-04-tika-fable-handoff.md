# TIKA Director reliability and scene docking — Handoff (2026-09-04)

## Mission

Austen wants an in-app AI director for the 3D Stage that interprets whole requests, asks useful clarifications, and never silently changes the wrong thing. The immediate follow-up was to stop TIKA's panel covering the scene by reusing the existing Performers inspector layout. Austen interrupted final browser verification because usage was nearly exhausted and explicitly requested this handoff for Fable. Do not claim the feature is bulletproof. No further implementation is currently running.

## Done — verified

### Provider and main-chat repair

- Main merge `33b9d79357`, implementation commits `17f98a36c8` and `5029ed7c76`. Original failure was `tools.0.custom.input_schema.type: Field required`. Fixed the tool schema with an object envelope containing the discriminated response union. Uses installed AI SDK 6 `generateText` + `Output.object`, Anthropic `jsonTool` mode, and one schema-only retry. Real SDK adapter tests assert the transmitted root is an object.
- Main TIKA glossary loaded retired JSON paths and silently returned an empty glossary. It now uses canonical `GLOSSARY` and `LETTER_TYPES` from `@tka/domain`. A real Haiku chat called `get_term_definition("pro")`, got canonical content, and streamed a nonempty answer without a stream error. Live smoke is `scripts/tika/verify-chat-live.ts`; it exposes only four read-only tools, not progress writers.
- Shared model catalog: `src/lib/features/tika/domain/tika-model-catalog.ts`. Main chat defaults to Haiku 4.5; old saved Sonnet preferences migrate to Sonnet 5. Stage planning and its separate veto-only review both use Sonnet 5. DeepSeek catalog ID refreshed but NOT live-tested here.
- Current model research was checked on 2026-09-04 against https://platform.claude.com/docs/en/models/overview and https://platform.claude.com/docs/en/about-claude/pricing, plus https://api-docs.deepseek.com/updates/. Haiku 4.5 was $1 input/$5 output per million tokens; Sonnet 5 $2/$10. Do not replace these with remembered historical model IDs without checking.

### Adversarial work already performed

- Three independent agents reviewed API/provider, intent parsing, and scene/state safety. Review found actual bugs, not just suggestions: negation/subsets/extra clauses ignored by local keyword matching; reversed formation order; guessed duration; partial compound execution; stale async scene edits; unsafe undo; rewriting earlier travel/rotation; inherited travel timing overriding requested duration; history truncation losing restrictions; production endpoint auth weaker than its UI gate.
- Local interpreter now admits only complete anchored standalone commands. Conversation follow-ups always go to the model. Timing validation is a veto, never action synthesis. Production endpoint requires admin, preserves auth errors, and fails closed on reviewer/provider errors.
- Request captures the submission beat and scene revision. Close/unmount cancels; stale scene revision rejects the plan; undo is single-use and refuses to pop unrelated changes. Formation preflight happens before cast mutation, clears inherited destination travel overrides, and refuses changes that rewrite earlier motion/rotation.
- `npm test -- --run tests/unit/stage tests/unit/tika --maxWorkers=2` passed 458 tests before one additional history-bound test was added. The final focused planner/reviewer/API run passed 18 tests including that new test. These are NOT 459 independent adversarial conversations: many are existing Stage tests and parameterized parser cases.
- `scripts/tika/verify-director-live.ts` ran 14 synthetic live cases plus 3 subsequently added holdouts with Sonnet 5: 17/17 passed in those runs. Plans were validated but NEVER executed against the user's scene. Cases cover negation, scope, partial compound requests, formation order/timing, gender ambiguity, explicit relaxation, old exclusions, and delayed/multiple transitions. Haiku was inconsistent on these cases, hence choosing Sonnet for mutations. This is a small sample, not a statistical reliability result or end-to-end browser proof.
- Both planner and reviewer are separate calls to the SAME model family; do not describe this as cross-model diversity. Non-apply answers bypass the reviewer. No feedback-driven training, persistent preference learning, held-out evaluation gate, or ongoing monitoring has been implemented.

### Docking repair landed

- Main merge `8124a14819`, implementation `8df29d5af0`. Five files changed:
  - `src/lib/features/stage/StageModule.svelte`
  - `src/lib/features/stage/components/TikaDirectorPanel.svelte`
  - `src/lib/shared/3d/components/Viewer3DFullscreen.svelte`
  - `src/lib/shared/3d/components/controls/SceneControlWorkspace.svelte`
  - `src/lib/shared/3d/components/MobileSceneControls.svelte`
- TIKA no longer creates its own top-level Drawer. The Stage supplies a host-panel snippet to Viewer3DFullscreen, forwarded to SceneControlWorkspace. Bindable `hostPanelOpen` is shared through that chain. The existing inspector owns desktop reservation, camera reframing, transitions, and tool mutual exclusion. Compact uses existing BottomSheet. Mobile sheets receive a close request when the host panel opens.
- Draft and messages now live in StageModule so destroying/recreating the panel does not forget the conversation. Panel unmount and inactive state abort pending inference. Compact-sheet notification uses the existing `scene` signal so Stage makes room around its transport.
- `npm test -- --run tests/unit/3d-viewer/scene-control-layout.test.ts tests/unit/stage/tika-director-session.test.ts tests/unit/stage/stage-module-contract.test.ts --maxWorkers=2` passed 24 tests. `npm run check` passed with zero errors/warnings, including the guarded integration run.
- Browser on shipping `/stage/scene`, measured CSS 1920×1080: canvas right edge about 1225.51, TIKA panel left edge 1241.51, overlap 0. All three performers were visible in the remaining frame.
- In isolated `/test/stage`, typed an UNSENT draft, switched to Performers, then back to TIKA. TIKA disappeared during the other tool, exactly one inspector returned, and draft text survived. No live scene-changing or paid browser request was sent.
- Compact phone close and short-landscape close were exercised; awaited dialog hidden after the outro. Measured modes: 375×667 compact, 960×412 compact, 820×1180 overlay, 1440×900 overlay. No document horizontal overflow in measured phone/tablet/laptop states. Desktop docking above was verified separately.

## Believed done — unverified

- Complete seven-viewport visual pass is NOT finished. 2560×1440 reached docked mode, then the development page reloaded before the final panel measurement/screenshot. 3840×2160, reduced-motion behavior, and 200% zoom/reflow remain unverified.
- The screenshot backend produced stale duplicate fragments and black padding while switching viewport overrides. DOM showed one panel/composer, not duplicate components. Do not mistake these captures for clean visual proof. Normal-size desktop composition was directly visible; responsive geometry is stronger evidence than those corrupted captures.
- Pending-request cancellation during tool switching is code-backed and existing session tests pass, but no delayed real-browser request test was completed after moving the panel. Conversation history persistence across close is code-backed; only unsent draft persistence was browser-tested this turn.
- No claim of broad adversarial reliability, repeated-run stability, or fully browser-driven plan execution is justified yet.

## In flight

- All implementation above is committed and integrated into local main. Both task worktrees and branches were removed by `npm run wt:finish` after integration. No task-owned Vite server was started. No unified command remains running from this task.
- Handoff document is the only new work in this final handoff step; it will be integrated locally as a documentation-only change.
- Unrelated primary changes, preserved throughout: modified `scripts/audit-frame-budget.mjs`; untracked `docs/superpowers/specs/flow-fest-sim/austen-site-markers.json`. Git also warns about nonexistent `worktreestka-platformmandala-parity-6node_modules/`; not ours, do not clean it up.
- The temporary test tab was automatically closed when the turn was interrupted, removing its per-tab emulation. The browser viewport override was successfully reset during handoff. Austen's original `/stage/scene` tab was not closed. No usage reset was redeemed.

## Loose ends (ranked)

1. Finish docking verification with stable browser conditions. Read current code and AGENTS first; changes are already on main. Use `/test/stage` to isolate the real StageModule from app-shell reloads, then confirm shipping `/stage/scene`. Recheck 2560×1440 and 3840×2160 open/closed, reduced motion, zoom/reflow, and compact input reachability by scrolling. Screenshot duplication during emulation needs a clean capture path before claiming a full visual pass.
2. Confirm the intended intermediate-width behavior with Austen if necessary. This patch deliberately reuses existing breakpoints: `scene-control-layout.ts` docks only when workspace width ≥1680 and at least 960 px of stage remains. Tablet/laptop still overlay; compact sheets also cover part of the scene. If Austen wants ZERO occlusion at every width, the current patch does not deliver that. Extend the shared layout owner rather than creating a TIKA-only sizing system.
3. Test async close/tool-switch/reopen while a delayed request is outstanding, history retention across panel remounts, stale undo, playback continuing during inference, and resize across compact/desktop during a request. Ensure no old request changes the scene.
4. Deepen AI evaluations rather than adding more assurances. Add repeated paraphrases and multi-turn corrections, explicit removal versus ambiguous acknowledgement of exclusions, prompt injection in scene labels/history, unsupported mixed requests, and failures/cancellation. Assert scene diffs and unchanged state on rejection, not just response kind. Keep holdouts separate from prompt examples. The previous 17 passes are a baseline, not a release threshold.
5. Make any feedback learning explicit, versioned and evaluated before adopting it. There is no existing self-training loop to resume.

## Decisions already made

- Austen, 2026-09-04: reuse the existing Performers-panel layout strategy so Direct with TIKA does not cover the scene on wide layouts; keep this shared pattern going.
- Austen asked how deep the adversarial review went and wants it pushed hard. I explicitly corrected the earlier headline: three code reviewers and 17 live cases, not hundreds of independent model trials.
- Cheap main chat remains Haiku. Scene mutation uses Sonnet 5 because observed Haiku intent/clarification behavior was inconsistent. The independent reviewer can only accept or veto; it cannot invent actions.
- Gender-constrained avatars, subset casting, item exclusions and multiple/delayed transitions remain unsupported by current action capabilities. Missing timing should clarify. Earlier authored movement is protected by rejecting destructive insertions, including some mid-transition requests.
- User's final request is to hand off promptly to Fable due usage limits, not continue debugging or consume a reset credit.

## Gotchas

- Primary `E:/tka-platform` is reserved for read-only investigation and guarded integration. New modifications need a dedicated `codex/...` worktree based on current main. Use exact-path commits and `npm run wt:finish -- <branch> --route /stage/scene`. Other agents frequently move main and temporarily hold the integration lock; wait and merge latest main, never remove their lock.
- Port 5173 belongs to Austen. Never restart or kill it. Probe IPv6 with `curl.exe -k -g "https://[::1]:5173/"`. Respect resource limits: one machine-wide svelte-check and at most two agent Vite servers. At last inspection another task's server on 5426 and an ocean-parity preview were running; neither is ours.
- Run Vitest WITH repo config (`npm test -- --run ...`), not bare `npx vitest`. Bare invocation caused misleading DOMPurify, SDK module-resolution and Stage failures; configured runs passed.
- In-app browser's saved zoom was 80%. A physical override 1536×864 measured CSS 1920×1080; 300×534 measured CSS 375×667. Always measure `innerWidth/innerHeight`. Prefer per-tab emulation and restore it; browser-level viewport overrides were also briefly tried and reset.
- The live dev page repeatedly reloaded as other work integrated, interrupting checks. Browser logs also showed Babylon `TypeError: Cannot read properties of undefined (reading 'isReady')` in `checkMaterialsReady` during reload/scene warm-up. It was not diagnosed or attributed to this patch. Later frames rendered. Don't casually label it fixed or restart the shared server.
- Opt-in live scripts require `--live` and synthetic data only. Primary `.env` contains the Anthropic key; an EMPTY process env variable prevented `node --env-file` from overriding it. Prior tests used Node `parseEnv(readFileSync(...))` to assign only `process.env.ANTHROPIC_API_KEY` in memory before importing the smoke script. Never print, copy into artifacts, or commit the key. Live scripts incur provider cost; no DeepSeek key test was done.
- Use model/provider tests in `tests/unit/stage/tika-director-*.test.ts`, chat tests in `tests/unit/tika/`, and the opt-in smoke scripts as entry points. Do not re-run unrelated full suites merely to inflate a count.
