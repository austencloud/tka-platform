import { MicVAD } from "@ricky0123/vad-web";

import type {
  ISpeechBoundaryDetector,
  SpeechBoundaryStart,
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

  async start({
    stream,
    context,
    handlers,
    clockSeconds,
  }: SpeechBoundaryStart): Promise<void> {
    const vad = await MicVAD.new({
      getStream: async () => stream,
      // Share the capture's graph. Left to itself the library builds a second
      // AudioContext, which Chrome can hand back suspended — and a suspended
      // context never runs the worklet, so no frame is ever scored and no word
      // ever ends, while the meter on the first context moves normally.
      ...(context ? { audioContext: context } : {}),
      model: "v5",
      redemptionMs: WORD_END_SILENCE_MS,
      preSpeechPadMs: 300,
      minSpeechMs: 200,
      baseAssetPath: "/vad/",
      onnxWASMBasePath: "/vad/",
      // `MicVAD.new` starts listening on its own by default, which makes the
      // explicit start below a no-op that lands mid-initialisation and reports
      // nothing. Owning the start is what lets a failure be thrown.
      startOnLoad: false,
      onSpeechStart: () => {
        this.startedAt = clockSeconds();
        handlers.onSpeechStart();
      },
      onSpeechEnd: () => {
        handlers.onSpeechEnd({
          startSeconds: this.startedAt,
          // The callback fires after the redemption window has elapsed, so the
          // speech ended that long ago — charging it to now would put most of a
          // second of silence inside every word.
          endSeconds: clockSeconds() - WORD_END_SILENCE_MS / 1000,
        });
      },
      onVADMisfire: () => {
        // Too short to be a word. Not a failure; he cleared his throat.
      },
    });
    this.vad = vad;

    await vad.start();

    // The library records a failed start on the instance and returns normally.
    // Unread, that is a session that shows a live meter, ignores every word he
    // reads, and never says why.
    if (vad.errored) {
      throw new Error("The speech detector could not start listening.");
    }
  }

  async stop(): Promise<void> {
    this.vad?.destroy();
    this.vad = null;
  }
}
