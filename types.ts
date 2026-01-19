export interface TranscriptSegment {
  timecode: string;
  startTimeMs: number;
  endTimeMs: number;
  text: string;
}

export interface ProcessedSegment extends TranscriptSegment {
  durationMs: number;
  pauseAfterMs: number;
  termsRu?: string;
  termsEn?: string;
  translatedText?: string;
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  ANALYZING = 'ANALYZING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

export interface AnalysisError {
  message: string;
  details?: string;
}