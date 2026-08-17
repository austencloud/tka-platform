import { MicVAD } from "@ricky0123/vad-web";

import type {
  ISpeechBoundaryDetector,
  SpeechBoundaryHandlers,
} from "../contracts/ISpeechBoundaryDetector";

/**
 * How long non-speech must hold before a word counts as finished.
 *
 * The library default is 1400 ms, tuned for conversational turn-taking. This is
 * a list of short words, and 1400 ms of dead air between each is a worse
 * session than a rare early advance — which the offline aligner catches anyway,
 * because it has the transcript.
 */
const WORD_END_SILENCE_MS = 700;

export class SileroBoundaryDetector implements ISpeechBoundaryDetector {
  private vad: MicVAD | null = null;
  private startedAt = 0;

  async start(
    stream: MediaStream,
    handlers: SpeechBoundaryHandlers,
    clock: () => number
  ): Promise<void> {
    this.vad = await MicVAD.new({
      getStream: async () => stream,
      model: "v5",
      redemptionMs: WORD_END_SILENCE_MS,
      preSpeechPadMs: 300,
      minSpeechMs: 200,
      baseAssetPath: "/vad/",
      onnxWASMBasePath: "/vad/",
      onSpeechStart: () => {
        this.startedAt = clock();
        handlers.onSpeechStart();
      },
      onSpeechEnd: () => {
        handlers.onSpeechEnd({
          startSeconds: this.startedAt,
          // The callback fires after the redemption window has elapsed, so the
          // speech ended that long ago — charging it to now would put most of a
          // second of silence inside every word.
          endSeconds: clock() - WORD_END_SILENCE_MS / 1000,
        });
      },
      onVADMisfire: () => {
        // Too short to be a word. Not a failure; he cleared his throat.
      },
    });

    this.vad.start();
  }

  async stop(): Promise<void> {
    this.vad?.destroy();
    this.vad = null;
  }
}
