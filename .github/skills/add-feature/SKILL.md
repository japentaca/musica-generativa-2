---
name: add-feature
description: "Plan and implement deterministic tonal-generator features. Use when adding controls, voice behavior, motive logic, section planning, scheduler behavior, or renderer-safe integrations while preserving seed determinism and layer boundaries."
argument-hint: "Describe the feature, desired behavior, constraints, and any target files."
---

# Add Feature Skill

Use this workflow to deliver features safely in this repository.

## When To Use

- adding or expanding generation behavior
- introducing new UI controls that affect generation
- changing scheduling behavior
- modifying tonal, formal, motive, or voice engine logic
- updating contracts or invariants in docs

## Procedure

1. Confirm scope using `SPEC.md` and `GAP_CHECKLIST.md`.
2. Draft a short feature spec from [feature spec template](./assets/feature-spec-template.md).
3. Plan implementation by layer using [module boundary reference](./references/module-boundaries.md).
4. Implement minimal deterministic code changes.
5. Run regression checks from [regression checklist](./assets/regression-checklist-template.md).
6. Update docs (`SPEC.md`, `GAP_CHECKLIST.md`, `FEATURE_PLAYBOOK.md`) as needed.
7. Summarize impact and residual risks.

## Quality Gates

- No new direct `Math.random()` usage.
- No generation logic in UI handlers.
- No event invention inside renderer callbacks.
- Same seed + same config still yields same timeline output.
- Feature status is documented as implemented or deferred.

## Resources

- [Feature delivery reference](./references/feature-delivery-playbook.md)
- [Module boundaries](./references/module-boundaries.md)
- [Feature spec template](./assets/feature-spec-template.md)
- [Regression checklist template](./assets/regression-checklist-template.md)
- [Implementation plan template](./assets/implementation-plan-template.md)
