/**
 * Effect Error Signal
 *
 * When an overlay effect (fire, charcoal, LED) fails repeatedly and is
 * auto-disabled by the render loop, this signal fires so the UI layer
 * can show a warning to the user.
 */

let _effectName = $state<string | null>(null);
let _error = $state<Error | null>(null);
let _signal = $state(0);

export const effectErrorSignal = {
  get effectName() {
    return _effectName;
  },
  get error() {
    return _error;
  },
  get signal() {
    return _signal;
  },
  /** Fire when an effect is auto-disabled after repeated failures. */
  trigger(effectName: string, error: Error) {
    _effectName = effectName;
    _error = error;
    _signal++;
  },
  /** Clear the error (e.g., after showing the warning). */
  clear() {
    _effectName = null;
    _error = null;
  },
};
