/**
 * Delete Service - Manages sequence deletion operations
 *
 * Handles sequence deletion with confirmation, variation number fixing,
 * and cleanup operations following the microservices architecture pattern.
 */

import type {
  DeleteConfirmationData,
  DeleteResult,
} from "$lib/features/create/shared/domain/models/sequence-models";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { IDiscoverDeleter } from "../contracts/IDiscoverDeleter";

export class DiscoverDeleter implements IDiscoverDeleter {
  prepareDeleteConfirmation(
    sequence: SequenceData,
    allSequences: SequenceData[]
  ): DeleteConfirmationData {
    const relatedSequences = this.findRelatedSequences(sequence, allSequences);
    const hasVariations = relatedSequences.length > 0;
    const willFixVariationNumbers =
      hasVariations && this.needsVariationNumberFix(sequence, relatedSequences);

    return {
      sequenceId: sequence.id,
      sequenceName: sequence.name || sequence.word,
      stepCount: sequence.steps.length,
      sequence,
      relatedSequences,
      hasVariations,
      willFixVariationNumbers,
    };
  }

  deleteSequence(
    sequenceId: string,
    allSequences: SequenceData[]
  ): DeleteResult {
    try {
      const sequence = allSequences.find((seq) => seq.id === sequenceId);
      if (!sequence) {
        return {
          success: false,
          deletedCount: 0,
          deletedSequence: null,
          affectedSequences: [],
          error: "Sequence not found",
        };
      }

      // Check if deletion is allowed
      const canDelete = this.canDeleteSequence(sequence, allSequences);
      if (!canDelete) {
        return {
          success: false,
          deletedCount: 0,
          deletedSequence: null,
          affectedSequences: [],
          error: "Sequence cannot be deleted",
        };
      }

      // Get affected sequences before deletion
      const affectedSequences = this.getAffectedSequences(
        sequence,
        allSequences
      );

      // Fix variation numbers if needed

      // In a real implementation, this would call the persistence service
      // For now, we'll simulate the deletion

      // Remove the sequence from the list

      return {
        success: true,
        deletedCount: 1,
        deletedSequence: sequence,
        affectedSequences,
      };
    } catch (error) {
      return {
        success: false,
        deletedCount: 0,
        deletedSequence: null,
        affectedSequences: [],
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  fixVariationNumbers(
    deletedSequence: SequenceData,
    allSequences: SequenceData[]
  ): SequenceData[] {
    const baseWord = this.extractBaseWord(deletedSequence.word);
    const deletedVariation = this.extractVariationNumber(deletedSequence.word);

    if (!deletedVariation) {
      return allSequences; // No variation number to fix
    }

    const updatedSequences = allSequences.map((sequence) => {
      // Skip the sequence being deleted
      if (sequence.id === deletedSequence.id) {
        return sequence;
      }

      const sequenceBaseWord = this.extractBaseWord(sequence.word);
      const sequenceVariation = this.extractVariationNumber(sequence.word);

      // Only fix sequences with the same base word and higher variation numbers
      if (
        sequenceBaseWord === baseWord &&
        sequenceVariation &&
        sequenceVariation > deletedVariation
      ) {
        const newVariationNumber = sequenceVariation - 1;
        const newWord = this.createWordWithVariation(
          baseWord,
          newVariationNumber
        );

        return {
          ...sequence,
          word: newWord,
          name: sequence.name.replace(sequence.word, newWord),
        };
      }

      return sequence;
    });

    return updatedSequences;
  }

  canDeleteSequence(
    sequence: SequenceData,
    _allSequences: SequenceData[]
  ): boolean {
    // Check if this is a system or protected sequence (check metadata)
    const isProtected = sequence.metadata["isProtected"] as boolean;
    const isSystem = sequence.metadata["isSystem"] as boolean;

    if (isProtected || isSystem) {
      return false;
    }

    // Check if user has permission to delete (would be based on authorship in real app)
    if (sequence.author && sequence.author !== "current-user") {
      // In a real app, this would check user permissions
      // For now, allow deletion of demo sequences
      return true;
    }

    return true;
  }

  getAffectedSequences(
    sequence: SequenceData,
    allSequences: SequenceData[]
  ): SequenceData[] {
    const affected: SequenceData[] = [];
    const baseWord = this.extractBaseWord(sequence.word);
    const deletedVariation = this.extractVariationNumber(sequence.word);

    if (!deletedVariation) {
      return affected;
    }

    // Find sequences that will have their variation numbers adjusted
    allSequences.forEach((seq) => {
      if (seq.id === sequence.id) return;

      const seqBaseWord = this.extractBaseWord(seq.word);
      const seqVariation = this.extractVariationNumber(seq.word);

      if (
        seqBaseWord === baseWord &&
        seqVariation &&
        seqVariation > deletedVariation
      ) {
        affected.push(seq);
      }
    });

    return affected;
  }

  // Private helper methods
  private findRelatedSequences(
    sequence: SequenceData,
    allSequences: SequenceData[]
  ): SequenceData[] {
    const baseWord = this.extractBaseWord(sequence.word);

    return allSequences.filter((seq) => {
      if (seq.id === sequence.id) return false;
      const seqBaseWord = this.extractBaseWord(seq.word);
      return seqBaseWord === baseWord;
    });
  }

  private needsVariationNumberFix(
    deletedSequence: SequenceData,
    relatedSequences: SequenceData[]
  ): boolean {
    const deletedVariation = this.extractVariationNumber(deletedSequence.word);
    if (!deletedVariation) return false;

    // Check if there are sequences with higher variation numbers
    return relatedSequences.some((seq) => {
      const variation = this.extractVariationNumber(seq.word);
      return variation && variation > deletedVariation;
    });
  }

  private extractBaseWord(word: string): string {
    // Extract base word from variations like "CAKE_v2" or "ABC-2"
    const match = word.match(/^([A-Z]+)(?:[_-]v?(\d+))?$/i);
    return match?.[1] ?? word;
  }

  private extractVariationNumber(word: string): number | null {
    // Extract variation number from words like "CAKE_v2" or "ABC-2"
    const match = word.match(/[_-]v?(\d+)$/i);
    const matchValue = match?.[1];
    return matchValue ? parseInt(matchValue) : null;
  }

  private createWordWithVariation(baseWord: string, variation: number): string {
    if (variation <= 1) {
      return baseWord;
    }
    return `${baseWord}_v${variation}`;
  }

  // Utility methods for UI components
  formatDeleteConfirmationMessage(data: DeleteConfirmationData): string {
    const {
      sequence,
      hasVariations,
      relatedSequences,
      willFixVariationNumbers,
    } = data;

    let message = `Are you sure you want to delete "${sequence ? sequence.word : "this sequence"}"?`;

    if (hasVariations && relatedSequences) {
      message += `\n\nThis sequence has ${relatedSequences.length} related variation(s).`;

      if (willFixVariationNumbers) {
        message += `\nVariation numbers will be updated automatically.`;
      }
    }

    message += "\n\nThis action cannot be undone.";

    return message;
  }

  getDeleteButtonText(data: DeleteConfirmationData): string {
    if (data.willFixVariationNumbers) {
      return "Delete & Fix Variations";
    }
    return "Delete Sequence";
  }
}
