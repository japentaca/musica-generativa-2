# Project Instructions

## Core Expectations

- Keep the app deterministic. Same seed plus same config must produce the same generated piece.
- Preserve strict layer boundaries across model, engines, scheduler, renderer, and UI.
- Make the smallest safe change set for each feature.

## Feature Work Rules

1. Read `SPEC.md`, `GAP_CHECKLIST.md`, and `FEATURE_PLAYBOOK.md` before implementing substantial features.
2. Route randomness through `js/prng.js`; do not add direct `Math.random()` usage.
3. Keep theory and generation logic out of UI listeners.
4. Keep renderer responsible for scheduling and audio-time conversion, not composition decisions.
5. Keep note and event contracts consistent unless docs are updated in the same change.

## Documentation Requirements

- Update `SPEC.md` when scope or invariants change.
- Update `GAP_CHECKLIST.md` for implemented/deferred status and regression gates.
- Update `FEATURE_PLAYBOOK.md` if feature workflow expectations evolve.

## Verification Expectations

For feature changes, verify at minimum:

- browser boot
- deterministic regeneration
- play/stop stability
- tessiture safety
- section progress display
