import {
  limpiarConversacionUsuario,
  mensajesDeConversacion,
  obtenerConversacionUsuario,
  resolverOCrearUsuarioPorIdentidad
} from "./lib-cartes-account.mjs";

export default async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: headers() });
  if (request.method !== "POST") return json({ error: "Método no permitido." }, 405);
  let body;
  try { body = await request.json(); } catch { return json({ error: "JSON inválido." }, 400); }
  const webIdentity = String(body?.web_identity || "").trim();
  if (!webIdentity) return json({ error: "Falta la identidad Web de Cartes." }, 400);
  try {
    const identidad = await resolverOCrearUsuarioPorIdentidad({ tipo: "web", valor: webIdentity });
    const action = String(body?.action || "history");
    if (action === "clear") {
      await limpiarConversacionUsuario({ userId: identidad.user_id });
      return json({ cleared: true, messages: [] });
    }
    if (action === "history") {
      const conversation = await obtenerConversacionUsuario({ userId: identidad.user_id });
      return json({ messages: mensajesDeConversacion(conversation) });
    }
    return json({ error: "Acción no soportada." }, 400);
  } catch (error) {
    console.error("Cartes conversation error", error);
    return json({ error: error instanceof Error ? error.message : "Error interno de conversación." }, 500);
  }
};
function headers() { return { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS" }; }
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: headers() }); }
