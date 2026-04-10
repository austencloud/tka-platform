import type { LOOPComponent } from "$lib/features/create/generate/shared/domain/models/generate-models";
import type {
  TextRenderOptions,
  UserExportInfo as UserInfo,
} from "../../domain/models/SequenceExportOptions";
/**
 * Text rendering service for titles, user info, and overlays
 * Equivalent to desktop WordDrawer, UserInfoDrawer, DifficultyLevelDrawer
 */
export interface ITextRenderer {
  /**
   * Render sequence word/title text at the top
   * @deprecated Use renderWordFooter for Browser Gallery style
   */
  renderWordText(
    canvas: HTMLCanvasElement,
    word: string,
    options: TextRenderOptions,
    stepCount?: number
  ): void;

  /**
   * Render word in a footer at the bottom of the canvas
   * Uses Browser Gallery style: color-coded gradient background based on difficulty level
   */
  renderWordFooter(
    canvas: HTMLCanvasElement,
    word: string,
    options: TextRenderOptions,
    footerHeight: number,
    difficultyLevel?: number
  ): void;

  /**
   * Render word in a header at the top of the canvas
   * Simple background with optional level badge indicator
   * @param darkMode - When true, uses dark theme styling (dark bg, light text)
   * @param loopComponents - Optional LOOP components to display as badge on right side
   */
  renderWordHeader(
    canvas: HTMLCanvasElement,
    word: string,
    options: TextRenderOptions,
    headerHeight: number,
    difficultyLevel?: number,
    showDifficultyBadge?: boolean,
    darkMode?: boolean,
    loopComponents?: Set<LOOPComponent>,
    backgroundColor?: string,
    borderColor?: string
  ): void;

  /**
   * Render user information (name, date, notes)
   * @param footerHeight - Height of the footer area for proper text positioning
   * @param stepCount - Number of steps for legacy-matching font sizing
   * @param darkMode - When true, uses dark theme styling (dark bg, light text)
   * @param showFlags - Granular controls for which footer elements to show
   * @param customNotesText - Custom text to use for notes instead of default
   */
  renderUserInfo(
    canvas: HTMLCanvasElement,
    userInfo: UserInfo,
    options: TextRenderOptions,
    footerHeight?: number,
    stepCount?: number,
    darkMode?: boolean,
    showFlags?: {
      showCreatorName?: boolean;
      showNotes?: boolean;
      showBirthday?: boolean;
    },
    customNotesText?: string,
    backgroundColor?: string,
    borderColor?: string,
    leftLabel?: string,
    elementIcon?: CanvasImageSource
  ): void;

  /**
   * Render difficulty level badge
   */
  renderDifficultyBadge(
    canvas: HTMLCanvasElement,
    level: number,
    position: [number, number],
    size: number
  ): void;

  /**
   * Calculate text dimensions for layout planning
   */
  measureText(
    text: string,
    fontFamily: string,
    fontSize: number,
    fontWeight?: string
  ): { width: number; height: number };

  /**
   * Apply custom kerning to text
   */
  renderTextWithKerning(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    kerning: number
  ): void;
}
