export const TONICS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const MODES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10]
};

function mod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

export class HarmonicState {
  constructor(tonic = 0, mode = 'major', currentDegree = 0) {
    this.tonic = mod(tonic, 12);
    this.mode = MODES[mode] ? mode : 'major';
    this.currentDegree = currentDegree;
    this.history = [{ tonic: this.tonic, mode: this.mode, atBar: 0 }];
  }

  getScalePitchClasses() {
    return MODES[this.mode].map(interval => mod(this.tonic + interval, 12));
  }

  degreeToPitchClass(degree) {
    const intervals = MODES[this.mode];
    return mod(this.tonic + intervals[mod(degree, intervals.length)], 12);
  }

  getTriadDegrees(degree) {
    return [degree, degree + 2, degree + 4];
  }

  getChordPitchClasses(degree) {
    return this.getTriadDegrees(degree).map(scaleDegree => this.degreeToPitchClass(scaleDegree));
  }

  quantizeMidiToPitchClasses(midiNote, pitchClasses) {
    const normalizedPitchClasses = Array.from(new Set(pitchClasses.map(pitchClass => mod(pitchClass, 12))));
    if (normalizedPitchClasses.length === 0) {
      return midiNote;
    }

    const baseOctave = Math.floor(midiNote / 12);
    let bestNote = midiNote;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let octave = baseOctave - 1; octave <= baseOctave + 1; octave++) {
      for (const pitchClass of normalizedPitchClasses) {
        const candidate = octave * 12 + pitchClass;
        const distance = Math.abs(candidate - midiNote);
        if (distance < bestDistance || (distance === bestDistance && candidate < bestNote)) {
          bestDistance = distance;
          bestNote = candidate;
        }
      }
    }

    return bestNote;
  }

  quantizeMidi(midiNote) {
    return this.quantizeMidiToPitchClasses(midiNote, this.getScalePitchClasses());
  }

  quantizeMidiToChord(midiNote, chordDegree) {
    return this.quantizeMidiToPitchClasses(midiNote, this.getChordPitchClasses(chordDegree));
  }

  degreeToMidi(degree, octave) {
    const intervals = MODES[this.mode];
    const octaveOffset = Math.floor(degree / intervals.length);
    const scaleIndex = mod(degree, intervals.length);
    return 12 * (octave + octaveOffset + 1) + this.tonic + intervals[scaleIndex];
  }

  snapDegreeToChordTone(degree, chordDegree) {
    const scaleLength = MODES[this.mode].length;
    const triadDegrees = this.getTriadDegrees(chordDegree);
    const octaveBand = Math.floor(degree / scaleLength);

    let bestDegree = triadDegrees[0];
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let octaveOffset = octaveBand - 1; octaveOffset <= octaveBand + 1; octaveOffset++) {
      for (const triadDegree of triadDegrees) {
        const candidate = triadDegree + octaveOffset * scaleLength;
        const distance = Math.abs(candidate - degree);
        if (distance < bestDistance || (distance === bestDistance && candidate < bestDegree)) {
          bestDistance = distance;
          bestDegree = candidate;
        }
      }
    }

    return bestDegree;
  }

  degreeToChordMidi(degree, chordDegree, octave) {
    return this.degreeToMidi(this.snapDegreeToChordTone(degree, chordDegree), octave);
  }

  getTriadMidi(degree, octave) {
    return this.getTriadDegrees(degree).map(scaleDegree => this.degreeToMidi(scaleDegree, octave));
  }

  modulate(targetTonic, targetMode, atBar = 0) {
    this.tonic = mod(targetTonic, 12);
    this.mode = MODES[targetMode] ? targetMode : this.mode;
    this.currentDegree = 0;
    this.history.push({ tonic: this.tonic, mode: this.mode, atBar });
    return this;
  }

  clone() {
    const cloned = new HarmonicState(this.tonic, this.mode, this.currentDegree);
    cloned.history = this.history.map(entry => ({ ...entry }));
    return cloned;
  }

  toString() {
    return `${TONICS[this.tonic]} ${this.mode}`;
  }
}