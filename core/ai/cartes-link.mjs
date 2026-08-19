import {
  desvincularWhatsAppUsuario,
  iniciarCambioNumeroWhatsApp,
  iniciarVinculacionWeb,
  obtenerEstadoVinculacionWeb,
  obtenerEstadoUsoMensual,
  resolverOCrearUsuarioPorIdentidad,
  resolverUsuarioExistentePorIdentidad
} from "./lib-cartes-account.mjs";

export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(
      null,
      {
        status: 204,
        headers: headers()
      }
    );
  }

  if (request.method !== "POST") {
    return json(
      { error: "Método no permitido." },
      405
    );
  }

  let body;

  try {
    body = await request.json();
  }
  catch {
    return json(
      { error: "JSON inválido." },
      400
    );
  }

  const action =
    String(body?.action || "")
      .trim()
      .toLowerCase();

  const webIdentity =
    String(body?.web_identity || "")
      .trim();

  if (!/^web_[a-zA-Z0-9_-]{8,}$/.test(webIdentity)) {
    return json(
      { error: "Identidad Web inválida." },
      400
    );
  }

  try {
    if (action === "start") {
      return json(
        await iniciarVinculacionWeb({
          webIdentity
        })
      );
    }

    if (action === "status") {
      const [link, identity] =
        await Promise.all([
          obtenerEstadoVinculacionWeb({
            webIdentity
          }),
          resolverOCrearUsuarioPorIdentidad({
            tipo: "web",
            valor: webIdentity
          })
        ]);

      const usage =
        await obtenerEstadoUsoMensual({
          userId: identity.user_id
        });

      return json({
        ...link,
        usage: publicUsage(usage)
      });
    }

    // CARTES_CHANGE_NUMBER_CHANNEL_V115
    if (action === "start_change_whatsapp") {
      const identity =
        await resolverUsuarioExistentePorIdentidad({
          tipo: "web",
          valor: webIdentity
        });

      if (!identity?.user_id) {
        return json(
          {
            error:
              "No se encontró una cuenta Cartes asociada a esta sesión Web."
          },
          404
        );
      }

      const change =
        await iniciarCambioNumeroWhatsApp({
          userId: identity.user_id
        });

      const usage =
        await obtenerEstadoUsoMensual({
          userId: identity.user_id
        });

      return json({
        ...change,
        usage: publicUsage(usage)
      });
    }

    // CARTES_UNLINK_CHANNEL_V115
    if (action === "unlink_whatsapp") {
      const identity =
        await resolverUsuarioExistentePorIdentidad({
          tipo: "web",
          valor: webIdentity
        });

      if (!identity?.user_id) {
        return json(
          {
            error:
              "No se encontró una cuenta Cartes asociada a esta sesión Web."
          },
          404
        );
      }

      const result =
        await desvincularWhatsAppUsuario({
          userId: identity.user_id
        });

      const usage =
        await obtenerEstadoUsoMensual({
          userId: identity.user_id
        });

      return json({
        ok: true,
        linked: false,
        unlinked: Boolean(result?.unlinked),
        already_unlinked:
          Boolean(result?.already_unlinked),
        usage: publicUsage(usage)
      });
    }

    return json(
      { error: "Acción no soportada." },
      400
    );
  }
  catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo gestionar la vinculación en este momento.";

    if (
      /única identidad de acceso/i.test(message) ||
      /más de una identidad WhatsApp/i.test(message) ||
      /no tiene un número de WhatsApp activo/i.test(message)
    ) {
      return json(
        { error: message },
        409
      );
    }

    console.error(
      "Cartes link error",
      error
    );

    return json(
      {
        error:
          "No se pudo gestionar la vinculación en este momento."
      },
      500
    );
  }
};

function publicUsage(usage) {
  return {
    plan: usage.plan,
    limite: usage.limite,
    usadas: usage.usadas,
    disponibles: usage.disponibles,
    periodo: usage.periodo
  };
}

function headers() {
  return {
    "Content-Type":
      "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "Content-Type",
    "Access-Control-Allow-Methods":
      "POST, OPTIONS",
    "Cache-Control": "no-store"
  };
}

function json(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: headers()
    }
  );
}