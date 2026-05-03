/**
 * WebSpeechTTSProvider
 *
 * Text-to-speech using the built-in Web Speech Synthesis API.
 * Free, no API key needed, available in all modern browsers.
 *
 * Characteristics:
 * - Voice quality varies by OS (macOS > Windows > Linux)
 * - Rate tuned for comprehension (slightly slower than default)
 * - Selects a natural English voice when available
 */


export class WebSpeechTTSProvider {
  private synth: SpeechSynthesis | null = null;
  private preferredVoice: SpeechSynthesisVoice | null = null;
  private voiceLoaded = false;

  constructor() {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      this.synth = window.speechSynthesis;
      this.loadVoice();
    }
  }

  isSupported(): boolean {
    return this.synth !== null;
  }

  isSpeaking(): boolean {
    return this.synth?.speaking ?? false;
  }

  async speak(text: string): Promise<void> {
    if (!this.synth) return;

    // Cancel any ongoing speech first
    this.cancel();

    // Ensure voices are loaded
    if (!this.voiceLoaded) {
      await this.waitForVoices();
    }

    return new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);

      if (this.preferredVoice) {
        utterance.voice = this.preferredVoice;
      }

      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();

      this.synth!.speak(utterance);
    });
  }

  cancel(): void {
    this.synth?.cancel();
  }

  /**
   * Try to select a natural-sounding English voice.
   * Preference order: Google voices > "Natural" voices > first English voice.
   */
  private loadVoice(): void {
    const voices = this.synth?.getVoices() ?? [];
    this.preferredVoice = this.selectBestVoice(voices);
    if (this.preferredVoice) {
      this.voiceLoaded = true;
    }

    // Voices may load asynchronously
    this.synth?.addEventListener("voiceschanged", () => {
      const updated = this.synth?.getVoices() ?? [];
      this.preferredVoice = this.selectBestVoice(updated);
      this.voiceLoaded = true;
    });
  }

  private waitForVoices(): Promise<void> {
    if (this.voiceLoaded) return Promise.resolve();

    return new Promise<void>((resolve) => {
      const check = () => {
        const voices = this.synth?.getVoices() ?? [];
        if (voices.length > 0) {
          this.preferredVoice = this.selectBestVoice(voices);
          this.voiceLoaded = true;
          resolve();
        } else {
          setTimeout(check, 50);
        }
      };
      check();

      // Don't wait forever
      setTimeout(() => {
        this.voiceLoaded = true;
        resolve();
      }, 500);
    });
  }

  private selectBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
    const english = voices.filter((v) => v.lang.startsWith("en"));
    if (english.length === 0) return voices[0] ?? null;

    // Prefer Google's natural voices (Chrome)
    const google = english.find((v) => v.name.includes("Google") && v.name.includes("US"));
    if (google) return google;

    // Prefer voices marked as "Natural" (Edge/Windows)
    const natural = english.find((v) => v.name.includes("Natural"));
    if (natural) return natural;

    // Prefer US English
    const us = english.find((v) => v.lang === "en-US");
    if (us) return us;

    return english[0] ?? null;
  }
}
