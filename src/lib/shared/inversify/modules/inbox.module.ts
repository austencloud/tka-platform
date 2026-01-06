import { ContainerModule, type ContainerModuleLoadOptions } from "inversify";

/**
 * Inbox Module
 *
 * Registers inbox-specific services and dependencies.
 * Note: Inbox primarily uses shared state (inboxState) and existing services
 * (NotificationService, ConversationManager) so this module is lightweight.
 */
export const inboxModule = new ContainerModule(
  (_options: ContainerModuleLoadOptions) => {
    // === INBOX SERVICES ===
    // Inbox uses shared services from notifications and messaging modules
    // No inbox-specific services to register at this time
    // Future: Could bind inbox-specific orchestrators or managers here if needed
  }
);
