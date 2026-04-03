# MVP Baseline and Feature Checklist

This checklist tracks the current baseline against `SPEC.md` and defines the required gates for adding new features safely.

## Implemented

| Area | Files | Status | Notes |
|---|---|---|---|
| Trimmed browser shell | `index.html`, `css/style.css` | Complete | UI now exposes only the reduced global controls, voice controls, motive controls, form summary, and playback status. |
| Deterministic PRNG wrapper | `js/prng.js` | Complete | Uses `seedrandom` when present and falls back to a deterministic local generator for non-browser validation. |
| Harmonic model | `js/harmonic-state.js` | Complete | Limited to major/minor, with explicit pitch-class scale lookup, scale/chord MIDI quantization, and degree-to-MIDI resolution for modal triads. |
| Motive model | `js/motive.js` | Complete | Uses `{ degree, durationBeats, velocity }` and beat-based transformations. |
| Voice model | `js/voice.js` | Complete | Uses `roleOverride`, resolved `role`, tessiture helpers, beat delay for imitators, and persisted `reverbSend` mix state. |
| Section model | `js/section.js` | Complete | Keeps section type, duration, tension, density, targets, and transformation allowances, with section durations normalized to power-of-two bar counts per section type. |
| Tonal planning | `js/tonal-engine.js` | Complete | Constrained to static, dominant, subdominant, and relative targets with finite progression templates. |
| Formal generation | `js/formal-engine.js` | Complete | Generates finite sonata/fugue/dialogue/free forms with deterministic section counts clamped to 3 to 30 and section durations chosen from power-of-two bar counts only. |
| Motive generation | `js/motive-engine.js` | Complete | Generates 1 to 2 leitmotifs and selects section-aware transformations. |
| Voice phrase generation | `js/voice-engine.js` | Complete | Supports enunciator, imitator, and accompanist only, with melodic events aligned to the active modal chord across chord boundaries. |
| Precomputed scheduling | `js/scheduler.js` | Complete | Builds the full timeline before playback and exposes section index plus bar-position metadata for the UI. |
| Synth and sampler renderer | `js/audio-renderer.js`, `js/soundfont-catalog.js` | Complete | Per-voice instrument selection supports synth plus metadata-listed samplers with synth fallback on load failure; beat-to-seconds conversion and shared reverb-bus mixing stay at the renderer boundary. |
| App orchestration | `js/app.js` | Complete | Bootstraps the app, renders dynamic UI, generates deterministic timelines, and manages single-toggle transport state with active section highlighting and section/bar status displays. |
| Instrument-aware voice model | `js/voice.js`, `js/voice-engine.js` | Complete | Voice model now persists `instrumentId` so sampler selections survive regeneration and voice-count changes. |

## Intentionally Deferred

| Feature | Status | Reason |
|---|---|---|
| WebMIDI output | Deferred | Removed from the MVP scope. |
| Infinite mode | Deferred | Removed from the MVP scope. |
| Commentator role | Deferred | Removed from the MVP scope. |
| Modes beyond major/minor | Deferred | Removed from the MVP scope. |
| Chromatic and enharmonic modulation planning | Deferred | Removed from the MVP scope. |
| Per-section modulation controls | Deferred | Removed from the MVP scope. |
| Per-section duration editors | Deferred | Removed from the MVP scope. |
| Full SFZ parser semantics | Deferred | Metadata-based sampler loading is implemented, but full SFZ opcode behavior is intentionally out of scope. |
| ARIAX ensemble preset playback | Deferred | V1 sampler support targets metadata-listed single instruments only. |

## Validation Results

| Check | Result | Method |
|---|---|---|
| Module graph parses | Passed | Node import smoke test for non-DOM modules. |
| Browser boot | Passed | Loaded over `http://127.0.0.1:8080/` and confirmed `window.musicApp` plus dynamic panel rendering. |
| Play / stop cycle | Passed | Browser interaction confirmed transport start, section updates, and clean stop reset. |
| Transport toggle and bar status | Passed | Browser interaction confirmed the single start/stop button switches state cleanly and the current-bar display advances with playback. |
| 30-section display and section tracking | Passed | Browser evaluation set section count to `30`, confirmed 30 visualized and summarized sections, and verified active section highlighting plus section-local bar display updates. |
| Same-seed determinism | Passed | Browser evaluation regenerated twice with seed `42` and produced identical form and timeline payloads. |
| Tessiture safety | Passed | Browser evaluation verified every scheduled note stays inside each voice tessiture range. |
| Modal chord adherence | Passed | Browser evaluation audited sonata, fugue, dialogue, and free timelines in major and minor modes and confirmed every sounding note segment stays inside the active modal triad. |
| Per-voice reverb send | Passed | Browser interaction confirmed each voice slider updates the shared reverb-bus send without forcing timeline regeneration. |
| Bare `Math.random()` usage | Passed | Workspace search over `js/**` found no direct usages. |
| Power-of-two section durations | Passed | Code path constrains generated and reconstructed sections to per-type power-of-two bar counts only. |

## Feature Addition Checklist (Required)

Use this checklist for every new feature before calling work complete.

### Scope and Design

- [ ] Feature is classified as in-scope extension or deferred backlog item.
- [ ] If the feature changes scope boundaries, `SPEC.md` is updated first.
- [ ] Affected layer ownership is explicit (model, engine, scheduler, renderer, or UI).

### Implementation Quality

- [ ] New random decisions use `PRNG`; no direct `Math.random()` added.
- [ ] Canonical contracts remain compatible, or contract changes are documented.
- [ ] UI changes do not contain music theory or generation logic.
- [ ] Renderer changes do not generate new musical events.

### Validation and Regression

- [ ] Same-seed determinism still holds for form and timeline output.
- [ ] Notes stay inside voice tessiture across all generated voices.
- [ ] Melodic events stay aligned to the active modal chord, including across chord changes.
- [ ] Play/stop remains clean, with no stale scheduled parts.
- [ ] Current-section and current-bar displays still track transport position correctly.
- [ ] Sampler voice selection loads metadata-listed instruments or falls back to synth without runtime crash.

### Documentation

- [ ] `GAP_CHECKLIST.md` is updated with the new implemented/deferred status.
- [ ] Feature notes are added to `FEATURE_PLAYBOOK.md` if workflow or architecture expectations changed.

## Follow-up Only If Scope Expands Again

- Expand sampler support to full SFZ semantics and ARIAX playback only after metadata-based sampler mode is stable.
- Reintroduce WebMIDI only after a separate transport and output abstraction exists.
- Add richer modal harmony only after the current degree and progression contracts are covered by tests.
- Expand the form and modulation UI only after the reduced control surface proves stable in browser validation.