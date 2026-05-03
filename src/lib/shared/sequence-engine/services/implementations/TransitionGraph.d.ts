/**
 * Transition Graph Implementation
 *
 * Builds and manages a graph of valid letter transitions based on position groups.
 * Uses BFS to find shortest bridge paths between letters that can't directly follow.
 *
 * Platform-agnostic: uses ISequenceDataProvider for data loading.
 */
import type { ITransitionGraph } from "../contracts/ITransitionGraph.js";
import type { BrowserDataProvider } from "../../data/implementations/BrowserDataProvider.js";
import type { PositionGroup, LetterPositionInfo } from "../../domain/models/SequenceEngineTypes.js";
/**
 * Transition graph for letter sequence building.
 * Manages valid transitions and finds bridge paths using BFS.
 */
export declare class TransitionGraph implements ITransitionGraph {
    private readonly dataProvider;
    private letterPositions;
    private lettersByStartGroup;
    private lettersByEndGroup;
    private initialized;
    constructor(dataProvider: BrowserDataProvider);
    initialize(): Promise<void>;
    private buildGraph;
    private positionToGroup;
    private getCategoryForLetter;
    canFollow(letterA: string, letterB: string): boolean;
    getValidSuccessors(letter: string): string[];
    getLettersStartingAt(positionGroup: PositionGroup): string[];
    getLettersEndingAt(positionGroup: PositionGroup): string[];
    getLetterPositionInfo(letter: string): LetterPositionInfo | null;
    getStartPositionGroup(letter: string): PositionGroup | null;
    getEndPositionGroup(letter: string): PositionGroup | null;
    findBridgeLetters(letterA: string, letterB: string): string[];
    /**
     * BFS to find the shortest sequence of letters to get from one position group to another.
     */
    private findShortestBridgePath;
    findAllBridgeOptions(letterA: string, letterB: string): string[];
    getAllLetters(excludeLetters?: Set<string>): string[];
    isInitialized(): boolean;
}
