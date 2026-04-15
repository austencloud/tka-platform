export interface SceneFeature {
  key: string;
  label: string;
  defaultEnabled: boolean;
  requiresAsyncLoad: boolean;
}

export const SCENE_FEATURES: SceneFeature[] = [
  { key: "stage",       label: "Stage",       defaultEnabled: true,  requiresAsyncLoad: false },
  { key: "audience",    label: "Audience",     defaultEnabled: false, requiresAsyncLoad: true  },
  { key: "environment", label: "Environment",  defaultEnabled: true,  requiresAsyncLoad: true  },
  { key: "campfire",    label: "Campfire",     defaultEnabled: true,  requiresAsyncLoad: false },
  { key: "tent",        label: "Tent",         defaultEnabled: true,  requiresAsyncLoad: false },
];
