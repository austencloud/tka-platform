/**
 * Co-exported types from retired interface contracts.
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

