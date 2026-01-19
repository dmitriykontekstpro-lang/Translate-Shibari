// Utility to handle client-side audio processing

const TARGET_SAMPLE_RATE = 16000; // 16kHz is sufficient for speech and saves bandwidth
const CHUNK_DURATION_SEC = 150; // 2.5 minutes

// Helper to encode AudioBuffer to WAV blob
const bufferToWav = (buffer: AudioBuffer): Blob => {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArray = new ArrayBuffer(length);
  const view = new DataView(bufferArray);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  // write WAVE header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit (hardcoded in this loop)

  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  // write interleaved data
  for (i = 0; i < buffer.numberOfChannels; i++)
    channels.push(buffer.getChannelData(i));

  while (pos < buffer.length) {
    for (i = 0; i < numOfChan; i++) {
      // interleave channels
      sample = Math.max(-1, Math.min(1, channels[i][pos])); // clamp
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
      view.setInt16(44 + offset, sample, true); // write 16-bit sample
      offset += 2;
    }
    pos++;
  }

  return new Blob([bufferArray], { type: 'audio/wav' });

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
};

export const extractAudioChunks = async (file: File): Promise<Blob[]> => {
  // Prevent browser crash on massive files by checking basic limits first.
  // 500MB is a rough safety limit for loading into ArrayBuffer in browser memory.
  if (file.size > 500 * 1024 * 1024) {
    throw new Error("FILE_TOO_LARGE_FOR_CLIENT");
  }

  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
    sampleRate: TARGET_SAMPLE_RATE, // Force resampling context
  });

  // Decode the audio
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  const chunks: Blob[] = [];
  const samplesPerChunk = CHUNK_DURATION_SEC * TARGET_SAMPLE_RATE;
  const totalSamples = audioBuffer.length;
  const numberOfChannels = 1; // Force Mono to save space

  for (let start = 0; start < totalSamples; start += samplesPerChunk) {
    const end = Math.min(start + samplesPerChunk, totalSamples);
    const frameCount = end - start;

    if (frameCount <= 0) break;

    // Create a new buffer for this chunk
    const chunkBuffer = audioContext.createBuffer(
      numberOfChannels,
      frameCount,
      TARGET_SAMPLE_RATE
    );

    // Copy channel data (mix down to mono if original was stereo)
    const channelData = chunkBuffer.getChannelData(0);
    
    // Simple mono mixdown: Average all channels
    for (let i = 0; i < frameCount; i++) {
        let sum = 0;
        for(let c = 0; c < audioBuffer.numberOfChannels; c++) {
            sum += audioBuffer.getChannelData(c)[start + i];
        }
        channelData[i] = sum / audioBuffer.numberOfChannels;
    }

    chunks.push(bufferToWav(chunkBuffer));
  }

  return chunks;
};