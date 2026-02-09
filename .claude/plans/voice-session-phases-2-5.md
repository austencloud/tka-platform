# Voice Session Analysis System - Phases 2-5

## CONTEXT: What Exists (Phase 1 - COMPLETE)

Phase 1 built the recording + copy-for-AI foundation. A future agent should understand what already exists before building on it.

### Files created in Phase 1 (18 files, ~2,945 lines):

**Domain types:**
- `src/lib/shared/voice-control/domain/voice-session-types.ts` (125 lines) - Core types: ResolutionTier, VoiceSessionEvent, VoiceSession, VoiceSessionPreview, VoiceSessionStats, LLMResolutionDetails, ChatResponseDetails

**Session recorder (shared, used by HeyTikaListener):**
- `src/lib/shared/voice-control/services/contracts/IVoiceSessionRecorder.ts` (45 lines) - Interface: startSession(), endSession(), isRecording(), getCurrentSession(), recordEvent(params)
- `src/lib/shared/voice-control/services/implementations/VoiceSessionRecorder.ts` (188 lines) - In-memory event accumulation, computeStats() on endSession(), ID format: vs_{timestamp36}_{random8}

**Session formatter (feature module):**
- `src/lib/features/voice-sessions/services/contracts/IVoiceSessionFormatter.ts` (15 lines)
- `src/lib/features/voice-sessions/services/implementations/VoiceSessionFormatter.ts` (162 lines) - Produces structured markdown for Claude analysis with summary table, tier breakdown, per-event detail, and analysis prompt

**Session repository (Firebase):**
- `src/lib/features/voice-sessions/services/contracts/IVoiceSessionRepository.ts` (30 lines)
- `src/lib/features/voice-sessions/services/implementations/VoiceSessionRepository.ts` (234 lines) - Firestore at users/{userId}/voiceSessions/{sessionId}, sanitizeForFirestore(), VoiceSessionError
- `src/lib/features/voice-sessions/data/firestore-paths.ts` (44 lines) - Path helpers + limits (200 max sessions, 20 default query limit)

**DI registration:**
- `src/lib/shared/di/containers/voice-session-container.ts` (20 lines) - Registers voiceSessionRecorder, voiceSessionFormatter, voiceSessionRepository
- `src/lib/shared/di/index.ts` - Modified: imports createVoiceSessionContainer, instantiates with browser guard, adds to composed container

**HeyTikaListener instrumentation:**
- `src/lib/shared/voice-control/components/HeyTikaListener.svelte` - Modified: resolves sessionRecorder from DI, calls recordEvent() at 5 points: Tier 1 match, Tier 2 success, Tier 2 failure, Tier 3 chat, unresolved. Each captures transcript, confidence, tier, command, result, context (module/tab), latency via performance.now()

**VoiceControlLab UI:**
- `src/lib/features/lab/tabs/VoiceControlLab.svelte` - Modified: Record/Stop toggle, live event count + duration, "Copy for AI" button (clipboard markdown), "Save Session" button (Firestore), post-session summary card (events/success/failed/unresolved/avg latency)

**Recording flow:** HeyTikaListener calls sessionRecorder.recordEvent() at each tier. VoiceSessionRecorder accumulates in memory. endSession() computes stats. VoiceControlLab calls copySession()/saveSession().

### Key patterns to follow:
- ITI DI containers (createContainer pattern, see code-style.md)
- Service naming: no "Service" suffix. Use Recorder, Formatter, Repository, Analyzer, Replayer
- Interface + Implementation in services/contracts/ and services/implementations/
- Svelte 5 runes ($state, $derived, $effect)
- Firebase patterns: authState.effectiveUserId, getFirestoreInstance(), sanitizeForFirestore
- Lab tabs: register in LabModule.svelte tabComponents map + LAB_TABS in tab-definitions.ts

---

## PHASE 2: Session Browser + Analysis

**Goal:** Browse saved sessions, expand for detail, copy/delete. Add cross-session pattern analysis.

### 2.1 Voice Session Browser Lab Tab

New files:
- `src/lib/features/voice-sessions/components/VoiceSessionBrowser.svelte` - Main browser component. List past sessions from Firebase, expand for detail, copy/delete actions. Uses voiceSessionRepository.listSessions() for previews, voiceSessionRepository.getSession() for full detail. Paginated (20 per page). Sort by date desc.
- `src/lib/features/voice-sessions/components/VoiceSessionCard.svelte` - Preview card showing: date, duration, event count, success rate bar, tier breakdown chips. Click to expand.
- `src/lib/features/voice-sessions/components/VoiceSessionDetail.svelte` - Full event timeline. Each event shows: timestamp offset, transcript, tier badge (color-coded: green=T1, blue=T2, purple=T3, red=unresolved), interpreted command, dispatch result, latency. Copy-for-AI button on full session. Delete button with confirmation.

Register as new lab tab:
- Add to `src/lib/features/lab/LabModule.svelte` tabComponents: `"voice-sessions": () => import("$lib/features/voice-sessions/components/VoiceSessionBrowser.svelte")`
- Add to `src/lib/shared/navigation/config/tab-definitions.ts` LAB_TABS array: `{ id: "voice-sessions", label: "Voice Sessions", icon: "fa-history" }`

### 2.2 Pattern Analyzer

New files:
- `src/lib/features/voice-sessions/services/contracts/IVoiceSessionAnalyzer.ts` - Interface: analyzeSessions(sessions: VoiceSession[]): SessionAnalysis. Returns: topFailingTranscripts (frequency + tier), tier2Candidates (transcripts that hit T2 with same interpretation 3+ times, these should become T1 regex), successRateTrend (per-session over time), latencyByTier (averages across sessions), unresolvedPatterns (common unresolved transcripts)
- `src/lib/features/voice-sessions/services/implementations/VoiceSessionAnalyzer.ts` - Pure computation, no side effects. Aggregates across multiple sessions. Key method: findTier2Candidates() identifies transcripts that consistently resolve to the same command via LLM, these are prime candidates for new regex patterns (Phase 4 automates this).

Register in voice-session-container.ts: `voiceSessionAnalyzer: () => new VoiceSessionAnalyzer()`

### 2.3 Claude Skill for Voice Review

New file:
- `.claude/commands/voice-review.md` - Slash command that mirrors /tika skill: fetches recent voice sessions from Firebase, formats them with VoiceSessionFormatter, asks Claude to: (1) identify recurring failure patterns, (2) suggest new regex patterns for frequent T2 hits, (3) rate overall voice UX, (4) flag latency concerns. Use node scripts/fetch-feedback.js pattern for any issues found.

**Phase 2 verification:** TypeScript check (npm run check), build (npm run build), manually browse sessions in the lab tab, copy a session and verify markdown output.

---

## PHASE 3: Replay Engine (Regression Testing)

**Goal:** Replay recorded transcripts through the current interpreter pipeline WITHOUT a microphone. Compare results against what was originally recorded. This enables safe testing of new regex patterns.

New files:
- `src/lib/features/voice-sessions/services/contracts/IVoiceSessionReplayer.ts` - Interface: replaySession(session: VoiceSession): ReplayResult. Returns per-event comparison: original tier/command/result vs current tier/command/result. Diff classification: SAME (identical), IMPROVED (was unresolved, now resolved), REGRESSED (was resolved, now unresolved/different), CHANGED (different interpretation).
- `src/lib/features/voice-sessions/services/implementations/VoiceSessionReplayer.ts` - Takes a VoiceSession, re-runs each event.transcript through commandInterpreter.interpret() with the recorded context. Does NOT call dispatcher (no side effects). Compares: (1) Did the same tier handle it? (2) Did it produce the same command? (3) Would the same dispatch result occur? Depends on: ICommandInterpreter from DI.
- `src/lib/features/voice-sessions/domain/replay-types.ts` - Types: ReplayResult, ReplayEventComparison (original vs current), ReplayDiffType (SAME | IMPROVED | REGRESSED | CHANGED), ReplaySessionSummary (improved count, regressed count, changed count, unchanged count)

Register in voice-session-container.ts. Needs commandInterpreter from voice-control-container, so update createVoiceSessionContainer to accept deps: `{ commandInterpreter: ICommandInterpreter }`.

UI integration:
- Add "Replay" button to VoiceSessionDetail.svelte. Shows side-by-side diff: original interpretation (left) vs current interpretation (right). Color-coded: green=improved, red=regressed, yellow=changed, gray=same.
- Add replay summary card to VoiceSessionBrowser.svelte showing aggregate regression status.

**Use cases this enables:**
- "If I add this regex pattern, does it fix the failures WITHOUT breaking the successes?"
- "Compare T1 hit rate before vs after a change"
- "Find regressions: commands that used to work but now dont"

**Phase 3 verification:** Record a session, modify a regex pattern in one of the sub-interpreters (e.g., navigation-interpreter.ts), replay the session, verify the diff shows the changed behavior correctly.

---

## PHASE 4: Tier Promotion Engine (Auto-Generate Regex)

**Goal:** When the analyzer detects transcripts that consistently hit T2 LLM with the same interpretation, auto-generate candidate T1 regex patterns. Claude reviews candidates via the /voice-review skill.

New files:
- `src/lib/features/voice-sessions/services/contracts/ITierPromotionEngine.ts` - Interface: findPromotionCandidates(sessions: VoiceSession[]): PromotionCandidate[]. Each candidate has: transcript pattern (regex), target command (category + action + target), evidence (list of sessions where this transcript hit T2 with this interpretation), confidence score, suggested sub-interpreter to add it to.
- `src/lib/features/voice-sessions/services/implementations/TierPromotionEngine.ts` - Analyzes T2 events across sessions. Groups by normalized transcript to interpreted command. If a transcript pattern resolves to the same command 5+ times via T2 LLM, it becomes a promotion candidate. Generates regex pattern from the transcript variants (e.g., "go to compose" / "open compose" / "switch to compose" becomes a regex like /(?:go to|open|switch to)\s+compose/i). Identifies which existing sub-interpreter handles that command category.
- `src/lib/features/voice-sessions/domain/promotion-types.ts` - Types: PromotionCandidate, PromotionEvidence, PromotionStatus (pending | approved | rejected | applied)

**This does NOT auto-apply patterns.** It generates candidates for human/Claude review. The /voice-review skill presents candidates and Claude suggests the exact regex code to add to the appropriate sub-interpreter file.

Sub-interpreter files that would receive new patterns:
- `src/lib/shared/voice-control/services/implementations/interpreters/NavigationInterpreter.ts`
- `src/lib/shared/voice-control/services/implementations/interpreters/SettingsInterpreter.ts`
- `src/lib/shared/voice-control/services/implementations/interpreters/PlaybackInterpreter.ts`
- `src/lib/shared/voice-control/services/implementations/interpreters/UIInterpreter.ts`
- (and any other sub-interpreters in that directory)

**Phase 4 verification:** Accumulate 10+ sessions with repeated T2 hits for the same command. Run promotion engine. Verify it generates sensible regex candidates. Add one to a sub-interpreter. Replay old sessions to confirm improvement without regressions.

---

## PHASE 5: Always-On Recording (Continuous Improvement)

**Goal:** Session recording runs by default for all authenticated users, not just in the lab. Every voice interaction feeds into the aggregate analysis. Privacy-respecting: transcripts and interpretation results only, no audio.

Implementation:
- Modify HeyTikaListener.svelte to auto-start recording when command mode is entered and auto-stop when it exits. Currently the recorder just tracks events when recording is true. Add: auto-start on enterCommandMode(), auto-end on exitCommandMode() or detector stop.
- Add a user preference in settings to opt out of session recording (default: on). Store in user settings (Firebase).
- Auto-save sessions on endSession(), dont require manual "Save" click. Use voiceSessionRepository.saveSession() directly from HeyTikaListener.
- Add session count limit enforcement: if user exceeds MAX_SESSIONS_PER_USER (200), auto-delete oldest sessions on save.
- Add aggregate dashboard to VoiceSessionBrowser showing: total sessions, total commands, success rate over time, most common failures, T2 candidates.

**Phase 5 verification:** Use the app normally with voice control. Navigate to voice-sessions lab tab. Verify sessions appear automatically without manual recording. Verify opt-out preference works. Verify old sessions are cleaned up when limit is exceeded.

---

## ARCHITECTURAL DECISIONS (For Future Agent Reference)

1. **Session recorder lives in shared/voice-control** (not features/) because HeyTikaListener needs it directly. The formatter, repository, analyzer, replayer, and promotion engine live in features/voice-sessions/ because they are feature-specific.

2. **Data model is intentionally over-capturing.** VoiceSessionEvent stores more than Phase 1 needs (LLM details, chat details) because Phases 2-4 analyze this data. No schema migrations needed.

3. **The replay engine does NOT dispatch commands.** It only re-runs interpretation (commandInterpreter.interpret()) and compares results. This makes it safe to run against any session without side effects.

4. **Firebase structure:** users/{userId}/voiceSessions/{sessionId}. Sessions are small (1-5KB each). Even with always-on recording, storage is negligible.

5. **Follow existing TIKA patterns.** The TIKA chat system (src/lib/features/tika/) has session persistence, "Copy for AI", review workflow. Voice sessions follow the same architectural patterns but with different data models.

6. **DI container pattern:** All new services get interface + implementation + container registration. See code-style.md and service-naming.md for naming conventions.

---

## THE 10-YEAR VISION

The closed feedback loop that makes this generational:

```
Record sessions -> Identify patterns -> Generate fixes -> Test against history -> Deploy -> Record again
```

Phase 1: Record sessions, copy to Claude, find whats broken (DONE)
Phase 2: Pattern analysis reveals WHY commands fail (browser + analyzer)
Phase 3: Replay engine tests proposed fixes against historical data (regression testing)
Phase 4: Auto-generation of regex patterns from recurring T2 LLM hits (promotion engine)
Phase 5: Continuous monitoring catches regressions (always-on recording)

Each phase builds on the data model from Phase 1. The VoiceSessionEvent captures everything, so future phases never need schema migrations.
