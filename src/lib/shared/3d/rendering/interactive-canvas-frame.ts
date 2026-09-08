export type InteractiveCanvasFrameProvider = () => void;

const providers = new WeakMap<
  HTMLCanvasElement,
  InteractiveCanvasFrameProvider[]
>();

/**
 * Registers a synchronous final-frame renderer for capture operations. The
 * most recently mounted owner wins, allowing post-processing to supersede the
 * default renderer while preserving a fallback during lazy loading.
 */
export function registerInteractiveCanvasFrameProvider(
  canvas: HTMLCanvasElement,
  provider: InteractiveCanvasFrameProvider
): () => void {
  const stack = providers.get(canvas) ?? [];
  stack.push(provider);
  providers.set(canvas, stack);

  return () => {
    const current = providers.get(canvas);
    if (!current) return;
    const index = current.lastIndexOf(provider);
    if (index >= 0) current.splice(index, 1);
    if (current.length === 0) providers.delete(canvas);
  };
}

/** Renders directly before a synchronous canvas read. */
export function refreshInteractiveCanvasFrame(
  canvas: HTMLCanvasElement
): boolean {
  const stack = providers.get(canvas);
  const provider = stack?.at(-1);
  if (!provider) return false;
  provider();
  return true;
}
