/**
 * QuickFeedbackPanel input-mode gate.
 *
 * Extracted so the rule is unit-testable without a real touch device or
 * on-screen keyboard.
 *
 * Feedback item AmvXbY8i: on a Galaxy Z Fold, dismissing the keyboard while
 * the textarea kept focus left the panel stuck in full-screen input mode,
 * suppressing the submit button. The old gate used device *capability*
 * (`isTouchDevice`), which stays true after the keyboard closes. It now
 * mirrors `FeedbackSubmitTab`'s `hasVirtualKeyboard` gate, which tracks
 * whether a keyboard is actually on screen (`keyboardHeight > 0`) so input
 * mode drops the moment the keyboard is dismissed, regardless of focus.
 *
 * iOS is the one deliberate exception. `MobileInputToolbar` (the source of
 * `keyboardHeight`) is never mounted on iOS — see FeedbackForm.svelte's
 * `deviceDetector.isTouchDevice() && !isIOSPlatform` guard — so
 * `keyboardHeight` never leaves 0 there. QuickFeedbackPanel instead syncs
 * iOS full-screen mode to the live visual viewport via its `ios-input-mode`
 * class, driven by focus alone, so iOS keeps using the capability gate here.
 * That path also preserves the panel's Z-Fold landscape side-drawer case
 * (touch device, non-bottom-sheet placement, on-screen keyboard) — Android
 * devices there still resolve through the `keyboardHeight > 0` branch,
 * since `MobileInputToolbar` mounts regardless of drawer placement.
 */
export interface QuickFeedbackInputModeParams {
  isInputFocused: boolean;
  isSubmitting: boolean;
  isIOSPlatform: boolean;
  isTouchDevice: boolean;
  keyboardHeight: number;
}

export function hasVirtualKeyboardPresence({
  isIOSPlatform,
  isTouchDevice,
  keyboardHeight,
}: Pick<
  QuickFeedbackInputModeParams,
  "isIOSPlatform" | "isTouchDevice" | "keyboardHeight"
>): boolean {
  return isIOSPlatform ? isTouchDevice : keyboardHeight > 0;
}

export function computeQuickFeedbackInputMode(
  params: QuickFeedbackInputModeParams
): boolean {
  return (
    (params.isInputFocused || params.isSubmitting) &&
    hasVirtualKeyboardPresence(params)
  );
}
