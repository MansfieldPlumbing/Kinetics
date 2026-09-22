/**
 * VOCAL-CUE KINETIC IMPACT & SCREEN SHAKE ENGINE
 * Directly adapts Prototype 2 to our kinetic typography aesthetic:
 * 
 * Features:
 *  - Dynamic scale pop on vocal cue onsets (1.35x -> 1.0x with rapid exponential decay)
 *  - Micro-screen shake on heavy beat hits & rhyme drops
 *  - Translucent chromatic/grit ghost under-layer for high-energy lyrics
 *  - High-contrast strobe impact flash on major phrase transitions
 */

import { ColorTheme, ThemeColors } from '../types.ts';

export interface KineticImpactState {
  scale: number;
  shakeX: number;
  shakeY: number;
  ghostAlpha: number;
  strobeAlpha: number;
}

/**
 * Calculates deterministic kinetic impact values based on time elapsed since word/syllable onset.
 * Zero random mutation in render loops; strictly mathematical and reproducible.
 */
export function calculateKineticImpact(
  timeSinceStart: number,
  wordDuration: number,
  isAccented = false
): KineticImpactState {
  if (timeSinceStart < 0 || timeSinceStart > Math.max(0.4, wordDuration + 0.15)) {
    return { scale: 1.0, shakeX: 0, shakeY: 0, ghostAlpha: 0, strobeAlpha: 0 };
  }

  // 1. Scale pop: 1.35 down to 1.0 with rapid cubic decay
  const popDuration = 0.22;
  let scale = 1.0;
  if (timeSinceStart < popDuration) {
    const popP = timeSinceStart / popDuration;
    scale = 1.0 + 0.35 * Math.pow(1.0 - popP, 2.5);
  }

  // 2. Micro screen shake on accented words
  let shakeX = 0;
  let shakeY = 0;
  const shakeDur = isAccented ? 0.25 : 0.12;
  if (timeSinceStart < shakeDur) {
    const shakeP = 1.0 - timeSinceStart / shakeDur;
    const maxShake = isAccented ? 12 : 5;
    const freq = 45;
    shakeX = Math.sin(timeSinceStart * freq) * maxShake * shakeP;
    shakeY = Math.cos(timeSinceStart * (freq * 1.2)) * maxShake * 0.7 * shakeP;
  }

  // 3. Ghost under-layer trail during peak impact
  const ghostDur = 0.18;
  const ghostAlpha = timeSinceStart < ghostDur ? (1.0 - timeSinceStart / ghostDur) * 0.28 : 0;

  // 4. Strobe flash on very heavy hits
  const strobeDur = 0.08;
  const strobeAlpha = (isAccented && timeSinceStart < strobeDur) ? (1.0 - timeSinceStart / strobeDur) * 0.45 : 0;

  return { scale, shakeX, shakeY, ghostAlpha, strobeAlpha };
}

/**
 * Renders an accented kinetic word with the Prototype 2 scale pop, ghost underlayer,
 * and high-contrast foreground text.
 */
export function renderKineticImpactWord(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  timeSinceStart: number,
  wordDuration: number,
  isAccented: boolean,
  theme: ColorTheme = 'light_mode',
  colors?: ThemeColors
): void {
  const isLight = theme === 'light_mode';
  const impact = calculateKineticImpact(timeSinceStart, wordDuration, isAccented);

  ctx.save();
  ctx.translate(x + impact.shakeX, y + impact.shakeY);
  ctx.scale(impact.scale, impact.scale);

  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Prototype 2 Ghost Underlayer (subtle offset under-glow during impact)
  if (impact.ghostAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = impact.ghostAlpha;
    ctx.fillStyle = isLight ? '#0284c7' : '#ef4444'; // clean cyan or ruby punch
    ctx.fillText(text, 3, 3);
    ctx.restore();
  }

  // Foreground sharp text
  ctx.fillStyle = isLight ? '#0f172a' : '#ffffff';
  ctx.fillText(text, 0, 0);

  ctx.restore();
}
