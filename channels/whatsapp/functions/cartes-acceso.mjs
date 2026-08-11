const MENSAJE_BIENVENIDA = "Hola, quiero conocer a Cartes.";
const NUMERO_PREDETERMINADO = "523322338888";

export function construirUrlAccesoCartes({ numero, mensaje } = {}) {
  const telefono = String(
    numero ||
      process.env.CARTES_WHATSAPP_NUMBER ||
      process.env.WHATSAPP_PUBLIC_NUMBER ||
      NUMERO_PREDETERMINADO
  ).replace(/\D/g, "");

  if (!/^\d{10,15}$/.test(telefono)) {
    throw new Error("El número público de WhatsApp de Cartes no es válido.");
  }

  const texto = String(
    mensaje || process.env.CARTES_WELCOME_MESSAGE || MENSAJE_BIENVENIDA
  ).trim();

  return `https://wa.me/${telefono}?text=${encodeURIComponent(texto)}`;
}

export default async (request) => {
  if (!["GET", "HEAD"].includes(request.method)) {
    return new Response("Método no permitido", {
      status: 405,
      headers: { Allow: "GET, HEAD" }
    });
  }

  try {
    return new Response(null, {
      status: 302,
      headers: {
        Location: construirUrlAccesoCartes(),
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    console.error("No se pudo abrir Cartes en WhatsApp.", {
      error: error instanceof Error ? error.message : String(error)
    });

    return new Response(
      "No fue posible abrir Cartes en WhatsApp en este momento.",
      { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }
};
