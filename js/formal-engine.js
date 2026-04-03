import { Section } from './section.js?v=2';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export class FormalEngine {
  generateForm(prng, params = {}) {
    const formType = params.formType || 'sonata';
    const sectionCount = clamp(params.sectionCount ?? prng.randomInt(4, 6), 3, 30);
    const arcIntensity = clamp(params.arcIntensity ?? 0.65, 0, 1);
    const homeState = params.homeState;
    const tonalEngine = params.tonalEngine;

    let types;
    if (formType === 'fugue') {
      types = this.buildFugueSequence(sectionCount, prng);
    } else if (formType === 'dialogue') {
      types = this.buildDialogueSequence(sectionCount, prng);
    } else if (formType === 'free') {
      types = this.buildFreeSequence(sectionCount, prng);
    } else {
      const includeIntro = params.includeIntro ?? (sectionCount >= 5 && prng.random() < 0.5);
      const includeCoda = params.includeCoda ?? (sectionCount >= 5 && prng.random() < 0.5);
      types = this.buildTypeSequence(sectionCount, includeIntro, includeCoda);
    }

    const form = types.map(type => this.createSection(type, prng));

    this.applyArc(form, arcIntensity);
    this.assignTransformations(form);

    if (homeState && tonalEngine) {
      this.assignTargets(form, tonalEngine, homeState, prng);
    }

    return form;
  }

  buildTypeSequence(sectionCount, includeIntro, includeCoda) {
    const types = [];
    if (includeIntro) {
      types.push('intro');
    }

    types.push('exposition');

    const reservedSlots = types.length + 1 + (includeCoda ? 1 : 0);
    const developmentCount = Math.max(1, sectionCount - reservedSlots);

    for (let index = 0; index < developmentCount; index++) {
      types.push('development');
    }

    types.push('recapitulation');

    if (includeCoda) {
      types.push('coda');
    }

    while (types.length > sectionCount) {
      const developmentIndex = types.lastIndexOf('development');
      if (developmentIndex > -1) {
        types.splice(developmentIndex, 1);
      } else if (types[0] === 'intro') {
        types.shift();
      } else if (types[types.length - 1] === 'coda') {
        types.pop();
      } else {
        break;
      }
    }

    while (types.length < sectionCount) {
      const recapIndex = types.lastIndexOf('recapitulation');
      types.splice(recapIndex, 0, 'development');
    }

    return types;
  }

  buildFugueSequence(sectionCount, prng) {
    const types = ['fugueExposition'];
    const targetInner = Math.max(0, sectionCount - 3);

    for (let i = 0; i < targetInner; i++) {
      types.push(i % 2 === 0 ? 'fugueEpisode' : 'fugueExposition');
    }

    types.push('fugueStretto');
    types.push('coda');

    while (types.length > sectionCount && types.length > 3) {
      const episodeIndex = types.lastIndexOf('fugueEpisode');
      if (episodeIndex > -1) {
        types.splice(episodeIndex, 1);
      } else {
        const expoIndex = types.indexOf('fugueExposition', 1);
        if (expoIndex > -1 && expoIndex < types.length - 2) {
          types.splice(expoIndex, 1);
        } else {
          break;
        }
      }
    }

    while (types.length < sectionCount) {
      const strettoIndex = types.indexOf('fugueStretto');
      types.splice(strettoIndex, 0, prng.random() < 0.5 ? 'fugueEpisode' : 'fugueExposition');
    }

    return types;
  }

  buildDialogueSequence(sectionCount, prng) {
    const types = [];
    if (sectionCount >= 5 && prng.random() < 0.5) {
      types.push('intro');
    }

    types.push('dialogue');

    const reservedEnd = 1 + (sectionCount >= 5 && prng.random() < 0.5 ? 1 : 0);
    const inner = Math.max(0, sectionCount - types.length - reservedEnd);

    for (let i = 0; i < inner; i++) {
      types.push(i % 2 === 0 ? 'development' : 'dialogue');
    }

    types.push('dialogue');

    if (types.length < sectionCount) {
      types.push('coda');
    }

    while (types.length > sectionCount && types.length > 3) {
      const devIndex = types.lastIndexOf('development');
      if (devIndex > -1) {
        types.splice(devIndex, 1);
      } else {
        const diaIndex = types.indexOf('dialogue', 1);
        if (diaIndex > -1 && diaIndex < types.length - 1) {
          types.splice(diaIndex, 1);
        } else {
          break;
        }
      }
    }

    while (types.length < sectionCount) {
      const lastDialogue = types.lastIndexOf('dialogue');
      types.splice(lastDialogue, 0, prng.random() < 0.5 ? 'dialogue' : 'development');
    }

    return types;
  }

  buildFreeSequence(sectionCount, prng) {
    const allTypes = [
      'exposition', 'development', 'dialogue',
      'fugueExposition', 'fugueEpisode'
    ];

    const types = [prng.pick(['exposition', 'fugueExposition', 'dialogue'])];

    for (let i = 1; i < sectionCount - 1; i++) {
      types.push(prng.pick(allTypes));
    }

    types.push(prng.pick(['recapitulation', 'fugueStretto', 'coda']));
    return types;
  }

  createSection(type, prng) {
    const defaults = Section.defaultsForType(type);
    return new Section(type, {
      durationBars: prng.randomInt(defaults.minBars, defaults.maxBars)
    });
  }

  applyArc(form, arcIntensity) {
    const baseByType = {
      intro: { tension: 0.2, density: 0.3 },
      exposition: { tension: 0.35, density: 0.45 },
      development: { tension: 0.7, density: 0.7 },
      recapitulation: { tension: 0.4, density: 0.5 },
      coda: { tension: 0.25, density: 0.35 },
      fugueExposition: { tension: 0.4, density: 0.5 },
      fugueEpisode: { tension: 0.6, density: 0.6 },
      fugueStretto: { tension: 0.85, density: 0.85 },
      dialogue: { tension: 0.5, density: 0.55 }
    };

    form.forEach((section, index) => {
      const progress = form.length === 1 ? 0 : index / (form.length - 1);
      const curve = Math.sin(progress * Math.PI);
      const base = baseByType[section.type] || baseByType.exposition;
      section.tension = clamp(base.tension * 0.6 + curve * (0.35 + 0.25 * arcIntensity), 0, 1);
      section.density = clamp(base.density * 0.65 + curve * (0.25 + 0.15 * arcIntensity), 0, 1);
    });
  }

  assignTransformations(form) {
    form.forEach(section => {
      if (section.type === 'development' || section.type === 'fugueEpisode') {
        section.allowedTransformations = ['transpose', 'fragment', 'invert', 'retrograde', 'augment'];
      } else if (section.type === 'coda') {
        section.allowedTransformations = ['transpose', 'fragment'];
      } else if (section.type === 'fugueExposition') {
        section.allowedTransformations = ['transpose', 'invert'];
      } else if (section.type === 'fugueStretto') {
        section.allowedTransformations = ['transpose', 'invert', 'retrograde', 'diminish'];
      } else if (section.type === 'dialogue') {
        section.allowedTransformations = ['transpose', 'invert', 'retrograde', 'fragment'];
      } else {
        section.allowedTransformations = ['transpose', 'fragment', 'retrograde'];
      }
    });
  }

  assignTargets(form, tonalEngine, homeState, prng) {
    let currentState = homeState.clone();

    form.forEach((section, index) => {
      const planned = tonalEngine.planSectionTarget(section.type, currentState, homeState, prng);
      section.targetTonic = planned.targetTonic;
      section.targetMode = planned.targetMode;
      section.modulationType = planned.modulationType;
      currentState.modulate(section.targetTonic, section.targetMode, index);
    });
  }

  visualizeForm(form) {
    return form.map(section => ({
      type: section.type,
      durationBars: section.durationBars,
      tension: section.tension,
      density: section.density,
      targetMode: section.targetMode,
      color: Section.getColorForType(section.type)
    }));
  }
}