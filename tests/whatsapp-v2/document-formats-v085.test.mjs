import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import WordExtractor from "word-extractor";

import {
  extraerDocumentoDoc
} from "../../core/ai/cartes-document-review.mjs";

const coreSource =
  fs.readFileSync(
    new URL(
      "../../core/ai/cartes-document-review.mjs",
      import.meta.url
    ),
    "utf8"
  );

const httpSource =
  fs.readFileSync(
    new URL(
      "../../core/ai/cartes-document-review-http.mjs",
      import.meta.url
    ),
    "utf8"
  );

const webSource =
  fs.readFileSync(
    new URL(
      "../../channels/web/public/bot/guia-masonico.js",
      import.meta.url
    ),
    "utf8"
  );

const waSource =
  fs.readFileSync(
    new URL(
      "../../channels/whatsapp/functions/cartes-whatsapp.mjs",
      import.meta.url
    ),
    "utf8"
  );

test(
  "V085 extractor DOC usa Buffer y calcula páginas",
  async () => {
    const original =
      WordExtractor.prototype.extract;

    let receivedBuffer = false;

    WordExtractor.prototype.extract =
      async (input) => {
        receivedBuffer =
          Buffer.isBuffer(input);

        return {
          getBody() {
            return Array(1001)
              .fill("palabra")
              .join(" ");
          }
        };
      };

    try {
      const result =
        await extraerDocumentoDoc(
          Buffer.from([1, 2, 3])
        );

      assert.equal(receivedBuffer, true);
      assert.equal(result.words, 1001);
      assert.equal(result.pages, 3);

      assert.equal(
        result.pageCountSource,
        "estimated_doc"
      );
    }
    finally {
      WordExtractor.prototype.extract =
        original;
    }
  }
);

test(
  "V085 Core enruta DOC y DOCX a extractores distintos",
  () => {
    assert.match(
      coreSource,
      /isDocx[\s\S]*?extraerDocumentoDocx\(buffer\)[\s\S]*?extraerDocumentoDoc\(buffer\)/
    );

    assert.match(
      coreSource,
      /formato \.doc o \.docx/
    );
  }
);

test(
  "V085 HTTP admite MIME DOC y DOCX",
  () => {
    assert.match(
      httpSource,
      /application\/msword/
    );

    assert.match(
      httpSource,
      /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/
    );

    assert.match(
      httpSource,
      /formato \.doc o \.docx/
    );
  }
);

test(
  "V085 Web ofrece DOCX y DOC",
  () => {
    assert.match(
      webSource,
      /accept="\.docx,\.doc,/
    );

    assert.match(
      webSource,
      /\\\.\(docx\|doc\)\$/
    );

    assert.match(
      webSource,
      /El archivo no fue revisado y no se consumió ninguna revisión/
    );
  }
);

test(
  "V085 WhatsApp intercepta medios incompatibles antes del flujo normal",
  () => {
    const media =
      waSource.indexOf(
        "unsupportedMediaTypes"
      );

    const link =
      waSource.indexOf(
        "const linkMatch"
      );

    assert.ok(media >= 0);
    assert.ok(link > media);

    for (
      const type of
      ["image", "video", "audio", "sticker"]
    ) {
      assert.match(
        waSource,
        new RegExp(`"${type}"`)
      );
    }
  }
);

test(
  "V085 rechazo genérico no descarga ni consume revisión",
  () => {
    const start =
      waSource.indexOf(
        "async function rechazarArchivoNoCompatibleWhatsApp("
      );

    const end =
      waSource.indexOf(
        "\nasync function ",
        start + 20
      );

    const fn =
      waSource.slice(start, end);

    assert.match(
      fn,
      /El archivo no fue revisado y no se consumió ninguna revisión/
    );

    assert.doesNotMatch(
      fn,
      /downloadWhatsAppMedia/
    );

    assert.doesNotMatch(
      fn,
      /revisarDocumentoCartes/
    );

    assert.doesNotMatch(
      fn,
      /reservarRevision/
    );
  }
);