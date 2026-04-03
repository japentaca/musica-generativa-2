# Regression Checklist Template

## Core Stability

- [ ] App boots without initialization errors.
- [ ] Regenerate works repeatedly without stale state.
- [ ] Play starts from clean scheduler/renderer state.
- [ ] Stop clears scheduled parts and playback status.

## Determinism

- [ ] Same seed and config produce identical form summary.
- [ ] Same seed and config produce identical scheduled events.
- [ ] No new direct `Math.random()` usage was introduced.

## Musical Safety

- [ ] All scheduled notes stay inside tessiture.
- [ ] Quantization still applies except explicit transition notes.
- [ ] Section progression and transitions remain valid.

## UI and Progress

- [ ] Updated controls map correctly to config.
- [ ] Current section display follows playback timeline.
- [ ] Elapsed time and summary labels remain coherent.

## Documentation

- [ ] `SPEC.md` updated if contracts or scope changed.
- [ ] `GAP_CHECKLIST.md` updated with feature status.
- [ ] `FEATURE_PLAYBOOK.md` updated if workflow changed.
