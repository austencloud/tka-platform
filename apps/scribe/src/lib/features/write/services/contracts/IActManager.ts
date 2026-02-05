/**
 * IActManager - Contract for Write tab Act operations
 */
export interface ActSummary {
  id: string;
  name: string;
  description?: string;
  /** Optional list of sequence IDs associated with the act */
  sequences?: string[];
  /** Optional file path or storage key */
  filePath?: string;
}

export interface IActManager {
  /** Prepare any resources needed by the service */
  initialize(): Promise<void>;

  /** Cleanup any resources on component destroy */
  cleanup(): void;

  /**
   * Load an act by ID or path.
   * The returned object should include sequences if available.
   */
  loadAct(idOrPath: string): Promise<ActSummary | null>;

  /** Return a list of available acts for the browser */
  getAllActs(): Promise<ActSummary[]>;

  /** Add a sequence to an act */
  addSequenceToAct(actId: string, sequenceId: string): Promise<void>;

  /** Remove a sequence from an act */
  removeSequenceFromAct(actId: string, sequenceId: string): Promise<void>;

  /** Export an act by ID */
  exportAct(actId: string): Promise<void>;
}

// Note: Type-only exports; no default export to satisfy verbatimModuleSyntax
