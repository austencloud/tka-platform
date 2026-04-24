import type { ServerLoadEvent } from "@sveltejs/kit";

export function load({ request }: ServerLoadEvent) {
  return {
    geo: {
      country: request.headers.get("cf-ipcountry") || null,
      city: request.headers.get("cf-ipcity") || null,
    },
  };
}
