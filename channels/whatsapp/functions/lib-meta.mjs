import crypto from "node:crypto";

const DEFAULT_GRAPH_VERSION = "v25.0";
const GRAPH_BASE = "https://graph.facebook.com";

export function verifyMetaSignature(rawBytes, signature, appSecret = process.env.META_APP_SECRET) {
  const secret = String(appSecret || "").trim();
  const header = String(signature || "").trim();
  if (!secret || !header.startsWith("sha256=")) return false;
  const receivedHex = header.slice(7).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(receivedHex)) return false;
  const expectedHex = crypto.createHmac("sha256", secret).update(Buffer.from(rawBytes)).digest("hex");
  const received = Buffer.from(receivedHex, "hex");
  const expected = Buffer.from(expectedHex, "hex");
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

export function extractMetaEvents(payload) {
  const messages = [];
  const statuses = [];
  for (const entry of Array.isArray(payload?.entry) ? payload.entry : []) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      const value = change?.value || {};
      const phoneNumberId = String(value?.metadata?.phone_number_id || "").trim() || null;
      for (const message of Array.isArray(value?.messages) ? value.messages : []) {
        messages.push({ ...message, phoneNumberId, contacts: value?.contacts || [] });
      }
      for (const status of Array.isArray(value?.statuses) ? value.statuses : []) {
        statuses.push({ ...status, phoneNumberId });
      }
    }
  }
  return { messages, statuses };
}

export function extractMessageDocument(message) {
  if (
    String(message?.type || "").toLowerCase() !== "document"
  ) {
    return null;
  }

  const document = message?.document || {};

  const id = String(document?.id || "").trim();
  const fileName = String(
    document?.filename || "documento.docx"
  ).trim();

  const mimeType = String(
    document?.mime_type || ""
  ).trim();

  if (!id) return null;

  return {
    id,
    fileName,
    mimeType,
    sha256: String(document?.sha256 || "").trim() || null
  };
}


// WHATSAPP_DOCUMENT_PREVALIDATION_V083
// Consulta metadatos del Media API sin descargar
// el contenido binario del documento.
export async function getWhatsAppMediaMetadata({
  mediaId,
  accessToken =
    process.env.WHATSAPP_ACCESS_TOKEN,
  graphVersion =
    process.env.WHATSAPP_GRAPH_VERSION ||
    DEFAULT_GRAPH_VERSION,
  fetchImpl = fetch
}) {
  const id =
    String(mediaId || "").trim();

  const token =
    String(accessToken || "").trim();

  if (!id) {
    throw new Error(
      "El documento no contiene media_id."
    );
  }

  if (!token) {
    throw new Error(
      "Falta WHATSAPP_ACCESS_TOKEN."
    );
  }

  const metadataResponse =
    await fetchImpl(
      `${GRAPH_BASE}/${graphVersion}/${encodeURIComponent(id)}`,
      {
        headers: {
          Authorization:
            `Bearer ${token}`
        }
      }
    );

  const metadataText =
    await metadataResponse.text();

  let metadata = {};

  try {
    metadata =
      metadataText
        ? JSON.parse(metadataText)
        : {};
  }
  catch {}

  if (!metadataResponse.ok) {
    throw new Error(
      metadata?.error?.message ||
      `Meta Media API respondió HTTP ${metadataResponse.status}.`
    );
  }

  const fileSize =
    Number(metadata?.file_size);

  return {
    id:
      String(
        metadata?.id || id
      ).trim(),

    url:
      String(
        metadata?.url || ""
      ).trim() || null,

    mimeType:
      String(
        metadata?.mime_type || ""
      ).trim() || null,

    fileSize:
      Number.isFinite(fileSize)
        ? fileSize
        : null,

    sha256:
      String(
        metadata?.sha256 || ""
      ).trim() || null
  };
}

export async function downloadWhatsAppMedia({
  mediaId,
  accessToken = process.env.WHATSAPP_ACCESS_TOKEN,
  graphVersion =
    process.env.WHATSAPP_GRAPH_VERSION ||
    DEFAULT_GRAPH_VERSION,
  fetchImpl = fetch
}) {
  const id = String(mediaId || "").trim();
  const token = String(accessToken || "").trim();

  if (!id) {
    throw new Error("El documento no contiene media_id.");
  }

  if (!token) {
    throw new Error("Falta WHATSAPP_ACCESS_TOKEN.");
  }

  const metadataResponse = await fetchImpl(
    `${GRAPH_BASE}/${graphVersion}/${encodeURIComponent(id)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  const metadataText =
    await metadataResponse.text();

  let metadata = {};

  try {
    metadata = metadataText
      ? JSON.parse(metadataText)
      : {};
  }
  catch {}

  if (!metadataResponse.ok) {
    throw new Error(
      metadata?.error?.message ||
      `Meta Media API respondió HTTP ${metadataResponse.status}.`
    );
  }

  const url =
    String(metadata?.url || "").trim();

  if (!url) {
    throw new Error(
      "Meta no devolvió una URL para el documento."
    );
  }

  const fileSize = Number(metadata?.file_size);

  if (
    Number.isFinite(fileSize) &&
    fileSize > 4 * 1024 * 1024
  ) {
    throw new Error(
      "El documento supera el tamaño técnico máximo de 4 MB."
    );
  }

  const mediaResponse = await fetchImpl(
    url,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  if (!mediaResponse.ok) {
    throw new Error(
      `No fue posible descargar el documento desde Meta (HTTP ${mediaResponse.status}).`
    );
  }

  let buffer = Buffer.from(
    await mediaResponse.arrayBuffer()
  );

  if (buffer.length > 4 * 1024 * 1024) {
    buffer.fill(0);
    buffer = null;

    throw new Error(
      "El documento supera el tamaño técnico máximo de 4 MB."
    );
  }

  return {
    buffer,
    mimeType:
      String(metadata?.mime_type || "").trim() || null,
    fileSize:
      Number.isFinite(fileSize)
        ? fileSize
        : buffer.length
  };
}

export function extractMessageText(message) {
  const type = String(message?.type || "").toLowerCase();
  if (type === "text") return String(message?.text?.body || "").trim();
  if (type === "interactive") {
    return String(
      message?.interactive?.button_reply?.id ||
      message?.interactive?.button_reply?.title ||
      message?.interactive?.list_reply?.id ||
      message?.interactive?.list_reply?.title ||
      ""
    ).trim();
  }
  if (type === "button") return String(message?.button?.payload || message?.button?.text || "").trim();
  return "";
}

export async function sendWhatsAppText({ to, text, phoneNumberId, accessToken = process.env.WHATSAPP_ACCESS_TOKEN, graphVersion = process.env.WHATSAPP_GRAPH_VERSION || DEFAULT_GRAPH_VERSION, fetchImpl = fetch }) {
  const phoneId = String(phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  const token = String(accessToken || "").trim();
  const recipient = String(to || "").replace(/\D/g, "");
  const bodyText = String(text || "").trim();
  if (!phoneId) throw new Error("Falta WHATSAPP_PHONE_NUMBER_ID y el webhook no aportó phone_number_id.");
  if (!token) throw new Error("Falta WHATSAPP_ACCESS_TOKEN.");
  if (!/^\d{10,15}$/.test(recipient)) throw new Error("Destinatario WhatsApp inválido.");
  if (!bodyText) throw new Error("No se puede enviar un mensaje vacío.");

  const response = await fetchImpl(`${GRAPH_BASE}/${graphVersion}/${encodeURIComponent(phoneId)}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: recipient, type: "text", text: { preview_url: false, body: bodyText } })
  });
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
  if (!response.ok) {
    const providerMessage = data?.error?.message || `HTTP ${response.status}`;
    throw new Error(`WhatsApp respondió con HTTP ${response.status}: ${providerMessage}`);
  }
  return data;
}

export async function sendWhatsAppTextParts(args) {
  const text = String(args?.text || "").trim();
  const max = 3500;
  let last = null;
  for (let i = 0; i < text.length; i += max) {
    last = await sendWhatsAppText({ ...args, text: text.slice(i, i + max) });
  }
  return last;
}


// META_INTERACTIVE_V019
export async function sendWhatsAppReplyButtons({
  to,
  phoneNumberId,
  body,
  buttons,
  footer = ""
}, options = {}) {
  const normalizedButtons = Array.isArray(buttons) ? buttons.slice(0, 3) : [];
  if (!normalizedButtons.length) throw new Error("Se requiere al menos un botón interactivo.");

  return sendInteractivePayload({
    to,
    phoneNumberId,
    interactive: {
      type: "button",
      body: { text: String(body || "").trim() },
      ...(footer ? { footer: { text: String(footer) } } : {}),
      action: {
        buttons: normalizedButtons.map((button) => ({
          type: "reply",
          reply: {
            id: String(button.id || "").trim(),
            title: String(button.title || "").trim().slice(0, 20)
          }
        }))
      }
    }
  }, options);
}

export async function sendWhatsAppInteractiveList({
  to,
  phoneNumberId,
  body,
  button = "Ver opciones",
  sections,
  footer = "",
  header = ""
}, options = {}) {
  const normalizedSections = Array.isArray(sections) ? sections : [];
  if (!normalizedSections.length) throw new Error("Se requiere al menos una sección interactiva.");

  return sendInteractivePayload({
    to,
    phoneNumberId,
    interactive: {
      type: "list",
      ...(header ? { header: { type: "text", text: String(header) } } : {}),
      body: { text: String(body || "").trim() },
      ...(footer ? { footer: { text: String(footer) } } : {}),
      action: {
        button: String(button || "Ver opciones").slice(0, 20),
        sections: normalizedSections
      }
    }
  }, options);
}

async function sendInteractivePayload({ to, phoneNumberId, interactive }, options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || fetch;
  const token = String(env.WHATSAPP_ACCESS_TOKEN || "").trim();
  const version = String(env.WHATSAPP_GRAPH_VERSION || "v25.0").trim();
  const recipient = String(to || "").replace(/\D/g, "");
  const senderId = String(phoneNumberId || "").trim();

  if (!token) throw new Error("Falta WHATSAPP_ACCESS_TOKEN.");
  if (!senderId) throw new Error("Falta WHATSAPP_PHONE_NUMBER_ID.");
  if (!recipient) throw new Error("Destinatario WhatsApp inválido.");

  const response = await fetchImpl(
    `https://graph.facebook.com/${version}/${senderId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient,
        type: "interactive",
        interactive
      })
    }
  );

  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch {}

  if (!response.ok) {
    throw new Error(data?.error?.message || `Meta respondió HTTP ${response.status}.`);
  }

  return data;
}
