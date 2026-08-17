// static/worklets/pronunciation-capture-processor.js
/**
 * Copies every input frame to the main thread. Deliberately does nothing else:
 * the audio thread must not allocate or decide, and the ring it feeds is plain
 * testable TypeScript rather than worklet code nobody can unit-test.
 */
class PronunciationCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel && channel.length > 0) {
      this.port.postMessage(channel.slice(0));
    }
    return true;
  }
}

registerProcessor("pronunciation-capture", PronunciationCaptureProcessor);
