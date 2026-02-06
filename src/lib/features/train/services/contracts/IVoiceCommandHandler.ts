/**
 * IVoiceCommandHandler - Voice Command Interface
 *
 * Handles voice recognition for hands-free training control.
 */

export interface IVoiceCommandHandler {
  /**
   * Start listening for voice commands
   * @param keyword - The keyword to listen for (e.g., "next")
   * @param callback - Called when keyword is detected
   */
  startListening(keyword: string, callback: () => void): void;

  /**
   * Stop listening for voice commands
   */
  stopListening(): void;

  /**
   * Check if voice recognition is supported in the current browser
   */
  isSupported(): boolean;

  /**
   * Get the current listening state
   */
  isListening(): boolean;
}
