import { Motive } from './motive.js?v=2';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export class MotiveEngine {
  constructor() {
    this.leitmotivs = [];
  }

  generateMotive(harmonicState, prng, params = {}) {
    const minLength = clamp(params.minLength ?? 3, 2, 12);
    const maxLength = clamp(params.maxLength ?? 6, minLength, 12);
    const length = prng.randomInt(minLength, maxLength);
    const rhythmProfile = params.rhythmProfile || { 0.5: 0.35, 1: 0.4, 2: 0.2, 4: 0.05 };
    const durations = Object.keys(rhythmProfile).map(Number);
    const weights = Object.values(rhythmProfile).map(value => Number(value) || 0);

    const notes = [];
    let currentDegree = 0;

    for (let index = 0; index < length; index++) {
      if (index > 0) {
        currentDegree += prng.weightedPick([-2, -1, 0, 1, 2], [0.1, 0.2, 0.4, 0.2, 0.1]);
      }

      currentDegree = clamp(currentDegree, -4, 8);

      notes.push({
        degree: currentDegree,
        durationBeats: Number(prng.weightedPick(durations, weights)),
        velocity: 0.55 + prng.random() * 0.3
      });
    }

    return new Motive(notes);
  }

  generateLeitmotifs(count, harmonicState, prng, params = {}) {
    const targetCount = clamp(count ?? 2, 1, 2);
    this.leitmotivs = [];

    for (let index = 0; index < targetCount; index++) {
      const motive = this.generateMotive(harmonicState, prng, params);
      this.leitmotivs.push({
        id: index,
        name: `Leitmotiv ${index + 1}`,
        motive
      });
    }

    return this.getAllLeitmotivs();
  }

  selectTransformation(motive, section, prng) {
    const baseMotive = motive ? motive.clone() : new Motive();
    const allowed = Array.isArray(section.allowedTransformations) && section.allowedTransformations.length > 0
      ? section.allowedTransformations
      : ['transpose', 'fragment'];

    const weights = allowed.map(transformation => {
      switch (transformation) {
        case 'transpose':
          return 0.35 + (1 - section.tension) * 0.2;
        case 'fragment':
          return 0.2 + (1 - section.tension) * 0.1;
        case 'invert':
          return 0.1 + section.tension * 0.3;
        case 'retrograde':
          return 0.1 + section.tension * 0.25;
        case 'augment':
          return 0.1;
        case 'diminish':
          return 0.05;
        default:
          return 0.1;
      }
    });

    const selected = prng.weightedPick(allowed, weights);

    switch (selected) {
      case 'transpose':
        return baseMotive.transpose(prng.pick([-2, -1, 1, 2]));
      case 'fragment': {
        const start = prng.randomInt(0, Math.max(0, baseMotive.length - 2));
        const end = prng.randomInt(start + 1, baseMotive.length);
        return baseMotive.fragment(start, end);
      }
      case 'invert':
        return baseMotive.invert();
      case 'retrograde':
        return baseMotive.retrograde();
      case 'augment':
        return baseMotive.augment(2);
      case 'diminish':
        return baseMotive.diminish(2);
      default:
        return baseMotive;
    }
  }

  getLeitmotiv(index) {
    return this.leitmotivs[index]?.motive || null;
  }

  getAllLeitmotivs() {
    return this.leitmotivs.map(item => ({
      id: item.id,
      name: item.name,
      motive: item.motive.clone()
    }));
  }
}