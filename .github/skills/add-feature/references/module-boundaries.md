# Module Boundaries

Use this map to avoid misplaced logic.

## Models

- `js/prng.js`
- `js/harmonic-state.js`
- `js/motive.js`
- `js/voice.js`
- `js/section.js`

Own data contracts, invariants, and helper operations.

## Engines

- `js/tonal-engine.js`
- `js/formal-engine.js`
- `js/motive-engine.js`
- `js/voice-engine.js`

Own generation decisions and section/phrase behavior.

## Scheduler

- `js/scheduler.js`

Owns full-piece timeline construction and section beat ranges before playback starts.

## Renderer

- `js/audio-renderer.js`

Owns synth creation, tone scheduling, and stop/disposal lifecycle.

## UI and Orchestration

- `js/app.js`
- `index.html`
- `css/style.css`

Own control binding, config mutation, render output, and playback triggers only.
