export interface ArtifactProvenance {
  readonly sourceSequenceIds: readonly string[];
  readonly isOriginal: boolean;
  readonly firstSeenAt: Date;
}
