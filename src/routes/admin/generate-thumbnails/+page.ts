import { redirect } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

// The warm tool moved out from behind the admin guard, which bounced every
// non-admin session to the home page. Keep the old bookmark working.
export const load: PageLoad = () => {
  redirect(307, "/tools/warm-thumbnails");
};
