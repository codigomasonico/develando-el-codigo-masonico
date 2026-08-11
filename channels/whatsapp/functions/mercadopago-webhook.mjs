import { TEXTOS_CARTES, completarTextoCartes } from "./lib-textos-cartes.mjs";
import {
  buscarSuscripcion,
  buscarVinculoPlan,
  enviarMensajeWhatsApp,
  extraerTelefonoReferencia,
  extraerUserIdReferencia,
  guardarPagoAutorizado,
  guardarSuscripcion,
  liberarNotificacionSuscripcion,
  reclamarNotificacionSuscripcion
} from "./lib-cartes.mjs";
import {
  detectarEntornoWebhook,
  normalizarEstadoSuscripcion,
  obtenerPagoAutorizadoMercadoPago,
  obtenerPagoMercadoPago,
  obtenerSuscripcionMercadoPago
} from "./lib-mercadopago.mjs";
import { extraerReferenciaPaquete, registrarPaquetePagado } from "./lib-paquetes-revisiones.mjs";
import { obtenerEstadoRevisiones } from "./lib-revisiones-cartes.mjs";
import { cuentaCentralConfigurada, resolverUsuarioCentral, sincronizarSuscripcionCentral } from "./lib-cartes-account-client.mjs";

export default async (request) => {
  if (request.method !== "POST") {
    return new Response("Método no permitido", { status: 405 });
  }

  const url = new URL(request.url);
  const rawBody = await request.text();
  let payload = {};

  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return Response.json(
      { recibido: false, error: "JSON inválido" },
      { status: 400 }
    );
  }

  const dataIdUrl = String(
    url.searchParams.get("data.id") ||
      url.searchParams.get("data_id") ||
      ""
  );
  const dataId = String(dataIdUrl || payload?.data?.id || "");
  const xSignature = request.headers.get("x-signature") || "";
  const xRequestId = request.headers.get("x-request-id") || "";

  const config = detectarEntornoWebhook({
    xSignature,
    xRequestId,
    dataId: dataIdUrl
  });

  if (!config) {
    console.warn("Webhook de Mercado Pago rechazado por firma inválida.", {
      tipo: payload?.type || payload?.topic || null,
      dataId: dataId || null
    });

    return Response.json(
      { recibido: false, error: "Firma inválida" },
      { status: 401 }
    );
  }

  const tipo = String(payload?.type || payload?.topic || "");

  if (dataId === "123456") {
    return Response.json({
      recibido: true,
      simulacion: true,
      entorno: config.entorno,
      tipo,
      data_id: dataId
    });
  }

  if (!dataId) {
    return Response.json({
      recibido: true,
      ignorado: true,
      motivo: "Notificación sin data.id"
    });
  }

  try {
    if (tipo === "subscription_preapproval") {
      const resultado = await procesarSuscripcion({
        preapprovalId: dataId,
        entorno: config.entorno
      });

      return Response.json({ recibido: true, ...resultado });
    }

    if (tipo === "subscription_authorized_payment") {
      const resultado = await procesarPagoAutorizado({
        authorizedPaymentId: dataId,
        entorno: config.entorno
      });

      return Response.json({ recibido: true, ...resultado });
    }

    if (tipo === "payment") {
      const resultado = await procesarPagoPaquete({ paymentId: dataId, entorno: config.entorno });
      return Response.json({ recibido: true, ...resultado });
    }

    if (tipo === "subscription_preapproval_plan") {
      return Response.json({
        recibido: true,
        ignorado: true,
        entorno: config.entorno,
        tipo,
        motivo: "Notificación informativa de plan"
      });
    }

    return Response.json({
      recibido: true,
      ignorado: true,
      entorno: config.entorno,
      tipo
    });
  } catch (error) {
    console.error("Error procesando webhook de Mercado Pago.", {
      entorno: config.entorno,
      tipo,
      dataId,
      error: error instanceof Error ? error.message : String(error)
    });

    return Response.json(
      {
        recibido: false,
        entorno: config.entorno,
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
};

async function procesarSuscripcion({ preapprovalId, entorno }) {
  const preapproval = await obtenerSuscripcionMercadoPago(
    preapprovalId,
    entorno
  );
  const existente = await buscarSuscripcion({ entorno, preapprovalId });
  const planId = String(preapproval?.preapproval_plan_id || "");
  const vinculoPlan = await buscarVinculoPlan({ entorno, planId });
  const referencia = String(
    preapproval?.external_reference ||
      vinculoPlan?.external_reference ||
      existente?.external_reference ||
      ""
  );
  const telefono =
    vinculoPlan?.telefono ||
    existente?.telefono ||
    extraerTelefonoReferencia(referencia);
  let userId =
    vinculoPlan?.user_id ||
    existente?.user_id ||
    extraerUserIdReferencia(referencia) ||
    null;

  if (!userId && telefono && cuentaCentralConfigurada()) {
    try {
      const identidad = await resolverUsuarioCentral({ identityType: "whatsapp", identityValue: telefono });
      userId = identidad?.user_id || null;
    } catch (error) {
      console.warn("No se pudo resolver el user_id central de la suscripción.", {
        entorno, preapprovalId, error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  const estadoAnterior = String(existente?.status || "");
  const estadoNotificado = String(existente?.notified_status || "");
  const estadoActual = normalizarEstadoSuscripcion(
    preapproval?.status || "unknown"
  );
  const ahora = new Date().toISOString();

  const registro = {
    ...(existente || {}),
    version: 4,
    entorno,
    telefono: telefono || null,
    user_id: userId || null,
    email: preapproval?.payer_email || existente?.email || null,
    payer_id: preapproval?.payer_id || existente?.payer_id || null,
    plan: "cartes_plus",
    precio: Number(preapproval?.auto_recurring?.transaction_amount || 149),
    moneda: preapproval?.auto_recurring?.currency_id || "MXN",
    status: estadoActual,
    notified_status: estadoNotificado || null,
    preapproval_id: String(preapprovalId),
    preapproval_plan_id: planId || null,
    application_id: String(preapproval?.application_id || ""),
    collector_id: String(preapproval?.collector_id || ""),
    external_reference: referencia || null,
    payment_method_id: preapproval?.payment_method_id || null,
    next_payment_date: preapproval?.next_payment_date || null,
    created_at: existente?.created_at || preapproval?.date_created || ahora,
    updated_at: ahora
  };

  let notificacionReclamada = false;
  let notificacionDuplicada = false;

  if (telefono && estadoActual !== estadoNotificado) {
    const mensaje = mensajePorEstado(estadoActual, entorno);

    if (mensaje) {
      notificacionReclamada = await reclamarNotificacionSuscripcion({
        entorno,
        preapprovalId,
        status: estadoActual
      });

      if (notificacionReclamada) {
        try {
          await enviarMensajeWhatsApp(telefono, mensaje);
          registro.notified_status = estadoActual;
          registro.notified_at = new Date().toISOString();
        } catch (error) {
          try {
            await liberarNotificacionSuscripcion({
              entorno,
              preapprovalId,
              status: estadoActual
            });
          } catch (liberacionError) {
            console.error(
              "No se pudo liberar la marca de notificación tras fallar WhatsApp.",
              {
                entorno,
                preapprovalId,
                status: estadoActual,
                error:
                  liberacionError instanceof Error
                    ? liberacionError.message
                    : String(liberacionError)
              }
            );
          }

          throw error;
        }
      } else {
        notificacionDuplicada = true;
        const actualizado = await buscarSuscripcion({
          entorno,
          preapprovalId
        });

        if (String(actualizado?.notified_status || "") === estadoActual) {
          registro.notified_status = estadoActual;
          registro.notified_at = actualizado.notified_at || registro.notified_at;
        }
      }
    }
  }

  await guardarSuscripcion({ entorno, registro });

  if (userId && cuentaCentralConfigurada()) {
    try {
      await sincronizarSuscripcionCentral({
        userId,
        subscription: registro,
        source: `mercadopago:${entorno}`
      });
    } catch (error) {
      console.error("La suscripción se guardó localmente, pero no pudo sincronizarse con Cartes Account.", {
        entorno, preapprovalId, userId, error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  if (!telefono) {
    console.warn("Suscripción recibida sin vínculo de teléfono.", {
      entorno,
      preapprovalId,
      planId,
      referencia
    });
  }

  return {
    entorno,
    tipo: "subscription_preapproval",
    status: estadoActual,
    cambio_estado: estadoActual !== estadoAnterior,
    notificado: registro.notified_status === estadoActual,
    notificacion_duplicada: notificacionDuplicada,
    vinculado: Boolean(telefono)
  };
}

async function procesarPagoPaquete({ paymentId, entorno }) {
  const pago = await obtenerPagoMercadoPago(paymentId, entorno);
  const referencia = extraerReferenciaPaquete(pago?.external_reference);
  if (!referencia) {
    return { entorno, tipo: "payment", ignorado: true, motivo: "Pago ajeno a paquetes de revisiones" };
  }
  const status = String(pago?.status || "unknown").toLowerCase();
  if (status === "approved") {
    const acreditacion = await registrarPaquetePagado({ telefono: referencia.telefono, paymentId: String(paymentId), fechaFin: referencia.fecha_fin });
    if (acreditacion.limite_alcanzado) {
      await enviarMensajeWhatsApp(referencia.telefono, TEXTOS_CARTES.LIMITE_PAQUETES);
      return { entorno, tipo: "payment", status, limite_alcanzado: true };
    }
    if (!acreditacion.duplicado) {
      const saldo = await obtenerEstadoRevisiones({ telefono: referencia.telefono });
      const fechaFin = new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", year: "numeric", month: "long", day: "numeric" }).format(new Date(referencia.fecha_fin));
      await enviarMensajeWhatsApp(referencia.telefono, completarTextoCartes(TEXTOS_CARTES.PAQUETE_ACTIVO, { fecha_fin: fechaFin, revisiones_disponibles: saldo.disponibles }));
    }
    return { entorno, tipo: "payment", status, acreditado: true, duplicado: Boolean(acreditacion.duplicado) };
  }
  if (status === "pending" || status === "in_process") {
    await enviarMensajeWhatsApp(referencia.telefono, TEXTOS_CARTES.PAGO_PAQUETE_PENDIENTE);
  } else if (status === "rejected") {
    await enviarMensajeWhatsApp(referencia.telefono, TEXTOS_CARTES.PAGO_PAQUETE_RECHAZADO);
  } else if (["cancelled", "cancelled_by_user", "refunded"].includes(status)) {
    await enviarMensajeWhatsApp(referencia.telefono, TEXTOS_CARTES.PAGO_PAQUETE_NO_COMPLETADO);
  }
  return { entorno, tipo: "payment", status, acreditado: false };
}

async function procesarPagoAutorizado({ authorizedPaymentId, entorno }) {
  const pago = await obtenerPagoAutorizadoMercadoPago(
    authorizedPaymentId,
    entorno
  );
  const ahora = new Date().toISOString();
  const registro = {
    version: 3,
    entorno,
    authorized_payment_id: String(authorizedPaymentId),
    preapproval_id: String(pago?.preapproval_id || ""),
    status: String(pago?.status || "unknown"),
    payment_id: pago?.payment?.id || null,
    payment_status: pago?.payment?.status || null,
    payment_status_detail: pago?.payment?.status_detail || null,
    transaction_amount: pago?.transaction_amount || null,
    currency_id: pago?.currency_id || "MXN",
    debit_date: pago?.debit_date || null,
    created_at: pago?.date_created || ahora,
    updated_at: ahora
  };

  await guardarPagoAutorizado({ entorno, registro });

  if (registro.preapproval_id) {
    await procesarSuscripcion({
      preapprovalId: registro.preapproval_id,
      entorno
    });
  }

  return {
    entorno,
    tipo: "subscription_authorized_payment",
    status: registro.status,
    payment_status: registro.payment_status
  };
}

function mensajePorEstado(status, entorno) {
  const prefijo = entorno === "test" ? "PRUEBA COMPLETADA — " : "";

  switch (status) {
    case "authorized":
      return `${prefijo}${TEXTOS_CARTES.ACTIVACION_PLUS}`;
    case "paused":
      return `${prefijo}${TEXTOS_CARTES.SUSCRIPCION_PAUSADA_MP}`;
    case "cancelled":
      return `${prefijo}${TEXTOS_CARTES.SUSCRIPCION_CANCELADA_MP}`;
    default:
      return "";
  }
}
