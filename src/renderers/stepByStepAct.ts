/**
 * High-Impact "STEP BY STEP, LINE BY LINE" Cinematic Sequence
 * Directly addresses user requests:
 * 1. "make step by step more impactful and more zoomed in like they are big steps falling from the sky and we are walking up them"
 * 2. "and then line by line i think we should figure a different effect out for them that looks like lines somehow i have tons of examples and vector animations"
 * 3. "the answer step doesnt have a face on the right side" -> Complete 3D polyhedron with Top Tread, Front Riser, and Right Side Face!
 * 4. Readability and camera-facing typography preserved.
 * 
 * Synchronized with:
 * - Act II Climax (t = 64.34s to 70.4s): "Step by step, line by line, 'til the answer is shown"
 * - Act IV Climax (t = 129.14s to 133.8s): "Step by step, line by line, to the answer is known"
 */

import { ColorTheme, ThemeColors } from '../types.ts';


interface StepDef {
  text: string;
  startTime: number;
  endTime: number;
  stepIdx: number;
}

interface LineTokenDef {
  text: string;
  startTime: number;
  endTime: number;
  tokenIdx: number;
}

function clamp(t: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, t));
}

function easeOutBack(t: number): number {
  const c1 = 1.75;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function renderStepByStepAct(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  t: number,
  isSecondChorus = false,
  theme: ColorTheme = 'light_mode',
  colors?: ThemeColors
) {
  const isLight = theme === 'light_mode';

  // Base timestamps matching audio subtitles exactly:
  // First chorus starts at 64.34s (preceded by UNKNOWN vocal starting at 61.78s)
  // Second chorus starts at 123.46s (preceded by UNKNOWN vocal starting at 120.82s)
  const baseT = isSecondChorus ? 123.46 : 64.34;
  const zoomStart = isSecondChorus ? 120.82 : 61.78;

  // Cinematic Letter Counter Zoom through 'O' in "UNKNOWN" leading into chorus
  if (t >= zoomStart && t < baseT) {
    return;
  }

  const relT = t - baseT;
  if (relT < 0) return; // Future act: do not render anything

  // Step timings ("Step by step") - 3 big monolithic steps falling from the sky
  const steps: StepDef[] = isSecondChorus
    ? [
        { text: 'STEP', startTime: 0.00, endTime: 0.42, stepIdx: 0 },
        { text: 'BY', startTime: 0.42, endTime: 1.36, stepIdx: 1 },
        { text: 'STEP', startTime: 1.36, endTime: 1.80, stepIdx: 2 },
      ]
    : [
        { text: 'STEP', startTime: 0.00, endTime: 0.38, stepIdx: 0 },
        { text: 'BY', startTime: 0.38, endTime: 1.34, stepIdx: 1 },
        { text: 'STEP', startTime: 1.34, endTime: 1.86, stepIdx: 2 },
      ];

  // Vector Line tokens ("Line by line") - Dynamic animated vector lines effect!
  const lineTokens: LineTokenDef[] = isSecondChorus
    ? [
        { text: 'LINE', startTime: 1.80, endTime: 2.52, tokenIdx: 0 },
        { text: 'BY', startTime: 2.52, endTime: 3.04, tokenIdx: 1 },
        { text: 'LINE', startTime: 3.04, endTime: 3.64, tokenIdx: 2 },
      ]
    : [
        { text: 'LINE', startTime: 1.86, endTime: 2.60, tokenIdx: 0 },
        { text: 'BY', startTime: 2.60, endTime: 3.24, tokenIdx: 1 },
        { text: 'LINE', startTime: 3.24, endTime: 3.74, tokenIdx: 2 },
      ];

  const lineStartTime = lineTokens[0].startTime;
  const summitTime = isSecondChorus ? 3.64 : 3.74;

  // 1. Big Step Geometry (Massive monolithic stairs)
  const stepW = 320;
  const stepH = 110;
  const stepD = 75;
  const deltaX = 230;
  const deltaY = -115;
  const startX = -460;
  const startY = 150;

  // 2. Camera Choreography:
  let camX = 0;
  let camY = 0;
  let camZoom = 1.25;

  if (relT < steps[1].startTime) {
    camX = startX + stepW * 0.45;
    camY = startY + stepH * 0.4;
    camZoom = 1.30;
  } else if (relT < steps[2].startTime) {
    const p = clamp((relT - steps[1].startTime) / (steps[2].startTime - steps[1].startTime));
    const smoothP = easeInOutCubic(p);
    const p0x = startX + stepW * 0.45;
    const p0y = startY + stepH * 0.4;
    const p1x = startX + deltaX + stepW * 0.45;
    const p1y = startY + deltaY + stepH * 0.4;
    camX = p0x + (p1x - p0x) * smoothP;
    camY = p0y + (p1y - p0y) * smoothP;
    camZoom = 1.26 - 0.04 * Math.sin(smoothP * Math.PI);
  } else if (relT < lineStartTime) {
    const p = clamp((relT - steps[2].startTime) / (lineStartTime - steps[2].startTime));
    const smoothP = easeInOutCubic(p);
    const p1x = startX + deltaX + stepW * 0.45;
    const p1y = startY + deltaY + stepH * 0.4;
    const p2x = startX + deltaX * 2 + stepW * 0.45;
    const p2y = startY + deltaY * 2 + stepH * 0.4;
    camX = p1x + (p2x - p1x) * smoothP;
    camY = p1y + (p2y - p1y) * smoothP;
    camZoom = 1.24 - 0.04 * Math.sin(smoothP * Math.PI);
  } else if (relT < summitTime) {
    // Gliding off the steps to the right into the vector line drafting space
    const p = clamp((relT - lineStartTime) / (summitTime - lineStartTime));
    const smoothP = easeInOutCubic(p);
    const p2x = startX + deltaX * 2 + stepW * 0.45;
    const p2y = startY + deltaY * 2 + stepH * 0.4;
    const vectorEndX = 1000; // Track towards end of LINE BY LINE sequence
    const vectorEndY = -30;
    camX = p2x + (vectorEndX - p2x) * smoothP;
    camY = p2y + (vectorEndY - p2y) * smoothP;
    camZoom = 1.18 - 0.12 * smoothP;
  } else {
    // Triumphant pullback to reveal Summit Answer Platform & Banner
    const p = clamp((relT - summitTime) / 1.4);
    const smoothP = easeOutQuad(p);
    const vectorEndX = 1000;
    const vectorEndY = -30;
    const summitFocusX = 1250;
    const summitFocusY = -40;
    camX = vectorEndX + (summitFocusX - vectorEndX) * smoothP;
    camY = vectorEndY + (summitFocusY - vectorEndY) * smoothP;
    camZoom = 1.06 - 0.14 * smoothP;
  }

  // Screen shake on step landing & vector laser strikes
  let shakeX = 0;
  let shakeY = 0;
  for (const s of steps) {
    const dt = relT - s.startTime;
    if (dt >= 0 && dt < 0.26) {
      const amp = (1 - dt / 0.26) * 16;
      shakeX += Math.sin(dt * 65) * amp;
      shakeY += Math.cos(dt * 75) * amp * 0.8;
    }
  }

  // Background clear
  ctx.save();
  ctx.fillStyle = colors?.background || (isLight ? '#f4f1ea' : '#040711');
  ctx.fillRect(0, 0, width, height);

  const CX = width / 2;
  const CY = height / 2;

  // Master Camera Transform
  ctx.save();
  ctx.translate(CX + shakeX, CY + shakeY);
  const isPortrait = width < height;
  const refW = isPortrait ? 960 : 1600;
  const refH = isPortrait ? 1600 : 960;
  const stepRespScale = Math.min(width / refW, height / refH);
  const effectiveZoom = camZoom * stepRespScale;
  ctx.scale(effectiveZoom, effectiveZoom);
  ctx.translate(-camX, -camY);

  // Subtle architectural coordinate grid background during sequence
  ctx.save();
  ctx.strokeStyle = isLight ? 'rgba(15, 23, 42, 0.04)' : 'rgba(56, 189, 248, 0.05)';
  ctx.lineWidth = 1;
  const gridStep = 80;
  const gMinX = -800;
  const gMaxX = 1200;
  const gMinY = -600;
  const gMaxY = 600;
  for (let gx = gMinX; gx <= gMaxX; gx += gridStep) {
    ctx.beginPath();
    ctx.moveTo(gx, gMinY);
    ctx.lineTo(gx, gMaxY);
    ctx.stroke();
  }
  for (let gy = gMinY; gy <= gMaxY; gy += gridStep) {
    ctx.beginPath();
    ctx.moveTo(gMinX, gy);
    ctx.lineTo(gMaxX, gy);
    ctx.stroke();
  }
  ctx.restore();

  // =========================================================================
  // SECTION 1: THE BIG STEPS FALLING FROM THE SKY ("STEP BY STEP")
  // =========================================================================
  steps.forEach((s) => {
    const timeSinceLand = relT - s.startTime;
    if (timeSinceLand < 0) return; // Future step strictly invisible

    const isStepActive = relT >= s.startTime && relT < s.endTime;
    const landP = clamp(timeSinceLand / 0.24);
    const dropEase = easeOutBack(landP);

    // Heavy plunge from sky: 600px fall distance
    const fallDistance = (1 - dropEase) * 600;
    const px = startX + s.stepIdx * deltaX;
    const py = startY + s.stepIdx * deltaY - fallDistance;
    const alpha = clamp(timeSinceLand / 0.06);

    ctx.save();
    ctx.globalAlpha = alpha;

    // --- A. Top Tread (3D perspective depth extending back-right) ---
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + stepW, py);
    ctx.lineTo(px + stepW + stepD, py - stepD * 0.45);
    ctx.lineTo(px + stepD, py - stepD * 0.45);
    ctx.closePath();

    const treadGrad = ctx.createLinearGradient(px, py, px + stepW + stepD, py - stepD * 0.45);
    if (isLight) {
      treadGrad.addColorStop(0, isStepActive ? '#475569' : '#334155');
      treadGrad.addColorStop(1, '#1e293b');
    } else {
      treadGrad.addColorStop(0, isStepActive ? '#1e293b' : '#0f172a');
      treadGrad.addColorStop(1, '#020617');
    }
    ctx.fillStyle = treadGrad;
    ctx.fill();

    ctx.strokeStyle = isLight ? '#0f172a' : (isStepActive ? '#38bdf8' : '#1e293b');
    ctx.lineWidth = isStepActive ? 2.5 : 1.5;
    ctx.stroke();

    // Tread grip lines (tactile stair treads)
    ctx.strokeStyle = isLight ? 'rgba(255, 255, 255, 0.15)' : 'rgba(56, 189, 248, 0.15)';
    ctx.lineWidth = 1;
    for (let k = 1; k <= 3; k++) {
      const frac = k / 4;
      ctx.beginPath();
      ctx.moveTo(px + stepD * frac, py - stepD * 0.45 * frac);
      ctx.lineTo(px + stepW + stepD * frac, py - stepD * 0.45 * frac);
      ctx.stroke();
    }

    // Walking Waypoint Beacon on Tread (Lights up when we "walk" onto it)
    const isWalkedOn = relT >= s.endTime && relT < summitTime;
    if (isWalkedOn || isStepActive) {
      const treadCenterX = px + stepW / 2 + stepD * 0.5;
      const treadCenterY = py - stepD * 0.22;
      const pulse = Math.sin(relT * 8 + s.stepIdx) * 0.5 + 0.5;

      ctx.save();
      // Glowing waypoint ring
      ctx.strokeStyle = isStepActive
        ? (isLight ? '#ea580c' : '#fb923c')
        : (isLight ? '#0284c7' : '#38bdf8');
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(treadCenterX, treadCenterY, 32 + pulse * 6, 12 + pulse * 2.5, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Waypoint index tag
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.fillStyle = isLight ? '#ffffff' : '#38bdf8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`▲ STEP 0${s.stepIdx + 1}`, treadCenterX, treadCenterY);
      ctx.restore();
    }

    // --- B. Right Side Face ---
    ctx.beginPath();
    ctx.moveTo(px + stepW, py);
    ctx.lineTo(px + stepW + stepD, py - stepD * 0.45);
    ctx.lineTo(px + stepW + stepD, py + stepH - stepD * 0.45);
    ctx.lineTo(px + stepW, py + stepH);
    ctx.closePath();

    ctx.fillStyle = isLight ? '#0f172a' : '#020617';
    ctx.fill();
    ctx.strokeStyle = isLight ? '#1e293b' : '#1e293b';
    ctx.lineWidth = 2;
    ctx.stroke();

    // --- C. Front Riser (Vertical Face) - Facing Camera Directly ---
    ctx.beginPath();
    ctx.rect(px, py, stepW, stepH);
    ctx.closePath();

    if (isStepActive) {
      ctx.fillStyle = isLight ? '#0f172a' : '#0284c7';
    } else {
      ctx.fillStyle = isLight ? '#1e293b' : '#0f172a';
    }
    ctx.fill();

    ctx.strokeStyle = isLight ? '#000000' : (isStepActive ? '#ffffff' : '#334155');
    ctx.lineWidth = isStepActive ? 3.5 : 2;
    ctx.stroke();

    // Inner bevel border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 6, py + 6, stepW - 12, stepH - 12);

    // Front Riser Typography: Giant, bold, camera-facing
    ctx.save();
    const textCenterX = px + stepW / 2;
    const textCenterY = py + stepH / 2;

    ctx.translate(textCenterX, textCenterY);

    // Kinetic impact slam scale on landing
    if (timeSinceLand < 0.24) {
      const popP = timeSinceLand / 0.24;
      const popScale = 1.0 + 0.35 * Math.pow(1 - popP, 2);
      ctx.scale(popScale, popScale);
    }

    ctx.font = '900 52px "Montserrat", -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Pure white lettering directly on dark face
    ctx.fillStyle = '#ffffff';
    ctx.fillText(s.text, 0, 2);

    // Subtitle indicator on front riser
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.fillStyle = isStepActive ? (isLight ? '#38bdf8' : '#f8fafc') : 'rgba(255, 255, 255, 0.4)';
    ctx.fillText(`[ LEVEL 0${s.stepIdx + 1} // ELEVATION ${(s.stepIdx + 1) * 12}m ]`, 0, 36);

    ctx.restore();

    // Impact Ground Shockwave & Corner Sparks on slam landing
    if (timeSinceLand >= 0 && timeSinceLand < 0.38) {
      const ringP = Math.min(1, Math.max(0, timeSinceLand / 0.38));
      ctx.save();
      ctx.strokeStyle = isLight ? '#0f172a' : '#38bdf8';
      ctx.lineWidth = Math.max(0.5, 3.5 * (1 - ringP));
      ctx.beginPath();
      ctx.ellipse(px + stepW / 2, py + stepH, (stepW * 0.65) * (1 + ringP * 1.4), 22 * (1 + ringP * 1.4), 0, 0, Math.PI * 2);
      ctx.stroke();

      // Corner particle sparks
      const sparkCount = 8;
      const sparkRadius = Math.max(0, 2.5 * (1 - ringP));
      if (sparkRadius > 0.01) {
        ctx.fillStyle = isLight ? '#ea580c' : '#fb923c';
        for (let sp = 0; sp < sparkCount; sp++) {
          const sparkAng = (sp / sparkCount) * Math.PI - Math.PI / 2;
          const dist = ringP * 65;
          ctx.beginPath();
          ctx.arc(px + Math.cos(sparkAng) * dist, py + stepH + Math.sin(sparkAng) * (dist * 0.3), sparkRadius, 0, Math.PI * 2);
          ctx.arc(px + stepW - Math.cos(sparkAng) * dist, py + stepH + Math.sin(sparkAng) * (dist * 0.3), sparkRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    ctx.restore();
  });

  // =========================================================================
  // SECTION 2: DYNAMIC ANIMATED VECTOR LINES ("LINE BY LINE")
  // Layout to the right of the stairs. Line->Right, By->Down, Line->Right.
  // =========================================================================
  if (relT >= lineStartTime) {
    const vY_upper = -140; // Upper horizontal line
    const vY_lower = 80;   // Lower horizontal line

    const vX_1_start = 450;
    const vX_1_end = 800;
    const vX_2_start = 800;
    const vX_2_end = 1150;

    // --- TOKEN 0: "LINE" (Upper Laser Ruled Line) ---
    const tok0 = lineTokens[0];
    if (relT >= tok0.startTime) {
      const dt0 = relT - tok0.startTime;
      const isTok0Active = relT >= tok0.startTime && relT < tok0.endTime;
      const beamProgress0 = clamp(dt0 / 0.22);
      const curBeamEndX = vX_1_start + beamProgress0 * (vX_1_end - vX_1_start);

      ctx.save();
      ctx.strokeStyle = isLight ? '#0284c7' : '#38bdf8';
      ctx.lineWidth = isTok0Active ? 3.5 : 2;
      ctx.beginPath();
      ctx.moveTo(vX_1_start, vY_upper);
      ctx.lineTo(curBeamEndX, vY_upper);
      ctx.stroke();

      if (beamProgress0 < 1.0) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(curBeamEndX, vY_upper, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = isLight ? '#ea580c' : '#38bdf8';
        ctx.beginPath();
        ctx.arc(curBeamEndX, vY_upper, 10, 0, Math.PI * 2);
        ctx.globalAlpha = 0.5;
        ctx.fill();
      }

      ctx.strokeStyle = isLight ? '#475569' : '#0284c7';
      ctx.lineWidth = 1;
      const numTicks = 16;
      for (let i = 0; i <= numTicks; i++) {
        const tx = vX_1_start + (i / numTicks) * (vX_1_end - vX_1_start);
        if (tx <= curBeamEndX) {
          const isMajor = i % 4 === 0;
          const tickH = isMajor ? 12 : 6;
          ctx.beginPath();
          ctx.moveTo(tx, vY_upper - tickH / 2);
          ctx.lineTo(tx, vY_upper + tickH / 2);
          ctx.stroke();
        }
      }

      if (beamProgress0 >= 0.7) {
        ctx.font = '700 10px "JetBrains Mono", monospace';
        ctx.fillStyle = isLight ? '#0369a1' : '#7dd3fc';
        ctx.textAlign = 'left';
        ctx.fillText(`|◄── VECTOR LINE A [X-AXIS // y=${vY_upper}px] ──►|`, vX_1_start + 15, vY_upper - 18);
      }

      const word0X = (vX_1_start + vX_1_end) / 2;
      const word0Y = vY_upper;
      const word0P = clamp(dt0 / 0.16);

      ctx.save();
      ctx.translate(word0X, word0Y);
      const pop0 = 1.0 + 0.3 * Math.pow(1 - word0P, 2);
      ctx.scale(pop0, pop0);

      const card0W = 210;
      const card0H = 68;
      ctx.fillStyle = isTok0Active ? (isLight ? '#0f172a' : '#0284c7') : (isLight ? '#1e293b' : '#0f172a');
      ctx.fillRect(-card0W / 2, -card0H / 2, card0W, card0H);
      ctx.strokeStyle = isTok0Active ? (isLight ? '#ea580c' : '#ffffff') : (isLight ? '#0284c7' : '#38bdf8');
      ctx.lineWidth = 2.5;
      ctx.strokeRect(-card0W / 2, -card0H / 2, card0W, card0H);

      ctx.font = '900 44px "Montserrat", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('LINE', 0, 1);
      ctx.restore();
      ctx.restore();
    }

    // --- TOKEN 1: "BY" (Orthogonal Connector Drop-Line) ---
    const tok1 = lineTokens[1];
    if (relT >= tok1.startTime) {
      const dt1 = relT - tok1.startTime;
      const isTok1Active = relT >= tok1.startTime && relT < tok1.endTime;
      const connP = clamp(dt1 / 0.18);
      const connX = vX_1_end;
      const curDropY = vY_upper + connP * (vY_lower - vY_upper);

      ctx.save();
      ctx.strokeStyle = isLight ? '#ea580c' : '#fb923c';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(connX, vY_upper);
      ctx.lineTo(connX, curDropY);
      ctx.stroke();

      const word1Y = (vY_upper + vY_lower) / 2;
      ctx.save();
      ctx.translate(connX, word1Y);
      const pop1 = 1.0 + 0.35 * Math.pow(1 - clamp(dt1 / 0.16), 2);
      ctx.scale(pop1, pop1);

      const card1W = 120;
      const card1H = 54;
      ctx.fillStyle = isTok1Active ? (isLight ? '#b45309' : '#ea580c') : (isLight ? '#0f172a' : '#1e293b');
      ctx.fillRect(-card1W / 2, -card1H / 2, card1W, card1H);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(-card1W / 2, -card1H / 2, card1W, card1H);

      ctx.font = '900 36px "Montserrat", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('BY', 0, 1);
      ctx.restore();
      ctx.restore();
    }

    // --- TOKEN 2: "LINE" (Lower Parallel Laser Beam) ---
    const tok2 = lineTokens[2];
    if (relT >= tok2.startTime) {
      const dt2 = relT - tok2.startTime;
      const isTok2Active = relT >= tok2.startTime && relT < tok2.endTime;
      const beamProgress2 = clamp(dt2 / 0.20);
      const curBeamEndX = vX_2_start + beamProgress2 * (vX_2_end - vX_2_start);

      ctx.save();
      ctx.strokeStyle = isLight ? '#16a34a' : '#4ade80';
      ctx.lineWidth = isTok2Active ? 3.5 : 2;
      ctx.beginPath();
      ctx.moveTo(vX_2_start, vY_lower);
      ctx.lineTo(curBeamEndX, vY_lower);
      ctx.stroke();

      if (beamProgress2 < 1.0) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(curBeamEndX, vY_lower, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = isLight ? '#16a34a' : '#4ade80';
        ctx.beginPath();
        ctx.arc(curBeamEndX, vY_lower, 10, 0, Math.PI * 2);
        ctx.globalAlpha = 0.5;
        ctx.fill();
      }

      if (beamProgress2 >= 0.7) {
        ctx.font = '700 10px "JetBrains Mono", monospace';
        ctx.fillStyle = isLight ? '#15803d' : '#86efac';
        ctx.textAlign = 'left';
        ctx.fillText(`|◄── VECTOR LINE B [PARALLEL // Δy=${vY_lower - vY_upper}px] ──►|`, vX_2_start + 15, vY_lower + 20);
      }

      const word2X = (vX_2_start + vX_2_end) / 2;
      const word2Y = vY_lower;
      const word2P = clamp(dt2 / 0.16);

      ctx.save();
      ctx.translate(word2X, word2Y);
      const pop2 = 1.0 + 0.3 * Math.pow(1 - word2P, 2);
      ctx.scale(pop2, pop2);

      const card2W = 210;
      const card2H = 68;
      ctx.fillStyle = isTok2Active ? (isLight ? '#065f46' : '#16a34a') : (isLight ? '#1e293b' : '#0f172a');
      ctx.fillRect(-card2W / 2, -card2H / 2, card2W, card2H);
      ctx.strokeStyle = isTok2Active ? (isLight ? '#34d399' : '#ffffff') : (isLight ? '#16a34a' : '#4ade80');
      ctx.lineWidth = 2.5;
      ctx.strokeRect(-card2W / 2, -card2H / 2, card2W, card2H);

      ctx.font = '900 44px "Montserrat", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('LINE', 0, 1);
      ctx.restore();
      ctx.restore();
    }
  }

  // =========================================================================
  // SECTION 3: SUMMIT PLATFORM & CLIMAX BANNER ("'TIL THE ANSWER IS SHOWN")
  // =========================================================================
  if (relT >= summitTime) {
    const timeSinceSummit = relT - summitTime;
    const summitP = clamp(timeSinceSummit / 0.28);
    const summitEase = easeOutBack(summitP);

    // Placed at the end of the line
    const summitX = 1200;
    const summitY = 10 - (1 - summitEase) * 280;
    const summitW = 320;
    const summitH = 105;
    const summitD = 80;

    ctx.save();
    ctx.globalAlpha = clamp(timeSinceSummit / 0.10);

    // --- A. Top Tread (Emerald crystalline surface) ---
    ctx.beginPath();
    ctx.moveTo(summitX, summitY);
    ctx.lineTo(summitX + summitW, summitY);
    ctx.lineTo(summitX + summitW + summitD, summitY - summitD * 0.45);
    ctx.lineTo(summitX + summitD, summitY - summitD * 0.45);
    ctx.closePath();

    const summitTreadGrad = ctx.createLinearGradient(summitX, summitY, summitX + summitW + summitD, summitY - summitD * 0.45);
    if (isLight) {
      summitTreadGrad.addColorStop(0, '#059669');
      summitTreadGrad.addColorStop(1, '#047857');
    } else {
      summitTreadGrad.addColorStop(0, '#065f46');
      summitTreadGrad.addColorStop(1, '#022c22');
    }
    ctx.fillStyle = summitTreadGrad;
    ctx.fill();

    ctx.strokeStyle = isLight ? '#064e3b' : '#34d399';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Tread contour lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    for (let k = 1; k <= 3; k++) {
      const frac = k / 4;
      ctx.beginPath();
      ctx.moveTo(summitX + summitD * frac, summitY - summitD * 0.45 * frac);
      ctx.lineTo(summitX + summitW + summitD * frac, summitY - summitD * 0.45 * frac);
      ctx.stroke();
    }

    // --- B. RIGHT SIDE FACE (CRITICAL USER FIX) ---
    // Fully renders the 3D isometric right side face of the Answer step!
    ctx.beginPath();
    ctx.moveTo(summitX + summitW, summitY);
    ctx.lineTo(summitX + summitW + summitD, summitY - summitD * 0.45);
    ctx.lineTo(summitX + summitW + summitD, summitY + summitH - summitD * 0.45);
    ctx.lineTo(summitX + summitW, summitY + summitH);
    ctx.closePath();

    const rightFaceGrad = ctx.createLinearGradient(summitX + summitW, summitY, summitX + summitW + summitD, summitY + summitH);
    if (isLight) {
      rightFaceGrad.addColorStop(0, '#064e3b');
      rightFaceGrad.addColorStop(1, '#022c22');
    } else {
      rightFaceGrad.addColorStop(0, '#022c22');
      rightFaceGrad.addColorStop(1, '#011c14');
    }
    ctx.fillStyle = rightFaceGrad;
    ctx.fill();

    ctx.strokeStyle = isLight ? '#022c22' : '#059669';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Subtle edge highlight on the right side bevel
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(summitX + summitW + 2, summitY + 2);
    ctx.lineTo(summitX + summitW + summitD - 2, summitY - summitD * 0.45 + 2);
    ctx.lineTo(summitX + summitW + summitD - 2, summitY + summitH - summitD * 0.45 - 2);
    ctx.stroke();

    // --- C. Front Riser (Deep emerald block face) ---
    ctx.beginPath();
    ctx.rect(summitX, summitY, summitW, summitH);
    ctx.closePath();

    ctx.fillStyle = isLight ? '#064e3b' : '#01281e';
    ctx.fill();

    ctx.strokeStyle = isLight ? '#047857' : '#10b981';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Inner bevel
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(summitX + 6, summitY + 6, summitW - 12, summitH - 12);

    // Front text on summit block: "ANSWER"
    ctx.font = '900 48px "Montserrat", -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('ANSWER', summitX + summitW / 2, summitY + summitH / 2);

    // Sub-label on Answer block
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.fillStyle = isLight ? '#34d399' : '#6ee7b7';
    ctx.fillText('⟨ FINAL DERIVATION // EQUILIBRIUM REACHED ⟩', summitX + summitW / 2, summitY + summitH / 2 + 34);

    // --- D. CLIMAX DISPLAY BANNER: "'TIL THE ANSWER IS SHOWN / KNOWN" ---
    const bannerText = isSecondChorus ? "'TIL THE ANSWER IS KNOWN" : "'TIL THE ANSWER IS SHOWN";
    const bannerY = summitY - 70;

    ctx.save();
    ctx.font = '900 36px "Montserrat", -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const bannerMetrics = ctx.measureText(bannerText);
    const cardW = bannerMetrics.width + 56;
    const cardH = 62;
    const cardX = summitX + summitW / 2 - cardW / 2;
    const cardY = bannerY - cardH / 2;

    ctx.fillStyle = isLight ? '#0f172a' : '#0284c7';
    ctx.fillRect(cardX, cardY, cardW, cardH);

    ctx.strokeStyle = isLight ? '#10b981' : '#38bdf8';
    ctx.lineWidth = 3;
    ctx.strokeRect(cardX, cardY, cardW, cardH);

    // Caliper brackets on banner
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cardX + 8, cardY + 16);
    ctx.lineTo(cardX + 8, cardY + 8);
    ctx.lineTo(cardX + 16, cardY + 8);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cardX + cardW - 8, cardY + cardH - 16);
    ctx.lineTo(cardX + cardW - 8, cardY + cardH - 8);
    ctx.lineTo(cardX + cardW - 16, cardY + cardH - 8);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.fillText(bannerText, summitX + summitW / 2, bannerY);
    ctx.restore();

    ctx.restore();
  }

  ctx.restore(); // end camera transform

  // Seamless aperture bloom handoff from letterCounterZoom:
  // As camera breaks through the 'O' aperture, the radiant volumetric bloom smoothly clears
  // over the first 0.40s as the monolithic "STEP" block hits the ground with authority.
  if (relT < 0.40) {
    const bloomP = 1.0 - relT / 0.40;
    const bloomIntensity = bloomP * (isLight ? 0.35 : 0.48);
    if (bloomIntensity > 0.005) {
      ctx.save();
      const cx = width / 2;
      const cy = height / 2;
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

  ctx.restore(); // end root save
}
