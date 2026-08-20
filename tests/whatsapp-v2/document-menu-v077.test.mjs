import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(
  new URL(
    "../../channels/whatsapp/functions/cartes-whatsapp.mjs",
    import.meta.url
  ),
  "utf8"
);

test("Cartes Plus incorpora Revisar documento", () => {
  assert.match(
    source,
    /id:\s*"menu_document_review"/
  );

  assert.match(
    source,
    /title:\s*"Revisar documento"/
  );

  assert.match(
    source,
    /Revisa un archivo Word de hasta 5 páginas/
  );
});

test("Revisar documento indica cómo adjuntar el DOCX", () => {
  assert.match(
    source,
    /Adjunta ahora tu documento Word \(\.docx\)/
  );

  assert.match(
    source,
    /Máximo 5 páginas y 4 MB/
  );

  assert.match(
    source,
    /no se conservará después de la revisión/i
  );
});

test("Gratuito recibe oferta clara de Cartes Plus", () => {
  assert.match(
    source,
    /La revisión de documentos está disponible con Cartes Plus/
  );

  assert.match(
    source,
    /5 revisiones de documentos por mes/
  );

  assert.match(
    source,
    /50 consultas mensuales/
  );

  assert.match(
    source,
    /id:\s*"menu_suscribirme",[\s\S]*?title:\s*"Contratar Plus"/
  );
});

test("Gratuito recibe Volver al menú como alternativa", () => {
  assert.match(
    source,
    /id:\s*"menu_main",[\s\S]*?title:\s*"Volver al menú"/
  );
});

test("Gratuito no descarga el documento antes del bloqueo", () => {
  const start = source.indexOf(
    "async function recibirDocumentoWhatsApp("
  );

  assert.ok(start >= 0);

  let end = source.indexOf(
    "\nasync function ",
    start + 20
  );

  if (end < 0) {
    end = source.length;
  }

  const fn = source.slice(start, end);

  const planBlock =
    fn.indexOf('plan !== "plus"');

  const offer =
    fn.indexOf("ofrecerCartesPlusPorDocumento");

  const download =
    fn.indexOf("downloadWhatsAppMedia");

  assert.ok(planBlock >= 0);
  assert.ok(offer > planBlock);

  if (download >= 0) {
    assert.ok(
      offer < download,
      "El bloqueo Gratuito debe ocurrir antes de descargar media."
    );
  }
});

test("CTA informa que el documento no fue procesado", () => {
  assert.match(
    source,
    /El documento no fue descargado ni procesado/
  );
});

test("fallback del menú Plus también contiene Revisar documento", () => {
  assert.match(
    source,
    /• Conversar con Cartes\\n• Revisar documento\\n• Mi suscripción/
  );
});