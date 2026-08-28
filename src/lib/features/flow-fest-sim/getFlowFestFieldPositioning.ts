import { FlowFestFieldPositioning } from "./services/implementations/FlowFestFieldPositioning";

let instance: FlowFestFieldPositioning | null = null;

export function getFlowFestFieldPositioning(): FlowFestFieldPositioning {
  instance ??= new FlowFestFieldPositioning();
  return instance;
}
