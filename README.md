# Plain Voice Server v3 (Responses-only + DIA-only, **boot enabled***)

Endpoints:
- `POST /boot` → creates a conversation and seeds `persona.md` as the first **system** message.
- `POST /respond` → streams **GPT-5** text as NDJSON `{ "delta": "..." }`
- `GET /tts-dia?text=...&voice=...` → proxies **self-host DIA** (audio/mpeg)
- `GET /healthz` → health check
- Conversations (in-memory): `/conversation/init|append|snapshot`

## Quick start
```bash
cd server
cp .env.example .env
# set OPENAI_API_KEY and DIA_TTS_ENDPOINT
npm install
npm start
```

Persona:
- Put your core instructions in `server/persona.md` (copy from `persona.example.md`).
# Moneypenny MCP Integration Active
