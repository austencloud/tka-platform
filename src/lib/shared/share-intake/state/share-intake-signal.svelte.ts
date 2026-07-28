/**
 * A share arrived. That is the whole message.
 *
 * The native adapter cannot call the runner directly: routing opens the inbox
 * picker and the sequence viewer overlay, both of which live inside
 * MainApplication, and the adapter runs during native boot when that tree may
 * not exist. So the adapter bumps this counter and ShareIntakeHost - a
 * component, mounted beside those drawers - reacts.
 *
 * A counter rather than a boolean: two shares in a row must produce two
 * reactions, and a boolean that is already true produces none.
 */
let _tick = $state(0);

export const shareIntakeSignal = {
  get tick(): number {
    return _tick;
  },
};

export function bumpIntakeSignal(): void {
  _tick += 1;
}
