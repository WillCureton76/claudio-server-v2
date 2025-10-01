// Faster-Whisper WebSocket STT handler
// Streams PCM audio in, returns JSON transcripts out
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class WhisperSTT {
  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'whisper-stt');
    if (!fs.existsSync(this.tempDir)) fs.mkdirSync(this.tempDir, { recursive: true });
  }

  // Handle WebSocket connection for STT
  handleWebSocket(ws) {
    console.log('[STT] WebSocket client connected');

    let audioBuffer = Buffer.alloc(0);
    let isProcessing = false;
    let sessionId = Date.now();

    ws.on('message', async (data) => {
      try {
        // Check if it's a control message
        if (typeof data === 'string') {
          const msg = JSON.parse(data);

          if (msg.type === 'stop') {
            // User stopped talking - transcribe accumulated audio
            console.log('[STT] Stop signal received, transcribing...');
            await this.transcribeBuffer(audioBuffer, ws, sessionId);
            audioBuffer = Buffer.alloc(0); // Reset buffer
            return;
          }

          if (msg.type === 'reset') {
            console.log('[STT] Reset signal');
            audioBuffer = Buffer.alloc(0);
            ws.send(JSON.stringify({ type: 'reset', text: '' }));
            return;
          }
        }

        // It's audio data (binary)
        if (Buffer.isBuffer(data)) {
          audioBuffer = Buffer.concat([audioBuffer, data]);

          // Auto-transcribe every 3 seconds of audio (48000 bytes = ~1.5sec at 16kHz mono)
          if (audioBuffer.length >= 96000 && !isProcessing) {
            isProcessing = true;
            const chunk = audioBuffer.slice(0, 96000);
            audioBuffer = audioBuffer.slice(96000);

            await this.transcribeBuffer(chunk, ws, sessionId, true); // partial=true
            isProcessing = false;
          }
        }

      } catch (err) {
        console.error('[STT] Error processing message:', err);
        ws.send(JSON.stringify({ type: 'error', text: err.message }));
      }
    });

    ws.on('close', () => {
      console.log('[STT] WebSocket client disconnected');
    });

    ws.on('error', (err) => {
      console.error('[STT] WebSocket error:', err);
    });
  }

  async transcribeBuffer(buffer, ws, sessionId, partial = false) {
    if (buffer.length === 0) return;

    const audioFile = path.join(this.tempDir, `audio-${sessionId}-${Date.now()}.wav`);

    try {
      // Write PCM as WAV (16kHz, mono, 16-bit)
      this.writeWav(buffer, audioFile);

      // Transcribe using faster-whisper CLI (if available) or fallback to whisper.cpp
      const text = await this.runWhisper(audioFile);

      if (text && text.trim()) {
        ws.send(JSON.stringify({
          type: partial ? 'partial' : 'final',
          text: text.trim()
        }));
        console.log(`[STT] ${partial ? 'Partial' : 'Final'}: ${text.trim()}`);
      }

      // Cleanup
      fs.unlinkSync(audioFile);

    } catch (err) {
      console.error('[STT] Transcription error:', err);
      ws.send(JSON.stringify({ type: 'error', text: err.message }));
    }
  }

  writeWav(pcmBuffer, outputPath) {
    const sampleRate = 16000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    const dataSize = pcmBuffer.length;

    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // fmt chunk size
    header.writeUInt16LE(1, 20); // audio format (PCM)
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    fs.writeFileSync(outputPath, Buffer.concat([header, pcmBuffer]));
  }

  async runWhisper(audioFile) {
    return new Promise((resolve, reject) => {
      // Try faster-whisper-server first (if running), otherwise use OpenAI Whisper API as fallback

      // Check if WHISPER_ENDPOINT is set (local faster-whisper instance)
      const whisperEndpoint = process.env.WHISPER_ENDPOINT;

      if (whisperEndpoint) {
        // Use local faster-whisper server
        this.transcribeViaHTTP(audioFile, whisperEndpoint)
          .then(resolve)
          .catch(() => {
            console.warn('[STT] Local Whisper failed, falling back to OpenAI');
            this.transcribeViaOpenAI(audioFile).then(resolve).catch(reject);
          });
      } else {
        // Fallback to OpenAI Whisper API
        this.transcribeViaOpenAI(audioFile).then(resolve).catch(reject);
      }
    });
  }

  async transcribeViaHTTP(audioFile, endpoint) {
    const FormData = require('form-data');
    const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

    const form = new FormData();
    form.append('file', fs.createReadStream(audioFile));
    form.append('model', 'base'); // or 'small', 'medium', 'large'

    const response = await fetch(`${endpoint}/transcribe`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();
    return result.text || '';
  }

  async transcribeViaOpenAI(audioFile) {
    const FormData = require('form-data');
    const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

    const form = new FormData();
    form.append('file', fs.createReadStream(audioFile), { filename: 'audio.wav' });
    form.append('model', 'whisper-1');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        ...form.getHeaders()
      },
      body: form
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI Whisper API error: ${err}`);
    }

    const result = await response.json();
    return result.text || '';
  }
}

module.exports = { WhisperSTT };