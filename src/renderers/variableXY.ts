/**
 * ALGEBRAIC VARIABLES 'X' AND 'Y' RENDERER
 * 
 * Invariants per user specification:
 *  1. 'X' and 'Y' MUST ALWAYS BE STRICTLY UPRIGHT:
 *     - Regardless of node rotation (0°, 90°, 180°, 270°) or camera orientation,
 *       the vertical axis of 'X' and 'Y' is counter-rotated so it points
 *       strictly upright (0° in screen space, directly towards the viewer's eyes).
 *     - Never slanted or italicized (strictly font-style: normal).
 * 
 *  2. DISTINCT ALGEBRAIC COLORING (Orange and Green):
 *     - 'X' = Vibrant Mathematical Orange:
 *         • Light mode: #ea580c (persimmon orange, high-contrast)
 *         • Dark mode: #fb923c (electric neon orange)
 *     - 'Y' = Vibrant Mathematical Green:
 *         • Light mode: #16a34a (emerald green, high-contrast)
 *         • Dark mode: #4ade80 (electric neon emerald)
 */

import { ColorTheme, ThemeColors } from '../types.ts';
import { calculateKineticImpact } from './kineticImpact.ts';

export function isVarX(text: string): boolean {
  const clean = text.toLowerCase().replace(/[^a-z]/g, '');
  return clean === 'x';
}

export function isVarY(text: string): boolean {
  const clean = text.toLowerCase().replace(/[^a-z]/g, '');
  return clean === 'y';
}

export function getVariableColor(isX: boolean, theme: ColorTheme = 'light_mode', isDimmed = false): string {
  const isLight = theme === 'light_mode';
  if (isX) {
    if (isDimmed) return isLight ? 'rgba(234, 88, 12, 0.28)' : 'rgba(251, 146, 60, 0.35)';
    return isLight ? '#ea580c' : '#fb923c';
  } else {
    if (isDimmed) return isLight ? 'rgba(22, 163, 74, 0.28)' : 'rgba(74, 222, 128, 0.35)';
    return isLight ? '#16a34a' : '#4ade80';
  }
}

/**
 * Renders an isolated lyric or emphasis word 'X' or 'Y' ensuring it is
 * ALWAYS strictly upright in screen space and colored Orange (X) or Green (Y).
 */
export function renderUprightVariableWord(
  ctx: CanvasRenderingContext2D,
  text: string,
  relX: number,
  relY: number,
  fontSize: number,
  fontFamily: string,
  currentTime: number,
  startTime: number,
  endTime: number,
  isWordActive: boolean,
  isWordPast: boolean,
  theme: ColorTheme = 'light_mode',
  colors?: ThemeColors,
  nodeRotation = 0,
  cameraRotation = 0
): void {
  const isLight = theme === 'light_mode';
  const clean = text.toLowerCase().replace(/[^a-z]/g, '');
  const isX = clean === 'x';
  const varColor = getVariableColor(isX, theme, false);
  const timeSinceStart = currentTime - startTime;
  const wordDur = Math.max(0.1, endTime - startTime);

  ctx.save();
  ctx.translate(relX, relY);

  // COUNTER-ROTATE TO STRICTLY UPRIGHT:
  // Current screen angle is (nodeRotation - cameraRotation).
  // Counter-rotating by -(nodeRotation - cameraRotation) forces screen orientation to 0°!
  const netAngle = nodeRotation - cameraRotation;
  if (Math.abs(netAngle) > 0.0001) {
    ctx.rotate(-netAngle);
  }

  // Active vocal pop / kinetic impact
  const impact = isWordActive
    ? calculateKineticImpact(timeSinceStart, wordDur, true)
    : { scale: 1.0, shakeX: 0, shakeY: 0, ghostAlpha: 0, strobeAlpha: 0 };

  ctx.translate(impact.shakeX, impact.shakeY);
  ctx.scale(impact.scale, impact.scale);

  // Typographic Font: Strictly normal (non-italic), ultra-bold 900
  const letterFont = `900 ${fontSize}px "Montserrat", -apple-system, sans-serif`;
  ctx.font = letterFont;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const letterW = ctx.measureText(text).width;
  const boxW = Math.max(letterW + 28, fontSize * 0.95);
  const boxH = fontSize * 1.15;

  if (isWordActive) {
    // 1. Ghost chromatic underlayer during peak vocal punch
    if (impact.ghostAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = impact.ghostAlpha;
      ctx.fillStyle = varColor;
      ctx.fillRect(-boxW / 2 + 4, -boxH / 2 + 4, boxW, boxH);
      ctx.restore();
    }

    // 2. High-impact tactical punch block
    ctx.fillStyle = isLight ? '#0f172a' : '#030712';
    ctx.beginPath();
    ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, 6);
    ctx.fill();

    // Vibrant Orange or Green tactile border
    ctx.strokeStyle = varColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Inner subtle border
    ctx.strokeStyle = isLight ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-boxW / 2 + 3, -boxH / 2 + 3, boxW - 6, boxH - 6);

    // Variable identification subscript badge [ X₁ / Y₂ ]
    ctx.save();
    ctx.font = '800 10px "JetBrains Mono", monospace';
    ctx.fillStyle = varColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(isX ? 'VAR_X' : 'VAR_Y', 0, -boxH / 2 - 12);
    ctx.restore();

    // Foreground letter in pure vibrant Orange or Green
    ctx.fillStyle = varColor;
    ctx.fillText(text.toUpperCase(), 0, 0);

  } else if (isWordPast) {
    // Spoken/Past state: Still proudly upright and colored Orange or Green with subtle badge
    ctx.fillStyle = isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.06)';
    ctx.beginPath();
    ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, 4);
    ctx.fill();

    ctx.strokeStyle = varColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = varColor;
    ctx.fillText(text.toUpperCase(), 0, 0);

  } else {
    // Unspoken/Future state: Translucent orange or green, strictly upright
    ctx.fillStyle = getVariableColor(isX, theme, true);
    ctx.fillText(text.toUpperCase(), 0, 0);
  }

  ctx.restore();
}

/**
 * Tokenizes a mathematical expression (e.g. "2x - 5", "x + 4", "(2x) ÷ 2", "x = 6")
 * and renders it with:
 *  - Variables 'x' / 'X' rendered in Orange and strictly upright.
 *  - Variables 'y' / 'Y' rendered in Green and strictly upright.
 *  - Numbers and operators rendered in standard theme contrast.
 */
export function renderMathExpressionWithVariables(
  ctx: CanvasRenderingContext2D,
  expr: string,
  startX: number,
  startY: number,
  align: 'left' | 'right' | 'center',
  baseFont: string,
  theme: ColorTheme = 'light_mode',
  nodeRotation = 0,
  cameraRotation = 0,
  customFontSize?: number
): void {
  const isLight = theme === 'light_mode';
  const defaultCol = isLight ? '#0f172a' : '#ffffff';
  const orangeCol = isLight ? '#ea580c' : '#fb923c';
  const greenCol = isLight ? '#16a34a' : '#4ade80';

  // Split expression into individual characters/tokens while preserving spacing
  // Regex splits numbers, operators, parentheses, spaces, and single letters
  const tokens: Array<{ text: string; isVarX: boolean; isVarY: boolean }> = [];
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    const isX = ch.toLowerCase() === 'x';
    const isY = ch.toLowerCase() === 'y';
    tokens.push({ text: ch, isVarX: isX, isVarY: isY });
  }

  ctx.save();
  ctx.font = baseFont;
  ctx.textBaseline = 'middle';

  // Measure total width to handle alignment
  const widths = tokens.map((t) => ctx.measureText(t.text).width);
  const totalW = widths.reduce((a, b) => a + b, 0);

  let curX = startX;
  if (align === 'right') {
    curX = startX - totalW;
  } else if (align === 'center') {
    curX = startX - totalW / 2;
  }

  const netAngle = nodeRotation - cameraRotation;
  const needsUprightCounter = Math.abs(netAngle) > 0.001;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const w = widths[i];
    const charCenterX = curX + w / 2;

    if (t.isVarX || t.isVarY) {
      // Variable character: Rendered in signature Orange or Green and strictly UPRIGHT
      ctx.save();
      ctx.translate(charCenterX, startY);

      if (needsUprightCounter) {
        ctx.rotate(-netAngle);
      }

      ctx.fillStyle = t.isVarX ? orangeCol : greenCol;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = baseFont.replace(/italic/gi, '').replace(/\bnormal\b/gi, '') + ' normal'; // ensure not italic
      ctx.fillText(t.text, 0, 0);

      // Subtle glow underline beneath variable in math equations
      ctx.strokeStyle = t.isVarX ? orangeCol : greenCol;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-w / 2 + 1, (customFontSize || 36) * 0.45);
      ctx.lineTo(w / 2 - 1, (customFontSize || 36) * 0.45);
      ctx.stroke();

      ctx.restore();
    } else {
      // Regular math character (number, operator, parenthesis, space)
      ctx.save();
      ctx.fillStyle = defaultCol;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.text, curX, startY);
      ctx.restore();
    }

    curX += w;
  }

  ctx.restore();
}
