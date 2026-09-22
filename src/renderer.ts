/**
 * MULTI-PROJECTION KINETIC TYPOGRAPHY & MATHEMATICAL RENDERER
 * 
 * Strict Architectural Separation of Concerns:
 * - CINEMATIC (Default): The intended kinetic typography film.
 *   Clean 2D plane typography. When lyrics become mathematical, seamlessly
 *   transitions into stark black-and-white formal mathematical notation whose
 *   symbols kinetically execute the operations. ZERO graph edges, ZERO debug grids.
 * - MATH: Dedicated projection of the compiled symbolic mathematical scenes.
 * - KARAOKE: Simple lyric + active word + bouncing dot.
 * - DEBUG GRAPH: Full diagnostic oscilloscope exposing the machine (causal rail,
 *   edges, node IDs, anchors, turn angles, pivot characters, camera target crosshairs).
 * - OVERVIEW: Persistent world viewed spatially from a high vantage point.
 */

import { 
  type LayoutGraph,
  type SceneNode,
  type TimedWord,
  type PositionedWord,
  type CameraState,
  type ColorTheme,
  type ThemeColors,
  type ProjectionViewMode,
} from './types.ts';
import { SymbolicMathScene } from './mathCompiler.ts';
import { applyCameraTransform, worldToScreen } from './camera.ts';
import { countSyllables } from './graph.ts';
import { renderStepByStepAct } from './renderers/stepByStepAct.ts';
import { renderLetterCounterZoom } from './renderers/letterCounterZoom.ts';
import { renderSplitFlapTile, renderSplitFlapBoard } from './renderers/splitFlap.ts';
import { renderMathScene1, renderMathScene2, getMathScene1Layout, getMathScene2Layout } from './renderers/mathActs.ts';
import { calculateKineticImpact } from './renderers/kineticImpact.ts';
import { isVariableWord, renderVariableHeroWord } from './renderers/variableHero.ts';
import {
  isVarX,
  isVarY,
  renderUprightVariableWord,
  renderMathExpressionWithVariables,
} from './renderers/variableXY.ts';
import { renderBouncingBall } from './bouncingBall.ts';
import { renderKaraokeFilmCreditsView } from './renderers/karaokeScroll.ts';

export const THEMES: Record<ColorTheme, ThemeColors> = {
  dark_mode: {
    background: '#0a0a0a',
    vignetteInner: 'rgba(28, 28, 28, 0.2)',
    vignetteOuter: 'rgba(0, 0, 0, 0.85)',
    activeWordText: '#ffffff',
    activeWordBg: '#ffffff',
    spokenWordText: '#e5e7eb',
    unspokenWordText: 'rgba(255, 255, 255, 0.35)',
    pastBlockText: '#6b7280',
    edgeGuideline: 'rgba(255, 255, 255, 0.12)',
    mathAccent: '#ffffff',
    scaleBeam: '#ffffff',
    ruleStroke: '#4b5563',
    varXColor: '#fb923c',
    varYColor: '#4ade80',
  },
  light_mode: {
    background: '#f4f2eb',
    vignetteInner: 'rgba(255, 255, 255, 0.15)',
    vignetteOuter: 'rgba(30, 25, 20, 0.25)',
    activeWordText: '#000000',
    activeWordBg: '#000000',
    spokenWordText: '#1f2937',
    unspokenWordText: 'rgba(15, 23, 42, 0.32)',
    pastBlockText: '#6b7280',
    edgeGuideline: 'rgba(0, 0, 0, 0.14)',
    mathAccent: '#000000',
    scaleBeam: '#111827',
    ruleStroke: '#9ca3af',
    varXColor: '#ea580c',
    varYColor: '#16a34a',
  },
};

let cachedVignetteGrad: CanvasGradient | null = null;
let cachedVignetteKey = '';

/**
 * Main render orchestrator observing the compiled graph and dispatching to projections.
 */

function evaluateFloatKeyframes(keyframes: import('./types.ts').FloatKeyframe[] | undefined, currentTime: number, defaultValue: number): number {
  if (!keyframes || keyframes.length === 0) return defaultValue;
  if (currentTime <= keyframes[0].time) return keyframes[0].value;
  if (currentTime >= keyframes[keyframes.length - 1].time) return keyframes[keyframes.length - 1].value;

  let idx = 0;
  while (idx < keyframes.length - 1 && keyframes[idx + 1].time <= currentTime) {
    idx++;
  }

  const k1 = keyframes[idx];
  const k2 = keyframes[idx + 1];

  if (k1.ease === 'hold') return k1.value;

  const duration = k2.time - k1.time;
  if (duration <= 0) return k2.value;

  const progress = (currentTime - k1.time) / duration;
  
  let ease = progress;
  if (k1.ease === 'easeInOutCubic') {
    ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
  } else if (k1.ease === 'easeOutQuad') {
    ease = 1 - (1 - progress) * (1 - progress);
  }

  return k1.value + (k2.value - k1.value) * ease;
}

function evaluateColorKeyframes(keyframes: import('./types.ts').ColorKeyframe[] | undefined, currentTime: number, defaultValue: string): string {
  if (!keyframes || keyframes.length === 0) return defaultValue;
  if (currentTime <= keyframes[0].time) return keyframes[0].value;
  if (currentTime >= keyframes[keyframes.length - 1].time) return keyframes[keyframes.length - 1].value;

  let idx = 0;
  while (idx < keyframes.length - 1 && keyframes[idx + 1].time <= currentTime) {
    idx++;
  }
  return keyframes[idx].value;
}

export function renderCausalGraph(
  ctx: CanvasRenderingContext2D,
  graph: LayoutGraph,
  camera: CameraState,
  currentTime: number,
  canvasWidth: number,
  canvasHeight: number,
  viewMode: ProjectionViewMode = 'presentation',
  theme: ColorTheme = 'light_mode'
): void {
  const colors = THEMES[theme] || THEMES.light_mode;

  // Dispatch to requested projection of the single continuous score
  switch (viewMode) {
    case 'karaoke':
      renderKaraokeView(ctx, graph, camera, currentTime, canvasWidth, canvasHeight, colors);
      break;

    case 'math': {
      let activeMathScene: SymbolicMathScene | null = null;
      if (graph.mathScenes && graph.mathScenes.length > 0) {
        for (const scene of graph.mathScenes) {
          if (currentTime >= scene.startTime - 0.2 && currentTime <= scene.endTime + 0.2) {
            activeMathScene = scene;
            break;
          }
        }
      }

      if (activeMathScene) {
        renderKineticMathScene(ctx, activeMathScene, currentTime, canvasWidth, canvasHeight);
      } else {
        // Standby math scene: find the most recent or upcoming scene
        const nearestScene =
          graph.mathScenes.find((s) => s.startTime > currentTime) ||
          graph.mathScenes[graph.mathScenes.length - 1] ||
          graph.mathScenes[0];
        if (nearestScene) {
          renderKineticMathScene(ctx, nearestScene, nearestScene.startTime, canvasWidth, canvasHeight);
        } else {
          renderEmptyMathStandby(ctx, canvasWidth, canvasHeight);
        }
      }
      break;
    }

    case 'debug_overlay':
      renderDebugGraphView(ctx, graph, camera, currentTime, canvasWidth, canvasHeight, colors);
      break;

    case 'global_orthographic':
      renderOverviewView(ctx, graph, camera, currentTime, canvasWidth, canvasHeight, colors);
      break;

    case 'presentation':
    default:
      // Cinematic projection: Smooth continuous camera tracking of the unified score,
      // embedding both expressive lyrics and algebraic balance beams in one continuous plane.
      renderCinematicTypographyView(ctx, graph, camera, currentTime, canvasWidth, canvasHeight, colors, theme);
      break;
  }

  }

// ----------------------------------------------------------------------------
// 1. CINEMATIC TYPOGRAPHY PROJECTION (Continuous Spatial Flow)
// ----------------------------------------------------------------------------

function renderCinematicTypographyView(
  ctx: CanvasRenderingContext2D,
  graph: LayoutGraph,
  camera: CameraState,
  currentTime: number,
  canvasWidth: number,
  canvasHeight: number,
  colors: ThemeColors,
  theme: ColorTheme = 'light_mode'
): void {
  // High-Impact Ascending Staircase Sequence during Chorus climaxes
  // Preceded by the uninterrupted letter counter zoom through 'O' in "UNKNOWN":
  // Chorus 1: t = 61.78s -> 64.34s (zoom through 'O') -> 70.9s (monolithic steps)
  // Chorus 2: t = 120.82s -> 123.46s (zoom through 'O') -> 130.0s (monolithic steps)
  const zoomStart1 = 61.78;
  const baseT1 = 64.34;
  const exitT1 = 70.4;
  const endT1 = 70.9;

  const zoomStart2 = 120.82;
  const baseT2 = 123.46;
  const exitT2 = 129.5;
  const endT2 = 130.0;

  const isChorusAct1 = currentTime >= zoomStart1 && currentTime < endT1;
  const isChorusAct2 = currentTime >= zoomStart2 && currentTime < endT2;

  let sbsFadeAlpha = 0;
  let sbsIsSecond = false;

  if (isChorusAct1 || isChorusAct2) {
    sbsIsSecond = isChorusAct2;
    const zStart = sbsIsSecond ? zoomStart2 : zoomStart1;
    const bTime = sbsIsSecond ? baseT2 : baseT1;
    const exTime = sbsIsSecond ? exitT2 : exitT1;
    const endTime = sbsIsSecond ? endT2 : endT1;

    // Phase 1: Uninterrupted zoom through the 'O' aperture in "UNKNOWN" (61.78 -> 64.34 & 120.82 -> 123.46)
    if (currentTime < bTime) {
      renderLetterCounterZoom(ctx, canvasWidth, canvasHeight, currentTime, zStart, bTime, theme, colors);
      renderCinematicVignette(ctx, canvasWidth, canvasHeight, colors);
      return;
    }

    // Phase 2: Monolithic Step-by-Step 3D Act (64.34 -> 70.4 & 123.46 -> 129.5)
    if (currentTime <= exTime) {
      renderStepByStepAct(ctx, canvasWidth, canvasHeight, currentTime, sbsIsSecond, theme, colors);
      renderCinematicVignette(ctx, canvasWidth, canvasHeight, colors);
      return;
    }

    // Phase 3: Prepare crossfade out into subsequent math scene / kinetic typography
    sbsFadeAlpha = Math.max(0, 1.0 - (currentTime - exTime) / (endTime - exTime));
  }

      // Clear canvas background
      ctx.save();
      ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.restore();

  // Math Acts Camera Override (Pushes lyrics back and shakes them "going brrr")
  const overrideCamera = { ...camera };
  const m1Start = 70.4, m1End = 90.0; // Ends at 90s to let "It isn't dark magic..." lyrics take over
  const m2Start = 153.4, m2End = 175.5; // Ends at 175.5s to let "The equation is solved..." lyrics take over
  let mathIntensity = 0;
  
  if (currentTime >= m1Start && currentTime <= m1End) {
    const actT = Math.min(1.0, (currentTime - m1Start) / 1.5);
    const exitT = Math.max(0, (currentTime - (m1End - 1.5)) / 1.5);
    mathIntensity = (1 - Math.pow(1 - actT, 3)) * (1 - exitT);
  } else if (currentTime >= m2Start && currentTime <= m2End) {
    const actT = Math.min(1.0, (currentTime - m2Start) / 1.5);
    const exitT = Math.max(0, (currentTime - (m2End - 1.5)) / 1.5);
    mathIntensity = (1 - Math.pow(1 - actT, 3)) * (1 - exitT);
  }

  if (mathIntensity > 0) {
    // Push the background lyrics DOWN out of the way of the math equation
    // (moving the camera UP pushes the world down on screen)
    overrideCamera.y -= 250 * mathIntensity; 
    
    // Keep zoom relatively tight so the lyrics look like a "streamlined train"
    // rather than a scattered photobomb of text.
    overrideCamera.zoom *= (1.0 + 0.25 * mathIntensity); 
  }

  // --- BALANCE SCALE DYNAMIC KINETIC CAMERA (LEFT, RIGHT, MIDDLE) ---
  // Replaces the sluggish, static macro-zoom with a punchy, zoomed-in kinetic camera that
  // dynamically cuts and tracks tightly between the left, right, and middle as the lyrics hit.
  const isScale1 = currentTime >= 41.5 && currentTime <= 56.5;
  const isScale2 = currentTime >= 101.0 && currentTime <= 116.5;

  if (isScale1 || isScale2) {
    const startT = isScale1 ? 41.5 : 101.0;
    const endT = isScale1 ? 56.5 : 116.5;

    // Find the scale center node for this specific block to anchor the camera coordinates
    const chorusScaleCenter = graph.nodes.find(
      (n) => n.startTime > startT && n.startTime < startT + 5 && (n as any)._scaleCenter
    );

    if (chorusScaleCenter) {
      const sc = (chorusScaleCenter as any)._scaleCenter;
      const relT = currentTime - startT;

      let targetX = sc.x;
      let targetY = sc.y;
      let targetZoom = 1.35;
      let targetRot = 0;

      // 1. "ON THE LEFT" ("Whatever you do to the left of the sign")
      // Precisely center directly on the left node at sc.x - 550
      if (relT < 4.3) {
        const p = Math.min(1, Math.max(0, relT / 0.6));
        const ease = p * p * (3 - 2 * p);
        targetX = sc.x - 550;
        targetY = sc.y;
        targetZoom = 1.35;
        targetRot = -0.025 * ease;
      }
      // 2. "ON THE RIGHT" ("Do it to the right and you're doing just fine")
      // Rapid kinetic whip-pan from left node over to right node at sc.x + 550
      else if (relT < 8.2) {
        const whipP = Math.min(1, Math.max(0, (relT - 4.3) / 0.55));
        const whipEase = whipP < 0.5 ? 4 * whipP * whipP * whipP : 1 - Math.pow(-2 * whipP + 2, 3) / 2;
        targetX = (sc.x - 550) * (1 - whipEase) + (sc.x + 550) * whipEase;
        targetY = sc.y;
        targetZoom = 1.35;
        targetRot = -0.025 * (1 - whipEase) + 0.025 * whipEase;
      }
      // 3. "IN THE MIDDLE" ("It's all about balance, keeping the scale, golden rule and you will never fail")
      // Swift kinetic swoop into the center fulcrum with bold, centered, zoomed-in framing
      else {
        const swoopP = Math.min(1, Math.max(0, (relT - 8.2) / 0.7));
        const swoopEase = swoopP < 0.5 ? 4 * swoopP * swoopP * swoopP : 1 - Math.pow(-2 * swoopP + 2, 3) / 2;

        const fromX = sc.x + 550;
        targetX = fromX * (1 - swoopEase) + sc.x * swoopEase;
        targetY = sc.y;
        // Keep it prominently zoomed in!
        targetZoom = 1.35 * (1 - swoopEase) + 1.42 * swoopEase;

        // Dynamic reactive tilt with seesaw oscillation
        const balT = relT - 8.2;
        const damp = Math.min(1, balT / 0.8) * Math.max(0.25, 1 - (relT - 13.5) / 2.0);
        targetRot = Math.sin(balT * Math.PI * 1.5) * 0.04 * damp;
      }

      // Smooth camera transition into and out of this kinetic chorus sequence
      const entryP = Math.min(1, Math.max(0, (currentTime - startT) / 0.6));
      const exitP = Math.min(1, Math.max(0, (endT - currentTime) / 0.8));
      const blendP = Math.min(entryP, exitP);

      overrideCamera.x = overrideCamera.x * (1 - blendP) + targetX * blendP;
      overrideCamera.y = overrideCamera.y * (1 - blendP) + targetY * blendP;
      overrideCamera.zoom = overrideCamera.zoom * (1 - blendP) + targetZoom * blendP;
      overrideCamera.rotation = overrideCamera.rotation * (1 - blendP) + targetRot * blendP;
    }
  }
  // --- END BALANCE SCALE DYNAMIC KINETIC CAMERA ---

  // --- CINEMATIC SMOOTH CAMERA DOLLY TO "UNKNOWN" BEFORE APERTURE PENETRATION ---
  // Gently glides the camera directly onto the letter 'O' in "UNKNOWN" during "solve the",
  // so when letterCounterZoom engages at 61.78s / 120.82s, it is already perfectly centered!
  const isPrepUnknown1 = currentTime >= 60.58 && currentTime < 61.78;
  const isPrepUnknown2 = currentTime >= 119.50 && currentTime < 120.82;
  if (isPrepUnknown1 || isPrepUnknown2) {
    const pStart = isPrepUnknown1 ? 60.58 : 119.50;
    const pEnd = isPrepUnknown1 ? 61.78 : 120.82;
    const prepP = (currentTime - pStart) / (pEnd - pStart);
    const easePrep = prepP * prepP * (3 - 2 * prepP);

    const ukNode = graph.nodes.find(
      (n) => n.text.toLowerCase().includes('unknown') && currentTime >= n.startTime - 5 && currentTime <= n.endTime + 5
    );
    if (ukNode) {
      const ukWord = ukNode.positionedWords.find((w) => w.text.toLowerCase().includes('unknown'));
      if (ukWord) {
        // Target center of word "UNKNOWN" taking node rotation into account
        const cosRot = Math.cos(ukNode.rotation || 0);
        const sinRot = Math.sin(ukNode.rotation || 0);
        const localX = ukWord.relX;
        const localY = ukWord.relY;
        const focalWorldX = ukNode.x + localX * cosRot - localY * sinRot;
        const focalWorldY = ukNode.y + localX * sinRot + localY * cosRot;

        overrideCamera.x = overrideCamera.x * (1 - easePrep) + focalWorldX * easePrep;
        overrideCamera.y = overrideCamera.y * (1 - easePrep) + focalWorldY * easePrep;
        overrideCamera.rotation = overrideCamera.rotation * (1 - easePrep) + (ukNode.rotation || 0) * easePrep;
        overrideCamera.zoom = overrideCamera.zoom * (1 - easePrep) + 1.25 * easePrep;
      }
    }
  }

  // DEVICE-AGNOSTIC RESPONSIVE VIEWPORT SCALING
  // Supports Razer ultrawide/high-res displays, desktop landscape, tablet, and mobile portrait
  const isPortrait = canvasWidth < canvasHeight;
  const targetRefW = isPortrait ? 1080 : 1920;
  const targetRefH = isPortrait ? 1920 : 1080;
  const responsiveScale = Math.min(canvasWidth / targetRefW, canvasHeight / targetRefH);
  if (isScale1 || isScale2) {
    // Preserve prominent, zoomed-in presence across all screen sizes
    overrideCamera.zoom = Math.max(1.15, overrideCamera.zoom * Math.max(0.85, responsiveScale));
  } else {
    overrideCamera.zoom *= responsiveScale;
  }

  // ADAPTIVE VIEWPORT SAFE-BOUNDARY GUARD:
  // Dynamically clamps camera zoom so the active lyric or math node NEVER exceeds
  // 82% of screen width or 80% of screen height on ANY device or aspect ratio.
  const activeFocusNode = graph.nodes.find(
    (n) => currentTime >= n.startTime - 0.25 && currentTime <= n.endTime + 0.35
  );
  if (activeFocusNode && activeFocusNode.width > 0 && activeFocusNode.height > 0) {
    const dRot = activeFocusNode.rotation - overrideCamera.rotation;
    const cosR = Math.abs(Math.cos(dRot));
    const sinR = Math.abs(Math.sin(dRot));
    const effW = activeFocusNode.width * cosR + activeFocusNode.height * sinR;
    const effH = activeFocusNode.width * sinR + activeFocusNode.height * cosR;

    const maxSafeZoom = Math.min(
      (canvasWidth * 0.82) / Math.max(effW, 120),
      (canvasHeight * 0.80) / Math.max(effH, 120)
    );

    if (overrideCamera.zoom > maxSafeZoom) {
      overrideCamera.zoom = maxSafeZoom;
    }
  }

  // Apply Camera Transform
  ctx.save();
  applyCameraTransform(ctx, overrideCamera, canvasWidth, canvasHeight);

  // Render Visible Nodes in continuous landscape with efficient frustum culling
  const viewMarginX = canvasWidth / 2 / Math.max(overrideCamera.zoom, 0.05) + 600;
  const viewMarginY = canvasHeight / 2 / Math.max(overrideCamera.zoom, 0.05) + 600;

  // During the first 13 seconds, only the word "ALGEBRA" is displayed.
  // Suppress all lyric nodes until algebra fades out at ~12.8s - 13.0s.
  if (currentTime >= 12.8) {
    const introLyricFade = Math.min(1.0, (currentTime - 12.8) / 0.4);

    // DYNAMIC MECHANICAL BALANCE SCALE STAGE (Fulcrum Base, Steel Beam, Calibration Ticks & Trays)
    // Provides physical grounding, depth, and kinetic mechanical energy so the scale section never feels flat
    if ((currentTime >= 41.5 && currentTime <= 56.5) || (currentTime >= 101.0 && currentTime <= 116.5)) {
      const isC1 = currentTime < 80;
      const startT = isC1 ? 41.5 : 101.0;
      const endT = isC1 ? 56.5 : 116.5;
      const cCenterNode = graph.nodes.find(
        (n) => n.startTime > startT && n.startTime < startT + 5 && (n as any)._scaleCenter
      );
      if (cCenterNode) {
        const sc = (cCenterNode as any)._scaleCenter;
        const baseT = isC1 ? 42.44 : 101.5;
        const balanceStart = baseT + 7.5;
        const balT = Math.max(0, currentTime - balanceStart);
        const damp = Math.min(1, balT / 0.8) * Math.max(0.25, 1 - (currentTime - (baseT + 13.5)) / 2.0);
        const seesawRot = currentTime > balanceStart ? Math.sin(balT * Math.PI * 1.5) * 0.045 * damp : 0;
        const beamFade = Math.min(1, Math.max(0, (currentTime - startT) / 0.6)) * Math.min(1, Math.max(0, (endT - currentTime) / 0.8));

        ctx.save();
        ctx.globalAlpha = beamFade * 0.80;
        ctx.translate(sc.x, sc.y + 160);

        // 1. Fulcrum Triangular Pedestal Base
        const isLight = theme === 'light_mode';
        ctx.fillStyle = isLight ? '#94a3b8' : '#334155';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-24, 38);
        ctx.lineTo(24, 38);
        ctx.closePath();
        ctx.fill();

        // Fulcrum Base Slab
        ctx.fillStyle = isLight ? '#64748b' : '#1e293b';
        ctx.fillRect(-45, 38, 90, 8);

        // Glowing Pivot Needle & Jewel Bearing
        ctx.fillStyle = colors.mathAccent || '#f59e0b';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();

        // 2. Tilting Precision Balance Beam
        ctx.save();
        ctx.rotate(seesawRot);

        // Main Mechanical Beam
        ctx.fillStyle = isLight ? '#475569' : '#64748b';
        ctx.fillRect(-560, -4, 1120, 8);

        // Scale Calibration Ticks
        ctx.strokeStyle = isLight ? '#cbd5e1' : '#94a3b8';
        ctx.lineWidth = 1.5;
        for (let tx = -520; tx <= 520; tx += 40) {
          if (tx === 0) continue;
          const tickH = tx % 80 === 0 ? 10 : 5;
          ctx.beginPath();
          ctx.moveTo(tx, -4);
          ctx.lineTo(tx, -4 - tickH);
          ctx.stroke();
        }

        // Left and Right Scale Trays
        ctx.strokeStyle = isLight ? '#94a3b8' : '#475569';
        ctx.lineWidth = 2;
        // Left Tray
        ctx.beginPath();
        ctx.moveTo(-520, 0);
        ctx.lineTo(-550, 42);
        ctx.lineTo(-490, 42);
        ctx.closePath();
        ctx.stroke();
        // Right Tray
        ctx.beginPath();
        ctx.moveTo(520, 0);
        ctx.lineTo(490, 42);
        ctx.lineTo(550, 42);
        ctx.closePath();
        ctx.stroke();

        ctx.restore(); // end beam rotate
        ctx.restore(); // end fulcrum
      }
    }

    for (let i = 0; i < graph.nodes.length; i++) {
      const node = graph.nodes[i];
      
      // Completely skip standard rendering for nodes that are fully handled by the StepByStep acts
      const isChorus1 = node.startTime >= 62.0 && node.endTime <= 71.0;
      const isChorus2 = node.startTime >= 122.0 && node.endTime <= 130.0;
      if (isChorus1 || isChorus2) {
        continue;
      }

      // During full math breakdown equation scenes, skip standard large world-space lockups
      // so giant words never collide with or cover the math equations.
      // A clean, elegant single subtitle line is rendered below the equation instead.
      const isMathAct1 = node.type === 'math_scene' || (node.startTime >= 70.0 && node.endTime <= 90.25);
      const isMathAct2 = node.type === 'math_scene' || (node.startTime >= 153.0 && node.endTime <= 175.79);
      if (isMathAct1 || isMathAct2) {
        continue;
      }

      if (Math.abs(node.x - overrideCamera.x) > viewMarginX || Math.abs(node.y - overrideCamera.y) > viewMarginY) {
        continue;
      }

      const isScaleGroup = (node as any)._scaleCenter != null;
      let effectiveEndTime = node.endTime;
      
      if (isScaleGroup) {
        const isMiddle1 = node.text.toLowerCase().includes('balance');
        if (isMiddle1) {
          // Node 10 dissolves cleanly within 0.25s when Node 11 lands (~53.3s / 112.5s)
          effectiveEndTime = node.endTime;
        } else {
          const baseT = node.startTime < 80 ? 42.44 : 101.5;
          effectiveEndTime = Math.max(node.endTime, baseT + 14.0); // Keep alive until end of chorus
        }
      }

      const isPast = currentTime > effectiveEndTime + 0.35;
      const isActive = currentTime >= node.startTime && currentTime <= effectiveEndTime + 0.35;
      const isFuture = currentTime < node.startTime;

      // FAST-PATH TEMPORAL CULL: Skip inactive nodes BEFORE ctx.save() to avoid graphics context thrashing
      const isMiddle1 = isScaleGroup && node.text.toLowerCase().includes('balance');
      if (isPast) {
        if (isMiddle1) {
          if (currentTime - (effectiveEndTime + 0.05) > 0.25) continue;
        } else {
          if (currentTime - (effectiveEndTime + 0.35) > 2.2) continue;
        }
      } else if (isFuture) {
        const dt = node.startTime - currentTime;
        const isOpeningPreview = i === 0 && currentTime < node.startTime;
        if (isOpeningPreview) {
          if (dt > 1.2) continue;
        } else if (dt > 2.5) {
          continue;
        }
      }

      // Clean gradual fade-out for past nodes:
      // When a phrase finishes, it gracefully dissolves and completely disappears after 1.8s,
      // keeping the canvas uncluttered so previous lyrics do not distract the viewer.
      ctx.save();
      if (isPast) {
        if (isMiddle1) {
          const dt = currentTime - (effectiveEndTime + 0.05);
          ctx.globalAlpha = Math.max(0, 1.0 - dt / 0.25);
        } else {
          const nodeTimeSinceEnd = currentTime - (effectiveEndTime + 0.35);
          const nodeFade = Math.pow(Math.max(0, 1.0 - nodeTimeSinceEnd / 2.2), 1.2);
          ctx.globalAlpha = 0.55 * nodeFade;
        }
      } else if (isFuture) {
        const dt = node.startTime - currentTime;
        const isOpeningPreview = i === 0 && currentTime < node.startTime;
        if (isOpeningPreview) {
          const fade = Math.max(0, 1.0 - dt / 1.2);
          if (fade <= 0.01) {
            ctx.restore();
            continue;
          }
          ctx.globalAlpha = fade * 0.85;
        } else {
          const nodeFade = Math.max(0, 1.0 - dt / 2.5);
          ctx.globalAlpha = 0.45 * nodeFade;
        }
      } else {
        ctx.globalAlpha = 1.0;
      }

      // Smooth crossfade in as intro title fades out
      if (introLyricFade < 1.0) {
        ctx.globalAlpha *= introLyricFade;
      }

      if (isScaleGroup) {
        const sc = (node as any)._scaleCenter;
        const baseT = node.startTime < 80 ? 42.44 : 101.5;
        // Start balancing when the word "balance" hits (~7.5s into the chorus)
        const balanceStart = baseT + 7.5; 
        
        if (currentTime > balanceStart) {
          const balT = currentTime - balanceStart;
          // Dampen smoothly across the entire middle chorus
          const damp = Math.min(1, balT / 0.8) * Math.max(0.25, 1 - (currentTime - (baseT + 13.5)) / 2.0);
          const seesawRot = Math.sin(balT * Math.PI * 1.5) * 0.045 * damp;
          
          ctx.translate(sc.x, sc.y);
          ctx.rotate(seesawRot);
          ctx.translate(-sc.x, -sc.y);
        }
      }

      if (node.type === 'math_scene') {
        renderEmbeddedMathNode(ctx, node, currentTime, colors, theme, camera.rotation);
      } else {
        renderTypographicLockup(ctx, node, currentTime, isActive, isPast, isFuture, colors, theme, camera.rotation);
      }
      ctx.restore();
    }
  }

  ctx.restore();

  // The continuous screen-space bouncing ball - aligned with responsive override camera
  renderBouncingBall(ctx, graph, overrideCamera, currentTime, canvasWidth, canvasHeight, colors, theme);

  // Cinematic Vignette
  renderCinematicVignette(ctx, canvasWidth, canvasHeight, colors);

  // Full-screen math breakdowns
  if (currentTime >= 70.4 && currentTime <= 90.25) {
    renderMathScene1(ctx, currentTime, canvasWidth, canvasHeight, colors, theme);
  }
  if (currentTime >= 153.4 && currentTime <= 175.75) {
    renderMathScene2(ctx, currentTime, canvasWidth, canvasHeight, colors, theme);
  }

  // During math breakdown scenes, render vibrant kinetic typography lyrics dancing harmonically
  // around the mathematical equations with sympathetic pulses, particle arcs, and acrobatic rhythm dot
  if ((currentTime >= 70.4 && currentTime <= 90.25) || (currentTime >= 153.4 && currentTime <= 175.75)) {
    renderMathKineticDancingLyrics(ctx, graph, currentTime, canvasWidth, canvasHeight, colors, theme);
  }

  // Cinematic intro title: Stylized Indie Music Video Title Card for "ALGEBRA"
  if (currentTime < 13.5) {
    ctx.save();
    let titleAlpha = 0;
    
    // 1. Cinematic Fade-In: Emerges from darkness between 0.2s and 2.5s
    if (currentTime < 0.2) {
      titleAlpha = 0;
    } else if (currentTime < 2.5) {
      const p = (currentTime - 0.2) / 2.3;
      titleAlpha = p * p * (3 - 2 * p); // smoothstep
    } else if (currentTime <= 11.5) {
      titleAlpha = 1.0;
    } else if (currentTime < 13.2) {
      // 2. Cinematic Dissolve: Fades out smoothly into the drop from 11.5s to 13.2s
      const p = (currentTime - 11.5) / 1.7;
      titleAlpha = Math.max(0, 1.0 - (p * p * (3 - 2 * p)));
    } else {
      titleAlpha = 0;
    }

    if (titleAlpha > 0.001) {
      const cx = canvasWidth / 2;
      const cy = canvasHeight / 2;

      // CONTINUOUS SILKY-SMOOTH CINEMATIC MOTION DYNAMICS (Zero herky-jerky)
      // A. Ultra-smooth continuous slow push-in
      const tProgress = Math.min(1, Math.max(0, currentTime / 12.8));
      const smoothPush = tProgress * tProgress * (3 - 2 * tProgress);
      const dollyZoom = 0.94 + smoothPush * 0.12;

      // B. Smooth continuous harmonic breathing pulse (zero discontinuities or sawtooth kicks)
      const breathe = Math.sin(currentTime * 1.8) * 0.005;
      const totalScale = dollyZoom + breathe;

      // C. Organic gentle 35mm film head sway (smooth, subtle, low frequency)
      const driftX = Math.sin(currentTime * 0.40) * 2.2;
      const driftY = Math.cos(currentTime * 0.32) * 1.6;
      const driftRot = Math.sin(currentTime * 0.22) * 0.003; // ~0.17 deg subtle film drift

      ctx.translate(cx + driftX, cy + driftY);
      ctx.rotate(driftRot);
      ctx.scale(totalScale, totalScale);

      ctx.globalAlpha = titleAlpha;

      // RESPONSIVE SCREEN-SAFE FONT SIZING (Portrait & Landscape)
      // Strictly bounded so ALGEBRA and its framing lines never bleed off screen edges
      const maxAvailableW = canvasWidth * 0.78;
      const maxAvailableH = canvasHeight * 0.30;
      // An 7-char word with letter-spacing spans ~5.8 * fontSize
      const idealFontSize = Math.min(maxAvailableW / 5.8, maxAvailableH / 1.5, 115);
      const fontSize = Math.max(32, Math.round(idealFontSize));

      // D. Dynamic Letter Tracking Breathing (expanding smoothly with subpixel precision)
      const trackingProgress = Math.min(1, Math.max(0, (currentTime - 0.4) / 11.5));
      const smoothTracking = trackingProgress * trackingProgress * (3 - 2 * trackingProgress);
      const letterSpacing = fontSize * (0.11 + smoothTracking * 0.07);

      ctx.font = `900 ${fontSize}px "Montserrat", "Bebas Neue", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const titleWord = 'ALGEBRA';

      // Cache character widths for ALGEBRA based on fontSize to avoid per-frame measurement
      const titleCacheKey = `_algebra_widths_${fontSize}`;
      let cachedCharWidths = (renderCinematicTypographyView as any)[titleCacheKey];
      if (!cachedCharWidths) {
        cachedCharWidths = [];
        for (let c = 0; c < titleWord.length; c++) {
          cachedCharWidths.push(ctx.measureText(titleWord[c]).width);
        }
        (renderCinematicTypographyView as any)[titleCacheKey] = cachedCharWidths;
      }
      const charWidths: number[] = cachedCharWidths;
      let totalWidth = 0;
      for (let c = 0; c < titleWord.length; c++) {
        totalWidth += charWidths[c] + (c < titleWord.length - 1 ? letterSpacing : 0);
      }

      // Safeguard: If measured total width exceeds available width, scale down safely
      let renderScale = 1.0;
      if (totalWidth * totalScale > maxAvailableW && totalWidth > 0) {
        renderScale = maxAvailableW / (totalWidth * totalScale);
        ctx.scale(renderScale, renderScale);
      }

      // STYLIZED INDIE JELLY ROLL MUSIC VIDEO AESTHETIC
      const isPaper = theme === 'light_mode';

      // 1. Ambient Warm Cinematic Back-Glow / Smoke Depth
      const glowRadius = Math.max(totalWidth * 0.65, fontSize * 1.6);
      const glowGrad = ctx.createRadialGradient(0, 0, glowRadius * 0.1, 0, 0, glowRadius);
      if (isPaper) {
        glowGrad.addColorStop(0, 'rgba(180, 83, 9, 0.16)');
        glowGrad.addColorStop(0.6, 'rgba(180, 83, 9, 0.04)');
        glowGrad.addColorStop(1, 'rgba(180, 83, 9, 0)');
      } else {
        glowGrad.addColorStop(0, 'rgba(245, 158, 11, 0.24)');
        glowGrad.addColorStop(0.5, 'rgba(217, 119, 6, 0.08)');
        glowGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
      }
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      // 2. Weathered Film Accent Framing Lines (expand outward dynamically, strictly screen-safe)
      const lineProgress = Math.min(1, Math.max(0, (currentTime - 0.6) / 2.0));
      const smoothLineProgress = lineProgress * lineProgress * (3 - 2 * lineProgress);
      const targetLineWidth = Math.min(totalWidth + fontSize * 0.45, maxAvailableW);
      const lineWidth = targetLineWidth * smoothLineProgress;
      const lineYOffset = fontSize * 0.64;
      const frameCol = isPaper ? 'rgba(60, 50, 40, 0.35)' : 'rgba(245, 240, 227, 0.36)';
      const accentTickCol = isPaper ? '#b45309' : '#f59e0b';

      if (lineWidth > 4) {
        ctx.strokeStyle = frameCol;
        ctx.lineWidth = Math.max(1.5, fontSize * 0.016);

        // Top framing rule
        ctx.beginPath();
        ctx.moveTo(-lineWidth / 2, -lineYOffset);
        ctx.lineTo(lineWidth / 2, -lineYOffset);
        ctx.stroke();

        // Bottom framing rule
        ctx.beginPath();
        ctx.moveTo(-lineWidth / 2, lineYOffset);
        ctx.lineTo(lineWidth / 2, lineYOffset);
        ctx.stroke();

        // Center diamond ticks
        ctx.fillStyle = accentTickCol;
        const tickSize = Math.max(3, fontSize * 0.035);
        ctx.beginPath();
        ctx.moveTo(0, -lineYOffset - tickSize);
        ctx.lineTo(tickSize, -lineYOffset);
        ctx.lineTo(0, -lineYOffset + tickSize);
        ctx.lineTo(-tickSize, -lineYOffset);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(0, lineYOffset - tickSize);
        ctx.lineTo(tickSize, lineYOffset);
        ctx.lineTo(0, lineYOffset + tickSize);
        ctx.lineTo(-tickSize, lineYOffset);
        ctx.closePath();
        ctx.fill();
      }

      // 3. Cinematic Subtitle below framing rule
      if (currentTime > 1.2) {
        const subAlpha = Math.min(1, (currentTime - 1.2) / 1.6) * titleAlpha;
        ctx.save();
        ctx.globalAlpha = subAlpha;
        const subSize = Math.max(9, Math.round(fontSize * 0.12));
        ctx.font = `700 ${subSize}px "Montserrat", sans-serif`;
        ctx.fillStyle = isPaper ? '#78716c' : '#d4d4d8';
        ctx.fillText('ORIGINAL MOTION TYPOGRAPHY', 0, lineYOffset + subSize * 1.85);
        ctx.restore();
      }

      // 4. Heavy Layered Indie Letterform Rendering
      let startX = -totalWidth / 2;
      for (let c = 0; c < titleWord.length; c++) {
        const charX = startX + charWidths[c] / 2;

        // Deep analog drop shadow
        ctx.fillStyle = isPaper ? 'rgba(40, 30, 20, 0.22)' : 'rgba(0, 0, 0, 0.8)';
        ctx.fillText(titleWord[c], charX + 2.5, 3.5);

        // Warm ambient rim glow
        ctx.fillStyle = isPaper ? 'rgba(180, 83, 9, 0.28)' : 'rgba(245, 158, 11, 0.24)';
        ctx.fillText(titleWord[c], charX - 1, -1);

        // Crisp monumental letterform
        ctx.fillStyle = isPaper ? '#1c1917' : '#fafaf9';
        ctx.fillText(titleWord[c], charX, 0);

        startX += charWidths[c] + letterSpacing;
      }
    }
    ctx.restore();
  }

  // Draw the fading StepByStep overlay on top of everything if it's currently fading out
  if (sbsFadeAlpha > 0.0) {
    ctx.save();
    ctx.globalAlpha = sbsFadeAlpha;
    renderStepByStepAct(ctx, canvasWidth, canvasHeight, currentTime, sbsIsSecond, theme, colors);
    renderCinematicVignette(ctx, canvasWidth, canvasHeight, colors);
    ctx.restore();
  }
}

/**
 * Renders deeply engaging, kinetic typography lyrics that dance harmonically around
 * the mathematical equations during Act 1 (70.4s -> 90.25s) and Act 2 (153.4s -> 175.75s).
 *
 * Implements:
 * 1. Zero-Pill Staging: Eliminates static box enclosures, freeing words into open kinetic space.
 * 2. Harmonic Choreography: Words float, sway, and dance along a musical groove framing the equation.
 * 3. Active Word Kinetic Pop: Leaps upward with elastic squash-and-stretch, cadence tilt, and radiant amber glow.
 * 4. Sympathetic Math Dialogue:
 *    - When lyrics sing "X" or "2X", a luminous particle arc connects the dancing lyric to the equation's X!
 *    - When lyrics sing "both sides", symmetrical balance waves pulse across the '=' sign.
 *    - Celebratory sparks flare when reaching solutions ("6", "10", "curse!", "reverse").
 * 5. Acrobatic Bouncing Dot: The rhythm dot performs parabolic leaps, squashing on impact with trailing ghost sparks.
 * 6. Staggered Fluid Transitions: Words bounce into the phrase with a cascade delay and dissolve smoothly on exit.
 */
function renderMathKineticDancingLyrics(
  ctx: CanvasRenderingContext2D,
  graph: LayoutGraph,
  currentTime: number,
  canvasWidth: number,
  canvasHeight: number,
  colors: ThemeColors,
  theme: ColorTheme = 'light_mode'
): void {
  // Find current active lyric node during the math scene
  const activeNode = graph.nodes.find(
    (n) => n.type === 'lyric' && n.positionedWords && n.positionedWords.length > 0 &&
           currentTime >= n.startTime - 0.28 && currentTime <= n.endTime + 0.65
  );

  if (!activeNode || !activeNode.positionedWords || activeNode.positionedWords.length === 0) {
    return;
  }

  // Smooth phrase entrance and graceful exit dissipation
  let phraseAlpha = 1.0;
  const entryDur = 0.28;
  const exitDur = 0.55;
  if (currentTime < activeNode.startTime) {
    phraseAlpha = Math.max(0, (currentTime - (activeNode.startTime - entryDur)) / entryDur);
  } else if (currentTime > activeNode.endTime) {
    phraseAlpha = Math.max(0, 1.0 - (currentTime - activeNode.endTime) / exitDur);
  }
  if (phraseAlpha <= 0.01) return;

  const isAct1 = currentTime >= 70.4 && currentTime <= 90.25;
  const mathInfo = isAct1
    ? getMathScene1Layout(canvasWidth, canvasHeight)
    : getMathScene2Layout(canvasWidth, canvasHeight);

  ctx.save();
  ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
  ctx.globalAlpha = phraseAlpha;

  const isPaper = theme === 'light_mode';

  // Clean, high-impact typography matching the rest of the song
  let fontSize = Math.max(22, Math.min(36, Math.round(canvasWidth * 0.026)));
  ctx.font = `800 ${fontSize}px "Montserrat", -apple-system, sans-serif`;

  let spaceWidth = Math.max(12, Math.round(fontSize * 0.38));
  
  // High-performance word width cache per node to avoid per-frame measureText calls
  const cacheKey = `_mathWordWidths_${fontSize}`;
  let wordWidths: number[] = (activeNode as any)[cacheKey];
  if (!wordWidths || wordWidths.length !== activeNode.positionedWords.length) {
    wordWidths = activeNode.positionedWords.map((w) => ctx.measureText(w.text).width);
    (activeNode as any)[cacheKey] = wordWidths;
  }

  let totalWordsWidth = 0;
  for (let i = 0; i < wordWidths.length; i++) {
    totalWordsWidth += wordWidths[i] + (i < wordWidths.length - 1 ? spaceWidth : 0);
  }

  // Ensure single lyric line fits comfortably across 90% width
  const maxStageW = canvasWidth * 0.90;
  if (totalWordsWidth > maxStageW && totalWordsWidth > 0) {
    const scaleFactor = maxStageW / totalWordsWidth;
    fontSize = Math.max(16, Math.floor(fontSize * scaleFactor));
    ctx.font = `800 ${fontSize}px "Montserrat", -apple-system, sans-serif`;
    spaceWidth = Math.max(8, Math.round(fontSize * 0.38));

    const scaledCacheKey = `_mathWordWidths_${fontSize}`;
    let scaledWidths: number[] = (activeNode as any)[scaledCacheKey];
    if (!scaledWidths || scaledWidths.length !== activeNode.positionedWords.length) {
      scaledWidths = activeNode.positionedWords.map((w) => ctx.measureText(w.text).width);
      (activeNode as any)[scaledCacheKey] = scaledWidths;
    }
    wordWidths = scaledWidths;
    totalWordsWidth = 0;
    for (let i = 0; i < wordWidths.length; i++) {
      totalWordsWidth += wordWidths[i] + (i < wordWidths.length - 1 ? spaceWidth : 0);
    }
  }

  // Dynamic staging space framing the math equation cleanly on a single baseline
  const stageCenterX = mathInfo.CX;
  const mathBottomY = mathInfo.CY + 65 * mathInfo.mathScale;
  const availHeight = canvasHeight - mathBottomY - 45;
  const stageCenterY = mathBottomY + Math.max(38, availHeight * 0.44);

  const words = activeNode.positionedWords;
  const numWords = words.length;
  const startX = stageCenterX - totalWordsWidth / 2;

  // Precompute base X positions on a single architectural line
  const wordBaseXs: number[] = [];
  let runningX = startX;
  for (let i = 0; i < numWords; i++) {
    const wMidX = runningX + wordWidths[i] / 2;
    wordBaseXs.push(wMidX);
    runningX += wordWidths[i] + spaceWidth;
  }

  // Check active word index
  let activeIdx = -1;
  for (let i = 0; i < numWords; i++) {
    if (currentTime >= words[i].start && currentTime <= words[i].end) {
      activeIdx = i;
      break;
    }
  }

  // --------------------------------------------------------------------------
  // SYMPATHETIC MATH DIALOGUE EFFECTS (Particle Arcs, Pulses, Sparks)
  // --------------------------------------------------------------------------
  if (activeIdx >= 0) {
    const activeWord = words[activeIdx];
    const cleanWord = activeWord.text.replace(/[^a-zA-Z0-9]/g, '');
    const isVarWord = cleanWord === 'X' || cleanWord === '2X';
    const isBothSides = cleanWord.toLowerCase() === 'both' || cleanWord.toLowerCase() === 'sides';
    const isSpecialAction = ['curse', 'reverse', '6', '10', '15', '20', 'divide', 'subtract'].includes(cleanWord.toLowerCase());

    // 1. Dynamic Energy Beacon connecting lyric "X" to equation "X"
    if (isVarWord) {
      const tokenPos = mathInfo.orchestrator.getTokenPosition('X', currentTime) ||
                       mathInfo.orchestrator.getTokenPosition('2X', currentTime);
      if (tokenPos) {
        const eqTargetX = mathInfo.CX + tokenPos.x * mathInfo.mathScale;
        const eqTargetY = mathInfo.CY + tokenPos.y * mathInfo.mathScale;
        const wordX = wordBaseXs[activeIdx];
        const wordY = stageCenterY - 18;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(wordX, wordY);
        const cpX = (wordX + eqTargetX) / 2 + Math.sin(currentTime * 7) * 16;
        const cpY = (wordY + eqTargetY) / 2 - 28;
        ctx.quadraticCurveTo(cpX, cpY, eqTargetX, eqTargetY + 24);
        ctx.strokeStyle = isPaper ? 'rgba(234, 88, 12, 0.45)' : 'rgba(251, 191, 36, 0.60)';
        ctx.lineWidth = 2.4;
        ctx.setLineDash([6, 6]);
        ctx.lineDashOffset = -currentTime * 45;
        ctx.stroke();
        ctx.setLineDash([]);

        // Flowing energy particle along trajectory
        const sparkPhase = (currentTime * 2.8) % 1;
        const spX = (1 - sparkPhase) * (1 - sparkPhase) * wordX + 2 * (1 - sparkPhase) * sparkPhase * cpX + sparkPhase * sparkPhase * eqTargetX;
        const spY = (1 - sparkPhase) * (1 - sparkPhase) * wordY + 2 * (1 - sparkPhase) * sparkPhase * cpY + sparkPhase * sparkPhase * (eqTargetY + 24);
        ctx.beginPath();
        ctx.arc(spX, spY, 5, 0, Math.PI * 2);
        ctx.fillStyle = isPaper ? '#f97316' : '#fde047';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.restore();
      }
    }

    // 2. Symmetrical Balance Waves for "both sides"
    if (isBothSides) {
      const eqToken = mathInfo.orchestrator.getTokenPosition('=', currentTime);
      const eqCenterEqX = mathInfo.CX + (eqToken ? eqToken.x : 0) * mathInfo.mathScale;
      const eqCenterEqY = mathInfo.CY;
      const pulseT = (currentTime * 2.5) % 1;
      const spread = pulseT * 180 * mathInfo.mathScale;
      const pulseAlpha = (1 - pulseT) * 0.5;

      ctx.save();
      ctx.strokeStyle = isPaper ? `rgba(234, 88, 12, ${pulseAlpha})` : `rgba(251, 191, 36, ${pulseAlpha})`;
      ctx.lineWidth = 2.5;
      // Left pulse bracket
      ctx.beginPath();
      ctx.moveTo(eqCenterEqX - spread - 12, eqCenterEqY - 28);
      ctx.lineTo(eqCenterEqX - spread, eqCenterEqY);
      ctx.lineTo(eqCenterEqX - spread - 12, eqCenterEqY + 28);
      ctx.stroke();
      // Right pulse bracket
      ctx.beginPath();
      ctx.moveTo(eqCenterEqX + spread + 12, eqCenterEqY - 28);
      ctx.lineTo(eqCenterEqX + spread, eqCenterEqY);
      ctx.lineTo(eqCenterEqX + spread + 12, eqCenterEqY + 28);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Celebratory Sparkles for solutions and actions
    if (isSpecialAction) {
      ctx.save();
      const sparkCount = 8;
      for (let s = 0; s < sparkCount; s++) {
        const angle = (s / sparkCount) * Math.PI * 2 + currentTime * 3.5;
        const dist = 28 + Math.sin(currentTime * 8 + s) * 12;
        const sx = wordBaseXs[activeIdx] + Math.cos(angle) * dist;
        const sy = stageCenterY + Math.sin(angle) * dist * 0.7 - 8;
        ctx.beginPath();
        ctx.arc(sx, sy, 2.8, 0, Math.PI * 2);
        ctx.fillStyle = s % 2 === 0 ? (isPaper ? '#ea580c' : '#fbbf24') : (isPaper ? '#0284c7' : '#38bdf8');
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 8;
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // --------------------------------------------------------------------------
  // EDITORIAL SINGLE-LINE TYPOGRAPHY RENDERING (Matching Rest of Song)
  // --------------------------------------------------------------------------
  for (let i = 0; i < numWords; i++) {
    const w = words[i];
    const isCur = currentTime >= w.start && currentTime <= w.end;
    const isPastWord = currentTime > w.end;
    const wx = wordBaseXs[i];
    const wy = stageCenterY;

    const cleanW = w.text.replace(/[^a-zA-Z0-9]/g, '');
    const isNumberOrVar = ['X', '2X', '4', '10', '2', '5', '15', '20', '6'].includes(cleanW) || (!isNaN(Number(cleanW)) && cleanW.length > 0);

    if (isCur) {
      const wordDur = Math.max(0.01, w.end - w.start);
      const wordP = Math.max(0, Math.min(1, (currentTime - w.start) / wordDur));
      const jump = Math.sin(wordP * Math.PI);
      const hopY = -7 * jump;
      const popScale = 1.0 + 0.08 * jump;

      if (isNumberOrVar) {
        // High-impact tactile punch stamp block (matching renderTypographicLockup)
        const boxW = (wordWidths[i] || 50) + 20;
        const boxH = fontSize + 14;

        ctx.save();
        ctx.translate(wx, wy + hopY);
        ctx.scale(popScale, popScale);

        // Solid punch background block
        ctx.fillStyle = colors.activeWordBg || (isPaper ? '#0f172a' : '#f8fafc');
        ctx.fillRect(-boxW / 2, -boxH / 2, boxW, boxH);

        // Tactile double-line stamp border
        ctx.strokeStyle = colors.background;
        ctx.lineWidth = 2;
        ctx.strokeRect(-boxW / 2 + 3, -boxH / 2 + 3, boxW - 6, boxH - 6);

        ctx.fillStyle = colors.background;
        ctx.font = `900 ${fontSize}px "Montserrat", -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(w.text, 0, 1);
        ctx.restore();
      } else {
        // Active word energetic highlight with signature amber / blue pop
        ctx.save();
        ctx.translate(wx, wy + hopY);
        ctx.scale(popScale, popScale);
        ctx.font = `900 ${fontSize}px "Montserrat", -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = isPaper ? '#ea580c' : '#fbbf24';
        ctx.shadowColor = isPaper ? 'rgba(234, 88, 12, 0.45)' : 'rgba(251, 191, 36, 0.60)';
        ctx.shadowBlur = 12;
        ctx.fillText(w.text, 0, 0);
        ctx.restore();
      }
    } else if (isPastWord) {
      // Solid crisp spoken word
      ctx.save();
      ctx.translate(wx, wy);
      ctx.font = `800 ${fontSize}px "Montserrat", -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = colors.spokenWordText;
      ctx.shadowBlur = 0;
      ctx.fillText(w.text, 0, 0);
      ctx.restore();
    } else {
      // Clean, muted unspoken word
      ctx.save();
      ctx.translate(wx, wy);
      ctx.font = `700 ${fontSize}px "Montserrat", -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = colors.unspokenWordText;
      ctx.shadowBlur = 0;
      ctx.fillText(w.text, 0, 0);
      ctx.restore();
    }
  }

  // --------------------------------------------------------------------------
  // CLASSIC GRAPHIC BLACK BOUNCING BALL (Hopping Directly Across the Spoken Words)
  // --------------------------------------------------------------------------
  if (numWords > 0) {
    const firstWord = words[0];
    const lastWord = words[numWords - 1];
    let dotX = wordBaseXs[0];
    let dotY = stageCenterY - fontSize * 0.72;
    let jumpP = 0;
    let ballAlpha = 1.0;

    if (currentTime < firstWord.start) {
      // Parabolic drop-in onto first word
      const dropP = Math.max(0, Math.min(1, (currentTime - (activeNode.startTime - entryDur)) / entryDur));
      const dropOffset = (1 - dropP) * (1 - dropP) * 55;
      dotX = wordBaseXs[0];
      dotY = stageCenterY - fontSize * 0.72 - dropOffset;
      jumpP = (1 - dropP);
      ballAlpha = dropP;
    } else if (currentTime > lastWord.end) {
      // Sits on last word and fades smoothly with phrase
      dotX = wordBaseXs[numWords - 1];
      dotY = stageCenterY - fontSize * 0.72;
      jumpP = 0;
      ballAlpha = phraseAlpha;
    } else {
      // Find current interval
      let idx = 0;
      for (let i = 0; i < numWords; i++) {
        if (words[i].start <= currentTime) {
          idx = i;
        }
      }
      const curW = words[idx];
      const nextW = idx < numWords - 1 ? words[idx + 1] : null;
      const curX = wordBaseXs[idx];
      const nextX = nextW ? wordBaseXs[idx + 1] : curX + 28;

      if (currentTime <= curW.end) {
        // Active word bounce
        const wordDur = Math.max(0.01, curW.end - curW.start);
        const p = Math.max(0, Math.min(1, (currentTime - curW.start) / wordDur));
        jumpP = Math.sin(p * Math.PI);
        const hopH = 22;
        dotX = curX + (nextX - curX) * Math.pow(p, 1.8);
        dotY = stageCenterY - fontSize * 0.72 - jumpP * hopH;
      } else if (nextW) {
        // In-between words transfer
        const gapDur = Math.max(0.01, nextW.start - curW.end);
        const p = Math.max(0, Math.min(1, (currentTime - curW.end) / gapDur));
        jumpP = Math.sin(p * Math.PI);
        const hopH = 14;
        dotX = curX + (nextX - curX) * p;
        dotY = stageCenterY - fontSize * 0.72 - jumpP * hopH;
      } else {
        dotX = curX;
        dotY = stageCenterY - fontSize * 0.72;
        jumpP = 0;
      }
    }

    if (ballAlpha > 0.01) {
      const dotRadius = Math.max(4.5, Math.min(6.2, fontSize * 0.17));
      const squashX = 1.0 + (1 - jumpP) * 0.28 - jumpP * 0.12;
      const squashY = 1.0 - (1 - jumpP) * 0.28 + jumpP * 0.20;

      // 1. Soft contact shadow on the text baseline
      ctx.save();
      ctx.beginPath();
      const shadowW = Math.max(2.5, dotRadius * 1.35 * (1 - jumpP * 0.45));
      ctx.ellipse(dotX, stageCenterY - fontSize * 0.44, shadowW, 2.2, 0, 0, Math.PI * 2);
      ctx.fillStyle = isPaper ? 'rgba(15, 23, 42, 0.28)' : 'rgba(0, 0, 0, 0.55)';
      ctx.globalAlpha = ballAlpha * phraseAlpha;
      ctx.fill();
      ctx.restore();

      // 2. The Classic Graphic Jet Black Bouncing Ball
      ctx.save();
      ctx.translate(dotX, dotY);
      ctx.scale(squashX, squashY);
      ctx.globalAlpha = ballAlpha * phraseAlpha;

      // Outer ambient rim / contrast halo in dark mode
      if (!isPaper) {
        ctx.beginPath();
        ctx.arc(0, 0, dotRadius + 1.2, 0, Math.PI * 2);
        ctx.fillStyle = '#f8fafc';
        ctx.fill();
      }

      // Solid jet black ball core
      ctx.beginPath();
      ctx.arc(0, 0, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#0a0a0a';
      ctx.fill();

      // Polished 3D specular highlight sphere gradient
      const sphereGrad = ctx.createRadialGradient(
        -dotRadius * 0.32, -dotRadius * 0.32, dotRadius * 0.08,
        0, 0, dotRadius
      );
      sphereGrad.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
      sphereGrad.addColorStop(0.35, 'rgba(50, 50, 50, 0.2)');
      sphereGrad.addColorStop(1, 'rgba(10, 10, 10, 0.95)');
      ctx.beginPath();
      ctx.arc(0, 0, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = sphereGrad;
      ctx.fill();

      // Crisp specular glint
      ctx.beginPath();
      ctx.arc(-dotRadius * 0.32, -dotRadius * 0.32, dotRadius * 0.24, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      ctx.restore();
    }
  }

  ctx.restore();
}

/**
 * Renders Matthew Rogers / Saul Bass style typographic lockup with rich kinetic impacts.
 */
function renderTypographicLockup(
  ctx: CanvasRenderingContext2D,
  node: SceneNode,
  currentTime: number,
  isActive: boolean,
  isPast: boolean,
  isFuture: boolean,
  colors: ThemeColors,
  theme: ColorTheme = 'light_mode',
  cameraRotation = 0
): void {
  ctx.save();
  ctx.translate(node.x, node.y);
  ctx.rotate(node.rotation);

  const positionedWords = node.positionedWords || [];
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Identify the latest word that has started in this phrase
  let activeWordIndex = -1;
  for (let i = 0; i < positionedWords.length; i++) {
    if (currentTime >= positionedWords[i].start) {
      activeWordIndex = i;
    }
  }

  for (let wIdx = 0; wIdx < positionedWords.length; wIdx++) {
    const lw = positionedWords[wIdx];
    const hasStarted = currentTime >= lw.start;
    const isWordActive = currentTime >= lw.start && currentTime <= lw.end + 0.08;
    const isWordPast = currentTime > lw.end + 0.08;

    // SNAKE FX: The lyrics wiggle horizontally along the track like a train
    let snakeOffsetX = 0;
    let snakeOffsetY = 0;
    if ((node as any).fx === 'snake') {
      const snakeT = currentTime * 4.0 - wIdx * 0.5;
      snakeOffsetY = Math.sin(snakeT) * 12;
      snakeOffsetX = Math.cos(snakeT * 0.7) * 4;
    }

    ctx.save();
    ctx.translate(lw.relX + snakeOffsetX, lw.relY + snakeOffsetY);

    if (!hasStarted) {
      // Future words sit stably on the canvas, rendered in subtle unspoken tone
      ctx.fillStyle = colors.unspokenWordText;
      ctx.font = lw.fontString;
      ctx.fillText(lw.text, 0, 0);
      ctx.restore();
      continue;
    }

    // 1. Hero Effect for the word "VARIABLE" (something that varies)
    if (isVariableWord(lw.text)) {
      let varAlpha = 1.0;
      if (isWordPast) {
        const timeSinceEnd = currentTime - lw.end;
        const wordsAhead = activeWordIndex >= 0 ? Math.max(0, activeWordIndex - wIdx) : 0;
        const fadeDur = wordsAhead >= 2 ? 1.0 : 1.8;
        varAlpha = Math.pow(Math.max(0, 1.0 - timeSinceEnd / fadeDur), 1.4);
      }
      if (varAlpha > 0.01) {
        ctx.save();
        ctx.globalAlpha *= varAlpha;
        renderVariableHeroWord(
          ctx,
          lw.text,
          0,
          0,
          lw.fontSize || 64,
          currentTime,
          lw.start,
          lw.end,
          isWordActive,
          isWordPast,
          theme,
          colors,
          node.rotation,
          cameraRotation,
          lw.width || 240
        );
        ctx.restore();
      }
      ctx.restore();
      continue;
    }

    // 2. Algebraic Variables 'X' and 'Y' - ALWAYS UPRIGHT, ORANGE OR GREEN
    if (isVarX(lw.text) || isVarY(lw.text)) {
      let varAlpha = 1.0;
      if (isWordPast) {
        const timeSinceEnd = currentTime - lw.end;
        const wordsAhead = activeWordIndex >= 0 ? Math.max(0, activeWordIndex - wIdx) : 0;
        const fadeDur = wordsAhead >= 2 ? 1.0 : 1.8;
        varAlpha = Math.pow(Math.max(0, 1.0 - timeSinceEnd / fadeDur), 1.4);
      }
      if (varAlpha > 0.01) {
        ctx.save();
        ctx.globalAlpha *= varAlpha;
        renderUprightVariableWord(
          ctx,
          lw.text,
          0,
          0,
          lw.fontSize || 72,
          lw.fontFamily || '"Montserrat", sans-serif',
          currentTime,
          lw.start,
          lw.end,
          isWordActive,
          isWordPast,
          theme,
          colors,
          node.rotation,
          cameraRotation
        );
        ctx.restore();
      }
      ctx.restore();
      continue;
    }

    const timeSinceStart = currentTime - lw.start;

    let customTilt = 0;
    let customShiftX = 0;
    let customScale = 1.0;
    
    if (timeSinceStart > 0) {
      const cleanWord = lw.text.toLowerCase().replace(/[^a-z]/g, '');
      const activeAmp = isWordActive ? 1.0 : Math.max(0, 1.0 - (currentTime - lw.end) * 1.5);
      
      if (cleanWord === 'balance') {
        customTilt = Math.sin(timeSinceStart * 5.5) * 0.22 * activeAmp; // Sway like a scale
      } else if (cleanWord === 'left') {
        const pop = Math.min(timeSinceStart, 0.2) / 0.2;
        const easePop = 1 - Math.pow(1 - pop, 3);
        customShiftX = -90 * easePop * activeAmp; // Shove to left
      } else if (cleanWord === 'right') {
        const pop = Math.min(timeSinceStart, 0.2) / 0.2;
        const easePop = 1 - Math.pow(1 - pop, 3);
        customShiftX = 90 * easePop * activeAmp; // Shove to right
      } else if (cleanWord === 'sign') {
        customScale = 1.0 + 0.12 * Math.sin(timeSinceStart * 14) * activeAmp; // Alert pulsing
      }
    }

    if (isWordActive) {
      // Syllable calculations
      const wordDur = Math.max(0.01, lw.end - lw.start);
      const numSyllables = countSyllables(lw.text);
      const syllableDur = wordDur / numSyllables;
      const progress = Math.max(0, Math.min(1, timeSinceStart / wordDur));
      const currentSyllableIdx = Math.min(numSyllables - 1, Math.floor(progress * numSyllables));
      const timeInSyllable = timeSinceStart - currentSyllableIdx * syllableDur;

      // 1. Kinetic Pop & Spring Overshoot on Word Entry
      let entryScale = 1.0;
      let entryBounceY = 0;
      let entryTilt = 0;
      let ghostAlpha = 0;

      if (timeSinceStart < 0.28) {
        const p = timeSinceStart / 0.28;
        // Snappy spring overshoot: shoots to ~1.22x then settles cleanly
        entryScale = 1.0 + 0.22 * Math.sin(p * Math.PI) * Math.pow(1 - p, 1.1);
        entryBounceY = -4.5 * Math.sin(p * Math.PI) * (1 - p);
        const dir = (Math.sin(lw.start * 17.3 + wIdx * 2.1) > 0 ? 1 : -1);
        entryTilt = dir * 0.04 * Math.pow(1 - p, 2);
        ghostAlpha = timeSinceStart < 0.14 ? (1.0 - timeSinceStart / 0.14) * 0.35 : 0;
      }

      // 2. Syllable-Level Micro-Pulse (tactile pop on each syllable onset)
      let syllableScale = 1.0;
      let syllableShakeX = 0;
      if (timeInSyllable >= 0 && timeInSyllable < 0.14) {
        const sylP = timeInSyllable / 0.14;
        syllableScale = 1.0 + 0.09 * Math.sin(sylP * Math.PI);
        syllableShakeX = Math.sin(sylP * 40) * (1 - sylP) * 1.2;
      }

      // 3. Active Word Living Energy + Custom Overrides
      const breathScale = 1.0 + 0.02 * Math.sin(timeSinceStart * 9.0);
      const netScale = entryScale * syllableScale * breathScale * customScale;
      entryTilt += customTilt;

      if (lw.isEmphasis && colors.activeWordBg) {
        // High-impact rubber stamp punch block (tactile slam with double border)
        const boxW = (lw.width || 80) + 32;
        const boxH = lw.fontSize + 16;
        const impact = calculateKineticImpact(timeSinceStart, Math.max(0.1, lw.end - lw.start), true);

        ctx.save();
        ctx.translate(impact.shakeX + syllableShakeX + customShiftX, impact.shakeY + entryBounceY);
        ctx.rotate(entryTilt);
        ctx.scale(impact.scale * netScale, impact.scale * netScale);

        // Prototype 2: Chromatic/Industrial Ghost Underlayer during peak hit
        if (impact.ghostAlpha > 0 || ghostAlpha > 0) {
          ctx.save();
          ctx.globalAlpha = Math.max(impact.ghostAlpha, ghostAlpha);
          ctx.fillStyle = colors.mathAccent || '#ef4444';
          ctx.fillRect(-boxW / 2 + 5, -boxH / 2 + 5, boxW, boxH);
          ctx.restore();
        }

        const cleanWordLower = lw.text.toLowerCase().replace(/[^a-z0-9]/g, '');

        if (cleanWordLower === 'golden') {
          // Special Hero treatment for "GOLDEN": Burnished metallic gold gradient & live specular shimmer
          const goldGrad = ctx.createLinearGradient(-boxW / 2, -boxH / 2, boxW / 2, boxH / 2);
          goldGrad.addColorStop(0, '#f59e0b');
          goldGrad.addColorStop(0.5, '#fbbf24');
          goldGrad.addColorStop(1, '#d97706');
          ctx.fillStyle = goldGrad;
          ctx.fillRect(-boxW / 2, -boxH / 2, boxW, boxH);

          // Specular highlight sweep across "GOLDEN"
          const sweep = ((currentTime * 1.8) % 2.0) - 0.5;
          const shimmerGrad = ctx.createLinearGradient(
            -boxW / 2 + boxW * (sweep - 0.2), 0,
            -boxW / 2 + boxW * (sweep + 0.2), 0
          );
          shimmerGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
          shimmerGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.45)');
          shimmerGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = shimmerGrad;
          ctx.fillRect(-boxW / 2, -boxH / 2, boxW, boxH);

          // Warm ambient gold glow border
          ctx.strokeStyle = '#fef08a';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(-boxW / 2 + 2, -boxH / 2 + 2, boxW - 4, boxH - 4);

          ctx.fillStyle = '#0f172a'; // Crisp contrast text on gold
          ctx.font = lw.fontEmphasisString || lw.fontString;
          ctx.fillText(lw.text, 0, 1);
        } else {
          // Solid punch background block
          ctx.fillStyle = colors.activeWordBg;
          ctx.fillRect(-boxW / 2, -boxH / 2, boxW, boxH);

          // Tactile double-line stamp border
          ctx.strokeStyle = cleanWordLower === 'fail' ? (colors.mathAccent || '#ef4444') : colors.background;
          ctx.lineWidth = cleanWordLower === 'fail' ? 2.5 : 2;
          ctx.strokeRect(-boxW / 2 + 3, -boxH / 2 + 3, boxW - 6, boxH - 6);

          ctx.fillStyle = colors.background;
          ctx.font = lw.fontEmphasisString || lw.fontString;
          ctx.fillText(lw.text, 0, 1);
        }
        ctx.restore();
      } else {
        // Kinetic Word with Entry Spring, Syllable Pop, Ghost Echo & Glowing Sweep Highlight
        ctx.save();
        ctx.translate(syllableShakeX + customShiftX, entryBounceY);
        ctx.rotate(entryTilt);
        ctx.scale(netScale, netScale);

        const halfW = (lw.width || 60) / 2;
        const halfH = (lw.height || 40) / 2;

        // Kinetic Ghost Echo during entry onset
        if (ghostAlpha > 0) {
          ctx.save();
          ctx.globalAlpha = ghostAlpha;
          ctx.fillStyle = theme === 'light_mode' ? '#0284c7' : '#38bdf8';
          ctx.font = lw.fontString;
          ctx.fillText(lw.text, 3, 2);
          ctx.restore();
        }

        // Base text (un-highlighted or past syllable portion)
        ctx.fillStyle = colors.spokenWordText;
        ctx.font = lw.fontString;
        ctx.fillText(lw.text, 0, 0);

        // Swept illuminated highlight
        ctx.save();
        ctx.beginPath();
        ctx.rect(-halfW - 4, -halfH, (lw.width + 8) * progress, lw.height * 2);
        ctx.clip();

        ctx.fillStyle = colors.activeWordText;
        ctx.font = lw.fontString;
        ctx.fillText(lw.text, 0, 0);

        // Glowing sweep blade front line with illuminated spark
        const bladeX = -halfW - 4 + (lw.width + 8) * progress;
        ctx.strokeStyle = colors.activeWordText;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(bladeX, -halfH * 0.85);
        ctx.lineTo(bladeX, halfH * 0.85);
        ctx.stroke();

        // Syllable spark on blade front
        ctx.fillStyle = theme === 'light_mode' ? '#f59e0b' : '#38bdf8';
        ctx.beginPath();
        ctx.arc(bladeX, 0, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore(); // end clip

        // Subtle syllable tracking ticks under active word
        if (numSyllables > 1) {
          const tickSpacing = (lw.width - 8) / numSyllables;
          const tickStartX = -halfW + 4;
          const tickY = halfH + 4;
          for (let s = 0; s < numSyllables; s++) {
            const isSylDone = s <= currentSyllableIdx;
            ctx.fillStyle = isSylDone ? colors.activeWordText : colors.unspokenWordText;
            ctx.fillRect(tickStartX + s * tickSpacing + 2, tickY, Math.max(4, tickSpacing - 4), 2);
          }
        }

        ctx.restore();
      }
      ctx.restore(); // Restores word level ctx.save() from line 490
      continue;
    } else if (isWordPast) {
      // Spoken words remain visible and gently settle
      const timeSinceEnd = currentTime - lw.end;
      const wordsAhead = activeWordIndex >= 0 ? Math.max(0, activeWordIndex - wIdx) : 0;

      // Keep past words in the phrase visible with gentle decay
      let maxCap = 0.85;
      let fadeDuration = 2.5;
      if (wordsAhead === 1) {
        maxCap = 0.75;
        fadeDuration = 2.2;
      } else if (wordsAhead === 2) {
        maxCap = 0.60;
        fadeDuration = 1.8;
      } else if (wordsAhead >= 3) {
        maxCap = 0.45;
        fadeDuration = 1.5;
      }

      const fadeP = Math.max(0, Math.min(1, timeSinceEnd / fadeDuration));
      const wordAlpha = maxCap * Math.pow(1.0 - fadeP, 1.2);

      if (wordAlpha <= 0.01) {
        ctx.restore();
        continue;
      }

      ctx.save();
      ctx.translate(customShiftX, 0); // Do NOT translate by lw.relX or lw.relY again!
      ctx.rotate(customTilt);
      ctx.scale(customScale, customScale);

      ctx.globalAlpha *= wordAlpha;
      ctx.fillStyle = colors.spokenWordText;
      ctx.font = lw.fontString;
      ctx.fillText(lw.text, 0, 0);
      ctx.restore();
      ctx.restore(); // Restores word level ctx.save() from line 490
      continue;
    }

    ctx.restore(); // Fallback restore for line 490
  }
  ctx.restore(); // Restores node level ctx.save() from line 452
}

/**
 * Renders an embedded mathematical equation block directly within the continuous world score.
 */
function renderEmbeddedMathNode(
  ctx: CanvasRenderingContext2D,
  node: SceneNode,
  currentTime: number,
  colors: ThemeColors,
  theme: ColorTheme = 'light_mode',
  cameraRotation = 0
): void {
  const scene = node.mathScene;
  if (!scene) return;

  ctx.save();
  ctx.translate(node.x, node.y);

  // Find active step
  let activeStep = scene.steps[0];
  for (let s = scene.steps.length - 1; s >= 0; s--) {
    if (currentTime >= scene.steps[s].startTime) {
      activeStep = scene.steps[s];
      break;
    }
  }

  const isSceneActive = currentTime >= scene.startTime && currentTime <= scene.endTime;

  // Header annotation
  ctx.fillStyle = isSceneActive ? (colors.mathAccent || '#eab308') : colors.unspokenWordText;
  ctx.font = '700 15px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(activeStep.annotation.toUpperCase(), 0, -90);

  // Spatially anchored "=" sign at center
  const equalsFont = '800 68px "Montserrat", sans-serif';
  const exprFont = '700 60px "Montserrat", sans-serif';

  ctx.fillStyle = isSceneActive ? colors.activeWordText : colors.spokenWordText;
  ctx.font = equalsFont;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('=', 0, -6);

  const eqGap = 55;

  // LEFT SIDE: Right-aligned with upright variables X (orange) and Y (green)
  renderMathExpressionWithVariables(
    ctx,
    activeStep.equation.left,
    -eqGap,
    0,
    'right',
    exprFont,
    theme,
    node.rotation,
    cameraRotation,
    60
  );

  // RIGHT SIDE: Left-aligned (Mechanical Split-Flap flip upon equation simplification)
  const timeInStep = Math.max(0, currentTime - activeStep.startTime);
  if (activeStep.stepType === 'simplify_result' && timeInStep < 1.2) {
    const flipP = timeInStep / 0.7;
    renderSplitFlapTile(ctx, eqGap + 8, -48, '?', activeStep.equation.right, flipP, {
      cardWidth: 56,
      cardHeight: 84,
      theme: isSceneActive ? 'dark_mode' : 'light_mode',
      borderAccent: true,
    });
  } else {
    renderMathExpressionWithVariables(
      ctx,
      activeStep.equation.right,
      eqGap,
      0,
      'left',
      exprFont,
      theme,
      node.rotation,
      cameraRotation,
      60
    );
  }

  // Visual balance beam / fulcrum baseline below
  ctx.strokeStyle = colors.scaleBeam || colors.ruleStroke || '#475569';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-280, 50);
  ctx.lineTo(280, 50);
  ctx.stroke();

  // Fulcrum triangle
  ctx.fillStyle = colors.mathAccent || '#f59e0b';
  ctx.beginPath();
  ctx.moveTo(0, 50);
  ctx.lineTo(-12, 68);
  ctx.lineTo(12, 68);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

// ----------------------------------------------------------------------------
// 2. MATHEMATICAL PROJECTION (Stark Black Background, White Formal Notation)
// ----------------------------------------------------------------------------

function renderKineticMathScene(
  ctx: CanvasRenderingContext2D,
  scene: SymbolicMathScene,
  currentTime: number,
  canvasWidth: number,
  canvasHeight: number
): void {
  // Pure stark pitch black background
  ctx.save();
  ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Find active step
  let activeStep = scene.steps[0];
  for (let s = scene.steps.length - 1; s >= 0; s--) {
    if (currentTime >= scene.steps[s].startTime) {
      activeStep = scene.steps[s];
      break;
    }
  }

  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;
  const timeInStep = Math.max(0, currentTime - activeStep.startTime);

  // Clean, high-legibility typographic scale
  const exprFont = '700 86px "Montserrat", sans-serif';
  const equalsFont = '800 96px "Montserrat", sans-serif';

  // Minimal uppercase header annotation
  ctx.fillStyle = '#666666';
  ctx.font = '700 16px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(activeStep.annotation.toUpperCase(), cx, 75);

  // Fade in during initial equation introduction
  if (activeStep.stepType === 'initial_equation' && timeInStep < 0.65) {
    ctx.save();
    ctx.globalAlpha = timeInStep / 0.65;
    const fullEq = `${activeStep.equation.left} = ${activeStep.equation.right}`;
    ctx.font = '800 64px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(fullEq, cx, cy);
    ctx.restore();
    return;
  }

  // Spatially anchored "=" sign at center
  ctx.fillStyle = '#FFFFFF';
  ctx.font = equalsFont;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('=', cx, cy - 8);

  const eqGap = 65;

  // LEFT SIDE: Right-aligned to (cx - eqGap)
  ctx.textAlign = 'right';
  ctx.font = exprFont;

  if (activeStep.stepType === 'apply_operation' && activeStep.operation) {
    const baseText = activeStep.equation.left.replace(activeStep.appliedOpText || '', '').trim();
    const opText = activeStep.appliedOpText || '';

    const opProgress = Math.min(1, timeInStep / 0.28);
    const opOffset = (1 - opProgress) * -35;
    const opAlpha = opProgress;

    renderMathExpressionWithVariables(
      ctx,
      baseText,
      cx - eqGap - 140,
      cy,
      'right',
      exprFont,
      'dark_mode',
      0,
      0,
      86
    );

    ctx.save();
    ctx.globalAlpha = opAlpha;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(opText, cx - eqGap, cy + opOffset);
    ctx.restore();
  } else if (activeStep.stepType === 'simplify_result' && timeInStep < 1.4) {
    renderSplitFlapTile(ctx, cx - eqGap - 96, cy - 64, activeStep.equation.left, activeStep.equation.left, 1.0, {
      cardWidth: 84,
      cardHeight: 128,
      theme: 'dark_mode',
    });
  } else {
    renderMathExpressionWithVariables(
      ctx,
      activeStep.equation.left,
      cx - eqGap,
      cy,
      'right',
      exprFont,
      'dark_mode',
      0,
      0,
      86
    );
  }

  // RIGHT SIDE: Left-aligned to (cx + eqGap)
  ctx.textAlign = 'left';
  ctx.font = exprFont;

  if (activeStep.stepType === 'apply_operation' && activeStep.operation) {
    const parts = activeStep.equation.right.split(' ');
    const baseVal = parts[0] || '';
    const opText = parts.slice(1).join(' ');

    const opProgress = Math.min(1, timeInStep / 0.28);
    const opOffset = (1 - opProgress) * -35;
    const opAlpha = opProgress;

    renderMathExpressionWithVariables(
      ctx,
      baseVal,
      cx + eqGap,
      cy,
      'left',
      exprFont,
      'dark_mode',
      0,
      0,
      86
    );

    ctx.save();
    ctx.globalAlpha = opAlpha;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(opText, cx + eqGap + 130, cy + opOffset);
    ctx.restore();
  } else if (activeStep.stepType === 'simplify_result' && timeInStep < 1.4) {
    const flipP = timeInStep / 0.75;
    renderSplitFlapTile(ctx, cx + eqGap + 12, cy - 64, '?', activeStep.equation.right, flipP, {
      cardWidth: 84,
      cardHeight: 128,
      theme: 'dark_mode',
      borderAccent: true,
    });
  } else {
    renderMathExpressionWithVariables(
      ctx,
      activeStep.equation.right,
      cx + eqGap,
      cy,
      'left',
      exprFont,
      'dark_mode',
      0,
      0,
      86
    );
  }

  // Visual Cancellation Strike-Through on left during simplify
  if (activeStep.leftCancelled && activeStep.stepType === 'simplify_result' && timeInStep < 0.9) {
    const strikeAlpha = Math.max(0, 1 - timeInStep / 0.9);
    ctx.save();
    ctx.globalAlpha = strikeAlpha * 0.55;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(cx - eqGap - 210, cy - 22);
    ctx.lineTo(cx - eqGap - 10, cy + 22);
    ctx.stroke();
    ctx.restore();
  }

  // Progress dot sequence at bottom
  const totalSteps = scene.steps.length;
  const currentStepIdx = scene.steps.indexOf(activeStep);
  const dotSpacing = 28;
  const dotsStartX = cx - ((totalSteps - 1) * dotSpacing) / 2;

  for (let d = 0; d < totalSteps; d++) {
    const dotX = dotsStartX + d * dotSpacing;
    const dotY = canvasHeight - 65;
    ctx.beginPath();
    ctx.arc(dotX, dotY, d === currentStepIdx ? 5.5 : 3, 0, Math.PI * 2);
    ctx.fillStyle = d === currentStepIdx ? '#FFFFFF' : '#333333';
    ctx.fill();
  }

  ctx.restore();
}

function renderEmptyMathStandby(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  ctx.save();
  ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#444444';
  ctx.font = '700 24px "Montserrat", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('MATHEMATICAL PROJECTION STANDBY', width / 2, height / 2 - 15);

  ctx.fillStyle = '#222222';
  ctx.font = '500 14px "JetBrains Mono", monospace';
  ctx.fillText('Awaiting algebraic teaching passage in audio stream...', width / 2, height / 2 + 20);

  ctx.restore();
}

// ----------------------------------------------------------------------------
// 3. CONTINUOUS SCROLLING SCREEN-SPACE BOUNCING DOT
// ----------------------------------------------------------------------------

/**
 * Screen-space bouncing dot:
 * - Completely immune to camera rotation: works purely in screen X and Y coordinates.
 * - Hops across syllables of words on the top line from left to right.
 * - In multi-line lockups, smoothly swoops from the end of the top line down to the bottom left.
 * - Hops across the bottom line to finish its job.
 * - When the phrase concludes, smoothly glides offscreen to the right and drowns downward.
 * - Strictly ONE dot at any point in time: non-overlapping temporal windows guarantee no multiple dots.
 */
function renderScreenBouncingDot(
  ctx: CanvasRenderingContext2D,
  graph: LayoutGraph,
  camera: CameraState,
  currentTime: number,
  canvasWidth: number,
  canvasHeight: number,
  colors?: ThemeColors,
  theme: ColorTheme = 'light_mode'
): void {
  renderBouncingBall(ctx, graph, camera, currentTime, canvasWidth, canvasHeight, colors, theme);
  return;
}

function _legacyRenderScreenBouncingDot(
  ctx: CanvasRenderingContext2D,
  graph: LayoutGraph,
  camera: CameraState,
  currentTime: number,
  canvasWidth: number,
  canvasHeight: number,
  colors?: ThemeColors,
  theme: ColorTheme = 'light_mode'
): void {

  // 1. Strictly single active node window with non-overlapping temporal buffers
  let activeNode: SceneNode | null = null;
  let activeEnterDur = 0.35;
  let activeExitDur = 0.38;
  let activeBirthTime = 0;
  let activeDeathTime = 0;

  for (let i = 0; i < graph.nodes.length; i++) {
    const node = graph.nodes[i];
    const prev = i > 0 ? graph.nodes[i - 1] : null;
    const next = i < graph.nodes.length - 1 ? graph.nodes[i + 1] : null;

    const words = node.positionedWords;
    const nodeStart = words && words.length > 0 ? words[0].start : node.startTime;
    const nodeEnd = words && words.length > 0 ? words[words.length - 1].end : node.endTime;

    const prevWords = prev?.positionedWords;
    const prevEnd = prev ? (prevWords && prevWords.length > 0 ? prevWords[prevWords.length - 1].end : prev.endTime) : null;

    const nextWords = next?.positionedWords;
    const nextStart = next ? (nextWords && nextWords.length > 0 ? nextWords[0].start : next.startTime) : null;

    let enterDur = 0.35;
    if (prevEnd !== null) {
      const gap = Math.max(0.001, nodeStart - prevEnd);
      enterDur = Math.min(0.35, Math.max(0.06, gap * 0.4));
    }
    const birthTime = nodeStart - enterDur;

    let exitDur = 0.38;
    if (nextStart !== null) {
      const gap = Math.max(0.001, nextStart - nodeEnd);
      exitDur = Math.min(0.42, Math.max(0.06, gap * 0.44));
    }
    const deathTime = nodeEnd + exitDur;

    // Strictly disjoint temporal windows
    if (currentTime >= birthTime && currentTime <= deathTime) {
      activeNode = node;
      activeEnterDur = enterDur;
      activeExitDur = exitDur;
      activeBirthTime = birthTime;
      activeDeathTime = deathTime;
      break; // Guarantee at most ONE node is selected
    }
  }

  // If no node is active (e.g. between phrases when dot has drowned offscreen), render nothing!
  if (!activeNode) return;

  let dotX = 0;
  let dotY = 0;
  let squashX = 1.0;
  let squashY = 1.0;

  if (activeNode.type === 'math_scene') {
    const center = worldToScreen(activeNode.x, activeNode.y, camera, canvasWidth, canvasHeight);
    const eqY = center.y - 70;

    if (currentTime < activeNode.startTime) {
      // Enters smoothly from offscreen left
      const p = Math.max(0, Math.min(1, (currentTime - activeBirthTime) / activeEnterDur));
      const ease = 1 - Math.pow(1 - p, 3);
      const startX = -70;
      const targetX = center.x - 120;
      dotX = startX + (targetX - startX) * ease;
      dotY = eqY - Math.sin(p * Math.PI) * 28;
      squashX = 1.25 - 0.25 * ease;
      squashY = 0.8 + 0.2 * ease;
    } else if (currentTime > activeNode.endTime) {
      // Smoothly goes off screen to the right and drowns
      const p = Math.max(0, Math.min(1, (currentTime - activeNode.endTime) / activeExitDur));
      const ease = p * (2 - p);
      const startX = center.x + 120;
      const targetX = canvasWidth + 90;
      dotX = startX + (targetX - startX) * ease;
      dotY = eqY + 80 * (p * p);
      squashX = 1.0 + 0.5 * p;
      squashY = Math.max(0.3, 1.0 - 0.4 * p);
    } else {
      // Dancing over active equation
      const progress = (currentTime - activeNode.startTime) / Math.max(0.01, activeNode.endTime - activeNode.startTime);
      const hop = Math.abs(Math.sin((currentTime - activeNode.startTime) * 5)) * 16;
      dotX = center.x - 120 + 240 * progress;
      dotY = eqY - hop;
    }

    drawBouncingDot(ctx, dotX, dotY, squashX, squashY, canvasWidth, canvasHeight, theme);
    return;
  }

  // Lyric phrase node
  const words = activeNode.positionedWords;
  if (!words || words.length === 0) return;

  const firstWord = words[0];
  const lastWord = words[words.length - 1];

  // Screen space metrics for boundary words
  const firstScreen = worldToScreen(firstWord.worldX!, firstWord.worldY!, camera, canvasWidth, canvasHeight);
  const firstW = (firstWord.width || 60) * camera.zoom;
  const firstH = (firstWord.height || 36) * camera.zoom;
  const firstTopY = firstScreen.y - firstH / 2 - 16;
  const firstLeftX = firstScreen.x - firstW / 2;

  const lastScreen = worldToScreen(lastWord.worldX!, lastWord.worldY!, camera, canvasWidth, canvasHeight);
  const lastW = (lastWord.width || 60) * camera.zoom;
  const lastH = (lastWord.height || 36) * camera.zoom;
  const lastTopY = lastScreen.y - lastH / 2 - 16;
  const lastRightX = lastScreen.x + lastW / 2;

  if (currentTime < firstWord.start) {
    // 1. ENTER LEFT: Enters smoothly from offscreen left onto the first syllable (top-left)
    const p = Math.max(0, Math.min(1, (currentTime - activeBirthTime) / activeEnterDur));
    const ease = 1 - Math.pow(1 - p, 3);
    const startX = Math.min(-60, firstLeftX - 160);
    dotX = startX + (firstLeftX - startX) * ease;
    dotY = firstTopY - Math.sin(p * Math.PI) * 32;
    squashX = 1.3 - 0.3 * ease;
    squashY = 0.75 + 0.25 * ease;
  } else if (currentTime > lastWord.end) {
    // 2. FINISH JOB & DROWN: Smoothly goes off screen to the right and drowns downward
    const p = Math.max(0, Math.min(1, (currentTime - lastWord.end) / activeExitDur));
    const ease = p * (2 - p);
    const targetX = Math.max(canvasWidth + 60, lastRightX + 160);
    dotX = lastRightX + (targetX - lastRightX) * ease;
    dotY = lastTopY + 80 * (p * p);
    squashX = 1.0 + 0.5 * p;
    squashY = Math.max(0.3, 1.0 - 0.4 * p);
  } else {
    // 3. ACTIVE LYRIC BOUNCE:
    // Hops across the top line, then goes to the bottom left, then finishes its job
    let activeWordIdx = -1;
    for (let w = 0; w < words.length; w++) {
      if (currentTime >= words[w].start && currentTime <= words[w].end) {
        activeWordIdx = w;
        break;
      }
    }

    if (activeWordIdx !== -1) {
      // Hopping across syllables of active word
      const w = words[activeWordIdx];
      const wScreen = worldToScreen(w.worldX!, w.worldY!, camera, canvasWidth, canvasHeight);
      const wWidth = (w.width || 60) * camera.zoom;
      const wHeight = (w.height || 36) * camera.zoom;
      const wTopY = wScreen.y - wHeight / 2 - 16;
      const wLeftX = wScreen.x - wWidth / 2;

      const numSyllables = countSyllables(w.text);
      const dur = Math.max(0.01, w.end - w.start);
      const sliceDur = dur / numSyllables;
      const sIndex = Math.min(numSyllables - 1, Math.max(0, Math.floor((currentTime - w.start) / sliceDur)));
      const sProgress = Math.max(0, Math.min(1, ((currentTime - w.start) - sIndex * sliceDur) / sliceDur));

      const segStartX = wLeftX + (sIndex / numSyllables) * wWidth;
      const segEndX = wLeftX + ((sIndex + 1) / numSyllables) * wWidth;

      dotX = segStartX + (segEndX - segStartX) * sProgress;
      const jump = Math.sin(sProgress * Math.PI) * 20;
      dotY = wTopY - jump;

      if (sProgress < 0.15 || sProgress > 0.85) {
        squashX = 1.15;
        squashY = 0.88;
      } else {
        squashX = 0.9;
        squashY = 1.12;
      }
    } else {
      // In the gap between two words in this phrase (e.g. from top line to bottom left!)
      let prevWord = words[0];
      let nextWord = words[words.length - 1];
      for (let w = 0; w < words.length - 1; w++) {
        if (currentTime > words[w].end && currentTime < words[w + 1].start) {
          prevWord = words[w];
          nextWord = words[w + 1];
          break;
        }
      }

      const pScreen = worldToScreen(prevWord.worldX!, prevWord.worldY!, camera, canvasWidth, canvasHeight);
      const pWidth = (prevWord.width || 60) * camera.zoom;
      const pHeight = (prevWord.height || 36) * camera.zoom;
      const pEndX = pScreen.x + pWidth / 2;
      const pTopY = pScreen.y - pHeight / 2 - 16;

      const nScreen = worldToScreen(nextWord.worldX!, nextWord.worldY!, camera, canvasWidth, canvasHeight);
      const nWidth = (nextWord.width || 60) * camera.zoom;
      const nHeight = (nextWord.height || 36) * camera.zoom;
      const nStartX = nScreen.x - nWidth / 2;
      const nTopY = nScreen.y - nHeight / 2 - 16;

      const gapStart = prevWord.end;
      const gapEnd = nextWord.start;
      const gapDur = Math.max(0.001, gapEnd - gapStart);
      const gapP = Math.max(0, Math.min(1, (currentTime - gapStart) / gapDur));

      // Ease curve between words
      const ease = gapP < 0.5 ? 2 * gapP * gapP : 1 - Math.pow(-2 * gapP + 2, 2) / 2;
      dotX = pEndX + (nStartX - pEndX) * ease;

      // Arc jump: if wrapping from top line down to bottom-left, graceful swoop
      const isLineWrap = nTopY > pTopY + 10;
      const arcH = isLineWrap ? 28 : Math.min(38, 16 + Math.abs(nStartX - pEndX) * 0.12);
      dotY = pTopY + (nTopY - pTopY) * ease - Math.sin(gapP * Math.PI) * arcH;

      squashX = 1.05;
      squashY = 0.95;
    }
  }

  // Draw the strictly single dot
  drawBouncingDot(ctx, dotX, dotY, squashX, squashY, canvasWidth, canvasHeight, theme);
}

function drawBouncingDot(
  ctx: CanvasRenderingContext2D,
  screenX: number,
  screenY: number,
  squashX: number,
  squashY: number,
  canvasWidth: number,
  canvasHeight: number,
  theme: ColorTheme = 'light_mode'
): void {
  // If completely beyond the off-screen margins, do not render
  if (screenX < -120 || screenX > canvasWidth + 120) return;

  const isLight = theme === 'light_mode';
  const radius = 10;
  ctx.save();
  ctx.translate(screenX, screenY);
  ctx.scale(squashX, squashY);

  if (isLight) {
    // Elegant high-contrast monochrome ink-black sphere with subtle shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
    ctx.beginPath();
    ctx.ellipse(0, radius * 1.15, radius * 1.05, radius * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // Core sphere gradient
    const grad = ctx.createRadialGradient(-radius * 0.35, -radius * 0.35, radius * 0.1, 0, 0, radius);
    grad.addColorStop(0, '#374151');
    grad.addColorStop(0.65, '#111827');
    grad.addColorStop(1, '#000000');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // White-hot specular glint
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-radius * 0.32, -radius * 0.32, radius * 0.28, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Broad celestial aura in dark mode
    const outerAura = ctx.createRadialGradient(0, 0, radius * 0.5, 0, 0, radius * 3.0);
    outerAura.addColorStop(0, 'rgba(56, 189, 248, 0.4)');
    outerAura.addColorStop(0.5, 'rgba(14, 165, 233, 0.18)');
    outerAura.addColorStop(1, 'rgba(2, 132, 199, 0)');
    ctx.fillStyle = outerAura;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 3.0, 0, Math.PI * 2);
    ctx.fill();

    // Focused neon radiance
    ctx.fillStyle = 'rgba(56, 189, 248, 0.55)';
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Core gradient
    const grad = ctx.createRadialGradient(-radius * 0.35, -radius * 0.35, radius * 0.1, 0, 0, radius);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.5, '#7dd3fc');
    grad.addColorStop(0.85, '#0284c7');
    grad.addColorStop(1, '#0369a1');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Specular glint
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-radius * 0.3, -radius * 0.3, radius * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function renderKaraokeView(
  ctx: CanvasRenderingContext2D,
  graph: LayoutGraph,
  camera: CameraState,
  currentTime: number,
  canvasWidth: number,
  canvasHeight: number,
  colors: ThemeColors
): void {
  renderKaraokeFilmCreditsView(ctx, graph, camera, currentTime, canvasWidth, canvasHeight, colors);
}

// ----------------------------------------------------------------------------
// 4. DEBUG GRAPH PROJECTION (Machine Diagnostics & Causal Rail Oscilloscope)
// ----------------------------------------------------------------------------

function renderDebugGraphView(
  ctx: CanvasRenderingContext2D,
  graph: LayoutGraph,
  camera: CameraState,
  currentTime: number,
  canvasWidth: number,
  canvasHeight: number,
  colors: ThemeColors
): void {
  // Dark engineering background
  ctx.save();
  ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
  ctx.fillStyle = '#06080b';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.restore();

  ctx.save();
  applyCameraTransform(ctx, camera, canvasWidth, canvasHeight);

  // 1. Draw World Coordinate Grid
  const gridSize = 150;
  const b = graph.bounds;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;

  ctx.beginPath();
  for (let x = b.minX - 500; x <= b.maxX + 500; x += gridSize) {
    ctx.moveTo(x, b.minY - 500);
    ctx.lineTo(x, b.maxY + 500);
  }
  for (let y = b.minY - 500; y <= b.maxY + 500; y += gridSize) {
    ctx.moveTo(b.minX - 500, y);
    ctx.lineTo(b.maxX + 500, y);
  }
  ctx.stroke();

  // Origin Axes
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-1000, 0);
  ctx.lineTo(1000, 0);
  ctx.moveTo(0, -1000);
  ctx.lineTo(0, 1000);
  ctx.stroke();

  // 2. Draw Causal Graph Rails / Interop Edges with labels
  for (const edge of graph.edges) {
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);

    ctx.beginPath();
    ctx.moveTo(edge.startX, edge.startY);
    ctx.lineTo(edge.endX, edge.endY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Turn Angle badge
    const midX = (edge.startX + edge.endX) / 2;
    const midY = (edge.startY + edge.endY) / 2;
    ctx.fillStyle = '#38bdf8';
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${edge.type} [${edge.turnAngleDeg}°]`, midX, midY - 6);

    if (edge.pivotChar) {
      ctx.fillStyle = '#f59e0b';
      ctx.fillText(`PIVOT: "${edge.pivotChar}"`, midX, midY + 12);
    }
  }

  // 3. Render Nodes with Bounding Boxes & Identifiers
  for (const node of graph.nodes) {
    const isActive = currentTime >= node.startTime && currentTime <= node.endTime + 0.35;

    ctx.save();
    ctx.translate(node.x, node.y);
    ctx.rotate(node.rotation);

    // Bounding Box
    ctx.strokeStyle = isActive ? '#10b981' : 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = isActive ? 2 : 1;
    ctx.strokeRect(-node.width / 2, -node.height / 2, node.width, node.height);

    // Node metadata tag
    ctx.fillStyle = isActive ? '#10b981' : '#6b7280';
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(
      `ID: ${node.id} (${node.type}) [${node.startTime.toFixed(1)}s - ${node.endTime.toFixed(1)}s]`,
      -node.width / 2,
      -node.height / 2 - 8
    );

    ctx.restore();

    // Render node text in debug mode
    renderTypographicLockup(ctx, node, currentTime, isActive, currentTime > node.endTime, false, colors, 'dark_mode', camera.rotation);
  }

  // 4. Camera target crosshair
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(camera.targetX - 25, camera.targetY);
  ctx.lineTo(camera.targetX + 25, camera.targetY);
  ctx.moveTo(camera.targetX, camera.targetY - 25);
  ctx.lineTo(camera.targetX, camera.targetY + 25);
  ctx.stroke();

  ctx.restore();

  // Draw continuous screen-space bouncing dot
  renderScreenBouncingDot(ctx, graph, camera, currentTime, canvasWidth, canvasHeight);

  // 5. Screen-Space Debug Instrumentation HUD
  ctx.save();
  ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);

  // Top-left diagnostic oscilloscope card
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.fillRect(16, 16, 380, 180);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1;
  ctx.strokeRect(16, 16, 380, 180);

  ctx.fillStyle = '#38bdf8';
  ctx.font = '700 12px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('DIAGNOSTIC INSTRUMENTATION : LEXICAL KINEMATICS', 28, 38);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '500 11px "JetBrains Mono", monospace';
  ctx.fillText(`PROJECTION MODE: DEBUG GRAPH`, 28, 60);
  
    ctx.fillText(`NODES IN GRAPH: ${graph.nodes.length}  |  EDGES: ${graph.edges.length}`, 28, 114);
  ctx.fillText(`CAMERA: pos=(${camera.x.toFixed(0)}, ${camera.y.toFixed(0)}) zoom=${camera.zoom.toFixed(2)}x`, 28, 132);
  ctx.fillText(`WORLD BOUNDS: ${graph.bounds.width.toFixed(0)} × ${graph.bounds.height.toFixed(0)} px`, 28, 150);
  ctx.fillText(`COMPILED MATH SCENES: ${graph.mathScenes?.length || 0}`, 28, 168);

  ctx.restore();
}

// ----------------------------------------------------------------------------
// 5. OVERVIEW PROJECTION (Spatial Typographic Landscape)
// ----------------------------------------------------------------------------

function renderOverviewView(
  ctx: CanvasRenderingContext2D,
  graph: LayoutGraph,
  camera: CameraState,
  currentTime: number,
  canvasWidth: number,
  canvasHeight: number,
  colors: ThemeColors
): void {
  ctx.save();
  ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.restore();

  ctx.save();
  applyCameraTransform(ctx, camera, canvasWidth, canvasHeight);

  // Render all nodes
  for (const node of graph.nodes) {
    const isPast = currentTime > node.endTime + 0.35;
    const isActive = currentTime >= node.startTime && currentTime <= node.endTime + 0.35;
    const isFuture = currentTime < node.startTime;

    renderTypographicLockup(
      ctx,
      node,
      currentTime,
      isActive,
      isPast,
      isFuture,
      colors,
      colors.background === '#0a0a0a' ? 'dark_mode' : 'light_mode',
      camera.rotation
    );
  }

  ctx.restore();

  renderScreenBouncingDot(ctx, graph, camera, currentTime, canvasWidth, canvasHeight);

  renderCinematicVignette(ctx, canvasWidth, canvasHeight, colors);
}

/**
 * Screen-space radial vignette.
 */
function renderCinematicVignette(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  colors: ThemeColors
): void {
  ctx.save();
  ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);

  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.max(width, height) * 0.72;
  const key = `${width}_${height}_${colors.vignetteInner}_${colors.vignetteOuter}`;

  if (!cachedVignetteGrad || cachedVignetteKey !== key) {
    cachedVignetteGrad = ctx.createRadialGradient(cx, cy, radius * 0.25, cx, cy, radius);
    cachedVignetteGrad.addColorStop(0, colors.vignetteInner);
    cachedVignetteGrad.addColorStop(1, colors.vignetteOuter);
    cachedVignetteKey = key;
  }

  ctx.fillStyle = cachedVignetteGrad;
  ctx.fillRect(0, 0, width, height);

  ctx.restore();
}
