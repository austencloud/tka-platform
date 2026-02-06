import type { ToolOperationResult } from "./toolkit-models";

export type OperationHandler<TParams, TResult extends ToolOperationResult> = (
  params: TParams
) => Promise<TResult>;
