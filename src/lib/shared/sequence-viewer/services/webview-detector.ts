const WEBVIEW_PATTERNS: readonly RegExp[] = [
  /Instagram/i,
  /FBAN|FBAV|FB_IAB|FB4A/i,
  /musical_ly|TikTok|Bytedance/i,
  /Twitter for/i,
  /LinkedInApp/i,
  /Pinterest\//i,
  /Snapchat\//i,
];

export function isInAppWebview(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent ?? "";
  return WEBVIEW_PATTERNS.some((re) => re.test(ua));
}
