/**
 * APPLICATION BOOTSTRAP & GAME LOOP ORCHESTRATION
 * Pure HTML5 Canvas execution: zero DOM divs or HTML form overlays.
 * Connects audio, state, kinetic causal simulation, camera, renderer, and canvas HUD.
 */

import './index.css';

import { TimedWord, LayoutGraph, CameraState, SceneNode, ColorTheme, ProjectionViewMode } from './types.ts';
import { createCamera, updateCamera, triggerScreenShake } from './camera.ts';
import { buildCausalGraph, sampleCamera } from './graph.ts';
import { renderCausalGraph } from './renderer.ts';
import {
  HUDState,
  HUDPointer,
  HUDAction,
  renderCanvasHUD,
  updateHUDPointer,
  handleHUDPointerDown,
  handleHUDPointerMove,
  handleHUDPointerUp,
  isScrubbing,
} from './hud.ts';

// Synchronous bootstrap load of song lyrics and atomic WebVTT subtitles
import defaultLyrics from '../public/lyrics.txt?raw';
import defaultSubtitlesVtt from '../public/subtitles.vtt?raw';
import { parseSubtitles, serializeToWebVTT } from './subtitles.ts';

const initialTimedWords: TimedWord[] = parseSubtitles(defaultSubtitlesVtt);
const initialCausalGraph: LayoutGraph = buildCausalGraph(initialTimedWords);
const initialDuration = initialTimedWords.length > 0 ? initialTimedWords[initialTimedWords.length - 1].end + 5.0 : 200.2;

// ----------------------------------------------------------------------------
// APPLICATION STATE (Single Authoritative Source of Truth)
// ----------------------------------------------------------------------------

interface AppState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  viewMode: ProjectionViewMode;
  theme: ColorTheme;
  userZoomMultiplier: number;
  activeAudioMode: 'song' | 'synth';
  timedWords: TimedWord[];
  authoritativeLyrics: string;
  layoutGraph: LayoutGraph;
  camera: CameraState;
}

const state: AppState = {
  isPlaying: false,
  currentTime: 0,
  duration: initialDuration,
  playbackRate: 1.0,
  viewMode: 'presentation',
  theme: 'light_mode',
  userZoomMultiplier: 1.0,
  activeAudioMode: 'song',
  timedWords: initialTimedWords,
  authoritativeLyrics: defaultLyrics,
  layoutGraph: initialCausalGraph,
  camera: createCamera(),
};

// ----------------------------------------------------------------------------
// CANVAS & CONTEXT SETUP
// ----------------------------------------------------------------------------

const canvas = document.getElementById('kineticCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d', { alpha: false })!;

let logicalWidth = window.innerWidth;
let logicalHeight = window.innerHeight;

let cachedTotalLyrics = state.layoutGraph.nodes.filter((n) => n.type === 'lyric').length;

function resizeCanvas() {
  logicalWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
  logicalHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(logicalWidth * dpr);
  canvas.height = Math.round(logicalHeight * dpr);
  canvas.style.width = `${logicalWidth}px`;
  canvas.style.height = `${logicalHeight}px`;
}
window.addEventListener('resize', resizeCanvas);
if (typeof ResizeObserver !== 'undefined') {
  const ro = new ResizeObserver(() => resizeCanvas());
  ro.observe(document.documentElement);
}
resizeCanvas();


// ----------------------------------------------------------------------------
// AUDIO SUBSYSTEM
// ----------------------------------------------------------------------------

let audioCtx: AudioContext | null = null;
let mediaElement: HTMLAudioElement | null = null;
let audioSourceNode: MediaElementAudioSourceNode | null = null;
let masterGain: GainNode | null = null;
let mediaStreamDest: MediaStreamAudioDestinationNode | null = null;
let synthInterval: number | null = null;

function initAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.9;
    mediaStreamDest = audioCtx.createMediaStreamDestination();
    masterGain.connect(audioCtx.destination);
    masterGain.connect(mediaStreamDest);
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function initAudioElement(src: string): void {
  if (mediaElement) {
    mediaElement.pause();
    mediaElement.src = '';
    mediaElement.remove();
  }
  mediaElement = new Audio();
  mediaElement.src = src;
  mediaElement.preload = 'auto';
  mediaElement.playbackRate = state.playbackRate;

  mediaElement.addEventListener('loadedmetadata', () => {
    if (mediaElement && mediaElement.duration > 0 && !isNaN(mediaElement.duration)) {
      state.duration = mediaElement.duration;
      hudState.statusText = `Audio Loaded (${state.duration.toFixed(1)}s)`;
    }
  });

  mediaElement.addEventListener('ended', () => {
    pausePlayback();
  });

  mediaElement.load();
}

function connectAudioElementToCtx(): void {
  if (!audioCtx || !mediaElement || audioSourceNode) return;
  try {
    audioSourceNode = audioCtx.createMediaElementSource(mediaElement);
    if (masterGain) {
      audioSourceNode.connect(masterGain);
    }
  } catch (err) {
    console.warn('AudioSource connection notice:', err);
  }
}

// Built-in 85 BPM drum beat fallback
function startDrumSynth(): void {
  stopDrumSynth();
  const ctx = initAudioContext();
  const bpm = 85;
  const intervalMs = (60 / bpm / 2) * 1000;
  let beatCount = 0;

  synthInterval = window.setInterval(() => {
    if (!state.isPlaying) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    if (masterGain) gain.connect(masterGain);

    if (beatCount % 2 === 0) {
      // Kick drum
      osc.frequency.setValueAtTime(130, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.7, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.12);
    } else {
      // Snare drum
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    }
    beatCount++;
  }, intervalMs);
}

function stopDrumSynth(): void {
  if (synthInterval !== null) {
    clearInterval(synthInterval);
    synthInterval = null;
  }
}

// ----------------------------------------------------------------------------
// PLAYBACK CONTROLLER & HIGH-PRECISION AUDIO CLOCK ANCHOR
// ----------------------------------------------------------------------------

let lastPerfTime = performance.now();
let lastObservedMediaTime = -1;
let mediaAnchorTime = 0;
let perfAnchorTime = performance.now();

export function startPlayback(): void {
  const ctx = initAudioContext();
  connectAudioElementToCtx();
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  state.isPlaying = true;
  updatePlayPauseButtonUI();
  const now = performance.now();
  lastPerfTime = now;
  perfAnchorTime = now;
  mediaAnchorTime = state.currentTime;
  lastObservedMediaTime = state.currentTime;

  if (state.activeAudioMode === 'song' && mediaElement) {
    mediaElement.currentTime = state.currentTime;
    mediaElement.playbackRate = state.playbackRate;
    mediaElement.play().catch((err) => {
      console.warn('Audio play request interrupted:', err);
    });
  } else if (state.activeAudioMode === 'synth') {
    startDrumSynth();
  }
}

export function pausePlayback(): void {
  state.isPlaying = false;
  updatePlayPauseButtonUI();
  if (mediaElement) {
    mediaElement.pause();
    state.currentTime = mediaElement.currentTime;
  }
  stopDrumSynth();
}

export function togglePlayPause(): void {
  if (state.isPlaying) {
    pausePlayback();
  } else {
    startPlayback();
  }
}

export function seekTo(targetSeconds: number): void {
  const safeTime = Math.max(0, Math.min(targetSeconds, state.duration));
  state.currentTime = safeTime;
  mediaAnchorTime = safeTime;
  lastObservedMediaTime = safeTime;
  perfAnchorTime = performance.now();

  if (mediaElement) {
    mediaElement.currentTime = safeTime;
  }
}

export function stepFrame(frames: number): void {
  pausePlayback();
  const dt = (1 / 60) * frames;
  seekTo(state.currentTime + dt);
}

// ----------------------------------------------------------------------------
// SIMULATION & CAMERA TARGETING
// ----------------------------------------------------------------------------

function updateSimulation(): void {
  if (state.isPlaying) {
    if (state.activeAudioMode === 'song' && mediaElement && !mediaElement.paused) {
      state.currentTime = mediaElement.currentTime;
    } else {
      state.currentTime += (1 / 60) * state.playbackRate;
    }

    if (state.currentTime >= state.duration) {
      seekTo(state.duration);
      pausePlayback();
    }
  }

  // Camera Target Calculation
  if (state.viewMode === 'global_orthographic') {
    const b = state.layoutGraph.bounds;
    const targetCenterX = (b.minX + b.maxX) / 2;
    const targetCenterY = (b.minY + b.maxY) / 2;
    const padding = 1.35;
    const zoomX = logicalWidth / (Math.max(b.width, 1000) * padding);
    const zoomY = logicalHeight / (Math.max(b.height, 1000) * padding);

    state.camera.targetX = targetCenterX;
    state.camera.targetY = targetCenterY;
    state.camera.targetRotation = 0;
    state.camera.targetZoom = Math.min(zoomX, zoomY, 0.45) * state.userZoomMultiplier;
  } else {
    const { x, y, rotation, zoom } = sampleCamera(state.layoutGraph, state.currentTime, state.userZoomMultiplier);
        state.camera.targetX = x;
    state.camera.targetY = y;
    state.camera.targetRotation = rotation;
    state.camera.targetZoom = zoom;
  }

  // Advance camera physics
  updateCamera(state.camera);
}

// ----------------------------------------------------------------------------
// WEBM VIDEO RECORDING & FRAME CAPTURE
// ----------------------------------------------------------------------------

let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: Blob[] = [];

function toggleWebmRecording(): void {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    pausePlayback();
    hudState.isRecording = false;
  } else {
    initAudioContext();
    const canvasStream = canvas.captureStream(60);
    const combinedTracks = [...canvasStream.getVideoTracks()];

    if (mediaStreamDest && mediaStreamDest.stream.getAudioTracks().length > 0) {
      combinedTracks.push(...mediaStreamDest.stream.getAudioTracks());
    }

    const combinedStream = new MediaStream(combinedTracks);
    recordedChunks = [];

    const options = { mimeType: 'video/webm; codecs=vp9,opus' };
    try {
      mediaRecorder = new MediaRecorder(combinedStream, options);
    } catch {
      mediaRecorder = new MediaRecorder(combinedStream);
    }

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kinetic_typography_${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    };

    mediaRecorder.start();
    seekTo(0);
    startPlayback();
    hudState.isRecording = true;
  }
}

function captureHighResFrame(): void {
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = `kinetic_frame_${Math.round(state.currentTime * 100)}.png`;
  a.click();
}

// ----------------------------------------------------------------------------
// FILE PICKERS & EXPORT (Canvas-triggered)
// ----------------------------------------------------------------------------

function openAudioPicker(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'audio/*';
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      initAudioElement(url);
      state.activeAudioMode = 'song';
      hudState.statusText = `Audio: ${file.name}`;
    }
  };
  input.click();
}

function openSubtitlesPicker(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.vtt,.srt,.txt,.json';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (file) {
      const text = await file.text();
      loadSubtitlesText(text, file.name);
    }
  };
  input.click();
}

function loadSubtitlesText(text: string, filename: string): void {
  let words: TimedWord[] = [];
  if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
    try {
      words = JSON.parse(text);
    } catch {
      words = parseSubtitles(text);
    }
  } else {
    words = parseSubtitles(text);
  }

  if (words.length > 0) {
    state.timedWords = words;
    state.layoutGraph = buildCausalGraph(words);
    cachedTotalLyrics = state.layoutGraph.nodes.filter((n) => n.type === 'lyric').length;
    state.duration = words[words.length - 1].end + 5.0;
    seekTo(0);
    hudState.statusText = `Loaded ${words.length} cues (${filename})`;
  }
}

function exportWebVTT(): void {
  const vttContent = serializeToWebVTT(state.timedWords);
  const blob = new Blob([vttContent], { type: 'text/vtt;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'subtitles.vtt';
  a.click();
  URL.revokeObjectURL(url);
}

function jumpScene(direction: -1 | 1): void {
  const landmarks = state.layoutGraph.nodes.filter(
    (n) => (n.type === 'lyric' || n.type === 'math_scene') && n.startTime > 0.05
  );
  if (landmarks.length === 0) return;

  if (direction === -1) {
    for (let i = landmarks.length - 1; i >= 0; i--) {
      if (landmarks[i].startTime < state.currentTime - 0.75) {
        seekTo(landmarks[i].startTime);
        triggerScreenShake(state.camera, 4, 0.18);
        return;
      }
    }
    seekTo(0);
  } else {
    for (let i = 0; i < landmarks.length; i++) {
      if (landmarks[i].startTime > state.currentTime + 0.15) {
        seekTo(landmarks[i].startTime);
        triggerScreenShake(state.camera, 4, 0.18);
        return;
      }
    }
  }
}

// ----------------------------------------------------------------------------
// CANVAS HUD STATE & POINTER EVENT BINDINGS
// ----------------------------------------------------------------------------

const pointerState: HUDPointer = { x: -1, y: -1, isDown: false };

let showOptions = false;
let hasStartedPresentation = false;

const hudState: HUDState = {
  hasStarted: false,
  isPlaying: false,
  currentTime: 0,
  duration: state.duration,
  playbackRate: 1.0,
  viewMode: 'presentation',
  theme: 'light_mode',
  fps: 60,
  statusText: 'Timing Data Loaded (Ready)',
  isRecording: false,
  isDraggingFile: false,
  showOptions: false,
};

export function requestFullscreenSafe(): void {
  // Disabled as requested: no fullscreen footgun
}

export function toggleFullscreen(): void {
  // Disabled as requested: no fullscreen footgun
}

export function toggleOptions(forceState?: boolean): void {
  showOptions = forceState !== undefined ? forceState : !showOptions;
  hudState.showOptions = showOptions;
}

export function startPresentation(): void {
  hasStartedPresentation = true;
  hudState.showOptions = false;
  startPlayback();
}
(window as any).startPresentation = startPresentation;

function updatePlayPauseButtonUI(): void {
  // No longer needed, HUD Canvas will draw the play/pause icon natively based on hudState.isPlaying
}

function executeHUDAction(action: HUDAction): void {
  switch (action.type) {
    case 'toggle_play':
      if (!hasStartedPresentation) {
        startPresentation();
      } else {
        togglePlayPause();
      }
      break;
    case 'step_frame':
      stepFrame(action.payload);
      break;
    case 'restart':
      seekTo(0);
      triggerScreenShake(state.camera, 6, 0.2);
      break;
    case 'seek':
      seekTo(action.payload);
      break;
    case 'set_view_mode':
      state.viewMode = action.payload;
      break;
    case 'toggle_theme':
      state.theme = state.theme === 'light_mode' ? 'dark_mode' : 'light_mode';
      break;
    case 'set_speed':
      state.playbackRate = action.payload;
      if (mediaElement) mediaElement.playbackRate = state.playbackRate;
      break;
    case 'jump_prev_scene':
      jumpScene(-1);
      break;
    case 'jump_next_scene':
      jumpScene(1);
      break;
    case 'load_audio':
      openAudioPicker();
      break;
    case 'load_vtt':
      openSubtitlesPicker();
      break;
    case 'export_vtt':
      exportWebVTT();
      break;
    case 'capture_png':
      captureHighResFrame();
      break;
    case 'toggle_record':
      toggleWebmRecording();
      break;
    case 'toggle_options':
      toggleOptions();
      break;
    case 'toggle_fullscreen':
      // Disabled as requested: no fullscreen footgun
      break;
  }
}

canvas.addEventListener('pointermove', (e) => {
  const rect = canvas.getBoundingClientRect();
  pointerState.x = e.clientX - rect.left;
  pointerState.y = e.clientY - rect.top;

  if (isScrubbing()) {
    const action = handleHUDPointerMove(pointerState, logicalWidth, state.duration);
    if (action) executeHUDAction(action);
  } else {
    const { cursor } = updateHUDPointer(pointerState, logicalWidth, logicalHeight);
    canvas.style.cursor = cursor;
  }
});

canvas.addEventListener('pointerdown', (e) => {
  initAudioContext();
  const rect = canvas.getBoundingClientRect();
  pointerState.x = e.clientX - rect.left;
  pointerState.y = e.clientY - rect.top;
  pointerState.isDown = true;

  const action = handleHUDPointerDown(pointerState, logicalWidth, logicalHeight, state.duration);
  if (action) {
    executeHUDAction(action);
  } else if (!state.isPlaying && !showOptions) {
    // Clicking anywhere on the canvas while paused toggles playback (without fullscreen)
    togglePlayPause();
  }
});

window.addEventListener('pointerup', () => {
  pointerState.isDown = false;
  handleHUDPointerUp();
});

// Drag and drop onto Canvas
canvas.addEventListener('dragover', (e) => {
  e.preventDefault();
  hudState.isDraggingFile = true;
});

canvas.addEventListener('dragleave', (e) => {
  e.preventDefault();
  hudState.isDraggingFile = false;
});

canvas.addEventListener('drop', async (e) => {
  e.preventDefault();
  hudState.isDraggingFile = false;
  const file = e.dataTransfer?.files?.[0];
  if (!file) return;

  if (file.type.startsWith('audio/') || file.name.endsWith('.mp3') || file.name.endsWith('.wav')) {
    const url = URL.createObjectURL(file);
    initAudioElement(url);
    state.activeAudioMode = 'song';
    hudState.statusText = `Audio: ${file.name}`;
  } else if (
    file.name.endsWith('.vtt') ||
    file.name.endsWith('.srt') ||
    file.name.endsWith('.txt') ||
    file.name.endsWith('.json')
  ) {
    const text = await file.text();
    loadSubtitlesText(text, file.name);
  }
});

// Keyboard shortcuts
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    togglePlayPause();
  } else if (e.code === 'Enter') {
    e.preventDefault();
    if (!state.isPlaying) {
      startPlayback();
    }
  } else if (e.code === 'KeyO') {
    e.preventDefault();
    toggleOptions();
  } else if (e.code === 'KeyF') {
    // Disabled fullscreen footgun
    e.preventDefault();
  } else if (e.code === 'Escape') {
    if (showOptions) {
      e.preventDefault();
      toggleOptions(false);
    }
  } else if (e.code === 'ArrowLeft') {
    e.preventDefault();
    stepFrame(-1);
  } else if (e.code === 'ArrowRight') {
    e.preventDefault();
    stepFrame(1);
  } else if (e.code === 'Digit1') {
    state.viewMode = 'presentation';
  } else if (e.code === 'Digit2') {
    state.viewMode = 'karaoke';
  } else if (e.code === 'Digit3') {
    state.viewMode = 'math';
  } else if (e.code === 'Digit4') {
    state.viewMode = 'debug_overlay';
  } else if (e.code === 'Digit5') {
    state.viewMode = state.viewMode === 'global_orthographic' ? 'presentation' : 'global_orthographic';
  } else if (e.code === 'KeyT') {
    state.theme = state.theme === 'light_mode' ? 'dark_mode' : 'light_mode';
  }
});

// ----------------------------------------------------------------------------
// MAIN RENDER LOOP (Single Authoritative Loop)
// ----------------------------------------------------------------------------

let frameCount = 0;
let lastFpsTime = performance.now();
let fps = 60;

function renderScene(): void {
  // 1. Simulation update
  updateSimulation();

  const currentDpr = window.devicePixelRatio || 1;
  ctx.save();
  ctx.scale(currentDpr, currentDpr);

  // 2. Primary Kinetic Typography Stage (Restored full multi-projection engine)
  renderCausalGraph(
    ctx,
    state.layoutGraph,
    state.camera,
    state.currentTime,
    logicalWidth,
    logicalHeight,
    state.viewMode,
    state.theme
  );

  // 3. Update HUD State
  frameCount++;
  const now = performance.now();
  if (now - lastFpsTime >= 500) {
    fps = Math.round((frameCount / (now - lastFpsTime)) * 1000);
    frameCount = 0;
    lastFpsTime = now;
  }

  hudState.hasStarted = hasStartedPresentation;
  hudState.isPlaying = state.isPlaying;
  hudState.currentTime = state.currentTime;
  hudState.duration = state.duration;
  hudState.playbackRate = state.playbackRate;
  hudState.viewMode = state.viewMode;
  hudState.theme = state.theme;
  hudState.fps = fps;
  hudState.showOptions = showOptions;
  
  hudState.activePhraseText = '';
  hudState.activePhraseIndex = 0;
  hudState.totalPhrases = cachedTotalLyrics;

  if (state.layoutGraph.nodes.length > 0) {
    const nodes = state.layoutGraph.nodes;
    let low = 0;
    let high = nodes.length - 1;
    let bestIdx = -1;

    // Find the latest node that started before or at currentTime
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (nodes[mid].startTime <= state.currentTime) {
        bestIdx = mid;
        low = mid + 1; // Try to find a later one
      } else {
        high = mid - 1;
      }
    }

    if (bestIdx !== -1) {
      // Check if it's still active (including the 0.35s buffer)
      if (state.currentTime <= nodes[bestIdx].endTime + 0.35) {
        hudState.activePhraseText = nodes[bestIdx].text || "";
        hudState.activePhraseIndex = bestIdx;
      } else if (bestIdx + 1 < nodes.length && state.currentTime <= nodes[bestIdx + 1].endTime + 0.35) {
         // Edge case: Sometimes the next node started slightly after but overlaps
         // (Though if it started after, bestIdx wouldn't have caught it if currentTime < next.startTime, 
         // but if currentTime is between, it's covered).
      }
    }
  }

  // 5. Canvas HUD render pass (drawn directly on top of the stage)
  renderCanvasHUD(ctx, hudState, pointerState, logicalWidth, logicalHeight);
  
  ctx.restore();

  requestAnimationFrame(renderScene);
}

// ----------------------------------------------------------------------------
// BOOTSTRAP INITIALIZATION
// ----------------------------------------------------------------------------

function init(): void {
  initAudioElement(`${import.meta.env.BASE_URL}song.mp3`);
  hudState.statusText = `Song Loaded (${state.duration.toFixed(1)}s)`;
  
  // HUD UI clicks are now entirely handled inside the canvas via handlePointerDown
  // which delegates to processHUDAction based on hitboxes

  requestAnimationFrame(renderScene);
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
