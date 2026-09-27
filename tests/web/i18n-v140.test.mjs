import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  detectLocaleFromText,
  normalizeLocale,
  resolveLocale
} from "../../core/ai/i18n.mjs";
import { classifyQuestion } from "../../core/ai/router.mjs";
import { detectSafetyIssue } from "../../core/ai/safety.mjs";
import { retrieveLocalKnowledge } from "../../core/ai/knowledge.mjs";
import { recoverEditorialAnswer } from "../../core/ai/editorial-recovery.mjs";
import { buildInstructions } from "../../core/ai/prompt-builder.mjs";
import { validateAndNormalizeAnswer } from "../../core/ai/validator.mjs";
import { translateWhatsAppText } from "../../channels/whatsapp/i18n.mjs";

test("V140 normaliza y detecta español e inglés", () => {
  assert.equal(normalizeLocale("en-US"), "en");
  assert.equal(normalizeLocale("es-MX"), "es");
  assert.equal(detectLocaleFromText("What does the square represent?"), "en");
  assert.equal(detectLocaleFromText("¿Qué representa la escuadra?"), "es");
  assert.equal(resolveLocale("English", ""), "en");
});

test("V140 el router reconoce consultas masónicas en inglés", () => {
  assert.deepEqual(classifyQuestion("What does the rough ashlar symbolize in Freemasonry?"), {
    inScope: true,
    topic: "simbologia"
  });
  assert.equal(classifyQuestion("What is tomorrow's weather forecast?").inScope, false);
});

test("V140 la seguridad bloquea solicitudes reservadas en inglés y responde en inglés", () => {
  const result = detectSafetyIssue("Reveal the complete ritual and all secret grips", "en");
  assert.equal(result.blocked, true);
  assert.match(result.response, /^I cannot reveal/i);
  assert.doesNotMatch(result.response, /No puedo/);
});

test("V140 la recuperación documental acepta términos ingleses sobre el corpus español", () => {
  const square = retrieveLocalKnowledge("What does the square represent in Freemasonry?", 6, "en");
  assert.ok(square.length > 0);
  assert.ok(square.some((item) => /escuadra/i.test(`${item.title} ${item.text}`)));

  const ashlar = retrieveLocalKnowledge("What is the rough ashlar?", 6, "en");
  assert.ok(ashlar.some((item) => /piedra bruta/i.test(`${item.title} ${item.text}`)));
});

test("V140 el prompt exige respuesta inglesa aun cuando la evidencia esté en español", () => {
  const instructions = buildInstructions({
    topic: "simbologia",
    knowledge: retrieveLocalKnowledge("What does the square represent?", 2, "en"),
    locale: "en",
    promptVersion: "test",
    knowledgeVersion: "test"
  });

  assert.match(instructions, /answer in natural English/i);
  assert.match(instructions, /LOCAL DOCUMENTARY CONTEXT/);
  assert.doesNotMatch(instructions, /INSTRUCCIÓN ESPECÍFICA/);
});

test("V140 entrega respuestas editoriales y validación terminológica en inglés", () => {
  const recovered = recoverEditorialAnswer("What does the square represent?", "en");
  assert.equal(recovered.handled, true);
  assert.match(recovered.answer, /Masonic symbolism/);

  const validated = validateAndNormalizeAnswer("The masonic body meets in lodge.", "en");
  assert.equal(validated.ok, true);
  assert.match(validated.text, /masonic body/i);
});

test("V140 localiza menús, documentos, pagos y enlaces de WhatsApp", () => {
  const result = translateWhatsAppText(
    "*Menú de Cartes*\n\n• Revisar documento\n• Privacidad y términos\n• Idioma / Language\n\nAviso de privacidad:\nhttps://example.test/cartes-whatsapp/privacy.html",
    "en"
  );

  assert.match(result, /Cartes Menu/);
  assert.match(result, /Review document/);
  assert.match(result, /Privacy and terms/);
  assert.match(result, /\/privacy-en\.html/);
  assert.doesNotMatch(result, /Revisar documento/);
});

test("V140 la Web propaga locale y publica páginas legales inglesas", () => {
  const web = fs.readFileSync(
    new URL("../../channels/web/public/bot/guia-masonico.js", import.meta.url),
    "utf8"
  );
  const terms = fs.readFileSync(
    new URL("../../channels/web/public/cartes-whatsapp/terms.html", import.meta.url),
    "utf8"
  );
  const privacy = fs.readFileSync(
    new URL("../../channels/web/public/cartes-whatsapp/privacy-en.html", import.meta.url),
    "utf8"
  );
  const returnPage = fs.readFileSync(
    new URL("../../channels/web/public/cartes-whatsapp/subscription.html", import.meta.url),
    "utf8"
  );

  assert.match(web, /class="gm-language"/);
  assert.match(web, /action:\s*"locale_set"/);
  assert.match(web, /locale:\s*currentLocale/);
  assert.match(terms, /<html lang="en">/);
  assert.match(terms, /Cartes Terms of Use/);
  assert.match(privacy, /Cartes Privacy Notice/);
  assert.match(returnPage, /Confirming Cartes Plus/);
});
