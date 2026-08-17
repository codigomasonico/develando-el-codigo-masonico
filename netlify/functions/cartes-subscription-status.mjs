import {
  obtenerEstadoUsoMensual,
  obtenerPlanUsuario,
  obtenerSuscripcionUsuario,
  resolverOCrearUsuarioPorIdentidad
} from "../../core/ai/lib-cartes-account.mjs";

import {
  obtenerEstadoRevisionesCartes
} from "../../core/ai/cartes-document-review.mjs";

export default async (request) => {
  if (request.method !== "POST") {
    return new Response("Método no permitido", { status: 405 });
  }

  let body;

  try {
    body = await request.json();
  }
  catch {
    return Response.json({ error: "JSON inválido." }, { status: 400 });
  }

  const webIdentity = String(body?.web_identity || "").trim();

  if (!webIdentity) {
    return Response.json({ error: "Falta web_identity." }, { status: 400 });
  }

  try {
    const identity =
      await resolverOCrearUsuarioPorIdentidad({
        tipo: "web",
        valor: webIdentity
      });

    const userId = identity.user_id;
    const storedPlan = await obtenerPlanUsuario({ userId });
    const subscription = await obtenerSuscripcionUsuario({ userId });

    // CARTES_PAYPAL_PENDING_STATUS_V112
    const visibleSubscription =
      subscription &&
      String(subscription.status || "").toLowerCase() !== "pending"
        ? subscription
        : null;

    const plan = String(
      visibleSubscription?.plan_actual ||
      storedPlan ||
      "gratuito"
    ).toLowerCase();

    const usage =
      await obtenerEstadoUsoMensual({
        userId,
        plan
      });

    const reviews =
      await obtenerEstadoRevisionesCartes({
        userId
      });

    const publicSubscription =
      visibleSubscription
        ? {
            provider: String(visibleSubscription.provider || ""),
            status: String(visibleSubscription.status || ""),
            renovacion_cancelada:
              Boolean(visibleSubscription.renovacion_cancelada),
            access_until: visibleSubscription.access_until || null,
            next_payment_date: visibleSubscription.next_payment_date || null
          }
        : null;

    return Response.json({
      plan,
      usage,
      reviews,
      subscription: publicSubscription
    });
  }
  catch (error) {
    console.error(
      "CARTES_WEB_SUBSCRIPTION_STATUS_ERROR",
      error instanceof Error ? error.message : String(error)
    );

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No fue posible consultar la suscripción."
      },
      { status: 500 }
    );
  }
};