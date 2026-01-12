<!--
QuizFeedbackBanner - Feedback banner after answer

Features:
- Supportive messaging for both correct and incorrect
- Streak awareness for extra encouragement
- Varied incorrect messages (never discouraging)
-->
<script lang="ts">
	let {
		isCorrect,
		correctMessage,
		incorrectMessage,
		streakCount = 0
	}: {
		isCorrect: boolean;
		correctMessage: string;
		incorrectMessage: string;
		streakCount?: number;
	} = $props();

	// Supportive phrases for incorrect answers (rotate based on time)
	const supportivePhrases = [
		'Almost!',
		'Keep going!',
		'You got this!',
		"Close one!",
		'Learning moment!'
	];

	// Pick a phrase based on current second (pseudo-random but consistent per answer)
	const supportivePrefix = $derived(
		supportivePhrases[Math.floor(Date.now() / 1000) % supportivePhrases.length]
	);

	// Streak encouragement for correct answers
	const streakMessage = $derived(
		streakCount >= 5
			? " You're on fire! 🔥"
			: streakCount >= 3
				? ' Great streak!'
				: ''
	);

	const displayMessage = $derived(
		isCorrect
			? correctMessage + streakMessage
			: `${supportivePrefix} ${incorrectMessage}`
	);
</script>

<div class="feedback-banner" class:correct={isCorrect} class:streak={isCorrect && streakCount >= 3}>
	<span class="feedback-text">
		{displayMessage}
	</span>
</div>

<style>
  .feedback-banner {
    position: fixed;
    bottom: calc(var(--primary-nav-height, 64px) + 1rem);
    left: 50%;
    transform: translateX(-50%);
    padding: 0.75rem 1.25rem;
    background: rgba(239, 68, 68, 0.9);
    border-radius: 12px;
    text-align: center;
    animation: bannerFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    backdrop-filter: blur(8px);
    white-space: nowrap;
    z-index: 150;
  }

  .feedback-banner.correct {
    background: rgba(34, 197, 94, 0.9);
  }

  .feedback-banner.streak {
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.9) 0%, rgba(251, 191, 36, 0.9) 100%);
    box-shadow: 0 0 20px rgba(251, 191, 36, 0.4);
  }

  @keyframes bannerFadeIn {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  .feedback-text {
    color: white;
    font-size: 0.9375rem;
    font-weight: 600;
    letter-spacing: 0.01em;
  }

  @media (min-width: 900px) {
    .feedback-banner {
      padding: 0.875rem 1.5rem;
    }

    .feedback-text {
      font-size: 1rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .feedback-banner {
      animation: none;
    }
  }
</style>
