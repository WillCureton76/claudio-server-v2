// Notion provider (OAuth or static token)
const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

function basicAuth(id, secret) {
  return 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64');
}

module.exports.init = function init({ z, tokenStore, usageStore, fetch }) {
  const cfg = {
    clientId: process.env.NOTION_CLIENT_ID || '',
    clientSecret: process.env.NOTION_CLIENT_SECRET || '',
    redirectUri: process.env.NOTION_REDIRECT_URI || '',
    staticToken: process.env.NOTION_STATIC_TOKEN || ''
  };

  const name = 'notion';

  async function notionFetch(token, endpoint, method='GET', data) {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json'
    };
    const res = await fetch(`${NOTION_API}/${endpoint}`, { method, headers, body: data ? JSON.stringify(data) : undefined });
    const text = await res.text();
    let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
    return { ok: res.ok, status: res.status, json };
  }

  async function getAccessToken(subject) {
    if (cfg.staticToken) return { token: cfg.staticToken, rec: null };
    const rec = await tokenStore.getToken(name, subject || 'default');
    if (!rec) throw new Error(`No Notion token for subject '${subject||'default'}'. Visit /auth/notion or set NOTION_STATIC_TOKEN.`);
    return { token: rec.access_token, rec };
  }

  async function refresh(refresh_token, rec) {
    const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Authorization': basicAuth(cfg.clientId, cfg.clientSecret) };
    const body = { grant_type: 'refresh_token', refresh_token };
    const res = await fetch(`${NOTION_API}/oauth/token`, { method: 'POST', headers, body: JSON.stringify(body) });
    const text = await res.text();
    let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
    if (!res.ok) throw new Error(`Notion refresh failed (${res.status}): ${JSON.stringify(json)}`);
    const newRec = {
      provider: name, subject: rec.subject,
      access_token: json.access_token, refresh_token: json.refresh_token || rec.refresh_token,
      scope: Array.isArray(json.scope) ? json.scope.join(' ') : (json.scope || rec.scope || null),
      workspace_id: json.workspace_id || rec.workspace_id, workspace_name: json.workspace_name || rec.workspace_name,
      bot_id: json.bot_id || rec.bot_id, raw: json
    };
    await tokenStore.upsertToken(newRec);
    return json.access_token;
  }

  const subjectSchema = z.object({ subject: z.string().optional() });

  const tools = [
    {
      name: 'notion.getSelf',
      title: 'Notion: Get Bot User',
      description: 'Returns the bot user and workspace for the current token',
      schema: subjectSchema,
      handler: async (args) => {
        const { token, rec } = await getAccessToken(args.subject);
        let r = await notionFetch(token, 'users/me', 'GET');
        if (!r.ok && r.status === 401 && rec?.refresh_token) {
          const nt = await refresh(rec.refresh_token, rec);
          r = await notionFetch(nt, 'users/me', 'GET');
        }
        if (!r.ok) throw new Error('getSelf failed: ' + JSON.stringify(r.json));
        return { content: [{ type: 'text', text: JSON.stringify(r.json, null, 2) }] };
      }
    },
    {
      name: 'notion.search',
      title: 'Notion: Search',
      description: 'Search your Notion workspace',
      schema: subjectSchema.extend({
        query: z.string().default(''),
        filter: z.any().optional(),
        sort: z.any().optional(),
        start_cursor: z.string().optional(),
        page_size: z.number().int().min(1).max(100).default(25)
      }),
      handler: async (args) => {
        const { token, rec } = await getAccessToken(args.subject);
        const body = { query: args.query, page_size: args.page_size, ...(args.filter?{filter:args.filter}:{}), ...(args.sort?{sort:args.sort}:{}) , ...(args.start_cursor?{start_cursor:args.start_cursor}:{}) };
        let r = await notionFetch(token, 'search', 'POST', body);
        if (!r.ok && r.status === 401 && rec?.refresh_token) {
          const nt = await refresh(rec.refresh_token, rec);
          r = await notionFetch(nt, 'search', 'POST', body);
        }
        if (!r.ok) throw new Error('search failed: ' + JSON.stringify(r.json));
        return { content: [{ type: 'text', text: JSON.stringify(r.json, null, 2) }] };
      }
    },
    {
      name: 'notion.fetchPage',
      title: 'Notion: Fetch Page',
      description: 'Fetch page metadata by ID',
      schema: subjectSchema.extend({ page_id: z.string() }),
      handler: async (args) => {
        const { token, rec } = await getAccessToken(args.subject);
        let r = await notionFetch(token, `pages/${args.page_id}`, 'GET');
        if (!r.ok && r.status === 401 && rec?.refresh_token) {
          const nt = await refresh(rec.refresh_token, rec);
          r = await notionFetch(nt, `pages/${args.page_id}`, 'GET');
        }
        if (!r.ok) throw new Error('fetchPage failed: ' + JSON.stringify(r.json));
        return { content: [{ type: 'text', text: JSON.stringify(r.json, null, 2) }] };
      }
    },
    {
      name: 'notion.queryDatabase',
      title: 'Notion: Query Database',
      description: 'Query a database with optional filter/sort',
      schema: subjectSchema.extend({
        database_id: z.string(),
        filter: z.any().optional(),
        sorts: z.any().optional(),
        start_cursor: z.string().optional(),
        page_size: z.number().int().min(1).max(100).default(25)
      }),
      handler: async (args) => {
        const { token, rec } = await getAccessToken(args.subject);
        const body = { page_size: args.page_size, ...(args.filter?{filter:args.filter}:{}) , ...(args.sorts?{sorts:args.sorts}:{}) , ...(args.start_cursor?{start_cursor:args.start_cursor}:{}) };
        let r = await notionFetch(token, `databases/${args.database_id}/query`, 'POST', body);
        if (!r.ok && r.status === 401 && rec?.refresh_token) {
          const nt = await refresh(rec.refresh_token, rec);
          r = await notionFetch(nt, `databases/${args.database_id}/query`, 'POST', body);
        }
        if (!r.ok) throw new Error('queryDatabase failed: ' + JSON.stringify(r.json));
        return { content: [{ type: 'text', text: JSON.stringify(r.json, null, 2) }] };
      }
    },
    {
      name: 'notion.createPage',
      title: 'Notion: Create Page',
      description: 'Create a new page (supply a parent and properties)',
      schema: subjectSchema.extend({
        parent: z.any(),
        properties: z.record(z.any()),
        children: z.array(z.any()).optional()
      }),
      handler: async (args) => {
        const { token, rec } = await getAccessToken(args.subject);
        const body = { parent: args.parent, properties: args.properties, ...(args.children?{children:args.children}:{}) };
        let r = await notionFetch(token, `pages`, 'POST', body);
        if (!r.ok && r.status === 401 && rec?.refresh_token) {
          const nt = await refresh(rec.refresh_token, rec);
          r = await notionFetch(nt, `pages`, 'POST', body);
        }
        if (!r.ok) throw new Error('createPage failed: ' + JSON.stringify(r.json));
        return { content: [{ type: 'text', text: JSON.stringify(r.json, null, 2) }] };
      }
    }
  ];

  function mountOAuth(app) {
    app.get('/auth/notion', (req,res)=>{
      if (cfg.staticToken) return res.status(200).send('Static token mode enabled; OAuth not required.');
      if (!cfg.clientId || !cfg.redirectUri) return res.status(400).send('Set NOTION_CLIENT_ID and NOTION_REDIRECT_URI');
      const state = Math.random().toString(36).slice(2);
      const url = new URL('https://api.notion.com/v1/oauth/authorize');
      url.searchParams.set('client_id', cfg.clientId);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('owner', 'user');
      url.searchParams.set('redirect_uri', cfg.redirectUri);
      url.searchParams.set('state', state);
      res.redirect(url.toString());
    });
    app.get('/oauth/notion/callback', async (req,res)=>{
      const code = String(req.query?.code||'');
      if (!code) return res.status(400).send('Missing code');
      try {
        const headers = { 'Accept':'application/json', 'Content-Type':'application/json', 'Authorization': basicAuth(cfg.clientId, cfg.clientSecret) };
        const body = { grant_type: 'authorization_code', code, redirect_uri: cfg.redirectUri };
        const r = await fetch(`${NOTION_API}/oauth/token`, { method:'POST', headers, body: JSON.stringify(body) });
        const text = await r.text(); let json = null; try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
        if (!r.ok) throw new Error(`Notion token exchange failed (${r.status}): ${JSON.stringify(json)}`);
        const subject = json.workspace_id || 'default';
        await tokenStore.upsertToken({
          provider: name, subject,
          access_token: json.access_token, refresh_token: json.refresh_token,
          scope: Array.isArray(json.scope)?json.scope.join(' '):(json.scope||null),
          workspace_id: json.workspace_id, workspace_name: json.workspace_name, bot_id: json.bot_id, raw: json
        });
        res.status(200).send('✅ Notion authorized. You can close this tab.');
      } catch(e) { res.status(500).send('❌ Notion OAuth failed: ' + (e?.message||String(e))); }
    });
  }

  return { name, tools, mountOAuth };
};