// Quick test script to verify MCP integration
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

async function testMCP() {
  const BASE = 'http://localhost:8787';

  console.log('🧪 Testing Moneypenny MCP Integration\n');

  // 1. Test MCP endpoint
  console.log('1️⃣ Testing /mcp endpoint...');
  try {
    const initRes = await fetch(`${BASE}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'initialize',
        params: {
          protocolVersion: '0.1.0',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' }
        }
      })
    });
    const sessionId = initRes.headers.get('mcp-session-id');
    console.log(`   ✅ MCP initialized, session: ${sessionId}\n`);

    // 2. List tools
    console.log('2️⃣ Listing MCP tools...');
    const toolsRes = await fetch(`${BASE}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'mcp-session-id': sessionId
      },
      body: JSON.stringify({
        method: 'tools/list'
      })
    });
    const toolsData = await toolsRes.json();
    console.log('   ✅ Available tools:');
    toolsData.result?.tools?.forEach(t => {
      console.log(`      - ${t.name}: ${t.description || 'No description'}`);
    });
    console.log('');

  } catch (e) {
    console.error('   ❌ MCP endpoint failed:', e.message);
  }

  // 3. Test boot
  console.log('3️⃣ Testing /boot endpoint...');
  try {
    const bootRes = await fetch(`${BASE}/boot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const bootData = await bootRes.json();
    console.log(`   ✅ Boot successful, conversation_id: ${bootData.conversation_id}\n`);
  } catch (e) {
    console.error('   ❌ Boot failed:', e.message);
  }

  // 4. Test providers endpoint
  console.log('4️⃣ Testing /providers endpoint...');
  try {
    const provRes = await fetch(`${BASE}/providers`);
    const provData = await provRes.json();
    console.log('   ✅ Providers:', provData.providers?.join(', '));
    console.log('   ✅ Total tools:', provData.tools?.length);
    console.log('');
  } catch (e) {
    console.error('   ❌ Providers failed:', e.message);
  }

  console.log('✨ Test complete!\n');
}

testMCP().catch(console.error);
