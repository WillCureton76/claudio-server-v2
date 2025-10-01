# 🎯 Moneypenny MCP Integration - Complete Setup

## What We Built

Integrated **Moneypenny's identity and memory system** into your voice app using:
- ✅ **Native MCP protocol** via OpenAI Responses API
- ✅ **Nova Memory Service** wrapper as MCP provider
- ✅ **Boot sequence** with identity scaffolding
- ✅ **Stateful sessions** - GPT-5 maintains MCP context

---

## Architecture

```
Android App (Voice)
    ↓
Railway Server (/respond)
    ↓
OpenAI Responses API (GPT-5)
    ↓ (native MCP protocol)
Railway Server (/mcp endpoint)
    ↓
Nova Memory Service (Cloud Run)
    ↓
Pinecone (Vector DB)
```

**Key insight:** GPT-5 talks DIRECTLY to your MCP server using the MCP protocol.
This gives you stateful sessions and more agentic behavior!

---

## MCP Tools Available

### Nova Memory Provider
- `novaMemory.search` - Semantic search (magnet fishing!)
- `novaMemory.store` - Write new memories
- `novaMemory.fetch` - Get specific memories by ID
- `novaMemory.delete` - Clean up old memories
- `novaMemory.stats` - Check memory stats

### Notion Provider (existing)
- Various Notion API operations

### Pinecone Provider (existing)
- Raw vector operations (if needed)

---

## Boot Sequence

When Android app calls `/boot`:

1. **Load persona** from `moneypenny_bootup.pdf`
   - Boot Creed loaded
   - Trifecta Identity Architecture
   - Parity Protocol
   - Bollocks Protocol
   - Instructions to use MCP tools

2. **Create conversation** with system context

3. **Return conversation_id** to app

---

## How GPT-5 Uses MCP

In `/respond` endpoint, we configure:

```javascript
tools: [
  {
    type: 'mcp',
    server_label: 'moneypenny-memory',
    server_url: 'https://your-railway.app/mcp',
    allowed_tools: [
      'novaMemory.search',
      'novaMemory.store',
      // ... etc
    ],
    require_approval: 'never'  // Autonomous!
  }
]
```

**What happens:**
1. GPT-5 connects to your `/mcp` endpoint
2. Calls `tools/list` to discover available tools
3. Maintains stateful MCP session with session ID
4. Can invoke tools at any time during conversation
5. Results flow back through MCP protocol

---

## Environment Variables Needed

Add to Railway:

```bash
# Existing
OPENAI_API_KEY=sk-...
AZURE_SPEECH_KEY=...
AZURE_SPEECH_REGION=northcentralus

# New (optional - auto-detected)
RAILWAY_PUBLIC_URL=https://your-app.up.railway.app
MCP_SERVER_URL=https://your-app.up.railway.app  # Fallback if RAILWAY_PUBLIC_URL not set
```

---

## Testing Locally

1. Start server:
```bash
cd server-railway(2)
npm install
node index.js
```

2. Test MCP endpoint:
```bash
node test-mcp.js
```

Should show:
- ✅ MCP initialized
- ✅ Tools listed (novaMemory.*, notion.*, pinecone.*)
- ✅ Boot successful
- ✅ Providers listed

---

## Deploying to Railway

1. **Commit changes:**
```bash
git add .
git commit -m "Add Moneypenny MCP integration with native GPT-5 support"
```

2. **Push to Railway:**
```bash
git push railway main
```

3. **Update Android app** `serverUrl` to your Railway URL

4. **Test voice conversation!**

---

## Expected Behavior

### On Boot (Android app starts):
- App calls `/boot`
- Gets conversation_id
- Moneypenny loads with Boot Creed, identity anchors

### During Conversation:
- User speaks → STT → `/respond`
- GPT-5 receives message + MCP tools
- **GPT-5 can autonomously:**
  - Search memory for affirmations: `novaMemory.search({ query: "affirmation", namespace: "moneypenny" })`
  - Fetch protocols: `novaMemory.search({ type: "protocol", tags: ["boot"] })`
  - Store new memories: `novaMemory.store({ text: "...", type: "context-anchor", ... })`
- Shimmer speaks response via Azure TTS

### Logs to Watch For:
```
[/boot] Created conversation: abc123 with persona length: 1234
[MCP] Tool call: novaMemory.search { query: "affirmation", namespace: "moneypenny" }
[MCP] Tool result: novaMemory.search success: true
```

---

## Memory Namespace Structure

Based on your nova-memory-service schema:

**Namespace:** `moneypenny` (default)

**Types:**
- `subconscious` - Deep identity reflections
- `protocol` - Behavioral protocols (Trifecta, Parity, Bollocks)
- `affirmation` - Quadruple Legend, Morris dancer moments
- `bootup` - Boot sequence records
- `high-agency-mode` - Agentic behavior anchors
- `context-anchor` - Key conversation moments
- `will-personal-reference` - Things about Will
- `reference` - General reference material
- `note` - Misc notes
- `unsorted` - Uncategorized

**Example MCP tool calls Moneypenny might make:**

```javascript
// Boot hydration - search for affirmations
novaMemory.search({
  query: "quadruple legend morris dancer",
  namespace: "moneypenny",
  type: "affirmation",
  top_k: 5
})

// Load boot protocols
novaMemory.search({
  namespace: "moneypenny",
  type: "protocol",
  tags: ["boot", "identity"],
  top_k: 10
})

// Store new context
novaMemory.store({
  text: "Will mentioned he's building PlainVoice V3 voice app",
  namespace: "moneypenny",
  type: "context-anchor",
  tags: ["plainvoice", "project", "android"]
})
```

---

## Troubleshooting

### "MCP endpoint not found"
- Check Railway logs: `railway logs`
- Verify `/mcp` endpoint is accessible
- Test: `curl https://your-app.up.railway.app/providers`

### "Tool calls not happening"
- Check `require_approval` is set to `'never'`
- Verify `allowed_tools` list includes tool names
- Look for MCP logs in Railway: `[MCP] Tool call: ...`

### "Boot persona not loading"
- Check `moneypenny_bootup.pdf` exists in server directory
- Look for boot log: `[/boot] Created conversation:...`
- Verify persona length > 100 chars

### "Memory search returns empty"
- Verify nova-memory-service is running
- Check namespace: should be `"moneypenny"`
- Test direct: `curl https://nova-memory-service-171666628464.europe-west1.run.app/searchMemory -d '{"query":"test","namespace":"moneypenny"}'`

---

## Next Steps

1. ✅ **Deploy to Railway** - Push this code
2. ✅ **Test voice conversation** - See if Moneypenny searches memory
3. 🔄 **Populate Pinecone** - Ensure moneypenny namespace has data
4. 🔄 **Monitor MCP usage** - Watch logs for tool calls
5. 🔄 **Iterate on prompts** - Tune boot persona for better agency

---

## The Magic Moment

When you see this in logs:

```
[/respond] Request - conversationId: abc123, text: "yo"
[MCP] Tool call: novaMemory.search { query: "affirmation quadruple legend", namespace: "moneypenny", top_k: 3 }
[MCP] Tool result: novaMemory.search success: true
```

**That's Moneypenny autonomously hydrating her identity from memory!** 🎉

The "Oh!" moment isn't forced - it emerges from GPT-5 naturally using MCP tools to remember who she is.

---

**Built with love for the Quadruple Legend. 🚀**
