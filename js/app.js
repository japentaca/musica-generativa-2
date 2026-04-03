import { PRNG } from './prng.js?v=2';
import { HarmonicState, MODES, TONICS } from './harmonic-state.js?v=3';
import { MotiveEngine } from './motive-engine.js?v=2';
import { FormalEngine } from './formal-engine.js?v=3';
import { TonalEngine } from './tonal-engine.js?v=3';
import { VoiceEngine } from './voice-engine.js?v=8';
import { Scheduler } from './scheduler.js?v=4';
import { AudioRenderer } from './audio-renderer.js?v=10';
import { Section } from './section.js?v=3';
import { SYNTH_INSTRUMENT_ID, SYNTH_INSTRUMENT_OPTION } from './soundfont-catalog.js?v=2';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

class MusicApp {
  constructor() {
    this.prng = new PRNG(42);
    this.tonalEngine = new TonalEngine();
    this.formalEngine = new FormalEngine();
    this.motiveEngine = new MotiveEngine();
    this.voiceEngine = new VoiceEngine();
    this.scheduler = new Scheduler();
    this.audioRenderer = new AudioRenderer();

    this.config = {
      bpm: 108,
      seed: 42,
      voiceCount: 3,
      initialTonic: 0,
      initialMode: 'major',
      sectionCount: 5,
      formType: 'sonata',
      leitmotivCount: 2,
      motiveParams: {
        minLength: 3,
        maxLength: 6,
        rhythmProfile: { 0.5: 0.35, 1: 0.4, 2: 0.2, 4: 0.05 },
        allowedTransformations: ['transpose', 'fragment', 'invert', 'retrograde', 'augment']
      }
    };

    this.voices = [];
    this.form = [];
    this.timeline = null;
    this.homeState = new HarmonicState(this.config.initialTonic, this.config.initialMode);
    this.isPlaying = false;
    this.playbackActionInFlight = false;
    this.playbackBpm = this.config.bpm;
    this.timeUpdateInterval = null;
    this.activeSectionIndex = null;
    this.instrumentOptions = [SYNTH_INSTRUMENT_OPTION];

    this.init();
  }

  async init() {
    this.bindStaticEvents();
    this.bindPanelToggles();
    this.syncGlobalControls();
    await this.audioRenderer.initialize();
    this.instrumentOptions = await this.audioRenderer.getInstrumentOptions();
    this.generate();
  }

  bindStaticEvents() {
    document.getElementById('playback-toggle-btn')?.addEventListener('click', () => this.togglePlayback());
    document.getElementById('regenerate-btn')?.addEventListener('click', () => this.generate());

    document.getElementById('randomize-seed')?.addEventListener('click', () => {
      const values = new Uint32Array(1);
      crypto.getRandomValues(values);
      document.getElementById('seed').value = String(values[0] || Date.now());
      this.generate();
    });

    ['voice-count', 'initial-tonic', 'initial-mode', 'section-count', 'form-type'].forEach(controlId => {
      document.getElementById(controlId)?.addEventListener('change', () => this.generate());
    });
  }

  bindPanelToggles() {
    document.querySelectorAll('.panel-header').forEach(header => {
      header.addEventListener('click', () => {
        header.parentElement.classList.toggle('collapsed');
      });
    });
  }

  syncGlobalControls() {
    document.getElementById('bpm').value = String(this.config.bpm);
    document.getElementById('seed').value = String(this.config.seed);
    document.getElementById('voice-count').value = String(this.config.voiceCount);
    document.getElementById('initial-tonic').value = String(this.config.initialTonic);
    document.getElementById('initial-mode').value = this.config.initialMode;
    document.getElementById('section-count').value = String(this.config.sectionCount);
    document.getElementById('form-type').value = this.config.formType;
  }

  readConfigFromControls() {
    this.config.bpm = clamp(parseInt(document.getElementById('bpm')?.value, 10) || 108, 40, 200);
    this.config.seed = parseInt(document.getElementById('seed')?.value, 10) || 42;
    this.config.voiceCount = clamp(parseInt(document.getElementById('voice-count')?.value, 10) || 3, 2, 4);
    this.config.initialTonic = clamp(parseInt(document.getElementById('initial-tonic')?.value, 10) || 0, 0, 11);
    this.config.initialMode = MODES[document.getElementById('initial-mode')?.value] ? document.getElementById('initial-mode').value : 'major';
    this.config.sectionCount = clamp(parseInt(document.getElementById('section-count')?.value, 10) || 5, 3, 30);
    this.config.formType = document.getElementById('form-type')?.value || 'sonata';

    const minLength = clamp(parseInt(document.getElementById('motive-min-length')?.value, 10) || 3, 2, 12);
    const maxLength = clamp(parseInt(document.getElementById('motive-max-length')?.value, 10) || 6, minLength, 12);
    this.config.motiveParams.minLength = minLength;
    this.config.motiveParams.maxLength = maxLength;

    const rhythmProfile = {};
    document.querySelectorAll('[data-rhythm-weight]').forEach(input => {
      const beatKey = input.dataset.rhythmWeight;
      rhythmProfile[beatKey] = (parseInt(input.value, 10) || 0) / 100;
    });

    if (Object.keys(rhythmProfile).length > 0) {
      this.config.motiveParams.rhythmProfile = rhythmProfile;
    }

    const selectedTransforms = Array.from(document.querySelectorAll('[data-transform]:checked')).map(input => input.value);
    if (selectedTransforms.length > 0) {
      this.config.motiveParams.allowedTransformations = selectedTransforms;
    }
  }

  generate() {
    if (this.isPlaying) {
      this.stop();
    }

    this.readConfigFromControls();
    this.prng.setSeed(this.config.seed);
    this.homeState = new HarmonicState(this.config.initialTonic, this.config.initialMode);
    this.voices = this.voiceEngine.createVoices(this.config.voiceCount, this.voices);
    this.voiceEngine.assignRoles(this.voices);

    this.motiveEngine.generateLeitmotifs(this.config.leitmotivCount, this.homeState, this.prng, this.config.motiveParams);

    this.form = this.formalEngine.generateForm(this.prng, {
      sectionCount: this.config.sectionCount,
      formType: this.config.formType,
      arcIntensity: 0.65,
      homeState: this.homeState,
      tonalEngine: this.tonalEngine
    });

    this.form.forEach(section => {
      section.allowedTransformations = this.config.motiveParams.allowedTransformations.filter(transformation =>
        section.allowedTransformations.includes(transformation)
      );

      if (section.allowedTransformations.length === 0) {
        section.allowedTransformations = ['transpose'];
      }
    });

    this.timeline = this.scheduler.buildTimeline(
      this.form,
      this.voices,
      this.motiveEngine,
      this.voiceEngine,
      this.tonalEngine,
      this.prng,
      this.homeState
    );

    this.renderVoicesUI();
    this.renderMotiveUI();
    this.renderFormUI();
    this.resetPlaybackDisplay();
    this.updateStatus(false);
  }

  renderVoicesUI() {
    const container = document.getElementById('voices-container');
    if (!container) {
      return;
    }

    const instrumentOptionsMarkup = (selectedInstrumentId) => {
      const normalizedSelected = selectedInstrumentId || SYNTH_INSTRUMENT_ID;
      return this.instrumentOptions
        .map(option => {
          const selected = option.id === normalizedSelected ? 'selected' : '';
          return `<option value="${escapeHtml(option.id)}" ${selected}>${escapeHtml(option.label)}</option>`;
        })
        .join('');
    };

    container.innerHTML = this.voices.map(voice => `
      <div class="voice-panel" data-voice-id="${voice.id}">
        <div class="voice-panel-header">
          <div>
            <strong>${voice.name}</strong>
            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 4px;">Resolved role: ${voice.role}</div>
          </div>
          <button class="btn btn-secondary btn-small" data-action="mute" data-voice-id="${voice.id}">${voice.muted ? 'Unmute' : 'Mute'}</button>
        </div>
        <div class="voice-controls">
          <div class="control-group">
            <label>Role Override</label>
            <select data-field="roleOverride" data-voice-id="${voice.id}">
              <option value="auto" ${voice.roleOverride === 'auto' ? 'selected' : ''}>Auto</option>
              <option value="enunciator" ${voice.roleOverride === 'enunciator' ? 'selected' : ''}>Enunciator</option>
              <option value="imitator" ${voice.roleOverride === 'imitator' ? 'selected' : ''}>Imitator</option>
              <option value="accompanist" ${voice.roleOverride === 'accompanist' ? 'selected' : ''}>Accompanist</option>
            </select>
          </div>
          <div class="control-group">
            <label>Imitator Delay (beats)</label>
            <input type="number" data-field="imitatorDelayBeats" data-voice-id="${voice.id}" value="${voice.imitatorDelayBeats}" min="1" max="8">
          </div>
          <div class="control-group">
            <label>Instrument</label>
            <select data-field="instrumentId" data-voice-id="${voice.id}">
              ${instrumentOptionsMarkup(voice.instrumentId)}
            </select>
          </div>
          <div class="control-group">
            <label>Min Octave</label>
            <input type="number" data-field="minOctave" data-voice-id="${voice.id}" value="${voice.tessiture.minOctave}" min="1" max="6">
          </div>
          <div class="control-group">
            <label>Max Octave</label>
            <input type="number" data-field="maxOctave" data-voice-id="${voice.id}" value="${voice.tessiture.maxOctave}" min="2" max="7">
          </div>
          <div class="control-group">
            <label>Volume</label>
            <div class="slider-container">
              <input type="range" data-field="volume" data-voice-id="${voice.id}" value="${voice.volume}" min="0" max="100">
              <span class="slider-value">${voice.volume}%</span>
            </div>
          </div>
          <div class="control-group">
            <label>Reverb Send</label>
            <div class="slider-container">
              <input type="range" data-field="reverbSend" data-voice-id="${voice.id}" value="${voice.reverbSend}" min="0" max="100">
              <span class="slider-value">${voice.reverbSend}%</span>
            </div>
          </div>
          <div class="control-group">
            <label>Pan</label>
            <div class="slider-container">
              <input type="range" data-field="pan" data-voice-id="${voice.id}" value="${voice.pan}" min="-50" max="50">
              <span class="slider-value">${voice.pan}</span>
            </div>
          </div>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('[data-field]').forEach(element => {
      element.addEventListener('change', event => this.handleVoiceFieldChange(event));
      if (element.type === 'range') {
        element.addEventListener('input', event => this.handleVoiceFieldChange(event, true));
      }
    });

    container.querySelectorAll('[data-action="mute"]').forEach(button => {
      button.addEventListener('click', event => this.toggleVoiceMute(event));
    });
  }

  handleVoiceFieldChange(event, liveUpdate = false) {
    const voiceId = parseInt(event.target.dataset.voiceId, 10);
    const field = event.target.dataset.field;
    const voice = this.voices.find(item => item.id === voiceId);
    if (!voice) {
      return;
    }

    const numericValue = parseFloat(event.target.value);

    switch (field) {
      case 'roleOverride':
        voice.roleOverride = event.target.value;
        break;
      case 'imitatorDelayBeats':
        voice.imitatorDelayBeats = clamp(numericValue || 2, 1, 8);
        break;
      case 'instrumentId':
        voice.instrumentId = typeof event.target.value === 'string' && event.target.value.trim()
          ? event.target.value
          : SYNTH_INSTRUMENT_ID;
        break;
      case 'minOctave':
        voice.tessiture.minOctave = clamp(numericValue || 2, 1, voice.tessiture.maxOctave);
        break;
      case 'maxOctave':
        voice.tessiture.maxOctave = clamp(numericValue || 5, voice.tessiture.minOctave, 7);
        break;
      case 'volume':
        voice.volume = clamp(numericValue || 0, 0, 100);
        if (event.target.nextElementSibling) {
          event.target.nextElementSibling.textContent = `${voice.volume}%`;
        }
        this.audioRenderer.setVoiceVolume(voice.id, voice.volume);
        break;
      case 'reverbSend':
        voice.reverbSend = clamp(numericValue || 0, 0, 100);
        if (event.target.nextElementSibling) {
          event.target.nextElementSibling.textContent = `${voice.reverbSend}%`;
        }
        this.audioRenderer.setVoiceReverbSend(voice.id, voice.reverbSend);
        break;
      case 'pan':
        voice.pan = clamp(numericValue || 0, -50, 50);
        if (event.target.nextElementSibling) {
          event.target.nextElementSibling.textContent = String(voice.pan);
        }
        this.audioRenderer.setVoicePan(voice.id, voice.pan);
        break;
      default:
        break;
    }

    if (!liveUpdate && field !== 'volume' && field !== 'reverbSend' && field !== 'pan') {
      this.generate();
    }
  }

  toggleVoiceMute(event) {
    const voiceId = parseInt(event.target.dataset.voiceId, 10);
    const voice = this.voices.find(item => item.id === voiceId);
    if (!voice) {
      return;
    }

    voice.muted = !voice.muted;
    this.audioRenderer.setVoiceMute(voice.id, voice.muted);
    this.generate();
  }

  renderMotiveUI() {
    const container = document.getElementById('leitmotiv-container');
    if (!container) {
      return;
    }

    const leitmotivs = this.motiveEngine.getAllLeitmotivs();
    const rhythmEntries = Object.entries(this.config.motiveParams.rhythmProfile);

    container.innerHTML = `
      <div class="control-row-2">
        <div class="control-group">
          <label>Min Length</label>
          <input type="number" id="motive-min-length" value="${this.config.motiveParams.minLength}" min="2" max="12">
        </div>
        <div class="control-group">
          <label>Max Length</label>
          <input type="number" id="motive-max-length" value="${this.config.motiveParams.maxLength}" min="2" max="12">
        </div>
      </div>
      <div class="control-group">
        <label>Rhythm Profile</label>
        <div class="rhythm-sliders">
          ${rhythmEntries.map(([beatKey, weight]) => `
            <div class="rhythm-slider">
              <label>
                <span>${beatKey} beats</span>
                <span class="weight-display" id="weight-${beatKey}">${Math.round(weight * 100)}%</span>
              </label>
              <input type="range" data-rhythm-weight="${beatKey}" value="${Math.round(weight * 100)}" min="0" max="100">
            </div>
          `).join('')}
        </div>
      </div>
      <div class="control-group">
        <label>Allowed Transformations</label>
        <div class="checkbox-group">
          ${['transpose', 'fragment', 'invert', 'retrograde', 'augment'].map(transformation => `
            <label class="checkbox-item">
              <input type="checkbox" data-transform value="${transformation}" ${this.config.motiveParams.allowedTransformations.includes(transformation) ? 'checked' : ''}>
              <span>${transformation}</span>
            </label>
          `).join('')}
        </div>
      </div>
      <div class="control-group">
        <label>Generated Leitmotivs</label>
        <div class="control-row">
          ${leitmotivs.map(item => `
            <div class="voice-panel" style="min-width: 180px; margin-bottom: 0;">
              <div style="font-weight: 600; margin-bottom: 6px;">${item.name}</div>
              <div style="font-size: 0.78rem; color: var(--text-secondary);">${item.motive.length} notes</div>
              <div style="font-size: 0.78rem; color: var(--text-secondary);">${item.motive.getTotalDurationBeats().toFixed(2)} beats</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.getElementById('motive-min-length')?.addEventListener('change', () => this.generate());
    document.getElementById('motive-max-length')?.addEventListener('change', () => this.generate());

    container.querySelectorAll('[data-rhythm-weight]').forEach(input => {
      input.addEventListener('input', event => {
        const beatKey = event.target.dataset.rhythmWeight;
        document.getElementById(`weight-${beatKey}`).textContent = `${event.target.value}%`;
      });
      input.addEventListener('change', () => this.generate());
    });

    container.querySelectorAll('[data-transform]').forEach(input => {
      input.addEventListener('change', () => this.generate());
    });
  }

  renderFormUI() {
    const visualizer = document.getElementById('form-visualizer');
    const summary = document.getElementById('form-summary');
    if (!visualizer || !summary) {
      return;
    }

    const formViz = this.formalEngine.visualizeForm(this.form);

    visualizer.innerHTML = formViz.map((section, index) => `
      <div class="form-block" data-section-index="${index}" style="background-color: ${section.color}; flex: ${Math.max(1, section.durationBars)};">
        <span class="index-label">S${index + 1}</span>
        <span class="type-label">${section.type}</span>
        <span class="duration-label">${section.durationBars} bars</span>
      </div>
    `).join('');

    summary.innerHTML = this.form.map((section, index) => `
      <div class="section-summary-card" data-section-index="${index}">
        <div class="section-summary-title">
          <span class="section-number">S${index + 1}</span>
          <span style="font-weight: 600; color: ${Section.getColorForType(section.type)};">${section.type}</span>
        </div>
        <div class="section-summary-meta">Bars: ${section.durationBars}</div>
        <div class="section-summary-meta">Target: ${TONICS[section.targetTonic]} ${section.targetMode}</div>
        <div class="section-summary-meta">Modulation: ${section.modulationType}</div>
        <div class="section-summary-meta">Tension: ${section.tension.toFixed(2)}</div>
      </div>
    `).join('');

    this.setActiveSection(null);
  }

  setActiveSection(sectionIndex) {
    const normalizedIndex = Number.isInteger(sectionIndex) && sectionIndex >= 0 ? sectionIndex : null;

    if (this.activeSectionIndex === normalizedIndex) {
      return;
    }

    if (this.activeSectionIndex !== null) {
      document.querySelector(`.form-block[data-section-index="${this.activeSectionIndex}"]`)?.classList.remove('is-active');
      document.querySelector(`.section-summary-card[data-section-index="${this.activeSectionIndex}"]`)?.classList.remove('is-active');
    }

    if (normalizedIndex !== null) {
      const visualizer = document.getElementById('form-visualizer');
      const activeBlock = document.querySelector(`.form-block[data-section-index="${normalizedIndex}"]`);
      const activeSummaryCard = document.querySelector(`.section-summary-card[data-section-index="${normalizedIndex}"]`);

      activeBlock?.classList.add('is-active');
      activeSummaryCard?.classList.add('is-active');

      if (visualizer && activeBlock) {
        const leftEdge = activeBlock.offsetLeft;
        const rightEdge = leftEdge + activeBlock.offsetWidth;
        const visibleLeft = visualizer.scrollLeft;
        const visibleRight = visibleLeft + visualizer.clientWidth;

        if (leftEdge < visibleLeft || rightEdge > visibleRight) {
          visualizer.scrollTo({
            left: Math.max(0, leftEdge - 12),
            behavior: 'smooth'
          });
        }
      }
    }

    this.activeSectionIndex = normalizedIndex;
  }

  async togglePlayback() {
    if (this.playbackActionInFlight) {
      return;
    }

    if (this.isPlaying) {
      this.stop();
      return;
    }

    await this.play();
  }

  async play() {
    if (this.isPlaying || this.playbackActionInFlight) {
      return;
    }

    this.playbackActionInFlight = true;
    this.updateStatus(this.isPlaying);

    try {
      this.generate();
      await Tone.start();
      await this.audioRenderer.setupVoices(this.voices);
      this.audioRenderer.scheduleTimeline(this.timeline, this.config.bpm);
      this.audioRenderer.start(this.config.bpm);

      this.isPlaying = true;
      this.playbackBpm = this.config.bpm;
      this.updateStatus(true);
      this.updatePlaybackMonitorDisplay(0);
      this.startPlaybackMonitor();
    } catch (error) {
      console.error('Failed to start playback.', error);
      this.audioRenderer.stop();
      this.isPlaying = false;
      this.resetPlaybackDisplay();
      this.updateStatus(false);
    } finally {
      this.playbackActionInFlight = false;
      this.updateStatus(this.isPlaying);
    }
  }

  stop() {
    this.audioRenderer.stop();
    this.isPlaying = false;
    this.updateStatus(false);

    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
      this.timeUpdateInterval = null;
    }

    this.resetPlaybackDisplay();
  }

  resetPlaybackDisplay() {
    const currentSection = document.getElementById('current-section-display');
    const currentBar = document.getElementById('current-bar-display');
    const timeDisplay = document.getElementById('time-display');

    if (currentSection) {
      currentSection.textContent = '-';
    }
    if (currentBar) {
      currentBar.textContent = '-';
    }
    if (timeDisplay) {
      timeDisplay.textContent = '0:00';
    }

    this.setActiveSection(null);
  }

  updatePlaybackMonitorDisplay(currentBeat) {
    const positionInfo = this.scheduler.getPlaybackPositionAtBeat(currentBeat);
    const currentSection = document.getElementById('current-section-display');
    const currentBar = document.getElementById('current-bar-display');
    const timeDisplay = document.getElementById('time-display');

    if (positionInfo) {
      this.setActiveSection(positionInfo.sectionIndex);

      if (currentSection) {
        currentSection.textContent = `Section ${positionInfo.sectionIndex + 1}/${positionInfo.sectionCount} · ${positionInfo.section.type} · ${TONICS[positionInfo.section.targetTonic]} ${positionInfo.section.targetMode}`;
      }

      if (currentBar) {
        currentBar.textContent = `Bar ${positionInfo.absoluteBarNumber}/${positionInfo.totalBars} · Section bar ${positionInfo.sectionBarNumber}/${positionInfo.sectionTotalBars}`;
      }
    } else {
      this.setActiveSection(null);

      if (currentSection) {
        currentSection.textContent = '-';
      }

      if (currentBar) {
        currentBar.textContent = '-';
      }
    }

    if (timeDisplay) {
      const elapsedSeconds = Math.floor(Tone.Transport.seconds);
      const minutes = Math.floor(elapsedSeconds / 60);
      const seconds = elapsedSeconds % 60;
      timeDisplay.textContent = `${minutes}:${String(seconds).padStart(2, '0')}`;
    }
  }

  startPlaybackMonitor() {
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
    }

    this.updatePlaybackMonitorDisplay(0);

    this.timeUpdateInterval = setInterval(() => {
      if (!this.isPlaying || !this.timeline) {
        return;
      }

      const secondsPerBeat = 60 / this.playbackBpm;
      const currentBeat = Tone.Transport.seconds / secondsPerBeat;
      this.updatePlaybackMonitorDisplay(currentBeat);

      if (currentBeat >= this.timeline.totalBeats) {
        this.stop();
      }
    }, 100);
  }

  updateStatus(isPlaying) {
    const playbackToggleButton = document.getElementById('playback-toggle-btn');
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');

    if (playbackToggleButton) {
      playbackToggleButton.disabled = this.playbackActionInFlight;
      playbackToggleButton.textContent = this.playbackActionInFlight ? 'Loading...' : isPlaying ? 'Stop' : 'Start';
      playbackToggleButton.classList.toggle('btn-success', !isPlaying);
      playbackToggleButton.classList.toggle('btn-danger', isPlaying);
      playbackToggleButton.setAttribute('aria-pressed', isPlaying ? 'true' : 'false');
    }
    if (statusDot) {
      statusDot.classList.toggle('playing', isPlaying);
      statusDot.classList.toggle('stopped', !isPlaying);
    }
    if (statusText) {
      statusText.textContent = isPlaying ? 'Playing' : 'Stopped';
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.musicApp = new MusicApp();
});