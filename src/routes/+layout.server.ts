import type { LayoutServerLoad } from "./$types";
import { parseCloudflareGeo } from "$lib/shared/presence/domain/models/presence-models";

export const load: LayoutServerLoad = ({ request, platform }) => {
  const cf = (platform as { cf?: Record<string, unknown> } | undefined)?.cf;
  return { geo: parseCloudflareGeo(request.headers, cf) };
};
