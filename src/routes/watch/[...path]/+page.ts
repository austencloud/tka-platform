import { redirect } from "@sveltejs/kit";

export function load() {
  // Watch retired in August 2026. Performance video now belongs to the
  // sequence it demonstrates, so every former Watch URL lands in Browse.
  redirect(308, "/browse/explore/sequences");
}
