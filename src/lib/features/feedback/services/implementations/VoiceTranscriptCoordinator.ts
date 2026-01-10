import type { IVoiceTranscriptCoordinator } from "../contracts/IVoiceTranscriptCoordinator";

/**
 * Coordinates voice input transcription with deduplication.
 *
 * Mobile browsers re-emit entire transcripts including previously finalized segments.
 * This service tracks what has been committed to prevent duplication.
 */
export class VoiceTranscriptCoordinator implements IVoiceTranscriptCoordinator {
  private lastVoiceCommit = "";
  private interimText = "";

  processFinalTranscript(transcript: string, currentText: string): string {
    // Mobile browsers re-emit entire transcript including previously finalized segments.
    // Strip any prefix that matches what we've already committed to avoid duplication.
    let newContent = transcript.trim();

    if (this.lastVoiceCommit && newContent.startsWith(this.lastVoiceCommit)) {
      // Strip the already-committed prefix
      newContent = newContent.slice(this.lastVoiceCommit.length).trim();
    }

    // Only append if there's actually new content
    if (newContent) {
      const trimmedCurrentText = currentText.trim();
      const updatedText = trimmedCurrentText
        ? `${trimmedCurrentText} ${newContent}`
        : newContent;

      // Track the cumulative voice transcript for next deduplication
      this.lastVoiceCommit = transcript.trim();

      // Clear interim text when finalizing
      this.interimText = "";

      return updatedText;
    }

    // No new content, just clear interim
    this.interimText = "";
    return currentText;
  }

  getInterimText(): string {
    return this.interimText;
  }

  updateInterimText(transcript: string): void {
    this.interimText = transcript;
  }

  reset(): void {
    this.lastVoiceCommit = "";
    this.interimText = "";
  }
}
