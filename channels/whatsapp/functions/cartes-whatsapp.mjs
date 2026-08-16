import {
  completarConsultaMensual,
  completarVinculacionConWhatsApp,
  liberarConsultaMensual,
  obtenerEstadoUsoMensual,
  obtenerPlanUsuario,
  obtenerSuscripcionUsuario,
  reservarConsultaMensual,
  resolverOCrearUsuarioPorIdentidad,
  sincronizarSuscripcionUsuario
} from "../../../core/ai/lib-cartes-account.mjs";
import guiaMasonico from "../../../core/ai/guia-masonico.mjs";
import {
  obtenerEstadoRevisionesCartes,
  revisarDocumentoCartes
} from "../../../core/ai/cartes-document-review.mjs";

import {
  resolverVencimientoPaqueteRevision
} from "../../../core/ai/lib-cartes-review-packs.mjs";
import {
  downloadWhatsAppMedia,
  getWhatsAppMediaMetadata,
  extractMessageDocument,
  extractMetaEvents,
  extractMessageText,
  sendWhatsAppInteractiveList,
  sendWhatsAppReplyButtons,
  sendWhatsAppTextParts,
  verifyMetaSignature
} from "./lib-meta.mjs";
import { claimInboundMessage, clearFlow, getFlow, releaseInboundMessage, savePaymentContext, setFlow } from "./lib-state.mjs";
import { cancelMercadoPagoSubscription, createMercadoPagoCheckout, normalizeMercadoPagoSubscription } from "./lib-mercadopago.mjs";
import { cancelPayPalSubscription, createPayPalCheckout, getPayPalSubscription, normalizePayPalSubscription } from "./lib-paypal.mjs";
import { createCheckoutForCartes } from "./lib-cartes-checkout.mjs";
import { createReviewPackCheckout } from "./lib-cartes-review-pack-checkout.mjs";

const MENU = `*Menú de Cartes*

Elige una opción o escribe directamente tu consulta sobre la masonería:

• Conversar con Cartes
• Conoce Cartes Plus
• Suscribirme
• Mi suscripción
• Ayuda y soporte
• Privacidad y términos`;

const realDeps = {
  completarConsultaMensual,
  completarVinculacionConWhatsApp,
  liberarConsultaMensual,
  obtenerEstadoUsoMensual,
  obtenerPlanUsuario,
  obtenerSuscripcionUsuario,
  reservarConsultaMensual,
  resolverOCrearUsuarioPorIdentidad,
  sincronizarSuscripcionUsuario,
  guiaMasonico,
  obtenerEstadoRevisionesCartes,
  revisarDocumentoCartes,
  resolverVencimientoPaqueteRevision,
  downloadWhatsAppMedia,
  getWhatsAppMediaMetadata,
  extractMessageDocument,
  extractMetaEvents,
  extractMessageText,
  sendWhatsAppTextParts,
  sendWhatsAppInteractiveList,
  sendWhatsAppReplyButtons,
  verifyMetaSignature,
  claimInboundMessage,
  releaseInboundMessage,
  clearFlow,
  getFlow,
  savePaymentContext,
  setFlow,
  cancelMercadoPagoSubscription,
  createMercadoPagoCheckout,
  normalizeMercadoPagoSubscription,
  cancelPayPalSubscription,
  createPayPalCheckout,
  getPayPalSubscription,
  normalizePayPalSubscription,
  createCheckoutForCartes,
  createReviewPackCheckout,
  env: process.env
};

export function createWhatsAppHandler(overrides = {}) {
  const d = { ...realDeps, ...overrides };

  return async function handler(request) {
    const url = new URL(request.url);
    const env = d.env || process.env;

    if (request.method === "GET") {
      const ok =
        url.searchParams.get("hub.mode") === "subscribe" &&
        url.searchParams.get("hub.verify_token") === String(env.WHATSAPP_VERIFY_TOKEN || "") &&
        Boolean(url.searchParams.get("hub.challenge"));
      return ok
        ? new Response(url.searchParams.get("hub.challenge"), { status: 200 })
        : new Response("Verificación rechazada", { status: 403 });
    }

    if (request.method !== "POST") {
      return new Response("Método no permitido", { status: 405 });
    }

    const rawBytes = Buffer.from(await request.arrayBuffer());
    if (!d.verifyMetaSignature(rawBytes, request.headers.get("x-hub-signature-256") || "", env.META_APP_SECRET)) {
      console.warn("WA_V2_META_SIGNATURE_INVALID");
      return Response.json({ recibido: false, error: "Firma inválida" }, { status: 401 });
    }

    let payload;
    try {
      payload = JSON.parse(rawBytes.toString("utf8"));
    } catch {
      return Response.json({ recibido: false, error: "JSON inválido" }, { status: 400 });
    }

    const { messages, statuses } = d.extractMetaEvents(payload);
    for (const status of statuses) {
      console.log("WA_V2_STATUS", JSON.stringify({
        id: status?.id || null,
        status: status?.status || null,
        phone_number_id: status?.phoneNumberId || null
      }));
    }

    let ok = 0;
    let failed = 0;
    let duplicates = 0;

    for (const message of messages) {
      const messageId = String(message?.id || "").trim();
      let claimed = true;
      try {
        if (messageId && typeof d.claimInboundMessage === "function") {
          claimed = await d.claimInboundMessage(messageId);
        }
        if (!claimed) {
          duplicates += 1;
          continue;
        }

        await processMessage(message, d);
        ok += 1;
      } catch (error) {
        failed += 1;
        if (claimed && messageId && typeof d.releaseInboundMessage === "function") {
          await d.releaseInboundMessage(messageId).catch(() => {});
        }
        console.error("WA_V2_MESSAGE_ERROR", JSON.stringify({
          message_id: message?.id || null,
          from: maskPhone(message?.from),
          error: error instanceof Error ? error.message : String(error)
        }));
        try {
          await d.sendWhatsAppTextParts({
            to: message?.from,
            phoneNumberId: message?.phoneNumberId,
            text: "No pude responder tu consulta en este momento. Intenta nuevamente en unos minutos."
          });
        } catch (sendError) {
          console.error("WA_V2_FALLBACK_ERROR", JSON.stringify({
            message_id: message?.id || null,
            error: sendError instanceof Error ? sendError.message : String(sendError)
          }));
        }
      }
    }

    console.log("WA_V2_WEBHOOK_OK", JSON.stringify({
      messages: messages.length,
      statuses: statuses.length,
      ok,
      failed,
      duplicates
    }));

    return Response.json({
      recibido: true,
      mensajes: messages.length,
      estados: statuses.length,
      respuestas: ok,
      fallos: failed,
      duplicados: duplicates
    });
  };
}

export default createWhatsAppHandler();

async function processMessage(message, d) {
  const phone = String(message?.from || "").replace(/\D/g, "");
  const phoneNumberId = String(message?.phoneNumberId || "").trim();
  const messageId = String(message?.id || "").trim();
  const text = cleanText(resolveInteractiveCommand(message, d.extractMessageText(message)));
  const documentInfo =
    typeof d.extractMessageDocument === "function"
      ? d.extractMessageDocument(message)
      : null;

  if (!phone || !messageId) return;

  const identity = await d.resolverOCrearUsuarioPorIdentidad({ tipo: "whatsapp", valor: phone });
  const userId = identity.user_id;
  const normalized = normalizeCommand(text);
  const env = d.env || process.env;
  const terms = env.CARTES_TERMS_URL || "https://develandoelcodigomasonico.com/cartes-whatsapp/terminos.html";
  const privacy = env.CARTES_PRIVACY_URL || "https://develandoelcodigomasonico.com/cartes-whatsapp/privacy.html";

  // CARTES_DOCUMENT_WHATSAPP_V070
  if (documentInfo) {
    await recibirDocumentoWhatsApp({
      phone,
      phoneNumberId,
      messageId,
      userId,
      documentInfo
    }, d);

    return;
  }

  // CARTES_WORD_DOC_V085
  // Medios que no son documentos Word se rechazan
  // sin consultar metadata ni descargar el binario.
  const inboundMediaType =
    String(
      message?.type || ""
    ).toLowerCase();

  const unsupportedMediaTypes =
    new Set([
      "document",
      "image",
      "video",
      "audio",
      "sticker"
    ]);

  if (
    unsupportedMediaTypes.has(
      inboundMediaType
    )
  ) {
    await rechazarArchivoNoCompatibleWhatsApp({
      phone,
      phoneNumberId
    }, d);

    return;
  }

  const linkMatch = text.match(/^VINCULAR\s+(\d{6})$/i);
  if (linkMatch) {
    const linked = await d.completarVinculacionConWhatsApp({
      code: linkMatch[1],
      whatsappUserId: userId
    });
    await d.clearFlow(userId);

    if (linked?.conflict === "active_subscriptions") {
      await d.sendWhatsAppTextParts({
        to: phone,
        phoneNumberId,
        text: "No pude vincular estas cuentas porque ambas tienen una suscripción Cartes Plus vigente. Para proteger tus pagos, Cartes no fusionará dos suscripciones vigentes diferentes. Ninguna cuenta fue modificada. Espera a que una de las suscripciones termine o contacta a soporte para decidir cuál conservar."
      });
      return;
    }

    await d.sendWhatsAppTextParts({
      to: phone,
      phoneNumberId,
      text: linked?.already_linked
        ? "Tu cuenta Web y WhatsApp ya estaban vinculadas."
        : "Listo. Tu cuenta Web y WhatsApp quedaron vinculadas y ahora comparten plan, uso, suscripción y conversación."
    });
    return;
  }

  if (!text) {
    await sendMainMenu({ phone, phoneNumberId, userId }, d);
    return;
  }

  const globalMenu = detectGlobalMenuCommand(message, text);
  if (globalMenu) {
    await d.clearFlow(userId);
    console.log("WA_MENU_GLOBAL_V018", JSON.stringify({
      message_id: messageId,
      phone_number_id: phoneNumberId,
      candidate_count: globalMenu.candidateCount
    }));
    await sendMainMenu({ phone, phoneNumberId, userId }, d);
    return;
  }

  // WHATSAPP_NON_QUERY_MENU_V019
  if (isNonQueryInput(text)) {
    await d.clearFlow(userId);
    await sendMainMenu({ phone, phoneNumberId, userId }, d);
    return;
  }

  // El estado del flujo se lee sólo después de descartar comandos globales.
  // Así Menú no puede quedar atrapado dentro de accept_terms/payment_provider.

  // WHATSAPP_DOCUMENT_FLOW_STATE_V079
  // Las opciones normales de navegación también deben poder
  // abandonar únicamente un consentimiento documental pendiente.
  const documentNavigationCommands = new Set([
    "1",
    "4",
    "5",
    "6",
    "7",

    "conversar",
    "conversar con cartes",

    "revisar documento",
    "revisar un documento",
    "revision de documento",

    "mi suscripcion",
    "estado suscripcion",
    "estado de mi suscripcion",
    "ver mi suscripcion",

    "ayuda",
    "ayuda y soporte",
    "help",

    "privacidad",
    "terminos",
    "privacidad y terminos",

    "comprar revisiones",
    "comprar 3 revisiones",
    "paquete de revisiones"
  ]);

  const pendingDocumentNavigationFlow =
    await d.getFlow(userId);

  if (
    pendingDocumentNavigationFlow?.flow ===
      "document_review_consent" &&
    documentNavigationCommands.has(normalized)
  ) {
    await d.clearFlow(userId);

    console.log(
      "WA_DOCUMENT_FLOW_NAVIGATION_V079",
      JSON.stringify({
        message_id: messageId,
        user_id: userId,
        command: normalized
      })
    );
  }

  const flow = await d.getFlow(userId);

  if (flow?.flow === "document_review_consent") {
    const pending =
      flow?.data &&
      typeof flow.data === "object"
        ? flow.data
        : {};

    if (
      [
        "no acepto documento",
        "no aceptar documento",
        "rechazar documento"
      ].includes(normalized)
    ) {
      await d.clearFlow(userId);

      await d.sendWhatsAppTextParts({
        to: phone,
        phoneNumberId,
        text:
          "Entendido. El documento no será procesado y no se consumirá ninguna revisión."
      });

      return;
    }

    if (
      [
        "acepto documento",
        "aceptar documento",
        "si revisar documento"
      ].includes(normalized)
    ) {
      await procesarDocumentoWhatsApp({
        phone,
        phoneNumberId,
        userId,
        pending
      }, d);

      return;
    }

    await enviarAutorizacionDocumentoWhatsApp({
      phone,
      phoneNumberId,
      fileName:
        pending.fileName ||
        "documento.docx"
    }, d);

    return;
  }

  if (flow?.flow === "accept_terms") {
    if (["no aceptar", "no acepto", "rechazar"].includes(normalized)) {
      await d.clearFlow(userId);
      await d.sendWhatsAppTextParts({
        to: phone,
        phoneNumberId,
        text: "No se generará ningún enlace de pago ni se activará Cartes Plus. Puedes seguir utilizando Cartes y volver a Suscribirme cuando quieras."
      });
      await sendMainMenu({ phone, phoneNumberId, userId }, d);
      return;
    }

    if (["acepto", "aceptar", "si"].includes(normalized)) {
      await d.setFlow(userId, "payment_provider", { phone, phoneNumberId });
      await sendPaymentProviderOptions({ phone, phoneNumberId, accepted: true }, d);
      return;
    }

    await sendLegalAcceptanceOptions({ phone, phoneNumberId, terms, privacy }, d);
    return;
  }

  if (flow?.flow === "payment_provider") {
    if (["1", "mercado pago", "mercadopago"].includes(normalized)) {
      const checkout = await d.createCheckoutForCartes(
        { provider: "mercadopago", userId, phone, phoneNumberId },
        {
          createMercadoPagoCheckout: d.createMercadoPagoCheckout,
          createPayPalCheckout: d.createPayPalCheckout,
          savePaymentContext: d.savePaymentContext
        }
      );
      await d.clearFlow(userId);
      await d.sendWhatsAppTextParts({
        to: phone,
        phoneNumberId,
        text: `*Mercado Pago*\n\nAbre el siguiente enlace seguro para completar tu suscripción:\n${checkout.url}\n\nCuando Mercado Pago confirme el pago, Cartes Plus se activará en tu misma cuenta de Web y WhatsApp.`
      });
      return;
    }

    if (["2", "paypal", "pay pal"].includes(normalized)) {
      const checkout = await d.createCheckoutForCartes(
        { provider: "paypal", userId, phone, phoneNumberId },
        {
          createMercadoPagoCheckout: d.createMercadoPagoCheckout,
          createPayPalCheckout: d.createPayPalCheckout,
          savePaymentContext: d.savePaymentContext
        }
      );
      await d.clearFlow(userId);
      await d.sendWhatsAppTextParts({
        to: phone,
        phoneNumberId,
        text: `*PayPal*\n\nAbre el siguiente enlace seguro para completar tu suscripción:\n${checkout.url}\n\nCuando PayPal confirme el pago, Cartes Plus se activará en tu misma cuenta de Web y WhatsApp.`
      });
      return;
    }

    await sendPaymentProviderOptions({ phone, phoneNumberId }, d);
    return;
  }

  if (flow?.flow === "review_pack_provider") {
    await procesarProveedorPaqueteWhatsApp(
      {
        phone,
        phoneNumberId,
        userId,
        normalized
      },
      d
    );

    return;
  }

  if (flow?.flow === "confirm_cancel") {
    if (normalized === "si") {
      await d.clearFlow(userId);
      await cancelSubscription({ phone, phoneNumberId, userId }, d);
      return;
    }

    if (["no", "no cancelar", "volver"].includes(normalized)) {
      await d.clearFlow(userId);
      await d.sendWhatsAppTextParts({
        to: phone,
        phoneNumberId,
        text: "Entendido. No se realizó ningún cambio y la renovación de Cartes Plus continúa activa."
      });
      return;
    }

    await d.sendWhatsAppTextParts({
      to: phone,
      phoneNumberId,
      text: "Responde *SÍ* para cancelar la renovación o *NO* para mantenerla activa."
    });
    return;
  }

  if (["1", "conversar", "conversar con cartes"].includes(normalized)) {
    await d.sendWhatsAppTextParts({
      to: phone,
      phoneNumberId,
      text: "Escribe tu pregunta sobre historia, simbolismo o filosofía masónica y con gusto te ayudaré."
    });
    return;
  }

  if (["2", "conocer cartes plus", "conoce cartes plus", "cartes plus", "plus"].includes(normalized)) {
    await d.sendWhatsAppTextParts({
      to: phone,
      phoneNumberId,
      text: "Cartes Plus amplía tu conocimiento con más consultas, revisión y retroalimentación de documentos.\n\nPor $149 MXN al mes tendrás hasta 50 consultas y 5 revisiones mensuales de documentos Word de hasta 5 páginas cada uno.\n\nEn cada revisión recibirás observaciones sobre estructura, claridad y contenido para mejorar tu trabajo antes de presentarlo en Logia.\n\nLa suscripción quedará vinculada a tu número de WhatsApp. Desde este mismo chat podrás consultar su estado o cancelarla.\n\nLa versión gratuita está pensada para consultas puntuales. Cartes Plus es para quienes desean estudiar con mayor profundidad y recibir apoyo en la preparación de sus trabajos.\n\nPara comenzar, selecciona “Suscribirme”."
    });
    return;
  }


  if (
    [
      "revisar documento",
      "revisar un documento",
      "revision de documento"
    ].includes(normalized)
  ) {
    const subscriptionDocument =
      await d.obtenerSuscripcionUsuario({ userId });

    const documentPlan = String(
      subscriptionDocument?.plan_actual ||
      await d.obtenerPlanUsuario({ userId })
    ).toLowerCase();

    if (documentPlan !== "plus") {
      await ofrecerCartesPlusPorDocumento(
        { phone, phoneNumberId },
        d
      );
      return;
    }

    await enviarGuiaRevisionDocumentoWhatsApp(
      { phone, phoneNumberId },
      d
    );
    return;
  }

  if (
    [
      "comprar revisiones",
      "comprar 3 revisiones",
      "paquete de revisiones"
    ].includes(normalized)
  ) {
    await iniciarCompraPaqueteWhatsApp(
      {
        phone,
        phoneNumberId,
        userId
      },
      d
    );

    return;
  }

  if (["3", "suscribirme", "suscribirme a cartes plus"].includes(normalized)) {
    const subscription = await d.obtenerSuscripcionUsuario({ userId });

    const effectivePlan = String(
      subscription?.plan_actual ||
      await d.obtenerPlanUsuario({ userId })
    ).toLowerCase();

    if (effectivePlan === "plus") {
      await d.clearFlow(userId);
      await d.sendWhatsAppTextParts({
        to: phone,
        phoneNumberId,
        text: "Tu cuenta ya tiene Cartes Plus vigente. Consulta *Mi suscripción* para revisar su estado y vigencia."
      });
      await sendMainMenu({ phone, phoneNumberId, userId }, d);
      return;
    }

    await d.setFlow(userId, "accept_terms", { phone, phoneNumberId });
    await sendLegalAcceptanceOptions({ phone, phoneNumberId, terms, privacy }, d);
    return;
  }
  if (["4", "mi suscripcion", "estado", "estado suscripcion", "ver mi suscripcion"].includes(normalized)) {
    await showSubscription({ phone, phoneNumberId, userId }, d);
    return;
  }

  if (["5", "ayuda", "help", "ayuda y soporte"].includes(normalized)) {
    await d.sendWhatsAppTextParts({
      to: phone,
      phoneNumberId,
      text: "Para recibir ayuda con Cartes, tu suscripción o un pago, escríbenos a soporte@develandoelcodigomasonico.com y cuéntanos brevemente qué ocurrió."
    });
    return;
  }

  if (["6", "privacidad", "terminos", "privacidad y terminos"].includes(normalized)) {
    await d.sendWhatsAppTextParts({
      to: phone,
      phoneNumberId,
      text: `*Privacidad y términos*\n\nAl utilizar Cartes aceptas sus Términos de uso y el Aviso de privacidad de Develando el Código Masónico. Tus mensajes y los documentos que envíes serán tratados únicamente para prestar el servicio y mejorar tu experiencia. Puedes consultar la información completa en nuestros términos y aviso de privacidad. Para cualquier duda, escríbenos a soporte@develandoelcodigomasonico.com.\n\nAviso de privacidad:\n${privacy}\n\nTérminos:\n${terms}`
    });
    return;
  }

  if (["cancelar", "cancelar renovacion", "cancelar suscripcion", "cancelar cartes plus", "darme de baja", "dar de baja cartes plus"].includes(normalized)) {
    const existing = await d.obtenerSuscripcionUsuario({ userId });

    if (!existing) {
      await d.sendWhatsAppTextParts({
        to: phone,
        phoneNumberId,
        text: "No encontré una suscripción recurrente activa asociada a tu cuenta."
      });
      return;
    }

    const cancelable =
      (existing.provider === "paypal" && existing.subscription_id) ||
      (existing.provider === "mercadopago" && existing.preapproval_id);

    if (!cancelable) {
      await d.sendWhatsAppTextParts({
        to: phone,
        phoneNumberId,
        text: "No encontré una suscripción cancelable de Mercado Pago o PayPal."
      });
      return;
    }

    await d.setFlow(userId, "confirm_cancel", { phone, phoneNumberId });
    await d.sendWhatsAppTextParts({
      to: phone,
      phoneNumberId,
      text: "¿Confirmas que deseas cancelar la renovación de Cartes Plus? Responde *SÍ* o *NO*."
    });
    return;
  }

  const plan = await d.obtenerPlanUsuario({ userId });
  const reservation = await d.reservarConsultaMensual({
    userId,
    plan,
    requestId: messageId,
    channel: "whatsapp"
  });

  if (reservation.duplicada) return;

  if (!reservation.permitida) {
    const limit = reservation.plan === "plus" ? 50 : 5;
    await d.sendWhatsAppTextParts({
      to: phone,
      phoneNumberId,
      text: `Ya utilizaste las ${limit} consultas incluidas en tu plan durante este periodo. Escribe *Mi suscripción* para revisar tu estado.`
    });
    return;
  }

  const coreRequest = new Request("https://cartes.internal/.netlify/functions/guia-masonico", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: text,
      history: [],
      client: {
        channel: "whatsapp",
        external_user_id: phone,
        user_id: userId,
        request_id: messageId
      }
    })
  });

  try {
    const response = await d.guiaMasonico(coreRequest);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !String(data?.answer || "").trim()) {
      throw new Error(data?.error || `Cartes Core HTTP ${response.status}`);
    }

    await d.completarConsultaMensual({
      userId,
      periodo: reservation.periodo,
      requestId: messageId
    });

    await d.sendWhatsAppTextParts({
      to: phone,
      phoneNumberId,
      text: String(data.answer).trim()
    });

    try {
      const usageAfterQuery = await d.obtenerEstadoUsoMensual({
        userId,
        plan
      });

      await d.sendWhatsAppTextParts({
        to: phone,
        phoneNumberId,
        text: `*Consultas disponibles:* ${usageAfterQuery.disponibles} de ${usageAfterQuery.limite}`
      });
    } catch (usageError) {
      console.warn("WA_V2_USAGE_AFTER_QUERY_ERROR", JSON.stringify({
        message_id: messageId,
        user_id: userId,
        error: usageError instanceof Error ? usageError.message : String(usageError)
      }));
    }

    console.log("WA_V2_QUERY_OK", JSON.stringify({
      message_id: messageId,
      user_id: userId,
      plan
    }));
  } catch (error) {
    await d.liberarConsultaMensual({
      userId,
      periodo: reservation.periodo,
      requestId: messageId
    }).catch(() => {});
    throw error;
  }
}


// CARTES_WORD_DOC_V085
async function rechazarArchivoNoCompatibleWhatsApp({
  phone,
  phoneNumberId
}, d) {
  await d.sendWhatsAppTextParts({
    to: phone,
    phoneNumberId,
    text:
      "Este tipo de archivo no es compatible. Cartes admite únicamente documentos Word en formato .doc o .docx para revisión.\n\n" +
      "El archivo no fue revisado y no se consumió ninguna revisión."
  });
}

async function recibirDocumentoWhatsApp({
  phone,
  phoneNumberId,
  messageId,
  userId,
  documentInfo
}, d) {
  const plan =
    await d.obtenerPlanUsuario({
      userId
    });

  if (plan !== "plus") {
    await ofrecerCartesPlusPorDocumento(
      { phone, phoneNumberId },
      d
    );
    return;
  }

  const fileName =
    String(
      documentInfo?.fileName ||
      "documento.docx"
    ).trim();

  const mimeType =
    String(
      documentInfo?.mimeType || ""
    ).trim();

  const isDocx =
    /\.docx$/i.test(fileName);

  const isDoc =
    !isDocx &&
    /\.doc$/i.test(fileName);

  const validMime =
    !mimeType ||
    mimeType ===
      "application/octet-stream" ||
    (
      isDocx &&
      mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) ||
    (
      isDoc &&
      mimeType ===
        "application/msword"
    );

  if (
    (!isDocx && !isDoc) ||
    !validMime
  ) {
    await rechazarArchivoNoCompatibleWhatsApp({
      phone,
      phoneNumberId
    }, d);

    return;
  }


  // WHATSAPP_DOCUMENT_PREVALIDATION_V083
  // Formato y MIME ya fueron comprobados.
  // Aquí solo consultamos metadatos de Meta.
  // El binario todavía NO se descarga.
  const mediaId =
    String(
      documentInfo?.id || ""
    ).trim();

  if (!mediaId) {
    await d.sendWhatsAppTextParts({
      to: phone,
      phoneNumberId,
      text:
        "No pude identificar correctamente el documento enviado. Intenta adjuntarlo nuevamente.\n\n" +
        "El documento no fue revisado y no se consumió ninguna revisión."
    });

    return;
  }

  let mediaMetadata = null;

  try {
    mediaMetadata =
      await d.getWhatsAppMediaMetadata({
        mediaId
      });
  }
  catch (error) {
    // No descargamos el documento antes de autorización.
    // Si Meta no permite consultar metadata en este momento,
    // el flujo puede continuar y downloadWhatsAppMedia
    // conservará la validación dura posterior.
    console.warn(
      "WA_DOCUMENT_METADATA_V083",
      error instanceof Error
        ? error.message
        : String(error)
    );
  }

  const metadataMimeType =
    String(
      mediaMetadata?.mimeType || ""
    ).trim();

  const validMetadataMime =
    !metadataMimeType ||
    metadataMimeType ===
      "application/octet-stream" ||
    (
      isDocx &&
      metadataMimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) ||
    (
      isDoc &&
      metadataMimeType ===
        "application/msword"
    );

  if (!validMetadataMime) {
    await rechazarArchivoNoCompatibleWhatsApp({
      phone,
      phoneNumberId
    }, d);

    return;
  }

  const metadataFileSize =
    Number(
      mediaMetadata?.fileSize
    );

  const MAX_DOCUMENT_BYTES_WHATSAPP =
    4 * 1024 * 1024;

  if (
    Number.isFinite(
      metadataFileSize
    ) &&
    metadataFileSize >
      MAX_DOCUMENT_BYTES_WHATSAPP
  ) {
    await d.sendWhatsAppTextParts({
      to: phone,
      phoneNumberId,
      text:
        "El documento supera el máximo de 4 MB permitido para revisión.\n\n" +
        "El documento no fue revisado y no se consumió ninguna revisión."
    });

    return;
  }

  await d.setFlow(
    userId,
    "document_review_consent",
    {
      mediaId,
      fileName,
      mimeType,
      sourceMessageId: messageId,
      phone,
      phoneNumberId
    }
  );

  await enviarAutorizacionDocumentoWhatsApp({
    phone,
    phoneNumberId,
    fileName
  }, d);
}

async function enviarAutorizacionDocumentoWhatsApp({
  phone,
  phoneNumberId,
  fileName
}, d) {
  const body =
    `Recibí el documento *${fileName}*.\n\n` +
    "Cartes procesará temporalmente el documento para validar que tenga un máximo de 5 páginas y, si cumple, realizar la revisión. El archivo no se conservará después del procesamiento.\n\n" +
    "Cartes Plus incluye hasta 5 revisiones mensuales.\n\n" +
    "¿Autorizas a Cartes a procesar temporalmente este documento?";

  try {
    await d.sendWhatsAppReplyButtons({
      to: phone,
      phoneNumberId,
      body,
      buttons: [
        {
          id: "document_accept",
          title: "Sí, revisar"
        },
        {
          id: "document_reject",
          title: "No revisar"
        },
        {
          id: "menu_main",
          title: "Menú"
        }
      ]
    });

    return;
  }
  catch (error) {
    console.warn(
      "WA_DOCUMENT_CONSENT_FALLBACK",
      error instanceof Error
        ? error.message
        : String(error)
    );
  }

  await d.sendWhatsAppTextParts({
    to: phone,
    phoneNumberId,
    text:
      `${body}\n\nResponde *ACEPTO DOCUMENTO* para continuar o *NO ACEPTO DOCUMENTO* para descartarlo.`
  });
}

async function procesarDocumentoWhatsApp({
  phone,
  phoneNumberId,
  userId,
  pending
}, d) {
  const mediaId =
    String(pending?.mediaId || "").trim();

  const fileName =
    String(
      pending?.fileName ||
      "documento.docx"
    ).trim();

  const sourceMessageId =
    String(
      pending?.sourceMessageId || ""
    ).trim();

  if (
    !mediaId ||
    !sourceMessageId
  ) {
    await d.clearFlow(userId);

    await d.sendWhatsAppTextParts({
      to: phone,
      phoneNumberId,
      text:
        "El documento pendiente ya no está disponible. Envíalo nuevamente para iniciar otra revisión."
    });

    return;
  }

  let media = null;

  try {
    media =
      await d.downloadWhatsAppMedia({
        mediaId
      });

    const result =
      await d.revisarDocumentoCartes({
        userId,
        fileBuffer: media.buffer,
        fileName,
        channel: "whatsapp",
        requestId:
          `wareview_${sourceMessageId}`,
        consentAccepted: true
      });

    await d.clearFlow(userId);

    await d.sendWhatsAppTextParts({
      to: phone,
      phoneNumberId,
      text:
        String(result.review || "").trim()
    });

    await d.sendWhatsAppTextParts({
      to: phone,
      phoneNumberId,
      text:
        `*Revisiones disponibles:* ${result.reviews.disponibles}`
    });

    console.log(
      "WA_DOCUMENT_REVIEW_OK",
      JSON.stringify({
        message_id: sourceMessageId,
        user_id: userId,
        file_name: fileName,
        reviews_available:
          result.reviews.disponibles
      })
    );
  }
  catch (error) {
    // V079:
    // Un intento documental que terminó con error no puede
    // permanecer como consentimiento pendiente.
    try {
      await d.clearFlow(userId);
    }
    catch {
      // El mensaje de error documental sigue enviándose
      // aunque falle la limpieza secundaria del estado.
    }

    const message =
      error instanceof Error
        ? error.message
        : "No fue posible revisar el documento.";

    await d.sendWhatsAppTextParts({
      to: phone,
      phoneNumberId,
      text:
        `${message}\n\nEl documento no fue revisado y no se consumió ninguna revisión.`
    });
  }
  finally {
    if (media?.buffer?.length) {
      media.buffer.fill(0);
    }

    media = null;
  }
}


// WHATSAPP_DOCUMENT_MENU_V077
async function enviarGuiaRevisionDocumentoWhatsApp(
  { phone, phoneNumberId },
  d
) {
  await d.sendWhatsAppTextParts({
    to: phone,
    phoneNumberId,
    text:
      "*Revisar documento*\n\n" +
      "Adjunta ahora tu documento Word (.docx) o Word antiguo (.doc) usando el botón de adjuntar de WhatsApp.\n\n" +
      "Máximo 5 páginas y 4 MB.\n" +
      "Antes de procesarlo, Cartes te pedirá autorización. El archivo no se conservará después de la revisión."
  });
}

async function ofrecerCartesPlusPorDocumento(
  { phone, phoneNumberId },
  d
) {
  const body =
    "*La revisión de documentos está disponible con Cartes Plus.*\n\n" +
    "Con Plus tienes hasta *5 revisiones de documentos por mes* y *50 consultas mensuales*.\n\n" +
    "Contrata Cartes Plus para revisar este documento.";

  try {
    await d.sendWhatsAppReplyButtons({
      to: phone,
      phoneNumberId,
      body,
      footer: "El documento no fue descargado ni procesado.",
      buttons: [
        {
          id: "menu_suscribirme",
          title: "Contratar Plus"
        },
        {
          id: "menu_main",
          title: "Volver al menú"
        }
      ]
    });

    return;
  } catch (error) {
    console.warn(
      "WA_DOCUMENT_PLUS_FALLBACK_V077",
      error instanceof Error
        ? error.message
        : String(error)
    );
  }

  await d.sendWhatsAppTextParts({
    to: phone,
    phoneNumberId,
    text:
      body +
      "\n\nEl documento no fue descargado ni procesado." +
      "\n\nEscribe *Suscribirme* para continuar o *Menú* para volver."
  });
}

async function showSubscription({ phone, phoneNumberId, userId }, d) {
  const subscription =
    await d.obtenerSuscripcionUsuario({ userId });

  const plan = String(
    subscription?.plan_actual ||
    await d.obtenerPlanUsuario({ userId })
  ).toLowerCase();

  const usage =
    await d.obtenerEstadoUsoMensual({ userId, plan });

  const provider =
    subscription?.provider === "paypal"
      ? "PayPal"
      : subscription?.provider === "mercadopago"
        ? "Mercado Pago"
        : "Sin suscripción recurrente";

  const dates = resolveSubscriptionDates(subscription);

  let reviews = null;
  let reviewLine = "";
  let packageLine = "";

  if (
    plan === "plus" &&
    typeof d.obtenerEstadoRevisionesCartes === "function"
  ) {
    try {
      reviews =
        await d.obtenerEstadoRevisionesCartes({ userId });

      reviewLine =
        `\nRevisiones disponibles: ${reviews.disponibles}`;

      packageLine =
        `\nPaquetes adicionales: ${reviews.paquetes_comprados || 0} de ${reviews.paquetes_maximo || 2}`;
    }
    catch (error) {
      console.warn(
        "WA_DOCUMENT_REVIEW_STATUS_ERROR",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  // CARTES_SUBSCRIPTION_BUTTONS_V099
  const subscriptionText =
    `*Mi suscripción*\nPlan: ${plan === "plus" ? "Cartes Plus" : "Cartes gratuito"}\nMedio de pago: ${provider}\nConsultas usadas: ${usage.usadas} de ${usage.limite}\nConsultas disponibles: ${usage.disponibles}${reviewLine}${packageLine}\nFecha de vencimiento: ${dates.expiration}\nRenovación: ${dates.renewal}`;

  if (
    plan !== "plus" ||
    !reviews ||
    !Number.isFinite(Number(reviews.paquetes_maximo))
  ) {
    await d.sendWhatsAppTextParts({
      to: phone,
      phoneNumberId,
      text: subscriptionText
    });
    return;
  }

  const buttons = [];

  if (
    Number(reviews.paquetes_comprados || 0) <
    Number(reviews.paquetes_maximo || 2)
  ) {
    buttons.push({
      id: "review_pack_buy",
      title: "Comprar revisiones"
    });
  }

  const recurring =
    subscription?.provider === "paypal" ||
    subscription?.provider === "mercadopago";

  if (recurring && !subscription?.renovacion_cancelada) {
    buttons.push({
      id: "subscription_cancel",
      title: "Cancelar renovación"
    });
  }

  buttons.push({
    id: "menu_main",
    title: "Menú"
  });

  try {
    await d.sendWhatsAppReplyButtons({
      to: phone,
      phoneNumberId,
      body: subscriptionText,
      buttons: buttons.slice(0, 3)
    });
  }
  catch (error) {
    console.warn(
      "WA_REVIEW_PACK_ACTIONS_V091",
      error instanceof Error ? error.message : String(error)
    );

    const buy =
      Number(reviews.paquetes_comprados || 0) <
      Number(reviews.paquetes_maximo || 2)
        ? "\nEscribe *COMPRAR REVISIONES* para adquirir 3 revisiones adicionales por $99 MXN."
        : "";

    await d.sendWhatsAppTextParts({
      to: phone,
      phoneNumberId,
      text: `${subscriptionText}\n\nPuedes escribir *MENÚ* para volver.${buy}`
    });
  }
}

async function cancelSubscription({ phone, phoneNumberId, userId }, d) {
  const existing = await d.obtenerSuscripcionUsuario({ userId });
  if (!existing) {
    await d.sendWhatsAppTextParts({
      to: phone,
      phoneNumberId,
      text: "No encontré una suscripción recurrente activa asociada a tu cuenta."
    });
    return;
  }

  let updated;
  if (existing.provider === "paypal" && existing.subscription_id) {
    await d.cancelPayPalSubscription(existing.subscription_id);
    const remote = await d.getPayPalSubscription(existing.subscription_id)
      .catch(() => ({ ...existing, status: "CANCELLED" }));
    updated = d.normalizePayPalSubscription(remote, existing);
  } else if (existing.provider === "mercadopago" && existing.preapproval_id) {
    const remote = await d.cancelMercadoPagoSubscription(existing.preapproval_id);
    updated = d.normalizeMercadoPagoSubscription(remote, existing);
  } else {
    await d.sendWhatsAppTextParts({
      to: phone,
      phoneNumberId,
      text: "No encontré una suscripción cancelable de Mercado Pago o PayPal."
    });
    return;
  }

  await d.sincronizarSuscripcionUsuario({
    userId,
    subscription: updated,
    source: `whatsapp-cancel:${updated.provider}`
  });

  await d.sendWhatsAppTextParts({
    to: phone,
    phoneNumberId,
    text: "La renovación de Cartes Plus fue cancelada. Si todavía tienes periodo pagado vigente, conservarás tus beneficios hasta su fecha de término."
  });
}

function resolveSubscriptionDates(subscription) {
  const provider = String(subscription?.provider || "").toLowerCase();
  const recurring = provider === "paypal" || provider === "mercadopago";

  if (!recurring) {
    return { expiration: "No aplica", renewal: "No aplica" };
  }

  const renewalRaw = subscription?.next_payment_date || null;

  const expirationRaw =
    subscription?.access_until ||
    subscription?.fecha_fin ||
    renewalRaw ||
    null;

  return {
    expiration: formatDateForUser(expirationRaw) || "No disponible",
    renewal: subscription?.renovacion_cancelada
      ? "Cancelada"
      : (formatDateForUser(renewalRaw) || "No disponible")
  };
}

function formatDateForUser(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const months = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
  ];

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (iso) {
    const year = iso[1];
    const month = Number(iso[2]);
    const day = iso[3];

    if (month >= 1 && month <= 12) {
      return `${day}-${months[month - 1]}-${year}`;
    }
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;

  const day = String(parsed.getDate()).padStart(2, "0");
  const month = months[parsed.getMonth()];
  const year = parsed.getFullYear();

  return `${day}-${month}-${year}`;
}

function isNonQueryInput(value) {
  const raw = String(value || "").trim();
  if (!raw) return true;

  // Símbolos, puntuación o emojis sin contenido textual/numérico.
  if (!/[\p{L}\p{N}]/u.test(raw)) return true;

  // Mensajes sociales o de prueba que no constituyen una consulta.
  const normalized = normalizeCommand(raw);
  return new Set([
    "hola",
    "buen dia",
    "buenos dias",
    "buenas",
    "buenas tardes",
    "buenas noches",
    "gracias",
    "ok",
    "okay",
    "listo",
    "test",
    "prueba"
  ]).has(normalized);
}

function cleanText(value) {
  return String(value || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, 900);
}

// WHATSAPP_UX_V019
function resolveInteractiveCommand(message, fallbackText) {
  const ids = [];
  collectCommandCandidates(message, ids, 0, new Set());

  const mapping = new Map([
    ["menu_conversar", "1"],
    ["menu_plus", "2"],
    ["menu_suscribirme", "3"],
    ["menu_suscripcion", "4"],
    ["menu_ayuda", "5"],
    ["menu_legal", "6"],
    ["menu_document_review", "revisar documento"],
    ["terms_accept", "acepto"],
    ["terms_reject", "no acepto"],
    ["payment_mp", "mercado pago"],
    ["payment_paypal", "paypal"],
    ["document_accept", "acepto documento"],
    ["document_reject", "no acepto documento"],
    ["review_pack_buy", "comprar revisiones"],
    ["review_pack_mp", "paquete mercado pago"],
    ["review_pack_paypal", "paquete paypal"],
    ["subscription_cancel", "cancelar renovacion"],
    ["menu_main", "menu"]
  ]);

  for (const candidate of ids) {
    const key = String(candidate || "").trim().toLowerCase();
    if (mapping.has(key)) return mapping.get(key);
  }

  return fallbackText;
}

async function sendMainMenu({ phone, phoneNumberId, userId }, d) {
  let effectivePlan = "gratuito";

  try {
    const subscription = userId
      ? await d.obtenerSuscripcionUsuario({ userId })
      : null;

    effectivePlan = String(
      subscription?.plan_actual ||
      (userId ? await d.obtenerPlanUsuario({ userId }) : "gratuito")
    ).toLowerCase();
  } catch (error) {
    console.warn(
      "WA_MENU_PLAN_ERROR",
      error instanceof Error ? error.message : String(error)
    );
  }

  const isPlus = effectivePlan === "plus";

  const rows = [
    {
      id: "menu_conversar",
      title: "Conversar con Cartes",
      description: "Haz una consulta sobre la masonería."
    },
    ...(isPlus
      ? [
          {
            id: "menu_document_review",
            title: "Revisar documento",
            description: "Revisa un archivo Word de hasta 5 páginas."
          }
        ]
      : [
          {
            id: "menu_plus",
            title: "Conoce Cartes Plus",
            description: "Consulta beneficios y condiciones."
          },
          {
            id: "menu_suscribirme",
            title: "Suscribirme",
            description: "Activa Cartes Plus."
          }
        ]),
    {
      id: "menu_suscripcion",
      title: "Mi suscripción",
      description: "Consulta plan, uso y estado."
    },
    {
      id: "menu_ayuda",
      title: "Ayuda y soporte",
      description: "Obtén ayuda con Cartes o pagos."
    },
    {
      id: "menu_legal",
      title: "Privacidad y términos",
      description: "Consulta información legal."
    }
  ];

  try {
    await d.sendWhatsAppInteractiveList({
      to: phone,
      phoneNumberId,
      header: "Menú de Cartes",
      body: "Selecciona una opción o escribe directamente tu consulta sobre la masonería.",
      button: "Ver opciones",
      footer: "Web y WhatsApp comparten la misma cuenta Cartes.",
      sections: [{
        title: "Menú principal",
        rows
      }]
    });
    return;
  } catch (error) {
    console.warn(
      "WA_INTERACTIVE_MENU_FALLBACK_V019",
      error instanceof Error ? error.message : String(error)
    );
  }

  const fallbackMenu = isPlus
    ? `*Menú de Cartes*\n\nElige una opción o escribe directamente tu consulta sobre la masonería:\n\n• Conversar con Cartes\n• Revisar documento\n• Mi suscripción\n• Ayuda y soporte\n• Privacidad y términos`
    : MENU;

  await d.sendWhatsAppTextParts({
    to: phone,
    phoneNumberId,
    text: fallbackMenu
  });
}
async function sendLegalAcceptanceOptions({ phone, phoneNumberId, terms, privacy }, d) {
  const body =
    `Antes de continuar, revisa y acepta los Términos de uso y el Aviso de privacidad de Cartes.\n\nTérminos:\n${terms}\n\nAviso de privacidad:\n${privacy}`;

  try {
    await d.sendWhatsAppReplyButtons({
      to: phone,
      phoneNumberId,
      body,
      footer: "Puedes cancelar y volver al menú en cualquier momento.",
      buttons: [
        { id: "terms_accept", title: "Sí, acepto" },
        { id: "terms_reject", title: "No acepto" },
        { id: "menu_main", title: "Volver al menú" }
      ]
    });
    return;
  } catch (error) {
    console.warn("WA_INTERACTIVE_TERMS_FALLBACK_V019", error instanceof Error ? error.message : String(error));
  }

  await d.sendWhatsAppTextParts({
    to: phone,
    phoneNumberId,
    text: `${body}\n\nResponde *ACEPTO* para continuar o *VOLVER AL MENÚ* para volver.`
  });
}

// CARTES_REVIEW_PACKS_WA_V091
async function iniciarCompraPaqueteWhatsApp({
  phone,
  phoneNumberId,
  userId
}, d) {
  const subscription =
    await d.obtenerSuscripcionUsuario({ userId });

  const plan = String(
    subscription?.plan_actual ||
    await d.obtenerPlanUsuario({ userId })
  ).toLowerCase();

  if (plan !== "plus") {
    await d.sendWhatsAppTextParts({
      to: phone,
      phoneNumberId,
      text:
        "Los paquetes adicionales están disponibles únicamente para Cartes Plus vigente."
    });
    return;
  }

  const reviews =
    await d.obtenerEstadoRevisionesCartes({ userId });

  if (
    Number(reviews.paquetes_comprados || 0) >=
    Number(reviews.paquetes_maximo || 2)
  ) {
    await d.sendWhatsAppTextParts({
      to: phone,
      phoneNumberId,
      text:
        "Ya compraste los 2 paquetes adicionales permitidos durante este periodo de Cartes Plus."
    });
    return;
  }

  const expiresAt =
    d.resolverVencimientoPaqueteRevision(subscription);

  if (!expiresAt) {
    await d.sendWhatsAppTextParts({
      to: phone,
      phoneNumberId,
      text:
        "No pude determinar la fecha de vencimiento de tu periodo Plus. No se generó ningún enlace de pago."
    });
    return;
  }

  await d.setFlow(
    userId,
    "review_pack_provider",
    {
      phone,
      phoneNumberId,
      expires_at: expiresAt
    }
  );

  await sendReviewPackProviderOptions(
    {
      phone,
      phoneNumberId,
      expiresAt
    },
    d
  );
}

async function procesarProveedorPaqueteWhatsApp({
  phone,
  phoneNumberId,
  userId,
  normalized
}, d) {
  const provider =
    ["paquete mercado pago", "mercado pago", "mercadopago", "1"].includes(normalized)
      ? "mercadopago"
      : ["paquete paypal", "paypal", "pay pal", "2"].includes(normalized)
        ? "paypal"
        : "";

  if (!provider) {
    const flow = await d.getFlow(userId);

    await sendReviewPackProviderOptions(
      {
        phone,
        phoneNumberId,
        expiresAt: flow?.data?.expires_at || ""
      },
      d
    );

    return;
  }

  const subscription =
    await d.obtenerSuscripcionUsuario({ userId });

  const plan = String(
    subscription?.plan_actual ||
    await d.obtenerPlanUsuario({ userId })
  ).toLowerCase();

  if (plan !== "plus") {
    await d.clearFlow(userId);

    await d.sendWhatsAppTextParts({
      to: phone,
      phoneNumberId,
      text:
        "Tu periodo Cartes Plus ya no está vigente. No se generó ningún enlace de pago."
    });

    return;
  }

  const reviews =
    await d.obtenerEstadoRevisionesCartes({ userId });

  if (
    Number(reviews.paquetes_comprados || 0) >=
    Number(reviews.paquetes_maximo || 2)
  ) {
    await d.clearFlow(userId);

    await d.sendWhatsAppTextParts({
      to: phone,
      phoneNumberId,
      text:
        "Ya compraste los 2 paquetes adicionales permitidos durante este periodo de Cartes Plus."
    });

    return;
  }

  const expiresAt =
    d.resolverVencimientoPaqueteRevision(subscription);

  if (!expiresAt) {
    await d.clearFlow(userId);

    await d.sendWhatsAppTextParts({
      to: phone,
      phoneNumberId,
      text:
        "No pude determinar la vigencia del paquete. No se generó ningún enlace de pago."
    });

    return;
  }

  const checkout =
    await d.createReviewPackCheckout({
      provider,
      userId,
      phone,
      phoneNumberId,
      expiresAt
    });

  await d.clearFlow(userId);

  const providerLabel =
    provider === "paypal"
      ? "PayPal"
      : "Mercado Pago";

  await d.sendWhatsAppTextParts({
    to: phone,
    phoneNumberId,
    text:
      `*${providerLabel}*\n\nEl paquete cuesta $99 MXN e incluye 3 revisiones adicionales. Es un pago único, no recurrente.\n\nCompleta el pago aquí:\n${checkout.url}\n\nCuando el proveedor confirme la compra, las revisiones se agregarán a tu misma cuenta de Web y WhatsApp.`
  });
}

async function sendReviewPackProviderOptions({
  phone,
  phoneNumberId,
  expiresAt
}, d) {
  const expiration =
    formatDateForUser(expiresAt) ||
    "el final de tu periodo Plus vigente";

  const body =
    `*3 revisiones adicionales por $99 MXN*\n\nPago único, no recurrente.\nLas revisiones vencerán el ${expiration}.\n\nSelecciona el medio de pago.`;

  try {
    await d.sendWhatsAppReplyButtons({
      to: phone,
      phoneNumberId,
      body,
      buttons: [
        { id: "review_pack_mp", title: "Mercado Pago" },
        { id: "review_pack_paypal", title: "PayPal" },
        { id: "menu_main", title: "Menú" }
      ]
    });

    return;
  }
  catch (error) {
    console.warn(
      "WA_REVIEW_PACK_PROVIDER_V091",
      error instanceof Error ? error.message : String(error)
    );
  }

  await d.sendWhatsAppTextParts({
    to: phone,
    phoneNumberId,
    text:
      `${body}\n\n1. Mercado Pago\n2. PayPal\n\nResponde *1* o *2*.`
  });
}

async function sendPaymentProviderOptions({ phone, phoneNumberId, accepted = false }, d) {
  const body = accepted
    ? "Gracias. Tu aceptación quedó registrada.\n\nSelecciona el medio de pago que te resulte más conveniente."
    : "Selecciona Mercado Pago o PayPal para continuar.";

  try {
    await d.sendWhatsAppReplyButtons({
      to: phone,
      phoneNumberId,
      body,
      buttons: [
        { id: "payment_mp", title: "Mercado Pago" },
        { id: "payment_paypal", title: "PayPal" },
        { id: "menu_main", title: "Menú" }
      ]
    });
    return;
  } catch (error) {
    console.warn("WA_INTERACTIVE_PAYMENT_FALLBACK_V019", error instanceof Error ? error.message : String(error));
  }

  await d.sendWhatsAppTextParts({
    to: phone,
    phoneNumberId,
    text: `${body}\n\n1. Mercado Pago\n2. PayPal\n\nResponde *1* o *2*.`
  });
}

// WA_GLOBAL_MENU_V018
function detectGlobalMenuCommand(message, extractedText) {
  const candidates = [];
  collectCommandCandidates(extractedText, candidates, 0, new Set());
  collectCommandCandidates(message, candidates, 0, new Set());

  const unique = [...new Set(
    candidates
      .map((value) => String(value || "").trim())
      .filter((value) => value && value.length <= 200)
  )];

  const match = unique.find((value) =>
    ["menu", "inicio", "opciones", "volver al menu"].includes(normalizeCommand(value))
  );

  return match
    ? { matched: true, candidateCount: unique.length }
    : null;
}

function collectCommandCandidates(value, output, depth, seen) {
  if (depth > 4 || value == null) return;

  if (typeof value === "string" || typeof value === "number") {
    output.push(String(value));
    return;
  }

  if (typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value.slice(0, 20)) {
      collectCommandCandidates(item, output, depth + 1, seen);
    }
    return;
  }

  const preferred = new Set([
    "text", "body", "title", "id", "payload", "value", "command",
    "button_reply", "list_reply", "interactive", "button"
  ]);

  for (const [key, child] of Object.entries(value)) {
    if (preferred.has(String(key).toLowerCase())) {
      collectCommandCandidates(child, output, depth + 1, seen);
    }
  }
}

function normalizeCommand(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[*_~`]/g, " ")
    .replace(/[¿?¡!.,;:()[\]{}"'“”‘’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function maskPhone(value) {
  return String(value || "").replace(/\d(?=\d{4})/g, "*");
}
