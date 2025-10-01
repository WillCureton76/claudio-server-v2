// Pinecone provider (API key). Supports core vector upsert/query and Assistant chat.
// Docs: Upsert: https://docs.pinecone.io/reference/api/latest/data-plane/upsert
//       Query:  https://docs.pinecone.io/reference/api/2024-10/data-plane/query
//       Assistant chat: https://docs.pinecone.io/reference/api/2025-01/assistant/chat_assistant

module.exports.init = function init({ z, tokenStore, usageStore, fetch }) {
  const name = 'pinecone';
  const API_KEY = process.env.PINECONE_API_KEY || '';
  const DEFAULT_INDEX_HOST = process.env.PINECONE_INDEX_HOST || ''; // e.g. https://my-index-xxxx.svc.us-east-1-aws.pinecone.io
  const BASE_API = 'https://api.pinecone.io'; // control-plane + assistant

  function requireKey(k){ if (!k) throw new Error('PINECONE_API_KEY missing. Set env or pass api_key'); }

  async function pineFetch(method, url, body, apiKey=API_KEY) {
    requireKey(apiKey);
    const headers = { 'Content-Type': 'application/json', 'Api-Key': apiKey };
    const res = await fetch(url, { method, headers, body: body?JSON.stringify(body):undefined });
    const text = await res.text();
    let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
    return { ok: res.ok, status: res.status, json };
  }

  function getHost(index_host) {
    const h = index_host || DEFAULT_INDEX_HOST;
    if (!h) throw new Error('index_host required (set PINECONE_INDEX_HOST or pass index_host)');
    return h.replace(/\/+$/,''); // trim trailing slash
  }

  const tools = [
    // ---- Vectors: upsert ----
    {
      name: 'pinecone.upsert',
      title: 'Pinecone: Upsert Vectors',
      description: 'Write vectors (id, values, metadata?) into a namespace at an index host',
      schema: z.object({
        api_key: z.string().optional(),
        index_host: z.string().url().optional(),
        namespace: z.string().optional(),
        vectors: z.array(z.object({
          id: z.string(),
          values: z.array(z.number()),
          metadata: z.record(z.any()).optional()
        }))
      }),
      handler: async (args) => {
        const host = getHost(args.index_host);
        const body = { vectors: args.vectors, ...(args.namespace?{namespace: args.namespace}:{}) };
        const r = await pineFetch('POST', `${host}/vectors/upsert`, body, args.api_key || API_KEY);
        if (!r.ok) throw new Error('upsert failed: ' + JSON.stringify(r.json));
        return { content: [{ type:'text', text: JSON.stringify(r.json, null, 2) }] };
      }
    },
    // ---- Vectors: query ----
    {
      name: 'pinecone.query',
      title: 'Pinecone: Query',
      description: 'Search a namespace using a query vector or by record id',
      schema: z.object({
        api_key: z.string().optional(),
        index_host: z.string().url().optional(),
        namespace: z.string().optional(),
        vector: z.array(z.number()).optional(),
        id: z.string().optional(),
        topK: z.number().int().min(1).max(100).default(10),
        filter: z.record(z.any()).optional(),
        includeValues: z.boolean().optional(),
        includeMetadata: z.boolean().optional()
      }).refine(v => !!(v.vector || v.id), { message: 'Provide either vector or id' }),
      handler: async (args) => {
        const host = getHost(args.index_host);
        const body = {
          topK: args.topK,
          ...(args.vector?{vector: args.vector}:{}) ,
          ...(args.id?{id: args.id}:{}) ,
          ...(args.namespace?{namespace: args.namespace}:{}) ,
          ...(args.filter?{filter: args.filter}:{}) ,
          ...(typeof args.includeValues === 'boolean' ? {includeValues: args.includeValues} : {}),
          ...(typeof args.includeMetadata === 'boolean' ? {includeMetadata: args.includeMetadata} : {})
        };
        const r = await pineFetch('POST', `${host}/query`, body, args.api_key || API_KEY);
        if (!r.ok) throw new Error('query failed: ' + JSON.stringify(r.json));
        return { content: [{ type:'text', text: JSON.stringify(r.json, null, 2) }] };
      }
    },
    // ---- Control plane: describe index (to get host) ----
    {
      name: 'pinecone.describeIndex',
      title: 'Pinecone: Describe Index',
      description: 'Describe an index by name via control-plane (returns host, dimension, status, etc.)',
      schema: z.object({
        api_key: z.string().optional(),
        index_name: z.string()
      }),
      handler: async (args) => {
        const r = await pineFetch('GET', `${BASE_API}/indexes/${encodeURIComponent(args.index_name)}`, undefined, args.api_key || API_KEY);
        if (!r.ok) throw new Error('describeIndex failed: ' + JSON.stringify(r.json));
        return { content: [{ type:'text', text: JSON.stringify(r.json, null, 2) }] };
      }
    },
    // ---- Assistant chat ----
    {
      name: 'pineconeAssistant.chat',
      title: 'Pinecone Assistant: Chat',
      description: 'Chat with a Pinecone Assistant by name. Returns message + optional citations.',
      schema: z.object({
        api_key: z.string().optional(),
        assistant_name: z.string(),
        messages: z.array(z.object({
          role: z.enum(['user','assistant','system']).default('user'),
          content: z.string()
        })).min(1)
      }),
      handler: async (args) => {
        const r = await pineFetch('POST', `${BASE_API}/chat/${encodeURIComponent(args.assistant_name)}`, { messages: args.messages }, args.api_key || API_KEY);
        if (!r.ok) throw new Error('assistant.chat failed: ' + JSON.stringify(r.json));
        return { content: [{ type:'text', text: JSON.stringify(r.json, null, 2) }] };
      }
    }
  ];

  // No OAuth routes for Pinecone (API key)
  function mountOAuth(app){ /* no-op */ }

  return { name, tools, mountOAuth };
};