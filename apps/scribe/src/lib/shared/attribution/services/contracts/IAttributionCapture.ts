/**
 * Attribution Capture Service Contract
 *
 * Responsible for capturing attribution data from the current page context:
 * - UTM parameters from URL
 * - Referrer information
 * - Platform click IDs
 * - Device information
 */

import type {
  TouchData,
  UtmParameters,
  ClickIds,
  ReferrerInfo,
  DeviceInfo,
} from "../../domain/types";

export interface IAttributionCapture {
  /**
   * Capture complete touch data from current page context
   * Call this on page load to gather all attribution signals
   */
  captureTouchData(): TouchData;

  /**
   * Extract UTM parameters from current URL
   */
  captureUtmParameters(): UtmParameters;

  /**
   * Extract platform click IDs from current URL
   */
  captureClickIds(): ClickIds;

  /**
   * Analyze the document referrer
   */
  captureReferrer(): ReferrerInfo;

  /**
   * Capture device/browser information
   */
  captureDeviceInfo(): DeviceInfo;

  /**
   * Check if current URL has any attribution parameters
   * (UTM params or click IDs)
   */
  hasAttributionParams(): boolean;

  /**
   * Check if the current touch differs meaningfully from a previous touch
   * Used to avoid recording duplicate touches
   */
  isDifferentTouch(previous: TouchData, current: TouchData): boolean;
}
