import { createClient } from '@supabase/supabase-js';
import { ProcessedSegment } from '../types';

const SUPABASE_URL = 'https://cqpqyhehoiybggjuljzn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxcHF5aGVob2l5YmdnanVsanpuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MTQyODQsImV4cCI6MjA4MDA5MDI4NH0.H9PR8iNGM42wvJDfA7ntcz-aj5GWD1L7cl0VlGvFsBs';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export const uploadTranscript = async (data: ProcessedSegment[]) => {
  // Map data to snake_case column names typical for SQL/Supabase
  const rows = data.map(item => ({
    timecode: item.timecode,
    start_time_ms: item.startTimeMs,
    end_time_ms: item.endTimeMs,
    duration_ms: item.durationMs,
    pause_after_ms: item.pauseAfterMs,
    text: item.text,
    terms_ru: item.termsRu || null,
    terms_en: item.termsEn || null,
    translated_text: item.translatedText || null,
  }));

  const { error } = await supabase
    .from('translate_shibari')
    .insert(rows);

  if (error) {
    throw new Error(`Ошибка Supabase: ${error.message}`);
  }
  
  return true;
};