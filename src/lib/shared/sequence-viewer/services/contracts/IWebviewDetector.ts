// Detects in-app browsers (Instagram, Facebook, TikTok, etc.) where Google
// OAuth popup-based sign-in is blocked. When true, the sign-in sheet offers
// an "Open in browser" path instead of the usual sign-in button.
//
// UA-based detection. Errs toward false-negative (real Chrome misclassified
// as webview = annoying redirect) over false-positive (IG webview missed =
// sign-in popup fails, user retries in browser).
export interface IWebviewDetector {
  readonly isInAppWebview: boolean;
}
