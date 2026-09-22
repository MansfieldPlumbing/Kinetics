/**
 * CAMERA ZOOM THROUGH A LETTER COUNTER (UNINTERRUPTED CONTINUOUS TRANSITION)
 * 
 * Focal point: The internal circular aperture (counter) of the letter 'O' in "UNKNOWN"
 * (sung right before each "Step by step" chorus climax):
 *   Chorus 1: t = 61.78s - 64.34s ("Find the X, find the Y, solve the UNKNOWN")
 *   Chorus 2: t = 120.82s - 123.46s ("Find the X, find the Y, solve the UNKNOWN")
 * 
 * Creates a fluid, cinematic bridge from the kinetic lyrics board through the
 * core of the letter 'O' straight into the monolithic Step-by-Step staircase sequence,
 * completely eliminating any interruptions, blank pauses, or harsh jump cuts.
 */

import { ColorTheme, ThemeColors } from '../types.ts';

function clamp(t: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, t));
}

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

export function renderLetterCounterZoom(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  currentTime: number,
  cueStartTime: number, // 61.78s (Chorus 1) or 120.82s (Chorus 2)
  cueEndTime: number,   // 64.34s (Chorus 1) or 123.46s (Chorus 2)
  theme: ColorTheme = 'light_mode',
  colors?: ThemeColors
): boolean {
  if (currentTime < cueStartTime || currentTime > cueEndTime) {
    return false;
  }

  const duration = cueEndTime - cueStartTime;
  const progress = clamp((currentTime - cueStartTime) / duration);
  const isLight = theme === 'light_mode';
  const bgColor = colors?.background || (isLight ? '#f4f1ea' : '#040711');

  const cx = width / 2;
  const cy = height / 2;

  // 1. Establish the clean canvas background matching the destination scene
  ctx.save();
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = 1.0;

  // 2. Measure "UNKNOWN" and pinpoint the exact focal coordinate inside the letter 'O' counter
  const word = 'UNKNOWN';
  const maxWordW = width * 0.82;
  let baseFontSize = Math.min(108, Math.max(38, Math.floor(width * 0.098)));

  const cacheKey = `${baseFontSize}_${maxWordW}`;
  let metrics = (renderLetterCounterZoom as any)[cacheKey];
  if (!metrics) {
    ctx.font = `900 ${baseFontSize}px "Montserrat", -apple-system, sans-serif`;
    let measuredW = ctx.measureText(word).width;
    if (measuredW > maxWordW && measuredW > 0) {
      baseFontSize = Math.floor(baseFontSize * (maxWordW / measuredW));
      ctx.font = `900 ${baseFontSize}px "Montserrat", -apple-system, sans-serif`;
      measuredW = ctx.measureText(word).width;
    }

    const prefixText = 'UNKN';
    const prefixWidth = ctx.measureText(prefixText).width;
    const letterOWidth = ctx.measureText('O').width;
    const focalX = -measuredW / 2 + prefixWidth + letterOWidth / 2;
    metrics = { baseFontSize, measuredW, prefixWidth, letterOWidth, focalX };
    (renderLetterCounterZoom as any)[cacheKey] = metrics;
  }

  baseFontSize = metrics.baseFontSize;
  const measuredW = metrics.measuredW;
  const focalX = metrics.focalX;
  const focalY = 0;

  // 3. Motion choreography timeline:
  // - Phase 1 (progress 0.0 to 0.22): Hero typographic presence, "SOLVE THE" phrase dissolution
  // - Phase 2 (progress 0.22 to 1.00): Relentless, uninterrupted exponential plunge through the 'O' aperture
  let scale = 1.0;
  let focusWeight = 0;

  if (progress < 0.22) {
    const p = progress / 0.22;
    const ease = easeOutQuad(p);
    scale = 1.0 + 0.04 * ease;
    focusWeight = ease * 0.4;
  } else {
    const zoomP = (progress - 0.22) / 0.78;
    const expoZoom = Math.pow(zoomP, 3.2);
    // Smoothly transition from centering the word to centering the letter 'O' aperture
    const alignP = Math.min(1, zoomP / 0.25);
    focusWeight = 0.4 + 0.6 * alignP * alignP * (3 - 2 * alignP);
    // Expand scale up to ~180 so the aperture counter of 'O' expands to >4,000px,
    // completely engulfing the viewport so the camera literally passes THROUGH the letter
    scale = 1.04 + expoZoom * 180;
  }

  // Exact focal alignment: smoothly pans from the word center to the letter 'O' counter
  // Ensuring letter 'O' counter is dead-center on (cx, cy) throughout the entire plunge
  const fx = focalX * focusWeight;
  const tx = -fx * scale;
  const ty = 0;

  // 4. Dimensional Elements Seen THROUGH the Letter 'O' Aperture
  // Because ctx.fillText draws the letter strokes and leaves the inner counter hollow,
  // whatever is rendered here is seen directly through the circular aperture of 'O'!
  if (progress > 0.18) {
    const tunnelP = clamp((progress - 0.18) / 0.82);
    ctx.save();
    
    // Architectural coordinate grid expanding through the aperture into the Step-by-Step world
    const gridAlpha = tunnelP * (isLight ? 0.08 : 0.12);
    ctx.strokeStyle = isLight ? `rgba(15, 23, 42, ${gridAlpha})` : `rgba(56, 189, 248, ${gridAlpha})`;
    ctx.lineWidth = 1;
    const gridStep = Math.max(40, 80 * (1 + tunnelP * 1.5));
    const gridOffsetX = (currentTime * 60) % gridStep;
    const gridOffsetY = (currentTime * 45) % gridStep;
    
    ctx.beginPath();
    for (let gx = -gridStep + gridOffsetX; gx <= width + gridStep; gx += gridStep) {
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, height);
    }
    for (let gy = -gridStep + gridOffsetY; gy <= height + gridStep; gy += gridStep) {
      ctx.moveTo(0, gy);
      ctx.lineTo(width, gy);
    }
    ctx.stroke();

    // Perspective horizon rays radiating from the center of the aperture
    const rayCount = 16;
    const rayAlpha = Math.sin(tunnelP * Math.PI) * (isLight ? 0.07 : 0.14);
    if (rayAlpha > 0.005) {
      ctx.strokeStyle = isLight ? `rgba(234, 88, 12, ${rayAlpha})` : `rgba(251, 191, 36, ${rayAlpha})`;
      ctx.lineWidth = 1.5;
      const rayLen = Math.max(width, height) * 0.9;
      for (let r = 0; r < rayCount; r++) {
        const ang = (r / rayCount) * Math.PI * 2 + currentTime * 0.4;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(ang) * rayLen, cy + Math.sin(ang) * rayLen);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // 5. Preceding phrase lyrics: "SOLVE THE" (dissolves outward as camera locks into UNKNOWN)
  const prefixAlpha = clamp(1.0 - progress / 0.22);
  if (prefixAlpha > 0.01) {
    ctx.save();
    ctx.globalAlpha = prefixAlpha;
    const prefixSize = Math.max(16, Math.min(28, Math.floor(baseFontSize * 0.42)));
    ctx.font = `800 ${prefixSize}px "Montserrat", -apple-system, sans-serif`;
    ctx.fillStyle = isLight ? '#64748b' : '#38bdf8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    // Positioned gracefully above UNKNOWN with subtle upward float on dissolution
    const driftY = (1.0 - prefixAlpha) * 20;
    ctx.fillText('SOLVE THE', cx, cy - Math.max(48, Math.floor(baseFontSize * 0.65)) - driftY);
    ctx.restore();
  }

  // 6. Render the Focal Word: "UNKNOWN" with deep zoom transformation
  ctx.save();
  ctx.translate(cx + tx, cy + ty);
  ctx.scale(scale, scale);

  ctx.font = `900 ${baseFontSize}px "Montserrat", -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Drop shadow underlayer for cinematic presence during initial zoom
  if (progress < 0.45) {
    ctx.fillStyle = isLight ? 'rgba(0, 0, 0, 0.07)' : 'rgba(56, 189, 248, 0.15)';
    ctx.fillText(word, 3, 3);
  }

  // Main typographic text
  ctx.fillStyle = isLight ? '#0f172a' : '#ffffff';
  ctx.fillText(word, 0, 0);

  // Subtle luminous rim around the letter 'O' when zoom initiates
  if (progress >= 0.15 && progress < 0.65) {
    const rimP = (progress - 0.15) / 0.50;
    const rimAlpha = Math.sin(rimP * Math.PI) * 0.4;
    ctx.save();
    ctx.strokeStyle = isLight ? `rgba(234, 88, 12, ${rimAlpha})` : `rgba(251, 191, 36, ${rimAlpha})`;
    ctx.lineWidth = 2.0;
    ctx.strokeText(word, 0, 0);
    ctx.restore();
  }

  ctx.restore();

  // 7. Luminous Aperture Bloom as Camera Plunges Through the Counter (progress > 0.72)
  // Replaces the letter with radiant volumetric light that seamlessly matches the Step-by-Step realm
  if (progress > 0.72) {
    const bloomP = (progress - 0.72) / 0.28;
    const bloomIntensity = Math.sin(bloomP * Math.PI) * (isLight ? 0.32 : 0.45) + (bloomP > 0.5 ? (bloomP - 0.5) * 0.2 : 0);
    if (bloomIntensity > 0.005) {
      ctx.save();
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.75);
      if (isLight) {
        grad.addColorStop(0, `rgba(245, 158, 11, ${bloomIntensity})`);
        grad.addColorStop(0.45, `rgba(245, 158, 11, ${bloomIntensity * 0.45})`);
        grad.addColorStop(0.85, `rgba(244, 241, 234, ${bloomIntensity * 0.2})`);
        grad.addColorStop(1, 'rgba(244, 241, 234, 0)');
      } else {
        grad.addColorStop(0, `rgba(56, 189, 248, ${bloomIntensity})`);
        grad.addColorStop(0.45, `rgba(56, 189, 248, ${bloomIntensity * 0.45})`);
        grad.addColorStop(0.85, `rgba(4, 7, 17, ${bloomIntensity * 0.2})`);
        grad.addColorStop(1, 'rgba(4, 7, 17, 0)');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }

  ctx.restore();
  return true;
}
