import type { LayoutServerLoad } from "./$types";
import { parseCloudflareGeo } from "$lib/shared/presence/domain/models/presence-models";

export const load: LayoutServerLoad = ({ request }) => {
  return { geo: parseCloudflareGeo(request.headers) };
};
