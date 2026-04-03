# Deterministic Tonal Generator

Browser-based generative music app focused on deterministic, finite tonal pieces. Given the same seed and the same configuration, it should regenerate the same form, motives, and scheduled timeline.

The project is intentionally narrow in scope. It favors clean layer boundaries between model, generation engines, scheduler, renderer, and UI over broad feature coverage.

## Current MVP

- Browser-only app built with ES modules
- Deterministic generation through a seeded PRNG
- Finite pieces only
- Major and minor tonal centers only
- 2 to 4 voices
- Role-based voice behavior: enunciator, imitator, accompanist
- 1 to 2 leitmotifs with controlled transformations
- Precomputed timeline before playback starts
- Per-voice synth or metadata-listed sampler playback with synth fallback

Out of scope for the current MVP includes WebMIDI, infinite playback, commentator voice logic, advanced modes beyond major and minor, full SFZ semantics, and ARIAX ensemble playback.

## Repo Layout

```text
.
|-- index.html
|-- soundfont-checker.html
|-- css/
|   `-- style.css
|-- js/
|   |-- app.js
|   |-- audio-renderer.js
|   |-- formal-engine.js
|   |-- harmonic-state.js
|   |-- motive-engine.js
|   |-- motive.js
|   |-- prng.js
|   |-- scheduler.js
|   |-- section.js
|   |-- soundfont-catalog.js
|   |-- tonal-engine.js
|   |-- voice-engine.js
|   `-- voice.js
|-- soundfonts/
|-- SPEC.md
|-- GAP_CHECKLIST.md
`-- FEATURE_PLAYBOOK.md
```

## Architecture

### Model layer

- `js/prng.js`: deterministic random source and helper methods
- `js/harmonic-state.js`: tonal center, scale/chord quantization, and modal resolution
- `js/motive.js`: motive data and transformations
- `js/voice.js`: voice configuration and tessiture state
- `js/section.js`: section metadata and duration constraints

### Generation layer

- `js/tonal-engine.js`: section tonal planning and progressions
- `js/formal-engine.js`: finite form generation
- `js/motive-engine.js`: leitmotif generation and transformations
- `js/voice-engine.js`: phrase generation per role

### Scheduling and rendering

- `js/scheduler.js`: assembles the complete beat-based timeline before playback
- `js/audio-renderer.js`: initializes audio sources and converts beats to audio-time
- `js/soundfont-catalog.js`: metadata-backed instrument selection for samplers

### UI layer

- `index.html`, `css/style.css`, `js/app.js`: controls, orchestration, status, and visualization only

## Running Locally

Because the app uses ES modules and browser audio APIs, serve the repository from a local HTTP server instead of opening `index.html` directly.

Example using Python:

```bash
python -m http.server 8080
```

Then open:

- `http://127.0.0.1:8080/` for the main app
- `http://127.0.0.1:8080/soundfont-checker.html` for sampler availability checks

## Main Controls

- Global generation controls: BPM, seed, voice count, tonic, mode, section count, and form type
- Playback controls: start/stop toggle and regenerate
- Voice controls: role override, imitator delay, instrument, tessiture, volume, reverb send, and pan
- Motive controls: motif length, rhythm weights, and allowed transformations
- Form display: generated section overview and summary

## Determinism Rules

- Same seed plus same config must produce the same generated piece
- Random decisions must flow through `js/prng.js`
- UI code should not make composition decisions
- Renderer code should not generate musical material
- Scheduled events stay beat-based until the renderer converts them for playback

## Verification Baseline

When changing generation, scheduling, rendering, or controls, verify at minimum:

- browser boot
- deterministic regeneration with the same seed
- play/stop stability
- tessiture safety
- section progress display

For the current implementation baseline and deferred items, see `GAP_CHECKLIST.md`.

## Project Docs

- `SPEC.md`: source of truth for MVP scope, invariants, and contracts
- `GAP_CHECKLIST.md`: implemented status, deferred scope, and regression baseline
- `FEATURE_PLAYBOOK.md`: workflow for safely adding features

## Notes For Contributors

- Keep changes small and layer ownership explicit
- Preserve canonical event and motive shapes unless docs are updated in the same change
- If a JavaScript module import is cache-busted with a `?v=` query string, bump the importer version when needed so browser reloads pick up the change