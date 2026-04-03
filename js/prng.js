function createFallbackRng(seedText) {
  let state = 2166136261;

  for (let index = 0; index < seedText.length; index++) {
    state ^= seedText.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function resolveSeedrandomRng(seedText) {
  const candidates = [];

  if (typeof globalThis.seedrandom === 'function') {
    candidates.push(globalThis.seedrandom);
  }

  if (typeof Math.seedrandom === 'function' && Math.seedrandom !== globalThis.seedrandom) {
    candidates.push(Math.seedrandom);
  }

  for (const factory of candidates) {
    try {
      const constructed = new factory(seedText);
      if (typeof constructed === 'function') {
        return constructed;
      }
    } catch {
    }

    try {
      const direct = factory(seedText, { global: false });
      if (typeof direct === 'function') {
        return direct;
      }
    } catch {
    }

    try {
      const direct = factory(seedText);
      if (typeof direct === 'function') {
        return direct;
      }
    } catch {
    }
  }

  return null;
}

export class PRNG {
  constructor(seed = 1) {
    this.setSeed(seed);
  }

  setSeed(seed) {
    this.seed = String(seed);

    const seededRng = resolveSeedrandomRng(this.seed);
    if (typeof seededRng === 'function') {
      this.rng = seededRng;
      return;
    }

    this.rng = createFallbackRng(this.seed);
  }

  random() {
    if (typeof this.rng !== 'function') {
      this.rng = createFallbackRng(this.seed);
    }

    return this.rng();
  }

  randomInt(min, max) {
    const lower = Math.ceil(Math.min(min, max));
    const upper = Math.floor(Math.max(min, max));
    return Math.floor(this.random() * (upper - lower + 1)) + lower;
  }

  pick(array) {
    if (!Array.isArray(array) || array.length === 0) {
      throw new Error('Cannot pick from an empty array');
    }
    return array[this.randomInt(0, array.length - 1)];
  }

  weightedPick(array, weights) {
    if (!Array.isArray(array) || !Array.isArray(weights) || array.length !== weights.length || array.length === 0) {
      throw new Error('weightedPick expects equally-sized non-empty arrays');
    }

    const totalWeight = weights.reduce((sum, weight) => sum + Math.max(0, Number(weight) || 0), 0);
    if (totalWeight <= 0) {
      return this.pick(array);
    }

    let remaining = this.random() * totalWeight;
    for (let index = 0; index < array.length; index++) {
      remaining -= Math.max(0, Number(weights[index]) || 0);
      if (remaining <= 0) {
        return array[index];
      }
    }

    return array[array.length - 1];
  }
}