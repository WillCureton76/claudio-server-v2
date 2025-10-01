async function getUsageStore(databaseUrl) {
  if (databaseUrl) {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: databaseUrl, max: 3 });
    await pool.query(`
      create table if not exists tool_usage (
        id serial primary key,
        provider text not null,
        tool_name text not null,
        subject text,
        success boolean not null,
        latency_ms integer,
        error_message text,
        created_at timestamptz default now()
      );
    `);
    return {
      async log(rec) {
        await pool.query(
          `insert into tool_usage (provider, tool_name, subject, success, latency_ms, error_message)
           values ($1,$2,$3,$4,$5,$6)`,
          [rec.provider, rec.tool_name, rec.subject ?? null, !!rec.success, rec.latency_ms ?? null, rec.error_message ?? null]
        );
      },
      async stats() {
        const totalRes = await pool.query(`select count(*)::int as total from tool_usage`);
        const provRes = await pool.query(`select provider, count(*)::int c from tool_usage group by provider`);
        const toolRes = await pool.query(`select provider||':'||tool_name as key, count(*)::int c from tool_usage group by provider, tool_name`);
        const byProvider = {}; for (const r of provRes.rows) byProvider[r.provider] = r.c;
        const byTool = {}; for (const r of toolRes.rows) byTool[r.key] = r.c;
        return { total: totalRes.rows[0].total, byProvider, byTool };
      }
    };
  }
  // In-memory fallback
  const arr = [];
  return {
    async log(rec){ arr.push(rec); },
    async stats(){
      const byProvider = {}, byTool = {};
      for (const r of arr) {
        byProvider[r.provider] = (byProvider[r.provider] || 0) + 1;
        const key = `${r.provider}:${r.tool_name}`;
        byTool[key] = (byTool[key] || 0) + 1;
      }
      return { total: arr.length, byProvider, byTool };
    }
  };
}

module.exports = { getUsageStore };