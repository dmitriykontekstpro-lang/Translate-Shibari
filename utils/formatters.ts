import { TranscriptSegment, ProcessedSegment } from '../types';

export const formatMsToTime = (ms: number): string => {
  const date = new Date(ms);
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  const seconds = date.getUTCSeconds().toString().padStart(2, '0');
  const milliseconds = date.getUTCMilliseconds().toString().padStart(3, '0');
  return `${minutes}:${seconds}.${milliseconds}`;
};

export const mergeSegments = (segments: TranscriptSegment[]): TranscriptSegment[] => {
  if (segments.length === 0) return [];

  const merged: TranscriptSegment[] = [];
  let current = segments[0];

  for (let i = 1; i < segments.length; i++) {
    const next = segments[i];
    const gap = next.startTimeMs - current.endTimeMs;

    if (gap < 1010) {
      // Merge into current
      current = {
        ...current,
        endTimeMs: next.endTimeMs,
        text: `${current.text} ${next.text}`,
      };
    } else {
      // Push finished segment and start new one
      merged.push(current);
      current = next;
    }
  }
  merged.push(current);
  return merged;
};

export const calculatePauses = (segments: TranscriptSegment[]): ProcessedSegment[] => {
  return segments.map((segment, index) => {
    const nextSegment = segments[index + 1];
    const durationMs = segment.endTimeMs - segment.startTimeMs;
    // Pause is time between current end and next start. If last segment, pause is 0.
    const pauseAfterMs = nextSegment 
      ? Math.max(0, nextSegment.startTimeMs - segment.endTimeMs) 
      : 0;

    return {
      ...segment,
      durationMs,
      pauseAfterMs,
    };
  });
};