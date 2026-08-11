import { getStore } from "@netlify/blobs";
import {
  ENTORNO_PRODUCCION,
  crearPlanMercadoPago,
  normalizarEntorno,
  obtenerConfiguracionMercadoPago,
  obtenerPlanMercadoPago
} from "./lib-mercadopago.mjs";

export const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v25.0";
const PREFIJO_MP = "mp-v3";
const CANCELACION_PENDIENTE_MS = 10 * 60 * 1000;

export function getCartesStore() {
  return getStore("cartes-whatsapp");
}

export async function guardarJSON(clave, valor) {
  const store = getCartesStore();
  await store.setJSON(clave, valor);
}

export async function leerJSON(clave) {
  const store = getCartesStore();
  return await store.get(clave, { type: "json", consistency: "strong" });
}

export async function eliminarClave(clave) {
  const store = getCartesStore();
  await store.delete(clave);
}

export async function obtenerOCrearEnlaceCartesPlus({
  telefono,
  userId = null,
  entorno = ENTORNO_PRODUCCION,
  forzarNuevo = false
}) {
  const telefonoLimpio = String(telefono || "").replace(/\D/g, "");
  const entornoNormalizado = normalizarEntorno(entorno);
  const config = obtenerConfiguracionMercadoPago(entornoNormalizado);
  const claveTelefono = clavePlanTelefono(entornoNormalizado, telefonoLimpio);

  if (!forzarNuevo) {
    const existente = await leerJSON(claveTelefono);

    if (
      existente?.plan_id &&
      existente?.init_point &&
      String(existente?.application_id || "") === config.applicationId
    ) {
      try {
        const planRemoto = await obtenerPlanMercadoPago(
          existente.plan_id,
          entornoNormalizado
        );

        if (String(planRemoto?.status || "active") === "active") {
          return existente;
        }
      } catch (error) {
        console.warn("No se pudo reutilizar el plan previo; se creará uno nuevo.", {
          entorno: entornoNormalizado,
          telefono: telefonoLimpio,
          planId: existente.plan_id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  const plan = await crearPlanMercadoPago({
    telefono: telefonoLimpio,
    userId,
    entorno: entornoNormalizado
  });

  const ahora = new Date().toISOString();
  const registro = {
    version: 3,
    entorno: entornoNormalizado,
    telefono: telefonoLimpio,
    user_id: userId || null,
    plan: "cartes_plus",
    precio: 149,
    moneda: "MXN",
    frecuencia: "monthly",
    plan_id: plan.id,
    application_id: plan.application_id,
    collector_id: plan.collector_id,
    status: plan.status,
    init_point: plan.init_point,
    external_reference: plan.external_reference,
    created_at: ahora,
    updated_at: ahora
  };

  await guardarJSON(clavePlan(entornoNormalizado, plan.id), registro);
  await guardarJSON(claveTelefono, registro);
  await guardarJSON(
    claveReferencia(entornoNormalizado, plan.external_reference),
    registro
  );

  return registro;
}

export async function buscarVinculoPlan({ entorno, planId }) {
  if (!planId) return null;
  return await leerJSON(clavePlan(normalizarEntorno(entorno), String(planId)));
}

export async function buscarSuscripcion({ entorno, preapprovalId }) {
  if (!preapprovalId) return null;
  return await leerJSON(
    claveSuscripcion(normalizarEntorno(entorno), String(preapprovalId))
  );
}

export async function guardarSuscripcion({ entorno, registro }) {
  const normalizado = normalizarEntorno(entorno);
  const preapprovalId = String(registro?.preapproval_id || "");

  if (!preapprovalId) {
    throw new Error("No se puede guardar una suscripción sin preapproval_id.");
  }

  await guardarJSON(claveSuscripcion(normalizado, preapprovalId), registro);

  if (registro.user_id) {
    await guardarJSON(
      `${PREFIJO_MP}:suscripcion-user:${normalizado}:${registro.user_id}`,
      registro
    );
  }

  if (registro.telefono) {
    for (const telefono of variantesTelefonoMexico(registro.telefono)) {
      await guardarJSON(
        `${PREFIJO_MP}:suscripcion-telefono:${normalizado}:${telefono}`,
        registro
      );
    }
  }

  return registro;
}

export async function buscarSuscripcionPorUserId({
  entorno = ENTORNO_PRODUCCION,
  userId
}) {
  const id = String(userId || "").trim();
  if (!/^usr_[a-f0-9]{32}$/.test(id)) return null;
  return await leerJSON(`${PREFIJO_MP}:suscripcion-user:${normalizarEntorno(entorno)}:${id}`);
}

export async function buscarSuscripcionPorTelefono({
  entorno = ENTORNO_PRODUCCION,
  telefono
}) {
  const normalizado = normalizarEntorno(entorno);

  for (const variante of variantesTelefonoMexico(telefono)) {
    const registro = await leerJSON(
      `${PREFIJO_MP}:suscripcion-telefono:${normalizado}:${variante}`
    );

    if (registro) return registro;
  }

  return null;
}

export async function guardarCancelacionPendiente({
  telefono,
  entorno = ENTORNO_PRODUCCION,
  preapprovalId,
  store = getCartesStore()
}) {
  const telefonoNormalizado = normalizarTelefonoMexico(telefono);
  const ahora = Date.now();
  const registro = {
    version: 1,
    telefono: telefonoNormalizado,
    entorno: normalizarEntorno(entorno),
    preapproval_id: String(preapprovalId || ""),
    created_at: new Date(ahora).toISOString(),
    expires_at: new Date(ahora + CANCELACION_PENDIENTE_MS).toISOString()
  };

  if (!telefonoNormalizado || !registro.preapproval_id) {
    throw new Error("No se puede preparar una cancelación sin teléfono e ID.");
  }

  await store.setJSON(claveCancelacionPendiente(telefonoNormalizado), registro);
  return registro;
}

export async function leerCancelacionPendiente({
  telefono,
  store = getCartesStore()
}) {
  const telefonoNormalizado = normalizarTelefonoMexico(telefono);
  if (!telefonoNormalizado) return null;

  const registro = await store.get(claveCancelacionPendiente(telefonoNormalizado), {
    type: "json"
  });

  if (!registro) return null;

  const expira = Date.parse(String(registro.expires_at || ""));
  if (!Number.isFinite(expira) || expira <= Date.now()) {
    await store.delete(claveCancelacionPendiente(telefonoNormalizado));
    return null;
  }

  return registro;
}

export async function eliminarCancelacionPendiente({
  telefono,
  store = getCartesStore()
}) {
  const telefonoNormalizado = normalizarTelefonoMexico(telefono);
  if (!telefonoNormalizado) return;
  await store.delete(claveCancelacionPendiente(telefonoNormalizado));
}


export async function reclamarNotificacionSuscripcion({
  entorno,
  preapprovalId,
  status,
  store = getCartesStore()
}) {
  const normalizado = normalizarEntorno(entorno);
  const id = String(preapprovalId || "").trim();
  const estado = String(status || "").trim().toLowerCase();

  if (!id || !estado) {
    throw new Error(
      "No se puede reclamar una notificación sin preapproval_id y status."
    );
  }

  const clave = claveNotificacion(normalizado, id, estado);
  const valor = JSON.stringify({
    version: 1,
    entorno: normalizado,
    preapproval_id: id,
    status: estado,
    claimed_at: new Date().toISOString()
  });

  const resultado = await store.set(clave, valor, { onlyIfNew: true });
  return Boolean(resultado?.modified);
}

export async function liberarNotificacionSuscripcion({
  entorno,
  preapprovalId,
  status,
  store = getCartesStore()
}) {
  const normalizado = normalizarEntorno(entorno);
  const id = String(preapprovalId || "").trim();
  const estado = String(status || "").trim().toLowerCase();

  if (!id || !estado) return;
  await store.delete(claveNotificacion(normalizado, id, estado));
}

export async function guardarPagoAutorizado({ entorno, registro }) {
  const normalizado = normalizarEntorno(entorno);
  const id = String(registro?.authorized_payment_id || "");

  if (!id) {
    throw new Error("No se puede guardar un pago autorizado sin ID.");
  }

  await guardarJSON(`${PREFIJO_MP}:pago:${normalizado}:${id}`, registro);
  return registro;
}

export async function enviarMensajeWhatsApp(destinatario, texto) {
  return await enviarPayloadWhatsApp(destinatario, {
    type: "text",
    text: {
      preview_url: true,
      body: String(texto || "")
    }
  });
}

function normalizarFooterWhatsApp(footer) {
  const texto = String(footer || "");
  return texto ? texto.slice(0, 60) : "";
}

export async function enviarListaWhatsApp(destinatario, configuracion) {
  const sections = Array.isArray(configuracion?.sections)
    ? configuracion.sections
    : [];

  return await enviarPayloadWhatsApp(destinatario, {
    type: "interactive",
    interactive: {
      type: "list",
      ...(configuracion?.header
        ? { header: { type: "text", text: String(configuracion.header) } }
        : {}),
      body: { text: String(configuracion?.body || "Selecciona una opción.") },
      ...(configuracion?.footer
        ? { footer: { text: normalizarFooterWhatsApp(configuracion.footer) } }
        : {}),
      action: {
        button: String(configuracion?.button || "Ver opciones").slice(0, 20),
        sections
      }
    }
  });
}

export async function enviarBotonesWhatsApp(destinatario, configuracion) {
  const buttons = (configuracion?.buttons || []).slice(0, 3).map((boton) => ({
    type: "reply",
    reply: {
      id: String(boton.id),
      title: String(boton.title).slice(0, 20)
    }
  }));

  return await enviarPayloadWhatsApp(destinatario, {
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: String(configuracion?.body || "Confirma una opción.") },
      ...(configuracion?.footer
        ? { footer: { text: normalizarFooterWhatsApp(configuracion.footer) } }
        : {}),
      action: { buttons }
    }
  });
}

async function enviarPayloadWhatsApp(destinatario, contenido) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token) throw new Error("Falta WHATSAPP_ACCESS_TOKEN.");
  if (!phoneNumberId) throw new Error("Falta WHATSAPP_PHONE_NUMBER_ID.");

  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: destinatario,
        ...contenido
      })
    }
  );

  const raw = await response.text();

  if (!response.ok) {
    throw new Error(`WhatsApp respondió con HTTP ${response.status}: ${raw}`);
  }

  return raw ? JSON.parse(raw) : {};
}

export function extraerUserIdReferencia(referencia) {
  const match = String(referencia || "").match(
    /^cartes-plus-user:(?:production|test):(usr_[a-f0-9]{32}):/
  );
  return match ? match[1] : "";
}

export function extraerTelefonoReferencia(referencia) {
  const match = String(referencia || "").match(
    /^cartes-plus:(?:production|test):(\d{10,15}):/
  );
  return match ? match[1] : "";
}

export function esSolicitudPlusPrueba(texto) {
  const normalizado = normalizarTexto(texto);
  return (
    normalizado.includes("cartes plus prueba") ||
    normalizado.trim() === "plus prueba"
  );
}

export function esSolicitudPlus(texto) {
  const normalizado = normalizarTexto(texto);

  return (
    normalizado.includes("cartes plus") ||
    normalizado.includes("quiero plus") ||
    normalizado.includes("suscribirme") ||
    normalizado.trim() === "plus"
  );
}

function normalizarTexto(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function clavePlan(entorno, planId) {
  return `${PREFIJO_MP}:plan:${entorno}:${planId}`;
}

function clavePlanTelefono(entorno, telefono) {
  return `${PREFIJO_MP}:plan-telefono:${entorno}:${telefono}`;
}

function claveReferencia(entorno, referencia) {
  return `${PREFIJO_MP}:referencia:${entorno}:${referencia}`;
}

function claveSuscripcion(entorno, preapprovalId) {
  return `${PREFIJO_MP}:suscripcion:${entorno}:${preapprovalId}`;
}

function claveCancelacionPendiente(telefono) {
  return `${PREFIJO_MP}:cancelacion-pendiente:${telefono}`;
}

function normalizarTelefonoMexico(telefono) {
  const limpio = String(telefono || "").replace(/\D/g, "");
  if (limpio.startsWith("521") && limpio.length === 13) {
    return `52${limpio.slice(3)}`;
  }
  return limpio;
}

function variantesTelefonoMexico(telefono) {
  const original = String(telefono || "").replace(/\D/g, "");
  const normalizado = normalizarTelefonoMexico(original);
  const variantes = new Set([original, normalizado].filter(Boolean));

  if (normalizado.startsWith("52") && normalizado.length === 12) {
    variantes.add(`521${normalizado.slice(2)}`);
  }

  return [...variantes];
}

function claveNotificacion(entorno, preapprovalId, status) {
  return `${PREFIJO_MP}:notificacion:${entorno}:${preapprovalId}:${status}`;
}
