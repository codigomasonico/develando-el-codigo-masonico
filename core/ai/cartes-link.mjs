import {
  actualizarIdiomaUsuario,
  desvincularWhatsAppUsuario,
  iniciarCambioNumeroWhatsApp,
  iniciarVinculacionWeb,
  obtenerEstadoVinculacionWeb,
  obtenerIdiomaUsuario,
  obtenerEstadoUsoMensual,
  resolverOCrearUsuarioPorIdentidad,
  resolverUsuarioExistentePorIdentidad
} from "./lib-cartes-account.mjs";
import { coreText, normalizeLocale } from "./i18n.mjs";

export default async (request) => {
  let locale = normalizeLocale(
    request.headers.get("x-cartes-locale") ||
    request.headers.get("accept-language") ||
    "es"
  );

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
      { error: coreText(locale, "method_not_allowed") },
      405
    );
  }

  let body;

  try {
    body = await request.json();
  }
  catch {
    return json(
      { error: coreText(locale, "invalid_json") },
      400
    );
  }

  const action =
    String(body?.action || "")
      .trim()
      .toLowerCase();

  locale = normalizeLocale(body?.locale, locale);

  const webIdentity =
    String(body?.web_identity || "")
      .trim();

  if (!/^web_[a-zA-Z0-9_-]{8,}$/.test(webIdentity)) {
    return json(
      { error: locale === "en" ? "Invalid Web identity." : "Identidad Web inválida." },
      400
    );
  }

  try {
    if (action === "locale_get" || action === "locale_set") {
      const identity = await resolverOCrearUsuarioPorIdentidad({
        tipo: "web",
        valor: webIdentity
      });

      if (action === "locale_set") {
        await actualizarIdiomaUsuario({
          userId: identity.user_id,
          locale: body?.locale
        });
      }

      return json({
        ok: true,
        locale: await obtenerIdiomaUsuario({ userId: identity.user_id })
      });
    }

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

      const locale =
        await obtenerIdiomaUsuario({
          userId: identity.user_id
        });

      return json({
        ...link,
        locale,
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
              locale === "en"
                ? "No Cartes account was found for this Web session."
                : "No se encontró una cuenta Cartes asociada a esta sesión Web."
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
              locale === "en"
                ? "No Cartes account was found for this Web session."
                : "No se encontró una cuenta Cartes asociada a esta sesión Web."
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
      { error: locale === "en" ? "Unsupported action." : "Acción no soportada." },
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
        { error: translateLinkError(message, locale) },
        409
      );
    }

    console.error(
      "Cartes link error",
      error
    );

    return json(
      {
        error: locale === "en"
          ? "Linking could not be managed at this time."
          : "No se pudo gestionar la vinculación en este momento."
      },
      500
    );
  }
};

function translateLinkError(message, locale) {
  if (normalizeLocale(locale) !== "en") return message;

  return String(message)
    .replace("La cuenta no tiene un número de WhatsApp activo para cambiar.", "The account does not have an active WhatsApp number to change.")
    .replace("La cuenta tiene más de un número de WhatsApp activo y requiere revisión.", "The account has more than one active WhatsApp number and requires review.")
    .replace("No puedes eliminar la única identidad de acceso de la cuenta.", "You cannot remove the account's only access identity.");
}

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
      "Content-Type, X-Cartes-Locale",
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
