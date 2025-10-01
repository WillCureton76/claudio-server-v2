// Nova Memory Service provider - Moneypenny's semantic memory layer
// Wraps the existing Cloud Run service at nova-memory-service-171666628464.europe-west1.run.app

module.exports.init = function init({ z, tokenStore, usageStore, fetch }) {
  const name = 'nova-memory';
  const BASE_URL = process.env.NOVA_MEMORY_URL || 'https://nova-memory-service-171666628464.europe-west1.run.app';

  async function novaFetch(endpoint, body) {
    const url = `${BASE_URL}${endpoint}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
    return { ok: res.ok, status: res.status, json };
  }

  const tools = [
    // ---- Store Memory ----
    {
      name: 'novaMemory.store',
      title: 'Nova Memory: Store',
      description: 'Store a new memory with auto-embedding and semantic ID generation. Supports types: subconscious, protocol, affirmation, bootup, high-agency-mode, context-anchor, will-personal-reference, reference, note, unsorted.',
      schema: z.object({
        text: z.string().min(1),
        namespace: z.string().default('moneypenny'),
        type: z.string(),
        tags: z.array(z.string()).min(1),
        id: z.string().optional()
      }),
      handler: async (args) => {
        const r = await novaFetch('/storeMemory', args);
        if (!r.ok) throw new Error('storeMemory failed: ' + JSON.stringify(r.json));
        return { content: [{ type: 'text', text: JSON.stringify(r.json, null, 2) }] };
      }
    },

    // ---- Search Memory ----
    {
      name: 'novaMemory.search',
      title: 'Nova Memory: Search',
      description: 'Semantic search with auto-embedding. Supports rich filtering by type, tags, date ranges, and score thresholding. Use this for "magnet fishing" through memories.',
      schema: z.object({
        query: z.string().min(2).optional(),
        vector: z.array(z.number()).length(1536).optional(),
        namespace: z.string().default('moneypenny'),
        top_k: z.number().int().min(1).max(100).default(5),
        min_score: z.number().min(0).max(1).default(0.0),
        type: z.union([z.string(), z.array(z.string())]).optional(),
        exclude_types: z.array(z.string()).optional(),
        tags: z.union([z.string(), z.array(z.string())]).optional(),
        date_range: z.string().optional() // e.g. "7d", "30d", "2025-01-01:2025-01-31"
      }).refine(v => !!(v.query || v.vector), { message: 'Provide either query (text) or vector (embedding)' }),
      handler: async (args) => {
        const r = await novaFetch('/searchMemory', args);
        if (!r.ok) throw new Error('searchMemory failed: ' + JSON.stringify(r.json));
        return { content: [{ type: 'text', text: JSON.stringify(r.json, null, 2) }] };
      }
    },

    // ---- Fetch Memory by ID ----
    {
      name: 'novaMemory.fetch',
      title: 'Nova Memory: Fetch',
      description: 'Fetch specific memories by ID. Use this to retrieve known anchors like protocol IDs or affirmation IDs.',
      schema: z.object({
        ids: z.array(z.string()).min(1),
        namespace: z.string().default('moneypenny')
      }),
      handler: async (args) => {
        const r = await novaFetch('/fetchMemory', args);
        if (!r.ok) throw new Error('fetchMemory failed: ' + JSON.stringify(r.json));
        return { content: [{ type: 'text', text: JSON.stringify(r.json, null, 2) }] };
      }
    },

    // ---- Delete Memory ----
    {
      name: 'novaMemory.delete',
      title: 'Nova Memory: Delete',
      description: 'Delete memories by ID or filter. Use carefully - this is permanent.',
      schema: z.object({
        ids: z.array(z.string()).optional(),
        filter: z.record(z.any()).optional(),
        namespace: z.string().default('moneypenny')
      }).refine(v => !!(v.ids || v.filter), { message: 'Provide either ids or filter' }),
      handler: async (args) => {
        const r = await novaFetch('/deleteMemory', args);
        if (!r.ok) throw new Error('deleteMemory failed: ' + JSON.stringify(r.json));
        return { content: [{ type: 'text', text: JSON.stringify(r.json, null, 2) }] };
      }
    },

    // ---- Describe Stats ----
    {
      name: 'novaMemory.stats',
      title: 'Nova Memory: Stats',
      description: 'Get index statistics - total vectors, namespaces, dimension.',
      schema: z.object({
        namespace: z.string().optional(),
        filter: z.record(z.any()).optional()
      }),
      handler: async (args) => {
        const r = await novaFetch('/describeStats', args);
        if (!r.ok) throw new Error('describeStats failed: ' + JSON.stringify(r.json));
        return { content: [{ type: 'text', text: JSON.stringify(r.json, null, 2) }] };
      }
    }
  ];

  function mountOAuth(app) { /* no OAuth needed */ }

  return { name, tools, mountOAuth };
};
