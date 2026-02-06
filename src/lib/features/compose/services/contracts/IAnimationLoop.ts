/**
 * Animation Loop Interface
 *
 * Manages the requestAnimationFrame loop for smooth animation playback.
 * Handles timing, speed control, and loop/stop logic.
 */

export interface IAnimationLoop {
  /**
   * Start the animation loop
   * @param onUpdate Callback invoked each frame with deltaTime
   * @param speed Playback speed multiplier
   */
  start(onUpdate: (deltaTime: number) => void, speed: number): void;

  /**
   * Stop the animation loop
   */
  stop(): void;

  /**
   * Check if animation is currently running
   */
  isRunning(): boolean;

  /**
   * Update the playback speed
   * @param speed New speed multiplier (0.1 to 3.0)
   */
  setSpeed(speed: number): void;

  /**
   * Get current playback speed
   */
  getSpeed(): number;
}
