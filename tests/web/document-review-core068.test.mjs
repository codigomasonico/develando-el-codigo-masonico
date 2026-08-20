import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";

import {
  sincronizarPlanUsuario
} from "../../core/ai/lib-cartes-account.mjs";

import {
  obtenerEstadoRevisionesMensual
} from "../../core/ai/lib-cartes-reviews.mjs";

import {
  CartesDocumentError,
  revisarDocumentoCartes
} from "../../core/ai/cartes-document-review.mjs";

const NOW = new Date("2026-08-14T16:00:00.000Z");
const USER = "usr_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

// TEST_OPENAI_KEY_V069_FIX
// Las llamadas reales están sustituidas por fetchImpl simulado.
// La clave solo evita que el motor interrumpa la prueba antes del mock.
process.env.OPENAI_API_KEY ||= "test-key";

function memoryStore() {
  const map = new Map();
  let seq = 0;

  return {
    async get(key) {
      return map.has(key)
        ? structuredClone(map.get(key).data)
        : null;
    },

    async getWithMetadata(key) {
      if (!map.has(key)) {
        return {
          data: null,
          etag: null
        };
      }

      const item = map.get(key);

      return {
        data: structuredClone(item.data),
        etag: item.etag
      };
    },

    async setJSON(key, value, options = {}) {
      const current = map.get(key);

      if (options.onlyIfNew && current) {
        return { modified: false };
      }

      if (
        options.onlyIfMatch &&
        current?.etag !== options.onlyIfMatch
      ) {
        return { modified: false };
      }

      seq += 1;

      map.set(key, {
        data: structuredClone(value),
        etag: `etag-${seq}`
      });

      return {
        modified: true,
        etag: `etag-${seq}`
      };
    }
  };
}

async function makeDocx({
  pages = 1,
  text = "La Masonería y el trabajo sobre uno mismo."
} = {}) {
  const zip = new JSZip();

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`
  );

  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
    Target="word/document.xml"/>
  <Relationship Id="rId2"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties"
    Target="docProps/app.xml"/>
</Relationships>`
  );

  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`
  );

  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>${escaped}</w:t></w:r></w:p>
    <w:sectPr/>
  </w:body>
</w:document>`
  );

  zip.file(
    "docProps/app.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Pages>${pages}</Pages>
</Properties>`
  );

  return zip.generateAsync({
    type: "nodebuffer"
  });
}

function fakeOpenAI() {
  return async () =>
    new Response(
      JSON.stringify({
        output_text:
          "EVALUACIÓN GENERAL\nDocumento de prueba correctamente revisado."
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
}

test("Cartes gratuito no puede usar revisión documental", async () => {
  const store = memoryStore();

  await sincronizarPlanUsuario({
    userId: USER,
    plan: "gratuito",
    fecha: NOW,
    store
  });

  const docx = await makeDocx();

  await assert.rejects(
    revisarDocumentoCartes({
      userId: USER,
      fileBuffer: docx,
      fileName: "trabajo.docx",
      channel: "web",
      requestId: "rev-free-1",
      consentAccepted: true,
      fecha: NOW,
      store,
      fetchImpl: fakeOpenAI()
    }),
    (error) =>
      error instanceof CartesDocumentError &&
      error.code === "plus_required"
  );
});

test("Cartes Plus comparte un límite central de 5 revisiones", async () => {
  const store = memoryStore();

  await sincronizarPlanUsuario({
    userId: USER,
    plan: "plus",
    fecha: NOW,
    store
  });

  for (let i = 1; i <= 5; i += 1) {
    const result = await revisarDocumentoCartes({
      userId: USER,
      fileBuffer: await makeDocx(),
      fileName: `trabajo-${i}.docx`,
      channel: i % 2 ? "web" : "whatsapp",
      requestId: `rev-plus-${i}`,
      consentAccepted: true,
      fecha: NOW,
      store,
      fetchImpl: fakeOpenAI()
    });

    assert.equal(result.ok, true);
    assert.equal(result.reviews.usadas, i);
    assert.equal(result.reviews.disponibles, 5 - i);
  }

  const state = await obtenerEstadoRevisionesMensual({
    userId: USER,
    plan: "plus",
    fecha: NOW,
    store
  });

  assert.equal(state.limite, 5);
  assert.equal(state.usadas, 5);
  assert.equal(state.disponibles, 0);

  await assert.rejects(
    revisarDocumentoCartes({
      userId: USER,
      fileBuffer: await makeDocx(),
      fileName: "sexto.docx",
      channel: "web",
      requestId: "rev-plus-6",
      consentAccepted: true,
      fecha: NOW,
      store,
      fetchImpl: fakeOpenAI()
    }),
    (error) =>
      error instanceof CartesDocumentError &&
      error.code === "review_limit"
  );
});

test("documento de más de 5 páginas se rechaza sin consumir revisión", async () => {
  const store = memoryStore();

  await sincronizarPlanUsuario({
    userId: USER,
    plan: "plus",
    fecha: NOW,
    store
  });

  await assert.rejects(
    revisarDocumentoCartes({
      userId: USER,
      fileBuffer: await makeDocx({
        pages: 6
      }),
      fileName: "demasiado-largo.docx",
      channel: "web",
      requestId: "rev-pages-6",
      consentAccepted: true,
      fecha: NOW,
      store,
      fetchImpl: fakeOpenAI()
    }),
    (error) =>
      error instanceof CartesDocumentError &&
      error.code === "page_limit"
  );

  const state = await obtenerEstadoRevisionesMensual({
    userId: USER,
    plan: "plus",
    fecha: NOW,
    store
  });

  assert.equal(state.usadas, 0);
  assert.equal(state.disponibles, 5);
});

test("fallo del motor IA libera la revisión reservada", async () => {
  const store = memoryStore();

  await sincronizarPlanUsuario({
    userId: USER,
    plan: "plus",
    fecha: NOW,
    store
  });

  const oldKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key";

  try {
    await assert.rejects(
      revisarDocumentoCartes({
        userId: USER,
        fileBuffer: await makeDocx(),
        fileName: "fallo.docx",
        channel: "whatsapp",
        requestId: "rev-fail-ai",
        consentAccepted: true,
        fecha: NOW,
        store,
        fetchImpl: async () =>
          new Response(
            JSON.stringify({
              error: {
                message: "fallo simulado"
              }
            }),
            {
              status: 500,
              headers: {
                "Content-Type": "application/json"
              }
            }
          )
      }),
      (error) =>
        error instanceof CartesDocumentError &&
        error.code === "openai_error"
    );

    const state = await obtenerEstadoRevisionesMensual({
      userId: USER,
      plan: "plus",
      fecha: NOW,
      store
    });

    assert.equal(state.usadas, 0);
    assert.equal(state.disponibles, 5);
  }
  finally {
    if (oldKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    }
    else {
      process.env.OPENAI_API_KEY = oldKey;
    }
  }
});