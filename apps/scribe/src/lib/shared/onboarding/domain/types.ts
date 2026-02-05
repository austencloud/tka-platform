/**
 * Onboarding Types
 */

/**
 * Information about a tab in module onboarding
 */
export interface TabInfo {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  color: string;
  features: string[];
  recommendation: string;
}

/**
 * Content for a module's onboarding experience
 */
export interface ModuleOnboardingContent {
  moduleId: string;
  moduleName: string;
  moduleIcon: string;
  moduleColor: string;
  welcomeTitle: string;
  welcomeSubtitle: string;
  welcomeDescription: string;
  tabs: TabInfo[];
}
