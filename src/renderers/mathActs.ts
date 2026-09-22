import { ThemeColors } from '../types.ts';
import { MATH_TRACK_1, MATH_TRACK_2 } from '../mathTrackData.ts';
import { MathOrchestrator } from './mathOrchestrator.ts';

const clamp = (val: number, min = 0, max = 1) => Math.max(min, Math.min(max, val));

export const orchestrator1 = new MathOrchestrator(MATH_TRACK_1);
export const orchestrator2 = new MathOrchestrator(MATH_TRACK_2);

export function getMathScene1Layout(W: number, H: number) {
  const CX = W / 2;
  const CY = H / 2 - Math.max(40, H * 0.08);
  const baseMathW = 660;
  const baseMathH = 260;
  const mathScale = Math.min(1.45, (W * 0.84) / baseMathW, (H * 0.52) / baseMathH);
  return { CX, CY, mathScale, orchestrator: orchestrator1 };
}

export function getMathScene2Layout(W: number, H: number) {
  const CX = W / 2;
  const CY = H / 2 - Math.max(40, H * 0.08);
  const baseMathW = 660;
  const baseMathH = 260;
  const mathScale = Math.min(1.45, (W * 0.84) / baseMathW, (H * 0.52) / baseMathH);
  return { CX, CY, mathScale, orchestrator: orchestrator2 };
}

export function renderMathScene1(ctx: CanvasRenderingContext2D, currentTime: number, W: number, H: number, colors: ThemeColors, theme: any = 'light_mode') {
  const exit = clamp((currentTime - 89.4) / 0.85);
  if (currentTime < 70.4 || exit >= 1) return;

  const aa = 1 - exit;
  ctx.save();
  ctx.globalAlpha = aa;
  
  const CX = W / 2;
  const CY = H / 2 - Math.max(40, H * 0.08); // Shift up slightly to leave room for subtitle
  
  ctx.translate(CX, CY);
  // Responsive math scale: fits equation safely within 84% width and 52% height
  const baseMathW = 660;
  const baseMathH = 260;
  const mathScale = Math.min(1.45, (W * 0.84) / baseMathW, (H * 0.52) / baseMathH);
  ctx.scale(mathScale, mathScale);
  
  orchestrator1.render(ctx, currentTime, 0, 0, colors, theme);
  
  ctx.restore();
}

export function renderMathScene2(ctx: CanvasRenderingContext2D, currentTime: number, W: number, H: number, colors: ThemeColors, theme: any = 'light_mode') {
  const exit = clamp((currentTime - 174.8) / 0.95);
  if (currentTime < 153.4 || exit >= 1) return;

  const aa = 1 - exit;
  ctx.save();
  ctx.globalAlpha = aa;
  
  const CX = W / 2;
  const CY = H / 2 - Math.max(40, H * 0.08); // Shift up slightly to leave room for subtitle
  
  ctx.translate(CX, CY);
  // Responsive math scale: fits equation safely within 84% width and 52% height
  const baseMathW = 660;
  const baseMathH = 260;
  const mathScale = Math.min(1.45, (W * 0.84) / baseMathW, (H * 0.52) / baseMathH);
  ctx.scale(mathScale, mathScale);
  
  orchestrator2.render(ctx, currentTime, 0, 0, colors, theme);
  
  ctx.restore();
}
