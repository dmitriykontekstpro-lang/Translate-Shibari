import { GoogleGenAI, Type } from "@google/genai";
import { TranscriptSegment } from "../types";
import { extractAudioChunks } from "../utils/audioProcessor";
import { formatMsToTime } from "../utils/formatters";

// 2GB Limit
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024; 

export const validateFile = (file: File): string | null => {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `Файл слишком большой (${(file.size / 1024 / 1024 / 1024).toFixed(2)}GB). Максимальный размер 2GB.`;
  }
  const validTypes = ['audio/mp3', 'audio/wav', 'audio/mpeg', 'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'];
  if (!validTypes.includes(file.type)) {
    return "Неподдерживаемый тип файла. Пожалуйста, загрузите MP3, WAV, MP4, MOV или WEBM.";
  }
  return null;
};

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

// Original Large File Strategy (Fallback)
const processViaFilesAPI = async (ai: GoogleGenAI, file: File): Promise<TranscriptSegment[]> => {
  console.log("Using Files API strategy...");
  let uploadResult;
  try {
    uploadResult = await ai.files.upload({
      file: file,
      config: { displayName: file.name }
    });
  } catch (err: any) {
    throw new Error(`Upload failed: ${err.message}`);
  }

  if (!uploadResult || !uploadResult.file) {
    throw new Error("File upload failed: No file metadata returned from API.");
  }
  
  let fileUri = uploadResult.file.uri;
  let fileName = uploadResult.file.name;
  let state = uploadResult.file.state;

  console.log(`File uploaded: ${fileUri}, State: ${state}`);

  // Poll for processing
  while (state === 'PROCESSING') {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const fileStatus = await ai.files.get({ name: fileName });
    state = fileStatus.file.state;
    if (state === 'FAILED') throw new Error("Video processing failed on Gemini server.");
  }

  if (state !== 'ACTIVE') throw new Error(`File is not active. State: ${state}`);

  const prompt = `
    Analyze the audio in this file. 
    1. Transcribe the spoken text accurately (detect language automatically).
    2. Split the text into natural phrases or sentences.
    3. For each phrase, provide:
       - The start time in milliseconds.
       - The end time in milliseconds.
       - A formatted timecode (MM:SS.mmm).
       - The exact text.
    Return the result as a raw JSON array.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        { fileData: { mimeType: file.type, fileUri: fileUri } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            timecode: { type: Type.STRING },
            startTimeMs: { type: Type.INTEGER },
            endTimeMs: { type: Type.INTEGER },
            text: { type: Type.STRING },
          },
          required: ["timecode", "startTimeMs", "endTimeMs", "text"]
        }
      }
    }
  });

  return JSON.parse(response.text || "[]") as TranscriptSegment[];
};

// New Chunking Strategy
const processViaChunking = async (
  ai: GoogleGenAI, 
  file: File, 
  onProgress: (msg: string) => void
): Promise<TranscriptSegment[]> => {
  onProgress("Извлечение и нарезка аудио...");
  const chunks = await extractAudioChunks(file);
  const CHUNK_DURATION_MS = 150 * 1000; // 2.5 mins
  
  let allSegments: TranscriptSegment[] = [];

  for (let i = 0; i < chunks.length; i++) {
    onProgress(`Обработка фрагмента ${i + 1} из ${chunks.length}...`);
    const chunkBlob = chunks[i];
    const base64Data = await blobToBase64(chunkBlob);
    
    const prompt = `
      Transcribe this audio segment. 
      It is part ${i + 1} of a larger file.
      Return a JSON array of objects with: timecode, startTimeMs, endTimeMs, text.
      Strictly output JSON.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType: 'audio/wav', data: base64Data } },
                    { text: prompt }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            timecode: { type: Type.STRING },
                            startTimeMs: { type: Type.INTEGER },
                            endTimeMs: { type: Type.INTEGER },
                            text: { type: Type.STRING },
                        },
                        required: ["startTimeMs", "endTimeMs", "text"]
                    }
                }
            }
        });

        const chunkSegments = JSON.parse(response.text || "[]") as TranscriptSegment[];
        
        // Adjust timestamps based on chunk index
        const timeOffset = i * CHUNK_DURATION_MS;
        const adjustedSegments = chunkSegments.map(s => ({
            ...s,
            startTimeMs: s.startTimeMs + timeOffset,
            endTimeMs: s.endTimeMs + timeOffset,
            timecode: formatMsToTime(s.startTimeMs + timeOffset) // Regenerate timecode
        }));

        allSegments = [...allSegments, ...adjustedSegments];

    } catch (e) {
        console.error(`Error processing chunk ${i}`, e);
        // Continue to next chunk even if one fails
    }
  }

  return allSegments;
};

export const extractTranscript = async (
  file: File,
  onProgress: (status: string) => void
): Promise<TranscriptSegment[]> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key is missing.");

  const ai = new GoogleGenAI({ apiKey });

  try {
    // Try chunking first for better granularity and control
    return await processViaChunking(ai, file, onProgress);
  } catch (error: any) {
    if (error.message === "FILE_TOO_LARGE_FOR_CLIENT") {
      onProgress("Файл слишком большой для нарезки в браузере. Переключаемся на серверную обработку...");
      // Fallback to Files API for massive files
      return await processViaFilesAPI(ai, file);
    }
    throw error;
  }
};

export const detectShibariTermsBatch = async (
  items: { id: number, text: string }[]
): Promise<{ id: number, termsRu: string, termsEn: string }[]> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key is missing.");
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    You are an expert translator and specialist in Shibari (Japanese rope bondage).
    Analyze the following list of sentences.
    For each sentence, identify if there are any specific Shibari terms (knots, patterns, safety terms, anatomy in context of rope).
    
    Specific dictionary rules:
    - If you see "ТК" in the text, it stands for "Takate Kote".
    
    If terms are found:
    1. List the terms in Russian (as they appear or standard transliteration).
    2. Provide the correct English translation/terminology for those terms.
    
    If no terms are found, leave the strings empty.
    
    Return a JSON array where each object corresponds to the input ID.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        { text: JSON.stringify(items) },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.INTEGER },
            termsRu: { type: Type.STRING },
            termsEn: { type: Type.STRING },
          },
          required: ["id", "termsRu", "termsEn"]
        }
      }
    }
  });

  return JSON.parse(response.text || "[]");
};

export const translateTranscriptBatch = async (
  items: { id: number, text: string, durationMs: number, termsEn?: string }[]
): Promise<{ id: number, translatedText: string }[]> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key is missing.");
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    You are a professional audiovisual translator and dubbing scriptwriter specializing in Shibari content.
    Task: Translate the following JSON array of Russian phrases into English.
    
    Constraint 1 (Terminology): Use the specific English terms provided in the 'termsEn' field. Ensure consistency with the Shibari community dialect.
    Constraint 2 (Dubbing/Duration): The 'durationMs' is the length of the original speech. Your English translation MUST be speakable within this timeframe.
       - If the Russian phrase is short, keep the English concise.
       - If the Russian phrase is long, you have more room, but don't be verbose.
       - The goal is a translation suitable for voice-over that matches the original video timing.
    Constraint 3 (Context): The context is Japanese Rope Bondage (Shibari). Use respectful, safety-conscious, and anatomically correct language.

    Input JSON Format: [{ "id": number, "text": "Russian text", "durationMs": number, "termsEn": "optional terms" }]
    Output JSON Format: [{ "id": number, "translatedText": "English translation" }]
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        { text: JSON.stringify(items) },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.INTEGER },
            translatedText: { type: Type.STRING },
          },
          required: ["id", "translatedText"]
        }
      }
    }
  });

  return JSON.parse(response.text || "[]");
};