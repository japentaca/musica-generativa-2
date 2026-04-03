import { SoundfontCatalog, SYNTH_INSTRUMENT_ID, SYNTH_INSTRUMENT_OPTION } from './soundfont-catalog.js?v=2';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export class AudioRenderer {
  constructor(options = {}) {
    this.initialized = false;
    this.voiceNodes = new Map();
    this.parts = new Map();
    this.instrumentOptions = [SYNTH_INSTRUMENT_OPTION];
    this.masterLimiter = null;
    this.masterBus = null;
    this.reverbSendBus = null;
    this.reverbBus = null;
    this.reverbReturnGain = null;
    this.reverbReturnDb = Number.isFinite(options.reverbReturnDb) ? options.reverbReturnDb : 12;
    this.reverbSendBoost = Number.isFinite(options.reverbSendBoost)
      ? clamp(options.reverbSendBoost, 1, 3)
      : 1.8;
    this.samplerLoadTimeoutMs = Number.isFinite(options.samplerLoadTimeoutMs) ? options.samplerLoadTimeoutMs : 8000;
    this.sourceTrimDbByKey = new Map();
    this.calibrationSettings = {
      targetDb: Number.isFinite(options.sourceCalibrationTargetDb) ? options.sourceCalibrationTargetDb : -22,
      minTrimDb: Number.isFinite(options.sourceCalibrationMinTrimDb) ? options.sourceCalibrationMinTrimDb : -18,
      maxTrimDb: Number.isFinite(options.sourceCalibrationMaxTrimDb) ? options.sourceCalibrationMaxTrimDb : 6,
      note: typeof options.sourceCalibrationNote === 'string' && options.sourceCalibrationNote.trim()
        ? options.sourceCalibrationNote.trim()
        : 'C4',
      durationSeconds: Number.isFinite(options.sourceCalibrationDurationSeconds)
        ? Math.max(0.05, options.sourceCalibrationDurationSeconds)
        : 0.35,
      velocity: Number.isFinite(options.sourceCalibrationVelocity)
        ? clamp(options.sourceCalibrationVelocity, 0.05, 1)
        : 0.8
    };
    this.soundfontCatalog = new SoundfontCatalog({
      metadataUrl: options.soundfontMetadataUrl || 'soundfonts/metadata.json'
    });
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    if (typeof Tone === 'undefined') {
      throw new Error('Tone.js is required for playback');
    }

    if (!this.masterLimiter) {
      this.masterLimiter = new Tone.Limiter(-1).toDestination();
    }

    if (!this.masterBus) {
      this.masterBus = new Tone.Gain(1).connect(this.masterLimiter);
    }

    if (!this.reverbSendBus) {
      this.reverbSendBus = new Tone.Gain(1);
    }

    if (!this.reverbReturnGain) {
      this.reverbReturnGain = new Tone.Gain(Tone.dbToGain(this.reverbReturnDb)).connect(this.masterBus);
    }

    if (!this.reverbBus) {
      this.reverbBus = new Tone.Freeverb({
        roomSize: 0.82,
        dampening: 2800,
        wet: 1
      }).connect(this.reverbReturnGain);
    }

    this.reverbSendBus.connect(this.reverbBus);

    try {
      this.instrumentOptions = await this.soundfontCatalog.getInstrumentOptions();
    } catch (error) {
      this.instrumentOptions = [SYNTH_INSTRUMENT_OPTION];
      console.warn('Soundfont metadata failed to load. Synth fallback only.', error);
    }

    this.initialized = true;
  }

  async getInstrumentOptions() {
    await this.initialize();
    return this.instrumentOptions.map(option => ({ ...option }));
  }

  async setupVoices(voices) {
    await this.initialize();

    const wantedIds = new Set(voices.map(voice => voice.id));
    for (const [voiceId] of this.voiceNodes) {
      if (!wantedIds.has(voiceId)) {
        this.disposeVoice(voiceId);
      }
    }

    await Promise.all(voices.map(voice => this.setupVoice(voice)));
  }

  async setupVoice(voice) {
    const requestedInstrumentId = this.normalizeInstrumentId(voice.instrumentId);
    const existing = this.voiceNodes.get(voice.id);
    if (existing && existing.requestedInstrumentId === requestedInstrumentId) {
      existing.voice = voice;
      this.applyMix(existing);
      return existing;
    }

    if (existing) {
      this.disposeVoice(voice.id);
    }

    const channelInput = new Tone.Gain(1);
    const channelFader = new Tone.Gain(this.volumeToGain(voice.volume));
    const channelPan = new Tone.Panner(voice.pan / 100).connect(this.masterBus);
    const sendGain = new Tone.Gain(this.sendToGain(voice.reverbSend)).connect(this.reverbSendBus);

    // Console-like strip: input -> fader; fader fans out to dry pan path + post-fader aux send.
    channelInput.connect(channelFader);
    channelFader.connect(channelPan);
    channelFader.connect(sendGain);

    const sourceBundle = await this.createVoiceSource(requestedInstrumentId);
    const sourceKey = `${sourceBundle.sourceType}:${sourceBundle.resolvedInstrumentId}`;
    const sourceTrimDb = await this.getOrCreateSourceTrimDb(sourceBundle.source, sourceKey, sourceBundle.calibrationNote);
    const sourceGain = new Tone.Gain(Tone.dbToGain(sourceTrimDb)).connect(channelInput);
    sourceBundle.source.connect(sourceGain);

    const node = {
      source: sourceBundle.source,
      sourceType: sourceBundle.sourceType,
      sourceKey,
      sourceTrimDb,
      sourceGain,
      channelInput,
      channelFader,
      channelPan,
      sendGain,
      voice,
      requestedInstrumentId,
      resolvedInstrumentId: sourceBundle.resolvedInstrumentId,
      fallbackReason: sourceBundle.fallbackReason
    };

    this.voiceNodes.set(voice.id, node);
    this.applyMix(node);
    return node;
  }

  async createVoiceSource(instrumentId) {
    if (instrumentId === SYNTH_INSTRUMENT_ID) {
      return {
        source: this.createSynth(),
        sourceType: 'synth',
        calibrationNote: this.calibrationSettings.note,
        resolvedInstrumentId: SYNTH_INSTRUMENT_ID,
        fallbackReason: null
      };
    }

    try {
      const samplerBundle = await this.createSampler(instrumentId);
      return {
        source: samplerBundle.sampler,
        sourceType: 'sampler',
        calibrationNote: samplerBundle.calibrationNote,
        resolvedInstrumentId: instrumentId,
        fallbackReason: null
      };
    } catch (error) {
      const fallbackReason = error instanceof Error ? error.message : String(error);
      console.warn(`Failed to load instrument "${instrumentId}". Using synth fallback.`, error);
      return {
        source: this.createSynth(),
        sourceType: 'synth',
        calibrationNote: this.calibrationSettings.note,
        resolvedInstrumentId: SYNTH_INSTRUMENT_ID,
        fallbackReason
      };
    }
  }

  createSynth() {
    return new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: {
        attack: 0.02,
        decay: 0.2,
        sustain: 0.5,
        release: 0.4
      }
    });
  }

  async createSampler(instrumentId) {
    const samplerDefinition = await this.soundfontCatalog.getSamplerDefinition(instrumentId);
    if (!samplerDefinition) {
      throw new Error(`No sampler definition found for instrument "${instrumentId}"`);
    }

    let sampler = null;
    let timeoutId = null;

    await new Promise((resolve, reject) => {
      let settled = false;
      const settle = callback => value => {
        if (settled) {
          return;
        }

        settled = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        callback(value);
      };

      const resolveOnce = settle(resolve);
      const rejectOnce = settle(reject);

      timeoutId = setTimeout(() => {
        rejectOnce(new Error(`Sampler load timed out for "${instrumentId}" after ${this.samplerLoadTimeoutMs}ms`));
      }, this.samplerLoadTimeoutMs);

      sampler = new Tone.Sampler({
        urls: samplerDefinition.urls,
        baseUrl: samplerDefinition.baseUrl,
        onload: () => resolveOnce(),
        onerror: error => rejectOnce(error || new Error(`Failed to load samples for "${instrumentId}"`))
      });
    }).catch(error => {
      if (sampler) {
        sampler.dispose();
        sampler = null;
      }

      throw error;
    });

    if (!sampler || !this.hasUsableSamplerBuffers(sampler)) {
      if (sampler) {
        sampler.dispose();
      }
      throw new Error(`Sampler for "${instrumentId}" loaded without playable buffers`);
    }

    return {
      sampler,
      calibrationNote: this.pickCalibrationNote(Object.keys(samplerDefinition.urls))
    };
  }

  async getOrCreateSourceTrimDb(source, sourceKey, calibrationNote) {
    if (this.sourceTrimDbByKey.has(sourceKey)) {
      return this.sourceTrimDbByKey.get(sourceKey);
    }

    const trimDb = await this.measureSourceTrimDb(source, calibrationNote);
    this.sourceTrimDbByKey.set(sourceKey, trimDb);
    return trimDb;
  }

  async measureSourceTrimDb(source, calibrationNote) {
    const meter = new Tone.Meter({ normalRange: false, smoothing: 0.7 });
    source.connect(meter);

    try {
      const triggerTime = Tone.now() + 0.01;
      source.triggerAttackRelease(
        calibrationNote || this.calibrationSettings.note,
        this.calibrationSettings.durationSeconds,
        triggerTime,
        this.calibrationSettings.velocity
      );

      const windowMs = Math.max(120, Math.round((this.calibrationSettings.durationSeconds + 0.16) * 1000));
      const pollStepMs = 24;
      let measuredDb = -Infinity;

      for (let elapsedMs = 0; elapsedMs <= windowMs; elapsedMs += pollStepMs) {
        await this.delayMs(pollStepMs);
        measuredDb = Math.max(measuredDb, this.readMeterDb(meter.getValue()));
      }

      if (!Number.isFinite(measuredDb)) {
        return 0;
      }

      return clamp(
        this.calibrationSettings.targetDb - measuredDb,
        this.calibrationSettings.minTrimDb,
        this.calibrationSettings.maxTrimDb
      );
    } catch (error) {
      console.warn('Source loudness calibration failed. Using neutral trim.', error);
      return 0;
    } finally {
      try {
        source.disconnect(meter);
      } catch (error) {
        // No action needed when Tone disconnect graph differs across source types.
      }
      meter.dispose();
    }
  }

  pickCalibrationNote(noteNames) {
    const scored = (noteNames || [])
      .map(note => ({ note, midi: this.noteToMidi(note) }))
      .filter(entry => Number.isFinite(entry.midi))
      .sort((left, right) => left.midi - right.midi);

    if (scored.length === 0) {
      return this.calibrationSettings.note;
    }

    return scored[Math.floor(scored.length / 2)].note;
  }

  noteToMidi(noteName) {
    if (typeof noteName !== 'string') {
      return NaN;
    }

    const match = noteName.trim().match(/^([A-G])([#b]?)(-?\d+)$/);
    if (!match) {
      return NaN;
    }

    const [, letter, accidental, octaveText] = match;
    const baseByLetter = {
      C: 0,
      D: 2,
      E: 4,
      F: 5,
      G: 7,
      A: 9,
      B: 11
    };

    const base = baseByLetter[letter];
    const accidentalOffset = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
    const octave = parseInt(octaveText, 10);
    if (!Number.isFinite(octave)) {
      return NaN;
    }

    return ((octave + 1) * 12) + base + accidentalOffset;
  }

  readMeterDb(value) {
    if (Array.isArray(value)) {
      const finiteValues = value.filter(item => Number.isFinite(item));
      if (finiteValues.length === 0) {
        return -Infinity;
      }

      return Math.max(...finiteValues);
    }

    return Number(value);
  }

  delayMs(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  hasUsableSamplerBuffers(sampler) {
    const bufferStore = sampler?._buffers?._buffers;
    if (!bufferStore) {
      return false;
    }

    if (bufferStore instanceof Map) {
      return bufferStore.size > 0;
    }

    return Object.keys(bufferStore).length > 0;
  }

  normalizeInstrumentId(instrumentId) {
    if (typeof instrumentId !== 'string') {
      return SYNTH_INSTRUMENT_ID;
    }

    const trimmed = instrumentId.trim();
    return trimmed || SYNTH_INSTRUMENT_ID;
  }

  scheduleTimeline(timeline, bpm) {
    this.disposeParts();
    for (const [voiceId, events] of timeline.eventsByVoice.entries()) {
      this.scheduleVoiceEvents(voiceId, events, bpm);
    }
  }

  scheduleVoiceEvents(voiceId, events, bpm) {
    const node = this.voiceNodes.get(voiceId);
    if (!node || events.length === 0) {
      return null;
    }

    const secondsPerBeat = 60 / bpm;
    const partEvents = events.map(event => ({
      time: event.timeBeats * secondsPerBeat,
      midiNote: event.midiNote,
      durationSeconds: event.durationBeats * secondsPerBeat,
      velocity: event.velocity
    }));

    const part = new Tone.Part((time, value) => {
      if (node.voice.muted) {
        return;
      }

      node.source.triggerAttackRelease(
        Tone.Frequency(value.midiNote, 'midi'),
        value.durationSeconds,
        time,
        value.velocity
      );
    }, partEvents);

    part.start(0);
    this.parts.set(voiceId, part);
    return part;
  }

  start(bpm) {
    Tone.Transport.stop();
    Tone.Transport.position = 0;
    Tone.Transport.bpm.value = bpm;
    Tone.Transport.start('+0.05');
  }

  stop() {
    Tone.Transport.stop();
    Tone.Transport.position = 0;
    this.disposeParts();
  }

  setVoiceVolume(voiceId, volume) {
    const node = this.voiceNodes.get(voiceId);
    if (!node) {
      return;
    }

    node.voice.volume = volume;
    this.applyMix(node);
  }

  setVoicePan(voiceId, pan) {
    const node = this.voiceNodes.get(voiceId);
    if (!node) {
      return;
    }

    node.voice.pan = pan;
    this.applyMix(node);
  }

  setVoiceReverbSend(voiceId, reverbSend) {
    const node = this.voiceNodes.get(voiceId);
    if (!node) {
      return;
    }

    node.voice.reverbSend = reverbSend;
    this.applyMix(node);
  }

  setVoiceMute(voiceId, muted) {
    const node = this.voiceNodes.get(voiceId);
    if (!node) {
      return;
    }

    node.voice.muted = muted;
    this.applyMix(node);
  }

  applyMix(node) {
    node.channelFader.gain.value = node.voice.muted ? 0 : this.volumeToGain(node.voice.volume);
    node.channelPan.pan.value = node.voice.pan / 100;
    node.sendGain.gain.value = this.sendToGain(node.voice.reverbSend);
  }

  volumeToGain(volume) {
    const normalizedVolume = Number.isFinite(volume) ? volume : 0;
    return clamp(normalizedVolume / 100, 0, 1);
  }

  sendToGain(reverbSend) {
    const normalizedSend = Number.isFinite(reverbSend) ? reverbSend : 0;
    const linear = clamp(normalizedSend / 100, 0, 1);
    const shaped = Math.pow(linear, 0.5);
    return clamp(shaped * this.reverbSendBoost, 0, 2);
  }

  disposeParts() {
    for (const part of this.parts.values()) {
      part.dispose();
    }
    this.parts.clear();
  }

  disposeVoice(voiceId) {
    const node = this.voiceNodes.get(voiceId);
    if (!node) {
      return;
    }

    node.source.dispose();
    node.sourceGain.dispose();
    node.sendGain.dispose();
    node.channelPan.dispose();
    node.channelFader.dispose();
    node.channelInput.dispose();
    this.voiceNodes.delete(voiceId);
  }

  dispose() {
    this.disposeParts();
    for (const voiceId of [...this.voiceNodes.keys()]) {
      this.disposeVoice(voiceId);
    }

    if (this.reverbBus) {
      this.reverbBus.dispose();
      this.reverbBus = null;
    }

    if (this.reverbSendBus) {
      this.reverbSendBus.dispose();
      this.reverbSendBus = null;
    }

    if (this.reverbReturnGain) {
      this.reverbReturnGain.dispose();
      this.reverbReturnGain = null;
    }

    if (this.masterBus) {
      this.masterBus.dispose();
      this.masterBus = null;
    }

    if (this.masterLimiter) {
      this.masterLimiter.dispose();
      this.masterLimiter = null;
    }

    this.initialized = false;
  }
}