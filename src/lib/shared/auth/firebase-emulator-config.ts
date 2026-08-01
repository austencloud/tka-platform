export interface FirebaseEmulatorConfigInput {
  dev: boolean;
  browserUrl?: string;
  enabledValue?: string;
  projectIdValue?: string;
}

export interface FirebaseEmulatorConfig {
  enabled: boolean;
  projectId: string;
  host: "127.0.0.1";
  authPort: 9099;
  firestorePort: 8080;
  databasePort: 9000;
  storagePort: 9199;
  functionsPort: 5001;
}

export function resolveFirebaseEmulatorConfig(
  input: FirebaseEmulatorConfigInput
): FirebaseEmulatorConfig {
  const browserProjectId =
    input.dev && input.browserUrl
      ? new URL(input.browserUrl).searchParams
          .get("firebaseEmulatorProject")
          ?.trim()
      : undefined;
  const enabled =
    input.dev &&
    (input.enabledValue === "true" || browserProjectId !== undefined);
  const projectId =
    browserProjectId || input.projectIdValue?.trim() || "demo-tka-local";

  if (enabled && !projectId.startsWith("demo-")) {
    throw new Error(
      "Firebase emulator mode requires a demo- project ID to prevent live writes."
    );
  }

  return {
    enabled,
    projectId,
    host: "127.0.0.1",
    authPort: 9099,
    firestorePort: 8080,
    databasePort: 9000,
    storagePort: 9199,
    functionsPort: 5001,
  };
}
