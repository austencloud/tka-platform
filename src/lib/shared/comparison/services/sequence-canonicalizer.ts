/**
 * Sequence Canonicalizer Implementation
 *
 * Converts sequences to canonical form using:
 * 1. Booth's algorithm for lexicographically minimal circular rotation
 * 2. Spatial normalization to a canonical grid orientation
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { CanonicalSequence } from "./types";
import type { StepSignatureGenerator } from "./step-signature-generator";
import type { WordCyclicEquivalenceDetector } from "$lib/shared/foundation/utils/word-cyclic-equivalence-detector";
import type { SequenceSignature, StepSignature } from "../domain/models/signatures";

export class SequenceCanonicalizer {
  constructor(
    private readonly stepSignatureGenerator: StepSignatureGenerator,
    private readonly wordCyclicEquivalenceDetector: WordCyclicEquivalenceDetector
  ) {}

  canonicalize(sequence: SequenceData): CanonicalSequence {
    // Generate signature for the original sequence
    const originalSignature = this.generateSignature(sequence);

    // For circular sequences, find the canonical rotation
    let circularOffset = 0;
    let canonicalWord = sequence.word;

    if (sequence.isCircular && sequence.steps.length > 0) {
      canonicalWord = this.wordCyclicEquivalenceDetector.getCanonicalForm(sequence.word);
      circularOffset = this.findCircularOffset(sequence.word, canonicalWord);
    }

    // For now, we don't apply spatial rotation during canonicalization
    // This keeps the implementation simpler and spatial rotation is handled
    // separately in equivalence detection
    const spatialRotationApplied = 0;

    // Generate the canonical hash
    const canonicalHash = this.generateCanonicalHash(
      canonicalWord,
      sequence.steps.length,
      sequence.isCircular,
      originalSignature.beatSignatures,
      circularOffset
    );

    return {
      sequence,
      spatialRotationApplied,
      circularOffsetApplied: circularOffset,
      canonicalHash,
      signature: {
        ...originalSignature,
        canonicalWord,
        hash: canonicalHash,
      },
    };
  }

  generateHash(sequence: SequenceData): string {
    const signature = this.generateSignature(sequence);

    // Get canonical word for circular sequences
    let canonicalWord = sequence.word;
    let circularOffset = 0;

    if (sequence.isCircular && sequence.word.length > 0) {
      canonicalWord = this.wordCyclicEquivalenceDetector.getCanonicalForm(sequence.word);
      circularOffset = this.findCircularOffset(sequence.word, canonicalWord);
    }

    return this.generateCanonicalHash(
      canonicalWord,
      sequence.steps.length,
      sequence.isCircular,
      signature.beatSignatures,
      circularOffset
    );
  }

  haveSameCanonicalForm(seqA: SequenceData, seqB: SequenceData): boolean {
    // Quick rejections
    if (seqA.steps.length !== seqB.steps.length) {
      return false;
    }
    if (seqA.isCircular !== seqB.isCircular) {
      return false;
    }

    // Compare canonical hashes
    return this.generateHash(seqA) === this.generateHash(seqB);
  }

  generateSignature(sequence: SequenceData): SequenceSignature {
    const beatSignatures = this.stepSignatureGenerator.generateSignatures(sequence.steps);

    // Combine beat hashes into a sequence hash
    const combinedHash = this.combineHashes(beatSignatures.map((b) => b.hash));

    return {
      canonicalWord: sequence.word,
      stepCount: sequence.steps.length,
      isCircular: sequence.isCircular,
      beatSignatures,
      hash: combinedHash,
    };
  }


  /**
   * Find how many positions the original word needs to rotate to become canonical.
   */
  private findCircularOffset(originalWord: string, canonicalWord: string): number {
    if (originalWord === canonicalWord) {
      return 0;
    }

    // Find where the canonical word appears in doubled original
    const doubled = originalWord + originalWord;
    const index = doubled.indexOf(canonicalWord);

    return index >= 0 ? index : 0;
  }

  /**
   * Generate a canonical hash that incorporates:
   * - Canonical word (handles circular rotation)
   * - Step count
   * - Circularity flag
   * - Beat signatures (rotation-invariant)
   */
  private generateCanonicalHash(
    canonicalWord: string,
    stepCount: number,
    isCircular: boolean,
    beatSignatures: readonly StepSignature[],
    circularOffset: number
  ): string {
    // Reorder beat signatures according to circular offset
    const reorderedSignatures =
      circularOffset > 0 && isCircular
        ? [
            ...beatSignatures.slice(circularOffset),
            ...beatSignatures.slice(0, circularOffset),
          ]
        : beatSignatures;

    // Combine into hash
    const signatureHashes = reorderedSignatures.map((s) => s.hash).join(";");
    return `${canonicalWord}:${stepCount}:${isCircular ? "C" : "L"}:${signatureHashes}`;
  }

  /**
   * Combine multiple hashes into a single hash.
   */
  private combineHashes(hashes: readonly string[]): string {
    // Simple concatenation with separator
    // For production, could use a proper hash function
    return hashes.join(";");
  }
}
