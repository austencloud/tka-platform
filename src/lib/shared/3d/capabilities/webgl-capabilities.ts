/**
 * WebGL capability detection.
 *
 * Single-shot probe: we create a throwaway canvas once per page load and
 * cache the result. Components that need to know whether WebGL2 is
 * available (e.g. the 2D/3D render-mode toggle) read `isWebGL2Available()`
 * directly instead of having the flag plumbed through as a prop.
 *
 * SSR-safe: returns `false` when `document` is undefined.
 */

let _webgl2: boolean | null = null;

function probeWebGL2(): boolean {
  if (typeof document === "undefined") return false;
  const testCanvas = document.createElement("canvas");
  const gl = testCanvas.getContext("webgl2");
  const supported = !!gl;
  if (gl) {
    // Free the GPU context immediately; we only needed the existence check.
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
  return supported;
}

/**
 * Returns whether the browser supports WebGL2. First call performs the
 * detection; subsequent calls return the cached value.
 */
export function isWebGL2Available(): boolean {
  if (_webgl2 === null) {
    _webgl2 = probeWebGL2();
  }
  return _webgl2;
}

/**
 * Test-only: clears the cached probe result so the next call re-runs
 * detection against whatever `document.createElement` stub the test has
 * installed. Do not call this from production code.
 */
export function __resetWebGL2CapabilityForTests(): void {
  _webgl2 = null;
}
