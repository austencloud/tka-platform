import type { IMuseumPerformanceRecorder } from "./services/contracts/IMuseumPerformanceRecorder";
import { MuseumPerformanceRecorder } from "./services/implementations/MuseumPerformanceRecorder";

let instance: IMuseumPerformanceRecorder | null = null;

export function getMuseumPerformanceRecorder(): IMuseumPerformanceRecorder {
  instance ??= new MuseumPerformanceRecorder();
  return instance;
}
