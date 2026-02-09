/**
 * Regression testing engine for voice command sessions.
 *
 * Replays recorded transcripts through the CURRENT interpreter pipeline
 * and compares against what was originally recorded. This lets you safely
 * test regex changes: "If I add this pattern, does it fix the failures
 * WITHOUT breaking the successes?"
 *
 * The replayer does NOT dispatch commands - it only re-interprets.
 * Zero side effects.
 */

import type { VoiceSession } from "$lib/shared/voice-control/domain/voice-session-types";
import type { ReplayResult } from "../../domain/replay-types";

export interface IVoiceSessionReplayer {
  /** Replay a session's transcripts through the current interpreter and compare results */
  replaySession(session: VoiceSession): ReplayResult;
}
