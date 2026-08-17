const SANDBOX = "https://api-m.sandbox.paypal.com";
const LIVE = "https://api-m.paypal.com";

function env(name) { return String(process.env[name] || "").trim(); }
export function paypalEnvironment() { return env("PAYPAL_ENVIRONMENT").toLowerCase() === "live" ? "live" : "sandbox"; }
function base() { return paypalEnvironment() === "live" ? LIVE : SANDBOX; }

async function oauth(fetchImpl = fetch) {
  const id = env("PAYPAL_CLIENT_ID");
  const secret = env("PAYPAL_CLIENT_SECRET");
  if (!id || !secret) throw new Error("Faltan PAYPAL_CLIENT_ID/PAYPAL_CLIENT_SECRET.");
  const response = await fetchImpl(`${base()}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`, "utf8").toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.access_token) throw new Error(`PayPal OAuth HTTP ${response.status}: ${data?.error_description || data?.message || "error"}`);
  return data.access_token;
}

async function paypal(path, { method = "GET", body = null, fetchImpl = fetch } = {}) {
  const access = await oauth(fetchImpl);
  const response = await fetchImpl(`${base()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
  if (!response.ok) throw new Error(`PayPal HTTP ${response.status}: ${data?.message || data?.name || raw || "error"}`);
  return data;
}

export async function createPayPalCheckout({ userId, phone, fetchImpl = fetch }) {
  const planId = env("PAYPAL_PLAN_ID");
  if (!planId) throw new Error("Falta PAYPAL_PLAN_ID.");
  if (!/^usr_[a-f0-9]{32}$/.test(String(userId || ""))) throw new Error("user_id Cartes inválido.");
  const backUrl =
    env("CARTES_PLUS_BACK_URL") ||
    "https://develandoelcodigomasonico.com/cartes-whatsapp/suscripcion.html";

  // CARTES_PAYPAL_RETURN_V112
  const returnTarget = new URL(backUrl);
  returnTarget.searchParams.set("provider", "paypal");
  returnTarget.searchParams.set("result", "success");

  const cancelTarget = new URL(backUrl);
  cancelTarget.searchParams.set("provider", "paypal");
  cancelTarget.searchParams.set("result", "cancel");

  const returnUrl = returnTarget.toString();
  const cancelUrl = cancelTarget.toString();

  const data = await paypal("/v1/billing/subscriptions", {
    method: "POST",
    body: {
      plan_id: planId,
      custom_id: userId,
      application_context: { brand_name: "Cartes", user_action: "SUBSCRIBE_NOW", return_url: returnUrl, cancel_url: cancelUrl }
    },
    fetchImpl
  });
  const approve = (Array.isArray(data?.links) ? data.links : []).find((x) => x?.rel === "approve")?.href;
  if (!data?.id || !approve) throw new Error("PayPal no devolvió el enlace de aprobación.");
  return { provider: "paypal", subscription_id: String(data.id), url: String(approve), user_id: userId, phone: String(phone || "").replace(/\D/g, "") };
}

export async function getPayPalSubscription(id, fetchImpl = fetch) {
  return paypal(`/v1/billing/subscriptions/${encodeURIComponent(String(id))}`, { fetchImpl });
}

export async function cancelPayPalSubscription(id, fetchImpl = fetch) {
  return paypal(`/v1/billing/subscriptions/${encodeURIComponent(String(id))}/cancel`, { method: "POST", body: { reason: "Cancelación solicitada por el usuario de Cartes." }, fetchImpl });
}

export async function verifyPayPalWebhook(request, event, fetchImpl = fetch) {
  const webhookId = env("PAYPAL_WEBHOOK_ID");
  if (!webhookId) throw new Error("Falta PAYPAL_WEBHOOK_ID.");
  const access = await oauth(fetchImpl);
  const body = {
    transmission_id: request.headers.get("paypal-transmission-id") || "",
    transmission_time: request.headers.get("paypal-transmission-time") || "",
    cert_url: request.headers.get("paypal-cert-url") || "",
    auth_algo: request.headers.get("paypal-auth-algo") || "",
    transmission_sig: request.headers.get("paypal-transmission-sig") || "",
    webhook_id: webhookId,
    webhook_event: event
  };
  const response = await fetchImpl(`${base()}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`PayPal verify webhook HTTP ${response.status}: ${data?.message || "error"}`);
  return String(data?.verification_status || "").toUpperCase() === "SUCCESS";
}

export function normalizePayPalSubscription(remote, existing = null) {
  const providerStatus = String(remote?.status || existing?.provider_status || "UNKNOWN").toUpperCase();
  let status = "unknown";
  if (providerStatus === "ACTIVE") status = "authorized";
  else if (providerStatus === "SUSPENDED") status = "paused";
  else if (["CANCELLED", "EXPIRED"].includes(providerStatus)) status = "cancelled";
  else if (["APPROVAL_PENDING", "APPROVED"].includes(providerStatus)) status = "pending";
  const cancelled = status === "cancelled";
  const next = remote?.billing_info?.next_billing_time || existing?.next_payment_date || null;
  return {
    ...(existing || {}), provider: "paypal", status, provider_status: providerStatus,
    renovacion_cancelada: cancelled, access_until: cancelled ? (next || existing?.access_until || null) : null,
    subscription_id: String(remote?.id || existing?.subscription_id || ""),
    plan_id: String(remote?.plan_id || existing?.plan_id || ""), custom_id: String(remote?.custom_id || existing?.custom_id || ""),
    next_payment_date: next, payer_id: remote?.subscriber?.payer_id || existing?.payer_id || null,
    email: remote?.subscriber?.email_address || existing?.email || null,
    updated_at: new Date().toISOString()
  };
}
