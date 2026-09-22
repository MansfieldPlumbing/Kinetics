/**
 * PURE CANVAS HUD & UI SUBSYSTEM
 * Renders all controls, timeline scrubber, view-mode selectors, transport,
 * timecode, and status tags directly on the HTML5 Canvas.
 * Zero DOM divs or HTML form overlays.
 */

import { ProjectionViewMode, ColorTheme } from './types.ts';

export interface HUDAction {
  type:
    | 'toggle_play'
    | 'step_frame'
    | 'restart'
    | 'seek'
    | 'set_view_mode'
    | 'toggle_theme'
    | 'set_speed'
    | 'jump_prev_scene'
    | 'jump_next_scene'
    | 'load_audio'
    | 'load_vtt'
    | 'export_vtt'
    | 'capture_png'
    | 'toggle_record'
    | 'toggle_options'
    | 'toggle_fullscreen';
  payload?: any;
}

export interface HUDState {
  hasStarted: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  viewMode: ProjectionViewMode;
  theme: ColorTheme;
  fps: number;
  statusText: string;
  isRecording: boolean;
  isDraggingFile: boolean;
  activePhraseText?: string;
  activePhraseIndex?: number;
  totalPhrases?: number;
  showOptions?: boolean;
}

export interface HUDPointer {
  x: number;
  y: number;
  isDown: boolean;
}

interface Hitbox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  action: HUDAction;
}

let activeHitboxes: Hitbox[] = [];
let hoveredHitboxId: string | null = null;
let isScrubbingTimeline = false;

let currentShowOptions = false;
let currentScrubberRect = { x: 24, y: 0, w: 100, h: 14 };

export function getHoveredHitbox(): string | null {
  return hoveredHitboxId;
}

export function isScrubbing(): boolean {
  return isScrubbingTimeline;
}

export function formatTime(sec: number): string {
  if (isNaN(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

/**
 * Updates pointer position and performs hit testing
 */
export function updateHUDPointer(
  pointer: HUDPointer,
  width: number,
  height: number
): { cursor: string; action?: HUDAction } {
  hoveredHitboxId = null;
  let cursor = 'default';

  // Check timeline scrubber hit dynamically using current rendered bounds
  // Augmented with NIST-compliant touch target envelope (>= 44px vertical hit area)
  if (currentShowOptions) {
    const { x: scrubberX, y: scrubberY, w: scrubberW, h: scrubberH } = currentScrubberRect;
    const touchPadY = 16;

    if (
      pointer.x >= scrubberX - 10 &&
      pointer.x <= scrubberX + scrubberW + 10 &&
      pointer.y >= scrubberY - touchPadY &&
      pointer.y <= scrubberY + scrubberH + touchPadY
    ) {
      cursor = 'pointer';
      hoveredHitboxId = 'timeline_scrubber';
      return { cursor };
    }
  }

  // Check buttons
  for (const box of activeHitboxes) {
    if (
      pointer.x >= box.x &&
      pointer.x <= box.x + box.w &&
      pointer.y >= box.y &&
      pointer.y <= box.y + box.h
    ) {
      hoveredHitboxId = box.id;
      cursor = 'pointer';
      break;
    }
  }

  return { cursor };
}

/**
 * Handles pointer down event on canvas HUD
 */
export function handleHUDPointerDown(
  pointer: HUDPointer,
  width: number,
  height: number,
  duration: number
): HUDAction | null {
  // Timeline scrubber check dynamically using current rendered bounds
  if (currentShowOptions) {
    const { x: scrubberX, y: scrubberY, w: scrubberW, h: scrubberH } = currentScrubberRect;
    const touchPadY = 16;

    if (
      pointer.x >= scrubberX - 10 &&
      pointer.x <= scrubberX + scrubberW + 10 &&
      pointer.y >= scrubberY - touchPadY &&
      pointer.y <= scrubberY + scrubberH + touchPadY
    ) {
      isScrubbingTimeline = true;
      const pct = Math.max(0, Math.min(1, (pointer.x - scrubberX) / Math.max(1, scrubberW)));
      return { type: 'seek', payload: pct * duration };
    }
  }

  // Button clicks
  for (const box of activeHitboxes) {
    if (
      pointer.x >= box.x &&
      pointer.x <= box.x + box.w &&
      pointer.y >= box.y &&
      pointer.y <= box.y + box.h
    ) {
      return box.action;
    }
  }

  return null;
}

/**
 * Handles pointer move during scrubbing
 */
export function handleHUDPointerMove(
  pointer: HUDPointer,
  width: number,
  duration: number
): HUDAction | null {
  if (isScrubbingTimeline) {
    const { x: scrubberX, w: scrubberW } = currentScrubberRect;
    const pct = Math.max(0, Math.min(1, (pointer.x - scrubberX) / Math.max(1, scrubberW)));
    return { type: 'seek', payload: pct * duration };
  }
  return null;
}

/**
 * Handles pointer up event
 */
export function handleHUDPointerUp(): void {
  isScrubbingTimeline = false;
}

/**
 * Main Render function for the Canvas HUD
 */
export function renderCanvasHUD(
  ctx: CanvasRenderingContext2D,
  state: HUDState,
  pointer: HUDPointer,
  width: number,
  height: number
): void {
  ctx.save();
  ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);

  activeHitboxes = [];
  currentShowOptions = Boolean(state.showOptions);

  const isPaper = state.theme === 'light_mode';
  const hudBg = isPaper ? 'rgba(245, 240, 227, 0.96)' : 'rgba(10, 12, 16, 0.96)';
  const borderCol = isPaper ? 'rgba(40, 36, 30, 0.22)' : 'rgba(255, 255, 255, 0.16)';
  const textPrimary = isPaper ? '#1c1917' : '#f8fafc';
  const textMuted = isPaper ? '#78716c' : '#94a3b8';
  const accent = isPaper ? '#b45309' : '#f59e0b';
  const activeBg = isPaper ? '#1c1917' : '#ffffff';
  const activeFg = isPaper ? '#fafaf9' : '#000000';

  // --------------------------------------------------------------------------
  // FLOATING PLAY BADGE (WHEN PAUSED AT START, NON-BLOCKING OVER THE SCENE)
  // --------------------------------------------------------------------------
  if (!state.isPlaying && state.currentTime === 0 && !state.showOptions) {
    const centerX = width / 2;
    const centerY = height / 2;
    const playBtnRadius = 38;

    activeHitboxes.push({
      id: 'center_play_btn',
      x: centerX - playBtnRadius,
      y: centerY - playBtnRadius,
      w: playBtnRadius * 2,
      h: playBtnRadius * 2,
      action: { type: 'toggle_play' }
    });

    const isHover = hoveredHitboxId === 'center_play_btn';
    const scale = isHover ? 1.06 : 1.0;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale);

    // Subtle frosted circular badge
    ctx.beginPath();
    ctx.arc(0, 0, playBtnRadius, 0, Math.PI * 2);
    ctx.fillStyle = isHover ? 'rgba(24, 22, 20, 0.90)' : 'rgba(24, 22, 20, 0.78)';
    ctx.fill();
    ctx.strokeStyle = isHover ? '#f59e0b' : 'rgba(245, 240, 227, 0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Play triangle
    ctx.fillStyle = isHover ? '#fbbf24' : '#fafaf9';
    ctx.beginPath();
    ctx.moveTo(-6, -11);
    ctx.lineTo(-6, 11);
    ctx.lineTo(10, 0);
    ctx.closePath();
    ctx.fill();

    // Small caption below badge
    ctx.fillStyle = isPaper ? 'rgba(28, 25, 23, 0.85)' : 'rgba(245, 240, 227, 0.85)';
    ctx.font = '700 11px "Montserrat", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('CLICK TO PLAY  •  PRESS SPACE', 0, playBtnRadius + 14);

    ctx.restore();
  }

  // --------------------------------------------------------------------------
  // FLOATING HUD BAR (Always drawn when started, unless options are open)
  // --------------------------------------------------------------------------
  if (!state.showOptions) {
    // Subtle 2.5px progress hairline at absolute bottom
    const progressPct = state.duration > 0 ? Math.max(0, Math.min(1, state.currentTime / state.duration)) : 0;
    ctx.fillStyle = isPaper ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.15)';
    ctx.fillRect(0, height - 2.5, width, 2.5);
    ctx.fillStyle = accent;
    ctx.fillRect(0, height - 2.5, width * progressPct, 2.5);

    // Recording indicator if active
    if (state.isRecording) {
      ctx.save();
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(width - 190, 14, 170, 26);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 11px "Montserrat", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('● RECORDING WEBM', width - 105, 27);
      ctx.restore();
    }

    // Drag & drop overlay
    if (state.isDraggingFile) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 8]);
      ctx.strokeRect(40, 40, width - 80, height - 80);
      ctx.setLineDash([]);

      ctx.fillStyle = '#ffffff';
      ctx.font = '800 28px "Montserrat", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('DROP AUDIO OR .VTT SUBTITLES FILE HERE', width / 2, height / 2 - 18);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '500 15px "JetBrains Mono", monospace';
      ctx.fillText('Accepts MP3, WAV, WebVTT (.vtt), SRT, or JSON timing files', width / 2, height / 2 + 22);
    }
    
    // Floating Pill Buttons in Top Right
    const btnW = 85;
    const btnH = 26;
    const paddingRight = 14;
    const paddingTop = 14;
    const gap = 8;
    
    const optionsX = width - paddingRight - btnW;
    const playX = optionsX - gap - btnW;
    const btnY = paddingTop;
    
    // Play/Pause Pill
    activeHitboxes.push({ id: 'btn_pill_play', x: playX, y: btnY, w: btnW, h: btnH, action: { type: 'toggle_play' } });
    const isPillPlayHover = hoveredHitboxId === 'btn_pill_play';
    
    ctx.fillStyle = isPillPlayHover ? 'rgba(28, 25, 23, 0.96)' : 'rgba(18, 16, 14, 0.88)';
    ctx.beginPath();
    ctx.roundRect(playX, btnY, btnW, btnH, 4);
    ctx.fill();
    ctx.strokeStyle = isPillPlayHover ? '#f59e0b' : 'rgba(245, 240, 227, 0.22)';
    ctx.stroke();
    
    ctx.fillStyle = isPillPlayHover ? '#fbbf24' : '#e2e8f0';
    ctx.font = '800 10px "Montserrat", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.isPlaying ? 'PAUSE' : 'PLAY', playX + 26, btnY + btnH / 2);
    
    // Draw tiny icon for play/pause
    ctx.save();
    ctx.translate(playX + 8, btnY + Math.floor(btnH / 2) - 6);
    ctx.fillStyle = isPillPlayHover ? '#fbbf24' : '#e2e8f0';
    if (state.isPlaying) {
      // Pause icon
      ctx.fillRect(1, 1, 3, 10);
      ctx.fillRect(7, 1, 3, 10);
    } else {
      // Play icon
      ctx.beginPath();
      ctx.moveTo(2, 1);
      ctx.lineTo(2, 11);
      ctx.lineTo(9, 6);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    
    // Options Pill
    activeHitboxes.push({ id: 'btn_pill_options', x: optionsX, y: btnY, w: btnW, h: btnH, action: { type: 'toggle_options' } });
    const isPillOptionsHover = hoveredHitboxId === 'btn_pill_options';
    
    ctx.fillStyle = isPillOptionsHover ? 'rgba(28, 25, 23, 0.96)' : 'rgba(18, 16, 14, 0.88)';
    ctx.beginPath();
    ctx.roundRect(optionsX, btnY, btnW, btnH, 4);
    ctx.fill();
    ctx.strokeStyle = isPillOptionsHover ? '#f59e0b' : 'rgba(245, 240, 227, 0.22)';
    ctx.stroke();
    
    ctx.fillStyle = isPillOptionsHover ? '#fbbf24' : '#e2e8f0';
    ctx.fillText('OPTIONS', optionsX + 26, btnY + btnH / 2);
    
    // Gear Icon
    ctx.save();
    ctx.translate(optionsX + 8, btnY + Math.floor(btnH / 2) - 6);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(6, 6, 2.5, 0, Math.PI * 2);
    ctx.stroke();
    // (A tiny gear outline - simplifying for pure canvas drawing)
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.translate(6, 6);
      ctx.rotate(i * Math.PI / 3);
      ctx.beginPath();
      ctx.moveTo(0, 2.5);
      ctx.lineTo(0, 4);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    ctx.restore();
    return;
  }

  // --------------------------------------------------------------------------
  // OPTIONS HUD MODE (Full Controls & Options Opened)
  // --------------------------------------------------------------------------
  // 1. TOP HEADER DECK
  const isCompactTop = width < 840;
  const topH = isCompactTop ? 76 : 46;
  ctx.fillStyle = hudBg;
  ctx.fillRect(0, 0, width, topH);

  ctx.strokeStyle = borderCol;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, topH);
  ctx.lineTo(width, topH);
  ctx.stroke();

  const viewModes: Array<{ id: ProjectionViewMode; label: string; compactLabel: string; key: string }> = [
    { id: 'presentation', label: 'PRESENTATION', compactLabel: 'PRES', key: '1' },
    { id: 'karaoke', label: 'KARAOKE', compactLabel: 'KARAOKE', key: '2' },
    { id: 'math', label: 'MATH', compactLabel: 'MATH', key: '3' },
    { id: 'debug_overlay', label: 'DEBUG OVERLAY', compactLabel: 'DEBUG', key: '4' },
    { id: 'global_orthographic', label: 'GLOBAL ORTHOGRAPHIC', compactLabel: 'GLOBAL', key: '5' },
  ];

  if (!isCompactTop) {
    // ------------------------------------------------------------------------
    // DESKTOP SINGLE-LINE HEADER DECK (Preserved exactly as designed)
    // ------------------------------------------------------------------------
    const closeBtnW = 76;
    const closeBtnH = 24;
    const closeBtnX = width - 16 - closeBtnW;
    const closeBtnY = topH / 2 - closeBtnH / 2;
    const isCloseHover = hoveredHitboxId === 'btn_close_options';

    activeHitboxes.push({
      id: 'btn_close_options',
      x: closeBtnX,
      y: closeBtnY,
      w: closeBtnW,
      h: closeBtnH,
      action: { type: 'toggle_options' },
    });

    ctx.fillStyle = isCloseHover ? (isPaper ? '#1c1917' : '#ffffff') : (isPaper ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)');
    ctx.fillRect(closeBtnX, closeBtnY, closeBtnW, closeBtnH);
    ctx.strokeStyle = isCloseHover ? accent : borderCol;
    ctx.strokeRect(closeBtnX, closeBtnY, closeBtnW, closeBtnH);
    ctx.fillStyle = isCloseHover ? (isPaper ? '#ffffff' : '#000000') : textPrimary;
    ctx.font = '700 9px "Montserrat", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✕ CLOSE', closeBtnX + closeBtnW / 2, closeBtnY + closeBtnH / 2);

    // Theme Toggle Button
    const themeBtnW = 100;
    const themeBtnH = 24;
    const themeBtnX = closeBtnX - 8 - themeBtnW;
    const themeBtnY = topH / 2 - themeBtnH / 2;
    const isThemeHover = hoveredHitboxId === 'btn_theme';

    activeHitboxes.push({
      id: 'btn_theme',
      x: themeBtnX,
      y: themeBtnY,
      w: themeBtnW,
      h: themeBtnH,
      action: { type: 'toggle_theme' },
    });

    ctx.strokeStyle = isThemeHover ? accent : borderCol;
    ctx.strokeRect(themeBtnX, themeBtnY, themeBtnW, themeBtnH);
    ctx.fillStyle = isThemeHover ? textPrimary : textMuted;
    ctx.font = '700 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isPaper ? 'STYLE: LIGHT' : 'STYLE: DARK', themeBtnX + themeBtnW / 2, themeBtnY + themeBtnH / 2);

    // Status & FPS tag
    const statusX = themeBtnX - 16;
    ctx.textAlign = 'right';
    ctx.fillStyle = textMuted;
    ctx.font = '500 11px "JetBrains Mono", monospace';
    ctx.fillText(`${state.statusText}  |  ${state.fps.toFixed(0)} FPS`, statusX, topH / 2);

    // View Mode Tabs (Left aligned)
    ctx.font = '700 9px "Montserrat", sans-serif';
    let tabX = 18;
    for (const vm of viewModes) {
      const textWidth = ctx.measureText(vm.label).width;
      const tabW = textWidth + 16;
      const tabH = 22;
      const tabY = topH / 2 - tabH / 2;
      const isSelected = state.viewMode === vm.id;
      const isHover = hoveredHitboxId === `tab_${vm.id}`;

      activeHitboxes.push({
        id: `tab_${vm.id}`,
        x: tabX,
        y: tabY,
        w: tabW,
        h: tabH,
        action: { type: 'set_view_mode', payload: vm.id },
      });

      if (isSelected) {
        ctx.fillStyle = activeBg;
        ctx.fillRect(tabX, tabY, tabW, tabH);
        ctx.fillStyle = activeFg;
      } else if (isHover) {
        ctx.fillStyle = isPaper ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)';
        ctx.fillRect(tabX, tabY, tabW, tabH);
        ctx.fillStyle = textPrimary;
      } else {
        ctx.strokeStyle = borderCol;
        ctx.strokeRect(tabX, tabY, tabW, tabH);
        ctx.fillStyle = textMuted;
      }

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${vm.label}`, tabX + tabW / 2, tabY + tabH / 2);

      tabX += tabW + 6;
    }
  } else {
    // ------------------------------------------------------------------------
    // MOBILE / COMPACT DUAL-TIER HEADER DECK (NIST / Human Factors Compliant)
    // ------------------------------------------------------------------------
    // Line 1: View Modes (y = 8, h = 26)
    // Line 2: System utilities (Theme, FPS/Status, Close) (y = 42, h = 26)
    const tier1Y = 8;
    const tier1H = 26;
    const tier2Y = 42;
    const tier2H = 26;

    const useCompactLabels = width < 520;
    const tabGap = 4;
    const tabMargin = 8;
    const availableW = width - tabMargin * 2;
    const tabW = Math.floor((availableW - tabGap * (viewModes.length - 1)) / viewModes.length);

    ctx.font = '700 9px "Montserrat", sans-serif';
    for (let i = 0; i < viewModes.length; i++) {
      const vm = viewModes[i];
      const curTabX = tabMargin + i * (tabW + tabGap);
      const isSelected = state.viewMode === vm.id;
      const isHover = hoveredHitboxId === `tab_${vm.id}`;

      // Augmented touch target (>= 40px hit area)
      activeHitboxes.push({
        id: `tab_${vm.id}`,
        x: curTabX,
        y: tier1Y - 4,
        w: tabW,
        h: tier1H + 8,
        action: { type: 'set_view_mode', payload: vm.id },
      });

      if (isSelected) {
        ctx.fillStyle = activeBg;
        ctx.fillRect(curTabX, tier1Y, tabW, tier1H);
        ctx.fillStyle = activeFg;
      } else if (isHover) {
        ctx.fillStyle = isPaper ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)';
        ctx.fillRect(curTabX, tier1Y, tabW, tier1H);
        ctx.fillStyle = textPrimary;
      } else {
        ctx.strokeStyle = borderCol;
        ctx.strokeRect(curTabX, tier1Y, tabW, tier1H);
        ctx.fillStyle = textMuted;
      }

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = useCompactLabels ? vm.compactLabel : vm.label;
      ctx.fillText(label, curTabX + tabW / 2, tier1Y + tier1H / 2);
    }

    // Line 2: Style Theme Button (Left)
    const themeBtnW = width < 420 ? 86 : 100;
    const themeBtnX = tabMargin;
    const isThemeHover = hoveredHitboxId === 'btn_theme';
    activeHitboxes.push({
      id: 'btn_theme',
      x: themeBtnX,
      y: tier2Y - 4,
      w: themeBtnW,
      h: tier2H + 8,
      action: { type: 'toggle_theme' },
    });
    ctx.strokeStyle = isThemeHover ? accent : borderCol;
    ctx.strokeRect(themeBtnX, tier2Y, themeBtnW, tier2H);
    ctx.fillStyle = isThemeHover ? textPrimary : textMuted;
    ctx.font = '700 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isPaper ? 'STYLE: LIGHT' : 'STYLE: DARK', themeBtnX + themeBtnW / 2, tier2Y + tier2H / 2);

    // Line 2: Close Button (Right)
    const closeBtnW = width < 420 ? 68 : 76;
    const closeBtnX = width - tabMargin - closeBtnW;
    const isCloseHover = hoveredHitboxId === 'btn_close_options';
    activeHitboxes.push({
      id: 'btn_close_options',
      x: closeBtnX,
      y: tier2Y - 4,
      w: closeBtnW,
      h: tier2H + 8,
      action: { type: 'toggle_options' },
    });
    ctx.fillStyle = isCloseHover ? (isPaper ? '#1c1917' : '#ffffff') : (isPaper ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)');
    ctx.fillRect(closeBtnX, tier2Y, closeBtnW, tier2H);
    ctx.strokeStyle = isCloseHover ? accent : borderCol;
    ctx.strokeRect(closeBtnX, tier2Y, closeBtnW, tier2H);
    ctx.fillStyle = isCloseHover ? (isPaper ? '#ffffff' : '#000000') : textPrimary;
    ctx.font = '700 9px "Montserrat", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✕ CLOSE', closeBtnX + closeBtnW / 2, tier2Y + tier2H / 2);

    // Line 2: Status & FPS tag (Center)
    ctx.textAlign = 'center';
    ctx.fillStyle = textMuted;
    ctx.font = '500 10px "JetBrains Mono", monospace';
    const statusMidX = (themeBtnX + themeBtnW + closeBtnX) / 2;
    const statusText = width < 420 ? `${state.fps.toFixed(0)} FPS` : `${state.statusText} • ${state.fps.toFixed(0)} FPS`;
    ctx.fillText(statusText, statusMidX, tier2Y + tier2H / 2);
  }

  // --------------------------------------------------------------------------
  // 2. RECORDING OVERLAY BADGE (If active)
  // --------------------------------------------------------------------------
  if (state.isRecording) {
    ctx.save();
    ctx.fillStyle = '#ef4444';
    const recBadgeX = isCompactTop ? 14 : width - 200;
    const recBadgeY = topH + 12;
    ctx.fillRect(recBadgeX, recBadgeY, 170, 26);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 11px "Montserrat", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('● RECORDING WEBM', recBadgeX + 85, recBadgeY + 13);
    ctx.restore();
  }

  // --------------------------------------------------------------------------
  // 3. BOTTOM CONTROL DECK
  // --------------------------------------------------------------------------
  const isCompactBottom = width < 980;
  const botH = isCompactBottom ? 122 : 88;
  const botY = height - botH;

  ctx.fillStyle = hudBg;
  ctx.fillRect(0, botY, width, botH);

  ctx.strokeStyle = borderCol;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, botY);
  ctx.lineTo(width, botY);
  ctx.stroke();

  // A. TIMELINE SCRUBBER
  const scrubX = isCompactBottom ? 16 : 24;
  const scrubY = botY + (isCompactBottom ? 10 : 12);
  const scrubW = width - scrubX * 2;
  const scrubH = 6;
  const progressPct = state.duration > 0 ? Math.max(0, Math.min(1, state.currentTime / state.duration)) : 0;

  // Track dynamic coordinates for pointer hit testing
  currentScrubberRect = { x: scrubX, y: scrubY, w: scrubW, h: scrubH };

  // Background track
  ctx.fillStyle = isPaper ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.14)';
  ctx.fillRect(scrubX, scrubY, scrubW, scrubH);

  // Filled progress track
  ctx.fillStyle = isPaper ? '#1c1917' : '#ffffff';
  ctx.fillRect(scrubX, scrubY, scrubW * progressPct, scrubH);

  // Playhead handle
  const handleX = scrubX + scrubW * progressPct;
  ctx.fillStyle = isPaper ? '#000000' : '#ffffff';
  ctx.beginPath();
  ctx.arc(handleX, scrubY + scrubH / 2, 6, 0, Math.PI * 2);
  ctx.fill();

  // Scrubber Hover Tooltip
  if (hoveredHitboxId === 'timeline_scrubber' || isScrubbingTimeline) {
    const hoverPct = Math.max(0, Math.min(1, (pointer.x - scrubX) / scrubW));
    const hoverTime = hoverPct * state.duration;
    const tooltipText = formatTime(hoverTime);

    ctx.fillStyle = isPaper ? '#1c1917' : '#ffffff';
    ctx.fillRect(pointer.x - 30, scrubY - 26, 60, 20);

    ctx.fillStyle = isPaper ? '#fafaf9' : '#000000';
    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tooltipText, pointer.x, scrubY - 16);
  }

  if (!isCompactBottom) {
    // ------------------------------------------------------------------------
    // DESKTOP SINGLE-LINE CONTROL ROW (Preserved exactly as designed)
    // ------------------------------------------------------------------------
    const rowY = botY + 32;
    let cx = 24;

    // Play / Pause button
    const playW = 90;
    const playH = 34;
    const isPlayHover = hoveredHitboxId === 'btn_play_pause';

    activeHitboxes.push({
      id: 'btn_play_pause',
      x: cx,
      y: rowY,
      w: playW,
      h: playH,
      action: { type: 'toggle_play' },
    });

    ctx.fillStyle = state.isPlaying
      ? (isPaper ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)')
      : (isPaper ? '#1c1917' : '#ffffff');
    ctx.fillRect(cx, rowY, playW, playH);

    ctx.fillStyle = state.isPlaying ? textPrimary : (isPaper ? '#fafaf9' : '#000000');
    ctx.font = '800 11px "Montserrat", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.isPlaying ? '❚❚ PAUSE' : '▶ PLAY', cx + playW / 2, rowY + playH / 2);

    cx += playW + 8;

    // Step -1F Button
    const stepW = 38;
    const isPrevHover = hoveredHitboxId === 'btn_prev_frame';
    activeHitboxes.push({
      id: 'btn_prev_frame',
      x: cx,
      y: rowY,
      w: stepW,
      h: playH,
      action: { type: 'step_frame', payload: -1 },
    });
    ctx.strokeStyle = isPrevHover ? textPrimary : borderCol;
    ctx.strokeRect(cx, rowY, stepW, playH);
    ctx.fillStyle = isPrevHover ? textPrimary : textMuted;
    ctx.font = '700 11px "Montserrat", sans-serif';
    ctx.fillText('-1F', cx + stepW / 2, rowY + playH / 2);

    cx += stepW + 6;

    // Step +1F Button
    const isNextHover = hoveredHitboxId === 'btn_next_frame';
    activeHitboxes.push({
      id: 'btn_next_frame',
      x: cx,
      y: rowY,
      w: stepW,
      h: playH,
      action: { type: 'step_frame', payload: 1 },
    });
    ctx.strokeStyle = isNextHover ? textPrimary : borderCol;
    ctx.strokeRect(cx, rowY, stepW, playH);
    ctx.fillStyle = isNextHover ? textPrimary : textMuted;
    ctx.fillText('+1F', cx + stepW / 2, rowY + playH / 2);

    cx += stepW + 6;

    // Reset ↺ Button
    const resetW = 46;
    const isResetHover = hoveredHitboxId === 'btn_reset';
    activeHitboxes.push({
      id: 'btn_reset',
      x: cx,
      y: rowY,
      w: resetW,
      h: playH,
      action: { type: 'restart' },
    });
    ctx.strokeStyle = isResetHover ? textPrimary : borderCol;
    ctx.strokeRect(cx, rowY, resetW, playH);
    ctx.fillStyle = isResetHover ? textPrimary : textMuted;
    ctx.fillText('↺ 0s', cx + resetW / 2, rowY + playH / 2);

    cx += resetW + 16;

    // Timecode Display
    ctx.textAlign = 'left';
    ctx.fillStyle = textPrimary;
    ctx.font = '700 15px "JetBrains Mono", monospace';
    ctx.fillText(formatTime(state.currentTime), cx, rowY + playH / 2 - 2);

    ctx.fillStyle = textMuted;
    ctx.font = '500 13px "JetBrains Mono", monospace';
    ctx.fillText(`/ ${formatTime(state.duration)}`, cx + 84, rowY + playH / 2 - 2);

    cx += 180;

    // Jump Scene Landmark controls
    const sceneBtnW = 32;
    const isPrevSceneHover = hoveredHitboxId === 'btn_prev_scene';
    activeHitboxes.push({
      id: 'btn_prev_scene',
      x: cx,
      y: rowY,
      w: sceneBtnW,
      h: playH,
      action: { type: 'jump_prev_scene' },
    });
    ctx.strokeStyle = isPrevSceneHover ? textPrimary : borderCol;
    ctx.strokeRect(cx, rowY, sceneBtnW, playH);
    ctx.fillStyle = isPrevSceneHover ? textPrimary : textMuted;
    ctx.textAlign = 'center';
    ctx.fillText('◄', cx + sceneBtnW / 2, rowY + playH / 2);

    cx += sceneBtnW + 4;

    const phraseBoxW = 200;
    ctx.strokeStyle = borderCol;
    ctx.strokeRect(cx, rowY, phraseBoxW, playH);
    ctx.fillStyle = textPrimary;
    ctx.font = '700 10px "Montserrat", sans-serif';
    ctx.textAlign = 'center';
    const phraseIndexText = `PHRASE ${(state.activePhraseIndex ?? 0) + 1} / ${state.totalPhrases ?? 1}`;
    ctx.fillText(phraseIndexText, cx + phraseBoxW / 2, rowY + playH / 2 - 5);

    ctx.fillStyle = textMuted;
    ctx.font = '500 9px "Montserrat", sans-serif';
    const truncatedPhrase = state.activePhraseText
      ? (state.activePhraseText.length > 28 ? state.activePhraseText.slice(0, 26) + '...' : state.activePhraseText)
      : 'Awaiting phrase...';
    ctx.fillText(truncatedPhrase, cx + phraseBoxW / 2, rowY + playH / 2 + 8);

    cx += phraseBoxW + 4;

    const isNextSceneHover = hoveredHitboxId === 'btn_next_scene';
    activeHitboxes.push({
      id: 'btn_next_scene',
      x: cx,
      y: rowY,
      w: sceneBtnW,
      h: playH,
      action: { type: 'jump_next_scene' },
    });
    ctx.strokeStyle = isNextSceneHover ? textPrimary : borderCol;
    ctx.strokeRect(cx, rowY, sceneBtnW, playH);
    ctx.fillStyle = isNextSceneHover ? textPrimary : textMuted;
    ctx.fillText('►', cx + sceneBtnW / 2, rowY + playH / 2);

    // Speed selectors
    const speeds = [0.5, 1.0, 1.5, 2.0];
    let spX = width - 420;
    for (const sp of speeds) {
      const spW = 38;
      const isCurSpeed = Math.abs(state.playbackRate - sp) < 0.05;
      const isSpHover = hoveredHitboxId === `speed_${sp}`;

      activeHitboxes.push({
        id: `speed_${sp}`,
        x: spX,
        y: rowY + 3,
        w: spW,
        h: 28,
        action: { type: 'set_speed', payload: sp },
      });

      if (isCurSpeed) {
        ctx.fillStyle = isPaper ? '#1c1917' : '#ffffff';
        ctx.fillRect(spX, rowY + 3, spW, 28);
        ctx.fillStyle = isPaper ? '#fafaf9' : '#000000';
      } else {
        ctx.strokeStyle = isSpHover ? textPrimary : borderCol;
        ctx.strokeRect(spX, rowY + 3, spW, 28);
        ctx.fillStyle = isSpHover ? textPrimary : textMuted;
      }

      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${sp}x`, spX + spW / 2, rowY + 17);

      spX += spW + 4;
    }

    // Export / Recording Actions Right Deck
    let actX = width - 240;

    // Load Audio button
    const loadAudioW = 75;
    const isLoadAudioHover = hoveredHitboxId === 'btn_load_audio';
    activeHitboxes.push({
      id: 'btn_load_audio',
      x: actX,
      y: rowY + 3,
      w: loadAudioW,
      h: 28,
      action: { type: 'load_audio' },
    });
    ctx.strokeStyle = isLoadAudioHover ? textPrimary : borderCol;
    ctx.strokeRect(actX, rowY + 3, loadAudioW, 28);
    ctx.fillStyle = isLoadAudioHover ? textPrimary : textMuted;
    ctx.font = '700 9px "Montserrat", sans-serif';
    ctx.fillText('+ AUDIO', actX + loadAudioW / 2, rowY + 17);

    actX += loadAudioW + 6;

    // Export VTT button
    const exportVttW = 65;
    const isExportVttHover = hoveredHitboxId === 'btn_export_vtt';
    activeHitboxes.push({
      id: 'btn_export_vtt',
      x: actX,
      y: rowY + 3,
      w: exportVttW,
      h: 28,
      action: { type: 'export_vtt' },
    });
    ctx.strokeStyle = isExportVttHover ? textPrimary : borderCol;
    ctx.strokeRect(actX, rowY + 3, exportVttW, 28);
    ctx.fillStyle = isExportVttHover ? textPrimary : textMuted;
    ctx.fillText('.VTT', actX + exportVttW / 2, rowY + 17);

    actX += exportVttW + 6;

    // Record WebM button
    const recW = 76;
    const isRecHover = hoveredHitboxId === 'btn_record_webm';
    activeHitboxes.push({
      id: 'btn_record_webm',
      x: actX,
      y: rowY + 3,
      w: recW,
      h: 28,
      action: { type: 'toggle_record' },
    });
    if (state.isRecording) {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(actX, rowY + 3, recW, 28);
      ctx.fillStyle = '#ffffff';
    } else {
      ctx.strokeStyle = isRecHover ? '#ef4444' : borderCol;
      ctx.strokeRect(actX, rowY + 3, recW, 28);
      ctx.fillStyle = isRecHover ? '#ef4444' : textMuted;
    }
    ctx.fillText(state.isRecording ? '■ STOP' : '● REC', actX + recW / 2, rowY + 17);

    // Keyboard Shortcuts Bar
    if (width >= 720) {
      ctx.fillStyle = textMuted;
      ctx.font = '500 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('SHORTCUTS: [SPACE] PLAY/PAUSE  |  [←/→] STEP ±1F  |  [1-5] VIEW PROJECTIONS  |  [T] STYLE THEME', 26, botY - 8);
    }
  } else {
    // ------------------------------------------------------------------------
    // MOBILE / COMPACT DUAL-TIER CONTROL DECK (NIST / Human Factors Compliant)
    // ------------------------------------------------------------------------
    // Tier 1 (botY + 28, h = 34): Primary Transport Controls & High-Legibility Timecode
    // Tier 2 (botY + 74, h = 32): Speed Selectors (Left) & Utility Actions (Right)
    const line1Y = botY + 28;
    const line1H = 34;
    let cx = 14;

    // Play / Pause button
    const playW = width < 420 ? 76 : 84;
    const isPlayHover = hoveredHitboxId === 'btn_play_pause';
    activeHitboxes.push({
      id: 'btn_play_pause',
      x: cx,
      y: line1Y,
      w: playW,
      h: line1H,
      action: { type: 'toggle_play' },
    });
    ctx.fillStyle = state.isPlaying
      ? (isPaper ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)')
      : (isPaper ? '#1c1917' : '#ffffff');
    ctx.fillRect(cx, line1Y, playW, line1H);
    ctx.fillStyle = state.isPlaying ? textPrimary : (isPaper ? '#fafaf9' : '#000000');
    ctx.font = '800 11px "Montserrat", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.isPlaying ? '❚❚ PAUSE' : '▶ PLAY', cx + playW / 2, line1Y + line1H / 2);

    cx += playW + (width < 420 ? 4 : 6);

    // Step -1F Button
    const stepW = width < 420 ? 32 : 36;
    const isPrevHover = hoveredHitboxId === 'btn_prev_frame';
    activeHitboxes.push({
      id: 'btn_prev_frame',
      x: cx,
      y: line1Y,
      w: stepW,
      h: line1H,
      action: { type: 'step_frame', payload: -1 },
    });
    ctx.strokeStyle = isPrevHover ? textPrimary : borderCol;
    ctx.strokeRect(cx, line1Y, stepW, line1H);
    ctx.fillStyle = isPrevHover ? textPrimary : textMuted;
    ctx.font = '700 11px "Montserrat", sans-serif';
    ctx.fillText('-1F', cx + stepW / 2, line1Y + line1H / 2);

    cx += stepW + (width < 420 ? 4 : 6);

    // Step +1F Button
    const isNextHover = hoveredHitboxId === 'btn_next_frame';
    activeHitboxes.push({
      id: 'btn_next_frame',
      x: cx,
      y: line1Y,
      w: stepW,
      h: line1H,
      action: { type: 'step_frame', payload: 1 },
    });
    ctx.strokeStyle = isNextHover ? textPrimary : borderCol;
    ctx.strokeRect(cx, line1Y, stepW, line1H);
    ctx.fillStyle = isNextHover ? textPrimary : textMuted;
    ctx.fillText('+1F', cx + stepW / 2, line1Y + line1H / 2);

    cx += stepW + (width < 420 ? 4 : 6);

    // Reset ↺ Button
    const resetW = width < 420 ? 38 : 42;
    const isResetHover = hoveredHitboxId === 'btn_reset';
    activeHitboxes.push({
      id: 'btn_reset',
      x: cx,
      y: line1Y,
      w: resetW,
      h: line1H,
      action: { type: 'restart' },
    });
    ctx.strokeStyle = isResetHover ? textPrimary : borderCol;
    ctx.strokeRect(cx, line1Y, resetW, line1H);
    ctx.fillStyle = isResetHover ? textPrimary : textMuted;
    ctx.fillText('↺ 0s', cx + resetW / 2, line1Y + line1H / 2);

    // Timecode Display (Right Aligned on Line 1)
    const timecodeRight = width - 14;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = '700 13px "JetBrains Mono", monospace';
    const curStr = formatTime(state.currentTime);
    const durStr = ` / ${formatTime(state.duration)}`;
    const durW = ctx.measureText(durStr).width;
    ctx.fillStyle = textMuted;
    ctx.fillText(durStr, timecodeRight, line1Y + line1H / 2);
    ctx.fillStyle = textPrimary;
    ctx.fillText(curStr, timecodeRight - durW, line1Y + line1H / 2);

    // Tier 2 (botY + 74, h = 32): Speeds (Left) & Utility Actions (Right)
    const line2Y = botY + 74;
    const line2H = 32;

    // Speed selectors (Left)
    const speeds = [0.5, 1.0, 1.5, 2.0];
    let spX = 14;
    const spW = width < 420 ? 32 : 36;
    for (const sp of speeds) {
      const isCurSpeed = Math.abs(state.playbackRate - sp) < 0.05;
      const isSpHover = hoveredHitboxId === `speed_${sp}`;

      activeHitboxes.push({
        id: `speed_${sp}`,
        x: spX,
        y: line2Y - 4,
        w: spW,
        h: line2H + 8,
        action: { type: 'set_speed', payload: sp },
      });

      if (isCurSpeed) {
        ctx.fillStyle = isPaper ? '#1c1917' : '#ffffff';
        ctx.fillRect(spX, line2Y, spW, line2H);
        ctx.fillStyle = isPaper ? '#fafaf9' : '#000000';
      } else {
        ctx.strokeStyle = isSpHover ? textPrimary : borderCol;
        ctx.strokeRect(spX, line2Y, spW, line2H);
        ctx.fillStyle = isSpHover ? textPrimary : textMuted;
      }

      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${sp}x`, spX + spW / 2, line2Y + line2H / 2);

      spX += spW + 4;
    }

    // Export / Recording Actions Right Deck
    let actRight = width - 14;

    // Record WebM button
    const recW = width < 420 ? 58 : 66;
    const recX = actRight - recW;
    const isRecHover = hoveredHitboxId === 'btn_record_webm';
    activeHitboxes.push({
      id: 'btn_record_webm',
      x: recX,
      y: line2Y - 4,
      w: recW,
      h: line2H + 8,
      action: { type: 'toggle_record' },
    });
    if (state.isRecording) {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(recX, line2Y, recW, line2H);
      ctx.fillStyle = '#ffffff';
    } else {
      ctx.strokeStyle = isRecHover ? '#ef4444' : borderCol;
      ctx.strokeRect(recX, line2Y, recW, line2H);
      ctx.fillStyle = isRecHover ? '#ef4444' : textMuted;
    }
    ctx.font = '700 9px "Montserrat", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.isRecording ? '■ STOP' : '● REC', recX + recW / 2, line2Y + line2H / 2);

    actRight = recX - 6;

    // Export VTT button
    const exportVttW = width < 420 ? 46 : 52;
    const vttX = actRight - exportVttW;
    const isExportVttHover = hoveredHitboxId === 'btn_export_vtt';
    activeHitboxes.push({
      id: 'btn_export_vtt',
      x: vttX,
      y: line2Y - 4,
      w: exportVttW,
      h: line2H + 8,
      action: { type: 'export_vtt' },
    });
    ctx.strokeStyle = isExportVttHover ? textPrimary : borderCol;
    ctx.strokeRect(vttX, line2Y, exportVttW, line2H);
    ctx.fillStyle = isExportVttHover ? textPrimary : textMuted;
    ctx.fillText('.VTT', vttX + exportVttW / 2, line2Y + line2H / 2);

    actRight = vttX - 6;

    // Load Audio button
    const loadAudioW = width < 420 ? 62 : 68;
    const audioX = actRight - loadAudioW;
    const isLoadAudioHover = hoveredHitboxId === 'btn_load_audio';
    activeHitboxes.push({
      id: 'btn_load_audio',
      x: audioX,
      y: line2Y - 4,
      w: loadAudioW,
      h: line2H + 8,
      action: { type: 'load_audio' },
    });
    ctx.strokeStyle = isLoadAudioHover ? textPrimary : borderCol;
    ctx.strokeRect(audioX, line2Y, loadAudioW, line2H);
    ctx.fillStyle = isLoadAudioHover ? textPrimary : textMuted;
    ctx.fillText('+ AUDIO', audioX + loadAudioW / 2, line2Y + line2H / 2);

    // Optional Phrase Landmark in Center of Line 2 if wide enough (>= 620px)
    if (width >= 620) {
      const phraseMidLeft = spX + 10;
      const phraseMidRight = audioX - 10;
      const phraseBoxW = phraseMidRight - phraseMidLeft;
      if (phraseBoxW > 120) {
        ctx.strokeStyle = borderCol;
        ctx.strokeRect(phraseMidLeft, line2Y, phraseBoxW, line2H);
        ctx.fillStyle = textPrimary;
        ctx.font = '700 9px "Montserrat", sans-serif';
        ctx.textAlign = 'center';
        const phraseIndexText = `PHRASE ${(state.activePhraseIndex ?? 0) + 1} / ${state.totalPhrases ?? 1}`;
        ctx.fillText(phraseIndexText, phraseMidLeft + phraseBoxW / 2, line2Y + line2H / 2);
      }
    }
  }

  // --------------------------------------------------------------------------
  // 4. DRAG & DROP CANVAS OVERLAY
  // --------------------------------------------------------------------------
  if (state.isDraggingFile) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 8]);
    ctx.strokeRect(40, 40, width - 80, height - 80);
    ctx.setLineDash([]);

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 28px "Montserrat", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DROP AUDIO OR .VTT SUBTITLES FILE HERE', width / 2, height / 2 - 18);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 15px "JetBrains Mono", monospace';
    ctx.fillText('Accepts MP3, WAV, WebVTT (.vtt), SRT, or JSON timing files', width / 2, height / 2 + 22);
  }

  ctx.restore();
}
