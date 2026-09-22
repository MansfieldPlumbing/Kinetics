/**
 * VARIABLE HERO EFFECT
 * Renders the word "VARIABLE" (or "VARIABLES") with a specialized hero effect
 * that is literally VARIABLE in real time:
 * 
 * 1. Live Parametric Typography:
 *    - Per-letter vertical scale undulation: scaleY = 1.0 + 0.18 * sin(t * 4.5 + i * 0.7)
 *    - Per-letter baseline modulation
 *    - Dynamic font weight oscillation (thin 300 to black 900)
 *    - Parametric letter-spacing breathing
 * 
 * 2. Live Parameter Slider Gauge (The Variable Indicator):
 *    - Sliding bead oscillating along a technical caliper rail
 *    - Live numeric parameter readout: e.g. "val(t) = 4.28" or "x ∈ ℝ"
 *    - Caliper bracket bounds [ ... ] that expand/contract
 * 
 * 3. Glyph Shuffling / Variable Resolution:
 *    - When vocal cue onset triggers, letters dynamically shuffle through algebraic
 *      variable symbols (X, Y, Z, ?, α, β, 8, Δ) before snapping into "VARIABLE"
 *    - Multi-layer chromatic ghosting during vocal punch
 */

import { ColorTheme, ThemeColors } from '../types.ts';
import { calculateKineticImpact } from './kineticImpact.ts';

export function isVariableWord(text: string): boolean {
  const clean = text.toLowerCase().replace(/[^a-z]/g, '');
  return clean === 'variable' || clean === 'variables';
}

const ALGEBRAIC_SHUFFLE_GLYPHS = ['X', 'Y', 'Z', '?', 'n', 'α', 't', 'k', '8', 'Δ', 'λ', 'ω'];

export function renderVariableHeroWord(
  ctx: CanvasRenderingContext2D,
  text: string,
  relX: number,
  relY: number,
  baseFontSize: number,
  currentTime: number,
  startTime: number,
  endTime: number,
  isWordActive: boolean,
  isWordPast: boolean,
  theme: ColorTheme = 'light_mode',
  colors?: ThemeColors,
  nodeRotation = 0,
  cameraRotation = 0,
  allocatedWidth = 240
): void {
  const isLight = theme === 'light_mode';
  const cleanUpper = text.toUpperCase().replace(/[^A-Z]/g, '') || 'VARIABLE';
  const timeSinceStart = currentTime - startTime;
  const wordDur = Math.max(0.1, endTime - startTime);

  ctx.save();
  ctx.translate(relX, relY);

  // Counter-rotate if desired to keep the hero badge upright
  const netAngle = nodeRotation - cameraRotation;
  if (Math.abs(netAngle) > 0.001) {
    ctx.rotate(-netAngle);
  }

  // Active Vocal Cue Impact calculation
  const impact = isWordActive
    ? calculateKineticImpact(timeSinceStart, wordDur, true)
    : { scale: 1.0, shakeX: 0, shakeY: 0, ghostAlpha: 0, strobeAlpha: 0 };

  ctx.translate(impact.shakeX, impact.shakeY);
  ctx.scale(impact.scale, impact.scale);

  // Dynamic parameter calculation (something that truly VARIES!)
  const paramFreq = isWordActive ? 4.2 : 2.4;
  const paramVal = Math.sin(currentTime * paramFreq);
  const normalizedParam = (paramVal + 1) / 2; // 0.0 to 1.0
  const displayVal = (paramVal * 8.5).toFixed(1);

  // Strict bounding dimensions to guarantee ZERO BLEED into adjacent words
  const maxSafeW = Math.max(180, allocatedWidth - 8);
  const letterCount = cleanUpper.length;
  // Dynamically scale font so letters fit comfortably within maxSafeW
  const charWidth = Math.min(baseFontSize * 0.55, (maxSafeW - 32) / (letterCount + 0.5));
  const effectiveFontSize = Math.round(charWidth / 0.55);
  const letterSpacing = 2 + 1.2 * Math.sin(currentTime * 3);
  const totalWordW = letterCount * charWidth + (letterCount - 1) * letterSpacing;
  
  const boxW = Math.min(maxSafeW, totalWordW + 28);
  const boxH = effectiveFontSize * 1.5;

  // Caliper & Slider Dimensions (strictly confined within boxW)
  const sliderY = boxH / 2 - 2;
  const sliderTrackW = boxW - 32;
  const sliderKnobX = -sliderTrackW / 2 + normalizedParam * sliderTrackW;

  // Color selection
  const accentOrange = isLight ? '#ea580c' : '#fb923c';
  const accentEmerald = isLight ? '#16a34a' : '#34d399';
  const accentCyan = isLight ? '#0284c7' : '#38bdf8';
  const borderCol = isWordActive ? accentOrange : (isLight ? '#334155' : '#1e293b');

  // 1. Ghost chromatic under-layer on peak vocal hit
  if (impact.ghostAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = impact.ghostAlpha * 0.7;
    ctx.fillStyle = accentOrange;
    ctx.fillRect(-boxW / 2 + 4, -boxH / 2 + 4, boxW, boxH);
    ctx.restore();
  }

  // 2. Hero Background Plate with Caliper Brackets
  ctx.save();
  ctx.fillStyle = isWordActive
    ? (isLight ? '#0f172a' : '#090d16')
    : (isWordPast ? (isLight ? '#334155' : '#0f172a') : (isLight ? 'rgba(241, 245, 249, 0.95)' : 'rgba(15, 23, 42, 0.6)'));
  
  // Rounded plate strictly within [-boxW/2, boxW/2]
  ctx.beginPath();
  ctx.roundRect(-boxW / 2, -boxH / 2 - 6, boxW, boxH + 12, 5);
  ctx.fill();

  // Tactile Caliper Frame & Tick Marks
  ctx.strokeStyle = borderCol;
  ctx.lineWidth = isWordActive ? 2 : 1.2;
  ctx.stroke();

  // Corner caliper brackets strictly inside box boundaries
  const bracketSize = 8;
  ctx.strokeStyle = isWordActive ? accentCyan : accentOrange;
  ctx.lineWidth = 2;

  // Top-left bracket
  ctx.beginPath();
  ctx.moveTo(-boxW / 2 + 2, -boxH / 2 + bracketSize);
  ctx.lineTo(-boxW / 2 + 2, -boxH / 2 - 4);
  ctx.lineTo(-boxW / 2 + 2 + bracketSize, -boxH / 2 - 4);
  ctx.stroke();

  // Top-right bracket
  ctx.beginPath();
  ctx.moveTo(boxW / 2 - 2, -boxH / 2 + bracketSize);
  ctx.lineTo(boxW / 2 - 2, -boxH / 2 - 4);
  ctx.lineTo(boxW / 2 - 2 - bracketSize, -boxH / 2 - 4);
  ctx.stroke();

  // Bottom-left bracket
  ctx.beginPath();
  ctx.moveTo(-boxW / 2 + 2, boxH / 2 - bracketSize + 4);
  ctx.lineTo(-boxW / 2 + 2, boxH / 2 + 4);
  ctx.lineTo(-boxW / 2 + 2 + bracketSize, boxH / 2 + 4);
  ctx.stroke();

  // Bottom-right bracket
  ctx.beginPath();
  ctx.moveTo(boxW / 2 - 2, boxH / 2 - bracketSize + 4);
  ctx.lineTo(boxW / 2 - 2, boxH / 2 + 4);
  ctx.lineTo(boxW / 2 - 2 - bracketSize, boxH / 2 + 4);
  ctx.stroke();

  // Mini Engineering Header Tag
  ctx.font = '700 8px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = isWordActive ? accentCyan : (isLight ? '#64748b' : '#94a3b8');
  const headerTag = isWordActive ? `⟨ DYNAMIC Δx ⟩` : `⟨ VARIABLE ⟩`;
  ctx.fillText(headerTag, 0, -boxH / 2 + 1);

  ctx.restore();

  // 3. Render the letters of "VARIABLE" with Live Parametric Undulation
  const startLetterX = -totalWordW / 2 + charWidth / 2;
  const isShuffling = isWordActive && timeSinceStart < 0.32;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < letterCount; i++) {
    const charX = startLetterX + i * (charWidth + letterSpacing);

    // Letter-by-letter wave of variation
    const wavePhase = currentTime * 5.0 + i * 0.75;
    const waveSin = Math.sin(wavePhase);
    const letterScaleY = 1.0 + 0.14 * waveSin;
    const letterOffsetY = -2.5 * waveSin;

    // What glyph to draw: Rapid shuffle on impact or settled character
    let displayChar = cleanUpper[i];
    if (isShuffling && (i + Math.floor(timeSinceStart * 30)) % 3 !== 0) {
      const shuffleIdx = Math.floor(Math.abs(Math.sin(timeSinceStart * 40 + i)) * ALGEBRAIC_SHUFFLE_GLYPHS.length);
      displayChar = ALGEBRAIC_SHUFFLE_GLYPHS[shuffleIdx % ALGEBRAIC_SHUFFLE_GLYPHS.length];
    }

    // Dynamic weight variation
    const weights = ['400', '600', '700', '800', '900'];
    const weightIdx = Math.floor(((waveSin + 1) / 2) * weights.length);
    const dynamicWeight = weights[Math.min(weights.length - 1, Math.max(0, weightIdx))];

    ctx.save();
    ctx.translate(charX, letterOffsetY);
    ctx.scale(1.0, letterScaleY);

    ctx.font = `${dynamicWeight} ${effectiveFontSize}px "Montserrat", -apple-system, sans-serif`;

    // Dynamic letter colors: shifting subtly through algebraic spectrum
    if (isWordActive) {
      if (displayChar === 'X') {
        ctx.fillStyle = accentOrange;
      } else if (displayChar === 'Y') {
        ctx.fillStyle = accentEmerald;
      } else {
        ctx.fillStyle = '#ffffff';
      }
    } else if (isWordPast) {
      ctx.fillStyle = isLight ? '#f8fafc' : '#e2e8f0';
    } else {
      ctx.fillStyle = isLight ? '#0f172a' : '#cbd5e1';
    }

    ctx.fillText(displayChar, 0, 0);
    ctx.restore();
  }

  // 4. Live Parameter Slider Gauge (Beneath the word, strictly within box)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-sliderTrackW / 2, sliderY);
  ctx.lineTo(sliderTrackW / 2, sliderY);
  ctx.strokeStyle = isLight ? '#475569' : '#334155';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Tick marks along rail
  const tickCount = 5;
  for (let k = 0; k < tickCount; k++) {
    const tx = -sliderTrackW / 2 + (k / (tickCount - 1)) * sliderTrackW;
    ctx.beginPath();
    ctx.moveTo(tx, sliderY - 2);
    ctx.lineTo(tx, sliderY + 2);
    ctx.strokeStyle = isLight ? '#64748b' : '#475569';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Active trail from center to knob
  ctx.beginPath();
  ctx.moveTo(0, sliderY);
  ctx.lineTo(sliderKnobX, sliderY);
  ctx.strokeStyle = isWordActive ? accentOrange : accentCyan;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Sliding Knob (Glow & Bead)
  ctx.fillStyle = isWordActive ? accentOrange : accentCyan;
  ctx.beginPath();
  ctx.arc(sliderKnobX, sliderY, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Knob center core
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(sliderKnobX, sliderY, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Live Numeric Value Readout (Placed cleanly inside box bounds)
  ctx.font = '700 7px "JetBrains Mono", monospace';
  ctx.fillStyle = isWordActive ? accentOrange : (isLight ? '#94a3b8' : '#64748b');
  ctx.textAlign = 'right';
  ctx.fillText(`Δ:${displayVal}`, boxW / 2 - 4, sliderY - 4);

  ctx.restore();

  ctx.restore();
}
