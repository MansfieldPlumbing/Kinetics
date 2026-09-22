/**
 * AUTHORITATIVE CAMERA SUBSYSTEM
 * Controls 2D virtual camera position, smooth rotation tracking, zoom, and procedural shake.
 */

import { CameraState } from './types.ts';

export function createCamera(): CameraState {
  return {
    x: 0,
    y: 0,
    rotation: 0,
    zoom: 1.0,
    targetX: 0,
    targetY: 0,
    targetRotation: 0,
    targetZoom: 1.0,
    shakeIntensity: 0,
    shakeDuration: 0,
    shakeTimer: 0,
  };
}

export function triggerScreenShake(camera: CameraState, intensity = 8, duration = 0.25): void {
  camera.shakeIntensity = Math.max(camera.shakeIntensity, intensity);
  camera.shakeDuration = duration;
  camera.shakeTimer = duration;
}

export function updateCamera(camera: CameraState, dt: number = 1 / 60): void {
  const safeDt = Math.min(Math.max(dt, 0.001), 0.1);

  // Directly snap to deterministic target values without spring accumulator lag
  camera.x = camera.targetX;
  camera.y = camera.targetY;
  camera.rotation = camera.targetRotation;
  camera.zoom = camera.targetZoom;

  // Screen shake decay
  if (camera.shakeTimer > 0) {
    camera.shakeTimer -= safeDt;
    if (camera.shakeTimer <= 0) {
      camera.shakeIntensity = 0;
      camera.shakeTimer = 0;
    }
  }
}

export function applyCameraTransform(
  ctx: CanvasRenderingContext2D,
  camera: CameraState,
  viewWidth: number,
  viewHeight: number
): void {
  // Screen center
  ctx.translate(viewWidth / 2, viewHeight / 2);

  // Apply screen shake if active
  if (camera.shakeTimer > 0 && camera.shakeIntensity > 0) {
    const decay = camera.shakeTimer / camera.shakeDuration;
    const currentMag = camera.shakeIntensity * decay;
    const sx = (Math.random() * 2 - 1) * currentMag;
    const sy = (Math.random() * 2 - 1) * currentMag;
    ctx.translate(sx, sy);
  }

  // Zoom
  ctx.scale(camera.zoom, camera.zoom);

  // Rotate world opposite to camera orientation
  ctx.rotate(-camera.rotation);

  // Translate to camera position in world space
  ctx.translate(-camera.x, -camera.y);
}

export function worldToScreen(
  wx: number,
  wy: number,
  camera: CameraState,
  viewWidth: number,
  viewHeight: number
): { x: number; y: number } {
  const dx = wx - camera.x;
  const dy = wy - camera.y;
  const rot = -camera.rotation;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const rx = dx * cos - dy * sin;
  const ry = dx * sin + dy * cos;
  return {
    x: viewWidth / 2 + rx * camera.zoom,
    y: viewHeight / 2 + ry * camera.zoom,
  };
}
