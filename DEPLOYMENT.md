# PlainVoice Server - Deployment Guide

## 🚀 Quick Deploy to Railway

### 1. Install Dependencies

```bash
cd server-railway(2)
npm install express-ws form-data
```

### 2. Replace Files

Move the updated files into place:

```bash
# Backup old index.js
cp index.js index.js.old

# Use new index
cp index-updated.js index.js

# Update package.json
cp package-updated.json package.json
```

### 3. Set Environment Variables

Create `.env` file or set in Railway dashboard:

```env
OPENAI_API_KEY=your_openai_api_key_here
AZURE_SPEECH_REGION=eastus
PORT=8787

# Optional: If you want to use a local Faster-Whisper server instead of OpenAI Whisper API
# WHISPER_ENDPOINT=http://localhost:9090
```

### 4. Test Locally

```bash
npm start
```

Visit:
- Health: http://localhost:8787/healthz
- WebSocket STT: ws://localhost:8787/stt
- Azure TTS: http://localhost:8787/tts-azure?text=Hello+world

### 5. Deploy to Railway

```bash
# Push to Railway
git add .
git commit -m "Add WebSocket STT + Azure TTS"
git push railway main
```

Or connect via Railway dashboard:
1. Connect your GitHub repo
2. Set environment variables
3. Deploy automatically

### 6. Railway URL

Once deployed, your Railway URL will be something like:
```
https://your-app-name.up.railway.app
```

Update Android app settings to use this URL!

---

## 📱 Android App Setup

### 1. Build the App

```bash
cd plainvoice-android-full-1
./gradlew assembleDebug
```

### 2. Install on Device

```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

### 3. Configure Server URL

Open the app and enter:
- **Server URL:** `https://your-railway-app.up.railway.app` (or `http://10.0.2.2:8787` for local testing)
- **STT WS URL:** `wss://your-railway-app.up.railway.app/stt` (or `ws://10.0.2.2:8787/stt` for local)
- **Voice:** `en-US-EmmaMultilingualNeural` (Shimmer)

Tap "Connect" to boot the conversation.

---

## 🎯 How It Works

### Flow:

```
1. User taps/holds mic button
   ↓
2. Audio streams to Railway /stt WebSocket
   ↓
3. Faster-Whisper (or OpenAI Whisper API) transcribes
   ↓
4. Transcript sent to /respond (GPT-5 Responses API streaming)
   ↓
5. Deltas accumulate into sentences
   ↓
6. Each sentence sent to /tts-azure (Azure Shimmer voice)
   ↓
7. Audio plays on Android via ExoPlayer
```

### Mic Button Modes:

- **Tap to toggle:** Quick tap = start recording, tap again = stop & send
- **Press & hold (PTT):** Hold = record, release = stop & send
- Button detects which mode based on press duration (300ms threshold)

---

## 🔧 Troubleshooting

### STT Not Working

1. Check WebSocket connection in logs
2. Verify `WHISPER_ENDPOINT` is set (or OpenAI API key for fallback)
3. Test: `wscat -c ws://localhost:8787/stt` and send binary audio data

### TTS Not Playing

1. Check Azure key is correct
2. Test endpoint: `curl "http://localhost:8787/tts-azure?text=hello"`
3. Should return MP3 audio data

### Android App Can't Connect

1. For emulator, use `10.0.2.2` instead of `localhost`
2. For physical device, use Railway URL (not localhost)
3. Make sure HTTP (not HTTPS) for local testing

---

## ⚡ GPU Upgrade (For Speed)

When you're ready to make it Hume-level fast:

1. Go to Railway project settings
2. Upgrade to GPU instance (~$20-30/mo)
3. No code changes needed!
4. Latency drops from ~2-3s to ~500ms-1s

---

## 📊 Cost Breakdown

### Current Setup (CPU + OpenAI Whisper fallback):
- Railway CPU: $5/mo
- OpenAI Whisper API: ~$43/mo for 4hrs/day
- Azure TTS: ~$16/mo for 1M characters
- **Total: ~$64/mo**

### With GPU + Self-hosted Whisper:
- Railway GPU: ~$25/mo
- Azure TTS: ~$16/mo
- **Total: ~$41/mo** (saves $23/mo!)

---

## 🎉 You're Done!

Your voice assistant is ready. Test the full flow:

1. Tap mic → speak
2. Watch logs for STT transcript
3. Hear Shimmer respond with Azure TTS

Upgrade to GPU when you want Hume-level speed! 🚀