// Quick test to verify the server starts
require('dotenv').config();
console.log('✅ Environment loaded');
console.log('OpenAI Key:', process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET');
console.log('Azure Key:', process.env.AZURE_SPEECH_KEY ? 'SET' : 'NOT SET');

const express = require('express');
const app = express();
console.log('✅ Express loaded');

const expressWs = require('express-ws');
expressWs(app);
console.log('✅ WebSocket support loaded');

const { WhisperSTT } = require('./stt-whisper');
const { AzureTTS } = require('./tts-azure');
console.log('✅ STT and TTS modules loaded');

app.get('/test', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`✅ Server started on port ${PORT}`);
  console.log('All modules loaded successfully!');
  process.exit(0);
});
