---
description: "Use when updating specs, checklists, prompts, playbooks, or implementation notes so project documentation remains actionable for future feature work."
name: "Documentation Quality"
applyTo: "**/*.md"
---

# Documentation Rules

- Keep docs decision-oriented: define what changed, why, and verification impact.
- Keep scope explicit: implemented, deferred, or intentionally excluded.
- Record invariants whenever contracts or boundaries are touched.
- Keep checklists executable, not aspirational.

## Required Cross-Doc Sync

When behavior changes:

1. Update `SPEC.md` for scope/invariant changes.
2. Update `GAP_CHECKLIST.md` for implementation and regression status.
3. Update `FEATURE_PLAYBOOK.md` when workflow guidance changes.

## Avoid

- stale references to deleted files
- placeholder sections with no actionable criteria
- mixing accepted behavior with backlog ideas without labels
