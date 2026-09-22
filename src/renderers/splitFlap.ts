/**
 * SPLIT-FLAP MECHANICAL CHARACTER FLIP ANIMATION
 * Directly adapts Prototype 4 to our kinetic typography aesthetic:
 * 
 * - Split card segments (top plate & bottom plate) hinged along horizontal center.
 * - Dynamic 3D rotation using scaleY = cos(progress * PI).
 * - Drop-shadow deepening as the rotating flap swings through vertical hinge.
 * - Tactile hinge split line, rounded card corners, and authentic mechanical clack.
 * - Used for variable resolution (e.g. X -> 6, ? -> 6, simplifying equations)
 *   and highlighted numbers.
 */

import { ColorTheme } from '../types.ts';

function clamp(t: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, t));
}

export interface SplitFlapOptions {
  cardWidth?: number;
  cardHeight?: number;
  fontSize?: number;
  theme?: ColorTheme;
  borderAccent?: boolean;
}

/**
 * Draws a single split-flap card segment (either top half or bottom half).
 */
function drawCardSegment(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  character: string,
  alignment: 'top' | 'bottom',
  scaleY: number,
  isLight: boolean,
  borderAccent = false
): void {
  ctx.save();

  const hingeY = alignment === 'top' ? y + height : y;

  // 3D vertical foreshortening pivot around the hinge
  ctx.translate(x + width / 2, hingeY);
  ctx.scale(1, Math.max(0.001, Math.abs(scaleY)));
  ctx.translate(-(x + width / 2), -hingeY);

  // Card Background Plate
  ctx.beginPath();
  const radius = 4;
  if (alignment === 'top') {
    ctx.roundRect(x, y, width, height, [radius, radius, 0, 0]);
  } else {
    ctx.roundRect(x, y, width, height, [0, 0, radius, radius]);
  }
  ctx.fillStyle = isLight ? '#1e293b' : '#0a0f18';
  ctx.fill();
  ctx.clip();

  // Subtle tactile card border
  ctx.strokeStyle = borderAccent
    ? (isLight ? '#0284c7' : '#38bdf8')
    : (isLight ? '#334155' : '#1e293b');
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Typography Rendering (Positioned so character spans across the split hinge)
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${height * 1.42}px "Montserrat", "JetBrains Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const textY = alignment === 'top' ? y + height : y;
  ctx.fillText(character, x + width / 2, textY);

  // Geometric Shadowing as flap tilts
  if (scaleY < 1.0) {
    const shadowIntensity = (1.0 - Math.abs(scaleY)) * 0.72;
    ctx.fillStyle = `rgba(0, 0, 0, ${shadowIntensity})`;
    ctx.fillRect(x, y, width, height);
  }

  // Hinge separator groove
  ctx.beginPath();
  ctx.moveTo(x, hingeY);
  ctx.lineTo(x + width, hingeY);
  ctx.strokeStyle = isLight ? '#0f172a' : '#000000';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.restore();
}

/**
 * Renders an animated split-flap card flipping from `charPrevious` to `charNext`.
 * @param progress 0.0 (rest previous) to 1.0 (rest next)
 */
export function renderSplitFlapTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  charPrevious: string,
  charNext: string,
  progress: number,
  options: SplitFlapOptions = {}
): void {
  const width = options.cardWidth || 90;
  const height = options.cardHeight || 130;
  const halfHeight = height / 2;
  const isLight = options.theme === 'light_mode';
  const borderAccent = options.borderAccent ?? false;

  const clampedP = clamp(progress);

  ctx.save();

  // 1. Static backplates (revealed behind flipping flap)
  // Top static plate shows the NEXT character
  drawCardSegment(ctx, x, y, width, halfHeight, charNext, 'top', 1.0, isLight, borderAccent);
  // Bottom static plate shows the PREVIOUS character
  drawCardSegment(ctx, x, y + halfHeight, width, halfHeight, charPrevious, 'bottom', 1.0, isLight, borderAccent);

  // 2. Dynamic rotating flap
  if (clampedP <= 0.5) {
    // First half of flip: top half of previous character rotates down towards camera
    const scaleY = Math.cos(clampedP * Math.PI);
    drawCardSegment(ctx, x, y, width, halfHeight, charPrevious, 'top', scaleY, isLight, borderAccent);
  } else {
    // Second half of flip: bottom half of next character swings down to rest
    const scaleY = Math.cos((1.0 - clampedP) * Math.PI);
    drawCardSegment(ctx, x, y + halfHeight, width, halfHeight, charNext, 'bottom', scaleY, isLight, borderAccent);
  }

  // Tactile split rivet pins on left and right side of hinge
  ctx.fillStyle = isLight ? '#475569' : '#334155';
  ctx.beginPath();
  ctx.arc(x + 2, y + halfHeight, 3, 0, Math.PI * 2);
  ctx.arc(x + width - 2, y + halfHeight, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Renders a word/number split flap string board (e.g. "X = 6" or "10 - 4 = 6")
 */
export function renderSplitFlapBoard(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  fromStr: string,
  toStr: string,
  progress: number,
  options: SplitFlapOptions = {}
): void {
  const cardW = options.cardWidth || 64;
  const cardH = options.cardHeight || 96;
  const gap = 8;
  const maxLen = Math.max(fromStr.length, toStr.length);

  const paddedFrom = fromStr.padStart(maxLen, ' ');
  const paddedTo = toStr.padStart(maxLen, ' ');

  const totalWidth = maxLen * cardW + (maxLen - 1) * gap;
  const startX = centerX - totalWidth / 2;
  const startY = centerY - cardH / 2;

  for (let i = 0; i < maxLen; i++) {
    const fromChar = paddedFrom[i];
    const toChar = paddedTo[i];
    const x = startX + i * (cardW + gap);

    // Stagger flip per card slightly for authentic cascading arrival
    const cardDelay = (i / maxLen) * 0.25;
    const cardProgress = clamp((progress - cardDelay) / (1 - 0.25));

    if (fromChar === toChar) {
      renderSplitFlapTile(ctx, x, startY, toChar, toChar, 1.0, options);
    } else {
      renderSplitFlapTile(ctx, x, startY, fromChar, toChar, cardProgress, options);
    }
  }
}
