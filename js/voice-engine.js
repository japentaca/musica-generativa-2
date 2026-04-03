import { Voice } from './voice.js?v=4';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const VOICE_PRESETS = {
  2: [
    { minOctave: 2, maxOctave: 3, pan: -12, reverbSend: 16, instrumentId: 'CelloEnsSusVib' },
    { minOctave: 4, maxOctave: 5, pan: 12, reverbSend: 28, instrumentId: 'ViolinEnsSusVib' }
  ],
  3: [
    { minOctave: 2, maxOctave: 3, pan: -25, reverbSend: 12, instrumentId: 'Contrabass' },
    { minOctave: 3, maxOctave: 4, pan: 0, reverbSend: 20, instrumentId: 'CelloEnsSusVib' },
    { minOctave: 4, maxOctave: 5, pan: 25, reverbSend: 30, instrumentId: 'ViolinEnsSusVib' }
  ],
  4: [
    { minOctave: 2, maxOctave: 3, pan: -30, reverbSend: 10, instrumentId: 'Contrabass' },
    { minOctave: 3, maxOctave: 4, pan: -8, reverbSend: 18, instrumentId: 'CelloEnsSusVib' },
    { minOctave: 4, maxOctave: 5, pan: 8, reverbSend: 24, instrumentId: 'ViolaEnsSusVib' },
    { minOctave: 5, maxOctave: 6, pan: 30, reverbSend: 32, instrumentId: 'ViolinEnsSusVib' }
  ]
};

export class VoiceEngine {
  createVoices(count, previousVoices = []) {
    const targetCount = clamp(count, 2, 4);
    const presets = VOICE_PRESETS[targetCount];
    const voices = [];

    for (let index = 0; index < targetCount; index++) {
      const previous = previousVoices[index];
      if (previous) {
        voices.push(previous.clone());
        continue;
      }

      const preset = presets[index];
      voices.push(new Voice(index + 1, {
        name: `Voice ${index + 1}`,
        roleOverride: 'auto',
        minOctave: preset.minOctave,
        maxOctave: preset.maxOctave,
        volume: 78 - index * 4,
        pan: preset.pan,
        reverbSend: preset.reverbSend,
        instrumentId: preset.instrumentId,
        imitatorDelayBeats: 2 + (index % 2)
      }));
    }

    return voices;
  }

  assignRoles(voices) {
    voices.forEach(voice => {
      voice.role = 'imitator';
    });

    const fixedEnunciator = voices.find(voice => voice.roleOverride === 'enunciator');
    const enunciator = fixedEnunciator || [...voices].sort((left, right) => right.tessiture.maxOctave - left.tessiture.maxOctave)[0];
    if (enunciator) {
      enunciator.role = 'enunciator';
    }

    let accompanist = voices.find(voice => voice !== enunciator && voice.roleOverride === 'accompanist');
    if (!accompanist && voices.length >= 3) {
      accompanist = [...voices]
        .filter(voice => voice !== enunciator)
        .sort((left, right) => left.tessiture.minOctave - right.tessiture.minOctave)[0];
    }

    if (accompanist) {
      accompanist.role = 'accompanist';
    }

    voices.forEach(voice => {
      if (voice !== enunciator && voice !== accompanist) {
        voice.role = 'imitator';
      }
    });

    return voices;
  }

  generatePhrase(voice, motive, harmonicState, section, prng, context = {}) {
    switch (voice.role) {
      case 'enunciator':
        return this.generateEnunciatorPhrase(voice, motive, harmonicState, section, context.transformedMotive || motive);
      case 'imitator':
        return this.generateImitatorPhrase(voice, harmonicState, section, prng, context.enunciatorEvents || []);
      case 'accompanist':
        return this.generateAccompanistPhrase(voice, harmonicState, context.progression || [], section);
      default:
        return [];
    }
  }

  generateCoordinatedPhrases(voices, motive, harmonicState, section, prng, context = {}) {
    const activeVoices = voices.filter(v => !v.muted);
    if (activeVoices.length === 0 || !motive) return null;

    switch (section.type) {
      case 'fugueExposition':
        return this.generateFugueExpositionPhrases(activeVoices, motive, harmonicState, section, prng, context);
      case 'fugueEpisode':
        return this.generateFugueEpisodePhrases(activeVoices, motive, harmonicState, section, prng, context);
      case 'fugueStretto':
        return this.generateFugueStrettoPhrases(activeVoices, motive, harmonicState, section, prng, context);
      case 'dialogue':
        return this.generateDialoguePhrases(activeVoices, motive, harmonicState, section, prng, context);
      default:
        return null;
    }
  }

  generateFugueExpositionPhrases(voices, motive, harmonicState, section, prng, context) {
    const result = new Map();
    voices.forEach(v => result.set(v.id, []));

    const sectionBeats = section.durationBars * 4;
    const subjectDuration = motive.getTotalDurationBeats();
    const entryDelay = Math.max(subjectDuration, 4);
    const answer = motive.transpose(4);
    const countersubject = motive.invert();

    const sortedVoices = [...voices].sort((a, b) => b.tessiture.maxOctave - a.tessiture.maxOctave);

    sortedVoices.forEach((voice, voiceIndex) => {
      const entryBeat = voiceIndex * entryDelay;
      if (entryBeat >= sectionBeats) return;

      const isAnswer = voiceIndex % 2 === 1;
      const entryMotive = isAnswer ? answer : motive;
      const targetOctave = clamp(voice.tessiture.maxOctave - 1, voice.tessiture.minOctave, voice.tessiture.maxOctave);

      let offset = entryBeat;
      for (const note of entryMotive.notes) {
        if (offset + note.durationBeats > sectionBeats + 0.001) break;
        const rawMidi = harmonicState.degreeToMidi(note.degree, targetOctave);
        const fitted = this.fitNoteToVoice(voice, harmonicState, rawMidi);
        result.get(voice.id).push({
          timeBeats: offset,
          midiNote: fitted,
          durationBeats: note.durationBeats,
          velocity: this.scaleVelocity(note.velocity, voice.volume)
        });
        offset += note.durationBeats;
      }

      const csStart = entryBeat + subjectDuration;
      if (csStart < sectionBeats) {
        let csOffset = csStart;
        const csMotiveToUse = voiceIndex % 2 === 0 ? countersubject : motive.retrograde();
        for (const note of csMotiveToUse.notes) {
          if (csOffset + note.durationBeats > sectionBeats + 0.001) break;
          const rawMidi = harmonicState.degreeToMidi(note.degree, targetOctave);
          const fitted = this.fitNoteToVoice(voice, harmonicState, rawMidi);
          result.get(voice.id).push({
            timeBeats: csOffset,
            midiNote: fitted,
            durationBeats: note.durationBeats,
            velocity: this.scaleVelocity(note.velocity * 0.8, voice.volume)
          });
          csOffset += note.durationBeats;
        }
      }

      const freeStart = csStart + subjectDuration;
      if (freeStart < sectionBeats && voiceIndex < sortedVoices.length - 1) {
        let freeOffset = freeStart;
        const fragment = motive.fragment(0, Math.min(3, motive.length));
        const transposedFragment = fragment.transpose(prng.pick([-2, -1, 1, 2]));
        while (freeOffset < sectionBeats - 0.5) {
          let scheduledThisPass = false;
          for (const note of transposedFragment.notes) {
            if (freeOffset + note.durationBeats > sectionBeats + 0.001) break;
            const rawMidi = harmonicState.degreeToMidi(note.degree, targetOctave);
            const fitted = this.fitNoteToVoice(voice, harmonicState, rawMidi);
            result.get(voice.id).push({
              timeBeats: freeOffset,
              midiNote: fitted,
              durationBeats: note.durationBeats,
              velocity: this.scaleVelocity(note.velocity * 0.65, voice.volume)
            });
            freeOffset += note.durationBeats;
            scheduledThisPass = true;
          }
          if (transposedFragment.notes.length === 0 || !scheduledThisPass) break;
        }
      }
    });

    return result;
  }

  generateFugueEpisodePhrases(voices, motive, harmonicState, section, prng, context) {
    const result = new Map();
    voices.forEach(v => result.set(v.id, []));

    const sectionBeats = section.durationBars * 4;
    const fragment = motive.fragment(0, Math.min(3, motive.length));
    const fragmentDur = fragment.getTotalDurationBeats();
    const sortedVoices = [...voices].sort((a, b) => b.tessiture.maxOctave - a.tessiture.maxOctave);

    let globalOffset = 0;
    let transposition = 0;

    while (globalOffset < sectionBeats - 0.5) {
      let scheduledThisRound = false;
      for (let vi = 0; vi < sortedVoices.length; vi++) {
        if (globalOffset >= sectionBeats - 0.5) break;

        const voice = sortedVoices[vi];
        const targetOctave = clamp(voice.tessiture.maxOctave - 1, voice.tessiture.minOctave, voice.tessiture.maxOctave);
        const currentFragment = fragment.transpose(transposition);

        for (const note of currentFragment.notes) {
          if (globalOffset + note.durationBeats > sectionBeats + 0.001) break;
          const rawMidi = harmonicState.degreeToMidi(note.degree, targetOctave);
          const fitted = this.fitNoteToVoice(voice, harmonicState, rawMidi);
          result.get(voice.id).push({
            timeBeats: globalOffset,
            midiNote: fitted,
            durationBeats: note.durationBeats,
            velocity: this.scaleVelocity(note.velocity * 0.75, voice.volume)
          });
          globalOffset += note.durationBeats;
          scheduledThisRound = true;
        }

        transposition += prng.pick([1, -1, 2]);
      }

      if (fragmentDur === 0 || !scheduledThisRound) break;
    }

    return result;
  }

  generateFugueStrettoPhrases(voices, motive, harmonicState, section, prng, context) {
    const result = new Map();
    voices.forEach(v => result.set(v.id, []));

    const sectionBeats = section.durationBars * 4;
    const subjectDuration = motive.getTotalDurationBeats();
    if (!Number.isFinite(subjectDuration) || subjectDuration <= 0) {
      return result;
    }

    const strettoDelay = Math.max(1, Math.floor(subjectDuration / 2));
    const sortedVoices = [...voices].sort((a, b) => b.tessiture.maxOctave - a.tessiture.maxOctave);
    const maxRounds = Math.max(1, Math.ceil(sectionBeats / Math.max(1, strettoDelay)) + sortedVoices.length);

    let round = 0;
    while (round < maxRounds && round * strettoDelay * sortedVoices.length < sectionBeats) {
      const roundBase = round * subjectDuration * 1.5;
      if (roundBase >= sectionBeats) break;

      sortedVoices.forEach((voice, voiceIndex) => {
        const entryBeat = roundBase + voiceIndex * strettoDelay;
        if (entryBeat >= sectionBeats) return;

        const transposition = prng.pick([0, 0, 4, -3, 2]);
        const entryMotive = motive.transpose(transposition);
        const targetOctave = clamp(voice.tessiture.maxOctave - 1, voice.tessiture.minOctave, voice.tessiture.maxOctave);

        let offset = entryBeat;
        for (const note of entryMotive.notes) {
          if (offset + note.durationBeats > sectionBeats + 0.001) break;
          const rawMidi = harmonicState.degreeToMidi(note.degree, targetOctave);
          const fitted = this.fitNoteToVoice(voice, harmonicState, rawMidi);
          result.get(voice.id).push({
            timeBeats: offset,
            midiNote: fitted,
            durationBeats: note.durationBeats,
            velocity: this.scaleVelocity(note.velocity * (0.8 + round * 0.05), voice.volume)
          });
          offset += note.durationBeats;
        }
      });

      round++;
    }

    return result;
  }

  generateDialoguePhrases(voices, motive, harmonicState, section, prng, context) {
    const result = new Map();
    voices.forEach(v => result.set(v.id, []));

    const sectionBeats = section.durationBars * 4;
    const melodicVoices = [...voices].filter(v => v.role !== 'accompanist')
      .sort((a, b) => b.tessiture.maxOctave - a.tessiture.maxOctave);
    const accompanist = voices.find(v => v.role === 'accompanist');

    if (melodicVoices.length < 2) {
      return null;
    }

    const callDuration = motive.getTotalDurationBeats();
    if (!Number.isFinite(callDuration) || callDuration <= 0) {
      return result;
    }

    const restBetween = Math.max(0.5, Math.min(2, callDuration * 0.25));
    let globalOffset = 0;
    let callerIndex = 0;
    let exchangeCount = 0;
    let exchangeGuard = 0;

    const transformations = [
      m => m.transpose(prng.pick([-2, -1, 1, 2])),
      m => m.invert(),
      m => m.retrograde(),
      m => m.fragment(0, Math.max(2, Math.ceil(m.length * 0.6)))
    ];

    while (globalOffset < sectionBeats - 1) {
      if (exchangeGuard++ > 64) {
        break;
      }

      const previousOffset = globalOffset;
      const caller = melodicVoices[callerIndex % melodicVoices.length];
      const responder = melodicVoices[(callerIndex + 1) % melodicVoices.length];

      const callMotive = exchangeCount === 0 ? motive : transformations[exchangeCount % transformations.length](motive);
      const callerOctave = clamp(caller.tessiture.maxOctave - 1, caller.tessiture.minOctave, caller.tessiture.maxOctave);

      let offset = globalOffset;
      for (const note of callMotive.notes) {
        if (offset + note.durationBeats > sectionBeats + 0.001) break;
        const rawMidi = harmonicState.degreeToMidi(note.degree, callerOctave);
        const fitted = this.fitNoteToVoice(caller, harmonicState, rawMidi);
        result.get(caller.id).push({
          timeBeats: offset,
          midiNote: fitted,
          durationBeats: note.durationBeats,
          velocity: this.scaleVelocity(note.velocity, caller.volume)
        });
        offset += note.durationBeats;
      }

      const responseStart = globalOffset + callDuration + restBetween;
      if (responseStart >= sectionBeats) break;

      const responseTransform = prng.pick(transformations);
      const responseMotive = responseTransform(callMotive);
      const responseDuration = responseMotive.getTotalDurationBeats();
      if (!Number.isFinite(responseDuration) || responseDuration <= 0) {
        break;
      }

      const responderOctave = clamp(responder.tessiture.maxOctave - 1, responder.tessiture.minOctave, responder.tessiture.maxOctave);

      offset = responseStart;
      for (const note of responseMotive.notes) {
        if (offset + note.durationBeats > sectionBeats + 0.001) break;
        const rawMidi = harmonicState.degreeToMidi(note.degree, responderOctave);
        const fitted = this.fitNoteToVoice(responder, harmonicState, rawMidi);
        result.get(responder.id).push({
          timeBeats: offset,
          midiNote: fitted,
          durationBeats: note.durationBeats,
          velocity: this.scaleVelocity(note.velocity * 0.9, responder.volume)
        });
        offset += note.durationBeats;
      }

      globalOffset = responseStart + responseDuration + restBetween;
      if (globalOffset <= previousOffset) {
        break;
      }

      callerIndex++;
      exchangeCount++;
    }

    if (accompanist && context.progression) {
      const accEvents = this.generateAccompanistPhrase(accompanist, harmonicState, context.progression, section);
      result.set(accompanist.id, accEvents);
    }

    return result;
  }

  generateEnunciatorPhrase(voice, motive, harmonicState, section, transformedMotive) {
    if (!transformedMotive || transformedMotive.length === 0) {
      return [];
    }

    const events = [];
    const progression = section.progression || [];
    const targetOctave = clamp(voice.tessiture.maxOctave - 1, voice.tessiture.minOctave, voice.tessiture.maxOctave);
    let sectionOffset = 0;

    for (const chord of progression) {
      const blockBeats = chord.bars * 4;
      let blockOffset = 0;

      while (blockOffset < blockBeats - 0.001) {
        let scheduledDuringPass = false;

        for (const note of transformedMotive.notes) {
          if (blockOffset + note.durationBeats > blockBeats + 0.001) {
            continue;
          }

          const rawMidi = harmonicState.degreeToMidi(chord.degree + note.degree, targetOctave);
          const fitted = this.fitNoteToVoice(voice, harmonicState, rawMidi);

          events.push({
            timeBeats: sectionOffset + blockOffset,
            midiNote: fitted,
            durationBeats: note.durationBeats,
            velocity: this.scaleVelocity(note.velocity, voice.volume)
          });

          blockOffset += note.durationBeats;
          scheduledDuringPass = true;

          if (blockOffset >= blockBeats - 0.001) {
            break;
          }
        }

        if (!scheduledDuringPass) {
          break;
        }
      }

      sectionOffset += blockBeats;
    }

    return events;
  }

  generateImitatorPhrase(voice, harmonicState, section, prng, enunciatorEvents) {
    if (!enunciatorEvents.length) {
      return [];
    }

    const sectionBeats = section.durationBars * 4;
    const delay = voice.imitatorDelayBeats;
    const semitoneShift = prng.pick([0, 0, 2, -2]);

    return enunciatorEvents
      .map(event => {
        const shiftedNote = this.fitNoteToVoice(voice, harmonicState, event.midiNote + semitoneShift);
        return {
          timeBeats: event.timeBeats + delay,
          midiNote: shiftedNote,
          durationBeats: event.durationBeats,
          velocity: this.scaleVelocity(Math.max(0.2, event.velocity * 0.85), voice.volume)
        };
      })
      .filter(event => event.timeBeats < sectionBeats);
  }

  generateAccompanistPhrase(voice, harmonicState, progression, section) {
    const events = [];
    let sectionOffset = 0;
    const targetOctave = voice.tessiture.minOctave;

    for (const chord of progression) {
      for (let bar = 0; bar < chord.bars; bar++) {
        const barOffset = sectionOffset + bar * 4;
        const root = this.fitNoteToVoice(voice, harmonicState, harmonicState.degreeToMidi(chord.degree, targetOctave));
        const fifth = this.fitNoteToVoice(voice, harmonicState, harmonicState.degreeToMidi(chord.degree + 4, targetOctave));

        events.push({
          timeBeats: barOffset,
          midiNote: root,
          durationBeats: 2,
          velocity: this.scaleVelocity(0.72, voice.volume)
        });

        if (section.type !== 'intro') {
          events.push({
            timeBeats: barOffset + 2,
            midiNote: fifth,
            durationBeats: 2,
            velocity: this.scaleVelocity(0.62, voice.volume)
          });
        }
      }

      sectionOffset += chord.bars * 4;
    }

    return events;
  }

  fitNoteToVoice(voice, harmonicState, midiNote) {
    const fitted = voice.fitMidiToTessiture(midiNote);
    return voice.fitMidiToTessiture(harmonicState.quantizeMidi(fitted));
  }

  scaleVelocity(baseVelocity, voiceVolume) {
    return clamp(baseVelocity * (voiceVolume / 100), 0.1, 1);
  }
}