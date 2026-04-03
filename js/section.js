export const SECTION_TYPES = [
  'intro', 'exposition', 'development', 'recapitulation', 'coda',
  'fugueExposition', 'fugueEpisode', 'fugueStretto',
  'dialogue'
];

const SECTION_COLORS = {
  intro: '#4a90d9',
  exposition: '#50c878',
  development: '#ffa500',
  recapitulation: '#e94560',
  coda: '#808080',
  fugueExposition: '#9b59b6',
  fugueEpisode: '#e67e22',
  fugueStretto: '#c0392b',
  dialogue: '#1abc9c'
};

export class Section {
  constructor(type, config = {}) {
    this.type = SECTION_TYPES.includes(type) ? type : 'exposition';
    this.durationBars = Section.normalizeDurationBars(this.type, config.durationBars);
    this.tension = Number.isFinite(config.tension) ? config.tension : 0.5;
    this.density = Number.isFinite(config.density) ? config.density : 0.5;
    this.targetTonic = Number.isFinite(config.targetTonic) ? config.targetTonic : 0;
    this.targetMode = config.targetMode || 'major';
    this.allowedTransformations = Array.isArray(config.allowedTransformations)
      ? [...config.allowedTransformations]
      : ['transpose', 'fragment'];
    this.modulationType = config.modulationType || 'static';
  }

  static defaultsForType(type) {
    const defaults = {
      intro: { minBars: 2, maxBars: 3 },
      exposition: { minBars: 4, maxBars: 6 },
      development: { minBars: 4, maxBars: 8 },
      recapitulation: { minBars: 4, maxBars: 6 },
      coda: { minBars: 2, maxBars: 4 },
      fugueExposition: { minBars: 6, maxBars: 10 },
      fugueEpisode: { minBars: 3, maxBars: 6 },
      fugueStretto: { minBars: 4, maxBars: 8 },
      dialogue: { minBars: 4, maxBars: 8 }
    };

    return defaults[type] || defaults.exposition;
  }

  static getAllowedDurationBars(type) {
    const defaults = Section.defaultsForType(type);
    const durations = [];

    for (let bars = 1; bars <= defaults.maxBars; bars *= 2) {
      if (bars >= defaults.minBars) {
        durations.push(bars);
      }
    }

    if (durations.length > 0) {
      return durations;
    }

    return [4];
  }

  static normalizeDurationBars(type, durationBars) {
    const allowedDurations = Section.getAllowedDurationBars(type);

    if (!Number.isFinite(durationBars)) {
      return allowedDurations[0];
    }

    return allowedDurations.reduce((closest, candidate) => {
      const candidateDistance = Math.abs(candidate - durationBars);
      const closestDistance = Math.abs(closest - durationBars);

      if (candidateDistance < closestDistance) {
        return candidate;
      }

      if (candidateDistance === closestDistance) {
        return candidate < closest ? candidate : closest;
      }

      return closest;
    }, allowedDurations[0]);
  }

  static getColorForType(type) {
    return SECTION_COLORS[type] || '#cccccc';
  }

  clone() {
    return new Section(this.type, {
      durationBars: this.durationBars,
      tension: this.tension,
      density: this.density,
      targetTonic: this.targetTonic,
      targetMode: this.targetMode,
      allowedTransformations: [...this.allowedTransformations],
      modulationType: this.modulationType
    });
  }
}