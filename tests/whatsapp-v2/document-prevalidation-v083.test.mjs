import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  getWhatsAppMediaMetadata
} from "../../channels/whatsapp/functions/lib-meta.mjs";

const source =
  fs.readFileSync(
    new URL(
      "../../channels/whatsapp/functions/cartes-whatsapp.mjs",
      import.meta.url
    ),
    "utf8"
  );

function getReceiveFunction() {
  const start =
    source.indexOf(
      "async function recibirDocumentoWhatsApp("
    );

  assert.ok(start >= 0);

  const end =
    source.indexOf(
      "\nasync function ",
      start + 30
    );

  assert.ok(end > start);

  return source.slice(start, end);
}

test(
  "V083 metadata obtiene tamaño sin descargar el binario",
  async () => {
    let calls = 0;

    const result =
      await getWhatsAppMediaMetadata({
        mediaId: "media-v083",
        accessToken: "token-v083",
        graphVersion: "v25.0",
        fetchImpl:
          async (url, options) => {
            calls += 1;

            assert.equal(
              options.headers.Authorization,
              "Bearer token-v083"
            );

            return new Response(
              JSON.stringify({
                id: "media-v083",
                url: "https://media.invalid/file",
                mime_type:
                  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                file_size:
                  5 * 1024 * 1024
              }),
              { status: 200 }
            );
          }
      });

    assert.equal(calls, 1);
    assert.equal(
      result.fileSize,
      5 * 1024 * 1024
    );
  }
);

test(
  "V083 mantiene orden formato tamaño consentimiento",
  () => {
    const fn = getReceiveFunction();

    const format =
      fn.indexOf("const isDocx");

    const metadata =
      fn.indexOf("getWhatsAppMediaMetadata");

    const size =
      fn.indexOf("MAX_DOCUMENT_BYTES_WHATSAPP");

    const consent =
      fn.indexOf("await d.setFlow(");

    assert.ok(format >= 0);
    assert.ok(metadata > format);
    assert.ok(size > metadata);
    assert.ok(consent > size);
  }
);

test(
  "V083 no descarga binario antes de autorización",
  () => {
    const receiveFn =
      getReceiveFunction();

    assert.doesNotMatch(
      receiveFn,
      /downloadWhatsAppMedia\s*\(/
    );

    const processStart =
      source.indexOf(
        "async function procesarDocumentoWhatsApp("
      );

    const processEnd =
      source.indexOf(
        "\nasync function ",
        processStart + 30
      );

    const processFn =
      source.slice(
        processStart,
        processEnd > 0
          ? processEnd
          : source.length
      );

    assert.match(
      processFn,
      /downloadWhatsAppMedia\s*\(/
    );
  }
);

test(
  "V083 archivo mayor a 4 MB termina antes de consentimiento",
  () => {
    const fn = getReceiveFunction();

    const reject =
      fn.indexOf(
        "El documento supera el máximo de 4 MB permitido para revisión."
      );

    const returnPos =
      fn.indexOf(
        "return;",
        reject
      );

    const consent =
      fn.indexOf(
        "await d.setFlow("
      );

    assert.ok(reject >= 0);
    assert.ok(returnPos > reject);
    assert.ok(consent > returnPos);
  }
);

test(
  "V085 WhatsApp admite DOC y DOCX",
  () => {
    const fn = getReceiveFunction();

    assert.match(fn, /const isDocx/);
    assert.match(fn, /const isDoc/);
    assert.match(fn, /application\/msword/);
    assert.match(
      fn,
      /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/
    );
  }
);

test(
  "V085 formato inválido se rechaza antes de metadata",
  () => {
    const fn = getReceiveFunction();

    const reject =
      fn.indexOf(
        "rechazarArchivoNoCompatibleWhatsApp"
      );

    const metadata =
      fn.indexOf(
        "getWhatsAppMediaMetadata"
      );

    assert.ok(reject >= 0);
    assert.ok(metadata > reject);
  }
);

test(
  "V083 consentimiento explica validación de páginas",
  () => {
    assert.match(
      source,
      /validar que tenga un máximo de 5 páginas/
    );

    assert.match(
      source,
      /si cumple, realizar la revisión/
    );
  }
);