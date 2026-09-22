/**
 * PROCEDURAL CAUSAL GRAPH GENERATOR
 * 2D Text Render Pipeline "Stephen Fry - Language" Style Kinetic Typography Engine.
 * 
 * Invariants:
 * - Words form tight, expressive typographic lockups (stacked rows, varied weights/sizes).
 * - Nodes snuggle adjacent to each other on an infinite 2D plane with 90° turns & crossword pivots.
 * - All words remain persistent in world space, creating a vast typographic tapestry.
 * - Math equations are monumental typography, zero cybernetic boxes.
 */

import { TimedWord, SceneNode, InteropEdge, LayoutGraph, PositionedWord } from './types.ts';
import { compileMathematicalScenes, SymbolicMathScene } from './mathCompiler.ts';
import { getChoreoInstruction } from './choreo.ts';

// Key lyrical emphasis words that receive bold monumental sizing
const EMPHASIS_KEYWORDS = new Set([
  'board', 'down', 'frown', 'x', 'y', 'math', 'path', 'variable', 'mystery',
  'hide', 'alone', 'throne', 'isolate', 'left', 'right', 'sign', 'fine',
  'balance', 'scale', 'golden', 'rule', 'fail', 'unknown', 'answer', 'shown',
  'reverse', 'subtract', 'curse', 'six', 'ten', 'magic', 'tricks', 'divide',
  'opposite', 'side', 'two', 'steps', 'backwards', 'first', 'multiply',
  'onion', 'layer', 'puzzle', 'player', 'clean', 'twenty', 'friend', 'light',
  'solved',
]);

const ITALIC_INTRO_WORDS = new Set([
  'yeah,', 'let’s', "let's", 'don’t', "don't", 'see', 'it’s', "it's",
  'we', 'a', 'the', 'whatever', 'do', 'if', 'so', 'what', 'now',
]);

/**
 * Builds a typographic lockup with varied font styles and stacked rows.
 */
function buildLockup(words: TimedWord[]): { positionedWords: PositionedWord[]; width: number; height: number } {
  if (words.length === 0) {
    return { positionedWords: [], width: 100, height: 60 };
  }

  // Determine row distribution (1, 2, or 3 rows)
  let rowWordCounts: number[];
  const N = words.length;
  if (N <= 3) {
    rowWordCounts = [N];
  } else if (N <= 6) {
    const half = Math.ceil(N / 2);
    rowWordCounts = [half, N - half];
  } else {
    const third1 = Math.ceil(N / 3);
    const third2 = Math.ceil((N - third1) / 2);
    rowWordCounts = [third1, third2, N - third1 - third2];
  }

  interface TempWord {
    word: TimedWord;
    fontSize: number;
    fontFamily: string;
    fontWeight: string;
    isItalic: boolean;
    isAllCap: boolean;
    isEmphasis: boolean;
    width: number;
    height: number;
  }

  const rows: TempWord[][] = [];
  let wordIdx = 0;

  for (const count of rowWordCounts) {
    const row: TempWord[] = [];
    for (let c = 0; c < count && wordIdx < N; c++) {
      const w = words[wordIdx++];
      const cleanLower = w.text.toLowerCase().replace(/[^a-z0-9]/g, '');
      const isEmphasis = EMPHASIS_KEYWORDS.has(cleanLower) || cleanLower === 'x' || cleanLower === 'y';
      const isItalic = ITALIC_INTRO_WORDS.has(w.text.toLowerCase()) && !isEmphasis;

      let fontSize = 62;
      let fontFamily = '"Montserrat", sans-serif';
      let fontWeight = '800';

      if (isEmphasis) {
        fontSize = cleanLower === 'x' || cleanLower === 'y' ? 116 : 88;
        fontFamily = '"Montserrat", sans-serif';
        fontWeight = '900';
      } else if (isItalic) {
        fontSize = 56;
        fontFamily = '"Playfair Display", serif';
        fontWeight = '700';
      } else if (w.text.length <= 3) {
        fontSize = 58;
        fontFamily = '"Montserrat", sans-serif';
        fontWeight = '700';
      }

      // Approximate monospace/proportional width for layout
      const charWidth = isEmphasis ? fontSize * 0.72 : isItalic ? fontSize * 0.58 : fontSize * 0.64;
      let width = Math.max(w.text.length * charWidth, 42);
      if (cleanLower === 'variable' || cleanLower === 'variables') {
        width = Math.max(width + 80, 270);
      } else if (cleanLower === 'x' || cleanLower === 'y') {
        width = Math.max(width + 28, 92);
      }
      const height = fontSize * 1.28;

      row.push({
        word: w,
        fontSize,
        fontFamily,
        fontWeight,
        isItalic,
        isAllCap: isEmphasis,
        isEmphasis,
        width,
        height,
      });
    }
    rows.push(row);
  }

  // Calculate row dimensions with tight, impactful editorial rhythm
  const WORD_SPACING = 24;
  const ROW_GAP = 18;

  const rowWidths: number[] = [];
  const rowHeights: number[] = [];

  for (const row of rows) {
    let w = 0;
    let maxH = 0;
    for (let i = 0; i < row.length; i++) {
      w += row[i].width;
      if (i < row.length - 1) w += WORD_SPACING;
      maxH = Math.max(maxH, row[i].height);
    }
    rowWidths.push(w);
    rowHeights.push(maxH);
  }

  const totalWidth = Math.max(...rowWidths) + 50;
  const totalHeight = rowHeights.reduce((a, b) => a + b, 0) + (rows.length - 1) * ROW_GAP + 36;

  // Position each word relative to lockup center (0, 0)
  const positionedWords: PositionedWord[] = [];
  let curY = -totalHeight / 2 + 15;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const rHeight = rowHeights[r];
    const rWidth = rowWidths[r];
    let curX = -rWidth / 2;

    for (const tw of row) {
      const italicPrefix = tw.isItalic ? 'italic ' : '';
      positionedWords.push({
        text: tw.isAllCap ? tw.word.text.toUpperCase() : tw.word.text,
        start: tw.word.start,
        end: tw.word.end,
        relX: curX + tw.width / 2,
        relY: curY + rHeight / 2,
        fontSize: tw.fontSize,
        fontFamily: tw.fontFamily,
        fontWeight: tw.fontWeight,
        isItalic: tw.isItalic,
        isAllCap: tw.isAllCap,
        isEmphasis: tw.isEmphasis,
        width: tw.width,
        height: tw.height,
        fontString: `${italicPrefix}${tw.fontWeight} ${tw.fontSize}px ${tw.fontFamily}`,
        fontEmphasisString: `900 ${tw.fontSize}px ${tw.fontFamily}`,
      });
      curX += tw.width + WORD_SPACING;
    }
    curY += rHeight + ROW_GAP;
  }

  return { positionedWords, width: totalWidth, height: totalHeight };
}

/**
 * Procedurally constructs the continuous kinetic causal graph from timed words.
 */

export function countSyllables(text: string): number {
  const word = text.toLowerCase().replace(/[^a-z]/g, '');
  if (!word) return 1;
  const matches = word.match(/[aeiouy]+/g);
  let count = matches ? matches.length : 1;
  if (count > 1 && word.endsWith('e') && !word.endsWith('le')) {
    count--;
  }
  return Math.max(1, count);
}

function generateWordKeyframes(w: import('./types.ts').PositionedWord, startT: number, endT: number): import('./types.ts').WordKeyframes {
  return {
    opacity: [
      { time: startT - 0.25, value: 0.12, ease: 'easeOutQuad' },
      { time: startT, value: 1.0, ease: 'hold' },
      { time: endT + 0.2, value: 1.0, ease: 'easeOutQuad' },
      { time: endT + 0.65, value: 0.45, ease: 'easeOutQuad' },
      { time: endT + 1.5, value: 0.0, ease: 'easeOutQuad' }
    ],
    scale: [
      { time: startT - 0.08, value: 0.88, ease: 'easeOutQuad' },
      { time: startT, value: 1.20, ease: 'easeOutQuad' },
      { time: startT + 0.14, value: 0.98, ease: 'easeInOutCubic' },
      { time: startT + 0.26, value: 1.0, ease: 'hold' }
    ],
    colorMode: [
      { time: 0, value: 'unspoken', ease: 'hold' },
      { time: startT, value: 'active', ease: 'hold' },
      { time: endT, value: 'spoken', ease: 'hold' }
    ]
  };
}

export function buildCausalGraph(timedWords: TimedWord[]): LayoutGraph {
  if (timedWords.length === 0) {
    return {
      nodes: [],
      edges: [],
      mathScenes: [],
      dotKeyframes: [],
      cameraKeyframes: [],
      bounds: { minX: -500, maxX: 500, minY: -500, maxY: 500, width: 1000, height: 1000 },
      totalDuration: 0,
    };
  }

  // Canonical word counts for the 42 authoritative lyric lines of the song
  const SONG_LINE_WORD_COUNTS = [
    9, 7, 12, 9, 8, 8, 10, 8, 9, 10, 7, 9, 9, 11,
    10, 10, 9, 8, 9, 7, 8, 8, 9, 10, 7, 9, 9, 11,
    8, 6, 6, 8, 9, 8, 6, 6, 9, 11, 9, 6, 8, 9
  ];

  // 1. Group timed words into logical lyric phrases
  const lines: { text: string; words: TimedWord[]; startTime: number; endTime: number }[] = [];

  if (timedWords.length === 359) {
    let wIdx = 0;
    for (const count of SONG_LINE_WORD_COUNTS) {
      const slice = timedWords.slice(wIdx, wIdx + count);
      if (slice.length > 0) {
        lines.push({
          text: slice.map((cw) => cw.text).join(' '),
          words: slice,
          startTime: slice[0].start,
          endTime: slice[slice.length - 1].end,
        });
      }
      wIdx += count;
    }
  } else {
    let curWords: TimedWord[] = [];
    for (let i = 0; i < timedWords.length; i++) {
      const w = timedWords[i];
      curWords.push(w);

      const isLast = i === timedWords.length - 1;
      const nextW = timedWords[i + 1];
      const endsWithSentencePunct = /[.?!]$/.test(w.text);
      const timeGap = nextW ? nextW.start - w.end : 0;
      const wordCount = curWords.length;

      // Group into natural editorial lines (avoid fragmenting on commas)
      if (isLast || (wordCount >= 4 && (endsWithSentencePunct || timeGap > 0.85)) || wordCount >= 11) {
        lines.push({
          text: curWords.map((cw) => cw.text).join(' '),
          words: [...curWords],
          startTime: curWords[0].start,
          endTime: curWords[curWords.length - 1].end,
        });
        curWords = [];
      }
    }
  }

  // Run mechanical compile-time pass over the entire lexical material
  const mathScenes = compileMathematicalScenes(lines);

  const nodes: SceneNode[] = [];
  const edges: InteropEdge[] = [];

  // Instantiating the unified, continuous spatial typography score.
  // All lines and mathematical artifacts exist on one cohesive, unbroken plane.
  let currentX = 0;
  let currentY = 0;
  let currentAngle = 0;

  const TURN_SEQUENCE = [0, 90, 0, -90, -90, 0, 90, 0, -90, 90];
  let turnIdx = 0;

  const processedMathScenes = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nodeId = `node_${i}`;

    // If an algebraic equation belongs before or with this line, instantiate it in-line
    const matchedScene = mathScenes.find(
      (s) => !processedMathScenes.has(s.id) && Math.abs(s.startTime - line.startTime) < 1.2
    );

    if (matchedScene) {
      processedMathScenes.add(matchedScene.id);
      const mathId = matchedScene.id;
      
      const mathWidth = 880;
      const mathHeight = 280;

      let exitX = currentX;
      let exitY = currentY;
      
      if (nodes.length > 0) {
        const prev = nodes[nodes.length - 1];
        exitX = prev.x + Math.cos(currentAngle + Math.PI/2) * (prev.height / 2 + 120);
        exitY = prev.y + Math.sin(currentAngle + Math.PI/2) * (prev.height / 2 + 120);
      }
      
      const mathX = exitX + Math.cos(currentAngle + Math.PI/2) * (mathHeight / 2);
      const mathY = exitY + Math.sin(currentAngle + Math.PI/2) * (mathHeight / 2);

      const mathNode: SceneNode = {
        id: mathId,
        type: 'math_scene',
        lineIndex: i,
        text: matchedScene.title,
        words: [],
        startTime: matchedScene.startTime,
        endTime: matchedScene.endTime,
        x: mathX,
        y: mathY,
        rotation: currentAngle,
        width: mathWidth,
        height: mathHeight,
        mathScene: matchedScene,
      };

      if (nodes.length > 0) {
        const prev = nodes[nodes.length - 1];
        edges.push({
          type: 'algebraic_bridge',
          fromNodeId: prev.id,
          toNodeId: mathId,
          startX: prev.x + Math.cos(currentAngle + Math.PI/2) * (prev.height / 2),
          startY: prev.y + Math.sin(currentAngle + Math.PI/2) * (prev.height / 2),
          endX: mathX - Math.cos(currentAngle + Math.PI/2) * (mathHeight / 2),
          endY: mathY - Math.sin(currentAngle + Math.PI/2) * (mathHeight / 2),
          turnAngleDeg: 0,
        });
      }

      nodes.push(mathNode);
      currentX = mathX;
      currentY = mathY;
    }

    // Build lockup with precise relative measurements
    const { positionedWords, width: lockupWidth, height: lockupHeight } = buildLockup(line.words);
    
    // ----------------------------------------------------
    // THE ATOMIC CHOREO SHIM (Reading the Director's Script)
    // ----------------------------------------------------
    const choreo = getChoreoInstruction(line.text);
    
    // Determine structural turn based on Choreo Axis
    let turnDeg = 0;
    if (choreo) {
      if (choreo.axis === '→') turnDeg = 0; // go straight (relative)
      else if (choreo.axis === '↓') turnDeg = 90; 
      else if (choreo.axis === '←') turnDeg = 180;
      else if (choreo.axis === '↑') turnDeg = -90;
      else if (choreo.axis === '⊙' || choreo.axis === '↔') turnDeg = 0; // Hold or split
    } else {
      if (nodes.length > 0) {
        turnDeg = TURN_SEQUENCE[turnIdx % TURN_SEQUENCE.length];
        turnIdx++;
      }
    }

    const rawAngle = currentAngle + (turnDeg * Math.PI) / 180;
    let newAngle = Math.round(rawAngle / (Math.PI / 2)) * (Math.PI / 2);
    
    let exitX = currentX;
    let exitY = currentY;
    if (nodes.length > 0) {
      const prev = nodes[nodes.length - 1];
      const gap = turnDeg !== 0 ? 80 : 150;
      exitX = prev.x + Math.cos(currentAngle + Math.PI/2) * (prev.height / 2 + gap);
      exitY = prev.y + Math.sin(currentAngle + Math.PI/2) * (prev.height / 2 + gap);
    }
    
    let lineX = exitX + Math.cos(newAngle + Math.PI/2) * (lockupHeight / 2);
    let lineY = exitY + Math.sin(newAngle + Math.PI/2) * (lockupHeight / 2);

    // Apply specific spatial overrides for the Choreo script
    if (choreo) {
      if (choreo.axis === '⊙') {
        // Stack directly on top of the previous node in the timeline
        newAngle = currentAngle;
        lineX = currentX;
        lineY = currentY;
      }
      
      if (choreo.fx === '⚖️') {
        // The scale logic! If it's a split, pull left or right
        // We find the scale center in the past, or create one if we are the start
        let scaleCenter = null;
        for (let j = nodes.length - 1; j >= 0; j--) {
          if ((nodes[j] as any)._scaleCenter) {
            scaleCenter = (nodes[j] as any)._scaleCenter;
            break;
          }
        }
        
        const isLeft = line.text.toLowerCase().includes('left');
        const isSign = line.text.toLowerCase().includes('sign');
        const isRight = line.text.toLowerCase().includes('right');
        const isFine = line.text.toLowerCase().includes('fine');
        const isBalance = line.text.toLowerCase().includes('balance');
        const isScaleWord = line.text.toLowerCase().includes('scale');
        const isRule = line.text.toLowerCase().includes('rule');
        const isFail = line.text.toLowerCase().includes('fail');

        if (isLeft && !scaleCenter) {
          // Initialize a new scale arena
          newAngle = 0;
          currentAngle = 0;
          lineX = exitX - 550;
          lineY = exitY + 200;
          (line as any)._scaleCenter = { x: exitX, y: exitY + 200 };
        } else if (scaleCenter) {
          newAngle = 0;
          currentAngle = 0;
          if (isSign || (isLeft && scaleCenter)) { // 'left' in chorus 2
            lineX = scaleCenter.x - 550;
            lineY = scaleCenter.y;
          } else if (isRight || isFine) {
            lineX = scaleCenter.x + 550;
            lineY = scaleCenter.y;
          } else if (isBalance || isScaleWord) {
            // Centered squarely in the scale fulcrum arena
            lineX = scaleCenter.x;
            lineY = scaleCenter.y;
          } else if (isRule || isFail) {
            // Centered squarely in the scale fulcrum arena
            lineX = scaleCenter.x;
            lineY = scaleCenter.y;
          }
          (line as any)._scaleCenter = scaleCenter;
        }
      }
    }
    // ----------------------------------------------------

    // Stamp absolute, authoritative world coordinates onto every word in this real object
    for (const lw of positionedWords) {
      const cosA = Math.cos(newAngle);
      const sinA = Math.sin(newAngle);
      lw.worldX = lineX + lw.relX * cosA - lw.relY * sinA;
      lw.worldY = lineY + lw.relX * sinA + lw.relY * cosA;
    }

    const lyricNode: SceneNode = {
      id: nodeId,
      type: 'lyric',
      lineIndex: i,
      text: line.text,
      words: line.words,
      startTime: line.startTime,
      endTime: line.endTime,
      x: lineX,
      y: lineY,
      rotation: newAngle,
      width: lockupWidth,
      height: lockupHeight,
      positionedWords,
      fx: choreo?.fx,
      choreoZoom: choreo?.zoom,
      _scaleCenter: (line as any)._scaleCenter
    } as any;

    if (nodes.length > 0) {
      const prev = nodes[nodes.length - 1];
      edges.push({
        type: 'orthogonal_turn',
        fromNodeId: prev.id,
        toNodeId: nodeId,
        startX: prev.x + Math.cos(currentAngle + Math.PI/2) * (prev.height / 2),
        startY: prev.y + Math.sin(currentAngle + Math.PI/2) * (prev.height / 2),
        endX: lineX - Math.cos(newAngle + Math.PI/2) * (lockupHeight / 2),
        endY: lineY - Math.sin(newAngle + Math.PI/2) * (lockupHeight / 2),
        turnAngleDeg: turnDeg,
      });
    }

    nodes.push(lyricNode);
    currentX = lineX;
    currentY = lineY;
    currentAngle = newAngle;
  }

  // Any remaining math scenes instantiated at end of composition
  for (const scene of mathScenes) {
    if (!processedMathScenes.has(scene.id)) {
      processedMathScenes.add(scene.id);
      
      const mathWidth = 880;
      const mathHeight = 280;
      
      let exitX = currentX;
      let exitY = currentY;
      
      if (nodes.length > 0) {
        const prev = nodes[nodes.length - 1];
        exitX = prev.x + Math.cos(currentAngle + Math.PI/2) * (prev.height / 2 + 180);
        exitY = prev.y + Math.sin(currentAngle + Math.PI/2) * (prev.height / 2 + 180);
      }
      
      const mathX = exitX + Math.cos(currentAngle + Math.PI/2) * (mathHeight / 2);
      const mathY = exitY + Math.sin(currentAngle + Math.PI/2) * (mathHeight / 2);

      nodes.push({
        id: scene.id,
        type: 'math_scene',
        lineIndex: lines.length,
        text: scene.title,
        words: [],
        startTime: scene.startTime,
        endTime: scene.endTime,
        x: mathX,
        y: mathY,
        rotation: currentAngle,
        width: mathWidth,
        height: mathHeight,
        mathScene: scene,
      });
      currentX = mathX;
      currentY = mathY;
    }
  }

  // Compute total world bounds for the single real continuous score
  let minX = -600;
  let maxX = 600;
  let minY = -200;
  let maxY = 200;

  for (const node of nodes) {
    const cosA = Math.abs(Math.cos(node.rotation));
    const sinA = Math.abs(Math.sin(node.rotation));
    const bbWidth = node.width * cosA + node.height * sinA;
    const bbHeight = node.width * sinA + node.height * cosA;
    minX = Math.min(minX, node.x - bbWidth / 2);
    maxX = Math.max(maxX, node.x + bbWidth / 2);
    minY = Math.min(minY, node.y - bbHeight / 2);
    maxY = Math.max(maxY, node.y + bbHeight / 2);
  }


  const totalDuration = timedWords[timedWords.length - 1]?.end || 200;

  // Build Camera Keyframes
  const cameraKeyframes: import('./types.ts').CameraKeyframe[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const curr = nodes[i];
    let currZoom = curr.type === 'math_scene' ? 1.05 : 1.38;
    if (curr.choreoZoom) {
      if (curr.choreoZoom === '🔍') currZoom = 1.8;
      else if (curr.choreoZoom === '👁️') currZoom = 1.3;
      else if (curr.choreoZoom === '🌌') currZoom = 0.55; // Auto-fit arena (handled dynamically in renderer if we want, but base here)
    }
    
    // Add start keyframe for this node
    cameraKeyframes.push({
      time: curr.startTime,
      x: curr.x,
      y: curr.y,
      rotation: curr.rotation,
      zoom: currZoom,
      ease: 'hold' // Hold or slow drift during the node
    });

    if (i < nodes.length - 1) {
      const next = nodes[i + 1];
      let nextZoom = next.type === 'math_scene' ? 1.05 : 1.38;
      if (next.choreoZoom) {
        if (next.choreoZoom === '🔍') nextZoom = 1.8;
        else if (next.choreoZoom === '👁️') nextZoom = 1.3;
        else if (next.choreoZoom === '🌌') nextZoom = 0.55;
      }
      
      const gap = next.startTime - curr.endTime;
      const desiredTransDur = 0.45;
      const availableLeadTime = Math.min(desiredTransDur, (next.startTime - curr.startTime) * 0.35);
      const transDur = gap >= 0.4 ? 0.4 : Math.max(0.25, availableLeadTime);
      let transStart = next.startTime - transDur;
      if (transStart < curr.startTime + 0.3) {
        transStart = Math.max(curr.startTime + 0.1, next.startTime - 0.2);
      }
      if (transStart >= next.startTime) {
        transStart = next.startTime - 0.05;
      }

      // Add a keyframe right before we leave this node
      cameraKeyframes.push({
        time: transStart,
        x: curr.x,
        y: curr.y,
        rotation: curr.rotation,
        zoom: currZoom,
        ease: 'easeInOutCubic' // Transition to next node
      });
    } else {
      // Last node
      cameraKeyframes.push({
        time: curr.endTime,
        x: curr.x,
        y: curr.y,
        rotation: curr.rotation,
        zoom: currZoom,
        ease: 'hold'
      });
    }
  }

  // Precompute 1D Dot Spline
  const dotKeyframes: import('./types.ts').DotKeyframe[] = [];
  const allWords: Array<import('./types.ts').PositionedWord & { nodeRotation: number; nodeId: string }> = [];
  for (const n of nodes) {
    if (n.positionedWords) {
      for (const w of n.positionedWords) {
        if (!w.keyframes) {
          w.keyframes = generateWordKeyframes(w, w.start, w.end);
        }

        allWords.push({ ...w, nodeRotation: n.rotation, nodeId: n.id });
      }
    }
  }
  
  // Ensure strict chronological ordering before overlap resolution
  allWords.sort((a, b) => a.start - b.start);

  // Overlap resolution: latest-start-wins (truncate previous word if overlapping)
  for (let i = 0; i < allWords.length - 1; i++) {
    if (allWords[i].end > allWords[i + 1].start) {
      allWords[i].end = allWords[i + 1].start;
    }
  }

  for (let i = 0; i < allWords.length; i++) {
    const w = allWords[i];
    const prevW = i > 0 ? allWords[i - 1] : null;
    const nextW = i < allWords.length - 1 ? allWords[i + 1] : null;
    const isFirstInPhrase = !prevW || prevW.nodeId !== w.nodeId;
    const isLastInPhrase = !nextW || nextW.nodeId !== w.nodeId;

    const dur = Math.max(0.01, w.end - w.start);
    const numSyllables = countSyllables(w.text);
    const sliceDur = dur / numSyllables;
    
    const cosR = Math.cos(w.nodeRotation);
    const sinR = Math.sin(w.nodeRotation);
    const upX = Math.cos(w.nodeRotation - Math.PI / 2);
    const upY = Math.sin(w.nodeRotation - Math.PI / 2);
    
    const dotAnchorDist = w.height / 2 + 16;
    const wordLeftX = w.worldX! - (w.width / 2) * cosR;
    const wordLeftY = w.worldY! - (w.width / 2) * sinR;
    const anchorStartX = wordLeftX + upX * dotAnchorDist;
    const anchorStartY = wordLeftY + upY * dotAnchorDist;
    
    const stepX = (w.width * cosR) / numSyllables;
    const stepY = (w.width * sinR) / numSyllables;

    // 1. Phrase Entry: Dot enters from the left onto the first syllable
    if (isFirstInPhrase) {
      const enterDur = 0.28;
      const enterOffset = 70;
      dotKeyframes.push({
        startTime: Math.max(0, w.start - enterDur),
        endTime: w.start,
        startX: anchorStartX - enterOffset * cosR,
        startY: anchorStartY - enterOffset * sinR,
        endX: anchorStartX,
        endY: anchorStartY,
        type: 'enter_left',
        nodeRotation: w.nodeRotation
      });
    }

    // 2. Word Syllables: Bounce across from left to right
    for (let s = 0; s < numSyllables; s++) {
      dotKeyframes.push({
        startTime: w.start + s * sliceDur,
        endTime: w.start + (s + 1) * sliceDur,
        startX: anchorStartX + s * stepX,
        startY: anchorStartY + s * stepY,
        endX: anchorStartX + (s + 1) * stepX,
        endY: anchorStartY + (s + 1) * stepY,
        type: 'syllable',
        nodeRotation: w.nodeRotation
      });
    }

    const wordRightX = w.worldX! + (w.width / 2) * cosR;
    const wordRightY = w.worldY! + (w.width / 2) * sinR;
    const anchorWordEndX = wordRightX + upX * dotAnchorDist;
    const anchorWordEndY = wordRightY + upY * dotAnchorDist;

    // 3. Phrase Exit: Dot exits to the right after the final word of the phrase
    if (isLastInPhrase) {
      const exitDur = 0.28;
      const exitOffset = 70;
      const exitStart = w.end;
      const exitEnd = w.end + exitDur;
      dotKeyframes.push({
        startTime: exitStart,
        endTime: exitEnd,
        startX: anchorWordEndX,
        startY: anchorWordEndY,
        endX: anchorWordEndX + exitOffset * cosR,
        endY: anchorWordEndY + exitOffset * sinR,
        type: 'exit_right',
        nodeRotation: w.nodeRotation
      });

      // If next phrase exists, bridge the gap
      if (nextW) {
        const nextCosR = Math.cos(nextW.nodeRotation);
        const nextSinR = Math.sin(nextW.nodeRotation);
        const nextUpX = Math.cos(nextW.nodeRotation - Math.PI / 2);
        const nextUpY = Math.sin(nextW.nodeRotation - Math.PI / 2);
        const nextWordLeftX = nextW.worldX! - (nextW.width / 2) * nextCosR;
        const nextWordLeftY = nextW.worldY! - (nextW.width / 2) * nextSinR;
        const nextAnchorDist = nextW.height / 2 + 16;
        const nextTargetStartX = (nextWordLeftX + nextUpX * nextAnchorDist) - 70 * nextCosR;
        const nextTargetStartY = (nextWordLeftY + nextUpY * nextAnchorDist) - 70 * nextSinR;
        const nextEnterStart = Math.max(exitEnd, nextW.start - 0.28);

        const bridgeDur = nextEnterStart - exitEnd;
        if (bridgeDur > 0) {
          if (bridgeDur > 0.5) {
            dotKeyframes.push({
              startTime: exitEnd,
              endTime: nextEnterStart - 0.15,
              startX: anchorWordEndX + exitOffset * cosR,
              startY: anchorWordEndY + exitOffset * sinR,
              endX: anchorWordEndX + exitOffset * cosR,
              endY: anchorWordEndY + exitOffset * sinR,
              type: 'hold',
              nodeRotation: w.nodeRotation
            });
            dotKeyframes.push({
              startTime: nextEnterStart - 0.15,
              endTime: nextEnterStart,
              startX: anchorWordEndX + exitOffset * cosR,
              startY: anchorWordEndY + exitOffset * sinR,
              endX: nextTargetStartX,
              endY: nextTargetStartY,
              type: 'gap',
              nodeRotation: nextW.nodeRotation
            });
          } else {
            dotKeyframes.push({
              startTime: exitEnd,
              endTime: nextEnterStart,
              startX: anchorWordEndX + exitOffset * cosR,
              startY: anchorWordEndY + exitOffset * sinR,
              endX: nextTargetStartX,
              endY: nextTargetStartY,
              type: 'gap',
              nodeRotation: w.nodeRotation
            });
          }
        }
      }
    } else if (nextW) {
      // Intra-phrase gap between words in the same phrase
      const gapStart = w.end;
      const gapEnd = nextW.start;
      const gapDur = gapEnd - gapStart;
      
      const nextWordLeftX = nextW.worldX! - (nextW.width / 2) * cosR;
      const nextWordLeftY = nextW.worldY! - (nextW.width / 2) * sinR;
      const gapEndX = nextWordLeftX + upX * dotAnchorDist;
      const gapEndY = nextWordLeftY + upY * dotAnchorDist;
      
      if (gapDur > 0) {
        dotKeyframes.push({
          startTime: gapStart,
          endTime: gapEnd,
          startX: anchorWordEndX,
          startY: anchorWordEndY,
          endX: gapEndX,
          endY: gapEndY,
          type: 'gap',
          nodeRotation: w.nodeRotation
        });
      }
    }
  }

  return {
    nodes,
    edges,
    mathScenes,
        cameraKeyframes,
    dotKeyframes,
    bounds: {
      minX: isFinite(minX) ? minX : -500,
      maxX: isFinite(maxX) ? maxX : 500,
      minY: isFinite(minY) ? minY : -500,
      maxY: isFinite(maxY) ? maxY : 500,
      width: isFinite(maxX) && isFinite(minX) ? maxX - minX : 1000,
      height: isFinite(maxY) && isFinite(minY) ? maxY - minY : 1000,
    },
    totalDuration,
  };
}

export function sampleCamera(
  graph: LayoutGraph,
  currentTime: number,
  userZoomMultiplier: number
): { x: number, y: number, rotation: number, zoom: number } {
  const frames = graph.cameraKeyframes;
  if (!frames || frames.length === 0) {
    return { x: 0, y: 0, rotation: 0, zoom: 1 };
  }

  if (currentTime <= frames[0].time) {
    const f = frames[0];
    return { x: f.x, y: f.y, rotation: f.rotation, zoom: f.zoom * userZoomMultiplier };
  }
  if (currentTime >= frames[frames.length - 1].time) {
    const f = frames[frames.length - 1];
    return { x: f.x, y: f.y, rotation: f.rotation, zoom: f.zoom * userZoomMultiplier };
  }

  let idx = 0;
  while (idx < frames.length - 1 && frames[idx + 1].time <= currentTime) {
    idx++;
  }

  const f1 = frames[idx];
  const f2 = frames[idx + 1];

  if (f1.ease === 'hold') {
    return { x: f1.x, y: f1.y, rotation: f1.rotation, zoom: f1.zoom * userZoomMultiplier };
  }

  const duration = f2.time - f1.time;
  if (duration <= 0) {
    return { x: f2.x, y: f2.y, rotation: f2.rotation, zoom: f2.zoom * userZoomMultiplier };
  }

  const progress = (currentTime - f1.time) / duration;
  
  let ease = progress;
  if (f1.ease === 'easeInOutCubic') {
    ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
  }

  let diffRot = f2.rotation - f1.rotation;
  while (diffRot > Math.PI) diffRot -= Math.PI * 2;
  while (diffRot < -Math.PI) diffRot += Math.PI * 2;

  return {
    x: f1.x + (f2.x - f1.x) * ease,
    y: f1.y + (f2.y - f1.y) * ease,
    rotation: f1.rotation + diffRot * ease,
    zoom: (f1.zoom + (f2.zoom - f1.zoom) * ease) * userZoomMultiplier
  };
}
