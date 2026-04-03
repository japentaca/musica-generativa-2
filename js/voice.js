export const ROLE_OPTIONS = ['auto', 'enunciator', 'imitator', 'accompanist'];
export const RESOLVED_ROLES = ['enunciator', 'imitator', 'accompanist'];
export const DEFAULT_INSTRUMENT_ID = 'synth';

export class Voice {
  constructor(id, config = {}) {
    this.id = id;
    this.name = config.name || `Voice ${id}`;
    this.roleOverride = ROLE_OPTIONS.includes(config.roleOverride) ? config.roleOverride : 'auto';
    this.role = RESOLVED_ROLES.includes(config.role) ? config.role : 'imitator';
    this.tessiture = {
      minOctave: Number.isFinite(config.minOctave) ? config.minOctave : 3,
      maxOctave: Number.isFinite(config.maxOctave) ? config.maxOctave : 5
    };
    this.volume = Number.isFinite(config.volume) ? config.volume : 80;
    this.pan = Number.isFinite(config.pan) ? config.pan : 0;
    this.reverbSend = Number.isFinite(config.reverbSend) ? config.reverbSend : 22;
    this.instrumentId = typeof config.instrumentId === 'string' && config.instrumentId.trim()
      ? config.instrumentId
      : DEFAULT_INSTRUMENT_ID;
    this.imitatorDelayBeats = Number.isFinite(config.imitatorDelayBeats) ? config.imitatorDelayBeats : 2;
    this.muted = Boolean(config.muted);
  }

  get tessitureMidiRange() {
    return {
      min: 12 * (this.tessiture.minOctave + 1),
      max: (12 * (this.tessiture.maxOctave + 2)) - 1
    };
  }

  fitMidiToTessiture(midiNote) {
    const range = this.tessitureMidiRange;
    if (!Number.isFinite(midiNote)) {
      return range.min;
    }

    let candidate = midiNote;

    while (candidate < range.min) {
      candidate += 12;
    }

    while (candidate > range.max) {
      candidate -= 12;
    }

    if (candidate < range.min) {
      return range.min;
    }

    if (candidate > range.max) {
      return range.max;
    }

    return candidate;
  }

  clone() {
    return new Voice(this.id, {
      name: this.name,
      roleOverride: this.roleOverride,
      role: this.role,
      minOctave: this.tessiture.minOctave,
      maxOctave: this.tessiture.maxOctave,
      volume: this.volume,
      pan: this.pan,
      reverbSend: this.reverbSend,
      instrumentId: this.instrumentId,
      imitatorDelayBeats: this.imitatorDelayBeats,
      muted: this.muted
    });
  }
}