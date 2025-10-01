// MCP hub (modular, CommonJS).
// Mount this into your existing Express app without converting to ESM/TypeScript.
const { randomUUID } = require('crypto');
const { getTokenStore } = require('./stores/tokenStore');
const { getUsageStore } = require('./stores/usageStore');
const notionProvider = require('./providers/notion');
const pineconeProvider = require('./providers/pinecone');
const novaMemoryProvider = require('./providers/nova-memory');

// Optional: use Node 18+ global fetch, or fall back to node-fetch if needed.
const fetchFn = globalThis.fetch || ((...args) => import('node-fetch').then(({default: f}) => f(...args)));

async function mountMCP(app) {
  const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
  const { StreamableHTTPServerTransport } = await import('@modelcontextprotocol/sdk/server/streamableHttp.js');
  const { SSEServerTransport } = await import('@modelcontextprotocol/sdk/server/sse.js');
  const { z } = await import('zod');

  // ---- Storage ----
  const tokenStore = await getTokenStore(process.env.DATABASE_URL);
  const usageStore = await getUsageStore(process.env.DATABASE_URL);

  // ---- Providers ----
  const providers = [
    notionProvider.init({ z, tokenStore, usageStore, fetch: fetchFn }),
    pineconeProvider.init({ z, tokenStore, usageStore, fetch: fetchFn }),
    novaMemoryProvider.init({ z, tokenStore, usageStore, fetch: fetchFn }),
  ].filter(Boolean); // allow conditional providers later

  // Helper to register all tools from all providers
  function buildServer() {
    const server = new McpServer({ name: 'plain-voice-mcp-hub', version: '0.4.0' });
    for (const p of providers) {
      for (const t of p.tools) {
        server.registerTool(t.name, {
          title: t.title, description: t.description, inputSchema: t.schema
        }, async (args) => {
          const start = Date.now();
          try {
            const out = await t.handler(args);
            await usageStore.log({ provider: p.name, tool_name: t.name, success: true, latency_ms: Date.now()-start });
            return out;
          } catch (e) {
            await usageStore.log({ provider: p.name, tool_name: t.name, success: false, latency_ms: Date.now()-start, error_message: e?.message || String(e) });
            throw e;
          }
        });
      }
    }
    return server;
  }

  // ---- Optional shared-secret guard for MCP endpoints ----
  const SHARED_SECRET = process.env.SHARED_SECRET || '';
  function requireSharedSecret(req, res, next) {
    if (!SHARED_SECRET) return next();
    if (req.headers['x-mcp-key'] !== SHARED_SECRET) return res.status(401).json({ error: 'Unauthorized' });
    next();
  }

  // ---- Streamable HTTP transport (preferred) ----
  const transports = {};
  app.post('/mcp', requireSharedSecret, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    let transport;
    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else {
      const isInitialize = req.body?.method === 'initialize';
      if (!isInitialize) {
        return res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Bad Request: No valid session ID provided' } });
      }
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => { transports[sid] = transport; res.setHeader('Mcp-Session-Id', sid); },
      });
      const server = buildServer();
      await server.connect(transport);
    }
    await transport.handleRequest(req, res, req.body);
  });
  app.get('/mcp', requireSharedSecret, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    const transport = sessionId && transports[sessionId];
    if (!transport) return res.status(400).send('Invalid or missing session ID');
    await transport.handleRequest(req, res);
  });
  app.delete('/mcp', requireSharedSecret, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    const transport = sessionId && transports[sessionId];
    if (!transport) return res.status(400).send('Invalid or missing session ID');
    await transport.handleRequest(req, res);
  });

  // ---- Legacy SSE transport ----
  const sseTransports = {};
  app.get('/sse', requireSharedSecret, async (_req, res) => {
    const transport = new SSEServerTransport('/messages', res);
    sseTransports[transport.sessionId] = transport;
    res.on('close', () => { delete sseTransports[transport.sessionId]; });
    const server = buildServer();
    await server.connect(transport);
  });
  app.post('/messages', requireSharedSecret, async (req, res) => {
    const sessionId = String(req.query.sessionId || '');
    const transport = sseTransports[sessionId];
    if (!transport) return res.status(400).send('No transport found for sessionId');
    await transport.handlePostMessage(req, res, req.body);
  });

  // ---- Provider-specific auth routes (e.g., Notion OAuth) ----
  for (const p of providers) {
    if (typeof p.mountOAuth === 'function') p.mountOAuth(app);
  }

  // ---- Utility ----
  app.get('/providers', (_req, res) => {
    res.json({
      providers: providers.map(p => p.name),
      tools: providers.flatMap(p => p.tools.map(t => t.name))
    });
  });
  app.get('/health', (_req, res) => res.json({ ok: true, mcp: true, time: new Date().toISOString() }));

  console.log('[MCP] Mounted: /mcp (streamable), /sse + /messages (legacy), /providers, /health');
}

module.exports = { mountMCP };