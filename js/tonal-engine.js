import { HarmonicState } from './harmonic-state.js?v=2';

function cloneTarget(target) {
  return {
    targetTonic: target.targetTonic,
    targetMode: target.targetMode,
    modulationType: target.modulationType
  };
}

export class TonalEngine {
  getDominantTarget(state) {
    return {
      targetTonic: (state.tonic + 7) % 12,
      targetMode: state.mode,
      modulationType: 'dominant'
    };
  }

  getSubdominantTarget(state) {
    return {
      targetTonic: (state.tonic + 5) % 12,
      targetMode: state.mode,
      modulationType: 'subdominant'
    };
  }

  getRelativeTarget(state) {
    if (state.mode === 'major') {
      return {
        targetTonic: (state.tonic + 9) % 12,
        targetMode: 'minor',
        modulationType: 'relative'
      };
    }

    return {
      targetTonic: (state.tonic + 3) % 12,
      targetMode: 'major',
      modulationType: 'relative'
    };
  }

  planSectionTarget(sectionType, currentState, homeState, prng) {
    if (sectionType === 'intro' || sectionType === 'exposition' || sectionType === 'fugueExposition') {
      return {
        targetTonic: homeState.tonic,
        targetMode: homeState.mode,
        modulationType: 'static'
      };
    }

    if (sectionType === 'recapitulation' || sectionType === 'coda' || sectionType === 'fugueStretto') {
      return {
        targetTonic: homeState.tonic,
        targetMode: homeState.mode,
        modulationType: currentState.tonic === homeState.tonic && currentState.mode === homeState.mode ? 'static' : 'dominant'
      };
    }

    if (sectionType === 'dialogue') {
      const options = [
        {
          targetTonic: currentState.tonic,
          targetMode: currentState.mode,
          modulationType: 'static'
        },
        this.getDominantTarget(currentState),
        this.getRelativeTarget(currentState)
      ];

      const selected = prng.weightedPick(options, [0.4, 0.35, 0.25]);
      return cloneTarget(selected);
    }

    const options = [
      {
        targetTonic: currentState.tonic,
        targetMode: currentState.mode,
        modulationType: 'static'
      },
      this.getDominantTarget(currentState),
      this.getSubdominantTarget(currentState),
      this.getRelativeTarget(currentState)
    ];

    const selected = prng.weightedPick(options, [0.15, 0.4, 0.2, 0.25]);
    return cloneTarget(selected);
  }

  generateProgression(sectionType, harmonicState, prng, durationBars = 4) {
    const templates = {
      major: {
        intro: [[0, 4], [0, 3]],
        exposition: [[0, 3, 4, 0], [0, 4, 3, 0], [0, 1, 4, 0]],
        development: [[0, 4, 1, 5], [5, 2, 4, 1], [0, 5, 3, 4]],
        recapitulation: [[0, 3, 4, 0], [0, 4, 3, 0]],
        coda: [[4, 0], [3, 4, 0]],
        fugueExposition: [[0, 4, 0, 4], [0, 0, 4, 0]],
        fugueEpisode: [[1, 4, 2, 5], [3, 6, 2, 5], [0, 3, 1, 4]],
        fugueStretto: [[0, 4, 0], [0, 3, 4, 0]],
        dialogue: [[0, 4, 0, 4], [0, 3, 4, 0], [0, 5, 3, 4]]
      },
      minor: {
        intro: [[0, 4], [0, 5]],
        exposition: [[0, 3, 4, 0], [0, 4, 5, 0], [0, 5, 4, 0]],
        development: [[0, 4, 6, 3], [5, 2, 4, 1], [0, 5, 3, 4]],
        recapitulation: [[0, 3, 4, 0], [0, 5, 4, 0]],
        coda: [[4, 0], [5, 4, 0]],
        fugueExposition: [[0, 4, 0, 4], [0, 0, 4, 0]],
        fugueEpisode: [[1, 4, 2, 5], [5, 2, 4, 1], [0, 3, 1, 4]],
        fugueStretto: [[0, 4, 0], [0, 5, 4, 0]],
        dialogue: [[0, 4, 0, 4], [0, 5, 4, 0], [0, 3, 5, 0]]
      }
    };

    const modeTemplates = templates[harmonicState.mode] || templates.major;
    const sequence = prng.pick(modeTemplates[sectionType] || modeTemplates.exposition);
    return this.spreadBars(sequence, durationBars);
  }

  spreadBars(sequence, durationBars) {
    if (durationBars <= 0 || sequence.length === 0) {
      return [];
    }

    if (durationBars < sequence.length) {
      return sequence.slice(0, durationBars).map(degree => ({ degree, bars: 1 }));
    }

    const baseBars = Math.floor(durationBars / sequence.length);
    const remainder = durationBars % sequence.length;

    return sequence.map((degree, index) => ({
      degree,
      bars: baseBars + (index < remainder ? 1 : 0)
    }));
  }

  createStateForSection(section) {
    return new HarmonicState(section.targetTonic, section.targetMode);
  }
}