/**
 * Landing Page Analytics — re-export shim
 *
 * The implementation moved to `$lib/shared/analytics/landing-events` because
 * the components that fire these events (LaunchpadTile, HomeHero, SiteHeader)
 * live under `$lib`, and a lib file importing a routes file inverts this
 * codebase's dependency direction.
 *
 * This file stays so the existing /composer caller keeps working with its
 * relative import. New call sites should import from `$lib` directly.
 */

export * from "$lib/shared/analytics/landing-events";
