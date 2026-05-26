import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { auth } from "$lib/shared/auth/firebase";
import { GOOGLE_CLIENT_ID } from "$lib/shared/auth/config/google-oauth";

export async function signInWithDesktopOAuth(): Promise<void> {
	const { invoke } = await import("@tauri-apps/api/core");
	const { open } = await import("@tauri-apps/plugin-shell");
	const { listen } = await import("@tauri-apps/api/event");

	const port: number = await invoke("start_oauth_server");

	const redirectUri = `http://127.0.0.1:${port}`;
	const nonce = crypto.randomUUID();

	const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
	authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
	authUrl.searchParams.set("redirect_uri", redirectUri);
	authUrl.searchParams.set("response_type", "id_token");
	authUrl.searchParams.set("scope", "openid email profile");
	authUrl.searchParams.set("nonce", nonce);
	authUrl.searchParams.set("prompt", "select_account");

	let resolveToken: (token: string) => void;
	let rejectToken: (err: Error) => void;
	const tokenPromise = new Promise<string>((resolve, reject) => {
		resolveToken = resolve;
		rejectToken = reject;
	});

	const timeout = setTimeout(() => {
		rejectToken!(new Error("OAuth timed out after 2 minutes"));
	}, 120_000);

	const unlisten = await listen<{ id_token: string }>(
		"oauth-callback",
		(event) => {
			clearTimeout(timeout);
			resolveToken!(event.payload.id_token);
		}
	);

	await open(authUrl.toString());

	try {
		const idToken = await tokenPromise;
		const credential = GoogleAuthProvider.credential(idToken);
		await signInWithCredential(auth, credential);
	} catch (err) {
		console.error("[DesktopOAuth] Sign-in failed:", err);
		throw err;
	} finally {
		unlisten();
	}
}
