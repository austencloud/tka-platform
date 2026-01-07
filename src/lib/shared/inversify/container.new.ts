import { Container } from "inversify";
import { animatorModule } from "./modules/animator.module";
import { createModule } from "./modules/build.module";
import { coreModule } from "./modules/core.module";
import { dataModule } from "./modules/data.module";
import { exploreModule } from "./modules/discover.module";
import { learnModule } from "./modules/learn.module";
import { pictographModule } from "./modules/pictograph.module";
import { writeModule } from "./modules/write.module";

// Create container
const container = new Container();

// Load all modules
async function initializeContainer() {
  try {
    await container.load(
      coreModule,
      dataModule,
      pictographModule,
      createModule, // Load before animator - animator depends on create's services
      animatorModule,
      exploreModule,
      learnModule,
      writeModule
    );
    console.log("✅ TKA Container: All modules loaded successfully");
  } catch (error) {
    console.error("❌ TKA Container: Failed to load modules:", error);
    throw error;
  }
}

// Initialize the container
void initializeContainer();

// Export container
export { container };
export const inversifyContainer = container;

// Export TYPES for convenience (many files expect to import TYPES from container)
export { TYPES } from "./types";

// Export resolve function
export function resolve<T>(serviceType: symbol): T {
  return container.get<T>(serviceType);
}

// Export module initialization function for testing or manual control
export { initializeContainer };
