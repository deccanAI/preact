# Changelog

## [Unreleased]

### Changed
- Hook dependency comparison now uses `Object.is()` instead of strict equality (`!==`)
  - Improves handling of `NaN` values in dependencies
  - Changes behavior for `-0` vs `+0` comparisons
  - Ensures consistency with React's implementation

### Added
- New tests for `Object.is` comparison behavior
- Documentation updates explaining the new comparison behavior