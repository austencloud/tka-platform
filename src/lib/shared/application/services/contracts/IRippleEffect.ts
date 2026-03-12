export interface RippleOptions {
  duration?: number;
  color?: string;
  opacity?: number;
}

export interface IRippleEffect {
  createRipple(
    element: HTMLElement,
    event: MouseEvent | TouchEvent,
    options?: RippleOptions
  ): void;

  attachRipple(element: HTMLElement, options?: RippleOptions): () => void;
}
