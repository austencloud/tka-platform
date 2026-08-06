import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => {
  let activeModule: string | null = "create";
  let resolveRestoredModule: ((module: string | null) => void) | null = null;

  return {
    get activeModule() {
      return activeModule;
    },
    set activeModule(module: string | null) {
      activeModule = module;
    },
    get resolveRestoredModule() {
      return resolveRestoredModule;
    },
    set resolveRestoredModule(
      resolve: ((module: string | null) => void) | null
    ) {
      resolveRestoredModule = resolve;
    },
    setActiveModule: vi.fn((module: string | null) => {
      activeModule = module;
    }),
    setCurrentModule: vi.fn(),
    setIsTransitioning: vi.fn(),
    persistSaveActiveTab: vi.fn(async () => {}),
    persistInitialize: vi.fn(async () => {}),
    persistGetActiveTab: vi.fn(
      () =>
        new Promise<string | null>((resolve) => {
          resolveRestoredModule = resolve;
        })
    ),
  };
});

vi.mock("$app/environment", () => ({ browser: false }));
vi.mock("$app/navigation", () => ({ replaceState: vi.fn() }));
vi.mock("$lib/shared/toast/state/toast-state.svelte", () => ({
  toast: { error: vi.fn() },
}));
vi.mock(
  "$lib/shared/auth/services/post-hog-feature-flag-service.svelte",
  () => ({
    featureFlagService: {
      canAccessModule: () => true,
      canAccessTab: () => true,
      isInitialized: true,
      isTester: true,
      isAdmin: false,
    },
  })
);
vi.mock("$lib/shared/navigation/state/navigation-state.svelte", () => ({
  navigationState: {
    activeTab: "construct",
    setActiveTab: vi.fn(),
    setCurrentModule: harness.setCurrentModule,
  },
}));
vi.mock("$lib/shared/navigation/config/module-definitions", () => ({
  normalizeModuleId: (module: string) => module,
}));
vi.mock("$lib/shared/persistence/services/dexie-persistence-service", () => ({
  saveActiveTab: harness.persistSaveActiveTab,
  getActiveTab: harness.persistGetActiveTab,
  initialize: harness.persistInitialize,
}));
vi.mock("$lib/shared/application/state/ui/ui-state.svelte", () => ({
  getActiveModule: () => harness.activeModule,
  setActiveModule: harness.setActiveModule,
  setIsTransitioning: harness.setIsTransitioning,
}));

async function loadModuleState() {
  return import("$lib/shared/application/state/ui/module-state");
}

async function waitForRestoreRead(): Promise<void> {
  await vi.waitFor(() => {
    expect(harness.persistGetActiveTab).toHaveBeenCalled();
    expect(harness.resolveRestoredModule).not.toBeNull();
  });
}

describe("module restoration respects newer navigation intent", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    harness.activeModule = "create";
    harness.resolveRestoredModule = null;
    harness.persistGetActiveTab.mockImplementation(
      () =>
        new Promise<string | null>((resolve) => {
          harness.resolveRestoredModule = resolve;
        })
    );
  });

  it("does not let startup restoration replace a module chosen while storage is loading", async () => {
    const moduleState = await loadModuleState();
    const restoration = moduleState.initializeModulePersistence();
    await waitForRestoreRead();

    await moduleState.switchModule("settings");
    harness.resolveRestoredModule?.("create");
    await restoration;

    expect(harness.activeModule).toBe("settings");
    expect(harness.setActiveModule).not.toHaveBeenCalledWith("create");
    expect(harness.setCurrentModule).not.toHaveBeenCalledWith(
      "create",
      expect.anything()
    );
  });

  it("does not let in-flight auth revalidation restore the prior module", async () => {
    const moduleState = await loadModuleState();
    const revalidation = moduleState.revalidateCurrentModule();
    await waitForRestoreRead();

    await moduleState.switchModule("settings");
    harness.resolveRestoredModule?.("create");
    await revalidation;

    expect(harness.activeModule).toBe("settings");
    expect(harness.setActiveModule).not.toHaveBeenCalledWith("create");
    expect(harness.setCurrentModule).not.toHaveBeenCalledWith(
      "create",
      expect.anything()
    );
  });
});
