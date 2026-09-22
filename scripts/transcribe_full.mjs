import fs from 'fs';
import { pipeline } from '@xenova/transformers';

async function run() {
  console.log('Loading Whisper model...');
  const transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
  console.log('Reading 16kHz audio from /tmp/audio16k.wav...');
  const buf = fs.readFileSync('/tmp/audio16k.wav');
  const pcm = new Int16Array(buf.buffer, buf.byteOffset + 44, (buf.length - 44) / 2);
  const float32 = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) {
    float32[i] = pcm[i] / 32768.0;
  }
  console.log(`Total duration: ${(float32.length / 16000).toFixed(1)}s. Transcribing full song...`);
  
  const out = await transcriber(float32, {
    return_timestamps: 'word',
    chunk_length_s: 30,
    stride_length_s: 5
  });

  console.log('Full transcription complete! Chunks count:', out.chunks?.length);
  
  // Clean chunks into standard TimedWord array
  const words = [];
  if (out.chunks) {
    for (const chunk of out.chunks) {
      const text = chunk.text.trim();
      if (!text || text === '[MUSIC]' || text === '[APPLAUSE]') continue;
      if (!chunk.timestamp || chunk.timestamp.length < 2) continue;
      const start = Number(chunk.timestamp[0].toFixed(2));
      const end = Number(chunk.timestamp[1].toFixed(2));
      if (end <= start) continue;
      words.push({ text, start, end });
    }
  }

  // Also read lyrics.txt and align exact lyric words if applicable
  const lyricsTxt = fs.readFileSync('lyrics.txt', 'utf-8');
  console.log(`Extracted ${words.length} timed words.`);

  fs.writeFileSync('timings_whisper.json', JSON.stringify(words, null, 2));
  console.log('Saved to timings_whisper.json');
}

run().catch(err => {
  console.error('Transcription error:', err);
  process.exit(1);
});
