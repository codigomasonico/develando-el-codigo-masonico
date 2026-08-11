import crypto from "node:crypto";
import { consultarCartesCore } from "./lib-cartes-core-client.mjs";
import {
  buscarSuscripcionPorTelefono,
  buscarSuscripcionPorUserId,
  eliminarCancelacionPendiente,
  enviarBotonesWhatsApp,
  enviarListaWhatsApp,
  enviarMensajeWhatsApp as enviarMensajeWhatsAppCompartido,
  esSolicitudPlus,
  esSolicitudPlusPrueba,
  guardarCancelacionPendiente,
  guardarSuscripcion,
  leerCancelacionPendiente,
  liberarNotificacionSuscripcion,
  obtenerOCrearEnlaceCartesPlus,
  reclamarNotificacionSuscripcion
} from "./lib-cartes.mjs";
import {
  cancelarSuscripcionMercadoPago,
  crearPreferenciaPaqueteRevisiones,
  normalizarEstadoSuscripcion,
  obtenerSuscripcionMercadoPago
} from "./lib-mercadopago.mjs";
import {
  MENU_IDS,
  construirBotonesAutorizacionRevision,
  construirBotonesAceptacionTerminos,
  construirBotonesCancelacion,
  construirMenuAyuda,
  construirMenuMiSuscripcion,
  construirMenuPrincipal,
  construirMenuSuscripcion,
  esComandoCancelar,
  esComandoEstadoSuscripcion,
  esComandoMenu,
  esComandoRevision,
  esComandoPaquete,
  esConfirmacionCancelacion,
  esConservacionSuscripcion,
  esEstadoCancelable,
  esEntradaSinContenidoUtil,
  extraerEntradaMensaje,
  resolverOpcionNumericaMenu
} from "./lib-menu-cartes.mjs";
import { completarTextoCartes, SOPORTE_CARTES, TEXTOS_CARTES } from "./lib-textos-cartes.mjs";
import { revisarDocumentoSeguro, crearRegistroSeguroDocumento } from "./lib-documento-seguro-cartes.mjs";
import { esNombreDocx } from "./lib-docx-cartes.mjs";
import { tieneAccesoCartesPlus } from "./lib-acceso-cartes.mjs";
import {
  completarRevision, eliminarAutorizacionRevision, guardarAutorizacionRevision,
  leerAutorizacionRevision, liberarRevision, obtenerEstadoRevisiones, reservarRevision
} from "./lib-revisiones-cartes.mjs";
import {
  PLAN_CARTES_PLUS,
  determinarPlanCartes
} from "./lib-uso-cartes.mjs";
import {
  completarConsultaUnificada,
  liberarConsultaUnificada,
  obtenerEstadoUsoUnificado,
  reservarConsultaUnificada,
  resolverUsuarioWhatsApp,
  sincronizarPlanUso
} from "./lib-uso-unificado-cartes.mjs";
import { guardarSolicitudAceptacionTerminos, registrarAceptacionTerminos, rechazarAceptacionTerminos, URL_TERMINOS_CARTES, URL_PRIVACIDAD_CARTES } from "./lib-consentimientos-cartes.mjs";
import { obtenerEstadoPaquetes, resolverFechaFinPeriodo } from "./lib-paquetes-revisiones.mjs";
import { clasificarSolicitudAutoria } from "./lib-integridad-autoria-cartes.mjs";
import { completarVinculacionCentral, cuentaCentralConfigurada } from "./lib-cartes-account-client.mjs";

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v25.0";
const MAX_QUESTION_CHARS = 900;
const MAX_WHATSAPP_CHARS = 3500;

function enmascararTelefono(telefono) {
  return String(telefono || "").replace(/\d(?=\d{4})/g, "*");
}

async function enviarTextoEnPartes(telefono, texto) {
  const contenido = String(texto || "").trim();
  if (!contenido) return;

  for (let i = 0; i < contenido.length; i += MAX_WHATSAPP_CHARS) {
    await enviarMensajeWhatsAppCompartido(
      telefono,
      contenido.slice(i, i + MAX_WHATSAPP_CHARS)
    );
  }
}

const MESSAGE_DEDUPE_TTL_MS = 10 * 60 * 1000;

const mensajesProcesados = new Map();

export default async (request) => {
  const url = new URL(request.url);

  if (request.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (
      mode === "subscribe" &&
      token === process.env.WHATSAPP_VERIFY_TOKEN &&
      challenge
    ) {
      return new Response(challenge, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8"
        }
      });
    }

    return new Response("Verificación rechazada", {
      status: 403
    });
  }

  if (request.method === "POST") {
    const rawBytes = Buffer.from(await request.arrayBuffer());
    const rawBody = rawBytes.toString("utf8");
    const signature = request.headers.get("x-hub-signature-256") || "";

    if (!validarFirmaMeta(rawBytes, signature)) {
      console.warn("Webhook rechazado: firma de Meta inválida.");

      return Response.json(
        {
          recibido: false,
          error: "Firma inválida"
        },
        {
          status: 401
        }
      );
    }

    let payload;

    try {
      payload = JSON.parse(rawBody);
    } catch {
      return Response.json(
        {
          recibido: false,
          error: "JSON inválido"
        },
        {
          status: 400
        }
      );
    }

    const estados = extraerEstados(payload);
    registrarEstados(estados);

    const mensajes = extraerMensajes(payload);
    let respuestasEnviadas = 0;
    let respuestasFallidas = 0;
    let mensajesDuplicados = 0;

    limpiarDeduplicacion();

    for (const mensaje of mensajes) {
      if (!mensaje?.id || !mensaje?.from) {
        continue;
      }

      if (mensajesProcesados.has(mensaje.id)) {
        mensajesDuplicados += 1;
        console.log("Mensaje duplicado ignorado.", {
          messageId: mensaje.id,
          from: enmascararTelefono(mensaje.from)
        });
        continue;
      }

      mensajesProcesados.set(mensaje.id, Date.now());

      try {
        const entrada = extraerEntradaMensaje(mensaje);

        if (!entrada) {
          await enviarTextoEnPartes(
            mensaje.from,
            TEXTOS_CARTES.FORMATO_NO_COMPATIBLE
          );

          respuestasEnviadas += 1;
          continue;
        }

        const textoEntrada = sanitizarTexto(
          entrada.texto,
          MAX_QUESTION_CHARS
        );

        if (entrada.tipo === "documento") {
          await procesarDocumentoEntrante(mensaje.from, mensaje.id, entrada.documento);
          respuestasEnviadas += 1;
          continue;
        }

        const atendidoPorMenu = await procesarFlujoMenuCartes(
          mensaje.from,
          { ...entrada, texto: textoEntrada, messageId: mensaje.id }
        );

        if (atendidoPorMenu) {
          respuestasEnviadas += 1;
          continue;
        }

        if (entrada.tipo === "seleccion") {
          await enviarMenuPrincipalSeguro(mensaje.from);
          respuestasEnviadas += 1;
          continue;
        }

        if (esEntradaSinContenidoUtil(textoEntrada)) {
          await enviarMensajeWhatsAppCompartido(
            mensaje.from,
            TEXTOS_CARTES.ENTRADA_NO_RECONOCIDA
          );
          await enviarMenuPrincipalSeguro(mensaje.from);
          respuestasEnviadas += 1;
          continue;
        }

        const atendidoPorVinculacion = await procesarVinculacionWebWhatsApp(mensaje.from, textoEntrada);
        if (atendidoPorVinculacion) {
          respuestasEnviadas += 1;
          continue;
        }

        const atendidoPorPlus = await procesarFlujoCartesPlus(
          mensaje.from,
          textoEntrada
        );

        if (atendidoPorPlus) {
          respuestasEnviadas += 1;
          continue;
        }

        const resultadoConsulta = await procesarConsultaCartesConLimite({
          telefono: mensaje.from,
          messageId: mensaje.id,
          pregunta: textoEntrada
        });

        if (resultadoConsulta.duplicada) {
          mensajesDuplicados += 1;
          continue;
        }

        respuestasEnviadas += 1;
      } catch (error) {
        respuestasFallidas += 1;

        console.error("No se pudo responder el mensaje entrante.", {
          messageId: mensaje.id,
          from: enmascararTelefono(mensaje.from),
          error: error instanceof Error ? error.message : String(error)
        });

        try {
          await enviarMensajeWhatsApp(
            mensaje.from,
            TEXTOS_CARTES.ERROR_RESPUESTA_GENERAL
          );
        } catch (fallbackError) {
          console.error("También falló el mensaje de respaldo.", {
            messageId: mensaje.id,
            from: enmascararTelefono(mensaje.from),
            error:
              fallbackError instanceof Error
                ? fallbackError.message
                : String(fallbackError)
          });
        }
      }
    }

    console.log("Webhook válido procesado.", {
      mensajes: mensajes.length,
      estados: estados.length,
      mensajesDuplicados,
      respuestasEnviadas,
      respuestasFallidas
    });

    return Response.json({
      recibido: true,
      mensajes: mensajes.length,
      estados: estados.length,
      mensajesDuplicados,
      respuestasEnviadas,
      respuestasFallidas
    });
  }

  return new Response("Método no permitido", {
    status: 405
  });
};


async function iniciarCompraPaqueteRevisiones(telefono) {
  const suscripcion = await obtenerSuscripcionActualizada(telefono);
  if (determinarPlanCartes(suscripcion) !== PLAN_CARTES_PLUS) {
    await enviarMensajeWhatsAppCompartido(telefono, TEXTOS_CARTES.PAQUETE_REQUIERE_PLUS);
    return;
  }
  const fechaFin = resolverFechaFinPeriodo(suscripcion);
  const estado = await obtenerEstadoPaquetes({ telefono });
  if (estado.paquetes >= 2) {
    await enviarMensajeWhatsAppCompartido(telefono, TEXTOS_CARTES.LIMITE_PAQUETES);
    return;
  }
  try {
    const preferencia = await crearPreferenciaPaqueteRevisiones({ telefono, fechaFin, entorno: "production" });
    const fechaTexto = formatearFecha(fechaFin);
    const mensaje = completarTextoCartes(TEXTOS_CARTES.ENLACE_PAQUETE, { fecha_fin: fechaTexto });
    await enviarMensajeWhatsAppCompartido(telefono, `${mensaje}\n\n${preferencia.init_point}`);
  } catch (error) {
    console.error("No se pudo crear el pago del paquete adicional.", { telefono: enmascararTelefono(telefono), error: error instanceof Error ? error.message : String(error) });
    await enviarMensajeWhatsAppCompartido(telefono, TEXTOS_CARTES.ERROR_PAQUETE);
  }
}

async function iniciarRevisionDocumento(telefono) {
  const suscripcion = await obtenerSuscripcionActualizada(telefono);
  if (determinarPlanCartes(suscripcion) !== PLAN_CARTES_PLUS) {
    await enviarMensajeWhatsAppCompartido(telefono, TEXTOS_CARTES.PAQUETE_REQUIERE_PLUS);
    return;
  }
  const estado = await obtenerEstadoRevisiones({ telefono });
  if (estado.disponibles <= 0) {
    await enviarMensajeWhatsAppCompartido(telefono, TEXTOS_CARTES.SIN_SALDO_REVISIONES);
    return;
  }
  await enviarBotonesSeguro(
    telefono,
    construirBotonesAutorizacionRevision(),
    `${TEXTOS_CARTES.AUTORIZAR_DOCUMENTO}\n\n${TEXTOS_CARTES.RESPALDO_AUTORIZACION_DOCUMENTO}`
  );
}

async function procesarDocumentoEntrante(telefono, messageId, documento) {
  const autorizacion = await leerAutorizacionRevision({ telefono });
  if (!autorizacion) {
    await enviarMensajeWhatsAppCompartido(telefono, TEXTOS_CARTES.DOCUMENTO_SIN_AUTORIZACION);
    return;
  }
  const suscripcion = await obtenerSuscripcionActualizada(telefono);
  if (determinarPlanCartes(suscripcion) !== PLAN_CARTES_PLUS) {
    await eliminarAutorizacionRevision({ telefono });
    await enviarMensajeWhatsAppCompartido(telefono, TEXTOS_CARTES.PAQUETE_REQUIERE_PLUS);
    return;
  }
  if (!esNombreDocx(documento?.filename) || !documento?.id) {
    await enviarMensajeWhatsAppCompartido(telefono, TEXTOS_CARTES.ARCHIVO_NO_COMPATIBLE);
    return;
  }
  const reserva = await reservarRevision({ telefono, messageId });
  if (!reserva.permitida) {
    await enviarMensajeWhatsAppCompartido(telefono, TEXTOS_CARTES.SIN_SALDO_REVISIONES);
    return;
  }
  await enviarMensajeWhatsAppCompartido(telefono, TEXTOS_CARTES.DOCUMENTO_RECIBIDO);
  try {
    const buffer = await descargarDocumentoWhatsApp(documento.id);
    const resultado = await revisarDocumentoSeguro(buffer);
    await completarRevision({ telefono, periodo: reserva.periodo, messageId });
    await eliminarAutorizacionRevision({ telefono });
    await enviarMensajeWhatsAppCompartido(telefono, TEXTOS_CARTES.REVISION_COMPLETADA);
    await enviarTextoEnPartes(telefono, resultado.textoWhatsApp);
    await enviarMensajeWhatsAppCompartido(
      telefono,
      resultado.propiedadIntelectual?.requiereRevision
        ? TEXTOS_CARTES.PROPIEDAD_INTELECTUAL_OBSERVACIONES
        : TEXTOS_CARTES.PROPIEDAD_INTELECTUAL_SIN_OBSERVACIONES
    );
    const estado = await obtenerEstadoRevisiones({ telefono });
    await enviarMensajeWhatsAppCompartido(telefono, completarTextoCartes(TEXTOS_CARTES.REVISION_EXITOSA, { revisiones_disponibles: estado.disponibles }));
    await enviarMensajeWhatsAppCompartido(telefono, TEXTOS_CARTES.VOLVER_MENU_TRAS_REVISION);
    console.log("Revisión de documento completada.", crearRegistroSeguroDocumento({ exito: true, paginas: resultado.paginas }));
  } catch (error) {
    await liberarRevision({ telefono, periodo: reserva.periodo, messageId });
    await eliminarAutorizacionRevision({ telefono });
    const codigo = error?.codigo || "ERROR_REVISION";
    console.warn("Revisión de documento no completada.", crearRegistroSeguroDocumento({ exito: false, codigo }));
    if (codigo === "DOCUMENTO_MAS_5_PAGINAS") await enviarMensajeWhatsAppCompartido(telefono, TEXTOS_CARTES.DOCUMENTO_MAS_5_PAGINAS);
    else if (/texto suficiente/i.test(String(error?.message || ""))) await enviarMensajeWhatsAppCompartido(telefono, TEXTOS_CARTES.DOCUMENTO_SIN_CONTENIDO);
    else if (/docx|zip|documento/i.test(String(error?.message || ""))) await enviarMensajeWhatsAppCompartido(telefono, TEXTOS_CARTES.DOCUMENTO_ILEGIBLE);
    else await enviarMensajeWhatsAppCompartido(telefono, TEXTOS_CARTES.ERROR_REVISION);
  }
}

async function descargarDocumentoWhatsApp(mediaId) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) throw new Error("Falta WHATSAPP_ACCESS_TOKEN.");
  const metadataResponse = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!metadataResponse.ok) throw new Error(`No se pudo obtener el documento: HTTP ${metadataResponse.status}`);
  const metadata = await metadataResponse.json();
  if (!metadata?.url) throw new Error("WhatsApp no devolvió la URL del documento.");
  const archivoResponse = await fetch(metadata.url, { headers: { Authorization: `Bearer ${token}` } });
  if (!archivoResponse.ok) throw new Error(`No se pudo descargar el documento: HTTP ${archivoResponse.status}`);
  return Buffer.from(await archivoResponse.arrayBuffer());
}

function validarFirmaMeta(rawBytes, signature) {
  const appSecret = String(process.env.META_APP_SECRET || "").trim();

  if (!appSecret || !signature.startsWith("sha256=")) {
    return false;
  }

  const firmaRecibida = signature.slice("sha256=".length);

  if (!/^[a-f0-9]{64}$/i.test(firmaRecibida)) {
    return false;
  }

  const firmaEsperada = crypto
    .createHmac("sha256", appSecret)
    .update(rawBytes)
    .digest("hex");

  const bufferRecibido = Buffer.from(firmaRecibida, "hex");
  const bufferEsperado = Buffer.from(firmaEsperada, "hex");

  return (
    bufferRecibido.length === bufferEsperado.length &&
    crypto.timingSafeEqual(bufferRecibido, bufferEsperado)
  );
}

function extraerMensajes(payload) {
  const mensajes = [];

  for (const entry of payload?.entry || []) {
    for (const change of entry?.changes || []) {
      if (Array.isArray(change?.value?.messages)) {
        mensajes.push(...change.value.messages);
      }
    }
  }

  return mensajes;
}

function extraerEstados(payload) {
  const estados = [];

  for (const entry of payload?.entry || []) {
    for (const change of entry?.changes || []) {
      if (Array.isArray(change?.value?.statuses)) {
        estados.push(...change.value.statuses);
      }
    }
  }

  return estados;
}

function registrarEstados(estados) {
  for (const estado of estados) {
    const error = Array.isArray(estado?.errors) ? estado.errors[0] : null;

    const resumen = {
      messageId: estado?.id || null,
      status: estado?.status || null,
      recipientId: estado?.recipient_id || null,
      timestamp: estado?.timestamp || null,
      conversationId: estado?.conversation?.id || null,
      pricingCategory: estado?.pricing?.category || null,
      errorCode: error?.code || null,
      errorTitle: error?.title || null,
      errorMessage: error?.message || null,
      errorDetails: error?.error_data?.details || null
    };

    if (estado?.status === "failed") {
      console.error("ESTADO WHATSAPP: FAILED", resumen);
    } else {
      console.log("ESTADO WHATSAPP", resumen);
    }
  }
}


async function iniciarAceptacionTerminos(telefono, messageId) {
  await guardarSolicitudAceptacionTerminos({ telefono, messageId });
  const texto = `${TEXTOS_CARTES.ACEPTAR_TERMINOS}\n\nTérminos de uso: ${URL_TERMINOS_CARTES}\nAviso de privacidad: ${URL_PRIVACIDAD_CARTES}`;
  await enviarBotonesSeguro(telefono, construirBotonesAceptacionTerminos({ texto }), `${texto}\n\n${TEXTOS_CARTES.RESPALDO_ACEPTACION_LEGAL}`);
}

async function generarEnlaceCartesPlus(telefono) {
  try {
    const identidad = await resolverUsuarioWhatsApp({ telefono });
    const plan = await obtenerOCrearEnlaceCartesPlus({ telefono, userId: identidad.user_id, entorno: "production" });
    await enviarMensajeWhatsAppCompartido(telefono, `${TEXTOS_CARTES.ENLACE_PAGO}\n\n${plan.init_point}`);
  } catch (error) {
    console.error("No se pudo crear el enlace de Cartes Plus.", { telefono: enmascararTelefono(telefono), error: error instanceof Error ? error.message : String(error) });
    await enviarMensajeWhatsAppCompartido(telefono, TEXTOS_CARTES.ERROR_ENLACE_PAGO);
  }
}

async function procesarFlujoMenuCartes(telefono, entrada) {
  const texto = String(entrada?.texto || "");
  const id = String(
    entrada?.id || resolverOpcionNumericaMenu(texto) || ""
  );

  if (!id && esComandoMenu(texto)) {
    await enviarMenuPrincipalSeguro(telefono);
    return true;
  }

  if (!id && esComandoRevision(texto)) {
    await iniciarRevisionDocumento(telefono);
    return true;
  }

  if (!id && esComandoPaquete(texto)) {
    await iniciarCompraPaqueteRevisiones(telefono);
    return true;
  }

  if (!id && esComandoEstadoSuscripcion(texto)) {
    await mostrarEstadoSuscripcion(telefono, { soloEstado: true });
    return true;
  }

  if (!id && esComandoCancelar(texto)) {
    await solicitarCancelacionCartesPlus(telefono);
    return true;
  }

  if (!id && esConfirmacionCancelacion(texto)) {
    await confirmarCancelacionCartesPlus(telefono);
    return true;
  }

  if (!id && esConservacionSuscripcion(texto)) {
    await eliminarCancelacionPendiente({ telefono });
    await enviarMensajeWhatsAppCompartido(
      telefono,
      TEXTOS_CARTES.SUSCRIPCION_SIN_CAMBIOS
    );
    return true;
  }

  switch (id) {
    case MENU_IDS.PRINCIPAL:
    case MENU_IDS.VOLVER:
      await enviarMenuPrincipalSeguro(telefono);
      return true;

    case MENU_IDS.CONVERSAR:
      await enviarMensajeWhatsAppCompartido(
        telefono,
        TEXTOS_CARTES.INICIAR_CONVERSACION
      );
      return true;

    case MENU_IDS.PLUS_INFO:
      await enviarMensajeWhatsAppCompartido(
        telefono,
        TEXTOS_CARTES.CONOCER_CARTES_PLUS
      );
      return true;

    case MENU_IDS.SUSCRIBIR:
      if (paypalEstaHabilitado()) {
        await enviarListaSeguro(
          telefono,
          construirMenuSuscripcion({ paypalHabilitado: true }),
          TEXTOS_CARTES.RESPALDO_MENU_SUSCRIPCION
        );
      } else {
        await iniciarAceptacionTerminos(telefono, entrada.messageId);
      }
      return true;

    case MENU_IDS.SUSCRIBIR_MP:
      await iniciarAceptacionTerminos(telefono, entrada.messageId);
      return true;

    case MENU_IDS.SUSCRIBIR_PAYPAL:
      await procesarSuscripcionPayPal(telefono);
      return true;

    case MENU_IDS.MI_SUSCRIPCION:
      await mostrarEstadoSuscripcion(telefono, { soloEstado: false });
      return true;

    case MENU_IDS.SUSCRIPCION_ESTADO:
      await mostrarEstadoSuscripcion(telefono, { soloEstado: true });
      return true;

    case MENU_IDS.SUSCRIPCION_CANCELAR:
      await solicitarCancelacionCartesPlus(telefono);
      return true;

    case MENU_IDS.SUSCRIPCION_PROBLEMA:
    case MENU_IDS.AYUDA_PAGO:
      await enviarMensajeWhatsAppCompartido(
        telefono,
        TEXTOS_CARTES.PAGO_APROBADO_SIN_ACTIVACION
      );
      return true;

    case MENU_IDS.AYUDA:
      await enviarListaSeguro(
        telefono,
        construirMenuAyuda(),
        TEXTOS_CARTES.AYUDA_SOPORTE
      );
      return true;

    case MENU_IDS.AYUDA_SUSCRIPCION:
      await enviarMensajeWhatsAppCompartido(
        telefono,
        TEXTOS_CARTES.NUEVO_ENLACE_PAGO
      );
      return true;

    case MENU_IDS.AYUDA_CONTACTO:
      await enviarMensajeWhatsAppCompartido(
        telefono,
        TEXTOS_CARTES.AYUDA_SOPORTE
      );
      return true;

    case MENU_IDS.LEGAL:
      await enviarMensajeWhatsAppCompartido(
        telefono,
        `${TEXTOS_CARTES.PRIVACIDAD_TERMINOS}\n\nTérminos de uso:\n${URL_TERMINOS_CARTES}\n\nAviso de privacidad:\n${URL_PRIVACIDAD_CARTES}`
      );
      return true;

    case MENU_IDS.CANCELAR_CONFIRMAR:
      await confirmarCancelacionCartesPlus(telefono);
      return true;

    case MENU_IDS.REVISION_INICIAR:
      await iniciarRevisionDocumento(telefono);
      return true;

    case MENU_IDS.PAQUETE_COMPRAR:
      await iniciarCompraPaqueteRevisiones(telefono);
      return true;

    case MENU_IDS.REVISION_AUTORIZAR:
      await guardarAutorizacionRevision({ telefono, messageId: entrada.messageId });
      await enviarMensajeWhatsAppCompartido(telefono, TEXTOS_CARTES.AUTORIZACION_ACEPTADA);
      return true;

    case MENU_IDS.REVISION_RECHAZAR:
      await eliminarAutorizacionRevision({ telefono });
      await enviarMensajeWhatsAppCompartido(telefono, TEXTOS_CARTES.AUTORIZACION_RECHAZADA);
      return true;


    case MENU_IDS.TERMINOS_ACEPTAR: {
      const aceptacion = await registrarAceptacionTerminos({ telefono, messageId: entrada.messageId });
      if (!aceptacion) {
        await enviarMensajeWhatsAppCompartido(telefono, TEXTOS_CARTES.ACEPTACION_VENCIDA);
        return true;
      }
      await enviarMensajeWhatsAppCompartido(telefono, TEXTOS_CARTES.TERMINOS_ACEPTADOS);
      await generarEnlaceCartesPlus(telefono);
      return true;
    }

    case MENU_IDS.TERMINOS_RECHAZAR:
      await rechazarAceptacionTerminos({ telefono, messageId: entrada.messageId });
      await enviarMensajeWhatsAppCompartido(telefono, TEXTOS_CARTES.TERMINOS_RECHAZADOS);
      return true;

    case MENU_IDS.CANCELAR_CONSERVAR:
      await eliminarCancelacionPendiente({ telefono });
      await enviarMensajeWhatsAppCompartido(
        telefono,
        TEXTOS_CARTES.SUSCRIPCION_SIN_CAMBIOS
      );
      return true;

    default:
      return false;
  }
}

async function enviarMenuPrincipalSeguro(telefono) {
  await enviarListaSeguro(
    telefono,
    construirMenuPrincipal(),
    TEXTOS_CARTES.RESPALDO_MENU_PRINCIPAL
  );
}

async function enviarListaSeguro(telefono, configuracion, respaldo) {
  try {
    await enviarListaWhatsApp(telefono, configuracion);
  } catch (error) {
    console.error("No se pudo enviar el menú interactivo; se usará texto.", {
      telefono: enmascararTelefono(telefono),
      error: error instanceof Error ? error.message : String(error)
    });
    await enviarMensajeWhatsAppCompartido(telefono, respaldo);
  }
}

async function enviarBotonesSeguro(telefono, configuracion, respaldo) {
  try {
    await enviarBotonesWhatsApp(telefono, configuracion);
  } catch (error) {
    console.error("No se pudieron enviar botones interactivos; se usará texto.", {
      telefono: enmascararTelefono(telefono),
      error: error instanceof Error ? error.message : String(error)
    });
    await enviarMensajeWhatsAppCompartido(telefono, respaldo);
  }
}

function paypalEstaHabilitado() {
  return (
    String(process.env.CARTES_PAYPAL_ENABLED || "").toLowerCase() === "true" &&
    Boolean(String(process.env.CARTES_PAYPAL_SUBSCRIPTION_URL || "").trim())
  );
}

async function procesarSuscripcionPayPal(telefono) {
  const url = String(process.env.CARTES_PAYPAL_SUBSCRIPTION_URL || "").trim();

  if (!paypalEstaHabilitado() || !url) {
    await enviarMensajeWhatsAppCompartido(
      telefono,
      TEXTOS_CARTES.PAYPAL_NO_DISPONIBLE
    );
    return;
  }

  await enviarMensajeWhatsAppCompartido(
    telefono,
    `${TEXTOS_CARTES.ENLACE_PAYPAL}\n\n${url}`
  );
}

async function mostrarEstadoSuscripcion(telefono, { soloEstado }) {
  const registro = await obtenerSuscripcionActualizada(telefono);
  const plan = determinarPlanCartes(registro);
  const identidad = await resolverUsuarioWhatsApp({ telefono });
  await sincronizarPlanUso({ userId: identidad.user_id, plan });
  const uso = await obtenerEstadoUsoUnificado({
    userId: identidad.user_id,
    telefono,
    plan
  });
  const resumen = construirResumenSuscripcion(registro, uso);

  if (soloEstado) {
    await enviarMensajeWhatsAppCompartido(
      telefono,
      `${resumen}\n\n${TEXTOS_CARTES.RESPALDO_ESTADO_SUSCRIPCION}`
    );
    return;
  }

  const cancelable =
    esEstadoCancelable(registro?.status) && !registro?.renovacion_cancelada;

  await enviarListaSeguro(
    telefono,
    construirMenuMiSuscripcion({
      resumen,
      cancelable,
      plusActivo: plan === PLAN_CARTES_PLUS
    }),
    cancelable
      ? `${resumen}\n\n${TEXTOS_CARTES.RESPALDO_MENU_CANCELACION}`
      : `${resumen}\n\n${TEXTOS_CARTES.RESPALDO_ESTADO_SUSCRIPCION}`
  );
}

async function obtenerSuscripcionActualizada(telefono) {
  let existente = null;
  try {
    const identidad = await resolverUsuarioWhatsApp({ telefono });
    existente = await buscarSuscripcionPorUserId({
      entorno: "production",
      userId: identidad.user_id
    });
  } catch (error) {
    console.warn("No se pudo resolver la suscripción por user_id; se usará compatibilidad por teléfono.", {
      telefono: enmascararTelefono(telefono),
      error: error instanceof Error ? error.message : String(error)
    });
  }

  if (!existente) {
    existente = await buscarSuscripcionPorTelefono({
      entorno: "production",
      telefono
    });
  }

  if (!existente?.preapproval_id) return existente || null;

  try {
    const remoto = await obtenerSuscripcionMercadoPago(
      existente.preapproval_id,
      "production"
    );
    const actualizado = {
      ...existente,
      status: normalizarEstadoSuscripcion(remoto?.status || existente.status),
      next_payment_date:
        remoto?.next_payment_date || existente.next_payment_date || null,
      payment_method_id:
        remoto?.payment_method_id || existente.payment_method_id || null,
      updated_at: new Date().toISOString()
    };

    await guardarSuscripcion({ entorno: "production", registro: actualizado });
    return actualizado;
  } catch (error) {
    console.error("No se pudo actualizar el estado remoto de la suscripción.", {
      telefono: enmascararTelefono(telefono),
      preapprovalId: existente.preapproval_id,
      error: error instanceof Error ? error.message : String(error)
    });

    return { ...existente, estado_no_actualizado: true };
  }
}

function construirResumenSuscripcion(registro, uso) {
  const esPlusActiva = uso?.plan === PLAN_CARTES_PLUS;
  const lineas = [
    `*${completarTextoCartes(TEXTOS_CARTES.RESUMEN_PLAN_ACTUAL, {
      plan: esPlusActiva ? "Cartes Plus" : "Cartes gratuito"
    })}*`
  ];

  if (registro?.preapproval_id) {
    lineas.push(
      `*${completarTextoCartes(TEXTOS_CARTES.RESUMEN_ESTADO_SUSCRIPCION, {
        estado: esPlusActiva ? "Activo" : "Inactivo"
      })}*`,
      TEXTOS_CARTES.RESUMEN_MEDIO_PAGO_MP
    );

    if (registro.renovacion_cancelada && tieneAccesoCartesPlus(registro)) {
      lineas.push(
        TEXTOS_CARTES.RESUMEN_RENOVACION_CANCELADA,
        completarTextoCartes(TEXTOS_CARTES.RESUMEN_ACCESO_PLUS_HASTA, {
          fecha_fin: formatearFecha(registro.access_until)
        }),
        TEXTOS_CARTES.RESUMEN_SIN_COBROS_FUTUROS
      );
    } else if (registro.next_payment_date && registro.status === "authorized") {
      lineas.push(
        completarTextoCartes(TEXTOS_CARTES.RESUMEN_PROXIMA_FECHA_COBRO, {
          fecha: formatearFecha(registro.next_payment_date)
        })
      );
    }

    if (registro.estado_no_actualizado) {
      lineas.push(TEXTOS_CARTES.ESTADO_NO_ACTUALIZADO);
    }
  } else {
    lineas.push(
      `*${completarTextoCartes(TEXTOS_CARTES.RESUMEN_ESTADO_SUSCRIPCION, {
        estado: "Inactivo"
      })}*`
    );
  }

  lineas.push(
    `*${completarTextoCartes(TEXTOS_CARTES.RESUMEN_CONSULTAS_PERIODO, {
      usadas: uso.usadas,
      limite: uso.limite
    })}*`
  );

  lineas.push(
    `*${completarTextoCartes(TEXTOS_CARTES.RESUMEN_CONSULTAS_DISPONIBLES, {
      disponibles: uso.disponibles
    })}*`
  );

  return lineas.join("\n");
}

async function solicitarCancelacionCartesPlus(telefono) {
  const registro = await obtenerSuscripcionActualizada(telefono);

  if (!registro?.preapproval_id || !esEstadoCancelable(registro.status)) {
    await enviarMensajeWhatsAppCompartido(
      telefono,
      TEXTOS_CARTES.SIN_SUSCRIPCION_CANCELABLE
    );
    return;
  }

  await guardarCancelacionPendiente({
    telefono,
    entorno: "production",
    preapprovalId: registro.preapproval_id
  });

  const fechaFin = registro.next_payment_date
    ? formatearFecha(registro.next_payment_date)
    : "";

  await enviarBotonesSeguro(
    telefono,
    construirBotonesCancelacion({ fechaFin }),
    fechaFin
      ? `${completarTextoCartes(TEXTOS_CARTES.CONFIRMAR_CANCELACION, { fecha_fin: fechaFin })} ${TEXTOS_CARTES.RESPALDO_CONFIRMACION_CANCELACION}`
      : `${TEXTOS_CARTES.CONFIRMAR_CANCELACION_SIN_FECHA} ${TEXTOS_CARTES.RESPALDO_CONFIRMACION_CANCELACION}`
  );
}

async function confirmarCancelacionCartesPlus(telefono) {
  const pendiente = await leerCancelacionPendiente({ telefono });

  if (!pendiente?.preapproval_id) {
    await enviarMensajeWhatsAppCompartido(
      telefono,
      TEXTOS_CARTES.CANCELACION_VENCIDA
    );
    return;
  }

  const entorno = pendiente.entorno || "production";
  const preapprovalId = pendiente.preapproval_id;
  let marcaReclamada = false;
  let cancelacionCompletada = false;
  let mensajeEnviado = false;

  try {
    marcaReclamada = await reclamarNotificacionSuscripcion({
      entorno,
      preapprovalId,
      status: "cancelled"
    });

    const existente = await obtenerSuscripcionActualizada(telefono);
    const accesoHasta = existente?.next_payment_date || existente?.access_until || null;

    if (!accesoHasta || !Number.isFinite(Date.parse(String(accesoHasta)))) {
      throw new Error(
        "No se pudo determinar la fecha hasta la que debe conservarse Cartes Plus."
      );
    }

    const cancelada = await cancelarSuscripcionMercadoPago(
      preapprovalId,
      entorno
    );
    cancelacionCompletada = true;

    const ahora = new Date().toISOString();

    const registro = {
      ...(existente || {}),
      entorno,
      telefono: existente?.telefono || telefono,
      plan: "cartes_plus",
      preapproval_id: preapprovalId,
      status: normalizarEstadoSuscripcion(cancelada?.status || "cancelled"),
      renovacion_cancelada: true,
      renewal_cancelled_at: ahora,
      access_until: accesoHasta,
      updated_at: ahora
    };

    if (marcaReclamada) {
      await enviarMensajeWhatsAppCompartido(
        telefono,
        completarTextoCartes(TEXTOS_CARTES.CANCELACION_CONFIRMADA, {
          fecha_fin: formatearFecha(accesoHasta)
        })
      );
      mensajeEnviado = true;
      registro.notified_status = "cancelled";
      registro.notified_at = ahora;
    }

    await guardarSuscripcion({ entorno, registro });
    await eliminarCancelacionPendiente({ telefono });
  } catch (error) {
    if (marcaReclamada && !mensajeEnviado) {
      try {
        await liberarNotificacionSuscripcion({
          entorno,
          preapprovalId,
          status: "cancelled"
        });
      } catch (liberacionError) {
        console.error("No se pudo liberar la marca de cancelación.", {
          telefono: enmascararTelefono(telefono),
          preapprovalId,
          error:
            liberacionError instanceof Error
              ? liberacionError.message
              : String(liberacionError)
        });
      }
    }

    await eliminarCancelacionPendiente({ telefono });
    console.error("No se pudo completar el flujo de baja de Cartes Plus.", {
      telefono: enmascararTelefono(telefono),
      preapprovalId,
      cancelacionCompletada,
      mensajeEnviado,
      error: error instanceof Error ? error.message : String(error)
    });

    if (!cancelacionCompletada) {
      await enviarMensajeWhatsAppCompartido(
        telefono,
        TEXTOS_CARTES.ERROR_CANCELACION
      );
    }
  }
}

function formatearFecha(valor) {
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return String(valor);

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "long",
    timeZone: "America/Mexico_City"
  }).format(fecha);
}

async function procesarFlujoCartesPlus(telefono, texto) {
  if (esSolicitudPlusPrueba(texto)) {
    const telefonosAdministradores = String(
      process.env.CARTES_ADMIN_PHONE || ""
    )
      .split(",")
      .map((valor) => valor.replace(/\D/g, ""))
      .filter(Boolean);

    const telefonoNormalizado = normalizarTelefonoMexico(telefono);
    const autorizado = telefonosAdministradores.some(
      (valor) => normalizarTelefonoMexico(valor) === telefonoNormalizado
    );

    if (!autorizado) {
      await enviarMensajeWhatsAppCompartido(
        telefono,
        "El modo de prueba de Cartes Plus no está autorizado para este número."
      );
      return true;
    }

    try {
      const identidad = await resolverUsuarioWhatsApp({ telefono });
      const plan = await obtenerOCrearEnlaceCartesPlus({
        telefono,
        userId: identidad.user_id,
        entorno: "test",
        forzarNuevo: true
      });

      await enviarMensajeWhatsAppCompartido(
        telefono,
        `PRUEBA CARTES PLUS\n\nAplicación: ${plan.application_id}\nVendedor: ${plan.collector_id}\nImporte: $149 MXN al mes\n\nAbre este enlace en una ventana de incógnito e ingresa con la cuenta Comprador de prueba:\n\n${plan.init_point}`
      );
    } catch (error) {
      console.error("No se pudo crear el plan de prueba de Cartes Plus.", {
        telefono: enmascararTelefono(telefono),
        error: error instanceof Error ? error.message : String(error)
      });

      await enviarMensajeWhatsAppCompartido(
        telefono,
        `No se pudo generar el enlace de prueba. No se realizó ningún cobro. Error: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    return true;
  }

  if (esSolicitudPlus(texto)) {
    await iniciarAceptacionTerminos(telefono, `texto-${Date.now()}`);
    return true;
  }

  return false;
}

function normalizarTelefonoMexico(telefono) {
  const limpio = String(telefono || "").replace(/\D/g, "");

  // WhatsApp puede representar números mexicanos con 52 o con el prefijo histórico 521.
  if (limpio.startsWith("521") && limpio.length === 13) {
    return `52${limpio.slice(3)}`;
  }

  return limpio;
}

async function procesarVinculacionWebWhatsApp(telefono, textoEntrada) {
  const match = String(textoEntrada || "").trim().match(/^VINCULAR\s+(\d{6})$/i);
  if (!match) return false;

  if (!cuentaCentralConfigurada()) {
    await enviarMensajeWhatsAppCompartido(
      telefono,
      "La vinculación entre Web y WhatsApp todavía no está habilitada en este entorno."
    );
    return true;
  }

  try {
    const identidad = await resolverUsuarioWhatsApp({ telefono });
    await completarVinculacionCentral({ userId: identidad.user_id, code: match[1] });
    await enviarMensajeWhatsAppCompartido(
      telefono,
      "Listo. Tu Cartes Web quedó vinculado con este WhatsApp. Desde ahora ambas interfaces pueden utilizar la misma cuenta y el mismo saldo de consultas."
    );
  } catch (error) {
    console.error("No se pudo vincular Cartes Web con WhatsApp.", {
      telefono: enmascararTelefono(telefono),
      error: error instanceof Error ? error.message : String(error)
    });
    const mensaje = error instanceof Error && /expir|no existe|utilizado|código/i.test(error.message)
      ? "Ese código de vinculación no es válido o ya expiró. Genera uno nuevo desde Cartes Web e inténtalo nuevamente."
      : "No pude completar la vinculación en este momento. Genera un código nuevo desde Cartes Web e inténtalo nuevamente.";
    await enviarMensajeWhatsAppCompartido(telefono, mensaje);
  }
  return true;
}

async function procesarConsultaCartesConLimite({
  telefono,
  messageId,
  pregunta
}) {
  const identidad = await resolverUsuarioWhatsApp({ telefono });

  const suscripcion = await obtenerSuscripcionActualizada(telefono);
  const plan = determinarPlanCartes(suscripcion);
  await sincronizarPlanUso({ userId: identidad.user_id, plan });
  const reserva = await reservarConsultaUnificada({
    userId: identidad.user_id,
    telefono,
    plan,
    requestId: messageId
  });

  if (reserva.duplicada) {
    console.log("Consulta duplicada ignorada por el control mensual.", {
      telefono: enmascararTelefono(telefono),
      messageId,
      periodo: reserva.periodo
    });
    return { duplicada: true, bloqueada: false };
  }

  if (!reserva.permitida) {
    await enviarMensajeWhatsAppCompartido(
      telefono,
      construirMensajeLimiteConsultas(reserva)
    );
    return { duplicada: false, bloqueada: true };
  }

  try {
    const autoria = clasificarSolicitudAutoria(pregunta);

    if (autoria.bloqueada) {
      await enviarMensajeWhatsAppCompartido(
        telefono,
        TEXTOS_CARTES.REDACCION_COMPLETA_NO_PERMITIDA
      );
      await completarConsultaUnificada({
        userId: identidad.user_id,
        telefono,
        periodo: reserva.periodo,
        requestId: messageId
      });

      console.log("Solicitud de redacción completa orientada sin generar el trabajo.", {
        telefono: enmascararTelefono(telefono),
        messageId,
        motivo: autoria.motivo
      });

      return { duplicada: false, bloqueada: false, autoriaBloqueada: true };
    }

    const respuestaCartes = await consultarCartes(pregunta, {
      externalUserId: identidad.identity_value,
      userId: identidad.user_id,
      requestId: messageId
    });
    await enviarTextoEnPartes(telefono, respuestaCartes);
    await completarConsultaUnificada({
      userId: identidad.user_id,
      telefono,
      periodo: reserva.periodo,
      requestId: messageId
    });

    return { duplicada: false, bloqueada: false };
  } catch (error) {
    try {
      await liberarConsultaUnificada({
        userId: identidad.user_id,
        telefono,
        periodo: reserva.periodo,
        requestId: messageId
      });
    } catch (liberacionError) {
      console.error("No se pudo liberar una consulta fallida.", {
        telefono: enmascararTelefono(telefono),
        messageId,
        error:
          liberacionError instanceof Error
            ? liberacionError.message
            : String(liberacionError)
      });
    }

    throw error;
  }
}

function construirMensajeLimiteConsultas(uso) {
  if (uso.plan === PLAN_CARTES_PLUS) {
    return TEXTOS_CARTES.LIMITE_CONSULTAS_PLUS;
  }

  return TEXTOS_CARTES.SIN_PLUS_SIN_SALDO;
}

async function consultarCartes(pregunta, contexto = {}) {
  const resultado = await consultarCartesCore({
    pregunta,
    history: contexto.history || [],
    channel: "whatsapp",
    externalUserId: contexto.externalUserId || null,
    userId: contexto.userId || null,
    requestId: contexto.requestId || null
  });

  console.log("Respuesta obtenida de Cartes Core.", {
    route: resultado.meta?.route || null,
    topic: resultado.meta?.topic || null,
    promptVersion: resultado.meta?.promptVersion || null,
    answerChars: resultado.answer.length
  });

  return resultado.answer;
}

function dividirTexto(texto, maximo) {
  const limpio = texto.trim();

  if (!limpio) {
    return [];
  }

  if (limpio.length <= maximo) {
    return [limpio];
  }

  const partes = [];
  let restante = limpio;

  while (restante.length > maximo) {
    let corte = restante.lastIndexOf("\n\n", maximo);

    if (corte < Math.floor(maximo * 0.6)) {
      corte = restante.lastIndexOf("\n", maximo);
    }

    if (corte < Math.floor(maximo * 0.6)) {
      corte = restante.lastIndexOf(" ", maximo);
    }

    if (corte < Math.floor(maximo * 0.6)) {
      corte = maximo;
    }

    partes.push(restante.slice(0, corte).trim());
    restante = restante.slice(corte).trim();
  }

  if (restante) {
    partes.push(restante);
  }

  return partes;
}

async function enviarMensajeWhatsApp(destinatario, texto) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token) {
    throw new Error("Falta la variable WHATSAPP_ACCESS_TOKEN.");
  }

  if (!phoneNumberId) {
    throw new Error("Falta la variable WHATSAPP_PHONE_NUMBER_ID.");
  }

  const destinatarioSeguro = String(destinatario || "").replace(/\d(?=\d{4})/g, "*");
  console.log("Mensaje enviado a Meta.", { destinatario: destinatarioSeguro });

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
        type: "text",
        text: {
          preview_url: false,
          body: texto
        }
      })
    }
  );

  const rawResponse = await response.text();

  let detalle;

  try {
    detalle = rawResponse ? JSON.parse(rawResponse) : {};
  } catch {
    detalle = {
      raw: rawResponse
    };
  }

  if (!response.ok) {
    console.error("WhatsApp rechazó el mensaje.", {
      status: response.status,
      detalle
    });

    throw new Error(
      `WhatsApp respondió con HTTP ${response.status}: ${rawResponse}`
    );
  }

  console.log("WhatsApp aceptó el mensaje.", {
    status: response.status,
    messageId: detalle?.messages?.[0]?.id || null
  });

  return detalle;
}

function sanitizarTexto(value, maximo) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maximo);
}

function limitarTexto(texto, maximo) {
  const value = String(texto || "");

  if (value.length <= maximo) {
    return value;
  }

  return `${value.slice(0, maximo - 3)}...`;
}

function limpiarDeduplicacion() {
  const limite = Date.now() - MESSAGE_DEDUPE_TTL_MS;

  for (const [messageId, timestamp] of mensajesProcesados.entries()) {
    if (timestamp < limite) {
      mensajesProcesados.delete(messageId);
    }
  }
}
