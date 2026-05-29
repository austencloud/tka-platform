/**
 * VoiceSessionRecorder
 *
 * In-memory recorder for voice command sessions.
 * Holds events during a session and computes aggregate stats on finalization.
 *
 * Lifecycle:
 *   startSession() → recordEvent() x N → endSession() → VoiceSession
 */

import type {
  VoiceSession,
  VoiceSessionEvent,
  VoiceSessionStats,
  ResolutionTier,
} from "../domain/voice-session-types";
import type { VoiceCommandCategory } from "../domain/voice-command-types";
import type { RecordEventParams, SessionEndedCallback } from "./contracts/types";

export class VoiceSessionRecorder {
  private recording = false;
  private sessionStartedAt: Date | null = null;
  private sessionStartMs = 0;
  private events: VoiceSessionEvent[] = [];
  private eventIndex = 0;
  private sessionEndedCallback: SessionEndedCallback | null = null;

  startSession(): void {
    if (this.recording) return;

    this.recording = true;
    this.sessionStartedAt = new Date();
    this.sessionStartMs = performance.now();
    this.events = [];
    this.eventIndex = 0;
  }

  endSession(): VoiceSession | null {
    if (!this.recording || !this.sessionStartedAt) return null;

    const endedAt = new Date();
    const durationMs = Math.round(performance.now() - this.sessionStartMs);

    const session: VoiceSession = {
      id: this.generateId(),
      userId: "", // Filled by repository on save
      startedAt: this.sessionStartedAt,
      endedAt,
      durationMs,
      events: [...this.events],
      stats: this.computeStats(this.events),
    };

    this.reset();
    this.sessionEndedCallback?.(session);
    return session;
  }

  isRecording(): boolean {
    return this.recording;
  }

  getCurrentSession(): { events: VoiceSessionEvent[]; startedAt: Date } | null {
    if (!this.recording || !this.sessionStartedAt) return null;
    return {
      events: [...this.events],
      startedAt: this.sessionStartedAt,
    };
  }

  onSessionEnded(callback: SessionEndedCallback | null): void {
    this.sessionEndedCallback = callback;
  }

  recordEvent(params: RecordEventParams): void {
    if (!this.recording) return;

    const event: VoiceSessionEvent = {
      index: this.eventIndex++,
      offsetMs: Math.round(performance.now() - this.sessionStartMs),
      transcript: params.transcript,
      speechConfidence: params.speechConfidence,
      tier: params.tier,
      interpretedCommand: params.interpretedCommand,
      dispatchResult: params.dispatchResult,
      context: params.context,
      latencyMs: params.latencyMs,
    };

    if (params.llmDetails) {
      event.llmDetails = params.llmDetails;
    }

    if (params.chatDetails) {
      event.chatDetails = {
        responseText: params.chatDetails.responseText.slice(0, 500),
        spokeTTS: params.chatDetails.spokeTTS,
      };
    }

    this.events.push(event);
  }

  private reset(): void {
    this.recording = false;
    this.sessionStartedAt = null;
    this.sessionStartMs = 0;
    this.events = [];
    this.eventIndex = 0;
  }

  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 10);
    return `vs_${timestamp}_${random}`;
  }

  private computeStats(events: VoiceSessionEvent[]): VoiceSessionStats {
    const tierBreakdown: Record<ResolutionTier, number> = {
      tier1_regex: 0,
      tier2_llm: 0,
      tier3_chat: 0,
      unresolved: 0,
    };

    const categoryBreakdown: Record<VoiceCommandCategory | "none", number> = {
      navigation: 0,
      settings: 0,
      playback: 0,
      create: 0,
      generator: 0,
      sequence: 0,
      ui: 0,
      search: 0,
      prop: 0,
      system: 0,
      none: 0,
    };

    let successCount = 0;
    let failureCount = 0;
    let unresolvedCount = 0;
    let totalLatency = 0;

    const latencyByTier: Partial<Record<ResolutionTier, { sum: number; count: number }>> = {};

    for (const event of events) {
      tierBreakdown[event.tier]++;

      if (event.interpretedCommand) {
        categoryBreakdown[event.interpretedCommand.category]++;
      } else {
        categoryBreakdown.none++;
      }

      if (event.tier === "unresolved") {
        unresolvedCount++;
      } else if (event.dispatchResult?.success || event.tier === "tier3_chat") {
        successCount++;
      } else {
        failureCount++;
      }

      totalLatency += event.latencyMs;

      if (!latencyByTier[event.tier]) {
        latencyByTier[event.tier] = { sum: 0, count: 0 };
      }
      latencyByTier[event.tier]!.sum += event.latencyMs;
      latencyByTier[event.tier]!.count++;
    }

    const avgLatencyByTier: Partial<Record<ResolutionTier, number>> = {};
    for (const [tier, data] of Object.entries(latencyByTier)) {
      if (data && data.count > 0) {
        avgLatencyByTier[tier as ResolutionTier] = Math.round(data.sum / data.count);
      }
    }

    return {
      totalEvents: events.length,
      successCount,
      failureCount,
      unresolvedCount,
      tierBreakdown,
      categoryBreakdown,
      avgLatencyMs: events.length > 0 ? Math.round(totalLatency / events.length) : 0,
      avgLatencyByTier,
    };
  }
}
