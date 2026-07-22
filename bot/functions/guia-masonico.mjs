import { CONFIG } from "./config.mjs";
import { classifyQuestion } from "./router.mjs";
import { detectSafetyIssue } from "./safety.mjs";
import { resolveDirectAnswer } from "./direct-answer.mjs";
import { retrieveLocalKnowledge } from "./knowledge.mjs";
import { buildInstructions } from "./prompt-builder.mjs";
import { validateAndNormalizeAnswer, safeFallbackAnswer } from "./validator.mjs";
import { recoverEditorialAnswer, stabilizeEditorialAnswer, enforceEditorialEvidenceLanguage } from "./editorial-recovery.mjs";

export default async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
  if (request.method !== "POST") return json({ error: "Método no permitido." }, 405);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: "La solicitud no contiene JSON válido." }, 400); }

  const question = sanitizeText(body?.question, CONFIG.maxQuestionChars);
  if (!question) return json({ error: "Escribe una pregunta antes de enviarla." }, 400);

  const safety = detectSafetyIssue(question);
  if (safety.blocked) return json({ answer: safety.response, filtered: true, meta: { route: "seguridad" } }, 200);

  const classification = classifyQuestion(question);
  if (!classification.inScope) {
    return json({ answer: "No puedo ayudarte con esa consulta. Este guía está dedicado a Masonería, historia, simbología, filosofía, ética y los contenidos de Develando el Código Masónico.", filtered: true, meta: { route: "fuera_de_tema" } }, 200);
  }

  const direct = resolveDirectAnswer(question);
  if (direct.handled) {
    const validated = validateAndNormalizeAnswer(direct.answer);
    return json({
      answer: validated.ok ? validated.text : safeFallbackAnswer(),
      meta: { route: "directa", source: direct.source, confidence: direct.confidence, items: direct.items, promptVersion: CONFIG.promptVersion }
    }, 200);
  }

  const knowledge = retrieveLocalKnowledge(question);

  // Banco canónico para preguntas editoriales centrales. Estas respuestas
  // forman parte del producto y no dependen de la variabilidad del modelo.
  const canonical = recoverEditorialAnswer(question);
  if (canonical.handled) {
    const validation = validateAndNormalizeAnswer(canonical.answer);
    if (!validation.ok) {
      console.error("Respuesta canónica rechazada", canonical.id, validation.warnings);
      return json({ answer: safeFallbackAnswer(), meta: { route: "ia_fallback", topic: classification.topic, validation: "canonical_rejected", promptVersion: CONFIG.promptVersion } }, 200);
    }
    return json({
      answer: validation.text,
      meta: {
        route: "ia",
        topic: classification.topic,
        recovery: canonical.id,
        sources: knowledge.map((x) => ({ type: x.type, id: x.id, title: x.title })),
        promptVersion: CONFIG.promptVersion
      }
    }, 200);
  }

  const apiKey = Netlify.env.get("OPENAI_API_KEY");
  const model = Netlify.env.get("OPENAI_MODEL") || CONFIG.defaultModel;
  if (!apiKey) return json({ error: "El guía aún no está configurado en el servidor." }, 503);

  const history = sanitizeHistory(body?.history);
  const instructions = buildInstructions({ topic: classification.topic, knowledge, promptVersion: CONFIG.promptVersion, knowledgeVersion: CONFIG.knowledgeVersion });
  try {
    const first = await requestOpenAI({ apiKey, model, instructions, history, question });
    let data = first.data;
    let generatedText = extractOutputText(data);
    let retryReason = getRetryReason(data, generatedText);

    if (retryReason) {
      console.warn("Respuesta de OpenAI incompleta o vacía; se realizará un segundo intento", retryReason);
      const retryInstructions = `${instructions}\n\nIMPORTANTE: responde de forma completa, autosuficiente y concisa. No dejes la respuesta inconclusa.`;
      const second = await requestOpenAI({ apiKey, model, instructions: retryInstructions, history, question });
      data = second.data;
      generatedText = extractOutputText(data);
      retryReason = getRetryReason(data, generatedText);
    }

    const generatedAnswer = enforceEditorialEvidenceLanguage(question, generatedText);
    const stabilized = stabilizeEditorialAnswer(question, generatedAnswer);
    const rawAnswer = stabilized.answer;
    let validation = validateAndNormalizeAnswer(rawAnswer);

    if (!validation.ok) {
      console.error("Respuesta rechazada por validación", validation.warnings, {
        status: data?.status,
        incompleteDetails: data?.incomplete_details,
        outputTypes: summarizeOutputTypes(data)
      });
      const recovery = recoverEditorialAnswer(question);
      if (recovery.handled) {
        validation = validateAndNormalizeAnswer(recovery.answer);
        if (validation.ok) {
          return json({
            answer: validation.text,
            meta: {
              route: "ia",
              topic: classification.topic,
              recovery: recovery.id,
              sources: knowledge.map((x) => ({ type: x.type, id: x.id, title: x.title })),
              promptVersion: CONFIG.promptVersion
            }
          }, 200);
        }
      }
      return json({ answer: safeFallbackAnswer(), meta: { route: "ia_fallback", topic: classification.topic, validation: "rejected", promptVersion: CONFIG.promptVersion } }, 200);
    }

    if (validation.warnings.length) console.warn("Advertencias editoriales", validation.warnings);
    return json({ answer: validation.text, meta: { route: "ia", topic: classification.topic, recovery: stabilized.handled ? stabilized.id : undefined, sources: knowledge.map((x) => ({ type: x.type, id: x.id, title: x.title })), promptVersion: CONFIG.promptVersion } }, 200);
  } catch (error) {
    console.error("Error al consultar OpenAI", error);
    const message = error?.name === "AbortError" ? "La respuesta demoró demasiado. Intenta nuevamente." : "No fue posible conectar con el servicio de inteligencia artificial.";
    return json({ error: message }, 502);
  }

};

async function requestOpenAI({ apiKey, model, instructions, history, question }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONFIG.requestTimeoutMs);
  try {
    const response = await fetch(CONFIG.openAIUrl, {
      method: "POST",
      signal: controller.signal,
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        instructions,
        input: [...history, { role: "user", content: question }],
        max_output_tokens: CONFIG.maxOutputTokens
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.error?.message || `OpenAI respondió con estado ${response.status}`);
      error.status = response.status;
      error.details = data;
      throw error;
    }
    return { data };
  } finally {
    clearTimeout(timeout);
  }
}

function getRetryReason(data, text) {
  if (!String(text || "").trim()) return "respuesta_vacia";
  if (data?.status === "incomplete") return `respuesta_incompleta:${data?.incomplete_details?.reason || "sin_detalle"}`;
  return "";
}

function summarizeOutputTypes(data) {
  if (!Array.isArray(data?.output)) return [];
  return data.output.map((item) => ({
    type: item?.type || null,
    status: item?.status || null,
    content: Array.isArray(item?.content) ? item.content.map((part) => part?.type || null) : []
  }));
}

function sanitizeHistory(value) {
  if (!Array.isArray(value)) return [];
  const cleaned = []; let totalChars = 0;
  for (const item of value.slice(-CONFIG.maxHistoryItems)) {
    if (!["user", "assistant"].includes(item?.role)) continue;
    const content = sanitizeText(item?.content, 1400);
    if (!content || totalChars + content.length > CONFIG.maxHistoryChars) continue;
    cleaned.push({ role: item.role, content }); totalChars += content.length;
  }
  return cleaned;
}
function sanitizeText(value, maxLength) { return typeof value === "string" ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, maxLength) : ""; }
function extractOutputText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  if (!Array.isArray(data?.output)) return "";

  const parts = [];
  for (const item of data.output) {
    if (typeof item?.text === "string" && item.text.trim()) parts.push(item.text.trim());
    if (!Array.isArray(item?.content)) continue;
    for (const part of item.content) {
      if (typeof part?.text === "string" && part.text.trim()) parts.push(part.text.trim());
      else if (typeof part?.output_text === "string" && part.output_text.trim()) parts.push(part.output_text.trim());
    }
  }
  return parts.join("\n").trim();
}
function corsHeaders() { return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Cache-Control": "no-store", "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff" }; }
function json(payload, status = 200) { return new Response(JSON.stringify(payload), { status, headers: corsHeaders() }); }
