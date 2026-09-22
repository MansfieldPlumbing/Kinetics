import { LayoutGraph, CameraState, ThemeColors, ColorTheme } from './types.ts';
import { countSyllables } from './graph.ts';
import { applyCameraTransform } from './camera.ts';

export interface BouncingBallTarget {
  time: number;
  endTime: number;
  x: number;
  y: number;
  upX: number;
  upY: number;
  dirX: number;
  dirY: number;
  rotation: number;
  wordText: string;
  isFirstInWord: boolean;
  isLastInWord: boolean;
  isFirstInPhrase: boolean;
  isLastInPhrase: boolean;
  fontSize: number;
  scaleCenter?: { x: number; y: number };
  nodeStartTime?: number;
  fx?: string;
  wordIndex?: number;
}

export interface BouncingBallState {
  x: number;
  y: number;
  upX: number;
  upY: number;
  dirX: number;
  dirY: number;
  rotation: number;
  squashX: number;
  squashY: number;
  shadowX: number;
  shadowY: number;
  shadowAlpha: number;
  shadowScale: number;
  alpha: number;
  visible: boolean;
}

/**
 * Extracts and caches all syllable bounce targets across the layout graph in world coordinates.
 */
export function getBouncingBallTargets(graph: LayoutGraph): BouncingBallTarget[] {
  if ((graph as any)._bouncingBallTargets) {
    return (graph as any)._bouncingBallTargets;
  }

  const targets: BouncingBallTarget[] = [];
  const nodes = [...graph.nodes].filter(
    (n) => n.type === 'lyric' && n.positionedWords && n.positionedWords.length > 0
  );
  nodes.sort((a, b) => a.startTime - b.startTime);

  for (let nIdx = 0; nIdx < nodes.length; nIdx++) {
    const node = nodes[nIdx];
    const words = node.positionedWords!;

    for (let wIdx = 0; wIdx < words.length; wIdx++) {
      const w = words[wIdx];
      const isFirstInPhrase = wIdx === 0;
      const isLastInPhrase = wIdx === words.length - 1;

      const numSyllables = countSyllables(w.text);
      const dur = Math.max(0.01, w.end - w.start);

      const cosR = Math.cos(node.rotation);
      const sinR = Math.sin(node.rotation);
      const upX = Math.cos(node.rotation - Math.PI / 2);
      const upY = Math.sin(node.rotation - Math.PI / 2);

      const wordLeftX = w.worldX! - (w.width / 2) * cosR;
      const wordLeftY = w.worldY! - (w.width / 2) * sinR;

      // Contact point sits right above the letters of the word
      const contactDist = w.height / 2 + 10;

      for (let s = 0; s < numSyllables; s++) {
        const sylStartTime = w.start + (s / numSyllables) * dur;
        const sylEndTime = w.start + ((s + 1) / numSyllables) * dur;

        const sylFrac = (s + 0.5) / numSyllables;
        const sylCenterX = wordLeftX + sylFrac * w.width * cosR;
        const sylCenterY = wordLeftY + sylFrac * w.width * sinR;

        const contactX = sylCenterX + upX * contactDist;
        const contactY = sylCenterY + upY * contactDist;

        targets.push({
          time: sylStartTime,
          endTime: sylEndTime,
          x: contactX,
          y: contactY,
          upX,
          upY,
          dirX: cosR,
          dirY: sinR,
          rotation: node.rotation,
          wordText: w.text,
          isFirstInWord: s === 0,
          isLastInWord: s === numSyllables - 1,
          isFirstInPhrase: isFirstInPhrase && s === 0,
          isLastInPhrase: isLastInPhrase && s === numSyllables - 1,
          fontSize: w.fontSize || 48,
          scaleCenter: (node as any)._scaleCenter,
          nodeStartTime: node.startTime,
          fx: (node as any).fx,
          wordIndex: wIdx,
        });
      }
    }
  }

  // Strictly chronological sort
  targets.sort((a, b) => a.time - b.time);
  (graph as any)._bouncingBallTargets = targets;
  return targets;
}

/**
 * Resolves the dynamic world coordinate of a target, accounting for active procedural animators
 * such as the balance scale seesaw or snake kinetic wobble.
 */
function resolveTargetPosition(
  target: BouncingBallTarget,
  currentTime: number
): { x: number; y: number; upX: number; upY: number; rotation: number } {
  let x = target.x;
  let y = target.y;
  let upX = target.upX;
  let upY = target.upY;
  let rot = target.rotation;

  // 1. Kinetic snake wave wobble
  if (target.fx === 'snake' && target.wordIndex !== undefined) {
    const snakeT = currentTime * 4.0 - target.wordIndex * 0.5;
    const snakeOffsetY = Math.sin(snakeT) * 12;
    const snakeOffsetX = Math.cos(snakeT * 0.7) * 4;
    x += snakeOffsetX;
    y += snakeOffsetY;
  }

  // 2. Balance scale seesaw rotation around scale center
  if (target.scaleCenter && target.nodeStartTime !== undefined) {
    const baseT = target.nodeStartTime < 80 ? 42.44 : 101.5;
    const balanceStart = baseT + 7.5;
    if (currentTime > balanceStart) {
      const balT = currentTime - balanceStart;
      const damp = Math.min(1, balT / 1.0) * Math.max(0, 1 - (currentTime - (baseT + 11)) / 1.0);
      const seesawRot = Math.sin(balT * Math.PI * 1.5) * 0.12 * damp;

      const sc = target.scaleCenter;
      const dx = x - sc.x;
      const dy = y - sc.y;
      const cosS = Math.cos(seesawRot);
      const sinS = Math.sin(seesawRot);

      x = sc.x + dx * cosS - dy * sinS;
      y = sc.y + dx * sinS + dy * cosS;

      const uX = upX * cosS - upY * sinS;
      const uY = upX * sinS + upY * cosS;
      upX = uX;
      upY = uY;
      rot += seesawRot;
    }
  }

  return { x, y, upX, upY, rotation: rot };
}

/**
 * Samples the exact physical state of the bouncing ball at currentTime.
 */
export function sampleBouncingBall(graph: LayoutGraph, currentTime: number): BouncingBallState | null {
  // Suppress during 3D StepByStep acts (including UNKNOWN letter aperture zoom)
  const isStepByStep1 = currentTime >= 61.78 && currentTime <= 70.4;
  const isStepByStep2 = currentTime >= 120.82 && currentTime <= 129.5;
  if (isStepByStep1 || isStepByStep2) {
    return null;
  }

  // Suppress during full math breakdown equation scenes (handled by clean bottom subtitle line)
  const isMathScene = (currentTime >= 70.4 && currentTime <= 90.25) || (currentTime >= 153.4 && currentTime <= 175.75);
  if (isMathScene) {
    return null;
  }

  const targets = getBouncingBallTargets(graph);
  if (targets.length === 0) return null;

  const firstT = targets[0];
  const lastT = targets[targets.length - 1];

  // Suppress during the first 13s intro title card while "ALGEBRA" is displayed
  if (currentTime < 12.8) {
    return null;
  }

  // Before intro vocal entry
  const entryStart = Math.max(12.8, firstT.time - 0.35);
  if (currentTime < entryStart) {
    return null;
  }

  // Graceful entry drop-in onto first word
  if (currentTime < firstT.time) {
    const p = Math.max(0, Math.min(1, (currentTime - entryStart) / 0.45));
    // Parabolic drop with ease
    const dropOffset = (1 - p) * (1 - p) * 160;
    const bx = firstT.x + firstT.upX * dropOffset;
    const by = firstT.y + firstT.upY * dropOffset;

    return {
      x: bx,
      y: by,
      upX: firstT.upX,
      upY: firstT.upY,
      dirX: firstT.dirX,
      dirY: firstT.dirY,
      rotation: firstT.rotation,
      squashX: 1.0 - 0.15 * (1 - p),
      squashY: 1.0 + 0.25 * (1 - p),
      shadowX: firstT.x,
      shadowY: firstT.y,
      shadowAlpha: p * 0.4,
      shadowScale: 0.5 + 0.5 * p,
      alpha: Math.min(1, p * 2.5),
      visible: true,
    };
  }

  // After the last lyric
  if (currentTime >= lastT.endTime) {
    const timePast = currentTime - lastT.endTime;
    if (timePast > 2.0) return null;
    const alpha = Math.max(0, 1.0 - timePast / 2.0);
    return {
      x: lastT.x,
      y: lastT.y,
      upX: lastT.upX,
      upY: lastT.upY,
      dirX: lastT.dirX,
      dirY: lastT.dirY,
      rotation: lastT.rotation,
      squashX: 1.0,
      squashY: 1.0,
      shadowX: lastT.x,
      shadowY: lastT.y,
      shadowAlpha: alpha * 0.45,
      shadowScale: 1.0,
      alpha,
      visible: true,
    };
  }

  // Find active target interval
  let idx = 0;
  let low = 0;
  let high = targets.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (targets[mid].time <= currentTime) {
      idx = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const curr = targets[idx];
  const next = targets[Math.min(targets.length - 1, idx + 1)];
  const dt = next.time - curr.time;

  const currPos = resolveTargetPosition(curr, currentTime);
  const nextPos = resolveTargetPosition(next, currentTime);

  // If we are at the very last target
  if (idx === targets.length - 1 || dt <= 0.001) {
    return {
      x: currPos.x,
      y: currPos.y,
      upX: currPos.upX,
      upY: currPos.upY,
      dirX: curr.dirX,
      dirY: curr.dirY,
      rotation: currPos.rotation,
      squashX: 1.0,
      squashY: 1.0,
      shadowX: currPos.x,
      shadowY: currPos.y,
      shadowAlpha: 0.45,
      shadowScale: 1.0,
      alpha: 1.0,
      visible: true,
    };
  }

  // --- TRAJECTORY PHYSICS ---
  if (dt <= 0.65) {
    // Continuous dynamic bounce across syllables / rapid words
    const p = Math.max(0, Math.min(1, (currentTime - curr.time) / dt));
    const arc = 4 * p * (1 - p); // 0 at touchdown, 1 at apex

    const dx = nextPos.x - currPos.x;
    const dy = nextPos.y - currPos.y;
    const dist = Math.hypot(dx, dy);

    // Interpolate baseline contact position
    const baseX = currPos.x + dx * p;
    const baseY = currPos.y + dy * p;

    // Interpolate upward unit vector
    let ux = currPos.upX + (nextPos.upX - currPos.upX) * p;
    let uy = currPos.upY + (nextPos.upY - currPos.upY) * p;
    const uLen = Math.hypot(ux, uy) || 1;
    ux /= uLen;
    uy /= uLen;

    // Height of parabolic leap
    const isWordJump = curr.isLastInWord;
    const isPhraseJump = curr.isLastInPhrase;
    let jumpHeight = Math.min(85, Math.max(26, dist * 0.35));
    if (isPhraseJump) jumpHeight = Math.min(95, Math.max(45, dist * 0.38));
    else if (isWordJump) jumpHeight = Math.min(65, Math.max(30, dist * 0.34));

    const ballX = baseX + ux * (arc * jumpHeight);
    const ballY = baseY + uy * (arc * jumpHeight);

    // Squash on touchdown, stretch at apex
    const impact = 1 - arc;
    const squashX = 1.0 + 0.22 * impact - 0.12 * arc;
    const squashY = 1.0 - 0.18 * impact + 0.16 * arc;

    // Orientation follows trajectory velocity
    const rot = currPos.rotation + (nextPos.rotation - currPos.rotation) * p;

    return {
      x: ballX,
      y: ballY,
      upX: ux,
      upY: uy,
      dirX: curr.dirX,
      dirY: curr.dirY,
      rotation: rot,
      squashX,
      squashY,
      shadowX: baseX,
      shadowY: baseY,
      shadowAlpha: 0.45 * (1 - arc * 0.65),
      shadowScale: 1.0 - arc * 0.35,
      alpha: 1.0,
      visible: true,
    };
  } else {
    // Vocal pause / gap between phrases (dt > 0.65s)
    const landDur = 0.20;
    const takeoffLead = 0.35;
    const pauseMidStart = curr.time + landDur;
    const takeoffStart = next.time - takeoffLead;

    if (currentTime < pauseMidStart) {
      // Phase 1: Soft landing hop onto current word
      const lp = (currentTime - curr.time) / landDur;
      const landArc = Math.sin(lp * Math.PI) * (1 - lp) * 12;
      const impact = 1 - lp;

      return {
        x: currPos.x + currPos.upX * landArc,
        y: currPos.y + currPos.upY * landArc,
        upX: currPos.upX,
        upY: currPos.upY,
        dirX: curr.dirX,
        dirY: curr.dirY,
        rotation: currPos.rotation,
        squashX: 1.0 + 0.2 * impact,
        squashY: 1.0 - 0.16 * impact,
        shadowX: currPos.x,
        shadowY: currPos.y,
        shadowAlpha: 0.45,
        shadowScale: 1.0,
        alpha: 1.0,
        visible: true,
      };
    } else if (currentTime < takeoffStart) {
      // Phase 2: Idling on current word with subtle beat breathing (105 BPM)
      const beatCycle = (currentTime * 1.75 * Math.PI * 2) % (Math.PI * 2);
      const bob = Math.max(0, Math.sin(beatCycle)) * 3;

      return {
        x: currPos.x + currPos.upX * bob,
        y: currPos.y + currPos.upY * bob,
        upX: currPos.upX,
        upY: currPos.upY,
        dirX: curr.dirX,
        dirY: curr.dirY,
        rotation: currPos.rotation,
        squashX: 1.0,
        squashY: 1.0,
        shadowX: currPos.x,
        shadowY: currPos.y,
        shadowAlpha: 0.45,
        shadowScale: 1.0,
        alpha: 1.0,
        visible: true,
      };
    } else {
      // Phase 3: Grand arc across the gap to the next phrase
      const p = Math.max(0, Math.min(1, (currentTime - takeoffStart) / takeoffLead));
      const arc = 4 * p * (1 - p);

      const dx = nextPos.x - currPos.x;
      const dy = nextPos.y - currPos.y;
      const dist = Math.hypot(dx, dy);

      const baseX = currPos.x + dx * p;
      const baseY = currPos.y + dy * p;

      let ux = currPos.upX + (nextPos.upX - currPos.upX) * p;
      let uy = currPos.upY + (nextPos.upY - currPos.upY) * p;
      const uLen = Math.hypot(ux, uy) || 1;
      ux /= uLen;
      uy /= uLen;

      const jumpHeight = Math.min(110, Math.max(45, dist * 0.36));
      const ballX = baseX + ux * (arc * jumpHeight);
      const ballY = baseY + uy * (arc * jumpHeight);

      const impact = 1 - arc;
      const squashX = 1.0 + 0.18 * impact - 0.12 * arc;
      const squashY = 1.0 - 0.14 * impact + 0.15 * arc;
      const rot = currPos.rotation + (nextPos.rotation - currPos.rotation) * p;

      return {
        x: ballX,
        y: ballY,
        upX: ux,
        upY: uy,
        dirX: curr.dirX,
        dirY: curr.dirY,
        rotation: rot,
        squashX,
        squashY,
        shadowX: baseX,
        shadowY: baseY,
        shadowAlpha: 0.45 * (1 - arc * 0.65),
        shadowScale: 1.0 - arc * 0.35,
        alpha: 1.0,
        visible: true,
      };
    }
  }
}

// Circular trail history buffer for gorgeous kinetic motion blur
const trailHistory: Array<{ x: number; y: number; time: number }> = [];

/**
 * Renders the authoritative bouncing sing-along ball in world space.
 * Because it applies applyCameraTransform directly, the ball aligns 100% with the rendered lyrics.
 */
export function renderBouncingBall(
  ctx: CanvasRenderingContext2D,
  graph: LayoutGraph,
  camera: CameraState,
  currentTime: number,
  canvasWidth: number,
  canvasHeight: number,
  colors?: ThemeColors,
  theme: ColorTheme = 'light_mode'
): void {
  const ball = sampleBouncingBall(graph, currentTime);
  if (!ball || !ball.visible || ball.alpha <= 0.01) {
    trailHistory.length = 0; // Clear trail buffer when hidden
    return;
  }

  // Reset trail history if currentTime jumps backwards (scrubbing/seeking) or has a large gap
  if (trailHistory.length > 0) {
    const lastTime = trailHistory[trailHistory.length - 1].time;
    if (currentTime < lastTime || currentTime - lastTime > 0.4) {
      trailHistory.length = 0;
    }
  }

  // Update trail history (retaining last 0.14s of positions)
  trailHistory.push({ x: ball.x, y: ball.y, time: currentTime });
  while (trailHistory.length > 0 && currentTime - trailHistory[0].time > 0.14) {
    trailHistory.shift();
  }

  ctx.save();
  // Apply camera transform to match the exact world space of the typographic lockups
  applyCameraTransform(ctx, camera, canvasWidth, canvasHeight);

  // Constant visual radius on screen (11.5 screen pixels)
  const baseScreenRadius = 11.5;
  const worldRadius = Math.max(0.1, baseScreenRadius / Math.max(camera.zoom, 0.05));

  const isDark = theme === 'dark_mode';
  // Iconic solid black bouncing dot
  const ballColor = '#0a0a0a';
  const shadowColor = isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(15, 23, 42, 0.38)';

  // 1. Draw Word Contact Shadow (Anchored on the letters beneath the ball)
  if (ball.shadowAlpha > 0.02) {
    ctx.save();
    ctx.translate(ball.shadowX, ball.shadowY);
    ctx.rotate(ball.rotation);
    ctx.scale(ball.shadowScale, ball.shadowScale * 0.4);
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(0.1, worldRadius * 1.3), 0, Math.PI * 2);
    ctx.fillStyle = shadowColor;
    ctx.globalAlpha = ball.alpha * ball.shadowAlpha;
    ctx.fill();
    ctx.restore();
  }

  // 2. Motion Trail / Comet Ghosting along the leap arc
  if (trailHistory.length > 2) {
    ctx.save();
    for (let i = 0; i < trailHistory.length - 1; i++) {
      const pt = trailHistory[i];
      const age = Math.max(0, Math.min(1, (currentTime - pt.time) / 0.14));
      const trailAlpha = (1 - age) * 0.18 * ball.alpha;
      const trailRadius = Math.max(0, worldRadius * (1 - age * 0.4));

      if (trailRadius > 0.01 && trailAlpha > 0.001) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, trailRadius, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(10, 10, 10, 0.18)';
        ctx.globalAlpha = trailAlpha;
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // 3. Classic Graphic Black Bouncing Ball
  ctx.save();
  ctx.translate(ball.x, ball.y);
  ctx.rotate(ball.rotation);
  ctx.scale(ball.squashX, ball.squashY);
  ctx.globalAlpha = ball.alpha;

  // Outer ambient rim / contrast halo (subtle in light mode, high-contrast white rim in dark mode)
  if (isDark) {
    ctx.beginPath();
    ctx.arc(0, 0, worldRadius + 1.2, 0, Math.PI * 2);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();
  }

  // Solid jet black ball core
  ctx.beginPath();
  ctx.arc(0, 0, worldRadius, 0, Math.PI * 2);
  ctx.fillStyle = ballColor;
  ctx.fill();

  // Polished 3D specular highlight (gives subtle tactile sheen like a glossy black billiard ball)
  const sphereGrad = ctx.createRadialGradient(
    -worldRadius * 0.32,
    -worldRadius * 0.32,
    worldRadius * 0.08,
    0,
    0,
    worldRadius
  );
  sphereGrad.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
  sphereGrad.addColorStop(0.35, 'rgba(50, 50, 50, 0.2)');
  sphereGrad.addColorStop(1, 'rgba(10, 10, 10, 0.95)');
  ctx.beginPath();
  ctx.arc(0, 0, worldRadius, 0, Math.PI * 2);
  ctx.fillStyle = sphereGrad;
  ctx.fill();

  // Crisp specular glint
  ctx.beginPath();
  ctx.arc(-worldRadius * 0.32, -worldRadius * 0.32, worldRadius * 0.24, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = ball.alpha * 0.85;
  ctx.fill();

  ctx.restore();
  ctx.restore();
}
