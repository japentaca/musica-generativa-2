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
    this.durationBars = Number.isFinite(config.durationBars) ? config.durationBars : 4;
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