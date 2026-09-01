export type AutumnBootAsset = "environment" | "groundDetail" | "pondNormals";
export type AutumnBootStatus = "pending" | "ready" | "failed";

export type AutumnBootState = Record<AutumnBootAsset, AutumnBootStatus>;

export const AUTUMN_BOOT_ASSETS: readonly AutumnBootAsset[] = [
  "environment",
  "groundDetail",
  "pondNormals",
];

export function createAutumnBootState(): AutumnBootState {
  return {
    environment: "pending",
    groundDetail: "pending",
    pondNormals: "pending",
  };
}

export function setAutumnBootAsset(
  state: AutumnBootState,
  asset: AutumnBootAsset,
  status: AutumnBootStatus
): AutumnBootState {
  if (state[asset] === status) return state;
  return { ...state, [asset]: status };
}

export function getAutumnBootProgress(state: AutumnBootState): number {
  const settled = AUTUMN_BOOT_ASSETS.filter(
    (asset) => state[asset] !== "pending"
  ).length;
  return settled / AUTUMN_BOOT_ASSETS.length;
}

export function isAutumnBootReady(state: AutumnBootState): boolean {
  return (
    state.environment === "ready" &&
    state.groundDetail !== "pending" &&
    state.pondNormals !== "pending"
  );
}

export function getAutumnEnvironmentUrl(retryRequest: number): string {
  const retry = Math.max(0, Math.floor(retryRequest));
  return retry === 0
    ? "/models/autumn/autumn-environment.glb"
    : `/models/autumn/autumn-environment.glb?retry=${retry}`;
}
