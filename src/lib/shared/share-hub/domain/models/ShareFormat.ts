/**
 * Share Format Domain Models
 *
 * Defines the available sharing formats in the Share Hub.
 */

export type ShareFormat = "image" | "video" | "composite";

export interface FormatMetadata {
  id: ShareFormat;
  label: string;
  description: string;
  icon: string; // FontAwesome icon class
  gradient: { from: string; to: string }; // Gradient colors
}
