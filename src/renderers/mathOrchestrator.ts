import { ThemeColors, ColorTheme } from '../types.ts';

export interface MathEvent {
  time: number;
  tokens: string[];
  _layout?: RenderToken[];
}

export interface RenderToken {
  id: string;
  text: string;
  targetX: number;
  width: number;
  alpha: number;
}

// Module-level static singleton measurement context to avoid per-frame DOM canvas allocations
let _sharedMeasureCanvas: HTMLCanvasElement | null = null;
let _sharedMeasureCtx: CanvasRenderingContext2D | null = null;

function getSharedMeasureCtx(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!_sharedMeasureCanvas) {
    _sharedMeasureCanvas = document.createElement('canvas');
    _sharedMeasureCanvas.width = 1;
    _sharedMeasureCanvas.height = 1;
    _sharedMeasureCtx = _sharedMeasureCanvas.getContext('2d');
  }
  return _sharedMeasureCtx;
}

const _tokenWidthCache = new Map<string, number>();

export class MathOrchestrator {
  events: MathEvent[] = [];
  font = `800 52px "Montserrat", -apple-system, sans-serif`;

  constructor(trackData: string) {
    this.parse(trackData);
  }

  parse(data: string) {
    const lines = data.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const parts = trimmed.split(' ');
      const time = parseFloat(parts[0]);
      if (isNaN(time)) continue;
      const tokens = parts.slice(1);
      
      const processedTokens = [];
      const counts: Record<string, number> = {};
      for (const t of tokens) {
        if (t.includes('#')) {
          processedTokens.push(t);
        } else {
          counts[t] = (counts[t] || 0) + 1;
          processedTokens.push(`${t}__${counts[t]}`);
        }
      }
      this.events.push({ time, tokens: processedTokens });
    }
    this.events.sort((a, b) => a.time - b.time);
  }

  /**
   * Retrieves memoized layout for a MathEvent without measuring text per frame.
   */
  getEventLayout(event: MathEvent | null, fallbackCtx?: CanvasRenderingContext2D): RenderToken[] {
    if (!event) return [];
    if (event._layout) return event._layout;

    const measureCtx = fallbackCtx || getSharedMeasureCtx();
    if (!measureCtx) return [];
    measureCtx.font = this.font;
    event._layout = this.computeLayout(measureCtx, event.tokens);
    return event._layout;
  }

  /**
   * Returns the exact timestamp when this token should materialize during
   * the opening narration of the problem (e.g. "Let's say X plus 4 is sitting at a 10").
   */
  getMaterializeTime(id: string): number | null {
    // Act 1: "Let's say (70.9-72.3) X (72.30) plus (72.70) 4 (73.16) is sitting at a (73.76) 10 (75.16)"
    if (id === 'X__1' && this.events[0]?.time < 100) return 72.30;
    if (id === '+__1' && this.events[0]?.time < 100) return 72.70;
    if (id === '4__1' && this.events[0]?.time < 100) return 73.16;
    if (id === '=__1' && this.events[0]?.time < 100) return 73.76;
    if (id === '10__1' && this.events[0]?.time < 100) return 75.16;

    // Act 2: "2 (153.12) X (153.47) minus (154.80) 5 (155.18) equals (155.76) 15 (156.10)"
    if (id === '2__1' && this.events[0]?.time > 100) return 153.12;
    if (id === 'X__1' && this.events[0]?.time > 100) return 153.47;
    if (id === '-__1' && this.events[0]?.time > 100) return 154.80;
    if (id === '5__1' && this.events[0]?.time > 100) return 155.18;
    if (id === '=__1' && this.events[0]?.time > 100) return 155.76;
    if (id === '15__1' && this.events[0]?.time > 100) return 156.10;

    return null;
  }

  render(ctx: CanvasRenderingContext2D, currentTime: number, CX: number, CY: number, colors: ThemeColors, theme: ColorTheme) {
    if (this.events.length === 0) return;
    
    let idx = 0;
    while (idx < this.events.length - 1 && this.events[idx + 1].time <= currentTime) {
      idx++;
    }
    
    const targetEvent = this.events[idx];
    const prevEvent = idx > 0 ? this.events[idx - 1] : null;
    
    // We animate FROM prevEvent TO targetEvent over 0.6 seconds with bouncy easing
    let progress = 1;
    if (prevEvent) {
      const timeSinceTargetStart = currentTime - targetEvent.time;
      progress = Math.max(0, Math.min(1, timeSinceTargetStart / 0.6));
      // Ease out elastic
      const p = progress;
      progress = p === 1 ? 1 : 1 - Math.pow(2, -10 * p) * Math.cos((p * 10 - 0.75) * ((2 * Math.PI) / 3));
    }
    
    // Retrieve memoized token layouts
    const layoutCurrent = this.getEventLayout(prevEvent, ctx);
    const layoutNext = this.getEventLayout(targetEvent, ctx);
    
    const allIds = new Set([
      ...(prevEvent ? prevEvent.tokens : []), 
      ...targetEvent.tokens
    ]);

    const isInitialPhase = idx === 0 && (
      (this.events[0]?.time < 100 && currentTime < 76.5) ||
      (this.events[0]?.time > 100 && currentTime < 158.0)
    );
    
    for (const id of allIds) {
      const c = layoutCurrent.find(l => l.id === id);
      const n = layoutNext.find(l => l.id === id);
      
      let x = 0;
      let yOffset = 0;
      let alpha = 1;
      let scale = 1;
      
      if (c && n) {
        x = c.targetX + (n.targetX - c.targetX) * progress;
      } else if (c && !n) {
        x = c.targetX;
        alpha = 1 - progress; // Fade out
        yOffset = progress * -30; // Float up as it disappears
        scale = 1 - (progress * 0.5);
      } else if (!c && n) {
        x = n.targetX;
        alpha = progress; // Fade in
        yOffset = (1 - progress) * 30; // Float down as it appears
        scale = 0.5 + (progress * 0.5);
      }

      // Progressive kinetic materialization during problem description
      if (isInitialPhase && n) {
        const matTime = this.getMaterializeTime(id);
        if (matTime !== null) {
          if (currentTime < matTime) {
            // Not spoken yet: do not render
            continue;
          }
          const timeSinceMat = currentTime - matTime;
          if (timeSinceMat < 0.40) {
            const matP = timeSinceMat / 0.40;
            // Elastic spring drop and impact slam
            const easeMat = matP === 1 ? 1 : 1 - Math.pow(2, -10 * matP) * Math.cos((matP * 10 - 0.75) * ((2 * Math.PI) / 3));
            scale = 1.0 + (1 - easeMat) * 0.55;
            alpha = Math.min(1, matP * 3.5);
            yOffset = (1 - easeMat) * -22;

            // Radiant impact shockwave ring on token landing
            const isPaper = theme === 'light_mode';
            const shockAlpha = (1 - matP) * 0.40;
            ctx.save();
            ctx.beginPath();
            ctx.arc(CX + x, CY, (24 + matP * 35), 0, Math.PI * 2);
            ctx.strokeStyle = id.startsWith('X') ? (isPaper ? `rgba(234, 88, 12, ${shockAlpha})` : `rgba(249, 115, 22, ${shockAlpha})`) : (isPaper ? `rgba(15, 23, 42, ${shockAlpha})` : `rgba(255, 255, 255, ${shockAlpha})`);
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
          } else {
            scale = 1;
            alpha = 1;
            yOffset = 0;
          }
        }
      }
      
      if (alpha > 0.01) {
        this.drawToken(ctx, id, CX + x, CY + yOffset, scale, alpha, colors, theme);
      }
    }
  }

  computeLayout(ctx: CanvasRenderingContext2D, tokens: string[]): RenderToken[] {
    const layout: RenderToken[] = [];
    const spacing = 18;
    let totalWidth = 0;
    
    for (const id of tokens) {
      const rawText = id.split('__')[0].split('#')[0];
      let width = _tokenWidthCache.get(rawText);
      if (width === undefined) {
        width = ctx.measureText(rawText).width;
        _tokenWidthCache.set(rawText, width);
      }
      layout.push({ id, text: rawText, width, targetX: 0, alpha: 1 });
      totalWidth += width + spacing;
    }
    totalWidth -= spacing;
    
    let currentX = -totalWidth / 2;
    for (const item of layout) {
      item.targetX = currentX + item.width / 2;
      currentX += item.width + spacing;
    }
    
    return layout;
  }

  drawToken(ctx: CanvasRenderingContext2D, id: string, px: number, py: number, scale: number, a: number, colors: ThemeColors, theme: ColorTheme) {
    const rawText = id.split('__')[0].split('#')[0];
    const isPaper = theme === 'light_mode';
    
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(px, py);
    ctx.scale(scale, scale);
    
    const isVariable = rawText === 'X' || rawText === '2X';
    const isOp = ['+', '-', '=', '/', '*'].includes(rawText);
    const isNumber = !isVariable && !isOp;

    let color = colors.spokenWordText;
    if (isVariable || id.includes('#op')) {
      color = (colors as any).varXColor || (isPaper ? '#ea580c' : '#f97316');
    } else if (isOp) {
      color = isPaper ? '#64748b' : '#94a3b8';
    } else {
      color = colors.spokenWordText;
    }
    
    if (isVariable) {
       ctx.font = `900 56px "Montserrat", -apple-system, sans-serif`;
       ctx.shadowColor = color;
       ctx.shadowBlur = 12;
    } else if (isNumber) {
       ctx.font = `800 52px "Montserrat", -apple-system, sans-serif`;
       ctx.shadowBlur = 0;
    } else {
       ctx.font = `800 48px "Montserrat", -apple-system, sans-serif`;
       ctx.shadowBlur = 0;
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(rawText, 0, 0);
    
    ctx.restore();
  }

  getTokenPosition(prefix: string, currentTime: number): { x: number; y: number; alpha: number } | null {
    if (this.events.length === 0) return null;
    let idx = 0;
    while (idx < this.events.length - 1 && this.events[idx + 1].time <= currentTime) {
      idx++;
    }
    const targetEvent = this.events[idx];
    const prevEvent = idx > 0 ? this.events[idx - 1] : null;
    let progress = 1;
    if (prevEvent) {
      const timeSinceTargetStart = currentTime - targetEvent.time;
      progress = Math.max(0, Math.min(1, timeSinceTargetStart / 0.6));
      const p = progress;
      progress = p === 1 ? 1 : 1 - Math.pow(2, -10 * p) * Math.cos((p * 10 - 0.75) * ((2 * Math.PI) / 3));
    }

    const layoutCurrent = this.getEventLayout(prevEvent);
    const layoutNext = this.getEventLayout(targetEvent);

    const n = layoutNext.find(l => l.text === prefix || l.id.startsWith(prefix));
    const c = layoutCurrent.find(l => l.text === prefix || l.id.startsWith(prefix));

    if (n) {
      const matTime = this.getMaterializeTime(n.id);
      if (matTime !== null && currentTime < matTime) {
        return null;
      }
    }

    if (c && n) {
      return { x: c.targetX + (n.targetX - c.targetX) * progress, y: 0, alpha: 1 };
    } else if (c && !n) {
      return { x: c.targetX, y: progress * -30, alpha: 1 - progress };
    } else if (!c && n) {
      return { x: n.targetX, y: (1 - progress) * 30, alpha: progress };
    }
    return null;
  }
}
