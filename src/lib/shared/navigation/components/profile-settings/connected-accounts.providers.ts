export const PROVIDERS = {
  "google.com": {
    name: "Google",
    color: "#4285f4",
  },
  "facebook.com": {
    name: "Facebook",
    color: "#1877f2",
  },
  "instagram.com": {
    name: "Instagram",
    color: "#e4405f",
  },
  password: {
    name: "Email",
    color: "#8b5cf6",
  },
} as const;

export type ProviderId = keyof typeof PROVIDERS;
export type ProviderConfig = (typeof PROVIDERS)[ProviderId];

export interface ProviderAvailability {
  facebookEnabled: boolean;
  instagramEnabled: boolean;
  native: boolean;
}

export function getAvailableProviderIds(
  linkedProviderIds: readonly string[],
  availability: ProviderAvailability
): ProviderId[] {
  const linked = new Set(linkedProviderIds);

  return (Object.keys(PROVIDERS) as ProviderId[]).filter((providerId) => {
    if (linked.has(providerId)) return false;
    if (providerId === "facebook.com") {
      return availability.facebookEnabled && !availability.native;
    }
    if (providerId === "instagram.com") {
      return availability.instagramEnabled && !availability.native;
    }
    return true;
  });
}
