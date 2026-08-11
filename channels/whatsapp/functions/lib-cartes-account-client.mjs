import crypto from "node:crypto";

const ACCOUNT_API_URL =
  process.env.DEPLOY_PRIME_URL
    ? `${process.env.DEPLOY_PRIME_URL}/.netlify/functions/cartes-account`
    : process.env.CARTES_ACCOUNT_API_URL ||
      "https://develandoelcodigomasonico.com/.netlify/functions/cartes-account";
			
const TIMEOUT_MS = 12000;

export function cuentaCentralConfigurada() {
  return Boolean(String(process.env.CARTES_INTERNAL_SECRET || "").trim());
}

export async function resolverUsuarioCentral({ identityType, identityValue, fetchImpl = fetch }) {
  return llamarCuenta({ action: "resolve", identity_type: identityType, identity_value: identityValue }, fetchImpl);
}
export async function sincronizarPlanCentral({ userId, plan, fetchImpl = fetch }) {
  return llamarCuenta({ action: "sync_plan", user_id: userId, plan, source: "whatsapp" }, fetchImpl);
}
export async function obtenerUsoCentral({ userId, plan, fetchImpl = fetch }) {
  return llamarCuenta({ action: "state", user_id: userId, plan }, fetchImpl);
}
export async function reservarUsoCentral({ userId, plan, requestId, fetchImpl = fetch }) {
  return llamarCuenta({ action: "reserve", user_id: userId, plan, request_id: requestId, channel: "whatsapp" }, fetchImpl);
}
export async function completarUsoCentral({ userId, periodo, requestId, fetchImpl = fetch }) {
  return llamarCuenta({ action: "complete", user_id: userId, periodo, request_id: requestId }, fetchImpl);
}
export async function liberarUsoCentral({ userId, periodo, requestId, fetchImpl = fetch }) {
  return llamarCuenta({ action: "release", user_id: userId, periodo, request_id: requestId }, fetchImpl);
}
export async function completarVinculacionCentral({ userId, code, fetchImpl = fetch }) {
  return llamarCuenta({ action: "link_complete", user_id: userId, code }, fetchImpl);
}
export async function sincronizarSuscripcionCentral({ userId, subscription, source = "mercadopago", fetchImpl = fetch }) {
  return llamarCuenta({ action: "subscription_sync", user_id: userId, subscription, source }, fetchImpl);
}
export async function obtenerSuscripcionCentral({ userId, fetchImpl = fetch }) {
  return llamarCuenta({ action: "subscription_get", user_id: userId }, fetchImpl);
}

async function llamarCuenta(payload, fetchImpl) {
  const secret = String(process.env.CARTES_INTERNAL_SECRET || "").trim();
  if (!secret) throw new Error("CARTES_INTERNAL_SECRET no está configurado.");
  const raw = JSON.stringify(payload);
  const timestamp = String(Date.now());
  const signature = crypto.createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(ACCOUNT_API_URL, { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json", "X-Cartes-Timestamp": timestamp, "X-Cartes-Signature": signature }, body: raw });
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { throw new Error("Cartes Account devolvió una respuesta no JSON."); }
    if (!response.ok) throw new Error(data?.error || `Cartes Account respondió HTTP ${response.status}.`);
    return data;
  } finally { clearTimeout(timeout); }
}
