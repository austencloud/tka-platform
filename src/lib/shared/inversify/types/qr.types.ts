/**
 * QR Code Service Type Identifiers
 *
 * Types for QR code generation and URL shortening services.
 *
 * Domain: QR - Code Generation & URL Shortening
 */

export const QRTypes = {
  /** QR code generator with modern styling */
  IQRCodeGenerator: Symbol.for("IQRCodeGenerator"),
  /** Short code manager for Firebase-backed URL shortening */
  IShortCodeManager: Symbol.for("IShortCodeManager"),
} as const;
