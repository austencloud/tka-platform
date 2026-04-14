import type { IWebviewDetector } from "../contracts/IWebviewDetector";

const WEBVIEW_PATTERNS: readonly RegExp[] = [
	/Instagram/i,
	/FBAN|FBAV|FB_IAB|FB4A/i, // Facebook family
	/musical_ly|TikTok|Bytedance/i, // TikTok
	/Twitter for/i, // Twitter/X in-app
	/LinkedInApp/i, // LinkedIn
	/Pinterest\//i, // Pinterest
	/Snapchat\//i, // Snapchat
];

export class WebviewDetector implements IWebviewDetector {
	get isInAppWebview(): boolean {
		if (typeof navigator === "undefined") return false;
		const ua = navigator.userAgent ?? "";
		return WEBVIEW_PATTERNS.some((re) => re.test(ua));
	}
}
