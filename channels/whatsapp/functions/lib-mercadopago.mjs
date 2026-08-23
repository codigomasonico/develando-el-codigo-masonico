import { CARTES_PLUS_PRICE_MXN } from "../../../core/ai/config.mjs";
import crypto from "node:crypto";

const API = "https://api.mercadopago.com";
const PRICE = CARTES_PLUS_PRICE_MXN;

function env(name) { return String(process.env[name] || "").trim(); }

function mercadoPagoEnvironment() {
  const explicit = env("MERCADOPAGO_ENVIRONMENT").toLowerCase();
  if (["test", "sandbox"].includes(explicit)) return "test";
  if (["production", "prod", "live"].includes(explicit)) return "production";
  if (explicit) {
    throw new Error('MERCADOPAGO_ENVIRONMENT debe ser "test" o "production".');
  }

  const hasTest =
    Boolean(env("MERCADOPAGO_TEST_ACCESS_TOKEN")) ||
    Boolean(env("MERCADOPAGO_TEST_WEBHOOK_SECRET"));
  const hasProduction =
    Boolean(env("MERCADOPAGO_ACCESS_TOKEN")) ||
    Boolean(env("MERCADOPAGO_WEBHOOK_SECRET"));

  if (hasTest && !hasProduction) return "test";
  if (hasProduction && !hasTest) return "production";
  if (hasTest && hasProduction) {
    throw new Error("Hay credenciales Mercado Pago TEST y producción simultáneamente. Define MERCADOPAGO_ENVIRONMENT para seleccionar el entorno.");
  }

  throw new Error("Faltan credenciales de Mercado Pago.");
}

function token() {
  const environment = mercadoPagoEnvironment();
  const name = environment === "test"
    ? "MERCADOPAGO_TEST_ACCESS_TOKEN"
    : "MERCADOPAGO_ACCESS_TOKEN";
  const value = env(name);
  if (!value) throw new Error(`Falta ${name}.`);
  return value;
}

function webhookSecret() {
  const environment = mercadoPagoEnvironment();
  const name = environment === "test"
    ? "MERCADOPAGO_TEST_WEBHOOK_SECRET"
    : "MERCADOPAGO_WEBHOOK_SECRET";
  const value = env(name);
  if (!value) throw new Error(`Falta ${name}.`);
  return value;
}

async function mp(path, { method = "GET", body = null, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
  if (!response.ok) throw new Error(`Mercado Pago HTTP ${response.status}: ${data?.message || data?.error || raw || "error"}`);
  return data;
}

export async function createMercadoPagoCheckout({ userId, phone, fetchImpl = fetch }) {
  if (!/^usr_[a-f0-9]{32}$/.test(String(userId || ""))) throw new Error("user_id Cartes inválido.");
  const backUrl = env("CARTES_PLUS_BACK_URL") || "https://develandoelcodigomasonico.com/cartes-whatsapp/suscripcion.html";
  const auto_recurring = { frequency: 1, frequency_type: "months", transaction_amount: PRICE, currency_id: "MXN" };
  const trial = Number.parseInt(env("CARTES_PLUS_TRIAL_DAYS") || "0", 10);
  if (Number.isInteger(trial) && trial > 0 && trial <= 365) auto_recurring.free_trial = { frequency: trial, frequency_type: "days" };
  const data = await mp("/preapproval_plan", {
    method: "POST",
    body: { reason: "Cartes Plus", auto_recurring, back_url: backUrl },
    fetchImpl
  });
  if (!data?.id || !data?.init_point) throw new Error("Mercado Pago no devolvió el enlace de suscripción.");
  return { provider: "mercadopago", plan_id: String(data.id), url: String(data.init_point), user_id: userId, phone: String(phone || "").replace(/\D/g, "") };
}

export async function getMercadoPagoSubscription(id, fetchImpl = fetch) {
  return mp(`/preapproval/${encodeURIComponent(String(id))}`, { fetchImpl });
}

export async function cancelMercadoPagoSubscription(id, fetchImpl = fetch) {
  return mp(`/preapproval/${encodeURIComponent(String(id))}`, { method: "PUT", body: { status: "cancelled" }, fetchImpl });
}

export function verifyMercadoPagoWebhook({ xSignature, xRequestId, dataId, secret = webhookSecret() }) {
  const signature = String(xSignature || "").trim();
  const requestId = String(xRequestId || "").trim();
  const sec = String(secret || "").trim();
  if (!signature || !sec) return false;
  const parts = {};
  for (const p of signature.split(",")) {
    const [k, ...rest] = p.trim().split("=");
    if (k) parts[k] = rest.join("=").trim();
  }
  const ts = String(parts.ts || "").trim();
  const received = String(parts.v1 || "").trim().toLowerCase();
  if (!ts || !/^[a-f0-9]{64}$/.test(received)) return false;
  const id = String(dataId || "").trim().toLowerCase();
  const manifest = `${id ? `id:${id};` : ""}${requestId ? `request-id:${requestId};` : ""}ts:${ts};`;
  const expected = crypto.createHmac("sha256", sec).update(manifest, "utf8").digest("hex");
  const a = Buffer.from(received, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function normalizeMercadoPagoSubscription(remote, existing = null) {
  const statusRaw = String(remote?.status || existing?.status || "unknown").toLowerCase();
  const status = statusRaw === "canceled" ? "cancelled" : statusRaw;
  const cancelled = status === "cancelled";
  return {
    ...(existing || {}),
    provider: "mercadopago",
    status,
    renovacion_cancelada: cancelled,
    access_until: cancelled ? (remote?.next_payment_date || existing?.access_until || existing?.next_payment_date || null) : null,
    preapproval_id: String(remote?.id || existing?.preapproval_id || ""),
    preapproval_plan_id: String(remote?.preapproval_plan_id || existing?.preapproval_plan_id || ""),
    next_payment_date: remote?.next_payment_date || existing?.next_payment_date || null,
    payer_email: remote?.payer_email || existing?.payer_email || null,
    precio: Number(remote?.auto_recurring?.transaction_amount || existing?.precio || PRICE),
    moneda: remote?.auto_recurring?.currency_id || existing?.moneda || "MXN",
    updated_at: new Date().toISOString()
  };
}
