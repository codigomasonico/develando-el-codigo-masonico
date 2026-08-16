const STORE_NAME = "cartes-whatsapp-v2";
const TTL_MS = 30 * 60 * 1000;

async function store() {
  const { getStore } = await import("@netlify/blobs");
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

export async function setFlow(userId, flow, data = {}) {
  const s = await store();
  const now = Date.now();
  await s.setJSON(`flow:${userId}`, {
    flow,
    data,
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + TTL_MS).toISOString()
  });
}

export async function getFlow(userId) {
  const s = await store();
  const value = await s.get(`flow:${userId}`, { type: "json", consistency: "strong" });
  if (!value) return null;
  if (Date.parse(String(value.expires_at || "")) <= Date.now()) {
    await s.delete(`flow:${userId}`);
    return null;
  }
  return value;
}

export async function clearFlow(userId) {
  const s = await store();
  await s.delete(`flow:${userId}`);
}

export async function savePaymentContext(provider, key, data) {
  const s = await store();
  await s.setJSON(`payment:${String(provider).toLowerCase()}:${String(key)}`, {
    ...data,
    updated_at: new Date().toISOString()
  });
}

export async function getPaymentContext(provider, key) {
  const s = await store();
  return s.get(`payment:${String(provider).toLowerCase()}:${String(key)}`, {
    type: "json",
    consistency: "strong"
  });
}

export async function claimInboundMessage(messageId) {
  const id = String(messageId || "").trim();
  if (!id) return false;
  const s = await store();
  const result = await s.setJSON(`message:${id}`, {
    message_id: id,
    claimed_at: new Date().toISOString()
  }, { onlyIfNew: true });
  return Boolean(result?.modified);
}

export async function releaseInboundMessage(messageId) {
  const id = String(messageId || "").trim();
  if (!id) return;
  const s = await store();
  await s.delete(`message:${id}`);
}
