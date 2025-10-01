const { randomUUID } = require('crypto');
const store = new Map();
function createConversation(seed = []) {
  const id = randomUUID();
  store.set(id, Array.isArray(seed) ? [...seed] : []);
  return id;
}
function append(id, ...msgs) {
  const arr = store.get(id);
  if (!arr) return;
  for (const m of msgs||[]) {
    if (m && ['system','user','assistant'].includes(m.role) && typeof m.text === 'string') {
      arr.push({ role: m.role, text: m.text });
    }
  }
}
function snapshot(id) { return store.get(id) || []; }
module.exports = { createConversation, append, snapshot };
