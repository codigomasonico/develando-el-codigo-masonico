import { createPayPalCheckout } from "./lib-paypal.mjs";
import { savePaymentContext } from "./lib-state.mjs";

export default async function handler(request) {
  if (request.method !== "POST") return new Response("Método no permitido", { status: 405 });
  const body = await request.json().catch(() => ({}));
  const userId = String(body?.user_id || "").trim();
  const phone = String(body?.phone || "").replace(/\D/g, "");
  const checkout = await createPayPalCheckout({ userId, phone });
  await savePaymentContext("paypal-subscription", checkout.subscription_id, { user_id: userId, phone, phone_number_id: body?.phone_number_id || null });
  return Response.json(checkout);
}
