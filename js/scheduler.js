import { HarmonicState } from './harmonic-state.js?v=3';

export class Scheduler {
  constructor() {
    this.timeline = null;
  }

  buildTimeline(form, voices, motiveEngine, voiceEngine, tonalEngine, prng, homeState) {
    const eventsByVoice = new Map(voices.map(voice => [voice.id, []]));
    const sectionsWithBeatRanges = [];
    const leitmotivs = motiveEngine.getAllLeitmotivs();

    let currentBeat = 0;

    form.forEach((section, sectionIndex) => {
      const sectionBeats = section.durationBars * 4;
      const harmonicState = new HarmonicState(section.targetTonic, section.targetMode);
      const progression = tonalEngine.generateProgression(section.type, harmonicState, prng, section.durationBars);
      const motiveEntry = leitmotivs[sectionIndex % leitmotivs.length];
      const baseMotive = motiveEntry?.motive || null;
      const transformedMotive = baseMotive ? motiveEngine.selectTransformation(baseMotive, section, prng) : null;

      const coordinated = transformedMotive
        ? voiceEngine.generateCoordinatedPhrases(voices, transformedMotive, harmonicState, section, prng, {
          progression,
          sectionBeats
        })
        : null;

      if (coordinated) {
        voices.forEach(voice => {
          if (voice.muted) return;
          const localEvents = coordinated.get(voice.id) || [];
          const absoluteEvents = localEvents
            .map(event => ({
              timeBeats: currentBeat + event.timeBeats,
              midiNote: event.midiNote,
              durationBeats: event.durationBeats,
              velocity: event.velocity
            }))
            .filter(event => event.timeBeats + event.durationBeats <= currentBeat + sectionBeats + 0.001);
          eventsByVoice.get(voice.id).push(...absoluteEvents);
        });
      } else {
        const localEventsByVoice = new Map();
        const enunciator = voices.find(voice => !voice.muted && voice.role === 'enunciator');

        if (enunciator && transformedMotive) {
          localEventsByVoice.set(
            enunciator.id,
            voiceEngine.generatePhrase(enunciator, baseMotive, harmonicState, { ...section, progression }, prng, {
              progression,
              transformedMotive,
              sectionBeats
            })
          );
        }

        voices.forEach(voice => {
          if (voice.muted) {
            return;
          }

          let localEvents = localEventsByVoice.get(voice.id);
          if (!localEvents) {
            localEvents = voiceEngine.generatePhrase(voice, baseMotive, harmonicState, { ...section, progression }, prng, {
              progression,
              transformedMotive,
              enunciatorEvents: localEventsByVoice.get(enunciator?.id) || [],
              sectionBeats
            });
          }

          const absoluteEvents = localEvents
            .map(event => ({
              timeBeats: currentBeat + event.timeBeats,
              midiNote: event.midiNote,
              durationBeats: event.durationBeats,
              velocity: event.velocity
            }))
            .filter(event => event.timeBeats + event.durationBeats <= currentBeat + sectionBeats + 0.001);

          eventsByVoice.get(voice.id).push(...absoluteEvents);
        });
      }

      sectionsWithBeatRanges.push({
        section: section.clone(),
        sectionIndex,
        startBeat: currentBeat,
        endBeat: currentBeat + sectionBeats
      });

      currentBeat += sectionBeats;
    });

    for (const voiceEvents of eventsByVoice.values()) {
      voiceEvents.sort((left, right) => left.timeBeats - right.timeBeats);
    }

    this.timeline = {
      eventsByVoice,
      sectionsWithBeatRanges,
      totalBeats: currentBeat,
      totalBars: Math.max(1, Math.ceil(currentBeat / 4)),
      homeState: homeState.clone()
    };

    return this.timeline;
  }

  getSectionAtBeat(beat) {
    if (!this.timeline) {
      return null;
    }

    return this.timeline.sectionsWithBeatRanges.find(entry => beat >= entry.startBeat && beat < entry.endBeat) || null;
  }

  getPlaybackPositionAtBeat(beat) {
    if (!this.timeline || !Number.isFinite(beat) || this.timeline.totalBeats <= 0) {
      return null;
    }

    const clampedBeat = Math.max(0, Math.min(beat, this.timeline.totalBeats - 0.0001));
    const sectionInfo = this.getSectionAtBeat(clampedBeat);
    if (!sectionInfo) {
      return null;
    }

    const sectionRelativeBeat = clampedBeat - sectionInfo.startBeat;
    return {
      beat: clampedBeat,
      section: sectionInfo.section,
      sectionIndex: sectionInfo.sectionIndex,
      sectionCount: this.timeline.sectionsWithBeatRanges.length,
      sectionStartBeat: sectionInfo.startBeat,
      sectionEndBeat: sectionInfo.endBeat,
      absoluteBarNumber: Math.min(this.timeline.totalBars, Math.floor(clampedBeat / 4) + 1),
      totalBars: this.timeline.totalBars,
      sectionBarNumber: Math.min(sectionInfo.section.durationBars, Math.floor(sectionRelativeBeat / 4) + 1),
      sectionTotalBars: sectionInfo.section.durationBars
    };
  }

  clear() {
    this.timeline = null;
  }
}