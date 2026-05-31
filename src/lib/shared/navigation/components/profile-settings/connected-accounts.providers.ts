export const PROVIDERS = {
  "google.com": {
    name: "Google",
    icon: "fab fa-google",
    color: "#4285f4",
    bgColor: "rgba(66, 133, 244, 0.15)",
    borderColor: "rgba(66, 133, 244, 0.3)",
  },
  "facebook.com": {
    name: "Facebook",
    icon: "fab fa-facebook-f",
    color: "#1877f2",
    bgColor: "rgba(24, 119, 242, 0.15)",
    borderColor: "rgba(24, 119, 242, 0.3)",
  },
  password: {
    name: "Email",
    icon: "fas fa-envelope",
    color: "#8b5cf6",
    bgColor: "rgba(139, 92, 246, 0.15)",
    borderColor: "rgba(139, 92, 246, 0.3)",
  },
} as const;

export type ProviderId = keyof typeof PROVIDERS;
export type ProviderConfig = (typeof PROVIDERS)[ProviderId];
