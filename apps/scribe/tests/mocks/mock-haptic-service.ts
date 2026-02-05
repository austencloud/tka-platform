/**
 * Mock Haptic Feedback Service for Testing
 *
 * Tracks haptic feedback calls without actually triggering device vibration.
 */

import { injectable } from "inversify";

export interface IHapticFeedbackService {
  trigger(type: "selection" | "success" | "error" | "impact"): void;
  isSupported(): boolean;
}

@injectable()
export class MockHapticFeedbackService implements IHapticFeedbackService {
  private calls: Array<{ type: string; timestamp: number }> = [];
  private _isSupported = true;

  trigger(type: "selection" | "success" | "error" | "impact"): void {
    this.calls.push({ type, timestamp: Date.now() });
  }

  isSupported(): boolean {
    return this._isSupported;
  }

  // Test helpers
  getCalls() {
    return [...this.calls];
  }

  getCallCount(): number {
    return this.calls.length;
  }

  getCallsOfType(type: string): number {
    return this.calls.filter((call) => call.type === type).length;
  }

  clear(): void {
    this.calls = [];
  }

  setSupported(supported: boolean): void {
    this._isSupported = supported;
  }
}
