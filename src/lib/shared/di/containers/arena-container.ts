/**
 * Arena Module DI Container
 *
 * Services for the community-powered pairwise ranking system.
 */

import { createContainer } from "iti";
import { RatingCalculator } from "$lib/features/arena/services/implementations/RatingCalculator";
import { MatchupSelector } from "$lib/features/arena/services/implementations/MatchupSelector";
import { ArenaRepository } from "$lib/features/arena/services/implementations/ArenaRepository";
import { ArenaOrchestrator } from "$lib/features/arena/services/implementations/ArenaOrchestrator";
import { StabilityAnalyzer } from "$lib/features/arena/services/implementations/StabilityAnalyzer";

export const arenaContainer = createContainer().add({
  arenaRatingCalculator: () => new RatingCalculator(),
  arenaMatchupSelector: () => new MatchupSelector(),
  arenaRepository: () => new ArenaRepository(),
  arenaStabilityAnalyzer: () => new StabilityAnalyzer(),
  arenaOrchestrator: () =>
    new ArenaOrchestrator(
      arenaContainer.items.arenaRepository,
      arenaContainer.items.arenaRatingCalculator,
      arenaContainer.items.arenaMatchupSelector
    ),
});

export type ArenaContainer = typeof arenaContainer;
