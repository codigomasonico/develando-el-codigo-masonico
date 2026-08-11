import crypto from "node:crypto";

export const ENTORNO_PRODUCCION = "production";
export const ENTORNO_PRUEBA = "test";

const MP_API_URL = "https://api.mercadopago.com";
const REQUEST_TIMEOUT_MS = 15000;
const PRECIO_CARTES_PLUS = 149;

export class MercadoPagoError extends Error {
  constructor(message, { status = 0, details = null } = {}) {
    super(message);
    this.name = "MercadoPagoError";
    this.status = status;
    this.details = details;
  }
}

export function normalizarEntorno(entorno) {
  return entorno === ENTORNO_PRUEBA ? ENTORNO_PRUEBA : ENTORNO_PRODUCCION;
}

export function obtenerConfiguracionMercadoPago(entorno) {
  const normalizado = normalizarEntorno(entorno);
  const esPrueba = normalizado === ENTORNO_PRUEBA;

  const accessToken = String(
    process.env[
      esPrueba
        ? "MERCADOPAGO_TEST_ACCESS_TOKEN"
        : "MERCADOPAGO_ACCESS_TOKEN"
    ] || ""
  ).trim();

  const webhookSecret = String(
    process.env[
      esPrueba
        ? "MERCADOPAGO_TEST_WEBHOOK_SECRET"
        : "MERCADOPAGO_WEBHOOK_SECRET"
    ] || ""
  ).trim();

  const applicationId = String(
    process.env[
      esPrueba
        ? "MERCADOPAGO_TEST_APPLICATION_ID"
        : "MERCADOPAGO_APPLICATION_ID"
    ] || ""
  ).trim();

  return {
    entorno: normalizado,
    accessToken,
    webhookSecret,
    applicationId
  };
}

export function construirPayloadPlan({ telefono, userId = null, entorno }) {
  const telefonoLimpio = String(telefono || "").replace(/\D/g, "");

  if (!/^\d{10,15}$/.test(telefonoLimpio)) {
    throw new Error("Teléfono inválido para crear el plan de Cartes Plus.");
  }

  const entornoNormalizado = normalizarEntorno(entorno);
  const user = String(userId || "").trim();
  const referencia = user && /^usr_[a-f0-9]{32}$/.test(user)
    ? `cartes-plus-user:${entornoNormalizado}:${user}:${Date.now()}`
    : `cartes-plus:${entornoNormalizado}:${telefonoLimpio}:${Date.now()}`;
  const backUrl =
    String(process.env.CARTES_PLUS_BACK_URL || "").trim() ||
    "https://develandoelcodigomasonico.com/cartes-whatsapp/suscripcion.html";

  const autoRecurring = {
    frequency: 1,
    frequency_type: "months",
    transaction_amount: PRECIO_CARTES_PLUS,
    currency_id: "MXN"
  };

  const trialDays = Number.parseInt(
    String(process.env.CARTES_PLUS_TRIAL_DAYS || "0"),
    10
  );

  if (Number.isInteger(trialDays) && trialDays > 0 && trialDays <= 365) {
    autoRecurring.free_trial = {
      frequency: trialDays,
      frequency_type: "days"
    };
  }

  return {
    reason: "Cartes Plus",
    auto_recurring: autoRecurring,
    back_url: backUrl,
    _cartes_reference: referencia
  };
}


export function construirPayloadPaqueteRevisiones({ telefono, fechaFin, entorno = ENTORNO_PRODUCCION }) {
  const telefonoLimpio = String(telefono || "").replace(/\D/g, "");
  const fin = new Date(fechaFin);
  if (!/^\d{10,15}$/.test(telefonoLimpio) || !Number.isFinite(fin.getTime())) {
    throw new Error("Datos inválidos para crear el pago del paquete de revisiones.");
  }
  const referencia = `cartes-revisiones:${normalizarEntorno(entorno)}:${telefonoLimpio}:${fin.getTime()}:${Date.now()}`;
  const baseUrl = String(process.env.CARTES_PLUS_BACK_URL || "https://develandoelcodigomasonico.com/cartes-whatsapp/suscripcion.html").trim();
  return {
    items: [{ id: "cartes-revisiones-3", title: "Paquete adicional de 3 revisiones Cartes", quantity: 1, currency_id: "MXN", unit_price: 99 }],
    external_reference: referencia,
    back_urls: { success: baseUrl, pending: baseUrl, failure: baseUrl },
    auto_return: "approved",
    metadata: { producto: "cartes_revisiones", telefono: telefonoLimpio, fecha_fin: fin.toISOString() }
  };
}

export async function crearPreferenciaPaqueteRevisiones({ telefono, fechaFin, entorno = ENTORNO_PRODUCCION, fetchImpl = fetch }) {
  const config = obtenerConfiguracionMercadoPago(entorno);
  exigirConfiguracion(config, { requiereWebhook: false });
  const payload = construirPayloadPaqueteRevisiones({ telefono, fechaFin, entorno: config.entorno });
  const data = await solicitarMercadoPago({ path: "/checkout/preferences", method: "POST", accessToken: config.accessToken, body: payload, fetchImpl });
  if (!data?.id || !(data?.init_point || data?.sandbox_init_point)) {
    throw new MercadoPagoError("Mercado Pago no devolvió el enlace del paquete de revisiones.", { details: data });
  }
  return { id: String(data.id), init_point: String(data.init_point || data.sandbox_init_point), external_reference: String(data.external_reference || payload.external_reference), fecha_fin: payload.metadata.fecha_fin };
}

export async function obtenerPagoMercadoPago(paymentId, entorno = ENTORNO_PRODUCCION, fetchImpl = fetch) {
  return obtenerRecursoMercadoPago({ path: `/v1/payments/${encodeURIComponent(String(paymentId))}`, entorno, fetchImpl });
}

export async function crearPlanMercadoPago({
  telefono,
  userId = null,
  entorno = ENTORNO_PRODUCCION,
  fetchImpl = fetch
}) {
  const config = obtenerConfiguracionMercadoPago(entorno);
  exigirConfiguracion(config, { requiereWebhook: false });

  const payload = construirPayloadPlan({ telefono, userId, entorno: config.entorno });
  const { _cartes_reference: referencia, ...payloadMercadoPago } = payload;
  const data = await solicitarMercadoPago({
    path: "/preapproval_plan",
    method: "POST",
    accessToken: config.accessToken,
    body: payloadMercadoPago,
    fetchImpl
  });

  if (!data?.id || !data?.init_point) {
    throw new MercadoPagoError(
      "Mercado Pago no devolvió el ID o el enlace del plan de suscripción.",
      { details: data }
    );
  }

  validarApplicationId(data.application_id, config);

  return {
    id: String(data.id),
    application_id: String(data.application_id || ""),
    collector_id: String(data.collector_id || ""),
    status: String(data.status || "active"),
    init_point: String(data.init_point),
    external_reference: String(data.external_reference || referencia),
    auto_recurring: data.auto_recurring || payload.auto_recurring,
    reason: String(data.reason || payload.reason),
    back_url: String(data.back_url || payload.back_url)
  };
}

export async function obtenerPlanMercadoPago(
  planId,
  entorno = ENTORNO_PRODUCCION,
  fetchImpl = fetch
) {
  return obtenerRecursoMercadoPago({
    path: `/preapproval_plan/${encodeURIComponent(String(planId))}`,
    entorno,
    fetchImpl
  });
}

export async function obtenerSuscripcionMercadoPago(
  preapprovalId,
  entorno = ENTORNO_PRODUCCION,
  fetchImpl = fetch
) {
  return obtenerRecursoMercadoPago({
    path: `/preapproval/${encodeURIComponent(String(preapprovalId))}`,
    entorno,
    fetchImpl
  });
}

export async function cancelarSuscripcionMercadoPago(
  preapprovalId,
  entorno = ENTORNO_PRODUCCION,
  fetchImpl = fetch
) {
  const config = obtenerConfiguracionMercadoPago(entorno);
  exigirConfiguracion(config, { requiereWebhook: false });
  const id = String(preapprovalId || "").trim();

  if (!id) {
    throw new Error("Falta el ID de la suscripción que se desea cancelar.");
  }

  let data;

  try {
    data = await solicitarMercadoPago({
      path: `/preapproval/${encodeURIComponent(id)}`,
      method: "PUT",
      accessToken: config.accessToken,
      body: { status: "cancelled" },
      fetchImpl
    });
  } catch (error) {
    const mensaje = String(error?.message || "");
    const esEstadoRechazado =
      error instanceof MercadoPagoError &&
      error.status === 400 &&
      /invalid preapproval status param/i.test(mensaje);

    if (!esEstadoRechazado) throw error;

    data = await solicitarMercadoPago({
      path: `/preapproval/${encodeURIComponent(id)}`,
      method: "PUT",
      accessToken: config.accessToken,
      body: { status: "canceled" },
      fetchImpl
    });
  }

  if (data?.application_id) {
    validarApplicationId(data.application_id, config);
  }

  return {
    ...data,
    id: String(data?.id || id),
    status: normalizarEstadoSuscripcion(data?.status || "cancelled")
  };
}

export function normalizarEstadoSuscripcion(status) {
  const valor = String(status || "unknown").trim().toLowerCase();
  return valor === "canceled" ? "cancelled" : valor;
}

export async function obtenerPagoAutorizadoMercadoPago(
  authorizedPaymentId,
  entorno = ENTORNO_PRODUCCION,
  fetchImpl = fetch
) {
  return obtenerRecursoMercadoPago({
    path: `/authorized_payments/${encodeURIComponent(
      String(authorizedPaymentId)
    )}`,
    entorno,
    fetchImpl
  });
}

async function obtenerRecursoMercadoPago({ path, entorno, fetchImpl }) {
  const config = obtenerConfiguracionMercadoPago(entorno);
  exigirConfiguracion(config, { requiereWebhook: false });

  const data = await solicitarMercadoPago({
    path,
    method: "GET",
    accessToken: config.accessToken,
    fetchImpl
  });

  if (data?.application_id) {
    validarApplicationId(data.application_id, config);
  }

  return data;
}

export function detectarEntornoWebhook({
  xSignature,
  xRequestId,
  dataId
}) {
  for (const entorno of [ENTORNO_PRODUCCION, ENTORNO_PRUEBA]) {
    const config = obtenerConfiguracionMercadoPago(entorno);

    if (!config.webhookSecret) {
      continue;
    }

    if (
      validarFirmaMercadoPago({
        xSignature,
        xRequestId,
        dataId,
        secret: config.webhookSecret
      })
    ) {
      return config;
    }
  }

  return null;
}

export function validarFirmaMercadoPago({
  xSignature,
  xRequestId,
  dataId,
  secret
}) {
  const firmaHeader = String(xSignature || "").trim();
  const requestId = String(xRequestId || "").trim();
  const secreto = String(secret || "").trim();

  if (!firmaHeader || !secreto) {
    return false;
  }

  const partes = {};

  for (const parte of firmaHeader.split(",")) {
    const [clave, ...resto] = parte.trim().split("=");
    if (clave) partes[clave] = resto.join("=").trim();
  }

  const ts = String(partes.ts || "").trim();
  const firmaRecibida = String(partes.v1 || "").trim().toLowerCase();

  if (!ts || !/^[a-f0-9]{64}$/.test(firmaRecibida)) {
    return false;
  }

  const campos = [];
  const idNormalizado = String(dataId || "").trim().toLowerCase();

  if (idNormalizado) campos.push(`id:${idNormalizado};`);
  if (requestId) campos.push(`request-id:${requestId};`);
  campos.push(`ts:${ts};`);

  const manifest = campos.join("");
  const firmaEsperada = crypto
    .createHmac("sha256", secreto)
    .update(manifest, "utf8")
    .digest("hex");

  const recibido = Buffer.from(firmaRecibida, "hex");
  const esperado = Buffer.from(firmaEsperada, "hex");

  return (
    recibido.length === esperado.length &&
    crypto.timingSafeEqual(recibido, esperado)
  );
}

export function validarApplicationId(applicationIdRecibido, config) {
  const esperado = String(config?.applicationId || "").trim();
  const recibido = String(applicationIdRecibido || "").trim();

  if (!esperado) {
    throw new Error(
      `Falta configurar el Application ID de Mercado Pago para el entorno ${
        config?.entorno || "desconocido"
      }.`
    );
  }

  if (!recibido || recibido !== esperado) {
    throw new MercadoPagoError(
      `Las credenciales de Mercado Pago no pertenecen a la aplicación esperada. Entorno: ${config.entorno}. Esperada: ${esperado}. Recibida: ${recibido || "vacía"}.`
    );
  }
}

function exigirConfiguracion(config, { requiereWebhook }) {
  if (!config.accessToken) {
    const variable =
      config.entorno === ENTORNO_PRUEBA
        ? "MERCADOPAGO_TEST_ACCESS_TOKEN"
        : "MERCADOPAGO_ACCESS_TOKEN";
    throw new Error(`Falta ${variable}.`);
  }

  if (!config.applicationId) {
    const variable =
      config.entorno === ENTORNO_PRUEBA
        ? "MERCADOPAGO_TEST_APPLICATION_ID"
        : "MERCADOPAGO_APPLICATION_ID";
    throw new Error(`Falta ${variable}.`);
  }

  if (requiereWebhook && !config.webhookSecret) {
    const variable =
      config.entorno === ENTORNO_PRUEBA
        ? "MERCADOPAGO_TEST_WEBHOOK_SECRET"
        : "MERCADOPAGO_WEBHOOK_SECRET";
    throw new Error(`Falta ${variable}.`);
  }
}

async function solicitarMercadoPago({
  path,
  method,
  accessToken,
  body,
  fetchImpl
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetchImpl(`${MP_API_URL}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });

    const raw = await response.text();
    let data = {};

    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      throw new MercadoPagoError(
        `Mercado Pago devolvió una respuesta no JSON con HTTP ${response.status}.`,
        { status: response.status, details: raw }
      );
    }

    if (!response.ok) {
      const mensaje =
        data?.message ||
        data?.error ||
        data?.cause?.[0]?.description ||
        `Mercado Pago respondió con HTTP ${response.status}.`;

      throw new MercadoPagoError(mensaje, {
        status: response.status,
        details: data
      });
    }

    return data;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new MercadoPagoError(
        "Mercado Pago excedió el tiempo máximo de respuesta."
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
