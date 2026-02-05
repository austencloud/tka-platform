/**
 * Admin Component Types
 *
 * Shared TypeScript type definitions for all admin UI components.
 * These types ensure consistency across the admin interface.
 */

/**
 * Base props that all admin components can accept
 */
export interface BaseAdminProps {
  class?: string;
  style?: string;
}

/**
 * Component size variants
 */
export type AdminSize = "sm" | "md" | "lg";

/**
 * Component style variants
 */
export type AdminVariant =
  | "primary"
  | "secondary"
  | "warning"
  | "danger"
  | "info";

/**
 * Item with selection state
 */
export interface SelectableItem {
  id: string;
  selected?: boolean;
  disabled?: boolean;
}

/**
 * Filter option for AdminFilterGroup
 */
export interface FilterOption {
  id: string;
  label: string;
  icon?: string;
  count?: number;
}

/**
 * Form field types
 */
export type AdminFormFieldType =
  | "text"
  | "select"
  | "textarea"
  | "toggle"
  | "radio"
  | "number";

/**
 * Select option for form fields
 */
export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

/**
 * Stat card data
 */
export interface StatCardData {
  label: string;
  value: string | number;
  icon: string;
  color?: string;
  change?: number;
  changeLabel?: string;
  trend?: "up" | "down" | "neutral";
}

/**
 * Modal variant types
 */
export type ModalVariant = "confirm" | "warning" | "danger" | "info";

/**
 * Button click handler
 */
export type ButtonClickHandler = () => void | Promise<void>;
