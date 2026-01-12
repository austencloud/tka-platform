# Play Tab Gamification Plan

## Philosophy: Earned Dopamine, Not Patronizing

The user wants Duolingo-level engagement but **authentically**. Key principles:
- Celebrate real effort, not participation
- Use the 1200ms inter-question gap as celebration window
- Streaks and achievements = appropriate gamification for quiz context
- Confetti reserved for genuine milestones (perfect quiz, streak records)

---

## Current State (from exploration)

### What Exists
- **7 achievements** defined but render statically (no animations)
- **Streak fields** in QuizProgress model (`currentStreak`, `bestStreak`) but never calculated
- **Answer animations** already present (correct/incorrect visual feedback)
- **Haptic triggers** wired for answer feedback
- **1200ms auto-advance** between questions = celebration window
- **UI animation framework** with spring presets, stagger animations

### Gaps
- Streaks never calculated or displayed
- Achievements unlock silently (no celebration)
- No confetti for milestones
- No sound effects
- Results screen is static

---

## Implementation Plan

### Phase 1: Streak System (Foundation)

**Goal:** Calculate and display streaks - the core Duolingo mechanic.

#### 1.1 Create IStreakCalculator service
- `services/contracts/IStreakCalculator.ts`
- Calculate `currentStreak` and `bestStreak` from quiz history
- Detect streak milestones (3, 7, 14, 30 days)
- Return `isNewRecord` flag when best streak is broken

#### 1.2 Create StreakCalculator implementation
- `services/implementations/StreakCalculator.ts`
- Query quiz history by date
- Consecutive days logic with timezone handling
- Register in quiz DI container

#### 1.3 Create StreakDisplay component
- `components/StreakDisplay.svelte`
- Flame icon with number
- Subtle glow animation when active
- Pulse animation on increment

#### 1.4 Wire into QuizTab
- Show streak in header area
- Update after quiz completion
- Persist to Firebase via existing QuizProgress model

---

### Phase 2: Achievement Animations

**Goal:** Make achievement unlocks feel earned with celebration.

#### 2.1 Create AchievementUnlockOverlay component
- Full-screen overlay that slides in
- Achievement icon with scale-up animation
- Title and description with stagger animation
- Confetti burst for rare achievements
- Sound: chime for normal, fanfare for rare

#### 2.2 Define achievement tiers
- **Bronze** (common): Subtle scale animation, no confetti
- **Silver** (uncommon): Medium animation, light confetti
- **Gold** (rare): Full animation, full confetti, fanfare

#### 2.3 Update achievement check flow
- Hook into quiz completion
- Check for newly unlocked achievements
- Queue overlay display
- Mark as "celebrated" to avoid repeat

---

### Phase 3: Enhanced Answer Feedback

**Goal:** Make the 1200ms gap more delightful.

#### 3.1 Enhance correct answer celebration
- Existing: green flash on button
- Add: Score counter with "+10" pop animation
- Add: Small confetti burst (15 particles) for streaks of 3+ correct
- Add: Haptic already exists, add subtle "pop" sound

#### 3.2 Enhance incorrect answer feedback
- Existing: red flash, shake animation
- Add: Brief pause before showing correct answer
- Add: Supportive micro-copy ("Almost!" / "Keep going!")
- No shame, no harsh sounds

#### 3.3 Perfect streak indicator
- Running count of consecutive correct answers
- Visual intensity increases (glow, particle trail)
- Breaking streak = gentle fade, not punishment

---

### Phase 4: Results Screen Polish

**Goal:** Make quiz completion feel like a victory lap.

#### 4.1 Animated score reveal
- Number counter animation (0 → final score)
- Spring easing for overshoot effect
- Different tiers: < 70% = supportive, 70-99% = good, 100% = celebration

#### 4.2 Perfect quiz celebration
- Full confetti burst
- Special badge animation
- Fanfare sound
- "Perfect!" overlay with shine effect

#### 4.3 Stats with stagger animation
- Time taken
- Accuracy percentage
- Best streak in session
- Improvement from last attempt (if applicable)

---

### Phase 5: Sound Design

**Goal:** Audio feedback reinforces visual delight.

#### 5.1 Sound types needed
- `pop.mp3` - Button press, answer selection
- `chime.mp3` - Correct answer, achievement unlock
- `whoosh.mp3` - Transition, streak increment
- `fanfare.mp3` - Perfect quiz, streak record, rare achievement

#### 5.2 Create ISoundPlayer service
- Preload sounds on quiz entry
- Volume control tied to settings
- Respect system mute/vibration mode
- Web Audio API for low latency

#### 5.3 Sound sources
- Use royalty-free or generate with AI
- Keep files small (< 50KB each)
- MP3 format for browser compatibility

---

## Delight Intensity Mapping (Updated)

| Achievement | Intensity | Channels |
|-------------|-----------|----------|
| Answer correct | micro | Haptic + pop sound |
| 3+ correct streak | subtle | Haptic + mini confetti (15) |
| Quiz complete | subtle | Haptic + chime |
| Perfect quiz | major | Haptic + full confetti + fanfare + overlay |
| Streak milestone | major | Haptic + confetti + overlay + toast |
| New streak record | epic | Full celebration suite |
| Rare achievement | major | Haptic + confetti + overlay + fanfare |

---

## Technical Considerations

### Animation Performance
- Use `will-change` sparingly (only during active animations)
- Respect `prefers-reduced-motion`
- Confetti particles: canvas-based, not DOM elements
- Preload sounds during quiz initialization

### State Management
- Streak state lives in existing QuizProgress store
- Achievement celebration state is ephemeral (not persisted)
- Use Svelte context for delight orchestrator access

### Firebase Integration
- Streak calculation queries `quizHistory` collection
- Achievement unlocks write to `userAchievements` collection
- Batch writes for atomic updates

---

## Implementation Order

1. **Phase 1.1-1.2**: Streak calculation service (enables everything else)
2. **Phase 1.3-1.4**: Streak display (immediate visual impact)
3. **Phase 3.1**: Correct answer enhancement (uses existing timing)
4. **Phase 4.2**: Perfect quiz celebration (high-impact milestone)
5. **Phase 2**: Achievement animations (builds on celebration components)
6. **Phase 5**: Sound design (polish layer)
7. **Phase 3.2-3.3**: Incorrect feedback and streak indicator (refinement)
8. **Phase 4.1, 4.3**: Results screen polish (final layer)

---

## Open Questions for User

None - plan is comprehensive. Ready for approval or feedback.
