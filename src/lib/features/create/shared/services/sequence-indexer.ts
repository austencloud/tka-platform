/**
 * Sequence Index Service Implementation
 *
 * Handles loading, building, and searching sequence indices for fast browse operations.
 * Provides search capabilities across sequence metadata.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

interface SearchIndex {
  wordIndex: Map<string, Set<string>>; // word -> sequence IDs
  authorIndex: Map<string, Set<string>>; // author -> sequence IDs
  tagIndex: Map<string, Set<string>>; // tag -> sequence IDs
  metadataIndex: Map<string, Set<string>>; // combined metadata -> sequence IDs
}

export class SequenceIndexer {
  buildIndex(_sequences: SequenceData[]): void {
    // Build search index for sequences - placeholder implementation
    // TODO: Implement full-text search indexing when needed
  }

  getSequencesByTag(_tag: string): SequenceData[] {
    // Get sequences by tag - placeholder implementation
    return [];
  }

  updateIndex(_sequence: SequenceData): void {
    // Update index with new/modified sequence - placeholder implementation
    // TODO: Implement incremental index updates when needed
  }

  removeFromIndex(_sequenceId: string): void {
    // Remove sequence from search index - placeholder implementation
    // TODO: Implement index cleanup when needed
  }
  private sequenceIndex: SequenceData[] | null = null;
  private searchIndex: SearchIndex | null = null;
  private sequenceMap = new Map<string, SequenceData>();

  async loadSequenceIndex(): Promise<SequenceData[]> {
    if (this.sequenceIndex !== null) {
      return this.sequenceIndex;
    }

    try {
      // Load sequences if not already loaded
      if (this.sequenceIndex === null) {
        this.sequenceIndex = this.scanSequenceDirectory();
      }

      // Build search index
      if (this.sequenceIndex) {
        this.buildSearchIndex(this.sequenceIndex);
      }

      return this.sequenceIndex || [];
    } catch (error) {
      console.error("Failed to load sequence index:", error);
      // Return empty array as fallback
      this.sequenceIndex = [];
      return [];
    }
  }

  scanSequenceDirectory(): SequenceData[] {
    // Placeholder implementation - would scan for sequence files
    return [];
  }

  buildSearchIndex(sequences: SequenceData[]): void {
    this.searchIndex = {
      wordIndex: new Map(),
      authorIndex: new Map(),
      tagIndex: new Map(),
      metadataIndex: new Map(),
    };

    this.sequenceMap.clear();

    for (const sequence of sequences) {
      this.sequenceMap.set(sequence.id, sequence);

      // Index by word/name
      this.addToIndex(
        this.searchIndex.wordIndex,
        sequence.word.toLowerCase(),
        sequence.id
      );
      this.addToIndex(
        this.searchIndex.wordIndex,
        sequence.name.toLowerCase(),
        sequence.id
      );

      // Index by author
      if (sequence.author) {
        this.addToIndex(
          this.searchIndex.authorIndex,
          sequence.author.toLowerCase(),
          sequence.id
        );
      }

      // Index by tags
      for (const tag of sequence.tags) {
        this.addToIndex(
          this.searchIndex.tagIndex,
          tag.toLowerCase(),
          sequence.id
        );
      }

      // Index by metadata (combined searchable text)
      const searchableText = this.buildSearchableText(sequence);
      for (const term of searchableText.split(/\s+/)) {
        if (term.length > 2) {
          // Only index terms longer than 2 characters
          this.addToIndex(
            this.searchIndex.metadataIndex,
            term.toLowerCase(),
            sequence.id
          );
        }
      }
    }
  }

  private addToIndex(
    index: Map<string, Set<string>>,
    key: string,
    value: string
  ): void {
    if (!index.has(key)) {
      index.set(key, new Set());
    }
    index.get(key)!.add(value);
  }

  private buildSearchableText(sequence: SequenceData): string {
    const parts = [
      sequence.name,
      sequence.word,
      sequence.author || "",
      ...sequence.tags,
      sequence.difficultyLevel || "",
    ];
    return parts.join(" ");
  }

  searchSequences(query: string): SequenceData[] {
    if (!this.searchIndex || !query.trim()) {
      return this.sequenceIndex || [];
    }

    const searchTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((term) => term.length > 0);
    const resultIds = new Set<string>();

    for (const term of searchTerms) {
      const matchingIds = this.searchTerm(term);

      // For multiple terms, use intersection (AND logic)
      if (resultIds.size === 0) {
        matchingIds.forEach((id) => resultIds.add(id));
      } else {
        const currentIds = new Set(resultIds);
        resultIds.clear();
        matchingIds.forEach((id) => {
          if (currentIds.has(id)) {
            resultIds.add(id);
          }
        });
      }
    }

    // Convert IDs back to sequences and sort by relevance
    const results = Array.from(resultIds)
      .map((id) => this.sequenceMap.get(id))
      .filter((seq): seq is SequenceData => seq !== undefined);

    return this.sortByRelevance(results, query);
  }

  private searchTerm(term: string): Set<string> {
    const results = new Set<string>();
    if (!this.searchIndex) return results;

    // Search in word index
    const wordMatches = this.searchIndex.wordIndex.get(term) || new Set();
    wordMatches.forEach((id: string) => results.add(id));

    // Search in author index
    const authorMatches = this.searchIndex.authorIndex.get(term) || new Set();
    authorMatches.forEach((id: string) => results.add(id));

    // Search in tag index
    const tagMatches = this.searchIndex.tagIndex.get(term) || new Set();
    tagMatches.forEach((id: string) => results.add(id));

    // Search in metadata index
    const metadataMatches =
      this.searchIndex.metadataIndex.get(term) || new Set();
    metadataMatches.forEach((id: string) => results.add(id));

    return results;
  }

  private sortByRelevance(
    sequences: SequenceData[],
    query: string
  ): SequenceData[] {
    const queryLower = query.toLowerCase();
    return sequences.sort((a, b) => {
      const scoreA = this.calculateRelevanceScore(a, queryLower);
      const scoreB = this.calculateRelevanceScore(b, queryLower);
      return scoreB - scoreA;
    });
  }

  private calculateRelevanceScore(
    sequence: SequenceData,
    query: string
  ): number {
    let score = 0;

    // Exact word match gets highest score
    if (sequence.word.toLowerCase() === query) {
      score += 100;
    }

    // Word starts with query
    if (sequence.word.toLowerCase().startsWith(query)) {
      score += 50;
    }

    // Word contains query
    if (sequence.word.toLowerCase().includes(query)) {
      score += 25;
    }

    // Name matches
    if (sequence.name.toLowerCase().includes(query)) {
      score += 15;
    }

    // Author matches
    if (sequence.author?.toLowerCase().includes(query)) {
      score += 10;
    }

    // Tag matches
    for (const tag of sequence.tags) {
      if (tag.toLowerCase().includes(query)) {
        score += 5;
      }
    }

    return score;
  }

  async refreshIndex(): Promise<void> {
    this.sequenceIndex = null;
    this.searchIndex = null;
    this.sequenceMap.clear();
    await this.loadSequenceIndex();
  }

  // Additional utility methods
  getIndexStats(): {
    totalSequences: number;
    indexedWords: number;
    indexedAuthors: number;
    indexedTags: number;
    indexedMetadata: number;
  } {
    return {
      totalSequences: this.sequenceMap.size,
      indexedWords: this.searchIndex?.wordIndex.size || 0,
      indexedAuthors: this.searchIndex?.authorIndex.size || 0,
      indexedTags: this.searchIndex?.tagIndex.size || 0,
      indexedMetadata: this.searchIndex?.metadataIndex.size || 0,
    };
  }

  async getSequenceById(id: string): Promise<SequenceData | null> {
    if (!this.sequenceMap.has(id)) {
      await this.loadSequenceIndex();
    }
    return this.sequenceMap.get(id) || null;
  }

  getSuggestions(partialQuery: string, maxSuggestions = 10): string[] {
    if (!this.searchIndex || partialQuery.length < 2) {
      return [];
    }

    const suggestions = new Set<string>();
    const query = partialQuery.toLowerCase();

    // Search in words/names
    for (const [word] of this.searchIndex.wordIndex) {
      if (word.includes(query)) {
        suggestions.add(word);
        if (suggestions.size >= maxSuggestions) break;
      }
    }

    // Search in authors if not enough suggestions
    if (suggestions.size < maxSuggestions) {
      for (const [author] of this.searchIndex.authorIndex) {
        if (author.includes(query)) {
          suggestions.add(author);
          if (suggestions.size >= maxSuggestions) break;
        }
      }
    }

    return Array.from(suggestions).slice(0, maxSuggestions);
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const sequenceIndexer = new SequenceIndexer();
