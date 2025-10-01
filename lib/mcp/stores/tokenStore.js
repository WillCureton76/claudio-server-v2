// Token store (Postgres or in-memory), keyed by (provider, subject)
async function getTokenStore(databaseUrl) {
  if (databaseUrl) {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: databaseUrl, max: 3 });
    await pool.query(`
      create table if not exists oauth_tokens (
        provider text not null,
        subject text not null,
        access_token text not null,
        refresh_token text,
        expires_at timestamptz,
        scope text,
        workspace_id text,
        workspace_name text,
        bot_id text,
        raw jsonb,
        created_at timestamptz default now(),
        updated_at timestamptz default now(),
        primary key (provider, subject)
      );
    `);
    return {
      async upsertToken(r) {
        await pool.query(
          `insert into oauth_tokens
            (provider, subject, access_token, refresh_token, expires_at, scope, workspace_id, workspace_name, bot_id, raw)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           on conflict (provider, subject) do update set
             access_token = excluded.access_token,
             refresh_token = excluded.refresh_token,
             expires_at = excluded.expires_at,
             scope = excluded.scope,
             workspace_id = excluded.workspace_id,
             workspace_name = excluded.workspace_name,
             bot_id = excluded.bot_id,
             raw = excluded.raw,
             updated_at = now()`,
          [
            r.provider, r.subject, r.access_token, r.refresh_token ?? null,
            r.expires_at ? new Date(r.expires_at) : null,
            r.scope ?? null, r.workspace_id ?? null, r.workspace_name ?? null,
            r.bot_id ?? null, r.raw ?? null
          ]
        );
      },
      async getToken(provider, subject='default') {
        const { rows } = await pool.query(
          `select provider, subject, access_token, refresh_token,
                  case when expires_at is null then null else to_char(expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') end as expires_at,
                  scope, workspace_id, workspace_name, bot_id, raw,
                  to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
                  to_char(updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') as updated_at
           from oauth_tokens where provider=$1 and subject=$2`,
          [provider, subject]
        );
        return rows[0] || null;
      }
    };
  }
  // In-memory fallback
  const map = new Map();
  return {
    async upsertToken(r) {
      const key = `${r.provider}:${r.subject}`;
      const now = new Date().toISOString();
      const prev = map.get(key);
      map.set(key, { ...r, updated_at: now, created_at: prev?.created_at ?? now });
    },
    async getToken(provider, subject='default') {
      return map.get(`${provider}:${subject}`) || null;
    }
  };
}

module.exports = { getTokenStore };