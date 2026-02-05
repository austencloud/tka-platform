/**
 * Transition Graph Implementation
 *
 * Builds and manages a graph of valid letter transitions based on position groups.
 * Uses BFS to find shortest bridge paths between letters that can't directly follow.
 *
 * Platform-agnostic: uses ISequenceDataProvider for data loading.
 */
/**
 * Transition graph for letter sequence building.
 * Manages valid transitions and finds bridge paths using BFS.
 */
export class TransitionGraph {
    dataProvider;
    letterPositions = new Map();
    lettersByStartGroup = new Map();
    lettersByEndGroup = new Map();
    initialized = false;
    constructor(dataProvider) {
        this.dataProvider = dataProvider;
        // Initialize maps for each position group
        const groups = ["alpha", "beta", "gamma"];
        for (const group of groups) {
            this.lettersByStartGroup.set(group, []);
            this.lettersByEndGroup.set(group, []);
        }
    }
    async initialize() {
        if (this.initialized)
            return;
        const data = await this.dataProvider.loadLetterMappings();
        this.buildGraph(data);
        this.initialized = true;
    }
    buildGraph(data) {
        // Process each letter
        for (const [letterStr, mapping] of Object.entries(data.letters)) {
            const startGroup = this.positionToGroup(mapping.startPosition);
            const endGroup = this.positionToGroup(mapping.endPosition);
            if (!startGroup || !endGroup)
                continue;
            const category = this.getCategoryForLetter(letterStr, data.categories);
            const positionInfo = {
                letter: letterStr,
                startPositionGroup: startGroup,
                endPositionGroup: endGroup,
                category,
            };
            this.letterPositions.set(letterStr, positionInfo);
            this.lettersByStartGroup.get(startGroup)?.push(letterStr);
            this.lettersByEndGroup.get(endGroup)?.push(letterStr);
        }
    }
    positionToGroup(position) {
        if (position.startsWith("alpha"))
            return "alpha";
        if (position.startsWith("beta"))
            return "beta";
        if (position.startsWith("gamma"))
            return "gamma";
        return null;
    }
    getCategoryForLetter(letterStr, categories) {
        for (const [category, letters] of Object.entries(categories)) {
            if (letters.includes(letterStr)) {
                return category;
            }
        }
        return "dual-shift"; // Default
    }
    canFollow(letterA, letterB) {
        const infoA = this.letterPositions.get(letterA);
        const infoB = this.letterPositions.get(letterB);
        if (!infoA || !infoB)
            return false;
        return infoA.endPositionGroup === infoB.startPositionGroup;
    }
    getValidSuccessors(letter) {
        const info = this.letterPositions.get(letter);
        if (!info)
            return [];
        return this.lettersByStartGroup.get(info.endPositionGroup) || [];
    }
    getLettersStartingAt(positionGroup) {
        return this.lettersByStartGroup.get(positionGroup) || [];
    }
    getLettersEndingAt(positionGroup) {
        return this.lettersByEndGroup.get(positionGroup) || [];
    }
    getLetterPositionInfo(letter) {
        return this.letterPositions.get(letter) || null;
    }
    getStartPositionGroup(letter) {
        return this.letterPositions.get(letter)?.startPositionGroup || null;
    }
    getEndPositionGroup(letter) {
        return this.letterPositions.get(letter)?.endPositionGroup || null;
    }
    findBridgeLetters(letterA, letterB) {
        // If direct transition is possible, no bridge needed
        if (this.canFollow(letterA, letterB)) {
            return [];
        }
        const infoA = this.letterPositions.get(letterA);
        const infoB = this.letterPositions.get(letterB);
        if (!infoA || !infoB) {
            return [];
        }
        // First, try to find all single-letter bridges (most common case)
        const singleBridges = this.findAllBridgeOptions(letterA, letterB);
        if (singleBridges.length > 0) {
            // Randomly select one bridge letter for variety
            const randomIndex = Math.floor(Math.random() * singleBridges.length);
            return [singleBridges[randomIndex]];
        }
        // Fallback to BFS for multi-letter bridges (rare case)
        const startGroup = infoA.endPositionGroup;
        const targetGroup = infoB.startPositionGroup;
        return this.findShortestBridgePath(startGroup, targetGroup);
    }
    /**
     * BFS to find the shortest sequence of letters to get from one position group to another.
     */
    findShortestBridgePath(startGroup, targetGroup) {
        if (startGroup === targetGroup) {
            return [];
        }
        // BFS queue: [current group, path of letters taken]
        const queue = [[startGroup, []]];
        const visited = new Set();
        visited.add(startGroup);
        while (queue.length > 0) {
            const item = queue.shift();
            if (!item)
                break;
            const [currentGroup, path] = item;
            // Get all letters that start at this group
            const lettersFromHere = this.lettersByStartGroup.get(currentGroup) || [];
            for (const letter of lettersFromHere) {
                const info = this.letterPositions.get(letter);
                if (!info)
                    continue;
                const nextGroup = info.endPositionGroup;
                const newPath = [...path, letter];
                // Found the target!
                if (nextGroup === targetGroup) {
                    return newPath;
                }
                // Continue BFS if we haven't visited this group
                if (!visited.has(nextGroup)) {
                    visited.add(nextGroup);
                    queue.push([nextGroup, newPath]);
                }
            }
        }
        // No path found (should not happen in TKA as all groups are connected)
        return [];
    }
    findAllBridgeOptions(letterA, letterB) {
        // If direct transition is possible, no bridge needed
        if (this.canFollow(letterA, letterB)) {
            return [];
        }
        const infoA = this.letterPositions.get(letterA);
        const infoB = this.letterPositions.get(letterB);
        if (!infoA || !infoB) {
            return [];
        }
        // Find all single-letter bridges: letters that START at A's end group
        // and END at B's start group
        const startGroup = infoA.endPositionGroup;
        const targetGroup = infoB.startPositionGroup;
        const bridges = [];
        const lettersFromStartGroup = this.lettersByStartGroup.get(startGroup) || [];
        for (const letter of lettersFromStartGroup) {
            const info = this.letterPositions.get(letter);
            if (info && info.endPositionGroup === targetGroup) {
                bridges.push(letter);
            }
        }
        return bridges;
    }
    getAllLetters(excludeLetters = new Set()) {
        const letters = [];
        for (const letter of this.letterPositions.keys()) {
            if (!excludeLetters.has(letter)) {
                letters.push(letter);
            }
        }
        return letters;
    }
    isInitialized() {
        return this.initialized;
    }
}
