/**
 * IScreenshotOrchestrator — Coordinates on-demand screenshot captures
 * from the Lab UI via the Vite dev server endpoints.
 */

export type DeviceCategory = "phone" | "tablet" | "desktop";

export interface DeviceInfo {
  slug: string;
  name: string;
  width: number;
  height: number;
  category: DeviceCategory;
}

export interface RouteNode {
  label: string;
  moduleId: string;
  tabId?: string;
  requiresAuth: boolean;
}

export interface ModuleGroup {
  moduleId: string;
  displayName: string;
  routes: RouteNode[];
}

export interface CaptureJobStatus {
  id: string;
  status: "running" | "completed" | "failed";
  total: number;
  completed: number;
  startedAt: number;
  finishedAt: number | null;
  error: string | null;
}

export interface CaptureRequest {
  routes: string[];
  devices: string[];
}

export interface CaptureStartResult {
  jobId: string;
  total: number;
}

export interface IScreenshotOrchestrator {
  /** All available devices, grouped by category */
  getDevices(): DeviceInfo[];

  /** All available routes, grouped by module */
  getModuleGroups(): ModuleGroup[];

  /** Start a capture job. Returns job ID and total expected captures. */
  startCapture(request: CaptureRequest): Promise<CaptureStartResult>;

  /** Poll capture job status */
  getJobStatus(jobId: string): Promise<CaptureJobStatus>;
}
