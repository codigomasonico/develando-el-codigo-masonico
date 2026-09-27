const DEFAULT_MESSAGE = "Hola, quiero conocer a Cartes.";
const DEFAULT_MESSAGE_EN = "Hello, I want to meet Cartes.";

export function construirUrlAccesoCartes({ numero, mensaje, locale = "es" } = {}) {
  const phone = String(numero || process.env.CARTES_WHATSAPP_NUMBER || process.env.WHATSAPP_PUBLIC_NUMBER || "").replace(/\D/g, "");
  if (!/^\d{10,15}$/.test(phone)) throw new Error("El número público de WhatsApp de Cartes no es válido.");
  const defaultMessage = String(locale || "").toLowerCase().startsWith("en")
    ? DEFAULT_MESSAGE_EN
    : DEFAULT_MESSAGE;
  return `https://wa.me/${phone}?text=${encodeURIComponent(String(mensaje || defaultMessage).trim())}`;
}
export default async (request) => {
  const locale = request?.url
    ? new URL(request.url).searchParams.get("lang") || "es"
    : "es";
  return Response.redirect(construirUrlAccesoCartes({ locale }), 302);
};
