const DEFAULT_MESSAGE = "Hola Cartes";
export function construirUrlAccesoCartes({ numero, mensaje } = {}) {
  const phone = String(numero || process.env.CARTES_WHATSAPP_NUMBER || process.env.WHATSAPP_PUBLIC_NUMBER || "").replace(/\D/g, "");
  if (!/^\d{10,15}$/.test(phone)) throw new Error("El número público de WhatsApp de Cartes no es válido.");
  return `https://wa.me/${phone}?text=${encodeURIComponent(String(mensaje || process.env.CARTES_WELCOME_MESSAGE || DEFAULT_MESSAGE).trim())}`;
}
export default async () => Response.redirect(construirUrlAccesoCartes(), 302);
