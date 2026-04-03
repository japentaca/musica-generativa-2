# Feature Delivery Reference

## Objective

Deliver new functionality without breaking determinism, section flow, tessiture constraints, or architecture boundaries.

## Required Inputs

- feature request
- expected user-facing behavior
- constraints and exclusions
- affected modules

## Decision Path

1. Is the request currently in MVP scope?
2. If no, should scope be promoted now?
3. Which layer owns the change?
4. What regressions can this change create?

## Common Regression Risks

- seed drift due to extra random calls in loops
- notes outside tessiture after new transformations
- role assignment conflicts for small voice counts
- scheduler overrun past section boundaries
- stale scheduled parts after repeated regenerate/play/stop cycles

## Mitigation Patterns

- consume PRNG in stable order
- clamp and validate tessiture before scheduling
- assert role assignment invariants after overrides
- clip local events to section end beat
- clear and rebuild transport parts before playback restarts

## Documentation Sync

When behavior changes, sync:

- `SPEC.md`: contracts, scope, invariants
- `GAP_CHECKLIST.md`: implemented/deferred and validation status
- `FEATURE_PLAYBOOK.md`: process updates and reusable decisions
