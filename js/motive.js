function normalizeDurationBeats(durationBeats) {
  return Math.max(0.25, Math.round(durationBeats * 4) / 4);
}

export class Motive {
  constructor(notes = []) {
    this.notes = notes.map(note => ({
      degree: Number(note.degree) || 0,
      durationBeats: normalizeDurationBeats(Number(note.durationBeats) || 1),
      velocity: Math.max(0, Math.min(1, Number(note.velocity) || 0.75))
    }));
  }

  get length() {
    return this.notes.length;
  }

  transpose(scaleSteps) {
    return new Motive(this.notes.map(note => ({
      ...note,
      degree: note.degree + scaleSteps
    })));
  }

  invert() {
    if (this.notes.length < 2) {
      return this.clone();
    }

    const pivot = this.notes[0].degree;
    return new Motive(this.notes.map(note => ({
      ...note,
      degree: pivot - (note.degree - pivot)
    })));
  }

  retrograde() {
    return new Motive([...this.notes].reverse().map(note => ({ ...note })));
  }

  augment(factor) {
    return new Motive(this.notes.map(note => ({
      ...note,
      durationBeats: normalizeDurationBeats(note.durationBeats * factor)
    })));
  }

  diminish(factor) {
    if (!factor) {
      return this.clone();
    }

    return new Motive(this.notes.map(note => ({
      ...note,
      durationBeats: normalizeDurationBeats(note.durationBeats / factor)
    })));
  }

  fragment(start, end) {
    const startIndex = Math.max(0, Math.min(this.notes.length - 1, start));
    const endIndex = Math.max(startIndex + 1, Math.min(this.notes.length, end));
    return new Motive(this.notes.slice(startIndex, endIndex).map(note => ({ ...note })));
  }

  getTotalDurationBeats() {
    return this.notes.reduce((sum, note) => sum + note.durationBeats, 0);
  }

  clone() {
    return new Motive(this.notes.map(note => ({ ...note })));
  }
}