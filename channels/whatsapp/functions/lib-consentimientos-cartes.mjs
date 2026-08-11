import { getStore } from "@netlify/blobs";

export const VERSION_TERMINOS_CARTES = "2026-07-30";
export const VERSION_AVISO_PRIVACIDAD_CARTES = "2026-07-30";
export const URL_TERMINOS_CARTES = process.env.CARTES_TERMS_URL || "https://develandoelcodigomasonico.com/cartes-whatsapp/terminos.html";
export const URL_PRIVACIDAD_CARTES = process.env.CARTES_PRIVACY_URL || "https://develandoelcodigomasonico.com/cartes-whatsapp/privacy.html";
const PREFIJO = "consentimientos-v1";
const SOLICITUD_MS = 30 * 60 * 1000;

export function getConsentimientosStore() {
  return getStore({ name: "cartes-whatsapp", consistency: "strong" });
}

function telefonoLimpio(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function clavePendiente(telefono) {
  return `${PREFIJO}:terminos-pendientes:${telefonoLimpio(telefono)}`;
}

function claveAceptacion(telefono, fechaIso) {
  return `${PREFIJO}:terminos-aceptados:${telefonoLimpio(telefono)}:${fechaIso}`;
}

export async function guardarSolicitudAceptacionTerminos({ telefono, messageId, fecha = new Date(), store = getConsentimientosStore() }) {
  const tel = telefonoLimpio(telefono);
  if (!tel || !messageId) throw new Error("Teléfono e identificador de mensaje son obligatorios.");
  const registro = {
    version: 1,
    telefono: tel,
    message_id_solicitud: String(messageId),
    version_terminos: VERSION_TERMINOS_CARTES,
    version_aviso_privacidad: VERSION_AVISO_PRIVACIDAD_CARTES,
    requested_at: fecha.toISOString(),
    expires_at: new Date(fecha.getTime() + SOLICITUD_MS).toISOString()
  };
  await store.setJSON(clavePendiente(tel), registro);
  return registro;
}

export async function leerSolicitudAceptacionTerminos({ telefono, fecha = new Date(), store = getConsentimientosStore() }) {
  const registro = await store.get(clavePendiente(telefono), { type: "json", consistency: "strong" });
  if (!registro) return null;
  if (!registro.expires_at || Date.parse(registro.expires_at) <= fecha.getTime()) {
    await store.delete(clavePendiente(telefono));
    return null;
  }
  return registro;
}

export async function registrarAceptacionTerminos({ telefono, messageId, fecha = new Date(), store = getConsentimientosStore() }) {
  const pendiente = await leerSolicitudAceptacionTerminos({ telefono, fecha, store });
  if (!pendiente) return null;
  const registro = {
    ...pendiente,
    message_id_aceptacion: String(messageId || ""),
    accepted_at: fecha.toISOString(),
    estado: "aceptado"
  };
  await store.setJSON(claveAceptacion(telefono, registro.accepted_at), registro);
  await store.delete(clavePendiente(telefono));
  return registro;
}

export async function rechazarAceptacionTerminos({ telefono, messageId, fecha = new Date(), store = getConsentimientosStore() }) {
  const pendiente = await leerSolicitudAceptacionTerminos({ telefono, fecha, store });
  if (!pendiente) return null;
  const registro = { ...pendiente, message_id_respuesta: String(messageId || ""), rejected_at: fecha.toISOString(), estado: "rechazado" };
  await store.setJSON(claveAceptacion(telefono, registro.rejected_at), registro);
  await store.delete(clavePendiente(telefono));
  return registro;
}
