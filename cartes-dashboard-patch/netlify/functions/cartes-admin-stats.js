import { connectLambda } from "@netlify/blobs";
import { isAuthorized, unauthorized } from "../lib/cartes-admin-auth.js";
import { buildCartesAdminStats } from "../lib/cartes-admin-stats.js";

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

export async function handler(event) {
  connectLambda(event);
  if (!isAuthorized(event)) return unauthorized();
  if (event.httpMethod !== "GET") return jsonResponse(405, { ok: false, message: "Método no permitido." });

  try {
    const stats = await buildCartesAdminStats();
    return jsonResponse(200, { ok: true, stats });
  } catch (error) {
    console.error("[cartes-admin-stats]", error);
    return jsonResponse(500, { ok: false, message: "No se pudieron calcular las estadísticas de Cartes." });
  }
}
