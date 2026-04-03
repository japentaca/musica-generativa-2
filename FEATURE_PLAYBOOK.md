# Feature Playbook

This guide defines how to add features without breaking determinism, architecture boundaries, or playback stability.

## Outcome Targets

A feature is considered complete only when it is:

- deterministic for same seed + same config
- implemented in the correct layer
- documented in project docs
- verified against baseline regression checks

## Fast Workflow

1. Classify scope.
2. Map module impact.
3. Define acceptance criteria.
4. Implement by layer.
5. Run regression checks.
6. Update docs.

## 1. Classify Scope

Use `SPEC.md` as source of truth.

- In-scope extension: feature improves current MVP boundaries.
- Deferred feature: feature touches currently deferred domains (WebMIDI, full SFZ or ARIAX support, infinite mode, etc).

If deferred, update `SPEC.md` first before coding.

## 2. Map Module Impact

Keep ownership explicit:

- `js/*.js` model and engine files: generation logic and state rules
- `js/scheduler.js`: timeline construction and section range ownership
- `js/audio-renderer.js`: synth and transport scheduling only
- `js/app.js`, `index.html`, `css/style.css`: controls, orchestration, and display only

## 3. Acceptance Criteria

Define exact behavior before writing code:

- input controls or config
- expected generated structure
- constraints (tessiture, quantization, role behavior)
- deferred behavior that is intentionally excluded

## 4. Implementation Rules

- Route all random choices through `PRNG`.
- Keep `Motive` and scheduled event contracts stable unless explicitly revised in docs.
- Do not put generation or harmonic logic inside UI event handlers.
- Do not generate events inside audio callbacks.
- Keep conversion from beats to audio-time inside renderer boundaries.

## 5. Regression Checks

- App boots without runtime errors.
- Play/stop remains stable.
- Same-seed outputs match for form and timeline.
- Scheduled notes remain in tessiture.
- Melodic events remain inside the active modal chord, including notes that cross a chord change.
- Section indicator still tracks transport progression.

## 6. Required Documentation Updates

For each accepted feature:

- Update `SPEC.md` if contract, scope, or invariants changed.
- Update `GAP_CHECKLIST.md` implemented/deferred status.
- Add a short entry to this file if the workflow changed.

## Suggested Feature Note Block

Use this block to record important feature decisions:

```md
### Feature: <name>
- Scope: <in-scope extension | deferred promoted>
- Files touched: <list>
- Contracts affected: <none | list>
- New invariants: <list>
- Verification summary: <short result>
```

### Feature: Metadata Sampler Playback
- Scope: deferred promoted to in-scope extension (metadata-listed instruments only)
- Files touched: `js/soundfont-catalog.js`, `js/audio-renderer.js`, `js/voice.js`, `js/voice-engine.js`, `js/app.js`, `soundfonts/metadata.json`
- Contracts affected: none (scheduled event shape unchanged)
- New invariants:
	- per-voice instrument selection must remain config-driven and deterministic
	- renderer may use synth or sampler source, but must consume precomputed events without inventing notes
	- sampler load failure must fall back to synth for the affected voice
- Verification summary: run browser boot, same-seed regeneration, play/stop stability, tessiture safety, section progress, and sampler fallback checks

### Feature: Transport Toggle, Bar Status, and Reverb Send
- Scope: in-scope extension
- Files touched: `index.html`, `css/style.css`, `js/app.js`, `js/scheduler.js`, `js/audio-renderer.js`, `js/voice.js`, `js/voice-engine.js`
- Contracts affected: `Voice` mix config now includes `reverbSend`; scheduler exposes playback-position metadata for bar display
- New invariants:
	- the start/stop control is a single UI toggle and must always reflect transport state
	- scheduler owns bar-position metadata so UI progress stays display-only
	- reverb send is renderer-only mix state and must not alter generated events or determinism
- Verification summary: run browser boot, deterministic regeneration, play/stop toggle stability, section and bar progress display, tessiture safety, and live reverb-send updates per voice

### Feature: Modal Chord Alignment
- Scope: in-scope extension
- Files touched: `js/harmonic-state.js`, `js/voice-engine.js`, `js/app.js`, `js/tonal-engine.js`, `js/scheduler.js`
- Contracts affected: harmonic helpers now expose chord-aware quantization and voice phrases preserve full-duration alignment with the active modal chord
- New invariants:
	- melodic events must resolve to chord tones from the current section progression, not only the section scale
	- notes that would span a chord change must split at the boundary so each sounding segment matches the active chord
	- same seed plus same config must still yield the same timeline after chord alignment
- Verification summary: run browser boot, deterministic multi-form audits, strict modal chord-segment checks, tessiture safety checks, and live play/stop with section progress updates

### Feature: Power-of-Two Section Durations
- Scope: in-scope extension
- Files touched: `js/section.js`, `js/formal-engine.js`, `js/app.js`
- Contracts affected: `Section.durationBars` is now normalized to power-of-two bar counts valid for the section type
- New invariants:
	- every generated section duration must be a power of two
	- section reconstruction and cloning must preserve the power-of-two duration invariant
	- same seed plus same config must still yield the same section duration sequence
- Verification summary: run browser boot, same-seed regeneration, form inspection for power-of-two durations, and play/stop stability
