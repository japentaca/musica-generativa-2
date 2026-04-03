const DEFAULT_LIBRARY_NAME = 'VSCO-2-CE-1.1.0';
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const SYNTH_INSTRUMENT_ID = 'synth';
export const SYNTH_INSTRUMENT_OPTION = {
  id: SYNTH_INSTRUMENT_ID,
  label: 'Synth (Triangle)',
  source: 'synth'
};

function midiToNoteName(midiNote) {
  const safeMidi = Math.max(0, Math.min(127, Math.round(midiNote)));
  const name = NOTE_NAMES[safeMidi % 12];
  const octave = Math.floor(safeMidi / 12) - 1;
  return `${name}${octave}`;
}

function formatInstrumentLabel(instrumentId) {
  return instrumentId
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
}

function encodePathForUrl(path) {
  return path
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
}

export class SoundfontCatalog {
  constructor(options = {}) {
    this.metadataUrl = options.metadataUrl || 'soundfonts/metadata.json';
    this.preferredLibrary = options.preferredLibrary || DEFAULT_LIBRARY_NAME;
    this.metadata = null;
    this.library = null;
    this.loadingPromise = null;
  }

  async load() {
    if (this.library) {
      return this.library;
    }

    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = fetch(this.metadataUrl)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to load soundfont metadata (${response.status})`);
        }

        return response.json();
      })
      .then(metadata => {
        this.metadata = metadata;
        this.library = this.resolveLibrary(metadata);
        return this.library;
      })
      .finally(() => {
        this.loadingPromise = null;
      });

    return this.loadingPromise;
  }

  async getInstrumentOptions() {
    const library = await this.load();
    const instrumentIds = Object.keys(library.instruments || {}).sort((left, right) => left.localeCompare(right));
    const samplerOptions = instrumentIds.map(instrumentId => ({
      id: instrumentId,
      label: formatInstrumentLabel(instrumentId),
      source: 'sampler'
    }));

    return [SYNTH_INSTRUMENT_OPTION, ...samplerOptions];
  }

  async getSamplerDefinition(instrumentId) {
    if (!instrumentId || instrumentId === SYNTH_INSTRUMENT_ID) {
      return null;
    }

    const library = await this.load();
    const instrument = library.instruments?.[instrumentId];
    if (!instrument) {
      throw new Error(`Unknown sampler instrument: ${instrumentId}`);
    }

    const articulation = instrument.articulations?.[0];
    if (!articulation || !articulation.samples) {
      throw new Error(`Instrument has no playable articulation: ${instrumentId}`);
    }

    const urls = this.buildSamplerUrls(articulation.samples);
    if (Object.keys(urls).length === 0) {
      throw new Error(`Instrument has no mapped samples: ${instrumentId}`);
    }

    return {
      instrumentId,
      urls,
      baseUrl: `${this.resolveBasePath(library.basePath)}/`
    };
  }

  buildSamplerUrls(samplesByNote) {
    const urls = {};
    const seenRoots = new Set();

    Object.values(samplesByNote).forEach(sample => {
      const root = Number(sample?.root);
      const rawPath = typeof sample?.path === 'string' ? sample.path : '';
      if (!Number.isFinite(root) || !rawPath) {
        return;
      }

      if (seenRoots.has(root)) {
        return;
      }

      seenRoots.add(root);
      const normalizedPath = rawPath.replace(/\\/g, '/');
      urls[midiToNoteName(root)] = encodePathForUrl(normalizedPath);
    });

    return urls;
  }

  resolveBasePath(basePath) {
    const normalized = typeof basePath === 'string'
      ? basePath.replace(/\\/g, '/').replace(/\/+$/, '')
      : '';

    if (!normalized) {
      return 'soundfonts';
    }

    if (normalized === 'soundfonts/VSCO-2-CE-1.1.0') {
      return 'soundfonts';
    }

    return normalized;
  }

  resolveLibrary(metadata) {
    const catalog = metadata?.catalog;
    if (!catalog || typeof catalog !== 'object') {
      throw new Error('Soundfont metadata does not contain a valid catalog object');
    }

    if (catalog[this.preferredLibrary]) {
      return catalog[this.preferredLibrary];
    }

    const [firstLibraryName] = Object.keys(catalog);
    if (!firstLibraryName) {
      throw new Error('Soundfont catalog is empty');
    }

    return catalog[firstLibraryName];
  }
}
