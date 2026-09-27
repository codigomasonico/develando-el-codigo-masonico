import { connectLambda } from "@netlify/blobs";
import {
  isAuthorized,
  isLocalHost,
  unauthorized
} from "../lib/cartes-admin-auth.js";
import {
  buildCartesAdminStats,
  emptyCartesAdminStats
} from "../lib/cartes-admin-stats.js";

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(payload)
  };
}

function errorCode(error) {
  const name = String(error?.name || "").trim();
  if (name) return name.slice(0, 80);
  return "cartes_admin_stats_error";
}

export async function handler(event) {
  connectLambda(event);

  if (event.httpMethod !== "GET") {
    return jsonResponse(405, { ok: false, message: "Método no permitido." });
  }

  if (!isAuthorized(event)) {
    return unauthorized();
  }

  const local = isLocalHost(event);

  try {
    const stats = await buildCartesAdminStats();

    if (local) {
      stats.notes.unshift(
        "Entorno local: Netlify Dev usa un almacén Blobs aislado y no accede a los datos de producción. Para ver cifras reales, usa un Deploy Preview o producción."
      );
    }

    return jsonResponse(200, {
      ok: true,
      stats,
      runtime: {
        local,
        data_scope: local ? "netlify-dev-sandbox" : "site-wide-cartes-core"
      }
    });
  } catch (error) {
    console.error("[cartes-admin-stats]", error);

    // En local, una limitación del sandbox de Netlify Blobs no debe romper
    // la UI. Mostramos el panel con 0 y una explicación explícita.
    if (local) {
      const stats = emptyCartesAdminStats();
      stats.notes.push(
        "Entorno local: Netlify Dev no pudo abrir el almacén local de Blobs. Esto no prueba ni invalida los datos de producción."
      );
      stats.notes.push(
        "Las cifras reales de cartes-core sólo se validan en un Deploy Preview o en producción."
      );

      return jsonResponse(200, {
        ok: true,
        stats,
        runtime: {
          local: true,
          data_scope: "netlify-dev-unavailable",
          warning: errorCode(error)
        }
      });
    }

    return jsonResponse(500, {
      ok: false,
      message: "No se pudieron calcular las estadísticas de Cartes.",
      code: errorCode(error)
    });
  }
}
