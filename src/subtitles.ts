/**
 * SUBTITLES MODULE (Atomic WebVTT & SubRip Parser / Serializer)
 * Strictly parses standard WebVTT (.vtt) and SRT (.srt) subtitle cues into atomic TimedWord tokens.
 */

import { TimedWord } from './types.ts';

/**
 * Convert timestamp string (HH:MM:SS.mmm or MM:SS.mmm or HH:MM:SS,mmm) to seconds.
 */
export function parseTimestampToSeconds(ts: string): number {
  const cleaned = ts.trim().replace(',', '.');
  const parts = cleaned.split(':');

  if (parts.length === 3) {
    const hours = parseFloat(parts[0]);
    const minutes = parseFloat(parts[1]);
    const seconds = parseFloat(parts[2]);
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    const minutes = parseFloat(parts[0]);
    const seconds = parseFloat(parts[1]);
    return minutes * 60 + seconds;
  } else {
    return parseFloat(cleaned) || 0;
  }
}

/**
 * Format seconds into standard WebVTT timestamp format (HH:MM:SS.mmm).
 */
export function formatSecondsToVTT(seconds: number): string {
  const s = Math.max(0, seconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const hStr = String(hours).padStart(2, '0');
  const mStr = String(minutes).padStart(2, '0');
  const sStr = secs.toFixed(3).padStart(6, '0');
  return `${hStr}:${mStr}:${sStr}`;
}

/**
 * Parses WebVTT or SRT subtitle text into an array of atomic TimedWord items.
 * If a cue contains multiple words, it seamlessly divides the time span proportionally
 * so every token remains strictly atomic.
 */
export function parseSubtitles(rawText: string): TimedWord[] {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const timedWords: TimedWord[] = [];

  const timeRegex = /((?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{3})\s*-->\s*((?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{3})/;

  let currentStart = -1;
  let currentEnd = -1;
  let textBuffer: string[] = [];

  function flushCue() {
    if (currentStart >= 0 && currentEnd > currentStart && textBuffer.length > 0) {
      // Clean tags like <v Speaker>, <b>, etc.
      const rawCueText = textBuffer
        .join(' ')
        .replace(/<[^>]+>/g, '')
        .trim();

      if (rawCueText) {
        const tokens = rawCueText.split(/\s+/).filter(Boolean);
        if (tokens.length === 1) {
          // Pure atomic cue
          timedWords.push({
            text: tokens[0],
            start: Number(currentStart.toFixed(3)),
            end: Number(currentEnd.toFixed(3)),
          });
        } else if (tokens.length > 1) {
          // Multi-word cue: distribute duration proportionally
          const totalDuration = currentEnd - currentStart;
          const wordDur = totalDuration / tokens.length;
          for (let w = 0; w < tokens.length; w++) {
            const wStart = currentStart + w * wordDur;
            const wEnd = currentStart + (w + 1) * wordDur;
            timedWords.push({
              text: tokens[w],
              start: Number(wStart.toFixed(3)),
              end: Number(wEnd.toFixed(3)),
            });
          }
        }
      }
    }
    currentStart = -1;
    currentEnd = -1;
    textBuffer = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip WEBVTT header and comment lines
    if (line.startsWith('WEBVTT') || line.startsWith('NOTE') || line.startsWith('STYLE')) {
      continue;
    }

    const match = line.match(timeRegex);
    if (match) {
      flushCue();
      currentStart = parseTimestampToSeconds(match[1]);
      currentEnd = parseTimestampToSeconds(match[2]);
      continue;
    }

    if (currentStart >= 0) {
      if (line === '') {
        flushCue();
      } else {
        textBuffer.push(line);
      }
    }
  }

  flushCue();
  return timedWords;
}

/**
 * Serializes atomic TimedWord items to standard WebVTT format (1 cue per word).
 */
export function serializeToWebVTT(words: TimedWord[]): string {
  const out: string[] = ['WEBVTT - Kinetic Math Typography Atomic Subtitles', ''];

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    out.push(String(i + 1));
    out.push(`${formatSecondsToVTT(w.start)} --> ${formatSecondsToVTT(w.end)}`);
    out.push(w.text);
    out.push('');
  }

  return out.join('\n');
}
