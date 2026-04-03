# Deterministic Tonal Generator MVP Spec

## Overview

This specification defines a smaller, testable MVP for the browser-based generative music app. The goal is not broad feature coverage. The goal is a correct, deterministic, finite piece generator with clean separation between model, engines, scheduler, renderer, and UI.

Anything not listed as MVP is out of scope for this version.

---

## MVP Scope

- Browser-only app using Tone.js and seedrandom
- Modular ES modules in the existing file structure
- Finite piece generation only
- Per-voice synth or sampler playback, with synth fallback on sampler load failure
- Major and minor tonal centers only
- 2 to 4 voices
- Roles: enunciator, imitator, accompanist
- 1 to 2 leitmotivs
- Precomputed full timeline before playback begins
- Minimal but functional control surface

---

## Explicitly Out of Scope

- Full SFZ semantic parsing
- ARIAX ensemble preset playback
- WebMIDI
- Infinite playback mode
- Commentator voice logic
- Dorian, phrygian, lydian, mixolydian, and locrian modes
- Chromatic, enharmonic, and Neapolitan modulation planning
- Per-section modulation sliders
- Per-section-type duration editors
- Placeholder controls for deferred features

---

## Project Structure

```
/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── lib/
│   │   └── seedrandom.min.js
│   ├── prng.js
│   ├── harmonic-state.js
│   ├── motive.js
│   ├── voice.js
│   ├── section.js
│   ├── tonal-engine.js
│   ├── formal-engine.js
│   ├── motive-engine.js
│   ├── voice-engine.js
│   ├── scheduler.js
│   ├── audio-renderer.js
│   └── app.js
└── SPEC.md
```

---

## Dependencies

- Tone.js via CDN
- seedrandom via CDN or local vendor file

No other runtime dependency is required for the MVP.

---

## Canonical Units and Data Shapes

The app must use one consistent set of units.

### Section unit

- `durationBars` is an integer number of bars

### Phrase/event unit

- `timeBeats` is a numeric offset in beats from the start of the piece
- `durationBeats` is a numeric beat duration

### Motive note

```js
{ degree, durationBeats, velocity }
```

- `degree` is a relative scale-degree offset
- `durationBeats` is numeric
- `velocity` is normalized `0..1`

### Scheduled event

```js
{ timeBeats, midiNote, durationBeats, velocity }
```

### Renderer rule

Only `audio-renderer.js` may convert beats into Tone.js timing values.

---

## Layer 1 - Model

### PRNG

Responsibilities:
- Wrap seedrandom
- Provide deterministic random helpers

Required API:
- `random()`
- `randomInt(min, max)`
- `pick(array)`
- `weightedPick(array, weights)`

Invariant:
- No other module may call `Math.random()` directly

### HarmonicState

Properties:
- `tonic` as pitch class `0..11`
- `mode` as `major | minor`
- `currentDegree`
- `history`

Required API:
- `getScalePitchClasses()`
- `quantizeMidi(midiNote)`
- `degreeToMidi(degree, octave)`
- `modulate(targetTonic, targetMode, atBar)`

Invariant:
- Every emitted note passes through `quantizeMidi()` unless it is an explicitly planned transition note

### Motive

Properties:
- `notes`
- computed `length`

Transformations return new instances:
- `transpose(scaleSteps)`
- `invert()`
- `retrograde()`
- `augment(factor)`
- `diminish(factor)`
- `fragment(start, end)`

### Voice

Properties:
- `id`
- `name`
- `role`
- `tessiture = { minOctave, maxOctave }`
- `volume`
- `pan`
- `reverbSend`
- `imitatorDelayBeats`
- `muted`

### Section

Properties:
- `type`
- `durationBars`
- `tension`
- `density`
- `targetTonic`
- `targetMode`
- `allowedTransformations`

Allowed types:
- `intro`
- `exposition`
- `development`
- `recapitulation`
- `coda`

---

## Layer 2 - Tonal Engine

### Responsibilities

- Generate tonal progressions for each section
- Plan section targets before scheduling begins
- Keep the piece anchored to a home key with limited excursions

### generateProgression

Signature:

```js
generateProgression(sectionType, harmonicState, prng)
```

Return value:

```js
[{ degree, bars }]
```

Rules:
- Exposition strongly states tonic
- Development may move to dominant, subdominant, or relative key
- Recapitulation returns to tonic
- Intro and coda are short and stable

### planSectionTarget

Signature:

```js
planSectionTarget(sectionType, currentState, homeState, prng)
```

Return value:

```js
{ targetTonic, targetMode, modulationType }
```

Allowed modulation types:
- `static`
- `dominant`
- `subdominant`
- `relative`

---

## Layer 3 - Formal Engine

### Responsibilities

- Build the complete section list before playback
- Assign duration, tension, density, and tonal target for every section

### generateForm

Signature:

```js
generateForm(prng, params)
```

Params:

```js
{ sectionCount, formType, includeIntro, includeCoda, arcIntensity, homeState, tonalEngine }
```

Rules:
- Start with intro or exposition
- End with recapitulation or coda
- Include at least one development
- Exposition and recapitulation target the home key
- Tension rises into development and falls into recapitulation
- `sectionCount` is clamped to a finite range of 3 to 30 sections

---

## Layer 4 - Motive Engine

### Responsibilities

- Generate leitmotivs deterministically from the harmonic state
- Select section-appropriate transformations

### generateMotive

Signature:

```js
generateMotive(harmonicState, prng, params)
```

Params:

```js
{ minLength, maxLength, rhythmProfile }
```

Example rhythm profile:

```js
{ 0.5: 0.4, 1: 0.35, 2: 0.2, 4: 0.05 }
```

### selectTransformation

Signature:

```js
selectTransformation(motive, section, prng)
```

Behavior:
- Low tension favors transpose and fragment
- High tension favors invert and retrograde
- Augment and diminish are allowed only if they preserve beat-based timing cleanly

---

## Layer 5 - Voice Engine

### Responsibilities

- Assign roles deterministically
- Generate role-specific phrases from the transformed motive and progression

### assignRoles

Rules:
- Exactly one enunciator
- If there are 3 or more voices, exactly one accompanist
- All remaining voices are imitators

### generatePhrase

Signature:

```js
generatePhrase(voice, motive, harmonicState, section, prng, context)
```

Return value:

```js
[{ timeBeats, midiNote, durationBeats, velocity }]
```

Role behavior:
- Enunciator states the transformed motive on the beat
- Imitator copies the enunciator with a beat delay and optional small transposition
- Accompanist plays roots and simple chord tones aligned to the current progression

Invariant:
- Phrase generation must respect tessiture before scheduling

---

## Layer 6 - Scheduler

### Responsibilities

- Build the whole piece before playback
- Produce per-voice events and section timing metadata
- Avoid Tone.js dependencies except for transport-facing conversion helpers if needed

### buildTimeline

Signature:

```js
buildTimeline(form, voices, motiveEngine, voiceEngine, tonalEngine, prng, homeState)
```

Output:
- `eventsByVoice`
- `sectionsWithBeatRanges`
- `totalBeats`
- `totalBars`

Invariant:
- No event generation occurs inside audio callbacks

### getSectionAtBeat

Returns the active section for the current beat so the UI can show progress.

### getPlaybackPositionAtBeat

Returns the active section plus absolute and section-local bar numbers for the current beat so the UI can show bar progress without doing timing math itself.

---

## Layer 7 - Audio Renderer

### Responsibilities

- Create one playback chain per voice (synth or sampler)
- Create a shared reverb bus with per-voice send control
- Schedule precomputed events
- Apply volume, pan, and reverb send
- Dispose scheduled parts on stop or regenerate

### Synth and sampler paths

- Synth source: `Tone.PolySynth(Tone.Synth)` remains available for all voices
- Sampler source: metadata-backed `Tone.Sampler` may be selected per voice
- Fallback: if sampler metadata or samples fail to load, that voice must fall back to synth without altering timeline events
- Sampler v1 source scope: metadata-listed instruments only

Invariant:
- Renderer consumes precomputed events; it does not invent notes or durations
- Reverb send is mix-only state; it must not alter generated events or scheduling decisions

---

## Layer 8 - UI

### Required controls

Global:
- BPM
- Seed
- Randomize seed
- Voice count
- Initial tonic
- Initial mode
- Section count (3 to 30)
- Start or stop toggle
- Regenerate

Per voice:
- Role override
- Imitator delay
- Instrument selection
- Min octave
- Max octave
- Volume
- Reverb send
- Pan
- Mute

Motive:
- Min length
- Max length
- Rhythm profile weights
- Allowed transformations

Read-only display:
- Form summary
- Current section (index, type, and target key)
- Current bar (absolute and section-local)
- Elapsed time

### UI constraint

The UI may edit config and trigger regeneration or playback. It must not contain generation logic.

---

## Acceptance Criteria

1. The page initializes without module import errors.
2. Same seed produces the same form, motives, tonal targets, and scheduled events.
3. The scheduler builds the full finite timeline before playback starts.
4. Stop clears scheduled Tone parts and resets transport state cleanly.
5. The current-section and current-bar indicators follow playback correctly, including section index and section-local bar.
6. Every scheduled note is inside the voice tessiture.
7. Every scheduled note is quantized through the harmonic state except explicitly planned transition notes.
8. No direct `Math.random()` calls remain in application code.

---

## Suggested Delivery Order

1. Model classes
2. Tonal engine
3. Formal engine
4. Motive engine
5. Voice engine
6. Scheduler
7. Audio renderer
8. UI wiring
9. Determinism and playback verification

---

## Post-MVP Backlog

These features can be added after the MVP is stable:

- Additional modes
- Commentator role
- WebMIDI output
- Infinite mode
- Richer modulation types
- Advanced form controls
- Full SFZ parser semantics
- ARIAX preset playback

---

## Feature Addition Protocol

Use this protocol for every new feature so the app stays deterministic and layered.

### 1. Scope Gate

Before coding, classify the request:

- **In-scope extension**: expands behavior inside existing MVP boundaries (for example better motive transforms, smarter role logic, richer but finite section planning)
- **Backlog feature**: touches deferred domains (for example WebMIDI, full SFZ/ARIAX support, infinite generation)

If it is a backlog feature, update this spec first and explicitly move the item out of deferred scope.

### 2. Layer Ownership Gate

Every change must list the layer owner:

- Model: data shape and invariants
- Engine: deterministic generation decisions
- Scheduler: piece-wide event placement
- Renderer: audio transport and synth scheduling
- UI: configuration only

Reject implementations that put theory logic in UI handlers or event generation in renderer callbacks.

### 3. Determinism Gate

For any feature that introduces a decision point:

- Route random choices through `PRNG`
- Keep generated output dependent on seed and config only
- Ensure same seed and same config produce the same timeline

### 4. Contract Gate

Do not silently break canonical shapes:

- Motive note: `{ degree, durationBeats, velocity }`
- Scheduled event: `{ timeBeats, midiNote, durationBeats, velocity }`

If a new shape is required, document it in this file and in feature notes before implementation.

### 5. Regression Gate

A feature is done only when all are true:

1. Existing Acceptance Criteria still pass.
2. Deterministic regeneration (same seed/config) still matches for form and timeline.
3. Scheduled notes remain inside voice tessiture.
4. Quantization guarantees are still respected.
5. The new feature behavior is documented in `GAP_CHECKLIST.md` under implemented or deferred.
