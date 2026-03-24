/**
 * Festival ITI Container
 *
 * Provides services for the Festival Hub: festival discovery, attendance
 * tracking, personal application tracking, teaching portfolios, and
 * community submission moderation.
 */

import { createContainer } from "iti";
import { FestivalRepository } from "$lib/features/festivals/services/implementations/FestivalRepository";
import { FestivalLoader } from "$lib/features/festivals/services/implementations/FestivalLoader";
import { FestivalTrackerRepository } from "$lib/features/festivals/services/implementations/FestivalTrackerRepository";
import { FestivalAttendanceRepository } from "$lib/features/festivals/services/implementations/FestivalAttendanceRepository";
import { WorkshopPortfolioRepository } from "$lib/features/festivals/services/implementations/WorkshopPortfolioRepository";
import { FestivalSubmissionReviewer } from "$lib/features/festivals/services/implementations/FestivalSubmissionReviewer";

export const festivalContainer = createContainer()
  .add({
    festivalRepository: () => new FestivalRepository(),
    festivalTrackerRepository: () => new FestivalTrackerRepository(),
    festivalAttendanceRepository: () => new FestivalAttendanceRepository(),
    workshopPortfolioRepository: () => new WorkshopPortfolioRepository(),
  })
  .add((deps) => ({
    festivalLoader: () => new FestivalLoader(),
    festivalSubmissionReviewer: () => new FestivalSubmissionReviewer(deps.festivalRepository),
  }));

export type FestivalContainer = typeof festivalContainer;
