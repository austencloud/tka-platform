import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { auth } from "$lib/shared/auth/firebase";

// Desktop OAuth client ID (installed/native app type) from Google Cloud Console:
// https://console.cloud.google.com/apis/credentials?project=the-kinetic-alphabet
// Distinct from the web client ID used for browser-based One Tap sign-in.
const CLIENT_ID =
	"664225703033-i9had4ijqua22fge706s7ugtn1isjhs5.apps.googleusercontent.com";

export async function signInWithDesktopOAuth(): Promise<void> {
	const { open } = await import("@tauri-apps/plugin-shell");

	const redirectUri = "http://localhost:9876/callback";
	const scope = "email profile";
	const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
	authUrl.searchParams.set("client_id", CLIENT_ID);
	authUrl.searchParams.set("redirect_uri", redirectUri);
	authUrl.searchParams.set("response_type", "token");
	authUrl.searchParams.set("scope", scope);
	authUrl.searchParams.set("prompt", "select_account");

	await open(authUrl.toString());

	const { listen } = await import("@tauri-apps/api/event");
	return new Promise((resolve, reject) => {
		const timeout = setTimeout(() => reject(new Error("OAuth timed out")), 120_000);

		listen<{ id_token: string }>("oauth-callback", async (event) => {
			clearTimeout(timeout);
			try {
				const credential = GoogleAuthProvider.credential(event.payload.id_token);
				await signInWithCredential(auth, credential);
				resolve();
			} catch (err) {
				reject(err);
			}
		});
	});
}
