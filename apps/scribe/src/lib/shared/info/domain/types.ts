/**
 * Info Domain Types
 *
 * Defines the core domain structures that power the info experience.
 */

import type { Section } from "../../navigation/domain/types";

export type InfoTab = "resources" | "support" | "dev";

export interface InfoSection extends Section {
  color: string;
  gradient: string;
}

export interface SocialLink {
  name: string;
  url: string;
  icon: string;
  color: string;
}

export interface Resource {
  title: string;
  description: string;
  url: string;
  icon: string;
  type: "download" | "internal" | "external";
}

export interface SupportOption {
  name: string;
  url: string;
  icon: string;
  color: string;
}

export interface InfoHeroContent {
  title: string;
  subtitle: string;
  cta: string;
}

export interface InfoPanelContent {
  title: string;
  subtitle: string;
}

// Type alias - same structure as InfoPanelContent
export type InfoSupportContent = InfoPanelContent;

export interface InfoDevContent extends InfoPanelContent {
  message: string;
}

export interface InfoTextContent {
  hero: InfoHeroContent;
  resources: InfoPanelContent;
  support: InfoSupportContent;
  dev: InfoDevContent;
}
