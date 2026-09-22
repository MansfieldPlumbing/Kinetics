/**
 * PROCEDURAL MECHANICAL KARAOKE SCROLL (FILM CREDITS ENGINE)
 * 
 * Invariants per user specification:
 * 1. Deep black canvas background (#000000).
 * 2. Continuous upward vertical scroll like theatrical film end credits.
 * 3. Words arranged sequentially in clean horizontal lines, perfectly centered.
 * 4. Distinctive typography stylized like the main kinetic presentation:
 *    - Uppercase display hierarchy (Montserrat / Bebas Neue / Playfair Display).
 *    - Emphasis keywords highlighted (VARIABLE in amber, X in orange, Y in green, etc.).
 *    - Active word with syllable sweep illumination.
 *    - Unspoken words in translucent silver (rgba(255, 255, 255, 0.42)).
 *    - Spoken words in solid white (rgba(255, 255, 255, 0.95)).
 *    - Past lines scrolled above dimmed with distance attenuation.
 *    - Future lines scrolled below faded with distance attenuation.
 * 5. Single white bouncing ball (#ffffff) on black background:
 *    - Rhythmically leaps across words and syllables with realistic parabolic hops.
 *    - Dynamic squash and stretch on bounce.
 *    - Graceful swoop arc when transitioning from the end of one line to the next.
 *    - Soft white contact glow and comet trail.
 * 6. Top and bottom cinematic vignette fades (lines emerge from and recede into darkness).
 * 7. Fully procedural, memoized once per layout change for 60+ FPS zero-overhead execution.
 */

import { LayoutGraph, CameraState, ThemeColors } from '../types.ts';
import { countSyllables } from '../graph.ts';
import { isVariableWord } from './variableHero.ts';
import { isVarX, isVarY } from './variableXY.ts';

export interface KaraokeWordLayout {
  text: string;
  cleanText: string;
  start: number;
  end: number;
  width: number;
  relX: number; // offset from line horizontal center
  fontSize: number;
  fontString: string;
  isEmphasis: boolean;
  isVarX: boolean;
  isVarY: boolean;
  isVariable: boolean;
  numSyllables: number;
}

export interface KaraokeLineLayout {
  id: string;
  lineIndex: number;
  text: string;
  startTime: number;
  endTime: number;
  words: KaraokeWordLayout[];
  totalWidth: number;
  canonicalY: number; // cumulative vertical position in the credits reel
  fontSize: number;
}

interface CachedScrollLayout {
  graphRef: LayoutGraph | null;
  canvasWidth: number;
  lines: KaraokeLineLayout[];
  totalHeight: number;
}

let cachedLayout: CachedScrollLayout = {
  graphRef: null,
  canvasWidth: 0,
  lines: [],
  totalHeight: 0,
};

// Emphasis keywords that receive bold punch in the lyric text
const EMPHASIS_KEYWORDS = new Set([
  'board', 'down', 'frown', 'x', 'y', 'math', 'path', 'variable', 'mystery',
  'hide', 'alone', 'throne', 'isolate', 'left', 'right', 'sign', 'fine',
  'balance', 'scale', 'golden', 'rule', 'fail', 'unknown', 'answer', 'shown',
  'reverse', 'subtract', 'curse', 'six', 'ten', 'magic', 'tricks', 'divide',
  'opposite', 'side', 'two', 'steps', 'backwards', 'first', 'multiply',
  'onion', 'layer', 'puzzle', 'player', 'clean', 'twenty', 'friend', 'light',
  'solved',
]);

/**
 * Builds or retrieves the procedural film-credits layout for the lyric lines.
 */
export function getOrBuildKaraokeScrollLayout(
  ctx: CanvasRenderingContext2D,
  graph: LayoutGraph,
  canvasWidth: number
): KaraokeLineLayout[] {
  if (
    cachedLayout.graphRef === graph &&
    Math.abs(cachedLayout.canvasWidth - canvasWidth) < 20 &&
    cachedLayout.lines.length > 0
  ) {
    return cachedLayout.lines;
  }

  const lyricNodes = graph.nodes.filter((n) => n.type === 'lyric');
  if (lyricNodes.length === 0) {
    return [];
  }

  const lines: KaraokeLineLayout[] = [];
  const baseLineSpacing = 84; // standard credits line height
  let currentY = 0;

  // Measure and position each line
  for (let lIdx = 0; lIdx < lyricNodes.length; lIdx++) {
    const node = lyricNodes[lIdx];
    const sourceWords = node.words && node.words.length > 0 ? node.words : [];
    if (sourceWords.length === 0) continue;

    const baseFontSize = Math.min(38, Math.max(28, canvasWidth * 0.038));
    const wordSpacing = Math.round(baseFontSize * 0.38);

    // Measure words for this line
    const wordLayouts: KaraokeWordLayout[] = [];
    let accumulatedLineWidth = 0;

    for (let wIdx = 0; wIdx < sourceWords.length; wIdx++) {
      const w = sourceWords[wIdx];
      const clean = w.text.toLowerCase().replace(/[^a-z0-9]/g, '');
      const isVarXWord = isVarX(w.text);
      const isVarYWord = isVarY(w.text);
      const isVariable = isVariableWord(w.text);
      const isEmphasis = EMPHASIS_KEYWORDS.has(clean) || isVarXWord || isVarYWord || isVariable;

      const fontSize = isEmphasis ? Math.round(baseFontSize * 1.15) : baseFontSize;
      const fontWeight = isEmphasis ? '900' : '700';
      const fontFamily = isEmphasis ? '"Bebas Neue", "Montserrat", sans-serif' : '"Montserrat", sans-serif';
      const fontString = `${fontWeight} ${fontSize}px ${fontFamily}`;

      ctx.font = fontString;
      let textWidth = ctx.measureText(w.text.toUpperCase()).width;
      if (isVariable) textWidth = Math.max(textWidth + 24, fontSize * 3.8);
      if (isVarXWord || isVarYWord) textWidth = Math.max(textWidth + 12, fontSize * 1.2);

      wordLayouts.push({
        text: w.text.toUpperCase(),
        cleanText: clean,
        start: w.start,
        end: w.end,
        width: textWidth,
        relX: 0, // calculated below once totalWidth is known
        fontSize,
        fontString,
        isEmphasis,
        isVarX: isVarXWord,
        isVarY: isVarYWord,
        isVariable,
        numSyllables: Math.max(1, countSyllables(w.text)),
      });

      accumulatedLineWidth += textWidth;
      if (wIdx < sourceWords.length - 1) {
        accumulatedLineWidth += wordSpacing;
      }
    }

    // Proportional scale-down if the line exceeds safe margins
    const maxAvailableWidth = canvasWidth * 0.90;
    const scale = accumulatedLineWidth > maxAvailableWidth ? maxAvailableWidth / accumulatedLineWidth : 1.0;
    const finalLineWidth = accumulatedLineWidth * scale;

    let currentRelX = -finalLineWidth / 2;
    for (const wl of wordLayouts) {
      if (scale < 1.0) {
        wl.width *= scale;
        wl.fontSize = Math.round(wl.fontSize * scale);
        wl.fontString = wl.fontString.replace(/\d+px/, `${wl.fontSize}px`);
      }
      wl.relX = currentRelX + wl.width / 2;
      currentRelX += wl.width + wordSpacing * scale;
    }

    lines.push({
      id: node.id,
      lineIndex: lIdx,
      text: node.text,
      startTime: wordLayouts[0].start,
      endTime: wordLayouts[wordLayouts.length - 1].end,
      words: wordLayouts,
      totalWidth: finalLineWidth,
      canonicalY: currentY,
      fontSize: baseFontSize,
    });

    currentY += baseLineSpacing;
  }

  cachedLayout = {
    graphRef: graph,
    canvasWidth,
    lines,
    totalHeight: currentY,
  };

  return lines;
}

// Trail history for the white bouncing dot
interface BallTrailPoint {
  x: number;
  y: number;
  time: number;
}
const ballTrail: BallTrailPoint[] = [];

/**
 * Normalizes and renders the complete Karaoke View:
 * 1. Deep black canvas background.
 * 2. Mechanical vertical credits roll centered on active phrase.
 * 3. Stylized typography with active word illumination.
 * 4. Single white bouncing ball jumping across syllables with physics hops.
 * 5. Cinematic top and bottom edge vignettes.
 */
export function renderKaraokeFilmCreditsView(
  ctx: CanvasRenderingContext2D,
  graph: LayoutGraph,
  _camera: CameraState,
  currentTime: number,
  canvasWidth: number,
  canvasHeight: number,
  _colors: ThemeColors
): void {
  // 1. Solid pitch black background
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 2. Build or fetch procedural layout
  const lines = getOrBuildKaraokeScrollLayout(ctx, graph, canvasWidth);
  if (lines.length === 0) {
    ctx.restore();
    return;
  }

  // 3. Find current active line
  let activeLineIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (currentTime >= lines[i].startTime - 0.2) {
      activeLineIdx = i;
    } else {
      break;
    }
  }

  const activeLine = lines[activeLineIdx];
  const nextLine = activeLineIdx < lines.length - 1 ? lines[activeLineIdx + 1] : null;

  // 4. Calculate Mechanical Scroll Position (Film Credits Reel)
  // Reading horizon is vertically centered at 44% down the screen
  const horizonY = canvasHeight * 0.44;

  let targetReelY = activeLine.canonicalY;

  // If transitioning to next line during the gap or last 0.2s of current line
  if (nextLine) {
    const transitionStart = Math.max(activeLine.startTime + 0.2, activeLine.endTime - 0.2);
    const transitionEnd = nextLine.startTime + 0.1;

    if (currentTime > transitionStart && transitionEnd > transitionStart) {
      const p = Math.max(0, Math.min(1, (currentTime - transitionStart) / (transitionEnd - transitionStart)));
      // Smooth cubic ease
      const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      targetReelY = activeLine.canonicalY + (nextLine.canonicalY - activeLine.canonicalY) * ease;
    } else {
      // Gentle subtle live drift while singing
      const phraseDur = Math.max(0.01, activeLine.endTime - activeLine.startTime);
      const phraseP = Math.max(0, Math.min(1, (currentTime - activeLine.startTime) / phraseDur));
      targetReelY = activeLine.canonicalY + phraseP * 8;
    }
  } else {
    // Last line drift
    const phraseDur = Math.max(0.01, activeLine.endTime - activeLine.startTime);
    const phraseP = Math.max(0, Math.min(1, (currentTime - activeLine.startTime) / phraseDur));
    targetReelY = activeLine.canonicalY + phraseP * 8;
  }

  const scrollOffset = targetReelY - horizonY;
  const centerX = canvasWidth / 2;

  // 5. Render Film Credit Lines
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const screenY = line.canonicalY - scrollOffset;

    // Temporal & spatial culling (skip lines offscreen)
    if (screenY < -100 || screenY > canvasHeight + 100) {
      continue;
    }

    const isThisLineActive = i === activeLineIdx;
    const distFromHorizon = Math.abs(screenY - horizonY);

    // Compute distance attenuation for film credit look
    let lineAlpha = 1.0;
    if (!isThisLineActive) {
      if (screenY < horizonY) {
        // Scrolled above (past lines)
        lineAlpha = Math.max(0.12, 0.45 - (distFromHorizon / (canvasHeight * 0.45)) * 0.35);
      } else {
        // Scrolled below (upcoming lines)
        lineAlpha = Math.max(0.10, 0.38 - (distFromHorizon / (canvasHeight * 0.45)) * 0.28);
      }
    }

    ctx.save();
    ctx.globalAlpha = lineAlpha;

    // Draw line's words
    for (let wIdx = 0; wIdx < line.words.length; wIdx++) {
      const w = line.words[wIdx];
      const wordX = centerX + w.relX;
      const wordY = screenY;

      ctx.font = w.fontString;

      if (!isThisLineActive) {
        // Inactive / background credit lines
        if (w.isVariable) {
          ctx.fillStyle = '#f59e0b';
        } else if (w.isVarX) {
          ctx.fillStyle = '#fb923c';
        } else if (w.isVarY) {
          ctx.fillStyle = '#4ade80';
        } else if (w.isEmphasis) {
          ctx.fillStyle = '#e2e8f0';
        } else {
          ctx.fillStyle = '#94a3b8';
        }
        ctx.fillText(w.text, wordX, wordY);
        continue;
      }

      // ACTIVE LINE: rich typographic state
      const isWordPast = currentTime > w.end + 0.06;
      const isWordActive = currentTime >= w.start && currentTime <= w.end + 0.06;
      const isWordFuture = currentTime < w.start;

      if (isWordFuture) {
        // Unspoken words: subtle, clean translucent silver
        ctx.fillStyle = 'rgba(255, 255, 255, 0.38)';
        ctx.fillText(w.text, wordX, wordY);
      } else if (isWordPast) {
        // Spoken words: solid bright white with clean finish
        if (w.isVariable) {
          ctx.fillStyle = '#f59e0b';
        } else if (w.isVarX) {
          ctx.fillStyle = '#fb923c';
        } else if (w.isVarY) {
          ctx.fillStyle = '#4ade80';
        } else {
          ctx.fillStyle = '#ffffff';
        }
        ctx.fillText(w.text, wordX, wordY);
      } else if (isWordActive) {
        // Active singing word: spring pop, syllable sweep, brilliant illumination
        const wordDur = Math.max(0.01, w.end - w.start);
        const timeSinceStart = currentTime - w.start;
        const progress = Math.max(0, Math.min(1, timeSinceStart / wordDur));

        // Spring pop on vocal onset
        let popScale = 1.0;
        if (timeSinceStart < 0.22) {
          const p = timeSinceStart / 0.22;
          popScale = 1.0 + 0.14 * Math.sin(p * Math.PI) * (1 - p);
        }

        ctx.save();
        ctx.translate(wordX, wordY);
        ctx.scale(popScale, popScale);

        // 1. Base dim layer
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.fillText(w.text, 0, 0);

        // 2. Swept illuminated highlight layer
        ctx.save();
        const halfW = w.width / 2;
        const halfH = w.fontSize;
        ctx.beginPath();
        ctx.rect(-halfW - 6, -halfH, (w.width + 12) * progress, halfH * 2);
        ctx.clip();

        // Illuminated filled text
        if (w.isVariable) {
          ctx.fillStyle = '#fbbf24';
        } else if (w.isVarX) {
          ctx.fillStyle = '#fb923c';
        } else if (w.isVarY) {
          ctx.fillStyle = '#4ade80';
        } else if (w.isEmphasis) {
          ctx.fillStyle = '#fbbf24';
        } else {
          ctx.fillStyle = '#ffffff';
        }
        ctx.fillText(w.text, 0, 0);

        // Vertical glowing sweep blade
        const sweepX = -halfW - 6 + (w.width + 12) * progress;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(sweepX, -w.fontSize * 0.45);
        ctx.lineTo(sweepX, w.fontSize * 0.45);
        ctx.stroke();

        ctx.restore(); // end clip

        // Subtle syllable tracking dots under active word
        if (w.numSyllables > 1) {
          const sylStep = (w.width - 6) / w.numSyllables;
          const sylStartX = -halfW + 3;
          const sylY = w.fontSize * 0.65;
          const currentSylIdx = Math.min(w.numSyllables - 1, Math.floor(progress * w.numSyllables));

          for (let s = 0; s < w.numSyllables; s++) {
            ctx.fillStyle = s <= currentSylIdx ? '#ffffff' : 'rgba(255, 255, 255, 0.25)';
            ctx.fillRect(sylStartX + s * sylStep + 2, sylY, Math.max(3, sylStep - 4), 2);
          }
        }

        ctx.restore(); // restore word transform
      }
    }

    ctx.restore();
  }

  // 6. SINGLE WHITE BOUNCING BALL (#ffffff) ON BLACK BACKGROUND
  renderWhiteBouncingDot(ctx, lines, activeLineIdx, currentTime, scrollOffset, horizonY, centerX, canvasWidth, canvasHeight);

  // 7. Cinematic Top and Bottom Vignette Fades
  // Creates the iconic film-credits effect where lines emerge from and disappear into black
  const vignetteH = Math.min(130, canvasHeight * 0.16);

  // Top fade
  const topGrad = ctx.createLinearGradient(0, 0, 0, vignetteH);
  topGrad.addColorStop(0, '#000000');
  topGrad.addColorStop(0.65, 'rgba(0, 0, 0, 0.85)');
  topGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, canvasWidth, vignetteH);

  // Bottom fade
  const botGrad = ctx.createLinearGradient(0, canvasHeight - vignetteH, 0, canvasHeight);
  botGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  botGrad.addColorStop(0.35, 'rgba(0, 0, 0, 0.85)');
  botGrad.addColorStop(1, '#000000');
  ctx.fillStyle = botGrad;
  ctx.fillRect(0, canvasHeight - vignetteH, canvasWidth, vignetteH);

  // 8. Sleek Film Credits Mode Header
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.font = '700 10px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(
    `KARAOKE ROLL • PHRASE ${activeLineIdx + 1} OF ${lines.length}  |  FILM CREDITS PROJECTION`,
    canvasWidth / 2,
    22
  );

  ctx.restore();
}

/**
 * Calculates and draws the pure white bouncing dot across the film credits text.
 */
function renderWhiteBouncingDot(
  ctx: CanvasRenderingContext2D,
  lines: KaraokeLineLayout[],
  activeLineIdx: number,
  currentTime: number,
  scrollOffset: number,
  _horizonY: number,
  centerX: number,
  _canvasWidth: number,
  _canvasHeight: number
): void {
  const line = lines[activeLineIdx];
  const nextLine = activeLineIdx < lines.length - 1 ? lines[activeLineIdx + 1] : null;
  const words = line.words;
  if (words.length === 0) return;

  const lineScreenY = line.canonicalY - scrollOffset;
  const ballBaseY = lineScreenY - line.fontSize * 0.65 - 12;

  let ballX = centerX + words[0].relX;
  let ballY = ballBaseY;
  let squashX = 1.0;
  let squashY = 1.0;
  let alpha = 1.0;

  const firstWord = words[0];
  const lastWord = words[words.length - 1];

  if (currentTime < firstWord.start) {
    // Gentle breathing hover waiting on the first word
    const pulse = Math.sin(currentTime * 4.5);
    ballX = centerX + firstWord.relX;
    ballY = ballBaseY - 4 + pulse * 3.5;
    squashX = 1.0 + pulse * 0.04;
    squashY = 1.0 - pulse * 0.04;
  } else if (currentTime > lastWord.end) {
    // Transitioning to next line or finishing
    if (nextLine && nextLine.words.length > 0) {
      const nextFirstWord = nextLine.words[0];
      const nextLineScreenY = nextLine.canonicalY - scrollOffset;
      const nextBallBaseY = nextLineScreenY - nextLine.fontSize * 0.65 - 12;

      const gapDur = Math.max(0.01, nextLine.startTime - lastWord.end);
      const p = Math.max(0, Math.min(1, (currentTime - lastWord.end) / gapDur));
      const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;

      const startX = centerX + lastWord.relX;
      const endX = centerX + nextFirstWord.relX;

      // Graceful swoop arc down to the beginning of the incoming line
      ballX = startX + (endX - startX) * ease;
      const hop = Math.sin(p * Math.PI) * 42;
      ballY = ballBaseY + (nextBallBaseY - ballBaseY) * p - hop;

      // Stretch along the arc
      squashX = 1.0 - 0.15 * Math.sin(p * Math.PI);
      squashY = 1.0 + 0.18 * Math.sin(p * Math.PI);
    } else {
      // Song end: gentle fade
      ballX = centerX + lastWord.relX;
      ballY = ballBaseY;
      alpha = Math.max(0, 1.0 - (currentTime - lastWord.end) * 1.5);
    }
  } else {
    // Inside active phrase: find active or bounding word
    let activeWIdx = 0;
    for (let w = 0; w < words.length; w++) {
      if (currentTime >= words[w].start) {
        activeWIdx = w;
      } else {
        break;
      }
    }

    const currentWord = words[activeWIdx];
    const nextWord = activeWIdx < words.length - 1 ? words[activeWIdx + 1] : null;

    if (currentTime <= currentWord.end) {
      // Bouncing on the current word across syllables!
      const wordDur = Math.max(0.01, currentWord.end - currentWord.start);
      const intraWordP = Math.max(0, Math.min(1, (currentTime - currentWord.start) / wordDur));

      const numSyl = currentWord.numSyllables;
      const sylIdx = Math.min(numSyl - 1, Math.floor(intraWordP * numSyl));
      const sylP = intraWordP * numSyl - sylIdx;

      const wordLeft = centerX + currentWord.relX - currentWord.width / 2;
      const sylStep = currentWord.width / numSyl;
      const sylCenterX = wordLeft + (sylIdx + 0.5) * sylStep;

      let targetX = sylCenterX;
      if (sylIdx < numSyl - 1) {
        const nextSylCenterX = wordLeft + (sylIdx + 1.5) * sylStep;
        targetX = sylCenterX + (nextSylCenterX - sylCenterX) * sylP;
      } else if (nextWord) {
        const nextWordFirstSylX = centerX + nextWord.relX - nextWord.width / 2 + (0.5 / nextWord.numSyllables) * nextWord.width;
        // In the final 25% of the last syllable, start leaning toward next word
        if (sylP > 0.75) {
          const leanP = (sylP - 0.75) / 0.25;
          targetX = sylCenterX + (nextWordFirstSylX - sylCenterX) * (leanP * 0.35);
        }
      }

      ballX = targetX;

      // Parabolic jump arc for each syllable
      const hopHeight = 24;
      const hop = Math.sin(sylP * Math.PI) * hopHeight;
      ballY = ballBaseY - hop;

      // Dynamic squash & stretch
      const peak = Math.sin(sylP * Math.PI);
      squashX = 1.0 + 0.22 * (1 - peak) - 0.12 * peak;
      squashY = 1.0 - 0.18 * (1 - peak) + 0.15 * peak;

      // Contact glow on word landing
      if (peak < 0.25) {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
        ctx.beginPath();
        ctx.ellipse(ballX, ballBaseY + 6, 12 * (1 - peak), 4 * (1 - peak), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    } else if (nextWord) {
      // Leap across gap from currentWord to nextWord
      const gapDur = Math.max(0.01, nextWord.start - currentWord.end);
      const gapP = Math.max(0, Math.min(1, (currentTime - currentWord.end) / gapDur));

      const startX = centerX + currentWord.relX;
      const endX = centerX + nextWord.relX;

      ballX = startX + (endX - startX) * gapP;
      const hop = Math.sin(gapP * Math.PI) * 28;
      ballY = ballBaseY - hop;

      const peak = Math.sin(gapP * Math.PI);
      squashX = 1.0 - 0.14 * peak;
      squashY = 1.0 + 0.18 * peak;
    }
  }

  if (alpha <= 0.01) return;

  // Maintain short comet trail
  ballTrail.push({ x: ballX, y: ballY, time: currentTime });
  while (ballTrail.length > 0 && currentTime - ballTrail[0].time > 0.12) {
    ballTrail.shift();
  }

  ctx.save();
  ctx.globalAlpha = alpha;

  // 1. Motion Trail (soft white ghosting)
  if (ballTrail.length > 2) {
    for (let t = 0; t < ballTrail.length - 1; t++) {
      const pt = ballTrail[t];
      const ageP = (currentTime - pt.time) / 0.12;
      const trailAlpha = (1 - ageP) * 0.28 * alpha;
      const trailRadius = Math.max(2, 7.5 * (1 - ageP * 0.4));

      ctx.fillStyle = `rgba(255, 255, 255, ${trailAlpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, trailRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 2. Outer Bloom / Corona Glow
  const glowGrad = ctx.createRadialGradient(ballX, ballY, 2, ballX, ballY, 18);
  glowGrad.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
  glowGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.22)');
  glowGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(ballX, ballY, 18, 0, Math.PI * 2);
  ctx.fill();

  // 3. Solid White Ball Core with Squash & Stretch
  ctx.save();
  ctx.translate(ballX, ballY);
  ctx.scale(squashX, squashY);

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, 8.5, 0, Math.PI * 2);
  ctx.fill();

  // Clean subtle inner specular shine
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.beginPath();
  ctx.arc(-2.5, -2.5, 3.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
  ctx.restore();
}
