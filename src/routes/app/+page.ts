import { redirect } from "@sveltejs/kit";

export function load() {
  // Redirect /app to /create (default module) — the app shell
  // will then restore the user's last-used module from localStorage/Firestore
  redirect(302, "/create");
}
