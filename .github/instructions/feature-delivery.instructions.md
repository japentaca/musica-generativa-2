---
description: "Use when adding or changing generation features, tonal behavior, scheduling logic, or UI controls in this deterministic music generator."
name: "Feature Delivery"
applyTo:
  - "js/**/*.js"
  - "index.html"
  - "css/**/*.css"
  - "SPEC.md"
  - "GAP_CHECKLIST.md"
  - "FEATURE_PLAYBOOK.md"
---

# Feature Delivery Rules

## Sequence

1. Define feature scope and acceptance criteria.
2. Identify impacted layer ownership.
3. Implement deterministic logic changes.
4. Validate regressions.
5. Update docs and deferred status.

## Determinism and Contracts

- Every random decision must use `PRNG`.
- Preserve canonical shapes:
  - motive note: `{ degree, durationBeats, velocity }`
  - scheduled event: `{ timeBeats, midiNote, durationBeats, velocity }`
- Keep quantization and tessiture checks intact for all generated notes.

## Layer Boundaries

- `app.js`, `index.html`, `css/style.css`: config, controls, and display only.
- generation engines: motif/form/tonal/voice decisions only.
- `scheduler.js`: full timeline assembly before playback.
- `audio-renderer.js`: synth setup and timing conversion only.

## Done Criteria

A feature change is only complete when:

- same-seed regeneration remains stable
- play/stop still resets scheduling state cleanly
- UI status display remains correct
- docs are updated in the same change
