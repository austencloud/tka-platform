export class SwipeGestureHandler {
  private _swipeY = 0;
  private _swipeStartY = 0;
  private _isSwiping = false;
  private readonly _threshold: number;

  constructor(threshold = 100) {
    this._threshold = threshold;
  }

  get swipeY(): number {
    return this._swipeY;
  }

  get isSwiping(): boolean {
    return this._isSwiping;
  }

  get threshold(): number {
    return this._threshold;
  }

  handleTouchStart(clientY: number, maxStartY = 150): boolean {
    if (clientY < maxStartY) {
      this._swipeStartY = clientY;
      this._isSwiping = true;
      return true;
    }
    return false;
  }

  handleTouchMove(clientY: number): void {
    if (!this._isSwiping) return;
    const delta = clientY - this._swipeStartY;
    if (delta > 0) {
      this._swipeY = delta;
    }
  }

  handleTouchEnd(): boolean {
    if (!this._isSwiping) return false;
    const shouldDismiss = this._swipeY > this._threshold;
    this.reset();
    return shouldDismiss;
  }

  reset(): void {
    this._swipeY = 0;
    this._swipeStartY = 0;
    this._isSwiping = false;
  }
}

export const swipeGestureHandler = new SwipeGestureHandler();
