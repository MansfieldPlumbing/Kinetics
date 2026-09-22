import { SymbolicMathScene } from './mathCompiler.ts';


export interface TimelineWord {
  globalIndex: number;
  segmentIndex: number;
  text: string;
  startTime: number;
  endTime: number;
}

export interface SyllableEvent {
  globalIndex: number;
  segmentIndex: number;
  segmentSyllableIndex: number;
  segmentSyllableCount: number;
  wordIndex: number;
  startTime: number;
  endTime: number;
}



export interface TimedWord {
  text: string;
  start: number;
  end: number;
}

export type InteropType =
  | 'intersecting_glyph_pivot'
  | 'orthogonal_turn'
  | 'causal_branch'
  | 'disjoint_translation'
  | 'algebraic_bridge';

export interface InteropEdge {
  type: InteropType;
  fromNodeId: string;
  toNodeId: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  turnAngleDeg: number;
  pivotChar?: string;
  pivotWordIndex?: number;
  pivotCharIndex?: number;
  label?: string;
}


export interface FloatKeyframe {
  time: number;
  value: number;
  ease: 'linear' | 'hold' | 'easeInOutCubic' | 'easeOutQuad';
}

export interface ColorKeyframe {
  time: number;
  value: string; // e.g., 'primary', 'secondary', 'past', 'active'
  ease: 'hold';
}

export interface NodeKeyframes {
  opacity: FloatKeyframe[];
  scale: FloatKeyframe[];
}

export interface WordKeyframes {
  opacity: FloatKeyframe[];
  scale: FloatKeyframe[];
  colorMode: ColorKeyframe[];
}

export interface PositionedWord {
  text: string;
  start: number;
  end: number;
  relX: number;
  relY: number;
  worldX?: number;
  worldY?: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  isItalic?: boolean;
  isAllCap?: boolean;
  isEmphasis?: boolean;
  width: number;
  height: number;
  keyframes?: WordKeyframes;
  fontString: string;
  fontEmphasisString: string;
}

export type ProjectionViewMode = 'presentation' | 'math' | 'karaoke' | 'debug_overlay' | 'global_orthographic';

export interface SceneNode {
  id: string;
  type: 'lyric' | 'math_scene';
  lineIndex: number;
  text: string;
  words: TimedWord[];
  startTime: number;
  endTime: number;
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
  positionedWords?: PositionedWord[];
  interop?: InteropEdge;
  mathScene?: SymbolicMathScene;
  keyframes?: NodeKeyframes;
  fx?: 'none' | '⚖️' | '🐍' | '🧮';
  choreoZoom?: '🔍' | '👁️' | '🌌';
}


export interface CameraKeyframe {
  time: number;
  x: number;
  y: number;
  rotation: number;
  zoom: number;
  ease: 'hold' | 'linear' | 'easeInOutCubic';
}


export interface DotKeyframe {
  startTime: number;
  endTime: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  type: 'syllable' | 'gap' | 'hold' | 'enter_left' | 'exit_right';
  nodeRotation: number;
}

export interface LayoutGraph {
    dotKeyframes: DotKeyframe[];
  nodes: SceneNode[];
  edges: InteropEdge[];
  mathScenes: SymbolicMathScene[];
  cameraKeyframes: CameraKeyframe[];
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
  };
  totalDuration: number;
}

export interface CameraState {
  x: number;
  y: number;
  rotation: number;
  zoom: number;
  targetX: number;
  targetY: number;
  targetRotation: number;
  targetZoom: number;
  shakeIntensity: number;
  shakeDuration: number;
  shakeTimer: number;
}

export type ColorTheme = 'dark_mode' | 'light_mode';

export interface ThemeColors {
  background: string;
  vignetteInner: string;
  vignetteOuter: string;
  activeWordText: string;
  activeWordBg?: string;
  spokenWordText: string;
  unspokenWordText: string;
  pastBlockText: string;
  edgeGuideline: string;
  mathAccent: string;
  scaleBeam: string;
  ruleStroke: string;
  varXColor?: string;
  varYColor?: string;
}
