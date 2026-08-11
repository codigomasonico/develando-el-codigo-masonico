import {
  iniciarVinculacionWeb,
  obtenerEstadoVinculacionWeb,
  obtenerEstadoUsoMensual,
  resolverOCrearUsuarioPorIdentidad
} from "./lib-cartes-account.mjs";

export default async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: headers() });
  if (request.method !== "POST") return json({ error: "Método no permitido." }, 405);
  let body;
  try { body = await request.json(); } catch { return json({ error: "JSON inválido." }, 400); }
  const action = String(body?.action || "");
  const webIdentity = String(body?.web_identity || "").trim();
  if (!/^web_[a-zA-Z0-9_-]{8,}$/.test(webIdentity)) return json({ error: "Identidad Web inválida." }, 400);
  try {
    if (action === "start") return json(await iniciarVinculacionWeb({ webIdentity }));
    if (action === "status") {
      const [link, identity] = await Promise.all([
        obtenerEstadoVinculacionWeb({ webIdentity }),
        resolverOCrearUsuarioPorIdentidad({ tipo: "web", valor: webIdentity })
      ]);
      const usage = await obtenerEstadoUsoMensual({ userId: identity.user_id });
      return json({
        ...link,
        usage: {
          plan: usage.plan,
          limite: usage.limite,
          usadas: usage.usadas,
          disponibles: usage.disponibles,
          periodo: usage.periodo
        }
      });
    }
    return json({ error: "Acción no soportada." }, 400);
  } catch (error) {
    console.error("Cartes link error", error);
    return json({ error: "No se pudo gestionar la vinculación en este momento." }, 500);
  }
};
function headers() { return { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Cache-Control": "no-store" }; }
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: headers() }); }
