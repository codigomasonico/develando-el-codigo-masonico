import crypto from "node:crypto";

export const PLAN_CARTES_GRATUITO = "gratuito";
export const PLAN_CARTES_PLUS = "plus";
export const LIMITES_MENSUALES_CARTES = Object.freeze({
  [PLAN_CARTES_GRATUITO]: 5,
  [PLAN_CARTES_PLUS]: 50
});

const STORE_NAME = "cartes-core";
const PREFIJO_IDENTIDAD = "account-v1";
const PREFIJO_USO = "usage-v2";
const PREFIJO_PLAN = "plan-v1";
const PREFIJO_VINCULO = "link-v1";
const PREFIJO_SUSCRIPCION = "subscription-v1";
const PREFIJO_CONVERSACION = "conversation-v1";
const MAX_MENSAJES_CONVERSACION = 20;
const MAX_CHARS_MENSAJE = 1800;
const VINCULO_TTL_MS = 10 * 60 * 1000;
const TIME_ZONE = "America/Mexico_City";
const RESERVA_PENDIENTE_MS = 10 * 60 * 1000;
const MAX_REINTENTOS = 10;

export async function getCartesAccountStore() {
  const { getStore } = await import("@netlify/blobs");
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

export function normalizarIdentidadCartes(tipo, valor) {
  const t = String(tipo || "").trim().toLowerCase();
  let v = String(valor || "").trim();
  if (t === "whatsapp") v = normalizarTelefonoMexico(v);
  if (t === "email") v = v.toLowerCase();
  if (!t || !v) throw new Error("La identidad de Cartes requiere tipo y valor válidos.");
  return { tipo: t, valor: v };
}

export async function resolverOCrearUsuarioPorIdentidad({ tipo, valor, fecha = new Date(), store = null }) {
  store ||= await getCartesAccountStore();
  const identidad = normalizarIdentidadCartes(tipo, valor);
  const clave = `${PREFIJO_IDENTIDAD}:identity:${identidad.tipo}:${identidad.valor}`;
  const existente = await store.get(clave, { type: "json", consistency: "strong" });
  if (existente?.user_id) {
    await asegurarUsuario({ userId: existente.user_id, identidad, fecha, store });
    return resultadoIdentidad(existente.user_id, identidad, false);
  }

  for (let i = 0; i < MAX_REINTENTOS; i += 1) {
    const userId = `usr_${crypto.randomUUID().replace(/-/g, "")}`;
    const ahora = fecha.toISOString();
    const creado = await store.setJSON(clave, {
      version: 1, user_id: userId, identity_type: identidad.tipo,
      identity_value: identidad.valor, created_at: ahora, updated_at: ahora
    }, { onlyIfNew: true });
    if (creado?.modified) {
      await asegurarUsuario({ userId, identidad, fecha, store });
      return resultadoIdentidad(userId, identidad, true);
    }
    const ganador = await store.get(clave, { type: "json", consistency: "strong" });
    if (ganador?.user_id) {
      await asegurarUsuario({ userId: ganador.user_id, identidad, fecha, store });
      return resultadoIdentidad(ganador.user_id, identidad, false);
    }
  }
  throw new Error("No se pudo resolver la identidad de Cartes por concurrencia.");
}

export async function vincularIdentidadUsuario({ userId, tipo, valor, fecha = new Date(), store = null }) {
  store ||= await getCartesAccountStore();
  const id = validarUserId(userId);
  const identidad = normalizarIdentidadCartes(tipo, valor);
  const clave = `${PREFIJO_IDENTIDAD}:identity:${identidad.tipo}:${identidad.valor}`;
  const existente = await store.get(clave, { type: "json", consistency: "strong" });
  if (existente?.user_id && existente.user_id !== id) {
    throw new Error("La identidad ya está vinculada a otro usuario de Cartes.");
  }
  if (!existente) {
    const ahora = fecha.toISOString();
    const creado = await store.setJSON(clave, {
      version: 1, user_id: id, identity_type: identidad.tipo,
      identity_value: identidad.valor, created_at: ahora, updated_at: ahora
    }, { onlyIfNew: true });
    if (!creado?.modified) {
      const ganador = await store.get(clave, { type: "json", consistency: "strong" });
      if (ganador?.user_id !== id) throw new Error("La identidad fue vinculada concurrentemente a otro usuario.");
    }
  }
  await asegurarUsuario({ userId: id, identidad, fecha, store });
  return resultadoIdentidad(id, identidad, false);
}

export function obtenerPeriodoMensual(fecha = new Date()) {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit" }).formatToParts(fecha);
  const year = partes.find((p) => p.type === "year")?.value;
  const month = partes.find((p) => p.type === "month")?.value;
  if (!year || !month) throw new Error("No se pudo determinar el periodo mensual de Cartes.");
  return `${year}-${month}`;
}

export async function sincronizarPlanUsuario({ userId, plan, source = "unknown", fecha = new Date(), store = null }) {
  store ||= await getCartesAccountStore();
  const id = validarUserId(userId);
  const p = normalizarPlan(plan);
  const ahora = fecha.toISOString();
  await store.setJSON(`${PREFIJO_PLAN}:${id}`, { version: 1, user_id: id, plan: p, source, updated_at: ahora });
  return { user_id: id, plan: p, updated_at: ahora };
}


export async function sincronizarSuscripcionUsuario({ userId, subscription, source = "mercadopago", fecha = new Date(), store = null }) {
  store ||= await getCartesAccountStore();
  const id = validarUserId(userId);
  const actual = await store.get(`${PREFIJO_SUSCRIPCION}:${id}`, { type: "json", consistency: "strong" });
  const ahora = fecha.toISOString();
  const incoming = subscription && typeof subscription === "object" ? subscription : {};
  const registro = {
    ...(actual || {}),
    ...incoming,
    version: 1,
    user_id: id,
    source,
    updated_at: ahora,
    created_at: actual?.created_at || incoming.created_at || ahora
  };
  await store.setJSON(`${PREFIJO_SUSCRIPCION}:${id}`, registro);
  const plan = determinarPlanDesdeSuscripcion(registro, fecha);
  await sincronizarPlanUsuario({ userId: id, plan, source: `subscription:${source}`, fecha, store });
  return { user_id: id, plan, subscription: registro };
}

export async function obtenerSuscripcionUsuario({ userId, fecha = new Date(), store = null }) {
  store ||= await getCartesAccountStore();
  const id = validarUserId(userId);
  const registro = await store.get(`${PREFIJO_SUSCRIPCION}:${id}`, { type: "json", consistency: "strong" });
  return registro ? { ...registro, plan_actual: determinarPlanDesdeSuscripcion(registro, fecha) } : null;
}

export function determinarPlanDesdeSuscripcion(registro, fecha = new Date()) {
  const estado = String(registro?.status || "").toLowerCase();
  if (estado === "authorized") return PLAN_CARTES_PLUS;
  if (registro?.renovacion_cancelada) {
    const accesoHasta = Date.parse(String(registro?.access_until || registro?.fecha_fin || ""));
    if (Number.isFinite(accesoHasta) && accesoHasta > fecha.getTime()) return PLAN_CARTES_PLUS;
  }
  return PLAN_CARTES_GRATUITO;
}

export async function obtenerPlanUsuario({ userId, store = null }) {
  store ||= await getCartesAccountStore();
  const id = validarUserId(userId);
  const registro = await store.get(`${PREFIJO_PLAN}:${id}`, { type: "json", consistency: "strong" });
  return normalizarPlan(registro?.plan);
}

export async function obtenerEstadoUsoMensual({ userId, plan = null, fecha = new Date(), store = null }) {
  store ||= await getCartesAccountStore();
  const id = validarUserId(userId);
  const periodo = obtenerPeriodoMensual(fecha);
  const p = normalizarPlan(plan || await obtenerPlanUsuario({ userId: id, store }));
  const limite = LIMITES_MENSUALES_CARTES[p];
  const entrada = await store.getWithMetadata(claveUso(periodo, id), { type: "json", consistency: "strong" });
  const registro = normalizarRegistroUso(entrada?.data, { userId: id, periodo });
  const consultas = filtrarConsultasVigentes(registro.consultas, fecha);
  return construirEstado({ userId: id, plan: p, periodo, limite, usadas: contarConsultas(consultas) });
}

export async function reservarConsultaMensual({ userId, plan = null, requestId, channel = "unknown", fecha = new Date(), store = null }) {
  store ||= await getCartesAccountStore();
  const id = validarUserId(userId);
  const rid = String(requestId || "").trim();
  if (!rid) throw new Error("No se puede reservar una consulta sin requestId válido.");
  const periodo = obtenerPeriodoMensual(fecha);
  const p = normalizarPlan(plan || await obtenerPlanUsuario({ userId: id, store }));
  const limite = LIMITES_MENSUALES_CARTES[p];
  const clave = claveUso(periodo, id);

  for (let i = 0; i < MAX_REINTENTOS; i += 1) {
    const entrada = await store.getWithMetadata(clave, { type: "json", consistency: "strong" });
    const registro = normalizarRegistroUso(entrada?.data, { userId: id, periodo });
    const consultas = filtrarConsultasVigentes(registro.consultas, fecha);
    const existente = consultas.find((c) => c.request_id === rid);
    const usadas = contarConsultas(consultas);
    if (existente) return { ...construirEstado({ userId: id, plan: p, periodo, limite, usadas }), permitida: false, duplicada: true, request_id: rid };
    if (usadas >= limite) return { ...construirEstado({ userId: id, plan: p, periodo, limite, usadas }), permitida: false, duplicada: false, request_id: rid };

    const ahora = fecha.toISOString();
    const siguiente = {
      version: 2, user_id: id, periodo,
      consultas: [...consultas, { request_id: rid, estado: "pendiente", plan: p, channel: String(channel || "unknown"), reserved_at: ahora }],
      updated_at: ahora
    };
    const guardado = await store.setJSON(clave, siguiente, entrada?.etag ? { onlyIfMatch: entrada.etag } : { onlyIfNew: true });
    if (guardado?.modified) return { ...construirEstado({ userId: id, plan: p, periodo, limite, usadas: usadas + 1 }), permitida: true, duplicada: false, request_id: rid };
  }
  throw new Error("No se pudo reservar la consulta por concurrencia.");
}

export async function completarConsultaMensual(args) {
  return actualizarConsulta({ ...args, transformar(consultas, indice, fecha) {
    const siguiente = [...consultas];
    siguiente[indice] = { ...siguiente[indice], estado: "completada", completed_at: fecha.toISOString() };
    return siguiente;
  }});
}

export async function liberarConsultaMensual(args) {
  return actualizarConsulta({ ...args, transformar(consultas, indice) {
    if (consultas[indice]?.estado === "completada") return consultas;
    return consultas.filter((_c, pos) => pos !== indice);
  }});
}

async function actualizarConsulta({ userId, periodo, requestId, fecha = new Date(), store = null, transformar }) {
  store ||= await getCartesAccountStore();
  const id = validarUserId(userId);
  const rid = String(requestId || "").trim();
  if (!rid) return false;
  const per = String(periodo || obtenerPeriodoMensual(fecha));
  const clave = claveUso(per, id);
  for (let i = 0; i < MAX_REINTENTOS; i += 1) {
    const entrada = await store.getWithMetadata(clave, { type: "json", consistency: "strong" });
    if (!entrada?.etag) return false;
    const registro = normalizarRegistroUso(entrada.data, { userId: id, periodo: per });
    const consultas = filtrarConsultasVigentes(registro.consultas, fecha);
    const indice = consultas.findIndex((c) => c.request_id === rid);
    if (indice < 0) return false;
    const transformadas = transformar(consultas, indice, fecha);
    if (transformadas === consultas) return false;
    const guardado = await store.setJSON(clave, { ...registro, consultas: transformadas, updated_at: fecha.toISOString() }, { onlyIfMatch: entrada.etag });
    if (guardado?.modified) return true;
  }
  throw new Error("No se pudo actualizar la consulta por concurrencia.");
}



export async function obtenerConversacionUsuario({ userId, store = null }) {
  store ||= await getCartesAccountStore();
  const id = validarUserId(userId);
  const registro = await store.get(`${PREFIJO_CONVERSACION}:${id}`, { type: "json", consistency: "strong" });
  return normalizarConversacion(registro, id);
}

export async function registrarIntercambioConversacion({ userId, question, answer, channel = "unknown", requestId = null, fecha = new Date(), store = null }) {
  store ||= await getCartesAccountStore();
  const id = validarUserId(userId);
  const q = limpiarMensajeConversacion(question);
  const a = limpiarMensajeConversacion(answer);
  if (!q || !a) return obtenerConversacionUsuario({ userId: id, store });
  const clave = `${PREFIJO_CONVERSACION}:${id}`;
  const ahora = fecha.toISOString();
  for (let i = 0; i < MAX_REINTENTOS; i += 1) {
    const entrada = await store.getWithMetadata(clave, { type: "json", consistency: "strong" });
    const actual = normalizarConversacion(entrada?.data, id);
    if (requestId && actual.exchanges.some((x) => x.request_id === String(requestId))) return actual;
    const exchange = {
      request_id: requestId ? String(requestId) : null,
      channel: String(channel || "unknown"),
      created_at: ahora,
      messages: [
        { role: "user", content: q },
        { role: "assistant", content: a }
      ]
    };
    const exchanges = [...actual.exchanges, exchange].slice(-Math.ceil(MAX_MENSAJES_CONVERSACION / 2));
    const nuevo = { version: 1, user_id: id, exchanges, updated_at: ahora };
    const opciones = entrada?.etag ? { onlyIfMatch: entrada.etag } : { onlyIfNew: true };
    const guardado = await store.setJSON(clave, nuevo, opciones);
    if (guardado?.modified) return nuevo;
  }
  throw new Error("No se pudo actualizar la conversación por concurrencia.");
}

export async function limpiarConversacionUsuario({ userId, fecha = new Date(), store = null }) {
  store ||= await getCartesAccountStore();
  const id = validarUserId(userId);
  const registro = { version: 1, user_id: id, exchanges: [], updated_at: fecha.toISOString() };
  await store.setJSON(`${PREFIJO_CONVERSACION}:${id}`, registro);
  return registro;
}

export function mensajesDeConversacion(registro) {
  return normalizarConversacion(registro, registro?.user_id || "usr_00000000000000000000000000000000")
    .exchanges.flatMap((x) => x.messages).slice(-MAX_MENSAJES_CONVERSACION);
}

export async function iniciarVinculacionWeb({ webIdentity, fecha = new Date(), store = null }) {
  store ||= await getCartesAccountStore();
  const identidad = normalizarIdentidadCartes("web", webIdentity);
  const claveWeb = `${PREFIJO_VINCULO}:web:${identidad.valor}`;
  const previo = await store.get(claveWeb, { type: "json", consistency: "strong" });
  if (previo?.status === "linked") return { status: "linked", linked: true };
  if (previo?.status === "pending" && Date.parse(String(previo.expires_at || "")) > fecha.getTime() && /^\d{6}$/.test(String(previo.code || ""))) {
    return { status: "pending", linked: false, code: previo.code, expires_at: previo.expires_at, instruction: `VINCULAR ${previo.code}` };
  }
  const origen = await resolverOCrearUsuarioPorIdentidad({ tipo: "web", valor: identidad.valor, fecha, store });
  const ahora = fecha.toISOString();
  const expira = new Date(fecha.getTime() + VINCULO_TTL_MS).toISOString();

  for (let i = 0; i < MAX_REINTENTOS * 2; i += 1) {
    const codigo = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    const claveCodigo = `${PREFIJO_VINCULO}:code:${codigo}`;
    const creado = await store.setJSON(claveCodigo, {
      version: 1, code: codigo, source_user_id: origen.user_id, web_identity: identidad.valor,
      status: "pending", created_at: ahora, expires_at: expira, updated_at: ahora
    }, { onlyIfNew: true });
    if (!creado?.modified) continue;
    await store.setJSON(claveWeb, {
      version: 1, code: codigo, status: "pending", source_user_id: origen.user_id,
      created_at: ahora, expires_at: expira, updated_at: ahora
    });
    return { status: "pending", code: codigo, expires_at: expira, instruction: `VINCULAR ${codigo}` };
  }
  throw new Error("No se pudo generar un código de vinculación.");
}

export async function obtenerEstadoVinculacionWeb({ webIdentity, fecha = new Date(), store = null }) {
  store ||= await getCartesAccountStore();
  const identidad = normalizarIdentidadCartes("web", webIdentity);
  const registro = await store.get(`${PREFIJO_VINCULO}:web:${identidad.valor}`, { type: "json", consistency: "strong" });
  if (!registro) return { status: "not_started", linked: false };
  if (registro.status === "linked") return { status: "linked", linked: true };
  if (Date.parse(String(registro.expires_at || "")) <= fecha.getTime()) return { status: "expired", linked: false };
  return { status: "pending", linked: false, expires_at: registro.expires_at };
}

export async function completarVinculacionConWhatsApp({ code, whatsappUserId, fecha = new Date(), store = null }) {
  store ||= await getCartesAccountStore();
  const codigo = String(code || "").replace(/\D/g, "");
  if (!/^\d{6}$/.test(codigo)) throw new Error("El código de vinculación debe tener 6 dígitos.");
  const destino = validarUserId(whatsappUserId);
  const claveCodigo = `${PREFIJO_VINCULO}:code:${codigo}`;
  const entrada = await store.getWithMetadata(claveCodigo, { type: "json", consistency: "strong" });
  const vinculo = entrada?.data;
  if (!vinculo) throw new Error("El código de vinculación no existe o ya fue utilizado.");
  if (vinculo.status === "linked") {
    if (vinculo.user_id === destino) return { linked: true, user_id: destino, already_linked: true };
    throw new Error("El código de vinculación ya fue utilizado.");
  }
  if (Date.parse(String(vinculo.expires_at || "")) <= fecha.getTime()) throw new Error("El código de vinculación expiró.");

  const origen = validarUserId(vinculo.source_user_id);
  await fusionarUsuarioEn({ sourceUserId: origen, targetUserId: destino, fecha, store });
  const ahora = fecha.toISOString();
  const completado = { ...vinculo, status: "linked", user_id: destino, linked_at: ahora, updated_at: ahora };
  if (entrada?.etag) await store.setJSON(claveCodigo, completado, { onlyIfMatch: entrada.etag });
  else await store.setJSON(claveCodigo, completado);
  await store.setJSON(`${PREFIJO_VINCULO}:web:${vinculo.web_identity}`, {
    version: 1, code: codigo, status: "linked", user_id: destino, linked_at: ahora, updated_at: ahora
  });
  return { linked: true, user_id: destino, web_identity: vinculo.web_identity };
}

async function fusionarUsuarioEn({ sourceUserId, targetUserId, fecha, store }) {
  const source = validarUserId(sourceUserId);
  const target = validarUserId(targetUserId);
  if (source === target) return;
  const ahora = fecha.toISOString();
  const sourceKey = `${PREFIJO_IDENTIDAD}:user:${source}`;
  const targetKey = `${PREFIJO_IDENTIDAD}:user:${target}`;
  const sourceUser = await store.get(sourceKey, { type: "json", consistency: "strong" });
  const targetUser = await store.get(targetKey, { type: "json", consistency: "strong" }) || { version: 1, user_id: target, identities: {}, created_at: ahora };
  const mergedIdentities = { ...(targetUser.identities || {}) };
  for (const [tipo, valores] of Object.entries(sourceUser?.identities || {})) {
    const set = new Set([...(mergedIdentities[tipo] || []), ...(Array.isArray(valores) ? valores : [])]);
    mergedIdentities[tipo] = [...set];
    for (const valor of set) {
      const idKey = `${PREFIJO_IDENTIDAD}:identity:${tipo}:${valor}`;
      const pointer = await store.get(idKey, { type: "json", consistency: "strong" });
      if (!pointer?.user_id || pointer.user_id === source || pointer.user_id === target) {
        await store.setJSON(idKey, { ...(pointer || {}), version: 1, user_id: target, identity_type: tipo, identity_value: valor, updated_at: ahora });
      }
    }
  }
  await store.setJSON(targetKey, { ...targetUser, version: 1, user_id: target, identities: mergedIdentities, updated_at: ahora });
  if (sourceUser) await store.setJSON(sourceKey, { ...sourceUser, merged_into: target, merged_at: ahora, updated_at: ahora });

  const sourcePlan = await obtenerPlanUsuario({ userId: source, store });
  const targetPlan = await obtenerPlanUsuario({ userId: target, store });
  const mergedPlan = sourcePlan === PLAN_CARTES_PLUS || targetPlan === PLAN_CARTES_PLUS ? PLAN_CARTES_PLUS : PLAN_CARTES_GRATUITO;
  await sincronizarPlanUsuario({ userId: target, plan: mergedPlan, source: "identity_link", fecha, store });

  const sourceSub = await store.get(`${PREFIJO_SUSCRIPCION}:${source}`, { type: "json", consistency: "strong" });
  const targetSub = await store.get(`${PREFIJO_SUSCRIPCION}:${target}`, { type: "json", consistency: "strong" });
  if (sourceSub || targetSub) {
    const sourcePlus = determinarPlanDesdeSuscripcion(sourceSub, fecha) === PLAN_CARTES_PLUS;
    const targetPlus = determinarPlanDesdeSuscripcion(targetSub, fecha) === PLAN_CARTES_PLUS;
    let elegida = targetSub || sourceSub;
    if (sourcePlus && !targetPlus) elegida = sourceSub;
    else if (sourcePlus === targetPlus && sourceSub && targetSub) {
      const su = Date.parse(String(sourceSub.updated_at || sourceSub.created_at || "")) || 0;
      const tu = Date.parse(String(targetSub.updated_at || targetSub.created_at || "")) || 0;
      elegida = su > tu ? sourceSub : targetSub;
    }
    await sincronizarSuscripcionUsuario({ userId: target, subscription: elegida, source: "identity_link", fecha, store });
  }

  const periodo = obtenerPeriodoMensual(fecha);
  const sourceUsage = await store.get(claveUso(periodo, source), { type: "json", consistency: "strong" });
  const targetUsage = await store.get(claveUso(periodo, target), { type: "json", consistency: "strong" });
  const map = new Map();
  for (const c of [...(targetUsage?.consultas || []), ...(sourceUsage?.consultas || [])]) {
    if (c?.request_id && !map.has(c.request_id)) map.set(c.request_id, c);
  }
  if (map.size) await store.setJSON(claveUso(periodo, target), { version: 2, user_id: target, periodo, consultas: [...map.values()], updated_at: ahora });

  const sourceConversation = normalizarConversacion(await store.get(`${PREFIJO_CONVERSACION}:${source}`, { type: "json", consistency: "strong" }), source);
  const targetConversation = normalizarConversacion(await store.get(`${PREFIJO_CONVERSACION}:${target}`, { type: "json", consistency: "strong" }), target);
  const mergedExchanges = [...targetConversation.exchanges, ...sourceConversation.exchanges]
    .sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")))
    .filter((item, index, all) => !item.request_id || all.findIndex((x) => x.request_id === item.request_id) === index)
    .slice(-Math.ceil(MAX_MENSAJES_CONVERSACION / 2));
  if (mergedExchanges.length) {
    await store.setJSON(`${PREFIJO_CONVERSACION}:${target}`, { version: 1, user_id: target, exchanges: mergedExchanges, updated_at: ahora });
  }
}

async function asegurarUsuario({ userId, identidad, fecha, store }) {
  const clave = `${PREFIJO_IDENTIDAD}:user:${userId}`;
  for (let i = 0; i < MAX_REINTENTOS; i += 1) {
    const entrada = await store.getWithMetadata(clave, { type: "json", consistency: "strong" });
    const ahora = fecha.toISOString();
    if (!entrada?.data) {
      const nuevo = { version: 1, user_id: userId, identities: { [identidad.tipo]: [identidad.valor] }, created_at: ahora, updated_at: ahora };
      const creado = await store.setJSON(clave, nuevo, { onlyIfNew: true });
      if (creado?.modified) return nuevo;
      continue;
    }
    const actual = entrada.data;
    const existentes = new Set(actual?.identities?.[identidad.tipo] || []);
    if (existentes.has(identidad.valor)) return actual;
    existentes.add(identidad.valor);
    const siguiente = { ...actual, identities: { ...(actual.identities || {}), [identidad.tipo]: [...existentes] }, updated_at: ahora };
    const guardado = await store.setJSON(clave, siguiente, { onlyIfMatch: entrada.etag });
    if (guardado?.modified) return siguiente;
  }
  throw new Error("No se pudo actualizar el usuario de Cartes por concurrencia.");
}


function normalizarConversacion(valor, userId) {
  const r = valor && typeof valor === "object" ? valor : {};
  const exchanges = Array.isArray(r.exchanges) ? r.exchanges : [];
  return {
    version: 1,
    user_id: userId,
    exchanges: exchanges.filter((x) => Array.isArray(x?.messages) && x.messages.length === 2).slice(-Math.ceil(MAX_MENSAJES_CONVERSACION / 2)),
    updated_at: r.updated_at || null
  };
}
function limpiarMensajeConversacion(valor) {
  return String(valor || "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, MAX_CHARS_MENSAJE);
}

function resultadoIdentidad(userId, identidad, created) { return { user_id: userId, identity_type: identidad.tipo, identity_value: identidad.valor, created }; }
function validarUserId(userId) { const id = String(userId || "").trim(); if (!/^usr_[a-f0-9]{32}$/.test(id)) throw new Error("Se requiere un user_id válido."); return id; }
function normalizarPlan(plan) { return String(plan || "").toLowerCase() === PLAN_CARTES_PLUS ? PLAN_CARTES_PLUS : PLAN_CARTES_GRATUITO; }
function claveUso(periodo, userId) { return `${PREFIJO_USO}:${periodo}:${userId}`; }
function normalizarRegistroUso(valor, { userId, periodo }) { const r = valor && typeof valor === "object" ? valor : {}; return { version: 2, user_id: userId, periodo, consultas: Array.isArray(r.consultas) ? r.consultas : [], updated_at: r.updated_at || null }; }
function filtrarConsultasVigentes(consultas, fecha) { const ahora = fecha.getTime(); return consultas.filter((c) => { if (!c?.request_id) return false; if (c.estado === "completada") return true; if (c.estado !== "pendiente") return false; const r = Date.parse(String(c.reserved_at || "")); return Number.isFinite(r) && ahora - r < RESERVA_PENDIENTE_MS; }); }
function contarConsultas(consultas) { return consultas.filter((c) => ["pendiente", "completada"].includes(c.estado)).length; }
function construirEstado({ userId, plan, periodo, limite, usadas }) { return { user_id: userId, plan, periodo, limite, usadas, disponibles: Math.max(0, limite - usadas) }; }
function normalizarTelefonoMexico(telefono) { const limpio = String(telefono || "").replace(/\D/g, ""); return limpio.startsWith("521") && limpio.length === 13 ? `52${limpio.slice(3)}` : limpio; }
