export default async function handler() {
  const required = ["WHATSAPP_VERIFY_TOKEN", "WHATSAPP_ACCESS_TOKEN", "META_APP_SECRET", "OPENAI_API_KEY"];
  const missing = required.filter((name) => !String(process.env[name] || "").trim());
  return Response.json({ ok: missing.length === 0, channel: "whatsapp-v2", missing });
}
